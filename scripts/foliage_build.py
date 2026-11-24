"""Bake Poly Haven's CC0 Island Trees into volumetric crown clusters.

Dependencies: numpy, scipy, numba, Pillow, requests, pymeshlab.
The runtime meshes and WebP layers are written into public/foliage.
"""
from pathlib import Path
from tempfile import gettempdir, TemporaryDirectory
from concurrent.futures import ThreadPoolExecutor
import json
import math
import struct

import numpy as np
from numba import njit
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from scipy.ndimage import distance_transform_edt, gaussian_filter
import requests

SOURCE=Path(gettempdir())/"shenzhen-foliage-models"
DEST=Path(__file__).resolve().parents[1]/"public"/"foliage"
SIDE=72
AXES=np.array([[[1,0,0],[0,1,0],[0,0,1]],[[0,0,-1],[0,1,0],[1,0,0]],[[1,0,0],[0,0,-1],[0,1,0]]],np.float32)


def download(model):
    SOURCE.mkdir(exist_ok=True)
    if all((SOURCE/f"{model}{s}").exists() for s in [".bin",".gltf","_alpha.png","_diff_1k.jpg","_nor_gl_1k.jpg","_leaves_diff_1k.jpg","_branches_diff_1k.jpg"]):return
    files=requests.get("https://api.polyhaven.com/files/"+model,timeout=30).json()
    gf=files["gltf"]["1k"]["gltf"]
    pairs=[(gf["url"],model+".gltf"),(files["leaves_alpha"]["1k"]["png"]["url"],model+"_alpha.png")]
    pairs.extend((v["url"],Path(k).name) for k,v in gf["include"].items() if k.endswith(".bin") or "_diff_" in k or "_nor_gl_" in k)
    def take(pair):
        url,name=pair;dest=SOURCE/name
        if not dest.exists():
            r=requests.get(url,timeout=(15,160));r.raise_for_status();dest.write_bytes(r.content)
    with ThreadPoolExecutor(4) as pool:list(pool.map(take,pairs))


@njit(cache=True)
def stamp(indices,pos,uv,light,groups,lower,span,rgba,depth,image,mask,slots,channels,axes):
    step=rgba.shape[0]//slots
    for face,ids in enumerate(indices):
        cell=groups[face]
        for axis in range(3):
            col=(cell*3+axis)%slots
            row=(cell*3+axis)//slots
            xx=np.empty(3,np.float32);yy=xx.copy();zz=xx.copy()
            for n in range(3):
                p=pos[ids[n]]
                xx[n]=2+(np.dot(axes[axis,0],p)-lower[cell,axis,0])/span[cell,axis,0]*(step-5)
                yy[n]=step-3-(np.dot(axes[axis,1],p)-lower[cell,axis,1])/span[cell,axis,1]*(step-5)
                zz[n]=np.dot(axes[axis,2],p)
            x0=max(1,int(math.floor(min(xx))));x1=min(step-2,int(math.ceil(max(xx))))
            y0=max(1,int(math.floor(min(yy))));y1=min(step-2,int(math.ceil(max(yy))))
            den=(yy[1]-yy[2])*(xx[0]-xx[2])+(xx[2]-xx[1])*(yy[0]-yy[2])
            if abs(den)<.05:continue
            for y in range(y0,y1+1):
                for x in range(x0,x1+1):
                    a=((yy[1]-yy[2])*(x+.5-xx[2])+(xx[2]-xx[1])*(y+.5-yy[2]))/den
                    b=((yy[2]-yy[0])*(x+.5-xx[2])+(xx[0]-xx[2])*(y+.5-yy[2]))/den
                    c=1-a-b
                    if min(a,b,c)<0:continue
                    d=a*zz[0]+b*zz[1]+c*zz[2]
                    px=col*step+x;py=row*step+y
                    if d<=depth[py,px]:continue
                    u=(a*uv[ids[0],0]+b*uv[ids[1],0]+c*uv[ids[2],0])%1
                    v=(a*uv[ids[0],1]+b*uv[ids[1],1]+c*uv[ids[2],1])%1
                    tx=int(u*image.shape[1]);ty=int(v*image.shape[0])
                    if channels==4 and mask[ty,tx]<105:continue
                    L=a*light[ids[0]]+b*light[ids[1]]+c*light[ids[2]]
                    for k in range(3):rgba[py,px,k]=min(255,image[ty,tx,k]*L)
                    rgba[py,px,3]=255;depth[py,px]=d


