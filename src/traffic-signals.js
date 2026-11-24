import {Grid,clamp} from './city-geometry.js';
import {roadProfiles,atStation} from './road-profiles.js';

const eligible=r=>!r.tunnel&&!r.bridge&&!r.layer&&/^(primary|secondary|tertiary|residential|unclassified|living_street)(_link)?$/.test(r.kind);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const offset=(p,d,s)=>[p[0]+s*d[0],p[1]+s*d[1]];
const vector=(a,b)=>[b[0]-a[0],b[1]-a[1]];
function indexPoint(grid,item,p,r){grid.add(item,[p[0]-r,p[1]-r,p[0]+r,p[1]+r]);}
function project(seg,p){
  const s=clamp(dot(vector(seg.a,p),seg.dir),0,seg.length),point=offset(seg.a,seg.dir,s);
  return {point,s,d:distance(p,point)};
}

// Opposing straight movements share green. Protected turns start only after
// amber and the all-red clearance. Crossings parallel to through traffic can
// clear before the next protected movement; mid-block crossings get all-red.
export function signalAspect(arm,movement,time){
  const {site,axis}=arm;
  const t=(time+site.offset)%(site.midblock?46:96);
  if(site.midblock){
    if(movement==='walk')return t>=30&&t<41?'green':'red';
    return t<25?'green':t<28?'amber':'red';
  }
  const local=(t-axis*48+96)%96;
  if(movement==='walk')return local>=48&&local<68?'green':'red';
  if(movement==='left'&&arm.protectedLeft)return local>=31&&local<42?'green':local>=42&&local<45?'amber':'red';
  return local<26?'green':local<29?'amber':'red';
}

// Exact remaining seconds for the active phase so roadside LED countdown displays
// stay physically synchronized with vehicle/pedestrian lights.
export function signalCountdown(arm,movement,time){
  const {site,axis}=arm;
  const cycle=site.midblock?46:96;
  const t=((time+site.offset)%cycle+cycle)%cycle;
  if(site.midblock){
    if(movement==='walk'){
      if(t>=30&&t<41)return {aspect:'green',remaining:41-t};
      return {aspect:'red',remaining:t<30?30-t:cycle-t+30};
    }
    if(t<25)return {aspect:'green',remaining:25-t};
    if(t<28)return {aspect:'amber',remaining:28-t};
    return {aspect:'red',remaining:cycle-t};
  }
  const local=(t-axis*48+96)%96;
  if(movement==='walk'){
    if(local>=48&&local<68)return {aspect:'green',remaining:68-local};
    return {aspect:'red',remaining:local<48?48-local:96-local+48};
  }
  if(movement==='left'&&arm.protectedLeft){
    if(local>=31&&local<42)return {aspect:'green',remaining:42-local};
    if(local>=42&&local<45)return {aspect:'amber',remaining:45-local};
    return {aspect:'red',remaining:local<31?31-local:96-local+31};
  }
  if(local<26)return {aspect:'green',remaining:26-local};
  if(local<29)return {aspect:'amber',remaining:29-local};
  return {aspect:'red',remaining:96-local};
}

