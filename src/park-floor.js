import * as T from 'three';
import {Surface,random} from './city-geometry.js';

// One small patch per nearby tree. Outer tufts break up the transition to the mown lawn.
function groundPlants(){
  const s=new Surface(),rng=random(60822),color=new T.Color(),tau=2*Math.PI;
  for(let clump=0;clump<95;clump++){
    const angle=rng()*tau,r=.22+.76*Math.sqrt(rng()),x=r*Math.cos(angle),z=r*Math.sin(angle);
    const h=.045+rng()*.085+(clump%8===0?.09:0),green=rng();
    for(let i=0;i<5;i++){
      const a=angle+rng()*tau,dx=Math.cos(a),dz=Math.sin(a),w=.0025+.003*rng();
      const bx=x+(rng()-.5)*.025,bz=z+(rng()-.5)*.025,height=h*(.52+rng()*.48);
      const k=s.p.length/3;
      const vertex=(spread,out,y,light)=>{
        color.setRGB(.041+green*.038,.095+green*.069,.023+green*.018).multiplyScalar(light);
        s.vertex([bx+dx*out-dz*spread,y,bz+dz*out+dx*spread],undefined,color);
      };
      vertex(-w,0,0,.64);vertex(w,0,0,.64);vertex(w*.64,height*.25,height*.68,1);
      vertex(-w*.64,height*.25,height*.68,1);vertex(0,height*.60,height,1.28);
      s.indices.push(k,k+1,k+2,k,k+2,k+3,k+3,k+2,k+4);
    }
  }
  // Folded dry blades and scattered petioles sit just above the soil.
  for(let i=0;i<125;i++){
    const a=rng()*tau,r=Math.sqrt(rng())*.95,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const turn=rng()*tau,dx=Math.cos(turn),dz=Math.sin(turn),l=.025+rng()*.037,w=l*(.22+.16*rng()),k=s.p.length/3;
    const shade=rng();color.setRGB(.095+.19*shade,.058+.08*shade,.025+.035*shade);
    for(const [along,across,y] of [[-1,0,.003],[-.1,1,.004],[1,0,.006],[.08,-1,.004],[0,0,.013]])
      s.vertex([x+dx*l*along-dz*w*across,y,z+dz*l*along+dx*w*across],undefined,color);
    s.indices.push(k,k+4,k+1,k+1,k+4,k+2,k+2,k+4,k+3,k+3,k+4,k);
  }
  return s.geometry();
}

export function parkFloor(root,limit){
  const texture=new T.TextureLoader().load(import.meta.env.BASE_URL+'foliage/root-soil.webp');
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const soil=new T.InstancedMesh(new T.PlaneGeometry(2,2).rotateX(-Math.PI/2),
    new T.MeshStandardMaterial({map:texture,roughness:1,alphaTest:.32,alphaToCoverage:true}),limit);
  const plants=new T.InstancedMesh(groundPlants(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.91}),limit);
  soil.name='园林草地 · 根部表土';plants.name='园林草地 · 林下草叶与落叶';
  for(const mesh of [soil,plants]){
    mesh.count=0;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);
  }
  const pose=new T.Object3D();
  return function update(sites){
    let count=0;
    for(const [d,p] of sites){
      if(count>=limit||d>42*42)break;
      if(!p.floorRadius)continue;
      pose.position.set(p[0],p.floorY+.005,p[1]);pose.rotation.y=p[3]*2*Math.PI;
      pose.scale.set(p.floorRadius,1,p.floorRadius*(.80+.18*p[3]));pose.updateMatrix();
      soil.setMatrixAt(count,pose.matrix);plants.setMatrixAt(count,pose.matrix);count++;
    }
    for(const mesh of [soil,plants]){mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;}
  };
}
