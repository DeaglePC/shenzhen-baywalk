import * as T from 'three';
import {Surface,random} from './city-geometry.js';

const tau=2*Math.PI,up=new T.Vector3(0,1,0);
const v=(x,y,z)=>new T.Vector3(x,y,z);
const step=(p,a,run,rise)=>v(p.x+Math.cos(a)*run,p.y+rise,p.z+Math.sin(a)*run);

// A widening base, staggered forks, then short flowering spurs. All positions
// are in tree-height units so the petals and their distant sprays share the wind.
function branch(surface,points,radii,sides){
  const start=surface.p.length/3,ref=v(0,0,1),tangent=v(0,0,0),right=v(0,0,0),front=v(0,0,0);
  let distance=0;
  for(let j=0;j<points.length;j++){
    const p=points[j];
    if(j)distance+=p.distanceTo(points[j-1]);
    tangent.subVectors(points[Math.min(j+1,points.length-1)],points[Math.max(0,j-1)]).normalize();
    right.crossVectors(tangent,ref).normalize();front.crossVectors(tangent,right);
    for(let i=0;i<=sides;i++){
      const a=tau*i/sides,r=radii[j];
      const point=p.clone().addScaledVector(right,r*Math.cos(a)).addScaledVector(front,r*Math.sin(a));
      surface.vertex(point.toArray(),[i/sides,distance/(tau*radii[0])]);
      if(i&&j){
        const b=start+j*(sides+1)+i;
        surface.indices.push(b-sides-2,b-sides-1,b,b-sides-2,b,b-1);
      }
    }
  }
}

function spray(surface,center,radius,yaw,tilt,tile,color){
  const side=v(Math.cos(yaw),0,Math.sin(yaw)).multiplyScalar(radius);
  const lift=v(-Math.sin(yaw)*tilt,.76,Math.cos(yaw)*tilt).multiplyScalar(radius);
  const lo=(tile+.02)*.25,hi=(tile+.98)*.25;
  const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>center.clone().addScaledVector(side,i).addScaledVector(lift,j).toArray());
  surface.quad(...points,[[lo,.015],[hi,.015],[hi,.985],[lo,.985]],color);
}

function leafFan(s,origin,angle,rng){
  const base=step(origin,angle,.012,.004),length=.019+.014*rng();
  const shade=.78+.36*rng(),green=new T.Color(0x667c3e).multiplyScalar(shade),rib=new T.Color(0x89914e).multiplyScalar(shade);
  for(let i=-2;i<=2;i++){
    const a=angle+i*.59+(rng()-.5)*.20,l=length*(1-.12*Math.abs(i)),w=.135*l;
    const mid=step(base,a,l*.55,.003),tip=step(base,a,l,-.003-rng()*.005);
    const left=step(mid,a+Math.PI/2,w,-.002),right=step(mid,a-Math.PI/2,w,-.001);
    const k=s.p.length/3;
    for(const p of [base,left,mid,right,tip])s.vertex(p.toArray(),undefined,p===mid?rib:green);
    s.indices.push(k,k+1,k+2,k,k+2,k+3,k+1,k+4,k+2,k+2,k+4,k+3);
  }
}

function bud(s,p,yaw,size){
  const base=s.p.length/3,calyx=new T.Color(0x738049),pink=new T.Color(0xb55777);
  for(const [t,r,color] of [[0,.18,calyx],[.40,.29,calyx],[.68,.25,pink],[1,.035,pink]]){
    const c=step(p,yaw,t*size*.40,t*size);
    for(let i=0;i<5;i++)s.vertex(step(c,i*tau/5,r*size,0).toArray(),undefined,color);
  }
  for(let j=0;j<3;j++)for(let i=0;i<5;i++){
    const a=base+j*5+i,b=base+j*5+(i+1)%5;s.indices.push(a,a+5,b,b,a+5,b+5);
  }
}

