import * as T from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {takeSkyFile} from './sky-assets.js';

function downsamplePixels(pixels,width,height,maxWidth){
  if(!(maxWidth>0 && width>maxWidth))return {data:pixels,width,height};
  const step=Math.max(2,Math.round(width/maxWidth));
  const nw=Math.max(1,Math.floor(width/step)),nh=Math.max(1,Math.floor(height/step));
  const out=new pixels.constructor(nw*nh*4);
  for(let y=0;y<nh;y++){
    const sy=y*step*width;
    for(let x=0;x<nw;x++){
      const si=(sy+x*step)*4,di=(y*nw+x)*4;
      out[di]=pixels[si];out[di+1]=pixels[si+1];out[di+2]=pixels[si+2];out[di+3]=pixels[si+3];
    }
  }
  return {data:out,width:nw,height:nh};
}

function buildHdrTexture(result){
  const texture=new T.DataTexture(result.data,result.width,result.height,T.RGBAFormat,result.type);
  texture.mapping=T.EquirectangularReflectionMapping;
  texture.colorSpace=T.LinearSRGBColorSpace;
  texture.minFilter=texture.magFilter=T.LinearFilter;
  texture.flipY=true;texture.needsUpdate=true;
  return texture;
}

async function decodeHdr(key,priority,maxWidth=0){
  const file=await takeSkyFile(key,priority);
  const buffer=await file.arrayBuffer();
  try{
    const workerBuf=buffer.slice(0);
    const result=await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./sky-hdr.worker.js',import.meta.url),{type:'module'});
      worker.onerror=event=>{worker.terminate();reject(new Error(event.message||'Worker error'));};
      worker.onmessage=({data})=>{
        worker.terminate();
        if(data?.error){reject(new Error(data.error));return;}
        resolve(data);
      };
      worker.postMessage({buffer:workerBuf,maxWidth},[workerBuf]);
    });
    return buildHdrTexture(result);
  }catch{
    const parsed=new HDRLoader().parse(buffer);
    const scaled=downsamplePixels(parsed.data,parsed.width,parsed.height,maxWidth);
    return buildHdrTexture({...scaled,type:parsed.type});
  }
}

export function skyTextures(renderer,{maxWidth=0,singleCache=false}={}){
  const loads=new Map();
  let activeKey=null,activeTex=null;
  function load(key,priority='auto'){
    if(!loads.has(key)){
      const p=decodeHdr(key,priority,maxWidth).then(tex=>{
        if(singleCache){
          if(activeTex && activeKey!==key){
            activeTex.dispose();
            loads.delete(activeKey);
          }
          activeKey=key;activeTex=tex;
        }
        return tex;
      }).catch(error=>{loads.delete(key);throw error;});
      loads.set(key,p);
    }
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
