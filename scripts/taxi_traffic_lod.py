"""Build the two fleet LODs directly from the native Pengcheng taxi in Blender 5.2.

    blender -b models/深圳鹏程出租车.blend -P scripts/taxi_traffic_lod.py

An optional path after -- overrides the output for comparison renders.
"""
from collections import defaultdict
import ctypes
import ctypes.util
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils.kdtree import KDTree


ROOT = Path(__file__).resolve().parents[1]
OUT = (Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv
       else ROOT/'public/models/e6-pengcheng-traffic.glb')
original = list(bpy.context.scene.objects)
materials = list(bpy.data.materials)
mat_id = {m.name:i for i,m in enumerate(materials)}


def register(mat):
    mat_id[mat.name] = len(materials)
    materials.append(mat)
    return mat_id[mat.name]


def opaque(mat, color=None):
    m = mat.copy()
    m.name = 'Fleet opaque · '+mat.name
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Alpha'].default_value = 1
    if color:
        for node in list(m.node_tree.nodes):
            if node.type=='TEX_IMAGE':
                m.node_tree.nodes.remove(node)
        bs.inputs['Base Color'].default_value = (*color,1)
        m.diffuse_color = (*color,1)
    return register(m)


plate_original = next(m for m in materials if 'green plate' in m.name)
plate = opaque(plate_original,(.19,.52,.25))
vacancy_original=next(m for m in materials if 'vacancy LED' in m.name)
vacancy=opaque(vacancy_original,(.018,.13,.046))
glass_names = ('Laminated windscreen','Front door solar glass','Privacy glass')
far_glass = {mat_id[n]:opaque(materials[mat_id[n]]) for n in glass_names}


# Blender ships meshoptimizer beside its executable. The C API keeps the
# original vertex buffer, unlike a decimator which moves positions across paint.
def load_simplifier():
    exe = Path(bpy.app.binary_path).parent
    locations = [exe/'blender.shared/meshoptimizer.dll',
                 exe/'lib/libmeshoptimizer.so', exe/'../Resources/lib/libmeshoptimizer.dylib',
                 ctypes.util.find_library('meshoptimizer')]
    for path in locations:
        if path:
            try:
                lib = ctypes.CDLL(str(path))
                break
            except OSError:
                pass
    else:
        raise RuntimeError('A Blender installation with the meshoptimizer shared library is required.')
    fn = lib.meshopt_simplifyWithAttributes
    ptr,size = ctypes.c_void_p,ctypes.c_size_t
    fn.argtypes = [ptr,ptr,size,ptr,size,size,ptr,size,ptr,size,ptr,size,
                   ctypes.c_float,ctypes.c_uint,ptr]
    fn.restype = size
    return fn


simplify = load_simplifier()


def native_array(items,field,width,dtype):
    a = np.empty(len(items)*width,dtype=dtype)
    items.foreach_get(field,a)
    return a.reshape(-1,width) if width!=1 else a


