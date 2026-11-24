import {Grid,bounds,clamp,inRing,segmentDistance} from './city-geometry.js';
import {footRoad,roadProfiles,atStation} from './road-profiles.js';

// Four short, alternating carriageway links enclose the middle of a divided
// crossroads. Follow the mapped links so slip-road islands stay intact.
function dividedCrossings(streets,nodes,heightAt){
  const links=new Map(),patches=[],done=new Set();
  function link(a,b,edge){
    if(!links.has(a))links.set(a,new Map());
    links.get(a).set(b,edge);
  }
  for(const [road,data] of streets){
    if(!road.oneway||!road.name)continue;
    let prev=-1;
    for(let i=0;i<road.p.length;i++){
      const b=road.p[i].join(',');
      if(!nodes.get(b)?.some(arm=>arm.road.oneway&&arm.road.name&&arm.road.name!==road.name))continue;
      if(prev>=0){
        const lo=data.distances[prev],hi=data.distances[i];
        if(hi-lo<35&&hi-lo>2&&[lo,(lo+hi)/2,hi].every(s=>Math.abs(heightAt(road,s)-.28)<.004)){
          const a=road.p[prev].join(','),p=road.p.slice(prev,i+1);
          link(a,b,{road,data,lo,hi,p,forward:true});link(b,a,{road,data,lo,hi,p:p.slice().reverse(),forward:false});
        }
      }
      prev=i;
    }
  }
  for(const [a,fromA] of links)for(const [b,ab] of fromA)for(const [c,bc] of links.get(b)){
    if(ab.road.name===bc.road.name||a===c)continue;
    for(const [d,cd] of links.get(c)){
      const da=fromA.get(d);
      if(d===b||!da||cd.road.name!==ab.road.name||da.road.name!==bc.road.name)continue;
      const key=[a,b,c,d].sort().join('|');if(done.has(key))continue;
      const edges=[ab,bc,cd,links.get(d).get(a)];
      // A divided road has opposite traffic directions on its two sides.
      if(ab.forward!==cd.forward||bc.forward!==edges[3].forward)continue;
      done.add(key);
      patches.push({ring:edges.flatMap(e=>e.p.slice(0,-1)),corners:edges.map(e=>e.p[0])});
      for(const {data,lo,hi} of edges)for(const spans of [data.intervals,data.left,data.right])spans.push([lo,hi]);
    }
  }
  return patches;
}

export function wenxinDivider(map){
  const road=map.roads?.find(r=>r.id===235113766);if(!road)return null;
  const [a,b]=road.p,len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  const at=(s,o=0)=>[a[0]+ux*s-uz*o,a[1]+uz*s+ux*o];
  const start=16,end=start+2.5*Math.floor((len-5-start)/2.5);
  return {road,ux,uz,at,start,end,p:[at(start,-.16),at(start,.16),at(end,.16),at(end,-.16)],h:1.30};
}

function mergeSpans(intervals,len){
  if(!intervals.length)return [];
  const sorted=intervals.slice().sort((a,b)=>a[0]-b[0]),merged=[];
  for(const [lo,hi] of sorted){
    const a=Math.max(0,lo),b=Math.min(len,hi);
    if(b<=a)continue;
    if(!merged.length||a>merged.at(-1)[1]+.05)merged.push([a,b]);
    else merged.at(-1)[1]=Math.max(merged.at(-1)[1],b);
  }
  return merged;
}

