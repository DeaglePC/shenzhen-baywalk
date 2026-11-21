import * as T from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCity} from './city.js';
import {createVehicles} from './vehicles.js';
import {createPedestrians} from './pedestrians.js';
import {createFilm} from './film.js';

const skies=[
  {key:'sunset',name:'日落',fog:0xd6b09f,density:.00021,rotation:3.32,dir:[-.884,.086,-.458],light:0xffba80,power:2.36,env:.62,bg:.54,exposure:.94,night:.19},
  {key:'day',name:'午后',fog:0xc8d7d8,density:.00013,rotation:2.1,dir:[.10,.75,-.66],light:0xffeed6,power:2.35,env:.80,bg:.91,exposure:.95,night:0},
  {key:'dusk',name:'蓝调',fog:0x657990,density:.00018,rotation:3.42,dir:[-.9,.13,-.41],light:0xffb59b,power:.51,env:.36,bg:.66,exposure:.95,night:.92}
];
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
export async function buildWorld(container,map,{progress,report,step,onCamera}){
  progress(15,'初始化 WebGL 渲染器…');await frame();
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false,logarithmicDepthBuffer:true});
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=debug && /swiftshader|llvmpipe|software rasterizer/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=!software;renderer.shadowMap.type=T.PCFSoftShadowMap;
  let ratio=software?Math.min(1,1000/innerWidth):Math.min(devicePixelRatio,1.45);renderer.setPixelRatio(ratio);container.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(67,1,.16,32000),canvas=renderer.domElement;
  const film=software?{render:(s,c)=>renderer.render(s,c)}:createFilm(renderer,camera);
  camera.rotation.order='YXZ';canvas.tabIndex=0;canvas.setAttribute('aria-label','深圳湾实时三维漫游，WASD 移动，拖动环顾');
  const hemi=new T.HemisphereLight(0xd2dff0,0xa59886,.64);scene.add(hemi);
  const sun=new T.DirectionalLight();scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-82,right:82,top:82,bottom:-82,near:.5,far:860});sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.00027;sun.shadow.normalBias=.045;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  const sunDirection=new T.Vector3(),skiesLoaded=new Map(),loader=new HDRLoader();
  let city,vehicles,people,skyIndex=0,skyRequest=0,anchorX=1e8,anchorZ=1e8,lastShadow=-1e8;
  let playing=false,orbiting=false,pitch=0,yaw=0,elapsed=0,gait=0,stepDist=0,joyX=0,joyZ=0;
  const keys=new Set(),foot=new T.Vector3(),dir=new T.Vector3(),ground=new T.Vector3();
  const orbit=new OrbitControls(camera,canvas);orbit.enabled=false;orbit.enableDamping=true;
  orbit.minDistance=28;orbit.maxDistance=3100;orbit.maxPolarAngle=Math.PI*.478;orbit.minPolarAngle=.09;orbit.screenSpacePanning=false;orbit.dampingFactor=.095;
  let drag=null,captured=false,blocked=false;
  async function setSky(index){
    const token=++skyRequest,sky=skies[index];
    if(!skiesLoaded.has(index)){
      const p=loader.loadAsync('/media/'+sky.key+'.hdr').then(t=>{t.mapping=T.EquirectangularReflectionMapping;return t;});
      skiesLoaded.set(index,p);p.catch(()=>skiesLoaded.delete(index));
    }
    const texture=await skiesLoaded.get(index);if(token!==skyRequest)return;
    skyIndex=index;scene.background=texture;scene.environment=texture;scene.backgroundRotation.y=sky.rotation;scene.environmentRotation.y=sky.rotation;
    scene.backgroundIntensity=sky.bg;scene.environmentIntensity=sky.env;renderer.toneMappingExposure=sky.exposure;
    scene.fog=new T.FogExp2(sky.fog,sky.density);hemi.intensity=index===2?.28:.53;
    sun.color.setHex(sky.light);sun.intensity=sky.power;sunDirection.fromArray(sky.dir).normalize();
    city?.setSun?.(sunDirection,sun.color);city?.setNight?.(sky.night);vehicles?.setNight(sky.night);anchorX=1e8;
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(container);resize();const initialSky=setSky(0);
  progress(30,'构建建筑、步道与湖岸…');await frame();await frame();
  city=createCity(scene,map,{renderer,camera,quality:software?'low':'balanced'});progress(62,'装载深圳出租车与城市车流…');await frame();
  [vehicles]=await Promise.all([createVehicles(scene,map),initialSky]);await setSky(0);
  progress(87,'准备湖面倒影与街景…');await frame();
  createPedestrians(scene,map,city).then(p=>people=p).catch(err=>console.warn('行人资源',err));
  function safePoint(x,z){
    if(city.isWalkable(x,z))return [x,z];
    for(let r=.65;r<=95;r*=1.45)for(let i=0;i<24;i++){
      const a=i*Math.PI/12,px=x+r*Math.cos(a),pz=z+r*Math.sin(a);if(city.isWalkable(px,pz))return [px,pz];
    }
    return null;
  }
  function moveTo(place){
    const safe=safePoint(place.x,place.z);if(!safe)throw Error('附近没有可步行的落点，请选择另一条街道。');
    if(orbiting){orbiting=false;orbit.enabled=false;onCamera(false);}
    foot.set(safe[0],0,safe[1]);const dx=place.lookX-foot.x,dz=place.lookZ-foot.z;yaw=Math.atan2(-dx,-dz);
    pitch=place.id==='bridge'?.135:place.id==='stadium'?.09:place.id==='pi'?.08:0;
    camera.rotation.set(pitch,yaw,0,'YXZ');camera.position.set(foot.x,city.groundHeight(foot.x,foot.z)+1.67,foot.z);
    anchorX=1e8;gait=0;keys.clear();orbit.target.set(foot.x,0,foot.z);
  }
  function mode(){
    if(!orbiting){
      release();orbiting=true;orbit.enabled=true;
      const towards=new T.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      orbit.target.copy(foot).addScaledVector(towards,260);orbit.target.y=62;
      camera.position.copy(foot).addScaledVector(towards,-560);camera.position.y=315;orbit.update();
    }else{
      const p=safePoint(orbit.target.x,orbit.target.z)||[foot.x,foot.z];orbiting=false;orbit.enabled=false;
      const dx=orbit.target.x-camera.position.x,dz=orbit.target.z-camera.position.z;yaw=Math.atan2(-dx,-dz);pitch=.055;foot.set(p[0],0,p[1]);camera.rotation.set(pitch,yaw,0,'YXZ');
      camera.position.set(foot.x,city.groundHeight(foot.x,foot.z)+1.67,foot.z);
    }onCamera(orbiting);
  }
  function release(){keys.clear();joyX=joyZ=0;drag=null;if(document.pointerLockElement===canvas)document.exitPointerLock();}
  function look(dx,dy){yaw-=dx*.0031;pitch=T.MathUtils.clamp(pitch-dy*.0026,-1.25,1.35);camera.rotation.set(pitch,yaw,0,'YXZ');}
  canvas.addEventListener('pointerdown',e=>{if(!playing||orbiting||blocked||e.button!==0)return;
    canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(captured||!drag||e.pointerId!==drag.id||!playing||orbiting||blocked)return;
    look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>drag=null);
  canvas.addEventListener('dblclick',()=>{if(playing&&!orbiting&&!blocked&&canvas.requestPointerLock)Promise.resolve(canvas.requestPointerLock()).catch(()=>report('拖动鼠标即可环顾四周'));});
  document.addEventListener('pointerlockchange',()=>captured=document.pointerLockElement===canvas);
  document.addEventListener('mousemove',e=>{if(captured&&playing&&!blocked&&!orbiting)look(e.movementX,e.movementY);});
  const movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  window.addEventListener('keydown',e=>{if(!playing||blocked||!movement.includes(e.code))return;e.preventDefault();keys.add(e.code);});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);
  function walking(dt){
    const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joyX;
    const dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+joyZ;
    const len=Math.hypot(dx,dz),fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const dist=dt*(fast?5.0:2.05)/Math.max(1,len),x=(dx*Math.cos(yaw)+dz*Math.sin(yaw))*dist,z=(-dx*Math.sin(yaw)+dz*Math.cos(yaw))*dist;
    function clear(a,b){
      const margin=.22,oldH=city.groundHeight(foot.x,foot.z);
      return city.isWalkable(a,b)&&!vehicles.isBlocked?.(a,b,margin)&&city.isWalkable(a+Math.sign(x)*margin,b+Math.sign(z)*margin)&&city.groundHeight(a,b)<oldH+1.0;
    }
    let moved=0;if(len){const oldX=foot.x,oldZ=foot.z;if(clear(foot.x+x,foot.z+z)){foot.x+=x;foot.z+=z;}
      else{if(clear(foot.x+x,foot.z))foot.x+=x;if(clear(foot.x,foot.z+z))foot.z+=z;}moved=Math.hypot(foot.x-oldX,foot.z-oldZ);}
    gait+=moved*3.5;stepDist+=moved;if(stepDist>(fast?1.15:.88)){step(fast);stepDist=0;}
    const targetY=city.groundHeight(foot.x,foot.z)+1.67+(moved?Math.sin(gait)*.025:0);
    camera.position.set(foot.x,T.MathUtils.lerp(camera.position.y,targetY,1-Math.exp(-14*dt)),foot.z);
  }
  function position(){camera.getWorldDirection(dir);const p=orbiting?orbit.target:camera.position;return {x:p.x,z:p.z,heading:Math.atan2(dir.x,-dir.z)};}
  let previous=performance.now(),slow=0,frames=0,perfTime=0,firstFrames=0;
  function render(now){
    requestAnimationFrame(render);let raw=(now-previous)/1000;previous=now;if(!playing||blocked||document.hidden)return;
    const dt=Math.min(raw,.075);elapsed+=dt;if(orbiting){
      orbit.update();const l=Math.hypot(orbit.target.x,orbit.target.z);if(l>2980){ground.copy(orbit.target);orbit.target.x*=2980/l;orbit.target.z*=2980/l;ground.sub(orbit.target);camera.position.sub(ground);}
    }else walking(dt);
    const focus=orbiting?orbit.target:camera.position;
    if(Math.hypot(focus.x-anchorX,focus.z-anchorZ)>8||elapsed-lastShadow>.35){
      anchorX=focus.x;anchorZ=focus.z;lastShadow=elapsed;sun.target.position.set(anchorX,1,anchorZ);sun.position.copy(sun.target.position).addScaledVector(sunDirection,540);sun.shadow.needsUpdate=true;
    }
    city.update(elapsed,camera);vehicles.update(dt,camera.position);people?.update(dt,camera);film.render(scene,camera);
    if(++firstFrames>24&&raw<1){perfTime+=raw;frames++;if(raw>.055)slow++;}
    if(frames>65){
      if(slow/frames>.62 && ratio>.72){ratio=Math.max(.7,ratio-.15);renderer.setPixelRatio(ratio);resize();}
      frames=slow=perfTime=0;
    }
  }
  requestAnimationFrame(render);
  return {moveTo,position,toggleCamera:mode,get aerial(){return orbiting;},get period(){return skies[skyIndex].name;},
    async nextPeriod(){await setSky((skyIndex+1)%skies.length);return skies[skyIndex].name;},
    setPlaying(v){playing=v;if(!v)release();},setBlocked(v){blocked=v;orbit.enabled=orbiting&&!v;if(v)release();},
    joystick(x,z){joyX=x;joyZ=z;},get count(){return vehicles.count;},camera,renderer,city};
}