def boundary_anchors(tris,labels,pos,tolerance,max_span):
    """Pin actual bends and spaced samples along paint edges and panel closures."""
    edges = np.concatenate([tris[:,[0,1]],tris[:,[1,2]],tris[:,[2,0]]])
    edges.sort(axis=1)
    face_labels = np.tile(labels,3).astype('int32')+1
    order = np.lexsort((edges[:,1],edges[:,0]))
    edges,face_labels = edges[order],face_labels[order]
    first = np.r_[True,np.any(edges[1:]!=edges[:-1],axis=1)]
    begin = np.flatnonzero(first)
    end = np.r_[begin[1:]-1,len(edges)-1]
    a,b = face_labels[begin],face_labels[end]
    b = np.where(begin==end,0,b)
    keep = a!=b
    chains = defaultdict(lambda:defaultdict(list))
    for (u,v),ma,mb in zip(edges[begin[keep]],a[keep],b[keep]):
        graph = chains[(min(ma,mb),max(ma,mb))]
        graph[u].append(v);graph[v].append(u)

    fixed = np.zeros(len(pos),np.uint8)
    def sample(line):
        if len(line)<2:
            return
        indices = np.asarray(line)
        xyz = pos[indices]
        pending = [(0,len(line)-1)]
        while pending:
            start,end = pending.pop()
            fixed[indices[start]]=fixed[indices[end]]=1
            if end<=start+1:
                continue
            delta = xyz[end]-xyz[start]
            d2 = delta@delta
            rel = xyz[start+1:end]-xyz[start]
            f = np.clip((rel@delta)/max(d2,1.e-15),0,1)
            err = np.sum((rel-f[:,None]*delta)**2,axis=1)
            worst = int(err.argmax())
            if err[worst]>tolerance*tolerance:
                split = start+1+worst
            elif d2>max_span*max_span:
                split = start+1+int(np.abs(f-.5).argmin())
            else:
                continue
            pending.extend(((start,split),(split,end)))

    for graph in chains.values():
        visited=set()
        for start in sorted(graph,key=lambda n:len(graph[n])==2):
            for other in graph[start]:
                if (start,other) in visited:
                    continue
                line=[start];prev,cur=start,other
                while True:
                    line.append(cur)
                    visited.update(((prev,cur),(cur,prev)))
                    if cur==start or len(graph[cur])!=2:
                        break
                    after=next(n for n in graph[cur] if n!=prev)
                    if (cur,after) in visited:
                        break
                    prev,cur=cur,after
                sample(line)
    return fixed


