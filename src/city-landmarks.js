import * as T from 'three';
import {Instances, Surface, ribbon, along, random} from './city-geometry.js';
import {label} from './city-materials.js';

export const specialBuildings = new Set([529272473,665408865,665408866,665408867,9244350,9244351,1441599159,736632011]);
const TAU=Math.PI*2;
function mesh(parent,geo,mat,x,y,z,name){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ringR(t,profile){
  const j=profile.findIndex(a=>a[0]>=t);if(j<0)return 0;if(j===0)return profile[0][1];
  const [t0,r0]=profile[j-1],[t1,r1]=profile[j];return T.MathUtils.lerp(r0,r1,(t-t0)/(t1-t0));
}
function bamboo(root,m){
  const x=-263.30,z=-456.81,h=392.5;
  const group=new T.Group();group.name='中国华润大厦 · 春笋';group.position.set(x,0,z);root.add(group);
  const profile=[[0,28],[.035,30],[.095,34.1],[.19,36.6],[.28,36.65],[.4,35.3],[.56,32.4],[.69,28.9],[.80,24.9],[.88,20.6],[.93,15.7],[.965,10.3],[.988,4.9],[1,0.48]];
  const shell=new Surface(),s=new Instances(new T.CylinderGeometry(1,1,1,5,1,true),m.cream,'56 根外框柱');
  const steel=new Instances(new T.CylinderGeometry(1,1,1,4,1,true),m.rail,'层间金属带');
  const ring=(a,t,delta=0)=>{const r=ringR(t,profile)+delta;return [r*Math.sin(a),h*t,r*Math.cos(a)];};
  const floors=80,col=new T.Color();
  for(let j=0;j<floors;j++){
    const lo=j/floors,hi=(j+1)/floors;
    for(let i=0;i<56;i++){
      const a=i/56*TAU,b=(i+1)/56*TAU;
      const p=ring(a,lo),q=ring(b,lo),r=ring(b,hi),v=ring(a,hi);
      const t=.55+.25*Math.sin(a+.6)+.15*Math.cos(2*a-hi*5);
      col.setRGB(.45+t*.36,.58+t*.29,.64+t*.3);
      shell.quad(p,q,r,v,[[i/12,j/12],[(i+1)/12,j/12],[(i+1)/12,(j+1)/12],[i/12,(j+1)/12]],col);
      const A=ring(a,lo,.18),B=ring(b,lo,.18);
      steel.between(...A,...B,.15);
    }
  }
  shell.mesh(group,m.walls[0],'弧形玻璃幕墙',true);
  for(let i=0;i<56;i++){
    let last;for(let j=0;j<=38;j++){
      const t=j/38,merge=t<.12?(1-t/.12):t>.86?(t-.86)/.14:0;
      const a=TAU*(i+.5*merge*(i%2?-1:1))/56,p=ring(a,t,.25);
      if(last)s.between(...last,...p,.4+.19*(1-t));last=p;
    }
  }
  s.flush(group,true);steel.flush(group);
  const podium=mesh(group,new T.CylinderGeometry(50,51,1.2,64),m.paving,0,.5,0,'人才广场石台');podium.scale.z=.92;
  const portal=new Instances(new T.BoxGeometry(1,1,1),m.cream,'基座门廊');
  for(let i=0;i<14;i++){const a=TAU*i/14;portal.at(Math.sin(a)*34,3.4,Math.cos(a)*34,2.2,6.8,1.2,a);}
  portal.flush(group,true);
}
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
function culturalCentre(root,m){
  const group=new T.Group();group.name='深圳湾文化广场';root.add(group);
  const stone=new T.MeshStandardMaterial({color:0xb8ada1,roughness:.63,metalness:.1});
  const fins=new Instances(new T.CylinderGeometry(1,1,1,4,1,true),m.rail,'海石上的细密纹路');
  for(const [x,z,rx,rz,h,rot] of [[-419,-176,63,39,26,-.35],[-402,-83,74,49,30,.54]]){
    const local=new T.Group();local.position.set(x,0,z);local.rotation.y=rot;group.add(local);
    const s=new Surface(),fn=(a,v)=>{
      const th=v*Math.PI*.60;
      const t=Math.sin(th);return [Math.cos(a)*rx*t + 7*(1-t),h*Math.cos(th)*(.96+.04*Math.cos(a*2))+6,Math.sin(a)*rz*t+3*Math.sin(a*2)*t];
    };
    for(let i=0;i<72;i++)for(let j=0;j<24;j++){
      const a=i/72*TAU,b=(i+1)/72*TAU,u=j/24,v=(j+1)/24;
      s.quad(fn(a,u),fn(b,u),fn(b,v),fn(a,v));
      if(j%2===0){const A=fn(a,u),B=fn(b,u);const c=Math.cos(rot),sn=Math.sin(rot);fins.between(x+c*A[0]+sn*A[2],A[1]+.07,z-sn*A[0]+c*A[2],x+c*B[0]+sn*B[2],B[1]+.07,z-sn*B[0]+c*B[2],.075);}
    }
    s.mesh(local,stone,'海石形剧场',true);
  }
  fins.flush(group);
}
function parkStructures(root,roads,m){
  const rail=new Instances(new T.CylinderGeometry(1,1,1,6),m.rail,'湖桥不锈钢扶手');
  const bronze=document.createElement('canvas');bronze.width=128;bronze.height=768;
  const g=bronze.getContext('2d'),bg=g.createLinearGradient(0,0,128,0);
  bg.addColorStop(0,'#858d8c');bg.addColorStop(.07,'#c3cac6');bg.addColorStop(.25,'#e0e2d7');bg.addColorStop(.72,'#a8b5b2');bg.addColorStop(.93,'#d4dbd6');bg.addColorStop(1,'#929c9a');
  g.fillStyle=bg;g.fillRect(0,0,128,768);g.fillStyle='#c7ebf1';g.fillRect(8,16,3,718);g.fillRect(116,16,2,718);
  g.textAlign='center';g.fillStyle='#536668';g.font='600 24px "Microsoft YaHei",sans-serif';
  [...'人才星光桥'].forEach((c,i)=>g.fillText(c,64,286+31*i));
  g.font='10px Arial';g.fillText('TALENT PARK',64,460);g.fillRect(38,475,52,1);
  g.font='46px Arial';g.fillText('✦',64,202);
  for(let i=0;i<6;i++){g.fillRect(36,504+5*i,56-(i%3)*7,.8);}
  const finish=new T.CanvasTexture(bronze);finish.colorSpace=T.SRGBColorSpace;finish.anisotropy=8;
  const skin=new T.MeshStandardMaterial({map:finish,color:0xffffff,roughness:.32,metalness:.36});
  const column=new Instances(new T.BoxGeometry(1,1,1),skin,'星光桥灯柱');
  const light=new Instances(new T.BoxGeometry(1,1,1),m.lamp,'嵌入式灯带');
  const color=new T.Color(0xffffff);
  roads.forEach(rd=>{
    const star=Number(rd.id)===562534109,pi=Number(rd.id)===570468707;
    if(!star&&!pi)return;
    const p=rd.p,w=star?11.8:2.35,deck=2.4;
    for(const side of [-1,1]){
      for(let k=1;k<p.length;k++){
        const A=p[k-1],B=p[k],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*w*.5*side,oz=dx/L*w*.5*side;
        for(const dy of [.53,1.12])rail.between(A[0]+ox,deck+dy,A[1]+oz,B[0]+ox,deck+dy,B[1]+oz,.047);
      }
      along(p,2.65,.4,(x,z,dx,dz)=>{const ox=-dz*w*.5*side,oz=dx*w*.5*side;rail.between(x+ox,deck,z+oz,x+ox,deck+1.14,z+oz,.045);});
      if(star)along(p,9.2,5,(x,z,dx,dz)=>{const ox=-dz*(w*.5-.38)*side,oz=dx*(w*.5-.38)*side,rot=Math.atan2(dx,dz);
        column.at(x+ox,deck+2.1,z+oz,.37,4.2,.6,rot,color);light.at(x+ox+dz*.21*side,deck+2.4,z+oz-dx*.21*side,.041,3.15,.23,rot);
      });
    }
  });
  rail.flush(root);column.flush(root,true);light.flush(root);
  const board=new T.MeshStandardMaterial({map:label('深圳人才公园','SHENZHEN TALENT PARK',1024,'#355147'),roughness:.77});
  const boardBack=new T.MeshStandardMaterial({color:0x61665b});
  // Monument at the west gates, facing visitors approaching from the road.
  const panel=mesh(root,new T.BoxGeometry(.32,1.7,7.6),[boardBack,board,boardBack,boardBack,boardBack,boardBack],-454,1.25,223,'西入口园名标识');
  panel.rotation.y=-.13;
}
export function landmarks(group,roads,m){bamboo(group,m);stadium(group,m);culturalCentre(group,m);parkStructures(group,roads,m);}

