import * as T from 'three';
import {Grid,Surface,inArea,inRing,segmentDistance} from './city-geometry.js';
import {southWalk} from './talent-field.js';

const earth=.010,bed=.216;
export const landingPaving=.030;
const fade=(d,inner,outer)=>1-T.MathUtils.smoothstep(d,inner,outer);

// One continuous bank carries the fork, both paths and the lawn. Its perimeter
// rolls below the existing park turf, including behind the first and last posts.
export function southGround(map,bridge){
  const ends=[bridge.p[0],bridge.p.at(-1)].sort((a,b)=>b[1]-a[1]);
  const [[hx,hz],[nx,nz]]=ends,span=Math.hypot(hx-nx,hz-nz),dx=(hx-nx)/span,dz=(hz-nz)/span;
  const paths=new Grid(16),aprons=new Grid(16);
  function add(grid,a,b,pad){
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<.001)return;
    grid.add({a,b,len},[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]);
  }
  for(let i=1;i<southWalk.length;i++)add(paths,southWalk[i-1],southWalk[i],18);
  const junction=southWalk[0];
  add(aprons,ends[0],junction,10);
  for(const road of map.roads){
    if(road.kind!=='footway'||road.bridge)continue;
    const meets=p=>p[0]===junction[0]&&p[1]===junction[1];
    const p=meets(road.p[0])?road.p:meets(road.p.at(-1))?[...road.p].reverse():[];
    let run=0;
    for(let i=1;i<p.length&&run<29;i++){
      const a=p[i-1],b=p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),t=Math.min(1,(29-run)/len);
      add(aprons,a,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],8);run+=len;
    }
  }
  const lake=map.water?.find(w=>Number(w.id)===-10175109);
  const shore=new Grid(16);
  for(const ring of lake?[lake.p,...(lake.holes??[])]:[]){
    for(let i=0;i<ring.length;i++)add(shore,ring[i],ring[(i+1)%ring.length],6);
  }
  function grade(x,z){
    const u=(x-hx)*dx+(z-hz)*dz,v=Math.abs((x-hx)*dz-(z-hz)*dx);
    const mound=fade(-u,1,5)*fade(u,1,33)*fade(v,bridge.width/2+1,27);
    let fill=0;
    for(const {a,b,len} of paths.query(x,z)){
      const tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len;
      const along=(x-a[0])*tx+(z-a[1])*tz,across=-(x-a[0])*tz+(z-a[1])*tx;
      const side=Math.max(-10.7-across,across-4.6,0),end=Math.max(-along,along-len,0);
      fill=Math.max(fill,fade(Math.hypot(side,end),0,5.5));
    }
    for(const {a,b} of aprons.query(x,z))fill=Math.max(fill,fade(segmentDistance(x,z,a,b),3.5,7));
    fill=Math.max(fill,fade(-u,1,5)*fade(u,2,12)*fade(v,bridge.width/2+1,12));
    const rise=(bed-earth)*fill+(2.412-landingPaving-bed)*mound;
    if(!rise||!lake)return earth+rise;
    if(inRing(x,z,lake.p)&&!lake.holes?.some(h=>inRing(x,z,h)))return earth;
    let distance=6;
    for(const {a,b} of shore.query(x,z))distance=Math.min(distance,segmentDistance(x,z,a,b));
    return earth+rise*T.MathUtils.smoothstep(distance,.9,5);
  }

  const x0=Math.floor(Math.min(hx-40,...southWalk.map(p=>p[0]-20)));
  const z0=Math.floor(Math.min(hz-40,...southWalk.map(p=>p[1]-20)));
  const width=Math.ceil(Math.max(hx+40,...southWalk.map(p=>p[0]+20)))-x0+1;
  const depth=Math.ceil(Math.max(hz+40,...southWalk.map(p=>p[1]+20)))-z0+1;
  const levels=new Float32Array(width*depth),ids=new Int32Array(levels.length).fill(-1);
  const surface=new Surface(),active=new Uint8Array(levels.length);
  for(let j=0;j<depth;j++)for(let i=0;i<width;i++)levels[j*width+i]=grade(x0+i,z0+j);
  const local=(map.land??[]).filter(l=>l.turfColor&&l.bbox[0]<x0+width&&l.bbox[2]>=x0&&l.bbox[1]<z0+depth&&l.bbox[3]>=z0)
    .sort((a,b)=>b.turfY-a.turfY);
  const color=new T.Color();
  function corner(k){
    if(ids[k]>=0)return ids[k];
    const x=x0+k%width,z=z0+Math.floor(k/width);
    color.setHex(local.find(l=>inArea(x,z,l))?.turfColor??0xd5e1b7);
    return ids[k]=surface.vertex([x,levels[k],z],[x/4,z/4],color);
  }
  for(let j=0;j<depth-1;j++)for(let i=0;i<width-1;i++){
    const k=j*width+i,c=k+width;
    if(Math.max(levels[k],levels[k+1],levels[c],levels[c+1])<=earth+.00001)continue;
    active[k]=1;
    const a=corner(k),b=corner(k+1),d=corner(c),e=corner(c+1);
    surface.indices.push(a,d,e,a,e,b);
  }
  function heightAt(x,z){
    const i=Math.floor(x)-x0,j=Math.floor(z)-z0,k=j*width+i;
    if(i<0||i>=width-1||j<0||j>=depth-1||!active[k])return null;
    const fx=x-Math.floor(x),fz=z-Math.floor(z),a=levels[k],e=levels[k+width+1];
    return fx>=fz?a+(levels[k+1]-a)*(fx-fz)+(e-a)*fz:a+(levels[k+width]-a)*(fz-fx)+(e-a)*fx;
  }
  return {surface,heightAt};
}

