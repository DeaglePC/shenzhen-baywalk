import {Vector2,LineCurve,CubicBezierCurve} from 'three';
import {roadProfiles,atStation} from './road-profiles.js';

export function pedestrianNetwork(map,parkPaths=[]){
  const nodes=new Map(),edges=[],bridge=map.landmarks.starBridge.pathId;
  const profiles=roadProfiles(map);
  function junction(coord,upper){
    const key=coord.join(',')+(upper?'@upper':'');
    if(!nodes.has(key))nodes.set(key,{point:new Vector2(...coord),out:[]});
    return nodes.get(key);
  }
  for(const road of [...map.roads,...parkPaths]){
    if(!/^(footway|pedestrian|path|steps)$/.test(road.kind)||road.tunnel||road.indoor||road.layer<0)continue;
    const profile=profiles.get(road);
    if(road.kind==='steps'&&!profile)continue;
    for(let i=1;i<road.p.length;i++){
      const s0=profile?.distances[i-1]??0,s1=profile?.distances[i]??0;
      const start=junction(road.p[i-1],profile?.urban&&atStation(profile,s0).y>6.20),end=junction(road.p[i],profile?.urban&&atStation(profile,s1).y>6.20),length=start.point.distanceTo(end.point);
      if(length<.08)continue;
      const dir=end.point.clone().sub(start.point).divideScalar(length);
      const ceiling=(x,z)=>profile?atStation(profile,s0+Math.max(0,Math.min(length,(x-start.point.x)*dir.x+(z-start.point.y)*dir.y))).y+.92:
        road.bridge||road.layer>0?Infinity:1.2;
      const common={length,width:road.width||2.6,star:road.id===bridge,ceiling};
      const forward={...common,start,end,dir},back={...common,start:end,end:start,dir:dir.clone().negate()};
      forward.reverse=back;back.reverse=forward;
      start.out.push(forward);end.out.push(back);edges.push(forward);
    }
  }
  return edges;
}
const laneWidth=(edge,lane)=>Math.min(edge.width*.22,edge.star?3.2:1.18)*lane;
function laneAt(edge,station,lane){
  const off=laneWidth(edge,lane),{dir,start}=edge;
  return new Vector2(start.point.x+dir.x*station-dir.y*off,start.point.y+dir.y*station+dir.x*off);
}
function continuation(edge,rng){
  const choices=edge.end.out.filter(next=>next.end!==edge.start);
  if(!choices.length)return edge.reverse;
  let best=choices[0],score=-Infinity;
  for(const next of choices){const s=edge.dir.dot(next.dir)+rng()*.85;if(s>score){score=s;best=next;}}
  return best;
}

