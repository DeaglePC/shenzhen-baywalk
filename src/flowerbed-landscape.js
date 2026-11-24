import * as T from 'three';
import {Instances,Surface,along,area,bounds,inArea,inRing,random,segmentDistance} from './city-geometry.js';
import {photo} from './city-materials.js';
import {flowerbedPromenade} from './flowerbed-promenade.js';
import {shorePlanting} from './flowerbed-shore-trees.js';

function outlineDistance(x,z,ring){
  let d=Infinity;
  for(let i=0;i<ring.length;i++)d=Math.min(d,segmentDistance(x,z,ring[i],ring[(i+1)%ring.length]));
  return d;
}

// Subdivide the mapped footprint so the low bank rolls across its width
// without bridging concave inlets or covering the water between islands.
function relief(surface,ring,height,tile){
  const outline=ring.map(([x,z])=>new T.Vector2(x,z));
  function face(a,b,c){
    const ab=a.distanceToSquared(b),bc=b.distanceToSquared(c),ca=c.distanceToSquared(a);
    if(Math.max(ab,bc,ca)>5){
      if(bc>ab&&bc>=ca)[a,b,c]=[b,c,a];else if(ca>ab)[a,b,c]=[c,a,b];
      const mid=a.clone().lerp(b,.5);face(a,mid,c);face(mid,b,c);return;
    }
    const verts=[c,b,a].map(({x,y:z})=>surface.vertex([x,height(x,z),z],[x/tile,z/tile]));
    surface.indices.push(...verts);
  }
  for(const [a,b,c] of T.ShapeUtils.triangulateShape(outline,[]))face(outline[a],outline[b],outline[c]);
}

// Rounded, clipped planting ribbons. The crown sits over vertical foliage
// on both sides, so the scroll remains legible when seen from the path.
function hedge(surface,controls,radius,height,base,tint){
  const arc=new T.CatmullRomCurve3(controls.map(([x,z])=>new T.Vector3(x,0,z)));
  const length=arc.getLength(),sections=Math.max(8,Math.ceil(length/.32));
  let prev;
  for(let i=0;i<=sections;i++){
    const u=i/sections,c=arc.getPointAt(u),d=arc.getTangentAt(u);
    const end=Math.min(1,Math.sqrt(Math.min(u,1-u)*length/radius+.002));
    const h=height*(.9+.1*Math.sin(u*3.1)),y=base(c.x,c.z);
    const ring=[[-1,0],[-1,.39],[-.85,.77],[-.51,.95],[0,1],[.51,.95],[.85,.77],[1,.39],[1,0]].map(([side,rise])=>{
      const w=radius*side*end;
      return [c.x-d.z*w,y+h*rise*end,c.z+d.x*w];
    });
    if(prev)for(let k=1;k<ring.length;k++){
      const q=[prev[k-1],ring[k-1],ring[k],prev[k]];
      surface.quad(...q,q.map(([x,y,z])=>[x/1.4,(z+.69*y)/1.4]),tint);
    }
    prev=ring;
  }
}