// Clip each paving triangle to the same one-metre triangles as the turf. This
// preserves markings and UVs through bends and prevents wide faces bridging a slope.
export function drape(surface,ground,lift){
  const fitted=new Surface();
  function clip(poly,distance){
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
      if(da>=0)out.push(a);
      if(da*db<0){const t=da/(da-db);out.push(a.map((n,j)=>n+(b[j]-n)*t));}
    }
    return out;
  }
  for(let i=0;i<surface.indices.length;i+=3){
    const tri=surface.indices.slice(i,i+3).map(k=>[surface.p[k*3],surface.p[k*3+2],surface.uv[k*2],surface.uv[k*2+1]]);
    const xs=tri.map(p=>p[0]),zs=tri.map(p=>p[1]);
    for(let x=Math.floor(Math.min(...xs));x<Math.ceil(Math.max(...xs));x++){
      const strip=clip(clip(tri,p=>p[0]-x),p=>x+1-p[0]);
      if(strip.length<3)continue;
      for(let z=Math.floor(Math.min(...zs));z<Math.ceil(Math.max(...zs));z++){
        const cell=clip(clip(strip,p=>p[1]-z),p=>z+1-p[1]);
        if(cell.length<3)continue;
        for(const sign of [-1,1]){
          const poly=clip(cell,p=>sign*((p[0]-x)-(p[1]-z)));
          if(poly.length<3)continue;
          const ids=poly.map(([px,pz,u,v])=>fitted.vertex([px,(ground.heightAt(px,pz)??earth)+lift,pz],[u,v]));
          for(let j=2;j<ids.length;j++)fitted.indices.push(ids[0],ids[j-1],ids[j]);
        }
      }
    }
  }
  return fitted;
}

// Index the same triangles that carry the paving and grass, including the fan at the fork.
export function groundIndex(surfaces){
  const grid=new Grid(3);
  for(const s of surfaces)for(let i=0;i<s.indices.length;i+=3){
    const [a,b,c]=s.indices.slice(i,i+3).map(k=>new T.Vector3().fromArray(s.p,k*3));
    const ab=b.sub(a),ac=c.sub(a),det=ab.x*ac.z-ab.z*ac.x;
    if(Math.abs(det)<1e-7)continue;
    grid.add({a,ab,ac,det},[a.x+Math.min(0,ab.x,ac.x),a.z+Math.min(0,ab.z,ac.z),
      a.x+Math.max(0,ab.x,ac.x),a.z+Math.max(0,ab.z,ac.z)]);
  }
  return (x,z)=>{
    let y=null;
    for(const {a,ab,ac,det} of grid.query(x,z)){
      const dx=x-a.x,dz=z-a.z,u=(dx*ac.z-dz*ac.x)/det,v=(ab.x*dz-ab.z*dx)/det;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)y=Math.max(y??-Infinity,a.y+u*ab.y+v*ac.y);
    }
    return y;
  };
}