def source_mesh(obj,far=False):
    """Retain native corner normals, material wedges, flat faces and decal UVs."""
    mesh=obj.data
    mesh.calc_loop_triangles()
    corners=native_array(mesh.loop_triangles,'loops',3,'uint32')
    polys=native_array(mesh.loop_triangles,'polygon_index',1,'uint32')
    indices=native_array(mesh.loops,'vertex_index',1,'uint32')
    pos=native_array(mesh.vertices,'co',3,'float32')
    normals=native_array(mesh.corner_normals,'vector',3,'float32')
    face_ids=native_array(mesh.polygons,'material_index',1,'uint32')
    palette=np.array([mat_id[m.name] for m in mesh.materials],dtype='uint16')
    palette[palette==mat_id[plate_original.name]]=plate
    if far:
        for old,new in far_glass.items():
            palette[palette==old]=new
    ids=palette[face_ids[polys]]
    name=obj.name.lower()
    if name.startswith('wheel'):
        # Raised micro tread and cast lettering disappear below about one pixel.
        # The full tyre, the split spokes and their machined facets remain.
        ok=ids!=mat_id['Tyre shoulder and tread']
        corners,ids=corners[ok],ids[ok]
    elif 'clear outer headlamp' in name:
        # The outer polycarbonate's highlights are useful in the middle LOD.
        if far:
            return None
    if far and 'projector, light' in name:
        visible=('Lamp housing graphite','Faceted chrome reflector','White ribbon diffuser','Projector bluish antireflection','Reverse light prism')
        ok=np.isin(ids,[mat_id[key] for key in visible])
        area=native_array(mesh.polygons,'area',1,'float32')[polys]
        ok&=((ids!=mat_id['Faceted chrome reflector'])|(area>.000115))
        corners,ids=corners[ok],ids[ok]
    if 'front bucket seats' in name:
        ok=ids==mat_id['Graphite leather seats']
        corners,ids=corners[ok],ids[ok]
    if 'rigid number plate' in name:
        visible=(plate,) if far else (plate,mat_id['Satin graphite trim'],mat_id['Lamp housing graphite'])
        ok=np.isin(ids,visible)
        corners,ids=corners[ok],ids[ok]
    loops=corners.reshape(-1)
    keys=[indices[loops,None],np.repeat(ids,3)[:,None],np.round(normals[loops]*32767)]
    uv=None
    if mesh.uv_layers.active:
        uv=native_array(mesh.uv_layers.active.data,'uv',2,'float32')
        keys.append(np.round(uv[loops]*1048576))
    _,first,index=np.unique(np.column_stack(keys),axis=0,return_index=True,return_inverse=True)
    first=first.reshape(-1); index=index.reshape(-1).astype('uint32')
    source=indices[loops[first]]; p=pos[source]; n=normals[loops[first]]
    u=uv[loops[first]] if uv is not None else np.zeros((len(p),2),'float32')
    return p,n,u,ids[first//3],index,indices[corners],ids,pos,source


main_skin=('quarter panel','rear door','front door','front fender','bonnet stamping',
           'bumper understructure','tailgate and rear bumper','window panes','a pillar',
           'front windscreen','roof skin','tailgate backlight','tailgate upper shoulder')


def reduce_mesh(obj,far):
    data=source_mesh(obj,far)
    if not data:
        return None
    p,n,uv,mat,idx,tri,labels,original_pos,source=data
    name=obj.name.lower()
    skin=any(s in name for s in main_skin)
    wheel=name.startswith('wheel')
    artwork=name.startswith('pengcheng -') and 'curved amber' not in name
    ratio=(.012 if far else .040) if skin else (.008 if far else .029)
    error=(.016 if far else .004) if skin else (.024 if far else .006)
    if 'projector, light' in name or 'combination lamps' in name:
        ratio,error=(.011,.016) if far else (.105,.003)
    if wheel:
        ratio,error=(.006,.025) if far else (.042,.005)
    if far and ('bumper understructure' in name or 'tailgate and rear bumper' in name):
        ratio,error=(.016,.0045) if 'understructure' in name else (.012,.006)
    if far and any(k in name for k in ('hood closure','triangular corner','combination lamps','projector, light')):
        # Keep thin inserts in front of the coarser underlying bumper facets.
        front='combination lamps' not in name
        if 'triangular corner' in name:
            ratio,error=.022,.0035
        towards=np.column_stack((p[:,0]*.48, np.full(len(p),-1 if front else 1),np.zeros(len(p))))
        p=p+(towards/np.linalg.norm(towards,axis=1,keepdims=True)*.009).astype('float32')
    if artwork:
        ratio,error=(.015,.023) if far else (.14,.0014)
    if far and 'green vacancy' in name:
        mat.fill(vacancy)
    lock=None
    if skin:
        anchors=boundary_anchors(tri,labels,original_pos,.006 if far else .00120,
                                .58 if far else .20)
        lock=np.ascontiguousarray(anchors[source])
    # Default topology mode collapses material/UV seams in matched pairs. A
    # shared paint vertex on either side always retains the same 3-D position.
    attrs=np.ascontiguousarray(np.column_stack((n,uv)),dtype='float32')
    norm_weight=.006 if far else .018
    weights=np.array([norm_weight]*3+[.45 if artwork else 0]*2,'float32')
    out=np.empty_like(idx)
    target=max(12,round(len(idx)*ratio/3)*3)
    count=simplify(out.ctypes.data,idx.ctypes.data,len(idx),p.ctypes.data,len(p),12,
                   attrs.ctypes.data,20,weights.ctypes.data,5,
                   lock.ctypes.data if lock is not None else None,target,error,12 if far or wheel or 'front bucket seats' in name else 4,None)
    selected=out[:count].reshape(-1,3)
    if not len(selected):
        return None
    if np.any(mat[selected]!=mat[selected[:,0],None]):
        raise RuntimeError(f'Material boundary crossed on {obj.name}')
    unique,remap=np.unique(selected,return_inverse=True)
    return p[unique],n[unique],uv[unique],mat[unique],remap.reshape(-1,3)


class Batch:
    def __init__(self):
        self.parts=[]
    def add(self,part,matrix=None):
        if part is None:
            return
        p,n,u,m,f=part
        if matrix is not None:
            a=np.asarray(matrix)
            p=p@a[:3,:3].T+a[:3,3]
            n=n@np.linalg.inv(a[:3,:3])
            n=n/np.maximum(1.e-10,np.linalg.norm(n,axis=1,keepdims=True))
            if np.linalg.det(a[:3,:3])<0:
                f=f[:,[0,2,1]]
        self.parts.append((p,n,u,m,f))
    def object(self,name):
        all_pos,all_norm,all_uv,all_mat,all_faces=[],[],[],[],[]
        offset=0
        for p,n,u,mat,faces in self.parts:
            all_pos.append(p);all_norm.append(n);all_uv.append(u)
            all_mat.append(mat[faces[:,0]]);all_faces.append(faces+offset)
            offset+=len(p)
        p,n,u=map(np.concatenate,(all_pos,all_norm,all_uv))
        material,faces=map(np.concatenate,(all_mat,all_faces))
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(p.tolist(),[],faces.tolist())
        ids,local=np.unique(material,return_inverse=True)
        for i in ids:
            mesh.materials.append(materials[i])
        mesh.polygons.foreach_set('material_index',local.astype('int32'))
        mesh.polygons.foreach_set('use_smooth',np.ones(len(faces),bool))
        if u.any():
            layer=mesh.uv_layers.new(name='Native fleet artwork')
            layer.data.foreach_set('uv',u[faces.ravel()].astype('float32').ravel())
        mesh.update()
        mesh.normals_split_custom_set_from_vertices(n.tolist())
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        return obj

def grille_decal(obj):
    """Rasterize the real 450 recesses onto a conformal patch for mip filtering."""
    mesh=obj.data
    mesh.calc_loop_triangles()
    coords=native_array(mesh.vertices,'co',3,'float32')
    tris=native_array(mesh.loop_triangles,'vertices',3,'uint32')
    face=native_array(mesh.loop_triangles,'polygon_index',1,'uint32')
    ids=native_array(mesh.polygons,'material_index',1,'uint32')[face]
    dark=next(i for i,m in enumerate(mesh.materials) if 'aperture depth' in m.name)
    triangles=coords[tris[ids==dark]][:,:,[0,2]]
    lo=triangles.min(axis=(0,1))-.001
    hi=triangles.max(axis=(0,1))+.001
    width,height=512,144
    ss=3
    scale=np.array([width*ss,height*ss])/(hi-lo)
    mask=np.zeros((height*ss,width*ss),bool)
    for a,b,c in (triangles-lo)*scale:
        xmin,ymin=np.floor(np.minimum(np.minimum(a,b),c)).astype(int)
        xmax,ymax=np.ceil(np.maximum(np.maximum(a,b),c)).astype(int)
        xx=np.arange(xmin,xmax)+.5;yy=np.arange(ymin,ymax)[:,None]+.5
        e0=(xx-a[0])*(b[1]-a[1])-(yy-a[1])*(b[0]-a[0])
        e1=(xx-b[0])*(c[1]-b[1])-(yy-b[1])*(c[0]-b[0])
        e2=(xx-c[0])*(a[1]-c[1])-(yy-c[1])*(a[0]-c[0])
        mask[ymin:ymax,xmin:xmax]|=((e0>=0)&(e1>=0)&(e2>=0))|((e0<=0)&(e1<=0)&(e2<=0))
    coverage=mask.reshape(height,ss,width,ss).mean(axis=(1,3))
    image=bpy.data.images.new('Sampled Pengcheng grille · 450 recesses',width,height,alpha=True)
    rgba=np.full((height,width,4),.20,dtype='float32')
    rgba[:,:,3]=coverage
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    m=bpy.data.materials.new('Fleet · recessed porcelain grille')
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    m.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
    bs.inputs['Roughness'].default_value=.68
    slot=register(m)
    tree=KDTree(len(coords))
    for i,(x,y,z) in enumerate(coords):
        tree.insert((x,0,z),i)
    tree.balance()
    positions=[];uv=[];faces=[]
    nx,nz=21,7
    for j in range(nz+1):
        for i in range(nx+1):
            u,v=i/nx,j/nz
            x,z=lo+(hi-lo)*[u,v]
            _,idx,_=tree.find((x,0,z))
            positions.append((x,coords[idx,1]-.006,z));uv.append((u,v))
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i;b=a+nx+1
            faces.extend(((a,a+1,b+1),(a,b+1,b)))
    n=len(positions)
    return (np.asarray(positions),np.tile([0.,-1.,0.],(n,1)),np.asarray(uv),
            np.full(n,slot,dtype='uint16'),np.array(faces))


def sampled_flank(objects,side):
    """Slice the four native door/fender stampings together at the wheel arcs.

    In distant traffic the individual hems are subpixel. Each cross section
    still passes through every original livery boundary, even when the wheel
    arch intersects one or more colours.
    """
    points=[];normals=[];labels=[];rear_edge=[]
    for obj in objects:
        mesh=obj.data
        mesh.calc_loop_triangles()
        corners=native_array(mesh.loop_triangles,'loops',3,'uint32')
        polys=native_array(mesh.loop_triangles,'polygon_index',1,'uint32')
        indices=native_array(mesh.loops,'vertex_index',1,'uint32')
        positions=native_array(mesh.vertices,'co',3,'float32')
        if 'quarter panel' in obj.name.lower():
            all_edges=indices[corners][:,[0,1,1,2,2,0]].reshape(-1,2)
            all_edges.sort(axis=1)
            edges,counts=np.unique(all_edges,return_counts=True,axis=0)
            for a,b in positions[edges[counts==1]]:
                # The end of the native quarter pressing curves forward above
                # the rear lamps; its upper edge is not a constant-Y plane.
                if min(a[1],b[1])>1.86 and abs(b[1]-a[1])<1.25*abs(b[2]-a[2]):
                    rear_edge.extend([(a[2],a[1]),(b[2],b[1])])
        points.append(positions[indices[corners]])
        normals.append(native_array(mesh.corner_normals,'vector',3,'float32')[corners])
        slots=np.array([mat_id[m.name] for m in mesh.materials])
        labels.append(slots[native_array(mesh.polygons,'material_index',1,'uint32')[polys]])
    pts,norms,mats=map(np.concatenate,(points,normals,labels))
    edge=np.array(sorted(set(rear_edge)))
    if len(edge)<8:
        raise ValueError('Could not trace the native rear-quarter closure')
    # In sectional coordinates the curved rear closure becomes a single
    # station. Intersection points themselves stay in original model space.
    y_axis=pts[:,:,1]
    end_delta=edge[:,1].max()-np.interp(pts[:,:,2],edge[:,0],edge[:,1])
    station=y_axis+end_delta*np.clip((y_axis-1.12)/.55,0,1)
    ymin,ymax=station.min(),station.max()
    stations=set(np.linspace(ymin+.00008,ymax-.0001,17))
    for axle in (-1.4,1.4):
        for y in (*(.366*np.cos(np.linspace(0,np.pi,13))+axle),axle-.390,axle+.390):
            if ymin<y<ymax:
                stations.add(y)
    blue,white,navy=[mat_id[k] for k in ('Ocean Blue clearcoat','Pearl White clearcoat','Pengcheng midnight blue pinstripe')]
    strips=[blue,navy,white,white,white,navy,blue]
    positions=[];shading=[];triangles=[];vertex_mat=[]
    last=None
    for y in sorted(stations):
        sel=(station.min(axis=1)<=y)&(station.max(axis=1)>=y)
        if not np.any(sel):
            continue
        tri=pts[sel];tn=norms[sel];tm=mats[sel];guide=station[sel]
        intersections=[];intersection_norms=[];intersection_ids=[]
        for i,k in ((0,1),(1,2),(2,0)):
            a,b=tri[:,i],tri[:,k]
            sy,ey=guide[:,i],guide[:,k]
            ok=((sy<=y)&(ey>y))|((ey<=y)&(sy>y))
            alpha=(y-sy[ok])/(ey[ok]-sy[ok])
            intersections.append(a[ok]+alpha[:,None]*(b[ok]-a[ok]))
            intersection_norms.append(tn[ok,i]+alpha[:,None]*(tn[ok,k]-tn[ok,i]))
            intersection_ids.append(tm[ok])
        pt,no,ids=map(np.concatenate,(intersections,intersection_norms,intersection_ids))
        heights=pt[:,2];lo,hi=heights.min(),heights.max()
        whites=heights[ids==white]
        if not len(whites):
            continue
        w0,w1=whites.min(),whites.max()
        lower=heights[(ids==blue)&(heights<=w0+.00001)]
        upper=heights[(ids==blue)&(heights>=w1-.00001)]
        levels=[lo,lower.max() if len(lower) else lo,w0,
                w0+(w1-w0)*.14,w0+(w1-w0)*.65,w1,upper.min() if len(upper) else hi,hi]
        strip_indices=[]
        for j,material in enumerate(strips):
            corners=[]
            for h in levels[j:j+2]:
                near=np.argmin(np.abs(heights-h))
                corners.append(len(positions))
                positions.append((pt[near,0],pt[near,1],h))
                norm=no[near].copy()
                if material==white and h<.82:
                    # The stamped arch return turns sharply into the wheel well.
                    # Keep the subpixel inner bevel out of the outer door normal.
                    norm[0]=side*max(abs(norm[0]),.82)
                    norm[2]=np.clip(norm[2],-.23,.23)
                shading.append(norm/max(1.e-10,np.linalg.norm(norm)))
                vertex_mat.append(material)
            strip_indices.append(corners)
            if last:
                a,b=last[j];c,d=corners
                for face in ((a,c,d),(a,d,b)):
                    v=np.asarray([positions[k] for k in face])
                    cross=np.cross(v[1]-v[0],v[2]-v[0])
                    if cross@cross>1.e-15:
                        triangles.append(face if cross[0]*side>0 else face[::-1])
        last=strip_indices
    return (np.asarray(positions),np.asarray(shading),np.zeros((len(positions),2)),
            np.asarray(vertex_mat),np.asarray(triangles))


def distant_wheel(obj):
    """Resample the stock tyre/rim section and the two branches of each spoke."""
    p=native_array(obj.data.vertices,'co',3,'float32')
    side=1 if obj.name.endswith('R') else -1
    search=KDTree(len(p))
    for i,point in enumerate(p):
        search.insert(point,i)
    search.balance()
    out=[];nrm=[];ids=[];faces=[]
    def at(d,r,a):
        return np.array([side*d,-r*np.cos(a),r*np.sin(a)])
    def point(d,r,a):
        # The sample inherits the native contact patch and shoulder profile.
        _,idx,_=search.find(at(d,r,a))
        return p[idx]
    def face(points,mat,norms):
        start=len(out);out.extend(points);nrm.extend(norms);ids.extend([mat_id[mat]]*len(points))
        for i in range(1,len(points)-1):
            tri=(start,start+i,start+i+1)
            v=np.asarray([out[k] for k in tri])
            n=np.cross(v[1]-v[0],v[2]-v[0])
            if n@n<1.e-15:
                continue
            faces.append(tri if n@np.sum(norms,axis=0)>0 else tri[::-1])
    rings=[(-.095,.307),(-.061,.334),(.061,.334),(.101,.307),(.109,.218),(.104,.199)]
    radial=lambda a:np.array([0.,-np.cos(a),np.sin(a)])
    outward=np.array([float(side),0.,0.])
    stops=np.linspace(0,2*np.pi,17)
    for a,b in zip(stops,stops[1:]):
        for j,((d,r),(e,s)) in enumerate(zip(rings,rings[1:])):
            xyz=[point(d,r,a),point(d,r,b),point(e,s,b),point(e,s,a)]
            norm=[radial(k)*w+outward*t for k,w,t in
                  [(a,1 if j<3 else .13,0 if j<2 else 1),(b,1 if j<3 else .13,0 if j<2 else 1),
                   (b,1 if j<2 else .13,0 if j<1 else 1),(a,1 if j<2 else .13,0 if j<1 else 1)]]
            face(xyz,'Tyre sidewall' if j<4 else 'Machined aluminium',norm)
        face([at(.072,0,0),at(.072,.201,a),at(.072,.201,b)],'Cast alloy return',[outward]*3)
        face([at(.102,0,0),at(.10,.062,a),at(.10,.062,b)],'Machined aluminium',[outward]*3)
    for j in range(5):
        angle=j*2*np.pi/5+.15
        for branch in (-1,1):
            ds=[point(.096,.055,angle+branch*.13-.24),point(.096,.055,angle+branch*.13+.24),
                point(.105,.208,angle+branch*.287+.119),point(.105,.208,angle+branch*.287-.119)]
            face(ds,'Machined aluminium',[outward]*4)
    n=np.asarray(nrm);n/=np.maximum(1.e-10,np.linalg.norm(n,axis=1,keepdims=True))
    return np.asarray(out),n,np.zeros((len(out),2)),np.asarray(ids),np.asarray(faces)


body,far_body,marks=Batch(),Batch(),Batch()
fleet_wheel=Batch()
axles=[]
skip=('bumper fleet registration','inspection permits','interior mirror','heated rear screen')
far_skip=('pull handles','door shuts','roof channels','cloisonné',
          'liftgate opening','steering wheel','dashboard','front bucket seats','green vacancy',
          'operator roof panels','door emblems','clear outer')
flanks={-1:[],1:[]}
wheels={}
for obj in original:
    if obj.type!='MESH' or any(c.name.startswith('摄影棚') for c in obj.users_collection):
        continue
    name=obj.name.lower()
    if name.startswith('wheel_'):
        if obj.data not in wheels:
            wheels[obj.data]=distant_wheel(obj)
        far_body.add(wheels[obj.data],obj.matrix_world)
        if name=='wheel_fl':
            fleet_wheel.add(reduce_mesh(obj,False))
        axles.append(obj)
        continue
    if any(k in name for k in skip):
        continue
    if 'perforated porcelain' in name:
        marks.add(grille_decal(obj),obj.matrix_world)
        continue
    printed=any(k in name for k in ('door emblems','green vacancy','operator roof panels'))
    (marks if printed else body).add(reduce_mesh(obj,False),obj.matrix_world)
    if any(k in name for k in main_skin[:4]):
        flanks[-1 if name.startswith('lh') else 1].append(obj)
    elif 'green vacancy' in name or (not printed and not any(k in name for k in far_skip)):
        far_body.add(reduce_mesh(obj,True),obj.matrix_world)

for side,panels in flanks.items():
    far_body.add(sampled_flank(panels,side))

near_obj=body.object('Coachwork')
near_obj['design_reference']='Second-generation Shenzhen Bus Group / Pengcheng e6; source panel topology'
far_obj=far_body.object('Fleet distant silhouette')
far_obj['distant_taxi']=True
rolling=fleet_wheel.object('wheel_LF')
wheelnames={'Wheel_FL':'wheel_LF','Wheel_FR':'wheel_RF','Wheel_RL':'wheel_LR','Wheel_RR':'wheel_RR'}
out=[near_obj,far_obj,marks.object('Fleet shared screen prints and grille')]
for ref in sorted(axles,key=lambda o:o.name):
    node=rolling if ref.name=='Wheel_FL' else bpy.data.objects.new(wheelnames[ref.name],rolling.data)
    if node!=rolling:
        bpy.context.collection.objects.link(node)
    node.location=ref.matrix_world.translation
    if ref.name.endswith('R'):
        node.rotation_euler.z=np.pi
    node['rolling_radius']=float(ref['rolling_radius'])
    out.append(node)

bpy.ops.object.select_all(action='DESELECT')
for obj in out:
    obj.select_set(True)
bpy.context.view_layer.objects.active=near_obj
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,
    export_extras=True,export_normals=True,export_texcoords=True,export_animations=False,
    export_cameras=False,export_lights=False,export_meshopt_compression_enable=True,
    export_meshopt_extension='EXT_meshopt_compression')
print('FLEET',str(OUT),OUT.stat().st_size,'bytes')
for o in out[:4]:
    print(o.name,len(o.data.polygons),'triangles')
