import {DataTexture,RGBAFormat,UnsignedByteType,NearestFilter} from 'three';

// Overhead cover in city coordinates. Square-root encoding keeps low awnings
// and pedestrian decks accurate while accommodating the tallest office towers.
export function buildWeatherCover(buildings,stadium){
  const size=1024,extent=3200,metres=2*extent/size;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.setTransform(1/metres,0,0,1/metres,size/2,size/2);
  const encode=y=>Math.round(255*Math.sqrt(Math.min(640,Math.max(0,y))/640));
  function ring(points){
    ctx.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
    ctx.closePath();
  }
  for(const f of [...buildings].sort((a,b)=>a.h-b.h)){
    if(!f.p?.length||stadium?.ownsFootprint(f))continue;
    ctx.beginPath();ring(f.p);
    for(const hole of f.holes||[])if(hole.length)ring(hole);
    const h=encode(f.h??3);ctx.fillStyle='rgb('+h+','+h+','+h+')';ctx.fill('evenodd');
  }
  const data=ctx.getImageData(0,0,size,size).data;
  const index=x=>Math.floor((x+extent)/metres);
  if(stadium?.coverHeight){
    for(let row=index(-905);row<=index(-632);row++)for(let col=index(-195);col<=index(340);col++){
      const roof=stadium.coverHeight((col+.5)*metres-extent,(row+.5)*metres-extent);
      if(roof!=null)data[(row*size+col)*4]=encode(roof);
    }
  }
  const texture=new DataTexture(new Uint8Array(data.buffer),size,size,RGBAFormat,UnsignedByteType);
  texture.name='深圳湾建筑雨影高度';texture.magFilter=texture.minFilter=NearestFilter;texture.needsUpdate=true;
  return {texture,extent,roofAt(x,z){
    const c=index(x),r=index(z);
    if(c<0||c>=size||r<0||r>=size)return 0;
    return 640*(data[(r*size+c)*4]/255)**2;
  }};
}
