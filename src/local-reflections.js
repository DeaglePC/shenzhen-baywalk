import * as T from 'three';

// Sample the actual district at tower, bridge and car-body heights.
export function localReflections(renderer,scene,city,sun,direction,low,vehicles){
  const size=low?128:256;
  const cube=new T.WebGLCubeRenderTarget(size,{type:T.HalfFloatType,generateMipmaps:false});
  const camera=new T.CubeCamera(.32,14000,cube),filter=new T.PMREMGenerator(renderer);
  const paintCube=low?cube:new T.WebGLCubeRenderTarget(512,{type:T.HalfFloatType,generateMipmaps:false});
  const paintCamera=low?camera:new T.CubeCamera(.32,14000,paintCube);
  // Reused output targets need the PMREM working buffers for their own size.
  const paintFilter=low?filter:new T.PMREMGenerator(renderer);
  const captures=[
    {key:'district',at:new T.Vector3(-241,87,-425),target:null},
    {key:'bridge',at:new T.Vector3(215.2,4.25,136),target:null},
    {key:'library',at:new T.Vector3(-432,3.1,232),target:null},
    ...(low?[]:[{key:'gallery',at:new T.Vector3(-344,2.8,430),target:null}]),
    {key:'street',at:new T.Vector3(-126.8,1.44,-420.7),target:null}
  ];
  const waterProxy=new T.MeshStandardMaterial({color:0x2b7e86,roughness:.22,metalness:.26});
  const skyIntensities=new Map(),skyTargets=[];
  let pending=null,nextCaptureTime=0;
  function collectTargets(){
    const materials=new Set(),omit=[],tower=[];
    scene.traverse(o=>{
      for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(m.userData.cityProbe)materials.add(m);
      if(o.userData.excludeFromProbe||o.name==='Shenzhen road traffic')omit.push(o);
      if(o.userData.excludeFromDistrictProbe)tower.push(o);
    });
    return {materials,omit,tower};
  }
  function bindMaterials(materials,capture){
    for(const m of materials){
      const key=low&&m.userData.cityProbe==='gallery'?'library':m.userData.cityProbe;
      if(key!==capture.key)continue;
      m.envMap=capture.target.texture;m.envMapRotation?.set(0,0,0);
      if(skyIntensities.has(m)){
        m.envMapIntensity=skyIntensities.get(m);skyIntensities.delete(m);
      }
    }
    if(!skyIntensities.size)skyTargets.splice(0).forEach(target=>target.dispose());
  }
  function seedFromSky(materials){
    // Three includes the PMREM height in its shader key. Start with sky light
    // in the same layout as each final probe so publishing it only swaps a sampler.
    const sky=scene.environment,textures=new Map(),oldTargets=skyTargets.splice(0);
    for(const capture of captures)delete scene.userData[capture.key+'Probe'];
    for(const m of materials){
      const buffer=m.userData.cityProbe==='street'?paintCube:cube;
      if(!textures.has(buffer)){
        let texture=sky;
        if(sky.image.width/4!==buffer.width){
          buffer.fromEquirectangularTexture(renderer,sky);
          const target=(buffer===paintCube?paintFilter:filter).fromCubemap(buffer.texture);
          skyTargets.push(target);texture=target.texture;
        }
        textures.set(buffer,texture);
      }
      if(!skyIntensities.has(m))skyIntensities.set(m,m.envMapIntensity);
      m.envMapIntensity=scene.environmentIntensity;
      m.envMap=textures.get(buffer);m.envMapRotation?.copy(scene.environmentRotation);
    }
    oldTargets.forEach(target=>target.dispose());
  }
  function renderFace(capture,face,time,targets){
    const street=capture.key==='street',eye=street?paintCamera:camera,buffer=street?paintCube:cube;
    const target=renderer.getRenderTarget(),activeFace=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    const originalWater=city.water?.material,oldSun=sun.position.clone(),oldTarget=sun.target.position.clone();
    const omit=capture.key==='district'?[...targets.omit,...targets.tower]:targets.omit;
    const visibility=omit.map(o=>o.visible),xr=renderer.xr.enabled;
    const headlightPower=vehicles.headlightSpots.map(light=>light.intensity);
    scene.userData.capturingProbe=true;
    try{
      eye.position.copy(capture.at);
      if(eye.coordinateSystem!==renderer.coordinateSystem){
        eye.coordinateSystem=renderer.coordinateSystem;eye.updateCoordinateSystem();
      }
      eye.updateMatrixWorld(true);
      city.update(time,eye);
      if(street)vehicles.update(0,capture.at);
      // Moving headlights should not leave a lasting reflection in the cube.
      for(const light of vehicles.headlightSpots)light.intensity=0;
      omit.forEach(o=>o.visible=street&&o.name==='Shenzhen road traffic');
      if(city.water)city.water.material=waterProxy;
      sun.target.position.set(capture.at.x,0,capture.at.z);
      sun.position.copy(sun.target.position).addScaledVector(direction,540);
      sun.shadow.needsUpdate=true;
      renderer.xr.enabled=false;
      renderer.setRenderTarget(buffer,face);
      renderer.render(scene,eye.children[face]);
      if(face===5){
        capture.target=(street?paintFilter:filter).fromCubemap(buffer.texture,capture.target);
        capture.target.texture.userData.capturePosition=capture.at.clone();
        scene.userData[capture.key+'Probe']=capture.target.texture;
        bindMaterials(targets.materials,capture);
      }
    }finally{
      vehicles.headlightSpots.forEach((light,i)=>light.intensity=headlightPower[i]);
      renderer.setRenderTarget(target,activeFace,mip);renderer.xr.enabled=xr;
      omit.forEach((o,i)=>o.visible=visibility[i]);
      if(city.water)city.water.material=originalWater;
      sun.position.copy(oldSun);sun.target.position.copy(oldTarget);sun.shadow.needsUpdate=true;
      scene.userData.capturingProbe=false;
    }
  }

  function enqueue(captures,targets){
    pending={remaining:captures.slice(),capture:null,face:0,targets};
    nextCaptureTime=0;
  }
  function step(time,position){
    if(!pending)return;
    if(!nextCaptureTime)nextCaptureTime=performance.now()+240;
    if(performance.now()<nextCaptureTime)return;
    const job=pending;
    if(!job.capture){
      job.remaining.sort((a,b)=>a.at.distanceToSquared(position)-b.at.distanceToSquared(position));
      job.capture=job.remaining.shift();job.face=0;
    }
    renderFace(job.capture,job.face++,time,job.targets);
    if(job.face===6){
      job.capture=null;
      if(!job.remaining.length)pending=null;
    }
    nextCaptureTime=performance.now()+60;
  }
  function refresh(time,position,deferred){
    // Replace the previous capture only after the requested sky has loaded.
    pending=null;
    const targets=collectTargets();
    seedFromSky(targets.materials);
    if(deferred){enqueue(captures,targets);return;}
    const others=captures.slice(1);
    others.sort((a,b)=>a.at.distanceToSquared(position)-b.at.distanceToSquared(position));
    for(const capture of [captures[0],...others]){
      for(let face=0;face<6;face++)renderFace(capture,face,time,targets);
    }
  }
  return {refresh,step,dispose(){
    pending=null;
    skyTargets.forEach(t=>t.dispose());
    if(paintCube!==cube){paintCube.dispose();paintFilter.dispose();}
    cube.dispose();filter.dispose();waterProxy.dispose();
    captures.forEach(p=>p.target?.dispose());
  }};
}
