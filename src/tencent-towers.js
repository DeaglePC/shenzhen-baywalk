import * as T from 'three';
import {area,bounds,inRing,Instances,random,segmentDistance,sideWall,Surface} from './city-geometry.js';
import {architecturalMetal,curtainWall} from './city-curtainwall.js';

import {tencentLettering} from './tencent-lettering.js';
import {entryMonument} from './tencent-frontage.js';

const south=694152192,north=694152193,lobby=775462996;
export const tencentLinks=new Set([601101655,775462995,775462997]);
export const tencentIDs=[south,north,lobby,...tencentLinks];
const glassTint=new T.Color(0xd6e1e6);
const specifications=new Map([[south,{length:95,width:30,height:245.78,floors:50}],[north,{length:76,width:30,height:194.75,floors:38}]]);

// Register the published typical plates to their surveyed centres and bearings.
// Link and lobby points use the same transform as the nearest tower face.
export function calibrateTencent(buildings){
  const parts=buildings.filter(f=>tencentIDs.includes(f.id)),frames=[];
  for(const f of parts.filter(f=>specifications.has(f.id))){
    const spec=specifications.get(f.id),p=f.p;
    const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
    const [a,b]=p.map((a,i)=>[a,p[(i+1)%p.length]]).sort((a,b)=>length(...b)-length(...a))[0];
    const l=length(a,b),ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;
    const project=([x,z])=>[x*ux+z*uz,-x*uz+z*ux];
    const [u0,v0,u1,v1]=bounds(p.map(project)),uc=(u0+u1)/2,vc=(v0+v1)/2;
    frames.push({f,p,apply(q){
      let [u,v]=project(q);u=uc+(u-uc)*spec.length/(u1-u0);v=vc+(v-vc)*spec.width/(v1-v0);
      return [u*ux-v*uz,u*uz+v*ux];
    }});
    f.h=spec.height;
  }
  if(frames.length!==2)return;
  const distance=(q,ring)=>Math.min(...ring.map((a,i)=>segmentDistance(...q,a,ring[(i+1)%ring.length])));
  for(const f of parts){
    const own=frames.find(frame=>frame.f===f);
    f.p=f.p.map(q=>(own??(distance(q,frames[0].p)<distance(q,frames[1].p)?frames[0]:frames[1])).apply(q));
  }
}

const linkRing=f=>area(f.p)>0?f.p:f.p.slice().reverse();
const windowSides=id=>id===601101655?[0,8]:id===775462997?[2,10]:[1,9];
function pictureWindows(links){
  return links.flatMap(f=>{
    const ring=linkRing(f);
    return windowSides(f.id).map(i=>{
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
      return {x:a[0],z:a[1],ux:dx/l,uz:dz/l,l,low:f.minH,high:f.h};
    });
  });
}
function facade(f,storeys,skin,edges,roof,crown,windows){
  const p=area(f.p)>0?f.p:f.p.slice().reverse();
  const step=(f.h-3)/storeys;
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const nx=dz/length,nz=-dx/length,span=Math.max(1,Math.round(length/2.85));
    const at=(t,y,out)=>[a[0]+dx*t+nx*out,y,a[1]+dz*t+nz*out];
    // South glass tilts forward over the slab. On the east and west faces the
    // teeth run across the bays in plan and return to the mullion at each seam.
    const facingCourt=f.id===south?nz<-.68:nz>.68;
    const foldedSouth=f.id===south&&nz>.68;
    const openings=windows.filter(w=>nx*w.uz-nz*w.ux>.74);
    for(let k=0;k<storeys;k++){
      const y=.16+k*step,top=y+step;
      for(let j=0;j<span;j++){
        const u=j/span,v=(j+1)/span,band=Math.floor(k/2),variant=(j+band+Math.floor(j/5))%3;
        const middle=at((u+v)/2,(y+top)/2,0);
        if(openings.some(w=>{
          const vx=middle[0]-w.x,vz=middle[2]-w.z,d=vx*w.uz-vz*w.ux,t=vx*w.ux+vz*w.uz;
          return middle[1]>w.low&&middle[1]<w.high&&d<.7&&d>-10&&t>.1&&t<w.l-.1;
        }))continue;
        const out=[.30,.60,.90][variant],reverse=(j+band)%2===1;
        let tl=0,tr=0,bl=0,br=0;
        if(!facingCourt){
          if(foldedSouth){tl=tr=reverse?out:0;bl=br=reverse?0:out;}
          else{tl=bl=reverse?out:0;tr=br=reverse?0:out;}
        }
        const A=at(u,y,bl),B=at(u,top-.10,tl),C=at(v,top-.10,tr),D=at(v,y,br);
        skin.quad(A,B,C,D,[[u*length,y],[u*length,top-.10],[v*length,top-.10],[v*length,y]],glassTint);
        edges.quad(B,at(u,top,0),at(v,top,0),C);
        if(tl||bl)edges.quad(A,B,at(u,top-.10,0),at(u,y,0));
        if(tr||br)edges.quad(D,C,at(v,top-.10,0),at(v,y,0));
        // Narrow bright aluminium returns surround the tilted glazing units.
        if(!facingCourt){
          const lip=Math.min(.12/length,(v-u)*.15);
          edges.quad(A,B,at(u+lip,top-.10,tl),at(u+lip,y,bl));
          if(!foldedSouth&&(j+2*k)%4===0){
            const bevel=Math.min(.37/length,(v-u)*.33);
            edges.quad(at(v-bevel,y,br),at(v-.025/length,top-.10,tr),C,D);
          }
        }
      }
    }
  }
  sideWall(crown,p,f.h-2.85,f.h,1,1);roof.polygon(p,[],f.h,1);
}

