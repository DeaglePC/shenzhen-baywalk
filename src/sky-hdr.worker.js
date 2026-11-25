import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

self.onmessage=async ({data:file})=>{
  try{
    const {data,width,height,type}=new HDRLoader().parse(await file.arrayBuffer());
    self.postMessage({data,width,height,type},[data.buffer]);
  }catch(error){
    self.postMessage({error:error.message});
  }
};
