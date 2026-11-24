import * as T from 'three';
import {Instances,segmentDistance,clamp} from './city-geometry.js';
import {label} from './city-materials.js';
import {mappedCrosswalks} from './crosswalks.js';

const walk=new Set(['footway','steps','path','cycleway','pedestrian']);
function closestRoad(x,z,index,maxDistance){
  let best,near=maxDistance;
  for(const s of index.query(x,z)){
    if(s.foot||walk.has(s.rd.kind)||s.rd.bridge||s.rd.layer!==0||s.rd.kind==='service'||Math.max(s.y,s.endY??s.y)>.55)continue;
    const d=segmentDistance(x,z,s.a,s.b);if(d>=near)continue;
    near=d;best=s;
  }
  if(!best)return null;
  const vx=best.b[0]-best.a[0],vz=best.b[1]-best.a[1],len=Math.hypot(vx,vz);if(len<.01)return null;
  const dx=vx/len,dz=vz/len,t=clamp((x-best.a[0])*dx+(z-best.a[1])*dz,0,len);
  return {rd:best.rd,w:best.width,x:best.a[0]+dx*t,z:best.a[1]+dz*t,dx,dz,rot:Math.atan2(dx,dz)};
}
export function streetStops(root,map,m,grid,stripes,layout){
  const cube=new T.BoxGeometry(1,1,1);
  const roof=new Instances(cube,m.rail,'公交站顶篷'),base=new Instances(cube,m.dark,'候车亭钢架');
  const fascia=new Instances(cube,new T.MeshStandardMaterial({color:0x3c6b65,roughness:.53,metalness:.33}),'公交站绿色檐带');
  const glazing=new Instances(cube,new T.MeshStandardMaterial({color:0x90a8a3,metalness:.23,roughness:.17,transparent:true,opacity:.4,depthWrite:false}),'候车亭玻璃');
  const bench=new Instances(cube,m.wood,'候车长凳');
  const clay=new T.MeshStandardMaterial({color:0xb59b6b,roughness:.91});
  const pads=new Instances(cube,clay,'过街提示盲道砖'),dots=new Instances(new T.CylinderGeometry(.72,1,1,8),clay,'过街提示盲道砖凸点');
  const boards=new Map(),crossed=new Set(),stops=new Set();
  mappedCrosswalks(root,map,m,grid,stripes,pads,dots);
  for(const location of map.pois||[]){
    const [x,z]=location.p,kind=location.kind;
    if(kind!=='crossing'&&kind!=='bus_stop')continue;
    const R=closestRoad(x,z,grid.roads,kind==='bus_stop'?24:15);
    if(!R||R.w<4||Math.hypot(x,z)>3050)continue;
    const {dx,dz,rot}=R,nx=-dz,nz=dx;
    if(kind==='crossing'){
      if(layout.hasCrossing(x,z))continue;
      const key=Math.round(R.x/5)+','+Math.round(R.z/5);if(crossed.has(key))continue;crossed.add(key);
      if(Math.hypot(x,z)<1000)for(const k of [-1,1]){
        const side=k*(R.w/2+.65),px=R.x+nx*side,pz=R.z+nz*side;
        if(grid.roads.query(px,pz).some(s=>s.rd!==R.rd&&!walk.has(s.rd.kind)&&!s.rd.layer&&segmentDistance(px,pz,s.a,s.b)<s.width/2))continue;
        pads.at(px,.207,pz,.49,.014,.98,rot);
        for(let u=-2;u<=2;u++)for(let v=-5;v<=5;v++)
          dots.at(px+nx*u*.09+dx*v*.084,.222,pz+nz*u*.09+dz*v*.084,.015,.016,.015);
      }
      for(let side=-R.w/2+.68;side<R.w/2-.26;side+=.94)stripes.at(R.x+nx*side,.343,R.z+nz*side,.46,1,3.2,rot);
      continue;
    }
    const side=(x-R.x)*nx+(z-R.z)*nz>=0?1:-1;
    const edge=R.w*.5+(kind==='bus_stop'?2.15:.78);
    const sx=R.x+nx*edge*side,sz=R.z+nz*edge*side;
    const key=Math.round(sx/9)+','+Math.round(sz/9);if(stops.has(key))continue;stops.add(key);
    const yaw=rot+Math.PI/2,backX=sx+nx*side*.66,backZ=sz+nz*side*.66;
    roof.at(sx,2.96,sz,2.54,.14,6.65,rot);fascia.at(sx-nx*side*1.17,2.86,sz-nz*side*1.17,.13,.21,6.65,rot);
    for(const t of [-2.75,0,2.75])base.at(backX+dx*t,1.6,backZ+dz*t,.105,2.68,.105,rot);
    // Split the glass back into bays and mount the local stop name on its own lightbox.
    for(const t of [-2.67,2.66]){
      base.at(backX+dx*t,1.89,backZ+dz*t,.15,1.10,.74,rot);
      fascia.at(backX+dx*t-nx*side*.09,2.31,backZ+dz*t-nz*side*.09,.03,.18,.65,rot);
    }
    for(const t of [-1.65,-.54,.54,1.65]){
      base.at(sx+dx*t,.92,sz+dz*t,.43,.045,.047,rot);
      base.at(sx+dx*t+nx*side*.16,.83,sz+dz*t+nz*side*.16,.045,.17,.047,rot);
    }
    glazing.at(backX,1.62,backZ,.048,1.94,5.5,rot);bench.at(sx,.74,sz,.43,.1,4.25,rot);
    for(const t of [-1.55,1.55])base.at(sx+dx*t,.48,sz+dz*t,.33,.48,.09,rot);
    if(location.name&&(Math.hypot(sx,sz)<1500||location.name==='腾讯滨海大厦')){
      const name=location.name.replace(/\s*[（(].*/,'');let board=boards.get(name);
      if(!board){board=new Instances(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({map:label(name,'SHENZHEN BUS',800,'#326060'),roughness:.6,side:T.DoubleSide}),'站名 · '+name);boards.set(name,board);}
      board.at(sx-nx*side*1.25,2.85,sz-nz*side*1.25,2.15,.43,1,Math.atan2(-nx*side,-nz*side));
    }
  }
  pads.flush(root,false,90);dots.flush(root,false,55);
  for(const item of [roof,base,fascia,glazing,bench,...boards.values()])item.flush(root,false,520);
}