function crown(seed){
  const rng=random(seed),wood=new Surface(),leaves=new Surface(),sprays=new Surface(),flowers=[];
  const lean=rng()*tau,at=y=>step(v(.014*Math.sin(y*6),y,0),lean,.16*y*y,0);
  const levels=[0,.035,.18,.34,.52,.69,.84,.91];
  branch(wood,levels.map(at),[.038,.030,.028,.022,.016,.010,.004,.0014],12);
  const phase=rng()*tau;
  for(let i=0;i<10;i++){
    const whorl=i/9,a=phase+i*2.39996+rng()*.53;
    const base=at(.33+.45*whorl+rng()*.055);
    const span=(.25+.16*Math.sin(Math.PI*(whorl+.13)))*(1+.55*(rng()-.5));
    const bend=step(base,a-.25,span*.36,.087+rng()*.065);
    const end=step(bend,a,span*.61,.032+.073*rng());
    const limb=new T.CatmullRomCurve3([base,bend,end]);
    const joint=.026-.022*base.y;
    branch(wood,limb.getPoints(4),[joint*.8,joint*.75,joint*.53,joint*.28,.0012],8);
    const bloomShare=.55+.43*rng();
    for(let j=0;j<5;j++){
      const u=(j+.4)/5,b=limb.getPoint(.38+.61*u);
      const turn=a+(j%2?1:-1)*(.40+rng()*.65);
      const elbow=step(b,turn,.033+.040*rng(),.028+.032*rng());
      const outer=step(elbow,turn+.25*(rng()-.5),.035+.045*rng(),.037+.045*rng());
      branch(wood,[b,elbow,outer],[.0052-.0031*u,.0032-.0015*u,.0008],5);
      for(let k=0;k<5;k++){
        const origin=elbow.clone().lerp(outer,(k+.4)/5),yaw=turn+(rng()-.5)*2.9;
        const tip=step(origin,yaw,.025+rng()*.059,.026+rng()*.045);
        branch(wood,[origin,tip],[.00165,.00054],4);
        const flowering=rng()<bloomShare;
        if(!flowering||rng()<.25){
          leafFan(leaves,tip,yaw,rng);
          leafFan(leaves,origin.clone().lerp(tip,.63),yaw+2.2,rng);
        }
        if(!flowering)continue;
        if(rng()<.64)bud(leaves,tip,yaw,.008+rng()*.006);
        for(let n=0;n<3;n++){
          const p=origin.clone().lerp(tip,.28+n*.34),angle=yaw+rng()*tau;
          const radius=.020+.014*rng();
          const pigment=new T.Color().setRGB(.92+.13*rng(),.83+.15*rng(),.89+.15*rng());
          spray(sprays,p,radius,angle,.12+.95*rng(),rng()*4|0,pigment);
          // Several open corollas face out from each spur at different angles.
          const open=2+(rng()<.52?1:0);
          for(let f=0;f<open;f++){
            const turn=angle+f*2.4+rng()*.6;
            const axis=v(Math.cos(turn),-.42+1.38*rng(),Math.sin(turn)).normalize();
            const size=.0072+.0052*rng(),stem=radius*(.22+.29*rng());
            flowers.push({p:p.clone().addScaledVector(axis,stem),axis,size,roll:rng()*tau,tone:.76+.28*rng()});
          }
        }
      }
    }
  }
  return {wood:wood.geometry(),leaves:leaves.geometry(),sprays:sprays.geometry(),flowers};
}

function petalTexture(){
  const n=96,data=new Uint8Array(n*n*4);
  const rose=[189,74,117],cream=[245,216,175],ink=[.23,.57,.38];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const t=j/(n-1),u=2*(i/(n-1)-.5),edge=Math.abs(u);
    const blush=T.MathUtils.smoothstep(t+.17*edge,.06,.64);
    const veins=Math.pow(.5+.5*Math.cos(u*(23-9*t)+2*Math.sin(6*t+u)),9)
      *T.MathUtils.smoothstep(t,.05,.20)*(1-T.MathUtils.smoothstep(t,.38,.62));
    const rim=.18*edge+.15*T.MathUtils.smoothstep(t,.8,1),idx=(j*n+i)*4;
    for(let c=0;c<3;c++){
      const pigment=T.MathUtils.lerp(cream[c],rose[c],blush);
      data[idx+c]=i<3?255:(pigment+(248-pigment)*rim)*(1-veins*ink[c]);
    }
    data[idx+3]=255;
  }
  const map=new T.DataTexture(data,n,n);map.colorSpace=T.SRGBColorSpace;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;return map;
}