class MeshFile:
    """Compact positions/normal/UV/indices for one shared species template."""
    def __init__(self):self.arrays=[]
    def write(self,file,parts):
        for pos,norm,uv,indices in parts:
            indices=np.asarray(indices,"<u4")
            n=len(pos)
            self.arrays.append(struct.pack("<II",n,len(indices.ravel())))
            self.arrays+= [np.asarray(pos,"<f4").tobytes(),np.asarray(norm,"<f4").tobytes(),
                           np.asarray(uv,"<f4").tobytes(),np.asarray(indices,"<u4").tobytes()]
        file.write_bytes(b"BT01"+b"".join(self.arrays))


def source_parts(model):
    download(model);DEST.mkdir(parents=True,exist_ok=True)
    gltf=json.loads((SOURCE/(model+".gltf")).read_text());buffer=(SOURCE/(model+".bin")).read_bytes()
    def get(i):
        a=gltf["accessors"][i];v=gltf["bufferViews"][a["bufferView"]]
        dtype={5126:"<f4",5125:"<u4",5123:"<u2"}[a["componentType"]]
        dims={"VEC2":2,"VEC3":3,"SCALAR":1}[a["type"]]
        return np.frombuffer(buffer,dtype,count=a["count"]*dims,offset=v.get("byteOffset",0)+a.get("byteOffset",0)).reshape(-1,dims)
    parts={}
    for p in gltf["meshes"][0]["primitives"]:
        mat=gltf["materials"][p["material"]]["name"]
        key="leaves" if mat.endswith("_leaves") else "twigs" if mat.endswith("_branches") else "wood"
        attrs=p["attributes"]
        parts[key]=(get(attrs["POSITION"]),get(attrs["NORMAL"]),get(attrs["TEXCOORD_0"]),get(p["indices"]).reshape(-1,3))
    return parts


def bark_lods(wood,bottom,height):
    """Decimate each branch together with its per-corner texture coordinates."""
    import pymeshlab
    pos,_,uv,faces=wood
    points,position_index=np.unique(pos,axis=0,return_inverse=True)
    # OBJ carries independent position and UV indices. MeshLab can join the
    # geometry at a fork while keeping both sides of a bark atlas seam.
    with TemporaryDirectory() as folder:
        path=Path(folder)/"trunk.obj"
        with path.open("w") as obj:
            np.savetxt(obj,points,fmt="v %.9g %.9g %.9g")
            np.savetxt(obj,uv,fmt="vt %.9g %.9g")
            corners=np.stack((position_index[faces]+1,faces.astype(np.int32)+1),axis=2)
            np.savetxt(obj,corners.reshape(-1,6),fmt="f %d/%d %d/%d %d/%d")
        meshes=pymeshlab.MeshSet()
        meshes.load_new_mesh(str(path))
    levels=[]
    for budget in [3800,420]:
        meshes.meshing_decimation_quadric_edge_collapse_with_texture(targetfacenum=budget,preservenormal=True)
        mesh=meshes.current_mesh()
        corners=np.column_stack((mesh.face_matrix().ravel(),mesh.wedge_tex_coord_matrix()))
        vertices,indices=np.unique(corners,axis=0,return_inverse=True)
        original=vertices[:,0].astype(np.intp)
        position=mesh.vertex_matrix()[original]
        position[:,1]-=bottom
        levels.append((position/height,mesh.vertex_normal_matrix()[original],vertices[:,1:],indices))
    return levels