// Distances along each carriageway where kerbs, sidewalks and longitudinal paint must
// leave space for another street or a mapped pedestrian crossing.
export function streetJunctions(map){
  const profiles=roadProfiles(map);
  const nodes=new Map(),streets=new Map(),crossings=new Grid(32),surfaceSegs=new Grid(40);
  const heightAt=(road,s)=>{
    const prof=profiles.get(road);
    if(!prof)return .28;
    return atStation(prof,clamp(s,0,prof.length)).y;
  };
  for(const road of map.roads){
    if(road.tunnel||road.layer<0||footRoad(road)||road.p.length<2)continue;
    const prof=profiles.get(road);
    if(!prof&&(road.bridge||road.layer>0))continue;
    const distances=[0],data={distances,intervals:[],left:[],right:[],merged:null};
    streets.set(road,data);
    for(let i=0;i<road.p.length;i++){
      const p=road.p[i],prev=road.p[i-1],next=road.p[i+1];
      if(prev){
        const segLen=Math.hypot(p[0]-prev[0],p[1]-prev[1]);
        distances.push(distances[i-1]+segLen);
        const midY=heightAt(road,distances[i-1]+segLen*.5);
        if(midY<.95&&segLen>.1){
          const pad=(road.width||6)*.5+3;
          surfaceSegs.add({road,a:prev,b:p,s0:distances[i-1],s1:distances[i],len:segLen},
            [Math.min(prev[0],p[0])-pad,Math.min(prev[1],p[1])-pad,Math.max(prev[0],p[0])+pad,Math.max(prev[1],p[1])+pad]);
        }
      }
      const key=p.join(','),arms=nodes.get(key)??[];
      arms.push({road,s:distances[i],prev,next,p});nodes.set(key,arms);
    }
  }
  for(const arms of nodes.values()){
    if(arms.length<2)continue;
    const dirs=arms.flatMap(({prev,p,next,road,s})=>[prev,next].filter(Boolean).map(q=>{
      const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz)||1;return {dx:dx/len,dz:dz/len,road,y:heightAt(road,s)};
    }));
    if(dirs.length<3)continue;
    for(const {road,s,prev,p,next} of arms){
      const data=streets.get(road);if(!data)continue;
      // Forward tangent of `road` at node `p` (matching ribbon normal [-tz, tx] for side = +1).
      let tx=0,tz=0;
      if(prev){const dx=p[0]-prev[0],dz=p[1]-prev[1],l=Math.hypot(dx,dz)||1;tx+=dx/l;tz+=dz/l;}
      if(next){const dx=next[0]-p[0],dz=next[1]-p[1],l=Math.hypot(dx,dz)||1;tx+=dx/l;tz+=dz/l;}
      const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      const own=dirs.filter(v=>v.road===road),width=road.width||6,y=heightAt(road,s);
      for(const d of dirs){
        if(d.road===road||d.road.kind==='service'&&(d.road.width||0)<2.2)continue;
        if(!own.some(v=>Math.abs(v.dx*d.dz-v.dz*d.dx)>.25))continue;
        const sideDot=-tz*d.dx+tx*d.dz;
        if(Math.abs(sideDot)<.25)continue;
        if(Math.abs(y-d.y)>.25)continue;
        // At a skew junction the mouth meets the kerb upstream or downstream
        // of the centreline node. Intersect the other road with this edge.
        const cosine=tx*d.dx+tz*d.dz,reach=(d.road.width||5)*.5/Math.abs(sideDot);
        const shift=(width*.5+.65)*cosine/Math.abs(sideDot);
        const gap=reach+1.15+Math.abs(cosine/sideDot)*.7;
        (sideDot>0?data.left:data.right).push([s+shift-gap,s+shift+gap]);
        data.intervals.push([s-Math.max(reach,reach-shift)-1.15,s+Math.max(reach,reach+shift)+1.15]);
      }
    }
  }
  const patches=dividedCrossings(streets,nodes,heightAt);
  const centers=new Grid(40);
  for(const patch of patches)centers.add(patch,bounds(patch.ring));
  // Catch unsplit T-junctions where a side street endpoint lands near a main road edge without sharing a node.
  for(const [road,data] of streets){
    if(road.kind==='service'&&(road.width||0)<2.2)continue;
    const len=data.distances.at(-1);
    if(len<1)continue;
    for(const [ep,other,es] of [[road.p[0],road.p[1],0],[road.p.at(-1),road.p.at(-2),len]]){
      if(heightAt(road,es)>=.95)continue;
      if((nodes.get(ep.join(','))?.length??0)>=2)continue;
      const vx=other[0]-ep[0],vz=other[1]-ep[1],vl=Math.hypot(vx,vz)||1;
      const dirX=vx/vl,dirZ=vz/vl;
      for(const seg of surfaceSegs.query(ep[0],ep[1])){
        if(seg.road===road)continue;
        const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],l=seg.len;
        const ux=dx/l,uz=dz/l;
        const cross=Math.abs(ux*dirZ-uz*dirX);
        if(cross<.28)continue;
        const proj=((ep[0]-seg.a[0])*ux+(ep[1]-seg.a[1])*uz);
        if(proj<.5||proj>l-.5)continue;
        const px=seg.a[0]+ux*proj,pz=seg.a[1]+uz*proj;
        const dist=Math.hypot(ep[0]-px,ep[1]-pz);
        const mainHalf=(seg.road.width||6)*.5;
        if(dist>mainHalf+2.0)continue;
        const target=streets.get(seg.road);
        const sHit=seg.s0+proj,gap=(road.width||5)*.5+1.15;
        const sideDot=-uz*dirX+ux*dirZ;
        target.intervals.push([sHit-gap,sHit+gap]);
        if(sideDot>.2)target.left.push([sHit-gap,sHit+gap]);
        else if(sideDot<-.2)target.right.push([sHit-gap,sHit+gap]);
        else{target.left.push([sHit-gap,sHit+gap]);target.right.push([sHit-gap,sHit+gap]);}
      }
    }
  }
  for(const c of map.roads){
    if(c.footway!=='crossing'||c.bridge||c.layer||c.tunnel)continue;
    for(let i=1;i<c.p.length;i++){
      const a=c.p[i-1],b=c.p[i];
      crossings.add({a,b},[Math.min(a[0],b[0])-2,Math.min(a[1],b[1])-2,Math.max(a[0],b[0])+2,Math.max(a[1],b[1])+2]);
    }
    for(const p of c.p)for(const {road,s} of nodes.get(p.join(','))??[]){
      if(heightAt(road,s)>=.95)continue;
      const d=streets.get(road);
      d.intervals.push([s-2.1,s+2.1]);d.left.push([s-2.1,s+2.1]);d.right.push([s-2.1,s+2.1]);
    }
  }
  for(const stop of map.pois??[])if(stop.kind==='crossing')
    for(const {road,s} of nodes.get(stop.p.join(','))??[]){
      if(heightAt(road,s)>=.95)continue;
      const d=streets.get(road);
      d.intervals.push([s-2.1,s+2.1]);d.left.push([s-2.1,s+2.1]);d.right.push([s-2.1,s+2.1]);
    }

  function getMerged(road,side=0){
    const data=streets.get(road);if(!data)return [];
    if(!data.merged){
      const len=data.distances.at(-1);
      data.merged={
        all:mergeSpans(data.intervals,len),
        left:mergeSpans(data.left,len),
        right:mergeSpans(data.right,len)
      };
    }
    return side>0?data.merged.left:side<0?data.merged.right:data.merged.all;
  }

  function clearRuns(road,side=0){
    const data=streets.get(road);if(!data)return [road.p];
    const blocked=getMerged(road,side);
    if(!blocked.length)return [road.p];
    const {distances}=data,len=distances.at(-1),spans=[];let from=0;
    for(const [lo,hi] of blocked){
      if(lo>from+.1)spans.push([from,Math.min(lo,len)]);
      from=Math.max(from,hi);
    }
    if(from<len-.1)spans.push([from,len]);
    return spans.map(([lo,hi])=>{
      const points=[];
      for(let i=1;i<road.p.length;i++){
        if(distances[i]<=lo||distances[i-1]>=hi)continue;
        const a=road.p[i-1],b=road.p[i],length=distances[i]-distances[i-1];
        const at=s=>{const t=clamp((s-distances[i-1])/length,0,1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
        if(!points.length)points.push(at(lo));points.push(at(hi));
      }
      return points;
    }).filter(p=>p.length>=2);
  }

  function isClear(road,s,side=0){
    const blocked=getMerged(road,side);
    for(const [lo,hi] of blocked){
      if(s>=lo&&s<=hi)return false;
      if(lo>s)break;
    }
    return true;
  }

  return {patches,junctionAt:(x,z)=>centers.query(x,z).find(p=>inRing(x,z,p.ring)),
    blockedSpans:getMerged,clearRuns,isClear,hasCrossing:(x,z)=>crossings.query(x,z).some(c=>segmentDistance(x,z,c.a,c.b)<1.9)};
}

