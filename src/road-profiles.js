// A bridge layer describes vertical order at a crossing. The roadway still shares
// an elevation with the next way at a connected end, including across short ways.
import {coastalUpper,skywalkHeight} from './walk-deck-data.js';
import {bayHeight,bayWidth,northernBayWays} from './bay-alignment.js';
const cache=new WeakMap();
export const footRoad=r=>['footway','path','steps','pedestrian','cycleway'].includes(r.kind);
const houhaiSides=new Set([386160782,386160787,386160793,535137387]);
const deckSides={'后海大桥':[386160782,386160787],'后海二桥':[386160793,535137387]};
const key=p=>p[0]+','+p[1];
const ground=.28,rise=5.3,flatBridgeRise=.05;
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=t=>Math.max(0,Math.min(1,t));
const rankOrder={motorway:6,trunk:5,primary:4,secondary:3,tertiary:2,residential:1,unclassified:1,living_street:1,service:0};

// Millimetre-scale height stratification by road hierarchy & width so intersecting
// at-grade carriageways never share identical depth and Z-fight.
export function surfaceRoadOffset(rd){
  const base=(rankOrder[rd.kind?.replace(/_link$/,'')]??1)*.0022;
  const widthBonus=Math.min(.0018,(rd.width||6)*.00012);
  const tie=((Math.abs(rd.id||0)%17)/17)*.0009;
  return base+widthBonus+tie;
}

function segmentsCross(a,b,c,d){
  if((a[0]===c[0]&&a[1]===c[1])||(a[0]===d[0]&&a[1]===d[1])||(b[0]===c[0]&&b[1]===c[1])||(b[0]===d[0]&&b[1]===d[1]))return false;
  const ccw=(p,q,r)=>(r[1]-p[1])*(q[0]-p[0])>(q[1]-p[1])*(r[0]-p[0]);
  return ccw(a,c,d)!==ccw(b,c,d)&&ccw(a,b,c)!==ccw(a,b,d);
}

// Distinguish genuine grade-separated viaducts / bay bridges from low flat river crossings
// (such as short bridges over Zhongxin River that meet signalized street intersections at grade).
function classifyViaducts(motor,families){
  const elevated=motor.filter(r=>r.bridge||(r.layer??0)>0);
  const lower=motor.filter(r=>!r.bridge&&(r.layer??0)<=0);
  const byNode=new Map();
  for(const r of elevated){
    for(const p of r.p){
      const k=key(p);let list=byNode.get(k);if(!list){list=[];byNode.set(k,list);}list.push(r);
    }
  }
  const bboxOf=r=>{
    let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
    for(const [x,z] of r.p){if(x<x0)x0=x;if(z<z0)z0=z;if(x>x1)x1=x;if(z>z1)z1=z;}
    return [x0,z0,x1,z1];
  };
  const lowerBoxes=lower.map(r=>({r,b:bboxOf(r)}));
  const elevBoxes=new Map(elevated.map(r=>[r,bboxOf(r)]));
  const crossesMotor=r=>{
    const rb=elevBoxes.get(r),rLayer=r.layer??(r.bridge?1:0);
    for(const {r:o,b} of lowerBoxes){
      if(o===r||rb[2]<b[0]||rb[0]>b[2]||rb[3]<b[1]||rb[1]>b[3])continue;
      for(let i=1;i<r.p.length;i++)for(let j=1;j<o.p.length;j++){
        if(segmentsCross(r.p[i-1],r.p[i],o.p[j-1],o.p[j]))return true;
      }
    }
    for(const o of elevated){
      if(o===r||(o.layer??1)>=rLayer)continue;
      const b=elevBoxes.get(o);
      if(rb[2]<b[0]||rb[0]>b[2]||rb[3]<b[1]||rb[1]>b[3])continue;
      for(let i=1;i<r.p.length;i++)for(let j=1;j<o.p.length;j++){
        if(segmentsCross(r.p[i-1],r.p[i],o.p[j-1],o.p[j]))return true;
      }
    }
    return false;
  };
  const visited=new Set(),trueViaducts=new Set();
  for(const start of elevated){
    if(visited.has(start))continue;
    const comp=[start];visited.add(start);
    for(let i=0;i<comp.length;i++){
      for(const p of comp[i].p){
        for(const nb of byNode.get(key(p))??[]){
          if(!visited.has(nb)){visited.add(nb);comp.push(nb);}
        }
      }
    }
    const isHigh=comp.some(r=>
      families.has(r)||northernBayWays.has(r.id)||
      /^(motorway|trunk)(_link)?$/.test(r.kind)||
      (r.layer??0)>=2||crossesMotor(r)
    );
    if(isHigh)for(const r of comp)trueViaducts.add(r);
  }
  return trueViaducts;
}