def bake(model):
    parts=source_parts(model)
    pts=parts["leaves"][0];overall=pts.max(axis=0)-pts.min(axis=0)
    bottom=float(parts["wood"][0][:,1].min());height=float(pts[:,1].max()-bottom)
    cellw=height*.135
    boundsMin=np.minimum(pts.min(axis=0),parts["twigs"][0].min(axis=0))-.01
    groups={};length=0
    for name in ["leaves","twigs"]:
        vertices,_,_,tri=parts[name];centers=vertices[tri].mean(axis=1)
        keys=np.floor((centers-boundsMin)/cellw).astype(np.int32)
        groups[name]=keys[:,0]+keys[:,1]*64+keys[:,2]*4096
    unique=np.unique(np.r_[groups["leaves"],groups["twigs"]]);n=len(unique)
    low=np.full((n,3),1e9,np.float32);high=-low.copy()
    for name in groups:
        pos,_,_,tri=parts[name];gi=np.searchsorted(unique,groups[name]);groups[name]=gi
        for j in range(3):
            np.minimum.at(low,gi,pos[tri[:,j]])
            np.maximum.at(high,gi,pos[tri[:,j]])
    c=(high+low)*.5;w=high-low+.012
    lower=np.zeros((n,3,2),np.float32);span=lower.copy()
    for ax,(right,up,normal) in enumerate(AXES):
        for j,d in enumerate([right,up]):
            span[:,ax,j]=w@abs(d)
            lower[:,ax,j]=c@d-span[:,ax,j]*.5
    slots=math.ceil(math.sqrt(n*3));size=slots*SIDE
    atlas=np.zeros((size,size,4),np.uint8);depth=np.full((size,size),-1e9,np.float32)
    print("Baking",model,n,"volume clusters",size,"px",flush=True)
    crown=(pts.min(axis=0)+pts.max(axis=0))*.5
    for name in ["twigs","leaves"]:
        pos,norm,uv,tri=parts[name]
        outer=np.clip(np.linalg.norm((pos-crown)/(overall*.53),axis=1),0,1.1)
        light=(.71+.25*outer+.07*np.clip(norm[:,1],-1,1)).astype("float32")
        srcname="leaves" if name=="leaves" else "branches"
        image=np.asarray(Image.open(SOURCE/f"{model}_{srcname}_diff_1k.jpg").convert("RGB"))
        if name=="twigs":
            uv=(uv*np.array([15,3.4],np.float32)+np.array([0,-2.4],np.float32)).astype("float32")
        mask=(np.asarray(Image.open(SOURCE/(model+"_alpha.png")))/257).astype("uint8") if name=="leaves" else np.ones((1,1),np.uint8)
        stamp(tri,np.ascontiguousarray(pos),uv,light,groups[name],lower,span,atlas,depth,image,mask,slots,4 if name=="leaves" else 3,AXES)
    # Give alpha-test mip levels the colour of nearby leaves rather than black.
    missing=atlas[:,:,3]==0
    di,ix=distance_transform_edt(missing,return_indices=True)
    area=missing&(di<3.5);atlas[area,:3]=atlas[ix[0][area],ix[1][area],:3]
    Image.fromarray(atlas).save(DEST/(model+"-canopy.webp"),quality=92,exact=True,method=5)
    pos=[];norm=[];uv=[];idx=[]
    for i,center in enumerate(c):
        for ax,(right,up,normal) in enumerate(AXES):
            col=(i*3+ax)%slots;row=(i*3+ax)//slots
            if not atlas[row*SIDE:(row+1)*SIDE,col*SIDE:(col+1)*SIDE,3].any():continue
            sx,sy=span[i,ax]*(SIDE-1)/(SIDE-5)
            k=len(pos)
            for ux,vy in [(0,1),(1,1),(1,0),(0,0)]:
                pos.append(center+(ux-.5)*sx*right+(.5-vy)*sy*up)
                normalSmooth=center-crown
                normalSmooth[1]=normalSmooth[1]*.34+height*.18
                norm.append(normalSmooth/(np.linalg.norm(normalSmooth)+1e-5))
                uv.append([(col*SIDE+.5+ux*(SIDE-1))/size,(row*SIDE+.5+vy*(SIDE-1))/size])
            idx+= [k,k+1,k+2,k,k+2,k+3]
    cp=np.array(pos,np.float32);cp[:,1]-=bottom;cp/=height
    near,far=bark_lods(parts["wood"],bottom,height)
    MeshFile().write(DEST/(model+".bin"),[near,(cp,norm,uv,idx),far])
    for word,kind in [("diff","bark"),("nor_gl","normal")]:
        img=Image.open(SOURCE/f"{model}_{word}_1k.jpg").convert("RGB");img.thumbnail((768,768))
        img.save(DEST/f"{model}-{kind}.webp",quality=89,method=5)
    print("Ready",model,len(near[3])//3,len(idx)//3,"runtime triangles",flush=True)


def twig_tubes(parts,bottom,height):
    """Trace each disconnected scanned twig and keep its two attachment points."""
    original,_,_,faces=parts["twigs"]
    pts,rev=np.unique(original.round(5),axis=0,return_inverse=True)
    ids=rev[faces]
    edges,count=np.unique(np.sort(np.c_[ids.ravel(),ids[:,[1,2,0]].ravel()],axis=1),axis=0,return_counts=True)
    graph=coo_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(len(pts),len(pts))).tocsr()
    _,label=connected_components(graph,directed=False)
    # These scans have one open collar per twig and a capped tip. Distances in
    # the triangle graph recover the actual cross-sections even on curved twigs.
    collars=np.unique(edges[count==1])
    depth=dijkstra(graph,directed=False,indices=collars,min_only=True,unweighted=True)
    assert np.isfinite(depth).all()
    step=int(depth.max())+1
    rings,which,counts=np.unique(label*step+depth.astype(int),return_inverse=True,return_counts=True)
    centers=np.zeros((len(rings),3));np.add.at(centers,which,pts);centers/=counts[:,None]
    radii=np.bincount(which,np.linalg.norm(pts-centers[which],axis=1))/counts
    pos=[];norm=[];uv=[];segments=[]
    for group in np.split(np.arange(len(rings)),np.flatnonzero(np.diff(rings//step))+1):
        keep=[0,len(group)-1]
        pending=[(0,len(group)-1)]
        tolerance=max(.0018,np.linalg.norm(centers[group[-1]]-centers[group[0]])*.042)
        while pending:
            a,b=pending.pop()
            if b-a<2:continue
            chord=centers[group[b]]-centers[group[a]]
            span=centers[group[a+1:b]]-centers[group[a]]
            t=np.clip((span@chord)/max(chord@chord,1e-12),0,1)
            error=np.linalg.norm(span-t[:,None]*chord,axis=1)
            peak=error.argmax()
            if error[peak]>tolerance:
                split=a+1+peak;keep.append(split);pending.extend(((a,split),(split,b)))
        keep=group[sorted(keep)]
        line=centers[keep];delta=np.gradient(line,axis=0)
        direction=delta/np.maximum(1e-10,np.linalg.norm(delta,axis=1,keepdims=True))
        ref=np.eye(3)[np.argmin(np.max(np.abs(direction),axis=0))]
        side=np.cross(direction,ref);side/=np.maximum(1e-8,np.linalg.norm(side,axis=1,keepdims=True))
        other=np.cross(direction,side)
        sides=4 if radii[keep[0]]>.018 else 3
        angle=np.linspace(0,2*np.pi,sides+1)
        for r,k in enumerate(keep):
            radial=np.cos(angle)[:,None]*side[r]+np.sin(angle)[:,None]*other[r]
            pos.extend(line[r]+radial*radii[k]);norm.extend(radial)
            uv.extend(zip(angle/(2*np.pi),np.full(sides+1,r/(len(keep)-1))))
        segments.append((len(keep),sides))
    points=np.array(pos);points[:,1]-=bottom
    return points/height,np.asarray(norm),np.asarray(uv),np.asarray(segments,"uint8")


def bake_close(model):
    """Fit a bent, UV-matched strip to individual scanned blades for the closest trees."""
    parts=source_parts(model)
    pts,_,uv,tri=parts["leaves"]
    # Both original meshes have 21 vertices and 24 ordered faces per physical blade.
    blades=pts.reshape(-1,21,3)
    assert np.all(tri.reshape(-1,72)//21==np.arange(len(blades))[:,None])
    bottom=parts["wood"][0][:,1].min()
    height=pts[:,1].max()-bottom
    center=(pts.max(axis=0)+pts.min(axis=0))*.5
    rng=np.random.default_rng(782)
    selected=np.flatnonzero(rng.random(len(blades))<.55)
    pos=[];norm=[];tex=[]
    for batch in np.array_split(selected,16):
        local=blades[batch]
        leaf_uv=uv.reshape(-1,21,2)[batch]
        low=leaf_uv.min(axis=1,keepdims=True);span=leaf_uv.max(axis=1,keepdims=True)-low
        sample=(leaf_uv-low)/span-.5
        def basis(s):
            u,v=s[:,:,0],s[:,:,1]
            return np.stack((np.ones_like(u),u,v,v*v),axis=-1)
        corners=np.broadcast_to(np.array([[u,v] for v in [-.5,0,.5] for u in [-.5,.5]],np.float32),(len(batch),6,2))
        fitted=basis(corners)@(np.linalg.pinv(basis(sample))@local)
        # Preserve blade centres and the arch along each midrib.
        mean=fitted.mean(axis=1,keepdims=True)
        fitted=mean+(fitted-mean)*1.33
        face=np.cross(fitted[:,1]-fitted[:,0],fitted[:,4]-fitted[:,0])
        face/=np.maximum(1e-8,np.linalg.norm(face,axis=1,keepdims=True))
        outward=mean[:,0]-center;outward[:,1]=outward[:,1]*.55+height*.18
        outward/=np.maximum(1e-8,np.linalg.norm(outward,axis=1,keepdims=True))
        face*=np.where((face*outward).sum(axis=1,keepdims=True)<0,-1,1)
        n=face*.55+outward*.70;n/=np.maximum(1e-8,np.linalg.norm(n,axis=1,keepdims=True))
        norm.append(np.repeat(n,6,axis=0));tex.append(((corners+.5)*span+low).reshape(-1,2))
        fitted[:,:,1]-=bottom;pos.append(fitted.reshape(-1,3)/height)
    tp,tn,tu,segments=twig_tubes(parts,bottom,height)
    path=DEST/(model+"-close.bin")
    with path.open("wb") as f:
        f.write(struct.pack("<4sIII",b"BC02",len(tp),len(segments),len(selected)))
        for data in [np.round(np.clip(tp,-1,1)*32767).astype("<i2"),np.round(tn*127).astype("i1"),
                     np.round(tu*65535).astype("<u2"),segments]:
            f.write(data.tobytes());f.write(bytes((-f.tell())%4))
        # Normalized vertex attributes; shared strip indices are generated on load.
        f.write(np.round(np.clip(np.concatenate(pos),-1,1)*32767).astype("<i2").tobytes())
        f.write(np.round(np.concatenate(norm)*127).astype("i1").tobytes())
        f.write(np.round(np.clip(np.concatenate(tex),0,1)*65535).astype("<u2").tobytes())
    if model=="island_tree_01":
        # The two models use identical leaf and twig textures.
        alpha=(np.asarray(Image.open(SOURCE/(model+"_alpha.png")))/257).astype("uint8")
        leaf=np.asarray(Image.open(SOURCE/(model+"_leaves_diff_1k.jpg")).convert("RGB")).copy()
        _,nearest=distance_transform_edt(alpha<32,return_indices=True)
        leaf[alpha<32]=leaf[nearest[0][alpha<32],nearest[1][alpha<32]]
        Image.fromarray(np.dstack((leaf,alpha))).save(DEST/"leaf-blades.webp",quality=93,exact=True,method=5)
        for src,dest,size in [("leaves_nor_gl","leaf-veins",768),("branches_diff","twig-bark",512)]:
            im=Image.open(SOURCE/f"{model}_{src}_1k.jpg").convert("RGB");im.thumbnail((size,size))
            im.save(DEST/f"{dest}.webp",quality=90,method=5)
        # Irregular exposed soil between grass and leaves, using the same photographed ground as the park.
        ground=np.asarray(Image.open(DEST.parent/"city"/"grass.webp").convert("RGB").resize((512,512))).astype("float32")
        luma=ground@np.array([.28,.57,.15])
        soil=np.clip((luma[:,:,None]*.72+13)*np.array([1.08,.84,.59]),0,255).astype("uint8")
        y,x=np.mgrid[-1:1:512j,-1:1:512j]
        grain=rng.normal(0,1,luma.shape)
        mottling=np.zeros_like(luma)
        for sigma,weight in [(30,.19),(8,.11),(2,.08),(.5,.07)]:
            noise=gaussian_filter(grain,sigma);mottling+=weight*noise/max(.0001,noise.std())
        opacity=np.clip((.68-np.hypot(x,y)+mottling)*4,0,1)*np.clip((1-np.hypot(x,y))*10,0,1)
        Image.fromarray(np.dstack((soil,(255*opacity).astype("uint8")))).save(DEST/"root-soil.webp",quality=89,method=5)
    print(model,len(selected),"individual blades,",len(segments),"connected twigs,",path.stat().st_size,"bytes",flush=True)


if __name__=="__main__":
    import sys
    for model in ["island_tree_01","island_tree_02"]:
        if "--close-only" not in sys.argv:bake(model)
        bake_close(model)