export function flowerbedLandscape(root,map,m){
  const road=map.roads.find(r=>r.id===537564125),lake=map.water.find(f=>f.id===-10175109);
  const land=id=>map.land.find(f=>f.id===id);
  const meadow=land(775214627);
  if(!road||!lake||!meadow)return;
  const shoals=map.land.filter(f=>[735037203,735037204,735037205].includes(f.id));
  for(const f of [meadow,...shoals])f.bbox=bounds(f.p);
  const shore=lake.p.filter(([x,z])=>x>78&&x<192&&z<-105&&z>-293);
  const rng=random(2251366),lawn=new Surface(),gravel=new Surface(),leaf=new Surface(),burgundy=new Surface();
  const path=flowerbedPromenade(root,road,m),ornaments=[];
  const lawnMap=photo('flowerbed-lawn.webp'),shingleMap=photo('flowerbed-shingle.webp'),
    leafMap=photo('flowerbed-hedge.webp'),redMap=photo('flowerbed-burgundy.webp'),shootMap=photo('flowerbed-shoot.webp');
  function meadowHeight(x,z){
    const edge=outlineDistance(x,z,meadow.p);
    let water=Infinity;
    for(let i=1;i<shore.length;i++)water=Math.min(water,segmentDistance(x,z,shore[i-1],shore[i]));
    return .094+Math.min(1.13,water*.095)*T.MathUtils.smoothstep(edge,0,5.6);
  }
  const shingleHeight=(f,x,z)=>.205+Math.min(.38,outlineDistance(x,z,f.p)*.135);
  relief(lawn,meadow.p,meadowHeight,2.8);
  const lawnMesh=lawn.mesh(root,new T.MeshStandardMaterial({map:lawnMap,roughness:1,side:T.DoubleSide}),'花坛 · 临湖园林草地');

  const rocks=new Instances(new T.IcosahedronGeometry(1,1),
    new T.MeshStandardMaterial({roughness:.98}),'花坛 · 碎石滩临水石岸');
  const pale=new T.Color('#c0a896'),damp=new T.Color('#736860');
  function stone(x,y,z,scale){
    rocks.at(x,y,z,scale*(1+rng()*.5),scale*(.32+rng()*.4),scale*(.7+rng()*.5),rng()*6.28,
      damp.clone().lerp(pale,rng()));
  }
  const marker=new Instances(new T.CylinderGeometry(1,1,1,8),m.dark,'碎石滩 · 水鸟保护提示牌杆');
  const discs=new Instances(new T.CylinderGeometry(1,1,1,20).rotateX(Math.PI/2),
    new T.MeshStandardMaterial({color:0x716c52,roughness:.8}),'碎石滩 · 圆形提示牌');
  for(const f of shoals){
    relief(gravel,f.p,(x,z)=>shingleHeight(f,x,z),1.6);
    const closed=[...f.p,f.p[0]],direction=Math.sign(area(f.p));
    along(closed,.27,.12,(x,z,dx,dz)=>{
      const off=(rng()-.5)*1.15,nx=-dz*direction,nz=dx*direction;
      stone(x+nx*off,.18+Math.max(0,off)*.11,z+nz*off,.12+rng()*.25);
    });
    const [x0,z0,x1,z1]=f.bbox;
    for(let i=0;i<(x1-x0)*(z1-z0)*.85;i++){
      const x=x0+rng()*(x1-x0),z=z0+rng()*(z1-z0);
      if(inRing(x,z,f.p))stone(x,shingleHeight(f,x,z)-.025,z,.046+rng()*.092);
    }
    const [x,z]=f.id===735037204?[111,-207]:f.id===735037203?[96,-225]:[172,-136];
    const y=shingleHeight(f,x,z);marker.at(x,y+.66,z,.027,1.32,.027);
    discs.at(x,y+1.3,z,.235,.235,.049,.78);
  }
  const rushes=new Instances(new T.ConeGeometry(1,1,3),new T.MeshStandardMaterial({color:0x778251,roughness:.94}),'花坛 · 岸边草丛');
  along(shore,1.35,.2,(x,z,dx,dz,s)=>{
    if(Math.sin(s*.27)+Math.cos(s*.73)<.85)return;
    for(let i=0;i<8;i++){const a=rng()*6.28,r=rng()*.43,h=.09+rng()*.19;
      rushes.at(x+Math.sin(a)*r,.11+h*.5,z+Math.cos(a)*r,.016,h,.013,a);}
  });
  rushes.flush(root,false,90);
  along(shore,.45,.2,(x,z,dx,dz,s)=>{
    const offset=(rng()-.45)*.7;
    if(Math.sin(s*.22)+rng()>.35)stone(x-dz*offset,.14,z+dx*offset,.12+rng()*.24);
  });
  gravel.mesh(root,new T.MeshStandardMaterial({map:shingleMap,color:0xcdbfb5,roughness:.98,side:T.DoubleSide}),'花坛 · 浅褐色卵石滩');
  rocks.flush(root,false,170);marker.flush(root);discs.flush(root);

  // Breaks in the bank-side shrubs reveal the narrow channel behind the shoals.
  const shoreRuns=[[[122,-224],[127,-220],[133,-216],[139,-212]],
    [[146,-208],[151,-204],[156,-199],[161,-194]],
    [[164,-190],[167,-186],[170,-181]],[[174,-174],[176,-168],[178,-161]]];
  shorePlanting(root,meadowHeight,leafMap,shootMap,shoreRuns);
  const local=(s,inland)=>[181.2+.68*s+.733*inland,-229.7+.733*s-.68*inland];
  const lobe=(surface,points,r,h,color)=>{
    const line=points.map(([s,n])=>local(s,n));
    hedge(surface,line,r,h,()=>.093,new T.Color(color));ornaments.push({line,r});
  };
  lobe(burgundy,[[-13,2.4],[-11,4.3],[-8.1,5.3],[-4.2,4.9],[-1,3.2]],1.28,2.36,0xaa9282);
  lobe(leaf,[[-12.3,.7],[-9.8,1.3],[-7.1,2.8],[-5.6,3.0],[-6.2,1.8],[-8.1,1.25]],.69,1.33,0xb0c46b);
  lobe(leaf,[[-8.6,-.5],[-6.4,.1],[-3.4,1.6],[-1.9,1.5],[-2.2,.45]],.64,1.12,0x9eae58);
  lobe(leaf,[[-13.4,-1.05],[-9.9,-1.4],[-5.7,-1.15],[-2.3,-.7],[-.35,-.5]],.46,.70,0x809154);
  leaf.mesh(root,new T.MeshStandardMaterial({map:leafMap,vertexColors:true,side:T.DoubleSide,roughness:.96}),'花坛 · 修剪绿篱与沿岸灌木',true);
  burgundy.mesh(root,new T.MeshStandardMaterial({map:redMap,vertexColors:true,side:T.DoubleSide,roughness:.97}),'花坛 · 弧形红叶枝叶',true);

  const trees=[[133,-216.3,4.9,1],[176.7,-166.6,5.5,0]];
  const woods=[land(775214605),land(570468696)].filter(Boolean);
  for(const wood of woods){
    const b=bounds(wood.p),x0=Math.max(167,b[0]),x1=Math.min(271,b[2]),z0=Math.max(-269,b[1]),z1=Math.min(-173,b[3]);
    const spacing=wood.id===775214605?4.5:6.7;
    for(let z=z0;z<z1;z+=spacing)for(let x=x0;x<x1;x+=spacing){
      const px=x+rng()*spacing,pz=z+rng()*spacing;
      if(inRing(px,pz,wood.p))trees.push([px,pz,8.4+rng()*7.3,rng()<.64?0:1]);
    }
  }
  const shoalRings=new Set(lake.holes.filter(r=>shoals.some(f=>f.p.some(([x,z])=>x===r[0][0]&&z===r[0][1]))));
  function heightAt(x,z){
    if(inArea(x,z,meadow))return meadowHeight(x,z);
    const f=shoals.find(f=>inArea(x,z,f));return f?shingleHeight(f,x,z):null;
  }
  function blocked(x,z){
    if(x<78||x>220||z< -278||z> -121)return false;
    return path.posts.some(([px,pz])=>Math.hypot(x-px,z-pz)<.29)||
      ornaments.some(({line,r})=>line.slice(1).some((b,i)=>segmentDistance(x,z,line[i],b)<r));
  }
  return {path,trees,shoalRings,shore,lawnMap,lawnMesh,heightAt,blocked,
    dispose(){path.dispose();for(const t of [lawnMap,shingleMap,leafMap,redMap,shootMap])t.dispose();}};
}