function faceSign(place,root,p,i,t,out,y,options){
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const nx=dz/length,nz=-dx/length;
  place(root,{...options,x:a[0]+dx*t+nx*out,y,z:a[1]+dz*t+nz*out,nx,nz});
}

export function tencentTowers(root,map,m){
  const group=new T.Group();group.name='腾讯滨海大厦';root.add(group);
  const skin=new Surface(),edge=new Surface(),roof=new Surface(),atrium=new Surface(),terraces=new Surface(),crown=new Surface();
  const glass=curtainWall('seafront'),linkGlass=curtainWall('atrium');m.walls.push(glass,linkGlass);
  glass.userData.showFacade=[0,1.45,245.78];linkGlass.userData.showFacade=[1,1.00,175.8];
  const bronze=architecturalMetal(0xa57550,.34),silver=architecturalMetal(0xb9c4c8,.38);
  bronze.emissive.setHex(0xe59c56);m.parkLights.finish(bronze,.12);
  const louvres=new Instances(new T.BoxGeometry(),bronze,'三道空中连廊 · 铜色铝百叶');
  const jambs=new Instances(new T.BoxGeometry(),silver,'连廊 · 竖梃与端框');
  const tie=new Instances(new T.CylinderGeometry(1,1,1,6),silver,'连廊端窗 · 张拉杆与玻璃支爪');
  const room=new T.MeshStandardMaterial({color:0xdcc99f,emissive:0xffce80,roughness:.71});
  m.parkLights.finish(room,1.35);
  const interior=new Instances(new T.BoxGeometry(),room,'连廊 · 公共楼层灯槽');
  const bigWindows=new Surface(),alcoves=new Surface(),windowGlass=new T.MeshPhysicalMaterial({color:0x6a94ac,metalness:.41,roughness:.103,
    clearcoat:.93,transparent:true,opacity:.57,side:T.DoubleSide,depthWrite:false});
  windowGlass.userData.cityProbe='district';
  const edging=new Instances(new T.BoxGeometry(),bronze,'屋顶花园 · 种植池');
  const doorFrames=new Instances(new T.BoxGeometry(),architecturalMetal(0x67706e,.42),'门厅 · 门框与拉手');
  const doors=new Instances(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x476167,metalness:.46,roughness:.16}),'门厅 · 入口玻璃门');
  const foliage=new Instances(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0xffffff,roughness:.97}),'屋顶花园 · 灌木');
  const slab=new T.MeshStandardMaterial({color:0x849197,roughness:.68,side:T.DoubleSide});
  const lettering=tencentLettering();
  const white=m.parkLights.finish(new T.MeshStandardMaterial({color:0xf6f8fb,emissive:0xffffff,roughness:.35}),1.65,.37);
  const blue=m.parkLights.finish(new T.MeshStandardMaterial({color:0x3889de,emissive:0x3186ee,roughness:.34}),1.68,.27);
  const returns=architecturalMetal(0x5e6970,.45);
  const towers=map.buildings.filter(f=>f.id===south||f.id===north);
  const windows=pictureWindows(map.buildings.filter(f=>tencentLinks.has(f.id)));
  for(const f of towers){
    facade(f,specifications.get(f.id).floors,skin,edge,roof,crown,windows);
    if(f.id===south){
      const ring=linkRing(f);
      // The broad southern face carries white English letters near its west corner.
      const i=ring.findIndex((a,i)=>a[0]-ring[(i+1)%ring.length][0]>55);
      if(i>=0)faceSign(lettering,group,ring,i,.74,1.08,f.h-11.2,
        {english:true,width:27.5,depth:.42,face:white,side:returns,name:'南塔塔冠 · Tencent 白色立体字'});
    }
  }
  for(const f of map.buildings){
    if(f.id===lobby){
      sideWall(atrium,f.p,0,f.h,1,1,glassTint);
      const ring=linkRing(f);
      for(const i of [0,2]){
        const [x,z]=ring[i],[X,Z]=ring[(i+1)%ring.length],length=Math.hypot(X-x,Z-z),ux=(X-x)/length,uz=(Z-z)/length;
        const yaw=Math.atan2(uz,-ux),nx=uz,nz=-ux;
        const insert=(batch,u,out,y,w,h,depth)=>batch.at((x+X)/2+ux*u+nx*out,y,(z+Z)/2+uz*u+nz*out,w,h,depth,yaw);
        for(let k=-3;k<=3;k++){
          const u=k*1.3;
          insert(doors,u,.17,1.89,1.25,3.28,.05);
          insert(doorFrames,u-.626,.22,1.89,.053,3.32,.095);
          insert(doorFrames,u+(k%2===0?.49:-.49),.29,1.66,.034,.66,.08);
        }
        insert(doorFrames,0,.25,3.56,9.18,.16,.23);
        insert(doorFrames,0,1.1,4.07,11.3,.24,2.32);
        for(const u of [-4.3,0,4.3]){
          insert(interior,u,1.85,3.937,.87,.025,.09);
          m.parkLights.fixture((x+X)/2+ux*u+nx*1.85,3.85,(z+Z)/2+uz*u+nz*1.85,0xffe3bd,52,10);
        }
      }
      continue;
    }
    if(!tencentLinks.has(f.id))continue;
    const p=linkRing(f),low=f.minH,high=f.h;
    terraces.polygon(p,[],high+.02,1);terraces.polygon(p,[],low,1);
    // The upper link wraps the opposite ends of the two plates. Its picture
    // windows and the other two pairs face out across the city.
    const ends=windowSides(f.id);
    if(f.id===601101655)faceSign(lettering,group,p,9,.49,.93,low+8.1,
      {width:23,depth:.32,face:blue,side:returns,name:'裙房西南立面 · Tencent 腾讯 蓝色发光字'});
    for(let i=0;i<p.length;i++){
      const [x,z]=p[i],[bx,bz]=p[(i+1)%p.length],dx=bx-x,dz=bz-z,l=Math.hypot(dx,dz);
      if(l<.2)continue;
      const nx=dz/l,nz=-dx/l,angle=Math.atan2(dx,dz),cx=(x+bx)*.5+nx*.32,cz=(z+bz)*.5+nz*.32;
      const big=ends.includes(i),face=big?bigWindows:atrium,recess=big?-.36:0;
      const at=(t,y)=>[x+dx*t+nx*recess,y,z+dz*t+nz*recess];
      face.quad(at(0,low),at(0,high),at(1,high),at(1,low),[[0,low],[0,high],[l,high],[l,low]],glassTint);
      if(big){
        const inner=(t,y)=>[x+dx*t-nx*7.4,y,z+dz*t-nz*7.4];
        alcoves.quad(inner(0,low),inner(0,high),inner(1,high),inner(1,low));
        for(const t of [0,1])alcoves.quad(at(t,low),at(t,high),inner(t,high),inner(t,low));
        for(const y of [low+.28,high-.28])alcoves.quad(at(0,y),inner(0,y),inner(1,y),at(1,y));
        for(const t of [.18,.50,.82]){
          const [px,,pz]=inner(t,low);
          jambs.at(px+nx,low+(high-low)/2,pz+nz,.32,high-low,.32,angle);
        }
      }
      for(const y of [low+.36,high-.36])louvres.at(cx,y,cz,.92,.72,l+.12,angle);
      const rows=Math.max(2,Math.round((high-low)/4.5));
      for(let k=1;k<rows;k++){
        const y=low+(high-low)*k/rows;
        if(!big)louvres.at(cx,y,cz,.57,.19,l+.07,angle);
        const recessM=big?5.1:.76;
        interior.at(cx-nx*recessM,y-.19,cz-nz*recessM,.36,big?.17:.28,l,angle);
      }
      if(big){
        const wires=Math.ceil(l/2.5);
        for(let k=0;k<wires;k++){
          const t=(k+.5)/wires,px=x+dx*t,pz=z+dz*t;
          tie.between(px+nx*.1,low+.4,pz+nz*.1,px+nx*.1,high-.4,pz+nz*.1,.040);
          for(let j=1;j<rows;j++)tie.between(px+nx*.09,low+j*(high-low)/rows,pz+nz*.09,
            px-nx*.36+dx/l*.46,low+j*(high-low)/rows+.35,pz-nz*.36+dz/l*.46,.048);
        }
      }else{
        const blades=Math.round((high-low)/.43);
        for(let k=1;k<blades;k++){
          const y=low+k*(high-low)/blades;
          louvres.at(cx,y,cz,.56,.115,l+.04,angle);
        }
      }
      const bays=Math.ceil(l/6.3);
      for(let j=0;j<bays;j++)jambs.at(x+dx*j/bays+nx*.18,(high+low)/2,z+dz*j/bays+nz*.18,.40,high-low,.20,angle);
    }
    const [x0,z0,x1,z1]=bounds(p);
    const rand=random(f.id);
    for(let x=x0+3;x<x1-3;x+=8.8)for(let z=z0+2;z<z1-2;z+=5.9){
      if(Math.sin(x*.086+z*.083)<-.35)continue;
      if([[x-3,z-1.3],[x+3,z-1.3],[x+3,z+1.3],[x-3,z+1.3],[x,z]].every(q=>inRing(...q,p)&&!towers.some(t=>inRing(...q,t.p)))){
        edging.at(x,high+.23,z,5.8,.44,2,0);
        for(let j=0;j<6;j++){
          const radius=.52+rand()*.43,shade=new T.Color().setHSL(.23+rand()*.06,.25,.23+rand()*.10);
          foliage.at(x+(j-2.5)*.82,high+.47+radius*.45,z+(rand()-.5)*.58,radius,radius*.83,radius*.75,rand()*6,shade);
        }
      }
    }
  }
  if(towers.length===2)entryMonument(group,m,lettering);
  skin.mesh(group,glass,'南北塔 · 逐层折面玻璃幕墙',true);
  edge.mesh(group,silver,'塔楼 · 折面遮阳边',true);roof.mesh(group,slab,'双塔屋面');
  const screen=architecturalMetal(0x586772,.50);
  screen.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 screenUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nscreenUv=uv;');
    shader.fragmentShader='varying vec2 screenUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 grid=screenUv*vec2(.68,4.4);
      vec2 line=smoothstep(vec2(.31),vec2(.49)+fwidth(grid)*.43,abs(fract(grid)-.5));
      diffuseColor.rgb*=.38+.62*max(line.x,line.y);`);
  };
  crown.mesh(group,screen,'双塔设备层 · 塔冠百叶');
  const lining=new T.MeshStandardMaterial({color:0x907761,emissive:0xffbf76,roughness:.67,side:T.DoubleSide});
  m.parkLights.finish(lining,.36);alcoves.mesh(group,lining,'连廊端窗 · 挑空厅内壁及顶棚');
  atrium.mesh(group,linkGlass,'共享连廊与首层大堂玻璃',true);
  bigWindows.mesh(group,windowGlass,'三道连廊 · 通高端窗');
  terraces.mesh(group,slab,'空中花园平台板');louvres.flush(group,true);jambs.flush(group);
  tie.flush(group);interior.flush(group);edging.flush(group);foliage.flush(group);
  doors.flush(group);doorFrames.flush(group,true);
}
