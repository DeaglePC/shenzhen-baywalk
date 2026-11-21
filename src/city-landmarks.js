import * as T from 'three';
import {Instances, Surface, ribbon, along, random} from './city-geometry.js';
import {label} from './city-materials.js';
import {bamboo} from './city-bamboo.js';
import {starBridge} from './city-starbridge.js';
import {cultureIDs} from './city-culture-square.js';

export const specialBuildings = new Set([529272473,665408865,665408866,665408867,9244350,9244351,...cultureIDs,736632011]);
const TAU=Math.PI*2;
function mesh(parent,geo,mat,x,y,z,name){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function stadium(root,m){
  const group=new T.Group();group.name='深圳湾体育中心 · 春茧';root.add(group);
  const skin=new Surface(),facade=new Surface(),poles=new Instances(new T.CylinderGeometry(1,1,1,4,1,true),m.cream,'春茧三角网壳');
  const strips=new Instances(new T.CylinderGeometry(1,1,1,4,1,true),m.rail,'看台结构');
  const inner=(a)=>[225+80*Math.cos(a),-766+95*Math.sin(a)];
  function shape(a,t){
    const b=inner(a),x=42+334*Math.cos(a),z=-809+133*Math.sin(a)+29*Math.cos(a);
    const y=7+30*t+24*Math.sin(t*Math.PI)+4*Math.cos(a-.4)*Math.sin(t*Math.PI);
    return [b[0]*t+x*(1-t),y,b[1]*t+z*(1-t)];
  }
  const N=124,L=12;
  for(let i=0;i<N;i++){
    const a=i/N*TAU,b=(i+1)/N*TAU,A=shape(a,0),B=shape(b,0);
    facade.quad([A[0],.3,A[2]],A,B,[B[0],.3,B[2]]);
    if(i%2===0)strips.between(A[0],.4,A[2],...A,.52);
    for(let j=0;j<L;j++){
      const u=j/L,v=(j+1)/L,P=shape(a,u),Q=shape(b,u),R=shape(b,v),S=shape(a,v);
      skin.quad(P,Q,R,S);
      const lift=p=>[p[0],p[1]+.32,p[2]];
      poles.between(...lift(P),...lift(Q),j%3===0?.39:.23);
      if((i+j)%2===0)poles.between(...lift(P),...lift(R),.33);else poles.between(...lift(Q),...lift(S),.33);
      if((j+i)%3===0)poles.between(...lift(P),...lift(S),.23);
    }
    const b0=inner(a),b1=inner(b);
    for(let j=0;j<14;j++){const k=1-j*.024,kn=k-.024,y=35-j*2;
      const p=[225+(b0[0]-225)*k,y,-766+(b0[1]+766)*k],q=[225+(b1[0]-225)*k,y,-766+(b1[1]+766)*k];
      skin.quad(p,q,[225+(b1[0]-225)*kn,y-1.7,-766+(b1[1]+766)*kn],[225+(b0[0]-225)*kn,y-1.7,-766+(b0[1]+766)*kn]);
    }
  }
  const silver=new T.MeshStandardMaterial({color:0xa9b4b9,metalness:.4,roughness:.38,side:T.DoubleSide});
  skin.mesh(group,silver,'连续银色屋盖',true);facade.mesh(group,m.glass,'体育场玻璃下裙');poles.flush(group);strips.flush(group);
  const field=mesh(group,new T.PlaneGeometry(75,111),m.field,225,.25,-766,'草坪');field.rotation.x=-Math.PI/2;
}
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
export function landmarks(group,roads,m){bamboo(group,m);stadium(group,m);parkStructures(group,roads,m);}

