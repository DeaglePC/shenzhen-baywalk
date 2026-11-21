import * as T from 'three';
import {along,area,Instances,random,Surface} from './city-geometry.js';

function rushes(rng){
  const blades=new Surface(),shade=new T.Color(0x718052),tip=new T.Color(0xb4ad72);
  for(let i=0;i<27;i++){
    const a=rng()*Math.PI*2,x=Math.sin(a),z=Math.cos(a);
    const spread=.04+rng()*.22,height=.38+rng()*.62,lean=.08+rng()*.38,width=.008+rng()*.017;
    let prev=[];
    for(let j=0;j<=4;j++){
      const t=j/4,r=spread+lean*t*t,y=height*(t-.16*t*t);
      const w=width*(1.-.95*t),col=shade.clone().lerp(tip,t*.68);
      const pair=[blades.vertex([r*x-w*z,y,r*z+w*x],[0,t],col),blades.vertex([r*x+w*z,y,r*z-w*x],[1,t],col)];
      if(j)blades.indices.push(prev[0],pair[0],pair[1],prev[0],pair[1],prev[1]);
      prev=pair;
    }
  }
  return blades.geometry();
}

// Only the seven mapped wetland islands use this soft, planted edge. Their
// individual rocks and reed beds are seeded scenic detail.
export function islandShores(root,lake,soil){
  if(!lake?.holes?.length)return;
  const rng=random(6079),bank=new Surface(),shoulders=new Surface();
  const rockMat=new T.MeshStandardMaterial({roughness:.84,metalness:.02});
  const leafMat=new T.MeshStandardMaterial({roughness:.92,vertexColors:true,side:T.DoubleSide});
  const boulders=new Instances(new T.IcosahedronGeometry(1,1),rockMat,'湿地岛 · 临水石岸');
  const reeds=new Instances(rushes(rng),leafMat,'湿地岛 · 水边草丛');
  const dark=new T.Color(0x514d3e),light=new T.Color(0x908b73);
  for(const ring of lake.holes){
    const sign=Math.sign(area(ring))||1,outer=[],inner=[];
    for(let i=0;i<ring.length;i++){
      const [x,z]=ring[i],a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
      const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
      const nx=-sign*(b[1]-a[1])/l,nz=sign*(b[0]-a[0])/l;
      inner.push([x+nx*1.12,z+nz*1.12]);outer.push([x-nx*.43,z-nz*.43]);
    }
    bank.polygon(inner,[],.47,4);
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,pt=(p,y)=>[p[0],y,p[1]];
      shoulders.quad(pt(outer[i],.09),pt(outer[j],.09),pt(inner[j],.47),pt(inner[i],.47));
    }
    const closed=[...ring,ring[0]];
    along(closed,1.25,rng(),(x,z,dx,dz)=>{
      const n=-sign*dz,m=sign*dx,patch=Math.sin(x*.077+z*.041)+.75*Math.cos(z*.15);
      if(patch>.30 && rng()>.18){
        const j=rng()-.5,scale=.26+.38*rng();
        boulders.at(x+n*j,.13+rng()*.09,z+m*j,scale*(1+rng()*.65),scale*.65,scale*.84,rng()*6,
          dark.clone().lerp(light,rng()));
      }
      if(patch<.45 && rng()<.69){
        const j=-.22+rng()*1.26,k=.76+rng()*.85;
        reeds.at(x+j*n,.18+.15*Math.max(0,j),z+j*m,k*1.22,k,k*1.22,rng()*6);
      }
    });
  }
  bank.mesh(root,soil,'湿地岛 · 沿岸草地');
  shoulders.mesh(root,new T.MeshStandardMaterial({color:0x655c49,roughness:1,side:T.DoubleSide}),'湿地岛 · 土岸');
  boulders.flush(root,true,730);reeds.flush(root,false,480);
}