export function trafficSignals(map){
  const profiles=roadProfiles(map);
  const elevatedAt=(r,s)=>{
    const prof=profiles.get(r);
    return prof?atStation(prof,clamp(s,0,prof.length)).y>.95:false;
  };
  const segments=new Grid(50),nodes=new Map(),nodesNear=new Grid(60),crossings=new Grid(48),stops=new Grid(32);
  const sites=[],approaches=[],walking=new Grid(32);
  for(const r of map.roads){
    if(!eligible(r))continue;
    let walked=0;
    for(let i=1;i<r.p.length;i++){
      const a=r.p[i-1],b=r.p[i],length=distance(a,b);
      const s0=walked,s1=walked+length;walked=s1;
      if(length<.05)continue;
      if(elevatedAt(r,s0)||elevatedAt(r,s1))continue;
      const dir=vector(a,b).map(n=>n/length),s={a,b,dir,length,road:r};
      segments.add(s,[Math.min(a[0],b[0])-16,Math.min(a[1],b[1])-16,Math.max(a[0],b[0])+16,Math.max(a[1],b[1])+16]);
      for(const [p,other,incoming,heading] of [[b,a,true,dir],[a,b,!r.oneway,dir.map(n=>-n)]]){
        const key=p.join(','),node=nodes.get(key)??{p,legs:[]};
        node.legs.push({other,incoming,dir:heading,road:r});nodes.set(key,node);
      }
    }
  }
  for(const node of nodes.values()){
    if(node.legs.length>=3&&node.legs.some(a=>node.legs.some(b=>Math.abs(dot(a.dir,b.dir))<.85)))indexPoint(nodesNear,node,node.p,55);
  }
  for(const r of map.roads){
    if(r.footway!=='crossing'||r.layer||r.tunnel||r.bridge)continue;
    for(let i=1;i<r.p.length;i++){
      const a=r.p[i-1],b=r.p[i];
      crossings.add({a,b},[Math.min(a[0],b[0])-42,Math.min(a[1],b[1])-42,Math.max(a[0],b[0])+42,Math.max(a[1],b[1])+42]);
    }
  }
  const singles=[];
  for(const poi of map.pois??[]){
    if(poi.kind!=='traffic_signals')continue;
    const p=poi.p,near=nodesNear.query(...p).filter(n=>distance(n.p,p)<43).sort((a,b)=>distance(a.p,p)-distance(b.p,p))[0];
    if(!near){singles.push(p);continue;}
    if(near.site)continue;
    // Both carriageways of a divided intersection meet at separate map nodes.
    const adjacent=nodesNear.query(...near.p).filter(n=>!n.site&&distance(n.p,near.p)<38&&
      n.legs.some(a=>near.legs.some(b=>a.road===b.road||a.road.name&&a.road.name===b.road.name)));
    const center=adjacent.reduce((p,n)=>[p[0]+n.p[0]/adjacent.length,p[1]+n.p[1]/adjacent.length],[0,0]);
    const site={center,arms:[],radius:Math.max(...adjacent.map(n=>distance(center,n.p)))+14};
    const ends=new Set(adjacent.map(n=>n.p.join(',')));
    for(const n of adjacent){
      n.site=site;
      for(const leg of n.legs){
        if(!leg.incoming||ends.has(leg.other.join(',')))continue;
        // Discard short interior links even when an intermediate shape point
        // lies between two intersections of divided carriageways.
        if(dot(vector(n.p,center),leg.dir)<-4&&distance(leg.other,center)<site.radius)continue;
        const candidate={...leg,p:n.p,site};
        const j=site.arms.findIndex(a=>dot(a.dir,leg.dir)>.87);
        if(j<0)site.arms.push(candidate);
        else if(dot(vector(n.p,site.arms[j].p),leg.dir)>0)site.arms[j]=candidate;
      }
    }
    if(site.arms.length)sites.push(site);
  }
  for(const p of singles){
    let best,near=15;
    for(const seg of segments.query(...p)){const q=project(seg,p);if(q.d<near){near=q.d;best={seg,...q};}}
    if(!best)continue;
    const {seg,point}=best;
    const shared=sites.find(s=>s.midblock&&distance(s.center,point)<24&&Math.abs(dot(s.arms[0].dir,seg.dir))>.92&&
      (s.arms[0].road===seg.road||seg.road.name&&s.arms[0].road.name===seg.road.name));
    if(shared?.arms.some(a=>a.road===seg.road))continue;
    const site=shared??{center:point,midblock:true,radius:7,arms:[]};
    for(const sign of seg.road.oneway?[1]:[1,-1])site.arms.push({road:seg.road,dir:seg.dir.map(n=>n*sign),p:point,site});
    if(!shared)sites.push(site);
  }
  for(const site of sites){
    site.offset=(52+Math.round(Math.abs(site.center[0]*.13+site.center[1]*.23)))%(site.midblock?46:96);
    site.arms.sort((a,b)=>b.road.width-a.road.width);
    const primary=site.arms[0].dir;
    for(const arm of site.arms){
      const {p,dir,road}=arm;
      arm.axis=Math.abs(dot(primary,dir))>.71?0:1;
      arm.protectedLeft=!site.midblock&&road.width>=(road.oneway?6.2:10.2)&&
        site.arms.some(other=>Math.abs(dot(dir,other.dir))<.72);
      const otherWidth=Math.max(4,...site.arms.filter(a=>Math.abs(dot(dir,a.dir))<.78).map(a=>a.road.width));
      const setback=site.midblock?0:otherWidth*.5+2.4;
      let crossing=null,score=Infinity;
      for(const {a,b} of crossings.query(...p)){
        const v=vector(a,b),delta=vector(p,a),den=dir[0]*v[1]-dir[1]*v[0];
        if(Math.abs(den)<.4*Math.hypot(...v))continue;
        const t=(delta[0]*v[1]-delta[1]*v[0])/den,u=(delta[0]*dir[1]-delta[1]*dir[0])/den;
        if(u<-.12||u>1.12||t> (site.midblock?10:1)||t< -setback-20)continue;
        if(Math.abs(t+setback)<score){score=Math.abs(t+setback);crossing=offset(p,dir,t);}
      }
      arm.cross=crossing??offset(p,dir,-setback);
      arm.stop=offset(arm.cross,dir,-3.35);
      // Align the stop bar to the curved approach where the vehicle actually
      // brakes, including when the road changes way ID just before the junction.
      let snap,rank=Infinity;
      for(const seg of segments.query(...arm.stop)){
        const alignment=dot(seg.dir,dir);
        if((seg.road.oneway?alignment:Math.abs(alignment))<.62||seg.road!==road&&seg.road.name!==road.name)continue;
        const q=project(seg,arm.stop),score=q.d+(seg.road===road?0:.8);
        if(score<rank&&q.d<9){snap={q,seg,alignment};rank=score;}
      }
      if(snap){
        arm.stop=snap.q.point;
        arm.stopDir=snap.alignment>0?snap.seg.dir:snap.seg.dir.map(n=>-n);
      }else arm.stopDir=dir;
      arm.mappedCrossing=!!crossing;
      arm.right=[-dir[1],dir[0]];
      arm.head=offset(p,dir,site.midblock?4.4:Math.max(5,dot(vector(p,site.center),dir)+site.radius-3));
      approaches.push(arm);indexPoint(stops,arm,arm.stop,12);
      if(arm.mappedCrossing||site.midblock)indexPoint(walking,arm,arm.cross,road.width*.5+4);
    }
  }
  return {sites,approaches,time:0,stops,allowsPedestrian(from,to){
    for(const arm of walking.query(to.x,to.y)){
      const dx=to.x-arm.cross[0],dz=to.y-arm.cross[1];
      if(Math.abs(dx*arm.dir[0]+dz*arm.dir[1])>2.4)continue;
      const after=dx*arm.right[0]+dz*arm.right[1],before=(from.x-arm.cross[0])*arm.right[0]+(from.y-arm.cross[1])*arm.right[1];
      const kerb=arm.road.width*.5+.38;
      if(Math.abs(before)>=kerb&&Math.abs(after)<kerb&&signalAspect(arm,'walk',this.time)!=='green')return false;
    }
    return true;
  }};
}