// Each corner is joined to both lane tangents. Distance on the curved section
// drives the same animation clock as distance on a straight path.
export class WalkingRoute{
  ceiling(x=this.point.x,z=this.point.y){return this.edge.ceiling(x,z);}
  headingAhead(metres){
    const station=this.station+metres;
    if(station<this.lineLength)return Math.atan2(this.edge.dir.x,this.edge.dir.y);
    if(station>=this.length)return Math.atan2(this.next.dir.x,this.next.dir.y);
    const tangent=this.bend.getTangentAt((station-this.lineLength)/(this.length-this.lineLength));
    return Math.atan2(tangent.x,tangent.y);
  }
  constructor(edge,station,lane,rng){
    this.lane=lane;this.rng=rng;this.point=laneAt(edge,station,lane);
    this.heading=Math.atan2(edge.dir.x,edge.dir.y);
    this.plan(edge,station);
  }
  plan(edge,station){
    this.edge=edge;
    const next=this.next=continuation(edge,this.rng),reverse=next===edge.reverse;
    const angle=Math.acos(Math.min(1,Math.max(-1,edge.dir.dot(next.dir))));
    const trim=Math.min(1.05+angle*.64,edge.length*.32,next.length*.32,edge.length-station);
    const entry=laneAt(edge,edge.length-trim,this.lane),exit=laneAt(next,trim,this.lane);
    this.line=new LineCurve(this.point.clone(),entry);
    const handle=reverse?Math.min(trim*.92,1.34*laneWidth(edge,this.lane)):trim*.67;
    this.bend=new CubicBezierCurve(entry,entry.clone().addScaledVector(edge.dir,handle),
      exit.clone().addScaledVector(next.dir,-handle),exit);
    this.bend.arcLengthDivisions=16;
    this.lineLength=this.line.getLength();this.length=this.lineLength+this.bend.getLength();
    this.nextStation=trim;this.station=0;this.turn=angle/Math.PI;
  }
  detour(city,carAt){
    // Turn into the returning walking lane before a parked car or an unmapped
    // barrier. Only take the arc when its entire footprint is on usable ground.
    const edge=(this.station>(this.lineLength+this.length)*.5?this.next:this.edge).reverse;
    const station=Math.min(edge.length-.04,Math.max(.04,this.point.clone().sub(edge.start.point).dot(edge.dir)+1));
    const end=laneAt(edge,station,this.lane),forward=new Vector2(Math.sin(this.heading),Math.cos(this.heading));
    const arm=Math.min(.75,this.point.distanceTo(end)*.38);
    const arc=new CubicBezierCurve(this.point.clone(),this.point.clone().addScaledVector(forward,arm),end.clone().addScaledVector(edge.dir,-arm),end);
    let floor=city.groundHeight(this.point.x,this.point.y,this.ceiling());
    for(let i=1;i<=12;i++){
      const p=arc.getPoint(i/12),limit=this.ceiling(p.x,p.y),h=city.groundHeight(p.x,p.y,limit);
      if(!city.isWalkable(p.x,p.y,limit)||Math.abs(h-floor)>.30||carAt?.(p.x,p.y,.26,h))return;
      floor=h;
    }
    this.lineLength=this.station=0;this.bend=arc;this.length=arc.getLength();this.next=edge;this.nextStation=station;this.turn=1;
  }
  advance(metres,city,carAt){
    const before=Math.min(1,Math.max(0,1-(this.lineLength-this.station)/1.8));
    let remaining=metres*(1-this.turn*before*.55),travel=0;
    this.avoidIn=Math.max(0,(this.avoidIn||0)-metres);
    while(remaining>1e-6){
      const step=Math.min(remaining,this.length-this.station),s=this.station+step;
      const straight=s<this.lineLength,curve=straight?this.line:this.bend;
      const t=straight?s/this.lineLength:(s-this.lineLength)/Math.max(.000001,this.length-this.lineLength);
      const pos=curve.getPointAt(Math.min(1,t));
      if(city.signals&&!city.signals.allowsPedestrian(this.point,pos))break;
      // A walking stride needs space beyond the next root position.
      const ahead=curve.getPointAt(Math.min(1,t+.42/Math.max(.01,straight?this.lineLength:this.length-this.lineLength)));
      const limit=this.ceiling(pos.x,pos.y),floor=city.groundHeight(pos.x,pos.y,limit);
      if(!city.isWalkable(pos.x,pos.y,limit)||!city.isWalkable(ahead.x,ahead.y,this.ceiling(ahead.x,ahead.y))||Math.abs(floor-city.groundHeight(this.point.x,this.point.y,this.ceiling()))>.35||carAt?.(ahead.x,ahead.y,.26,floor)||carAt?.(pos.x,pos.y,.26,floor)){
        if(!this.avoidIn){this.detour(city,carAt);this.avoidIn=1.2;}
        break;
      }
      const tangent=curve.getTangentAt(Math.min(1,t));
      if(tangent.lengthSq()>.1)this.heading=Math.atan2(tangent.x,tangent.y);
      this.point.copy(pos);this.station=s;travel+=step;remaining-=step;
      if(s>=this.length-1e-7)this.plan(this.next,this.nextStation);
    }
    return travel;
  }
}
