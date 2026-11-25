import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

self.onmessage=async ({data})=>{
  try{
    const maxWidth=data?.maxWidth??0;
    let buffer;
    if(data instanceof ArrayBuffer)buffer=data;
    else if(data?.buffer instanceof ArrayBuffer)buffer=data.buffer;
    else buffer=await (data?.file??data).arrayBuffer();
    const parsed=new HDRLoader().parse(buffer);
    let {data:pixels,width,height,type}=parsed;
    if(maxWidth>0 && width>maxWidth){
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
      pixels=out;width=nw;height=nh;
    }
    self.postMessage({data:pixels,width,height,type},[pixels.buffer]);
  }catch(error){
    self.postMessage({error:error.message});
  }
};