// Locate a rendered transverse line on each physical driving route once.
// The road can change OSM way ID between the junction and the crossing.
export function bindSignalStops(lanes,plan){
  for(const lane of lanes){
    lane.signalStops=[];
    if(!eligible(lane.road))continue;
    const best=new Map();
    for(let i=1;i<lane.points.length;i++){
      const a=lane.points[i-1],dir=lane.headings[i-1],length=lane.lengths[i]-lane.lengths[i-1];
      const candidates=new Set();
      for(let j=0,n=Math.ceil(length/16);j<=n;j++){
        const p=offset(a,dir,length*j/n);for(const arm of plan.stops.query(...p))candidates.add(arm);
      }
      for(const arm of candidates){
        if(dot(arm.stopDir,dir)<.88||arm.road!==lane.road&&arm.road.name&&lane.road.name&&arm.road.name!==lane.road.name)continue;
        const delta=vector(a,arm.stop),s=dot(delta,arm.stopDir)/dot(dir,arm.stopDir);
        if(s<-.03||s>length+.03)continue;
        const d=distance(arm.stop,offset(a,dir,s));if(d>Math.min(4.2,lane.road.width*.45))continue;
        if(!best.has(arm)||d<best.get(arm).d)best.set(arm,{arm,s:lane.lengths[i-1]+s,d});
      }
    }
    lane.signalStops=[...best.values()].sort((a,b)=>a.s-b.s);
  }
}

