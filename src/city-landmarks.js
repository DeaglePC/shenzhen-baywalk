import * as T from 'three';
import {Instances, along} from './city-geometry.js';
import {label} from './city-materials.js';
import {bamboo} from './city-bamboo.js';
import {buildStadium} from './city-stadium.js';
import {starBridge} from './city-starbridge.js';
import {cultureIDs} from './city-culture-square.js';

export const specialBuildings = new Set([529272473,665408865,665408866,665408867,9244350,9244351,...cultureIDs,736632011]);

function mesh(parent,geo,mat,x,y,z,name){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function parkStructures(root,roads,m){
  const rail=new Instances(new T.CylinderGeometry(1,1,1,6),m.rail,'湖桥不锈钢扶手');
  roads.forEach(rd=>{
    if(Number(rd.id)===562534109){starBridge(root,rd,m);return;}
    if(Number(rd.id)!==570468707)return;
    const p=rd.p,w=2.35,deck=2.4;
    for(const side of [-1,1]){
      for(let k=1;k<p.length;k++){
        const A=p[k-1],B=p[k],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*w*.5*side,oz=dx/L*w*.5*side;
        for(const dy of [.53,1.12])rail.between(A[0]+ox,deck+dy,A[1]+oz,B[0]+ox,deck+dy,B[1]+oz,.047);
      }
      along(p,2.65,.4,(x,z,dx,dz)=>{const ox=-dz*w*.5*side,oz=dx*w*.5*side;rail.between(x+ox,deck,z+oz,x+ox,deck+1.14,z+oz,.045);});
    }
  });
  rail.flush(root);
  const board=new T.MeshStandardMaterial({map:label('深圳人才公园','SHENZHEN TALENT PARK',1024,'#355147'),roughness:.77});
  const boardBack=new T.MeshStandardMaterial({color:0x61665b});
  // Monument at the west gates, facing visitors approaching from the road.
  const panel=mesh(root,new T.BoxGeometry(.32,1.7,7.6),[boardBack,board,boardBack,boardBack,boardBack,boardBack],-454,1.25,223,'西入口园名标识');
  panel.rotation.y=-.13;
}
export function landmarks(group,map,m){
  bamboo(group,m);parkStructures(group,map.roads,m);
  return buildStadium(group,m,map);
}

