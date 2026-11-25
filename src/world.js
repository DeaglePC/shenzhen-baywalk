import * as T from 'three';
import {skyTextures} from './sky-textures.js';
import {skyFileFor} from './sky-assets.js';
import {skyFade} from './sky-fade.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCity} from './city.js';
import {createVehicles} from './vehicles.js';
import {createPedestrians} from './pedestrians.js';
import {createFilm} from './film.js';
import {createAtmosphereSystem} from './atmosphere-glsl.js';
import {createBayLife} from './bay-life.js';
import {localReflections} from './local-reflections.js';
import {referenceFov} from './taxi-framing.js';
import {createWeather,weatherLighting} from './weather.js';
import {createDroneTour,TOUR_ROUTES} from './drone-tour.js';
import {installMobileTextureGuard,compactMobileScene} from './mobile-compact.js';
import {t} from './i18n.js';

const standardSkies=[
  {key:'sunset',name:'日落',fog:0xb6807e,density:.00020,rotation:3.32,dir:[-.884,.045,-.458],light:0xff805e,power:1.15,env:.62,bg:.43,exposure:.90,night:.19},
  {key:'day',name:'午后',fog:0xcbdce0,density:.00012,rotation:2.1,dir:[.10,.75,-.66],light:0xfff1dc,power:2.95,env:1.08,bg:1.02,exposure:1.10,night:0},
  {key:'dusk',name:'蓝调',fog:0x6a7f98,density:.00017,rotation:3.42,dir:[-.9,.13,-.41],light:0xffb59b,power:.68,env:.50,bg:.76,exposure:1.06,night:.74},
  {key:'night',name:'夜晚',fog:0x2b3c50,density:.00020,rotation:3.42,dir:[-.24,.44,-.86],light:0xc2d8ff,power:.58,env:.46,bg:.18,exposure:1.14,night:1}
];
const parkOvercast={key:'overcast',name:'湖岸阴天',fog:0xb8c0c4,density:.00026,
  rotation:0,dir:[-.36,.83,.4],light:0xf4f4f0,power:.82,env:.96,bg:.98,exposure:1.04,night:0};
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
export async function buildWorld(container,map,{progress,report,step,onCamera,onFrame,onTransition,mouseLook,daylight=false,period,initialClimate={}}){
  const skies=period==='overcast'?[...standardSkies.slice(0,2),parkOvercast,...standardSkies.slice(2)]:standardSkies;
  progress(15,t('loadingWebGL'));await frame();
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isMobile=isIOS||/Android|Mobile|Mobi/i.test(navigator.userAgent)||(matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<=900);
  if(isMobile)installMobileTextureGuard(T);
  const renderer=new T.WebGLRenderer({antialias:!isMobile,powerPreference:'high-performance',alpha:false,logarithmicDepthBuffer:true});
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)||''):'';
  const software=/swiftshader|llvmpipe|software rasterizer/i.test(rendererName);
  const isMac=!isIOS&&(/Macintosh|MacIntel/i.test(navigator.userAgent+' '+navigator.platform)||/Apple/i.test(rendererName));
  const isIntegrated=isMac||/intel|uhd|iris|mali|adreno|radeon\(tm\)\s+graphics/i.test(rendererName);
  const lite=software||isMobile;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=!lite;renderer.shadowMap.type=T.PCFShadowMap;
  const baseRatio=software?Math.min(1,1000/innerWidth):isMobile?Math.min(devicePixelRatio,1):isIntegrated?Math.min(devicePixelRatio,1.15):Math.min(devicePixelRatio,1.45);
  let ratio=baseRatio;renderer.setPixelRatio(ratio);container.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(67,1,.16,32000),canvas=renderer.domElement;
  const basePerfTier=lite?2:isIntegrated?1:0;
  scene.userData.perfTier=basePerfTier;
  let contextLost=false;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;resetMotion();report?.(t('toastContextLost'));});
  canvas.addEventListener('webglcontextrestored',()=>{
    contextLost=false;anchorX=1e8;fade.cancel();probes?.clearSkySeeds();
    probes?.refresh(elapsed,camera.position,true);report?.(t('toastContextRestored'));
  });
  const film=lite?{render:(s,c)=>renderer.render(s,c)}:createFilm(renderer,camera,{samples:isIntegrated?2:4});
  camera.rotation.order='YXZ';canvas.tabIndex=0;canvas.setAttribute('aria-label',t('canvasAria'));
  const hemi=new T.HemisphereLight(0xd2dff0,0xa59886,.64);scene.add(hemi);
  const sun=new T.DirectionalLight();scene.add(sun,sun.target);sun.castShadow=true;
  const shadowSize=isMobile?1024:isIntegrated?1536:2048;
  sun.shadow.mapSize.set(shadowSize,shadowSize);
  Object.assign(sun.shadow.camera,{left:-82,right:82,top:82,bottom:-82,near:.5,far:860});sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.radius=1.45;sun.shadow.bias=-.00012;sun.shadow.normalBias=.019;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  const sunDirection=new T.Vector3(),textures=skyTextures(renderer,{maxWidth:isMobile?1024:0,singleCache:isMobile}),fade=skyFade(renderer);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let city,vehicles,people,probes,skyIndex=0,skyRequest=0,anchorX=1e8,anchorZ=1e8,lastShadow=-1e8;
  let playing=false,orbiting=false,flying=false,pitch=0,yaw=0,elapsed=0,gait=0,stepDist=0,joyX=0,joyZ=0,lift=0;
  const flightVelocity=new T.Vector3(),flightInput=new T.Vector3();
  let atmosphere,atmoGlsl,bayLife,tour,climate={weather:'clear',season:'summer'},requestedClimate={...climate,...initialClimate};
  const selectedSky=skies.findIndex(s=>s.key===period);
  let preferredSky=selectedSky>=0?selectedSky:daylight?1:0;
  let committedSky=preferredSky,captureSkyRequest=0;
  let pictureLens=false,framingFov=0,eyeHeight=1.67;
  const keys=new Set(),foot=new T.Vector3(),dir=new T.Vector3(),ground=new T.Vector3();
  const orbit=new OrbitControls(camera,canvas);orbit.enabled=false;orbit.enableDamping=true;
  canvas.addEventListener('pointerdown',e=>{if(orbit.enabled)orbit.rotateSpeed=e.pointerType==='mouse'?mouseLook.sensitivity:1;},{capture:true});
  orbit.minDistance=28;orbit.maxDistance=3100;orbit.maxPolarAngle=Math.PI*.478;orbit.minPolarAngle=.09;orbit.screenSpacePanning=false;orbit.dampingFactor=.095;
  let drag=null,blocked=false,lastProbeKey='';
  async function setSky({interactive=false,label='',deferProbes=false}={}){
    const token=++skyRequest,next={...requestedClimate};
    const index=next.weather==='aurora'?skies.length-1:preferredSky,sky=skies[index],light=weatherLighting(next.weather);
    const hdr=skyFileFor(sky.key);
    const probeKey=sky.key+':'+next.weather;
    const needsProbe=!!probes&&probeKey!==lastProbeKey;
    captureSkyRequest=0;
    onTransition?.({active:false});
    if(interactive&&index===skyIndex&&next.weather===climate.weather&&next.season===climate.season)return;
    const notice=interactive?setTimeout(()=>{
      if(token===skyRequest)onTransition?.({active:true,label});
    },200):null;
    try{
      const texture=await textures.load(hdr);if(token!==skyRequest)return;
      clearTimeout(notice);
      if(interactive&&playing&&!blocked&&!manualClock&&!document.hidden&&!contextLost&&!reducedMotion.matches){
        captureSkyRequest=token;
        await frame();
        if(token!==skyRequest)return;
        captureSkyRequest=0;
      }else fade.cancel();
      committedSky=preferredSky;
      climate=next;skyIndex=index;scene.background=texture;scene.environment=texture;scene.backgroundRotation.y=sky.rotation;scene.environmentRotation.y=sky.rotation;
      scene.backgroundIntensity=sky.bg*light.background;scene.environmentIntensity=sky.env*light.environment;renderer.toneMappingExposure=sky.exposure;
      const afterDark=sky.key==='night',aurora=next.weather==='aurora';
      const fog=new T.Color(light.fog??sky.fog);
      if(afterDark&&!aurora&&light.fog!=null)fog.lerp(new T.Color(sky.fog),.93);
      scene.fog=new T.FogExp2(fog,light.density??sky.density);
      const hemiPalette={
        day:[0xdeecff,0xb8ae9c,.86],
        sunset:[0xe8c2bf,0x997f79,.62],
        overcast:[0xe0e6ec,0xb2aa9d,.84],
        dusk:[0x9fb8dc,0x6b6764,.56],
        night:[0x88a8d8,0x5c574f,.62]
      }[sky.key]||[0xd2dff0,0xa59886,.76];
      hemi.color.setHex(hemiPalette[0]);hemi.groundColor.setHex(hemiPalette[1]);
      hemi.intensity=hemiPalette[2]*light.hemi;
      sun.color.setHex(({snow:0xe0edff,rain:0xc7d3de,aurora:0xb0c6ee})[next.weather]??sky.light);
      sun.intensity=sky.power*light.sun;sunDirection.fromArray(sky.dir).normalize();
      const night=Math.max(sky.night,light.night);
      atmosphere?.set(next,{period:sky.key,fog:fog.getHex()});
      atmoGlsl?.setSky({sunDir:sunDirection,sunColor:sun.color,period:sky.key,weather:next.weather,night});
      bayLife?.setSky({sunDir:sunDirection,sunColor:sun.color,weather:next.weather,season:next.season,night});
      film.setGrade?.(sky.key,next.weather);
      city?.setSun?.(sunDirection,sun.color);city?.setNight?.(night,next.weather==='aurora'?.57:1);vehicles?.setNight(night,next.weather);anchorX=1e8;
      if(needsProbe){
        probes.refresh(elapsed,camera.position,interactive||deferProbes);
        lastProbeKey=probeKey;
      }
    }catch(error){
      if(token!==skyRequest)return;
      requestedClimate={...climate};preferredSky=committedSky;
      throw error;
    }finally{
      clearTimeout(notice);
      if(interactive&&token===skyRequest)onTransition?.({active:false});
    }
  }
  function lens(){
    camera.fov=pictureLens?(framingFov?T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(framingFov*.5))*Math.max(1,1.44/camera.aspect))):referenceFov(camera.aspect)):67;
    camera.updateProjectionMatrix();
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;lens();}
  new ResizeObserver(resize).observe(container);resize();const initialSky=setSky();
  const idle=fn=>'requestIdleCallback' in window?requestIdleCallback(fn,{timeout:5000}):setTimeout(fn,1800);
  async function warmRemainingSkies(){
    const initialHdr=skyFileFor(skies[skyIndex].key);
    for(const hdr of new Set(skies.map(s=>skyFileFor(s.key)))){
      if(navigator.connection?.saveData)return;
      if(hdr===initialHdr)continue;
      try{
        const texture=await textures.load(hdr,'low');
        await new Promise(idle);
        if(!contextLost&&texture!==scene.environment)textures.warm(texture);
      }catch{/* A selection retries any failed background load. */}
    }
  }
  if(!isMobile&&!isIntegrated)initialSky.then(()=>idle(warmRemainingSkies),()=>{});
  progress(30,t('loadingCity'));await frame();await frame();
  city=createCity(scene,map,{renderer,camera,quality:lite?'low':'balanced'});progress(62,t('loadingVehicles'));await frame();
  const compileMaterials=objects=>film.compile?.(objects,camera,scene)??renderer.compileAsync(objects,camera,scene);
  city.root.userData.prepareTreeMaterials=compileMaterials;
  [vehicles]=await Promise.all([createVehicles(scene,map,{low:lite,signals:city.signals,stadiumAreas:city.stadiumAreas,walkers(){
    const walkers=people?.positions()??[];
    if(playing&&!blocked&&!orbiting&&!flying&&!tour?.active)walkers.push({x:foot.x,z:foot.z,y:foot.y});
    return walkers;
  }}),initialSky,city.ready]);
  progress(84,t('loadingProbes'));await frame();
  atmosphere=createWeather(scene,city,{low:lite,vehicles});
  atmoGlsl=createAtmosphereSystem(scene,city);
  bayLife=createBayLife(scene,{low:lite});
  tour=createDroneTour(city);
  probes=isMobile?{refresh(){},step(){},clearSkySeeds(){},busy:false,dispose(){}}:localReflections(renderer,scene,city,sun,sunDirection,lite||isIntegrated,vehicles);
  if(isMobile)compactMobileScene(scene);
  await setSky({deferProbes:true});
  progress(94,t('loadingWater'));await frame();
  const pedestriansReady=createPedestrians(scene,map,city,vehicles.isBlocked).then(p=>{people=p;if(isMobile)compactMobileScene(scene);}).catch(err=>console.warn('行人资源',err));
  idle(()=>city.getWeatherCover());
  function safePoint(x,z,ceiling=Infinity){
    const available=(a,b)=>city.isWalkable(a,b,ceiling)&&!vehicles.isBlocked(a,b,.23,city.groundHeight(a,b,ceiling));
    if(available(x,z))return [x,z];
    for(let r=.65;r<=95;r*=1.45)for(let i=0;i<24;i++){
      const a=i*Math.PI/12,px=x+r*Math.cos(a),pz=z+r*Math.sin(a);if(available(px,pz))return [px,pz];
    }
    return null;
  }
  function moveTo(place){
    const safe=safePoint(place.x,place.z,place.floorLimit);if(!safe)throw Error(t('errNoWalkable'));
    if(orbiting||flying||tour?.active){tour?.stop();resetMotion();orbiting=flying=false;orbit.enabled=false;onCamera('walk');}
    foot.set(safe[0],0,safe[1]);const dx=place.lookX-foot.x,dz=place.lookZ-foot.z;yaw=Math.atan2(-dx,-dz);
    pitch=place.id==='bridge'?.135:place.id==='stadium'?.09:place.id==='pi'?.08:0;
    const floor=foot.y=city.groundHeight(foot.x,foot.z,place.floorLimit);
    pictureLens=!!(place.photo||place.portrait);framingFov=place.portrait?.fov??0;
    eyeHeight=pictureLens?(place.photo??place.portrait).height-floor:1.67;lens();
    camera.position.set(foot.x,floor+eyeHeight,foot.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    if(place.photo){
      const target=camera.position.clone().add(new T.Vector3(...place.photo.direction));
      camera.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(camera.position,target,new T.Vector3(...place.photo.up)));
      pitch=camera.rotation.x;yaw=camera.rotation.y;
    }else if(place.portrait){
      camera.lookAt(...place.portrait.target);pitch=camera.rotation.x;yaw=camera.rotation.y;
    }
    anchorX=1e8;gait=0;keys.clear();orbit.target.set(foot.x,0,foot.z);
  }
  function land(x,z){
    const ceiling=(flying||tour?.active)?camera.position.y+.15:Infinity,point=safePoint(x,z,ceiling)||[foot.x,foot.z];
    tour?.stop();
    resetMotion();orbiting=flying=false;orbit.enabled=false;pictureLens=false;eyeHeight=1.67;pitch=.055;lens();mouseLook.engage();
    foot.set(point[0],0,point[1]);camera.rotation.set(pitch,yaw,0,'YXZ');
    foot.y=city.groundHeight(foot.x,foot.z,ceiling);camera.position.set(foot.x,foot.y+eyeHeight,foot.z);
    onCamera('walk');
  }
  function drone(pose){
    if(flying&&!pose){land(camera.position.x,camera.position.z);return;}
    const fromOrbit=orbiting,fromTour=!!tour?.active;
    if(fromTour)tour.stop();
    resetMotion();orbit.enabled=false;orbiting=false;flying=true;pictureLens=!!pose?.fov;framingFov=pose?.fov??0;eyeHeight=1.67;lens();
    if(!pose)mouseLook.engage();
    if(pose){
      camera.position.fromArray(pose.eye);camera.lookAt(...pose.target);
    }else if(!fromOrbit&&!fromTour){
      camera.position.y+=4;
    }
    yaw=camera.rotation.y;pitch=camera.rotation.x;camera.rotation.set(pitch,yaw,0,'YXZ');
    canvas.focus({preventScroll:true});anchorX=Infinity;onCamera('drone');
  }
  function startTour(routeId,opts={}){
    release();orbit.enabled=false;orbiting=false;flying=false;pictureLens=false;framingFov=0;eyeHeight=1.67;
    tour.start(camera,routeId,opts.progress??0);
    if(opts.speed!=null)tour.setSpeed(opts.speed);
    yaw=camera.rotation.y;pitch=camera.rotation.x;
    anchorX=Infinity;onCamera('tour');
  }
  function stopTour({toDrone=false}={}){
    if(!tour?.active)return;
    if(toDrone){drone();return;}
    land(camera.position.x,camera.position.z);
  }
  function toggleTour(routeId){
    if(tour?.active&&(!routeId||tour.routeId===routeId)){stopTour();return false;}
    startTour(routeId);return true;
  }
  function mode(){
    if(pictureLens){pictureLens=false;eyeHeight=1.67;lens();}
    if(tour?.active){stopTour();return;}
    if(flying){land(camera.position.x,camera.position.z);return;}
    if(!orbiting){
      release();orbiting=true;orbit.enabled=true;
      const towards=new T.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      orbit.target.copy(foot).addScaledVector(towards,260);orbit.target.y=62;
      camera.position.copy(foot).addScaledVector(towards,-560);camera.position.y=315;orbit.update();onCamera('orbit');
    }else{
      const dx=orbit.target.x-camera.position.x,dz=orbit.target.z-camera.position.z;yaw=Math.atan2(-dx,-dz);land(orbit.target.x,orbit.target.z);
    }
  }
  function resetMotion(){keys.clear();joyX=joyZ=lift=0;flightVelocity.set(0,0,0);drag=null;}
  function release(){resetMotion();mouseLook.release();}
  function look(dx,dy){yaw-=dx*.0031;pitch=T.MathUtils.clamp(pitch-dy*.0026,flying?-1.55:-1.25,flying?1.55:1.35);camera.rotation.set(pitch,yaw,0,'YXZ');}
  canvas.addEventListener('pointerdown',e=>{if(!playing||orbiting||tour?.active||blocked||e.button!==0)return;
    canvas.focus({preventScroll:true});
    if(e.pointerType==='mouse'){mouseLook.engage();return;}
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id||!playing||orbiting||tour?.active||blocked)return;
    look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>drag=null);
  mouseLook.bind((dx,dy)=>{if(playing&&!blocked&&!orbiting&&!tour?.active)look(dx,dy);});
  const movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  const vertical=['Space','KeyE','KeyQ','KeyC'];
  let lastCtrlHint=-1e8;
  window.addEventListener('keydown',e=>{
    if(!playing||blocked||orbiting||tour?.active||e.defaultPrevented||e.metaKey||e.altKey)return;
    if(flying&&(e.code==='ControlLeft'||e.code==='ControlRight')){
      if(!e.repeat&&performance.now()-lastCtrlHint>4000){
        lastCtrlHint=performance.now();
        report?.(t('toastCtrlHint'));
      }
      return;
    }
    if(e.ctrlKey)return;
    if(e.code==='Space'&&e.target.closest?.('button,input,select'))return;
    if(movement.includes(e.code)||(flying&&vertical.includes(e.code))){e.preventDefault();keys.add(e.code);}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);
  window.addEventListener('beforeunload',e=>{if(playing&&flying){e.preventDefault();e.returnValue='';}});
  function walking(dt){
    const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joyX;
    const dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+joyZ;
    const len=Math.hypot(dx,dz),fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const dist=dt*(fast?5.0:2.05)/Math.max(1,len),x=(dx*Math.cos(yaw)+dz*Math.sin(yaw))*dist,z=(-dx*Math.sin(yaw)+dz*Math.cos(yaw))*dist;
    function clear(a,b){
      const margin=.22,ceiling=foot.y+.95;
      return city.isWalkable(a,b,ceiling)&&!vehicles.isBlocked(a,b,margin,city.groundHeight(a,b,ceiling))&&city.isWalkable(a+Math.sign(x)*margin,b+Math.sign(z)*margin,ceiling)&&city.groundHeight(a,b,ceiling)<foot.y+1.0;
    }
    let moved=0;if(len){const oldX=foot.x,oldZ=foot.z;if(clear(foot.x+x,foot.z+z)){foot.x+=x;foot.z+=z;}
      else{if(clear(foot.x+x,foot.z))foot.x+=x;if(clear(foot.x,foot.z+z))foot.z+=z;}moved=Math.hypot(foot.x-oldX,foot.z-oldZ);}
    gait+=moved*3.5;stepDist+=moved;if(stepDist>(fast?1.15:.88)){step(fast);stepDist=0;}
    if(moved)eyeHeight=1.67;
    foot.y=city.groundHeight(foot.x,foot.z,foot.y+.95);
    const targetY=foot.y+eyeHeight+(moved?Math.sin(gait)*.025:0);
    camera.position.set(foot.x,T.MathUtils.lerp(camera.position.y,targetY,1-Math.exp(-14*dt)),foot.z);
  }
  function flight(dt){
    const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joyX;
    const back=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+joyZ;
    const climb=Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ')||keys.has('KeyC'))+lift;
    flightInput.set(right*Math.cos(yaw)+back*Math.sin(yaw),climb,-right*Math.sin(yaw)+back*Math.cos(yaw));
    const horizontal=Math.hypot(flightInput.x,flightInput.z);
    if(horizontal>1){flightInput.x/=horizontal;flightInput.z/=horizontal;}
    const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const clearance=Math.max(0,camera.position.y-city.groundHeight(camera.position.x,camera.position.z));
    const speed=(sprint?3.6:1)*T.MathUtils.clamp(12+clearance*.30,12,56);
    flightInput.x*=speed;flightInput.z*=speed;
    const altitudeFactor=T.MathUtils.smoothstep(clearance,4,100);
    const liftSpeed=climb<0?T.MathUtils.lerp(14,40,altitudeFactor):T.MathUtils.lerp(18,50,altitudeFactor);
    flightInput.y=T.MathUtils.clamp(climb,-1,1)*liftSpeed*(sprint?2:1);
    flightVelocity.lerp(flightInput,1-Math.exp(-dt*8));
    const p=camera.position,travel=flightVelocity.length()*dt;
    if(travel>.001){
      const slices=Math.ceil(travel/1.1),sub=dt/slices;
      for(let i=0;i<slices;i++){
        const x=p.x+flightVelocity.x*sub,y=p.y+flightVelocity.y*sub,z=p.z+flightVelocity.z*sub;
        if(!city.flightBlocked(x,y,z)){p.set(x,y,z);continue;}
        if(!city.flightBlocked(p.x,y,p.z))p.y=y;else flightVelocity.y=0;
        if(!city.flightBlocked(x,p.y,p.z))p.x=x;else flightVelocity.x=0;
        if(!city.flightBlocked(p.x,p.y,z))p.z=z;else flightVelocity.z=0;
      }
    }
    const r=Math.hypot(p.x,p.z);
    const radius=map.radius+135*T.MathUtils.smoothstep(p.z/Math.max(1,r),.97,.996);
    if(r>radius){p.x*=radius/r;p.z*=radius/r;}
    const boundedHeight=T.MathUtils.clamp(p.y,city.groundHeight(p.x,p.z,p.y+.1)+.8,1200);
    if(boundedHeight!==p.y){p.y=boundedHeight;flightVelocity.y=0;}
  }
  function position(){camera.getWorldDirection(dir);const p=orbiting?orbit.target:camera.position;return {x:p.x,z:p.z,height:camera.position.y,heading:Math.atan2(dir.x,-dir.z)};}
  let previous=performance.now(),showTime=0,slow=0,frames=0,perfTime=0,firstFrames=0,sprayLevel=0,smoothWindows=0,lastFrameMs=16.7,manualClock=false;
  function tickScene(dt,raw){
    elapsed+=dt;showTime+=Math.min(raw,.5);if(tour?.active){
      tour.update(dt,camera);yaw=camera.rotation.y;pitch=camera.rotation.x;
    }else if(orbiting){
      orbit.update();const l=Math.hypot(orbit.target.x,orbit.target.z);if(l>2980){ground.copy(orbit.target);orbit.target.x*=2980/l;orbit.target.z*=2980/l;ground.sub(orbit.target);camera.position.sub(ground);}
    }else if(flying){
      const flightTime=Math.min(raw,.25),steps=Math.max(1,Math.ceil(flightTime/.05));
      for(let i=0;i<steps;i++)flight(flightTime/steps);
    }else walking(dt);
    probes.step(elapsed,camera.position,raw*1000);
    const focus=orbiting?orbit.target:camera.position;
    if(Math.hypot(focus.x-anchorX,focus.z-anchorZ)>6){
      anchorX=focus.x;anchorZ=focus.z;lastShadow=elapsed;sun.target.position.set(anchorX,1,anchorZ);sun.position.copy(sun.target.position).addScaledVector(sunDirection,540);sun.shadow.needsUpdate=true;
    }
    city.update(elapsed,camera,showTime);vehicles.update(dt,camera.position);people?.update(dt,camera);atmosphere.update(elapsed,dt,camera);atmoGlsl?.update(elapsed);bayLife?.update(elapsed);
    if(flying||tour?.active){
      const {x,y,z}=camera.position;
      const seaSpray=z>620?(1-T.MathUtils.smoothstep(y,1.4,4.5))*.32:0;
      const rain=climate.weather==='rain'&&!(city.getWeatherCover().roofAt(x,z)>y+.5);
      const exposure=Math.max(seaSpray,rain?.55:0);
      sprayLevel=T.MathUtils.damp(sprayLevel,exposure,1.6,dt);
    }else{
      sprayLevel=0;
    }
    camera.updateMatrixWorld();city.captureStreet(renderer,scene,camera,elapsed);film.render(scene,camera,elapsed,sprayLevel);
    fade.render();
    if(captureSkyRequest){fade.capture();captureSkyRequest=0;}
    onFrame?.(performance.now());
  }
  function render(now){
    requestAnimationFrame(render);if(manualClock)return;let raw=(now-previous)/1000;previous=now;if(!playing||blocked||document.hidden||contextLost)return;
    const dt=Math.min(raw,.075);
    tickScene(dt,raw);
    lastFrameMs=raw*1000;
    if(!probes?.busy&&++firstFrames>16&&raw<1){perfTime+=raw;frames++;if(raw>.034)slow++;}
    if(frames>28){
      const avgMs=(perfTime/frames)*1000;
      if((avgMs>28||slow/frames>.45)){
        if(ratio>.75){
          ratio=Math.max(.75,+(ratio-.15).toFixed(2));renderer.setPixelRatio(ratio);resize();
        }
        if(scene.userData.perfTier<2){
          scene.userData.perfTier++;
          if(scene.userData.perfTier>=2)film.setFast?.(true);
        }
        smoothWindows=0;
      }else if(avgMs<17 && slow===0){
        if(++smoothWindows>=2){
          if(ratio<baseRatio){
            ratio=Math.min(baseRatio,+(ratio+.1).toFixed(2));renderer.setPixelRatio(ratio);resize();
          }else if(scene.userData.perfTier>basePerfTier){
            scene.userData.perfTier--;
            if(scene.userData.perfTier<2)film.setFast?.(false);
          }
          smoothWindows=0;
        }
      }else smoothWindows=0;
      frames=slow=perfTime=0;
    }
  }
  requestAnimationFrame(render);
  let viewPrepared=false;
  async function prepareView(){
    vehicles.update(0,camera.position);
    if(viewPrepared)return;
    await pedestriansReady;
    city.update(elapsed,camera);
    // Queue the programs together so the driver can link them in parallel
    // before the first visible frame asks for uniforms one material at a time.
    await compileMaterials(scene);
    viewPrepared=true;
  }
  const api={moveTo,position,releaseLook:mouseLook.release,prepareView,toggleCamera:mode,toggleDrone:drone,
    startTour,stopTour,toggleTour,tourRoutes:TOUR_ROUTES,
    setTourPaused(v){tour?.setPaused(v);},
    setTourSpeed(v){tour?.setSpeed(v);},
    setTourProgress(u){tour?.setProgress(u,camera);yaw=camera.rotation.y;pitch=camera.rotation.x;},
    get tourState(){return tour?.state()??null;},
    get touring(){return !!tour?.active;},
    get aerial(){return orbiting;},get flying(){return flying;},
    setManualClock(v){manualClock=!!v;previous=performance.now();},
    stepFrame(dt=1/30){tickScene(dt,dt);},
    get period(){return climate.weather==='aurora'?'极光夜':skies[skyIndex].name;},
    get periodKey(){return climate.weather==='aurora'?'aurora':skies[skyIndex].key;},
    get climate(){return {...climate};},
    get sheltered(){const p=camera.position;return (climate.weather==='rain'||climate.weather==='snow')&&city.getWeatherCover().roofAt(p.x,p.z)>p.y+.5;},
    async setClimate(patch,label='',{immediate=false}={}){requestedClimate={...requestedClimate,...patch};await setSky({interactive:!immediate,label});},
    async setPeriod(key,label='',{immediate=false}={}){
      const idx=skies.findIndex(s=>s.key===key);
      if(idx<0)return this.period;
      preferredSky=idx;
      if(requestedClimate.weather==='aurora')requestedClimate={...requestedClimate,weather:'clear'};
      await setSky({interactive:!immediate,label:label||skies[idx].name});
      return this.period;
    },
    async nextPeriod(label=''){if(requestedClimate.weather!=='aurora'){preferredSky=(preferredSky+1)%skies.length;await setSky({interactive:true,label:label||skies[preferredSky].name});}return this.period;},
    async nightView(){if(preferredSky!==skies.length-1){preferredSky=skies.length-1;await setSky({interactive:true,label:skies[preferredSky].name});}},
    toggleHeadlights(){return vehicles?.toggleHeadlights()??false;},
    setHeadlightsMode(mode){return vehicles?.setHeadlightsMode(mode)??false;},
    get headlightsOn(){return vehicles?.headlightsOn??false;},
    setMoonVisible(v){return atmosphere?.setMoonVisible(v)??true;},
    toggleMoon(){return atmosphere?.setMoonVisible(!atmosphere.moonVisible)??true;},
    get moonVisible(){return atmosphere?.moonVisible??true;},
    setPlaying(v){playing=v;if(!v)release();},setBlocked(v){blocked=v;orbit.enabled=orbiting&&!v;if(v)release();},
    joystick(x,z){joyX=x;joyZ=z;},elevate(v){lift=v;},get count(){return vehicles.count;},
    perfStats(){const s=film.lastStats;return {pixelRatio:ratio,frameMs:+lastFrameMs.toFixed(2),calls:s?s.calls:renderer.info.render.calls,triangles:s?s.triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},
    camera,renderer,city};
  if(new URLSearchParams(location.search).has('qa'))window.__baywalk=api;
  return api;
}
