import * as T from 'three';

// Sample the actual district at tower, bridge and car-body heights.
export function localReflections(renderer,scene,city,sun,direction,low,vehicles){
  const size=low?128:256;
  const cube=new T.WebGLCubeRenderTarget(size,{type:T.HalfFloatType,generateMipmaps:false});
  const camera=new T.CubeCamera(.32,14000,cube),filter=new T.PMREMGenerator(renderer);
  const paintCube=low?cube:new T.WebGLCubeRenderTarget(512,{type:T.HalfFloatType,generateMipmaps:false});
  const paintCamera=low?camera:new T.CubeCamera(.32,14000,paintCube);
  const captures=[
    {key:'district',at:new T.Vector3(-241,87,-425),target:null},
    {key:'bridge',at:new T.Vector3(215.2,4.25,136),target:null},
    {key:'library',at:new T.Vector3(-432,3.1,232),target:null},
    ...(low?[]:[{key:'gallery',at:new T.Vector3(-344,2.8,430),target:null}]),
    {key:'street',at:new T.Vector3(-126.8,1.44,-420.7),target:null}
  ];
  const waterProxy=new T.MeshStandardMaterial({color:0x2b7e86,roughness:.22,metalness:.26});
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const assigned=new WeakSet();
  let runToken=0;
  function collectTargets(){
    const materials=new Set(),omit=[],tower=[];
    scene.traverse(o=>{
      for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(m.userData.cityProbe)materials.add(m);
      if(o.userData.excludeFromProbe||o.name==='Shenzhen road traffic')omit.push(o);
      if(o.userData.excludeFromDistrictProbe)tower.push(o);
    });
    return {materials,omit,tower};
  }
  function bindMaterials(materials){
    for(const m of materials){
      const key=m.userData.cityProbe;
      const tex=scene.userData[key+'Probe']??(key==='gallery'?scene.userData.libraryProbe:null);
      if(!tex)continue;
      const first=!assigned.has(m)&&!m.envMap;
      m.envMap=tex;m.envMapRotation?.set(0,0,0);
      if(first){assigned.add(m);m.needsUpdate=true;}
    }
  }
  function captureOne(capture,time,omit,tower,originalWater){
    const street=capture.key==='street',eye=street?paintCamera:camera,buffer=street?paintCube:cube;
    eye.position.copy(capture.at);eye.updateMatrixWorld(true);
    city.update(time,eye);
    if(street){
      // Populate the surrounding real cars. Parked hero remains excluded from
      // its own reflection; its exact spot is also empty in the instanced fleet.
      vehicles.update(0,capture.at);
      for(const o of omit)o.visible=o.name==='Shenzhen road traffic';
    }
    if(city.water)city.water.material=waterProxy;
    sun.target.position.set(capture.at.x,0,capture.at.z);sun.position.copy(sun.target.position).addScaledVector(direction,540);
    sun.shadow.needsUpdate=true;
    const suppress=capture.key==='district'?tower:[],visible=suppress.map(o=>o.visible);
    suppress.forEach(o=>o.visible=false);
    try{
      buffer.texture.generateMipmaps=false;eye.update(renderer,scene);
      capture.target=filter.fromCubemap(buffer.texture,capture.target);
      capture.target.texture.userData.capturePosition=capture.at.clone();
      scene.userData[capture.key+'Probe']=capture.target.texture;
    }finally{
      suppress.forEach((o,i)=>o.visible=visible[i]);
      if(city.water)city.water.material=originalWater;
    }
  }
  async function refresh(time,options={}){
    const token=++runToken;
    const sliced=!!options.sliced;
    const {materials,omit,tower}=collectTargets();
    // Avoid setting m.envMap = null with needsUpdate = true (which triggers massive
    // WebGL shader recompilations). Temporarily bind scene.environment instead.
    if(scene.environment){
      for(const m of materials){if(m.envMap)m.envMap=scene.environment;}
    }
    // Always prioritize district + nearest local probe first so interactive switches
    // finish visibly in 1-2 frames, while distant probes refresh silently in the background.
    const district=captures.find(c=>c.key==='district');
    const locals=captures.filter(c=>c!==district);
    if(options.cameraPos)locals.sort((a,b)=>a.at.distanceToSquared(options.cameraPos)-b.at.distanceToSquared(options.cameraPos));
    const ordered=district?[district,...locals]:locals;
    const immediateCount=sliced?Math.min(2,ordered.length):ordered.length;
    const originalWater=city.water?.material;
    const oldSun=sun.position.clone(),oldTarget=sun.target.position.clone();
    function runCapture(capture){
      const hidden=omit.map(o=>o.visible);
      scene.userData.capturingProbe=true;
      omit.forEach(o=>o.visible=false);
      try{
        captureOne(capture,time,omit,tower,originalWater);
      }finally{
        scene.userData.capturingProbe=false;
        omit.forEach((o,j)=>o.visible=hidden[j]);
        if(city.water)city.water.material=originalWater;
        sun.position.copy(oldSun);sun.target.position.copy(oldTarget);sun.shadow.needsUpdate=true;
      }
      bindMaterials(materials);
    }
    for(let i=0;i<immediateCount;i++){
      if(token!==runToken||options.shouldCancel?.())return false;
      runCapture(ordered[i]);
      options.onStep?.(i+1,immediateCount);
      if(sliced&&i+1<immediateCount)await nextFrame();
    }
    // Silently update remaining distant local probes spaced across frames in the background.
    if(sliced&&immediateCount<ordered.length&&token===runToken){
      (async()=>{
        for(let i=immediateCount;i<ordered.length;i++){
          for(let f=0;f<5;f++){
            await nextFrame();
            if(token!==runToken||options.shouldCancel?.())return;
          }
          runCapture(ordered[i]);
        }
      })();
    }
    return token===runToken;
  }
  return {refresh,cancel(){runToken++;},dispose(){runToken++;if(paintCube!==cube)paintCube.dispose();cube.dispose();filter.dispose();waterProxy.dispose();captures.forEach(p=>p.target?.dispose());}};
}
