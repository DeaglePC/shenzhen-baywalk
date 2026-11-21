"""Bake Poly Haven's CC0 Island Trees into volumetric crown clusters.

Dependencies: numpy, scipy, numba, Pillow, requests, fast-simplification.
The runtime meshes and WebP layers are written into public/foliage.
"""
from pathlib import Path
from tempfile import gettempdir
from concurrent.futures import ThreadPoolExecutor
import json
import math
import struct

import fast_simplification
import numpy as np
from numba import njit
from PIL import Image
from scipy.spatial import cKDTree
from scipy.ndimage import distance_transform_edt
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


def bake(model):
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
    trunk,nrm,tuv,tri=parts["wood"]
    tp,ti=fast_simplification.simplify(trunk.copy().astype("float64"),tri.copy().astype("int32"),target_count=min(3800,len(tri)-1))
    _,nearest=cKDTree(trunk).query(tp);tp[:,1]-=bottom;tp=tp/height
    mp,mi=fast_simplification.simplify(trunk.copy().astype("float64"),tri.copy().astype("int32"),target_count=min(420,len(tri)-1))
    _,mnear=cKDTree(trunk).query(mp);mp[:,1]-=bottom;mp/=height
    MeshFile().write(DEST/(model+".bin"),[(tp,nrm[nearest],tuv[nearest],ti),(cp,norm,uv,idx),(mp,nrm[mnear],tuv[mnear],mi)])
    for word,kind in [("diff","bark"),("nor_gl","normal")]:
        img=Image.open(SOURCE/f"{model}_{word}_1k.jpg").convert("RGB");img.thumbnail((768,768))
        img.save(DEST/f"{model}-{kind}.webp",quality=89,method=5)
    print("Ready",model,len(ti),len(idx)//3,"runtime triangles",flush=True)


if __name__=="__main__":
    for model in ["island_tree_01","island_tree_02"]:bake(model)
