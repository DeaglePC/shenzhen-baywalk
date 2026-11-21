"""Build the moving traffic taxi from the native coachwork, retaining its silhouette.

    blender -b models/深圳鹏程出租车.blend -P scripts/taxi_traffic_lod.py

The registered plate, driver and LED lettering belong to the one parked hero.
Moving cars share simplified painted panels, glazing, wheel sets and roof sign.
"""
from math import sin,cos,pi
from pathlib import Path
import bpy
from mathutils import Vector

OUT=Path(__file__).resolve().parents[1]/'public/models/e6-pengcheng-traffic.glb'
original=list(bpy.context.scene.objects)
palette={}

def material(name,rgb,metal=.08,rough=.46):
    if name not in palette:
        m=bpy.data.materials.new("Fleet · "+name);m.use_nodes=True
        bs=m.node_tree.nodes.get("Principled BSDF")
        linear=tuple(((v/255+.055)/1.055)**2.4 if v>10 else v/3294.6 for v in rgb)
        bs.inputs['Base Color'].default_value=(*linear,1)
        bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
        m.diffuse_color=(*linear,1);palette[name]=m
    return palette[name]

def finish(m):
    if not m:return material("trim",(33,38,39))
    name=m.name.lower()
    if 'green plate' in name:return material("green registration",(113,179,130),.08,.42)
    if 'vacancy led' in name:return material("vacancy display",(26,65,43),.04,.52)
    if any(s in name for s in ('print','lettering','number plate','graphic','decal','plate artwork','fare display','emblem artwork')):return None
    if 'clear lens' in name:return None
    if 'windscreen' in name or 'glass' in name:
        return material("solar glass",(52,72,76),.46,.18)
    b=m.node_tree.nodes.get("Principled BSDF") if m.use_nodes else None
    if not b:return material('trim',(33,38,39))
    if b.inputs['Alpha'].default_value<.35 or b.inputs['Alpha'].is_linked:return None
    c=b.inputs['Base Color'].default_value
    rgb=tuple(round(255*(12.92*v if v<.00313 else 1.055*v**(1/2.4)-.055)) for v in c[:3])
    return material(m.name,rgb,b.inputs['Metallic'].default_value,b.inputs['Roughness'].default_value)

class Batch:
    def __init__(self):
        self.p=[];self.f=[];self.labels=[]
    def face(self,p,mat):
        n=len(self.p);self.p.extend(p);self.f.append(tuple(range(n,n+len(p))));self.labels.append(mat)
    def object(self,name):
        if not self.f:raise RuntimeError(f"Empty fleet batch: {name}")
        # Share vertices inside each coloured patch to preserve curved highlights.
        pts=[];lookup={};faces=[];labels=[]
        for face,mat in zip(self.f,self.labels):
            idx=[]
            for j in face:
                p=tuple(round(float(a),5) for a in self.p[j]);key=(p,mat.name)
                if key not in lookup:lookup[key]=len(pts);pts.append(p)
                idx.append(lookup[key])
            if len(set(idx))!=len(idx) or len(idx)<3:continue
            faces.append(idx);labels.append(mat)
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(pts,[],faces)
        slots=list(dict.fromkeys(labels))
        for m in slots:mesh.materials.append(m)
        for polygon,mat in zip(mesh.polygons,labels):polygon.material_index=slots.index(mat);polygon.use_smooth=True
        mesh.validate(clean_customdata=True);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        return obj

def take_surface(o):
    if o.type!='MESH' or any(c.name.startswith('摄影棚') for c in o.users_collection):return False
    name=o.name.lower()
    if o.get('rolling_radius') or name.startswith('wheel_'):return False
    if any(s in name for s in ('driver','seat','upholst','dashboard','console','steering','pedal','wiper','washer','grille dot','perforation','stitch','letters','inscription','insignia','decal','led dots','license plate','registration plate','studio','underfloor')):return False
    return max(o.dimensions)>.13