function flowerShape(){
  const s=new Surface(),white=new T.Color(0xffffff),pollen=new T.Color(0xe5ad56);
  for(let i=0;i<5;i++){
    const a=i*tau/5+.065*Math.sin(i*6.8),r=v(Math.cos(a),0,Math.sin(a)),w=v(-r.z,0,r.x);
    const k=s.p.length/3;
    const twist=Math.sin(i*3.7),length=.98+.08*twist;
    for(const [reach,width,lift,t] of [[.037,.042,.015,.025],[.27,.165,.22,.26],[.57,.34,.35,.52],[.81,.38,.29,.74],[.96,.28,.19,.93],[1,.105,.17,.99]]){
      for(const side of [-1,0,1]){
        const across=side*width+twist*.16*t*t;
        const scallop=side*Math.sin(t*10+i)*.06*t;
        const pos=r.clone().multiplyScalar(reach*length-Math.abs(side)*.055*t).addScaledVector(w,across);
        pos.y=lift+.14*side*side*(1-t*.4)+twist*.12*t*t+scallop;
        s.vertex(pos.toArray(),[.52+side*.45,t],white);
      }
    }
    for(let row=0;row<5;row++)for(let col=0;col<2;col++){
      const j=k+row*3+col;s.indices.push(j,j+1,j+4,j,j+4,j+3);
    }
  }
  const first=s.p.length/3;
  for(const [radius,y] of [[.06,.02],[.07,.59],[.015,.68]])for(let i=0;i<3;i++){
    const a=i*tau/3;s.vertex([Math.cos(a)*radius+.065*y,y,Math.sin(a)*radius],[.008,.5],y>.55?pollen:white);
  }
  for(let j=0;j<2;j++)for(let i=0;i<3;i++){
    const a=first+j*3+i,b=first+j*3+(i+1)%3;s.indices.push(a,a+3,b,b,a+3,b+3);
  }
  return s.geometry();
}

