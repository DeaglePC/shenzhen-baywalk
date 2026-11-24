import * as T from 'three';
import {along,Instances,Surface,ribbon,segmentDistance,bounds,inArea,random} from './city-geometry.js';
import {footRoad} from './road-profiles.js';
import {wenxinDivider} from './street-junctions.js';
import {photo} from './city-materials.js';
import {applyDetailMaps} from './procedural-textures.js';

export function mappedCrosswalks(root,map,m,grid,marks,pads,dots){
  const threshold=new Surface(),yellow=new Surface();
  const pole=new Instances(new T.CylinderGeometry(.72,1,1,9),m.rail,'中央隔离栏立柱');
  const foot=new Instances(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x546b82,roughness:.82}),'中央隔离栏底座');
  const pickets=new Instances(new T.BoxGeometry(),m.cream,'中央隔离栏杆件');
  function carriageway(x,z){
    let best,dist=Infinity;
    for(const s of grid.roads.query(x,z)){
      if(s.foot||footRoad(s.rd)||s.rd.bridge||s.rd.layer>0||Math.max(s.y,s.endY??s.y)>.45)continue;
      const d=segmentDistance(x,z,s.a,s.b);if(d<s.width*.5-.16&&d<dist){best=s;dist=d;}
    }
    return best;
  }
  const tileEnds=new Set();
  for(const crossing of map.roads){
    if(crossing.footway!=='crossing'||crossing.layer||crossing.bridge)continue;
    let marked=false;const w=Math.max(2.6,Math.min(4.5,crossing.width));
    along(crossing.p,.92,.42,(x,z,dx,dz)=>{
      const s=carriageway(x,z);if(!s)return;
      marks.at(x,Math.max(.345,s.y+.04),z,w,1,.46,Math.atan2(dx,dz));
      marked=true;
    });
    if(!marked)continue;
    for(const reverse of [false,true]){
      const path=reverse?crossing.p.slice().reverse():crossing.p,[a,b]=path;
      if(carriageway(...a))continue;
      const key=a.join(',');if(tileEnds.has(key))continue;tileEnds.add(key);
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.3)continue;
      const dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,nx=-dz,nz=dx,rot=Math.atan2(dx,dz);
      const x=a[0]+dx*.30,z=a[1]+dz*.30;
      const coord=(long,wide,height)=>[x+dx*long+nx*wide,height,z+dz*long+nz*wide];
      threshold.quad(coord(-.90,-w/2,.355),coord(-.90,w/2,.355),coord(.83,w/2,.260),coord(.83,-w/2,.260));
      pads.at(x,.312,z,w-.32,.026,.54,rot);
      for(let u=-w/2+.24;u<w/2-.19;u+=.12)for(let v=-.18;v<=.18;v+=.12)
        dots.at(x+nx*u+dx*v,.329,z+nz*u+dz*v,.021,.022,.021);
    }
  }
  // Wenxin Fourth Road below the mall. Leave the pedestrian crossings and
  // motor junction at Haide Second Road open between the modular barriers.
  const divider=wenxinDivider(map);
  if(divider){
    const {road,ux,uz,start,end,at}=divider,yaw=Math.atan2(ux,uz),[x0,z0,x1,z1]=bounds(divider.p);
    const A=at(start),B=at(end);
    grid.atDivider=(x,z,y)=>y<1.6&&x>x0-.2&&x<x1+.2&&z>z0-.2&&z<z1+.2&&segmentDistance(x,z,A,B)<.32;
    for(let s=start;s<end;s+=2.5){
      const [x,z]=at(s),[X,Z]=at(s+2.5);
      pole.at(x,.80,z,.047,1.01,.047);foot.at(x,.39,z,.32,.18,.47,yaw);
      for(const h of [.58,1.20])pickets.at((x+X)/2,h,(z+Z)/2,.044,.052,2.49,yaw);
      for(let t=.18;t<2.45;t+=.205){const [x,z]=at(s+t);pickets.at(x,.875,z,.028,.63,.027,yaw);}
    }
    const [x,z]=at(end);pole.at(x,.80,z,.047,1.01,.047);foot.at(x,.39,z,.32,.18,.47,yaw);
    const granite=applyDetailMaps(new T.MeshStandardMaterial({color:0x8b8981,roughness:.84}),'granite',{normalScale:.36});
    const tubs=new Instances(new T.CylinderGeometry(1,.84,1,20),granite,'文心四路花岗岩花钵');
    const soil=new Instances(new T.CylinderGeometry(1,1,1,20),m.dark,'花钵种植土');
    const hedgeMap=photo('flowerbed-hedge.webp');hedgeMap.repeat.set(2,2);
    const bushMat=applyDetailMaps(new T.MeshStandardMaterial({map:hedgeMap,roughness:.90}),'granite',{normalScale:.48});
    const bushGeo=new T.SphereGeometry(0.52,16,12,0,Math.PI*2,0,Math.PI*.62);
    const leaves=new Instances(bushGeo,bushMat,'桥下花钵实拍灌木丛');
    const rng=random(235113766);
    for(const station of [32,58,87,105])for(const side of [-1,1]){
      const [px,pz]=at(station,side*(road.width/2+2.1));
      if(grid.buildings.query(px,pz).some(b=>inArea(px,pz,b)))continue;
      tubs.at(px,.67,pz,.54,.77,.54);soil.at(px,1.053,pz,.49,.014,.49);
      leaves.at(px,1.03,pz,.98,.92,.98,rng()*Math.PI*2);
      for(let j=0;j<4;j++){
        const a=j*Math.PI*.5+rng()*.5;
        leaves.at(px+Math.cos(a)*.22,1.04,pz+Math.sin(a)*.22,.56,.62,.56,rng()*Math.PI*2);
      }
      grid.bridgePiers.add({x:px,z:pz,r:.54,top:1.10},[px-.8,pz-.8,px+.8,pz+.8]);
    }
    tubs.flush(root,true,145);soil.flush(root,false,105);leaves.flush(root,true,105);
    for(const s of [51,83])for(const shift of [0,.69,1.38]){
      const a=at(s+shift,.29),b=at(s+shift,road.width/2-.28);
      ribbon(yellow,[a,b],.24,.342,2);
    }
  }
  threshold.mesh(root,m.kerb,'过街缘石坡道');yellow.mesh(root,m.yellow,'文心四路横向减速标线');
  for(const part of [pole,foot,pickets])part.flush(root,false,270);
}
