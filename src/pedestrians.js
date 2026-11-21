import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Reuse the closest mapped footways; each walker keeps its current route until it is out of view.
export async function createPedestrians(scene,map,city){
  const loader=new GLTFLoader();
  const assets=await Promise.all(['sam','maya'].map(name=>loader.loadAsync('/media/'+name+'.glb')));
  const segments=[];
  for(const road of map.roads){
    if(!/^(footway|pedestrian|path)$/.test(road.kind)||road.tunnel||road.indoor)continue;
    for(let i=1;i<road.p.length;i++){
      const [x,z]=road.p[i-1],[ex,ez]=road.p[i],dx=ex-x,dz=ez-z,length=Math.hypot(dx,dz);
      if(length>8)segments.push({x,z,dx,dz,length,mx:(x+ex)/2,mz:(z+ez)/2});
    }
  }
  // Include the centre lines of pedestrian bridge decks that OSM maps as areas.
  const bridge=map.views.find(p=>p.id==='bridge');
  if(bridge)for(let i=0;i<4;i++){
    const x=bridge.x+(i*35+10)*.193,z=bridge.z-(i*35+10)*.981;segments.push({x,z,dx:5.79,dz:-29.43,mx:x+2.9,mz:z-14.7,length:30});
  }
  const promenade=map.roads.find(r=>r.id===map.landmarks.starBridge.pathId);
  const bridgeLanes=[];
  if(promenade){
    const north=promenade.p.reduce((a,b)=>b[1]<a[1]?b:a),south=promenade.p.reduce((a,b)=>b[1]>a[1]?b:a);
    const dx=north[0]-south[0],dz=north[1]-south[1],length=Math.hypot(dx,dz);
    for(const offset of [-3.6,-1.1]){
      const x=south[0]-dz/length*offset,z=south[1]+dx/length*offset;
      bridgeLanes.push({x,z,dx,dz,length,mx:x+dx/2,mz:z+dz/2});
    }
  }
  const cloth=[0x426259,0x874b5a,0x556273,0xb29c84,0x416070,0xb97e74,0x65776c,0x725972,0x5b5750,0x8b7772];
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),bound=new THREE.Sphere(new THREE.Vector3(),1.3);
  const crowd=Array.from({length:10},(_,i)=>{
    const asset=assets[i%2],actor=clone(asset.scene),group=new THREE.Group();
    actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;
      if(o.material?.name.includes('original top')){o.material=o.material.clone();o.material.color.setHex(cloth[i]);}
    }});
    group.scale.setScalar(.95+((i*7)%13)/100);group.add(actor);scene.add(group);group.visible=false;
    const mixer=new THREE.AnimationMixer(actor),clip=asset.animations[0],action=mixer.clipAction(clip);action.play();action.time=i*.37;
    return {group,mixer,route:bridgeLanes[i]||null,walk:i===1?(bridgeLanes[1]?.length||0)*2-37:24,rate:.86+i*.045,side:(i%2?1:-1)*.55};
  });
  let lastX=1e8,lastZ=1e8;
  return {update(dt,camera){
    const {x,z,y}=camera.position;
    if(y>90){crowd.forEach(p=>p.group.visible=false);lastX=1e8;return;}
    if(Math.hypot(x-lastX,z-lastZ)>40){
      lastX=x;lastZ=z;
      const near=segments.map(s=>[s,(s.mx-x)**2+(s.mz-z)**2]).filter(([,d])=>d<150**2&&d>7**2).sort((a,b)=>a[1]-b[1]);
      const used=new Set(crowd.filter(p=>p.route && Math.hypot(p.route.mx-x,p.route.mz-z)<125).map(p=>p.route));
      for(let i=0;i<crowd.length;i++){
        const p=crowd[i];if(!p.route||!used.has(p.route)){
          const found=near.find(([r])=>!used.has(r)&&city.isWalkable(r.mx,r.mz));p.route=found?.[0];
          if(p.route){used.add(p.route);p.walk=p.route.length*(.19+((i*29)%65)/100);}
        }
      }
    }
    camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
    for(const p of crowd){
      const r=p.route;if(!r){p.group.visible=false;continue;}
      p.walk=(p.walk+dt*p.rate)%(r.length*2);const back=p.walk>r.length,t=(back?2*r.length-p.walk:p.walk)/r.length;
      const px=r.x+r.dx*t-r.dz/r.length*p.side,pz=r.z+r.dz*t+r.dx/r.length*p.side;
      const h=city.groundHeight(px,pz);bound.center.set(px,h+.9,pz);
      p.group.visible=Math.hypot(px-x,pz-z)<115 && frustum.intersectsSphere(bound);if(!p.group.visible)continue;
      p.group.position.set(px,h,pz);p.group.rotation.y=Math.atan2(r.dx,r.dz)+(back?Math.PI:0);
      p.mixer.update(dt*p.rate);
    }
  }};
}