export function silkFlossGrove(root,sites,wind,windMaterial,lowQuality){
  if(!sites.length)return;
  const loader=new T.TextureLoader(),pending=[],resources=new Set();
  function load(path){
    let tex;
    pending.push(new Promise(resolve=>{
      tex=loader.load(import.meta.env.BASE_URL+path,resolve,undefined,e=>{
        console.warn('Blossom texture unavailable',path,e);resolve();
      });
    }));
    resources.add(tex);
    tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
  }
  const bark=load('foliage/twig-bark.webp');bark.wrapS=bark.wrapT=T.RepeatWrapping;
  const wood=windMaterial(new T.MeshStandardMaterial({map:bark,color:0xada991,roughness:.95}),wind,false,'blossom');
  const leaf=windMaterial(new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.87}),wind,true,'blossom');
  const pinkBase=new T.MeshStandardMaterial({map:load('talent/field/pink-flowers.webp'),vertexColors:true,alphaTest:.19,side:T.DoubleSide,roughness:.91});
  pinkBase.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n diffuseColor.rgb=pow(diffuseColor.rgb,vec3(.83,.88,.84));');
  };
  const pink=windMaterial(pinkBase,wind,true,'blossom');
  const petal=windMaterial(new T.MeshStandardMaterial({map:petalTexture(),vertexColors:true,roughness:.82,side:T.DoubleSide}),wind,true,'flower');
  petal.userData.individualFlower=true;
  const petalDepth=windMaterial(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}),wind,true,'flower');
  resources.add(petal.map);resources.add(petalDepth);
  const shape=flowerShape(),forms=[crown(3602),crown(71027),crown(93863)];
  const closeGroups=[],pose=new T.Object3D(),rotation=new T.Quaternion();
  forms.forEach((form,variant)=>{
    const trees=sites.filter((_,i)=>i%forms.length===variant);
    if(!trees.length)return;
    const batch=(geo,material,name,flutter)=>{
      const mesh=new T.InstancedMesh(geo,material,trees.length);
      mesh.name='美丽异木棉 · '+name;mesh.castShadow=mesh.receiveShadow=true;
      mesh.customDepthMaterial=windMaterial(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,
        map:material.alphaTest?material.map:null,alphaTest:material.alphaTest,side:material.side}),wind,flutter,'blossom');
      resources.add(mesh);resources.add(mesh.customDepthMaterial);
      root.add(mesh);return mesh;
    };
    const trunk=batch(form.wood,wood,'树干与花枝',false),leaves=batch(form.leaves,leaf,'疏叶',true);
    const clusters=batch(form.sprays,pink,'实拍花簇',true);
    clusters.instanceMatrix.setUsage(T.DynamicDrawUsage);
    // One shared instance buffer of individual flowers per crown shape. Each
    // tree reuses it at close range. Distant trees use the photographed sprays.
    const flowers=new T.InstancedMesh(shape,petal,form.flowers.length);
    form.flowers.forEach(({p,axis,size,roll,tone},i)=>{
      pose.position.copy(p);pose.scale.setScalar(size);
      pose.quaternion.setFromUnitVectors(up,axis).multiply(rotation.setFromAxisAngle(up,roll));pose.updateMatrix();
      flowers.setMatrixAt(i,pose.matrix);flowers.setColorAt(i,new T.Color().setRGB(tone,tone*tone,tone*.98));
    });
    flowers.computeBoundingSphere();
    const records=trees.map(([x,z,h,seed,base=.09],i)=>{
      const rng=random(Math.round(x*1717+z*7919));
      pose.position.set(x,base-.018,z);pose.rotation.set(0,tau*(seed+rng()),0);
      const width=.83+.21*rng();
      pose.scale.set(h*width,h*(.94+.08*rng()),h*width*(.89+.24*rng()));pose.updateMatrix();
      const matrix=pose.matrix.clone();
      for(const mesh of [trunk,leaves,clusters])mesh.setMatrixAt(i,matrix);
      // Do not clone the instanced mesh: Three copies the entire instance
      // buffer when cloning. Only the transform differs between these trees.
      const near=new T.InstancedMesh(shape,petal,0);
      near.instanceMatrix=flowers.instanceMatrix;near.instanceColor=flowers.instanceColor;near.count=flowers.count;
      near.boundingSphere=flowers.boundingSphere.clone();near.boundingSphere.radius+=.05;near.name='美丽异木棉 · 五瓣花与花蕊';
      near.matrixAutoUpdate=false;near.matrix.copy(matrix);near.castShadow=near.receiveShadow=true;near.customDepthMaterial=petalDepth;near.visible=false;
      resources.add(near);root.add(near);return {x,z,h,base,near,matrix};
    });
    for(const mesh of [trunk,leaves,clusters]){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.6;}
    closeGroups.push({clusters,records});
  });
  function update(eye,probe){
    for(const {clusters,records} of closeGroups){
      let changed=false;
      for(const item of records){
        const {x,z,h,base,near}=item,range=(lowQuality?10:15.5)+(near.visible?2.5:0);
        const visible=!probe&&(eye.x-x)**2+(eye.z-z)**2+(eye.y-base-h*.73)**2<range*range;
        if(visible!==near.visible){near.visible=visible;changed=true;}
      }
      if(!changed)continue;
      let far=0;
      for(const {near,matrix} of records)if(!near.visible)clusters.setMatrixAt(far++,matrix);
      clusters.count=far;clusters.visible=far>0;clusters.instanceMatrix.needsUpdate=true;
    }
  }
  return {ready:Promise.all(pending),update,dispose(){for(const resource of resources)resource.dispose();}};
}
