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
  const waterProxy=new T.MeshStandardMaterial({color:0x345951,roughness:.25,metalness:.28});
  function refresh(time){
    const materials=new Set(),omit=[],tower=[];
    scene.traverse(o=>{
      for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(m.userData.cityProbe)materials.add(m);
      if(o.userData.excludeFromProbe||o.name==='Shenzhen road traffic')omit.push(o);
      if(o.userData.excludeFromDistrictProbe)tower.push(o);
    });
    for(const m of materials){if(m.envMap){m.envMap=null;m.needsUpdate=true;}}
    const hidden=omit.map(o=>o.visible),originalWater=city.water?.material;
    const oldSun=sun.position.clone(),oldTarget=sun.target.position.clone();
    scene.userData.capturingProbe=true;omit.forEach(o=>o.visible=false);
    try{
      for(const capture of captures){
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
    }finally{
      scene.userData.capturingProbe=false;omit.forEach((o,i)=>o.visible=hidden[i]);
      if(city.water)city.water.material=originalWater;
      sun.position.copy(oldSun);sun.target.position.copy(oldTarget);sun.shadow.needsUpdate=true;
    }
    for(const m of materials){
      const key=m.userData.cityProbe;
      const tex=scene.userData[key+'Probe']??(key==='gallery'?scene.userData.libraryProbe:null);
      if(!tex)continue;
      m.envMap=tex;m.envMapRotation?.set(0,0,0);m.needsUpdate=true;
    }
  }
  return {refresh,dispose(){if(paintCube!==cube)paintCube.dispose();cube.dispose();filter.dispose();waterProxy.dispose();captures.forEach(p=>p.target?.dispose());}};
}
