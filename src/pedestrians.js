import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

import {fitWalker} from './pedestrian-wardrobe.js';
import {pedestrianNetwork,WalkingRoute} from './pedestrian-routes.js';
import {groundedGait,pedestrianGaze} from './pedestrian-gait.js';
import {pedestrianShadows} from './pedestrian-shadows.js';
import {random} from './city-geometry.js';

export async function createPedestrians(scene,map,city,carAt){
  const loader=new GLTFLoader();
  const assets=await Promise.all(['sam','maya'].map(async name=>{
    const [model,motion]=await Promise.all([name,name+'-motion'].map(file=>loader.loadAsync('/media/'+file+'.glb')));
    const walks=motion.animations.filter(clip=>clip.name.startsWith('Walk_')).map(clip=>({
      clip,stride:motion.parser.json.animations.find(a=>a.name===clip.name).extras.strideMeters
    }));
    return {scene:model.scene,walks,stand:motion.animations.find(clip=>clip.name==='Stand')};
  }));
  const edges=pedestrianNetwork(map,city.parkWalkPaths),rng=random(74219);
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),bound=new THREE.Sphere(new THREE.Vector3(),1.3);
  const crowd=Array.from({length:10},(_,i)=>{
    const asset=assets[i%2],actor=clone(asset.scene),group=new THREE.Group();
    const phone=actor.getObjectByName('Phone');
    if(phone)phone.visible=false;
    actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;
    }});
    fitWalker(actor,i);
    group.scale.setScalar(.95+((i*7)%13)/100);group.add(actor);scene.add(group);group.visible=false;
    const mixer=new THREE.AnimationMixer(actor),{clip,stride}=asset.walks[i%asset.walks.length];
    const walk=mixer.clipAction(clip).play(),stand=mixer.clipAction(asset.stand).setEffectiveWeight(0).play();
    const pace=stride/clip.duration*group.scale.x*(.90+(i*7%11)*.018);
    return {group,mixer,walk,stand,stride:stride*group.scale.x,phase:rng(),restTime:rng()*asset.stand.duration,
      weight:1,speed:pace,pace,blocked:false,route:null,lane:.63+rng()*.35,
      gait:groundedGait(actor),gaze:pedestrianGaze(actor,i)};
  });
  const shadows=pedestrianShadows(scene,crowd.length*2);
  // On a long bridge the closest point can be far from the middle of a mapped
  // edge. Seed from that point, then keep walkers on their connected route.
  function populate(x,z){
    const places=[];
    for(const e of edges){
      const length=e.length;if(length<4)continue;
      const along=(x-e.start.point.x)*e.dir.x+(z-e.start.point.y)*e.dir.y;
      const closest=THREE.MathUtils.clamp(along,0,length);
      for(let s=Math.max(Math.min(1,length*.5),closest-92);s<Math.min(length,closest+121);s+=17.3){
        const px=e.start.point.x+e.dir.x*s,pz=e.start.point.y+e.dir.y*s,d=Math.hypot(px-x,pz-z);
        if(d>7&&d<120)places.push({e,s,d});
      }
    }
    places.sort((a,b)=>a.d-b.d);
    const taken=crowd.filter(p=>p.route&&Math.hypot(p.route.point.x-x,p.route.point.y-z)<125);
    for(let i=0;i<crowd.length;i++){
      const p=crowd[i];if(taken.includes(p))continue;
      p.route=null;
      for(const {e,s} of places){
        const back=i%2===0,r=new WalkingRoute(back?e.reverse:e,back?e.length-s:s,p.lane,rng);
        if(!city.isWalkable(r.point.x,r.point.y,r.ceiling())||carAt?.(r.point.x,r.point.y,.26,city.groundHeight(r.point.x,r.point.y,r.ceiling()))||taken.some(q=>q.route.point.distanceToSquared(r.point)<25))continue;
        p.route=r;p.speed=p.pace;p.blocked=false;p.weight=1;p.gait.release();taken.push(p);break;
      }
    }
  }
  let lastX=1e8,lastZ=1e8,recheck=0;
  function followingPace(p){
    const r=p.route,dx=Math.sin(r.heading),dz=Math.cos(r.heading);
    let pace=p.pace;
    for(const other of crowd){
      if(other===p||!other.route)continue;
      const lead=other.route,x=lead.point.x-r.point.x,z=lead.point.y-r.point.y;
      const gap=x*dx+z*dz;
      if(gap<=0||gap>1.9||Math.abs(x*dz-z*dx)>.53||Math.cos(lead.heading-r.heading)<.58)continue;
      if(Math.abs(city.groundHeight(r.point.x,r.point.y,r.ceiling())-
        city.groundHeight(lead.point.x,lead.point.y,lead.ceiling()))>.65)continue;
      pace=Math.min(pace,Math.max(0,(gap-.60)*1.35));
    }
    return pace;
  }
  return {positions(){
    if(lastX===1e8)return [];
    return crowd.filter(p=>p.route).map(p=>{const {x,y:z}=p.route.point;return {x,z,y:city.groundHeight(x,z,p.route.ceiling())};});
  },update(dt,camera){
    const {x,z,y}=camera.position;
    shadows.reset();
    if(y>90){crowd.forEach(p=>{p.group.visible=false;p.gait.release();});lastX=1e8;return;}
    recheck+=dt;
    if(Math.hypot(x-lastX,z-lastZ)>35||recheck>2&&crowd.some(p=>p.route&&Math.hypot(p.route.point.x-x,p.route.point.y-z)>130)){
      lastX=x;lastZ=z;recheck=0;populate(x,z);
    }
    camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
    for(const p of crowd){
      const route=p.route;if(!route){p.group.visible=false;continue;}
      // Keep probing after a stop and ease back into the first stride.
      const targetSpeed=followingPace(p);
      p.speed=THREE.MathUtils.damp(p.speed,p.blocked?Math.min(.15,targetSpeed):targetSpeed,p.blocked?9:3.6,dt);
      const distance=route.advance(dt*p.speed,city,carAt);
      if(dt>0){
        p.blocked=distance<1e-6;
        const moving=THREE.MathUtils.smoothstep(distance/dt,.09,.58);
        p.weight=THREE.MathUtils.damp(p.weight,moving,p.blocked?9:6,dt);
      }
      p.phase=(p.phase+distance/p.stride)%1;
      p.restTime=(p.restTime+dt)%p.stand.getClip().duration;
      const {x:px,y:pz}=route.point,h=city.groundHeight(px,pz,route.ceiling()),d=Math.hypot(px-x,pz-z);
      bound.center.set(px,h+.9,pz);
      p.group.visible=d<115&&frustum.intersectsSphere(bound);
      if(!p.group.visible){p.gait.release();p.gaze(route,dt,false);continue;}
      p.group.position.set(px,h,pz);p.group.rotation.y=route.heading;
      p.gait.restore();
      p.walk.time=p.phase*p.walk.getClip().duration;p.walk.setEffectiveWeight(p.weight);
      p.stand.time=p.restTime;p.stand.setEffectiveWeight(1-p.weight);p.mixer.update(0);
      p.gaze(route,dt,true);
      const near=1-THREE.MathUtils.smoothstep(d,27,44);
      p.gait.adjust(p.group,h,city,near,p.phase,p.weight);
      if(near>0)shadows.add(p.gait.legs,city,h,p.group.scale.x,near);
    }
    shadows.finish();
  }};
}