def coachwork(far):
    batch=Batch()
    for o in filter(take_surface,original):
        mats=[finish(m) for m in o.data.materials]
        if not any(mats):continue
        name=o.name.lower()
        if far and any(s in name for s in ('shutline','seal','louver','projector','reflector','well felt','aperture','diode','perforated','radiator cover','number plate','fastener','undertray','filament','cooling duct')):continue
        mod=o.modifiers.new('交通模型简化','DECIMATE')
        # Allocate more geometry to the long, curved surfaces which read in silhouette.
        budget=min(300,max(26,int(max(o.dimensions)*125)))
        if far:budget=max(8,budget//5)
        mod.ratio=min(1,budget/max(1,len(o.data.polygons)*1.7))
        deps=bpy.context.evaluated_depsgraph_get();evaluated=o.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        for face in mesh.polygons:
            slot=face.material_index
            if slot>=len(mats) or not mats[slot]:continue
            batch.face([o.matrix_world@mesh.vertices[i].co for i in face.vertices],mats[slot])
        evaluated.to_mesh_clear();o.modifiers.remove(mod)
    return batch

def wheel(batch,side,location,segments):
    tyre=material("tyre",(34,36,37),.01,.82);alloy=material("silver wheel",(181,185,186),.73,.28)
    brake=material("brake",(53,55,54),.48,.5)
    def at(d,r,a):
        return (location[0]+side*d,location[1]+r*cos(a),location[2]+r*sin(a))
    def outward(pts,mat,normal):
        a,b,c=map(Vector,pts[:3])
        if (b-a).cross(c-a).dot(Vector(normal))<0:pts.reverse()
        batch.face(pts,mat)
    def front(pts,mat):outward(pts,mat,(side,0,0))
    for i in range(segments):
        a,b=2*pi*i/segments,2*pi*(i+1)/segments
        profile=[(-.097,.241),(-.089,.308),(-.065,.325),(.064,.325),(.094,.306),(.106,.226),(.103,.212)]
        for (x,r),(X,R) in zip(profile,profile[1:]):
            outward([at(x,r,a),at(x,r,b),at(X,R,b),at(X,R,a)],tyre,(-side*(R-r),(X-x)*cos((a+b)/2),(X-x)*sin((a+b)/2)))
        front([at(.104,.227,a),at(.104,.227,b),at(.104,.198,b),at(.104,.198,a)],alloy)
        front([at(.082,.212,a),at(.082,.212,b),at(.084,.001,b)],brake)
        front([at(.106,.065,a),at(.106,.065,b),at(.11,.001,b)],alloy)
    for j in range(5):
        angle=j*pi*.4
        for k in (-1,1):
            front([at(.112,.049,angle-.18),at(.112,.049,angle+.18),at(.105,.209,angle+k*.23+.038),at(.103,.209,angle+k*.23-.064)],alloy)

near=coachwork(False).object("Coachwork");near["design_reference"]="BYD new e6 / Pengcheng fleet"
far=coachwork(True)
offsets=[(-.770,-1.4,.325),(.770,-1.4,.325),(-.765,1.4,.325),(.765,1.4,.325)]
for x,y,z in offsets:wheel(far,1 if x>0 else -1,(x,y,z),10)
far_obj=far.object("Fleet distant silhouette");far_obj["distant_taxi"]=True
rolling=Batch();wheel(rolling,-1,(0,0,0),20)
lf=rolling.object("wheel_LF");lf.location=offsets[0];lf['rolling_radius']=.325
out=[near,far_obj,lf]
# Use the photographed company's shared markings on nearby fleet cars. The
# assigned number and full registration stay unique to the parked hero vehicle.
for o in original:
    if any(s in o.name.lower() for s in ('door emblems lettering','shenzhen and operator roof panels','green vacancy diode matrices')):
        copy=o.copy();copy.data=o.data;copy.name='Fleet shared '+o.name
        bpy.context.collection.objects.link(copy);out.append(copy)
for name,loc in zip(['wheel_RF','wheel_LR','wheel_RR'],offsets[1:]):
    o=lf.copy();o.data=lf.data;o.name=name;o.location=loc;bpy.context.collection.objects.link(o)
    if loc[0]>0:o.rotation_euler.z=pi
    out.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in out:o.select_set(True)
bpy.context.view_layer.objects.active=near
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_extras=True,
    export_normals=True,export_texcoords=True,export_animations=False,export_cameras=False,export_lights=False)
print("FLEET",OUT,OUT.stat().st_size,"bytes; body/distant polygons",len(near.data.polygons),len(far_obj.data.polygons))
