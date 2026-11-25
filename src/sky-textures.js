import * as T from 'three';
import {takeSkyFile} from './sky-assets.js';

async function decodeHdr(key,priority){
  const file=await takeSkyFile(key,priority);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./sky-hdr.worker.js',import.meta.url),{type:'module'});
    worker.onerror=event=>{worker.terminate();reject(new Error(event.message));};
    worker.onmessage=({data:result})=>{
      worker.terminate();
      if(result.error){reject(new Error(result.error));return;}
      const texture=new T.DataTexture(result.data,result.width,result.height,T.RGBAFormat,result.type);
      texture.mapping=T.EquirectangularReflectionMapping;
      texture.colorSpace=T.LinearSRGBColorSpace;
      texture.minFilter=texture.magFilter=T.LinearFilter;
      texture.flipY=true;texture.needsUpdate=true;
      resolve(texture);
    };
    worker.postMessage(file);
  });
}

export function skyTextures(renderer){
  const loads=new Map();
  function load(key,priority='auto'){
    if(!loads.has(key))loads.set(key,decodeHdr(key,priority).catch(error=>{loads.delete(key);throw error;}));
    return loads.get(key);
  }
  // A single offscreen pixel makes Three cache both the visible sky cube and
  // the filtered environment in the same renderer that will draw the city.
  const sample=new T.Scene(),camera=new T.PerspectiveCamera();
  const surface=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial());
  camera.position.z=2;sample.add(surface);
  const pixel=new T.WebGLRenderTarget(1,1);
  function warm(texture){
    sample.background=sample.environment=texture;
    const target=renderer.getRenderTarget();
    renderer.setRenderTarget(pixel);
    try{renderer.render(sample,camera);}
    finally{renderer.setRenderTarget(target);}
  }
  return {load,warm};
}