export function roadProfiles(map){
  if(cache.has(map))return cache.get(map);
  const nodes=new Map(),ways=[],profiles=new Map(),families=new Map();
  const motor=map.roads.filter(r=>r.p.length>1&&!r.tunnel&&(r.layer??0)>=0&&!footRoad(r));
  for(const deck of map.decks??[]){
    if(!['后海大桥','后海二桥'].includes(deck.name))continue;
    const pair=motor.filter(r=>r.name===deck.name&&r.bridge);
    if(pair.length!==2)continue;
    for(const road of pair){
      const [a,b]=[road.p[0],road.p.at(-1)],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const project=p=>(-(b[1]-a[1])*(p[0]-a[0])+(b[0]-a[0])*(p[1]-a[1]))/len;
      const opposite=pair.find(r=>r!==road),median=Math.abs(project(opposite.p[0]))*.5;
      const outer=Math.max(...deck.p.map(project));
      const family={median,outer,width:2*median-(deck.name==='后海大桥'?4.0:3.1),lampSpacing:len/Math.max(1,Math.round(len/31)),road,deck,access:[]};
      if(deckSides[deck.name]){
        for(const walk of map.roads.filter(r=>deckSides[deck.name].includes(r.id))){
          if(project(walk.p[0])>0)family.access.push(walk.p[0],walk.p.at(-1));
        }
      }
      families.set(road,family);
      for(const end of [a,b])for(const next of motor){
        if(next.name==='沙河西路'&&[next.p[0],next.p.at(-1)].some(p=>key(p)===key(end)))
          families.set(next,family);
      }
    }
  }
  const trueViaducts=classifyViaducts(motor,families);
  const upperNodes=new Set(map.roads.filter(r=>footRoad(r)&&coastalUpper(r)&&r.kind!=='steps').flatMap(r=>r.p.map(key)));
  for(const rd of map.roads){
    if(rd.p.length<2||rd.tunnel||rd.layer<0)continue;
    const foot=footRoad(rd),side=houhaiSides.has(rd.id);
    const staircase=rd.kind==='steps'&&rd.p.some(p=>upperNodes.has(key(p)));
    const urban=foot&&(coastalUpper(rd)||staircase);
    if(foot&&!side&&!urban&&(rd.bridge||rd.layer>0))continue;
    const isElevatedMotor=!foot&&(rd.bridge||rd.layer>0);
    const flatBridge=isElevatedMotor&&!trueViaducts.has(rd);
    const level=urban&&rd.kind!=='steps'?skywalkHeight-.246:side?rise+.174:isElevatedMotor?(flatBridge?flatBridgeRise:rise*Math.max(1,rd.layer??0)):0;
    let grade=rd.kind==='steps'?.32:.054;
    if(staircase){
      const run=rd.p.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-rd.p[i][0],p[1]-rd.p[i][1]),0);
      grade=Math.max(grade,(skywalkHeight-.246)/Math.max(1,run));
    }
    const chain=[];
    for(const p of rd.p){
      const id=(foot?(urban&&upperNodes.has(key(p))?'u':'p'):'m')+key(p);
      let node=nodes.get(id);if(!node){node={x:p[0],z:p[1],h:0,edges:[]};nodes.set(id,node);}
      node.h=Math.max(node.h,level);
      if(chain.at(-1)===node)continue;
      const prev=chain.at(-1);
      if(prev){
        const cost=Math.hypot(node.x-prev.x,node.z-prev.z)*grade;
        prev.edges.push([node,cost]);node.edges.push([prev,cost]);
      }
      chain.push(node);
    }
    if(chain.length>1)ways.push({rd,chain,level,foot,side,urban,flatBridge,grade});
  }
  const queue=[...nodes.values()].filter(n=>n.h>0);
  for(let i=0;i<queue.length;i++)for(const [n,cost] of queue[i].edges){
    const h=queue[i].h-cost;if(h>n.h+.00001){n.h=h;queue.push(n);}
  }
  for(const {rd,chain,level,foot,side,urban,flatBridge,grade} of ways){
    if(!chain.some(n=>n.h>0))continue;
    const base=foot?.246:ground,points=[],distances=[0];
    const family=families.get(rd);
    let distance=0;
    function add(x,z,h,s){
      // Round the crest and toe without creating a step at a shared node.
      const unit=Math.floor(h/rise),u=h/rise-unit;
      const elevation=foot||h<=flatBridgeRise+.001?h:rise*(unit+u*u*(3-2*u));
      const bay=northernBayWays.has(rd.id),y=bay?bayHeight(z):base+elevation,blend=clamp(elevation/rise);
      const width=bay?bayWidth(z,rd.width):family?lerp(rd.width,family.width,blend):rd.width;
      points.push({x,z,y,s,width,blend});
    }
    for(let i=1;i<chain.length;i++){
      const a=chain[i-1],b=chain[i],length=Math.hypot(b.x-a.x,b.z-a.z);
      if(i===1)add(a.x,a.z,a.h,0);
      const knots=[length];
      if(northernBayWays.has(rd.id))for(let v=5;v<length;v+=5)knots.push(v);
      if(a.h!==b.h||level<Math.min(a.h,b.h)){
        const limit=Math.min(length,Math.max(0,a.h-level)/grade);
        for(let v=5;v<limit;v+=5)knots.push(v);
        if(limit>0&&limit<length)knots.push(limit);
        const start=Math.max(0,length-Math.max(0,b.h-level)/grade);
        for(let v=length-5;v>start;v-=5)knots.push(v);
        if(start>0&&start<length)knots.push(start);
        const meet=(a.h-b.h+grade*length)/(2*grade);
        if(meet>0&&meet<length&&a.h-grade*meet>level)knots.push(meet);
      }
      let previous=0;
      for(const d of knots.sort((x,z)=>x-z)){
        if(d<length&&d-previous<.015||length-d<.015&&d!==length)continue;
        previous=d;const t=d/length;
        add(lerp(a.x,b.x,t),lerp(a.z,b.z,t),Math.max(level,a.h-grade*d,b.h-grade*(length-d)),distance+d);
      }
      distance+=length;distances.push(distance);
    }
    // Share the transverse direction at continuing way ends, so both edge
    // vertices meet even where the surveyed centreline turns at a boundary.
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[i-1],b=points[i+1];
      const unit=(x,z)=>{const l=Math.hypot(x,z);return [x/l,z/l];};
      let incoming=a?unit(p.x-a.x,p.z-a.z):null,outgoing=b?unit(b.x-p.x,b.z-p.z):null;
      if(!a||!b){
        const node=!a?chain[0]:chain.at(-1),forward=outgoing??incoming,sign=!a?-1:1;
        let best=.83,dir=forward;
        for(const [n] of node.edges){
          const v=unit((n.x-node.x)*sign,(n.z-node.z)*sign),dot=v[0]*forward[0]+v[1]*forward[1];
          if(dot>best){best=dot;dir=v;}
        }
        incoming??=dir;outgoing??=dir;
      }
      const dot=incoming[0]*outgoing[0]+incoming[1]*outgoing[1],k=1/Math.max(.55,1+dot);
      p.nx=-(incoming[1]+outgoing[1])*k;p.nz=(incoming[0]+outgoing[0])*k;
    }
    profiles.set(rd,{points,distances,base,level,foot,side,family,urban,flatBridge,length:distance});
  }
  cache.set(map,profiles);return profiles;
}

export function atStation(profile,s){
  const pts=profile.points;
  let lo=0,hi=pts.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(pts[mid].s<=s)lo=mid;else hi=mid;}
  const a=pts[lo],b=pts[hi],t=clamp((s-a.s)/(b.s-a.s));
  return {s,x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t),y:lerp(a.y,b.y,t),width:lerp(a.width,b.width,t),
    nx:lerp(a.nx,b.nx,t),nz:lerp(a.nz,b.nz,t),blend:lerp(a.blend,b.blend,t),slope:(b.y-a.y)/(b.s-a.s)};
}

