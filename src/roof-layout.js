import {area,bounds,inRing} from './city-geometry.js';

// A scaled copy of a concave roof stays inside it when the inset centre can
// see every edge. Otherwise keep the surveyed outline all the way to the top.
export function supportsRoofSetback(ring,x,z){
  const winding=Math.sign(area(ring));
  return winding!==0&&ring.every(([ax,az],i)=>{
    const [bx,bz]=ring[(i+1)%ring.length];
    return winding*((bx-ax)*(z-az)-(bz-az)*(x-ax))>=0;
  });
}

export function roofPlantSite(ring,width,depth){
  const [minX,minZ,maxX,maxZ]=bounds(ring);
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  // Include a service margin and test the entire base. Checking just its
  // corners misses a courtyard notch entering through one side.
  const hw=width/2+.25,hd=depth/2+.25;
  function fits(x,z){
    if(!inRing(x,z,ring))return false;
    return ring.every(([ax,az],i)=>{
      const [bx,bz]=ring[(i+1)%ring.length];
      if(Math.max(ax,bx)<x-hw||Math.min(ax,bx)>x+hw||
         Math.max(az,bz)<z-hd||Math.min(az,bz)>z+hd)return true;
      const dx=bx-ax,dz=bz-az;
      return Math.abs(dx*(z-az)-dz*(x-ax))>Math.abs(dx)*hd+Math.abs(dz)*hw;
    });
  }
  if(fits(cx,cz))return [cx,cz];
  let nearest=null,distance=Infinity;
  for(let i=0;i<9;i++)for(let j=0;j<9;j++){
    const x=minX+(maxX-minX)*(i+.5)/9,z=minZ+(maxZ-minZ)*(j+.5)/9;
    const d=(x-cx)**2+(z-cz)**2;
    if(d<distance&&fits(x,z)){nearest=[x,z];distance=d;}
  }
  return nearest;
}
