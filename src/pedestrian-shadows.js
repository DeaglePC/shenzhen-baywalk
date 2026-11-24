import * as T from 'three';

// A soft patch of contact occlusion under each shoe also works in the
// low-spec renderer, where directional shadow maps are disabled.
export function pedestrianShadows(scene,capacity){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');
  gradient.addColorStop(.38,'rgba(255,255,255,.76)');
  gradient.addColorStop(.74,'rgba(255,255,255,.20)');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const geometry=new T.BufferGeometry(),count=capacity*4;
  const position=new T.Float32BufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage);
  const color=new T.Float32BufferAttribute(new Float32Array(count*4).fill(1),4).setUsage(T.DynamicDrawUsage);
  const uv=[],indices=[];
  for(let i=0;i<count;i+=4){
    uv.push(0,0,1,0,0,1,1,1);indices.push(i,i+2,i+1,i+2,i+3,i+1);
  }
  geometry.setAttribute('position',position);geometry.setAttribute('color',color);
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  const material=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),color:0x19161b,vertexColors:true,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const mesh=new T.Mesh(geometry,material);mesh.name='行人鞋底接触阴影';mesh.frustumCulled=false;
  mesh.renderOrder=1;geometry.setDrawRange(0,0);scene.add(mesh);
  const heel=new T.Vector3(),toe=new T.Vector3();
  let feet=0;
  return {
    reset(){feet=0;mesh.visible=false;},
    add(legs,city,floor,scale,strength){
      for(const {foot,ball} of legs){
        foot.getWorldPosition(heel);ball.getWorldPosition(toe);
        const x=(heel.x+toe.x)*.5,z=(heel.z+toe.z)*.5;
        const ground=city.groundHeight(x,z,floor+.45);
        const lift=Math.max(0,Math.min(heel.y-.073*scale,toe.y-.01*scale)-ground);
        const width=(.13+lift*.34)*scale,length=(.23+lift*.30)*scale;
        const span=Math.hypot(toe.x-heel.x,toe.z-heel.z)||1;
        const dx=(toe.x-heel.x)/span,dz=(toe.z-heel.z)/span;
        const opacity=strength*.49*Math.exp(-lift*10);
        for(let c=0;c<4;c++){
          const u=(c%2*2-1)*width,v=(c<2?-1:1)*length;
          const px=x+dx*v+dz*u,pz=z+dz*v-dx*u;
          const y=city.groundHeight(px,pz,floor+.45);
          const vertex=feet*4+c;
          position.setXYZ(vertex,px,y+.026,pz);color.setW(vertex,Math.abs(y-ground)<.14?opacity:0);
        }
        feet++;
      }
    },
    finish(){
      mesh.visible=feet>0;geometry.setDrawRange(0,feet*6);
      if(feet){position.needsUpdate=true;color.needsUpdate=true;}
    }
  };
}
