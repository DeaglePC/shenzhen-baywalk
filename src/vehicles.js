import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {loadDetailedVehicle} from './vehicle-hero.js';
import {installVehicleSnow} from './vehicle-snow.js';
import {streetObstacles,TrafficOccupancy,bodiesOverlap,trafficJunctions} from './traffic-collision.js';
import {detailedFleet} from './detailed-fleet.js';
import {curbTaxi,curbModel3} from './taxi-framing.js';
import {roadProfiles,atStation} from './road-profiles.js';
import {trafficSignals,bindSignalStops,signalAspect} from './traffic-signals.js';

// The imported traffic pack includes mirror tips in its bounds. All cars face +Z.
export const VEHICLE_CATALOG = [
  { id: 'e6', name: '比亚迪 e6 · 深圳巴士集团鹏程出租车', size: [4.695, 1.810, 1.670], wheelbase: 2.8, radius: .325, colors: ['#3982BC'] },
  { id: 'model3', name: '特斯拉 Model 3 · 焕新版', size: [4.720, 1.848, 1.442], wheelbase: 2.875, radius: .3451, colors: ['#373737'] },
  { id: 'tang', name: '城市 SUV', size: [5.189, 2.327, 1.950], wheelbase: 3.073, radius: .423, colors: ['#566671', '#D7D8D1', '#48545F', '#53383C'] },
  { id: 'mifa9', name: '商务 MPV', size: [5.186, 2.102, 1.984], wheelbase: 3.196, radius: .3578, colors: ['#794e59', '#505D6A', '#C7C1B2', '#343B42'] },
  { id: 'civic', name: '三厢轿车', size: [4.905, 2.185, 1.510], wheelbase: 2.943, radius: .3426, colors: ['#a54143', '#DFDCDA', '#344558', '#979B9D'] },
  { id: 'mini', name: '紧凑两厢车', size: [4.451, 1.960, 1.522], wheelbase: 2.705, radius: .3375, colors: ['#508d98', '#D8C4BA', '#BAD2D8', '#C6C2D7'] },
];

const UP = new THREE.Vector3(0, 1, 0);
const AXLE = new THREE.Vector3(1, 0, 0);
const ROAD = /^(primary|secondary|tertiary|motorway|trunk|residential|unclassified|living_street|service)(_link)?$/;
const modelPath = id => `${import.meta.env.BASE_URL}models/${id==='e6'?'e6-pengcheng-traffic':id}.glb`;
const pointId = p => p.join(',');

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function createNetwork(roads,blocked,profiles) {
  const restricted=new Set(['private','no','permit','bus']);
  const usable=roads.filter(r=>ROAD.test(r.kind)&&!r.tunnel&&(r.layer??0)>=0&&r.width>=3.2&&
    !restricted.has(r.motorVehicle??r.access)&&r.service!=='emergency_access');
  const envelope = [0,1,2].map(i => Math.max(...VEHICLE_CATALOG.map(v=>v.size[i])));
  const hits = new Map();
  for (const road of usable) {
    for (const key of new Set(road.p.map(pointId))) hits.set(key, (hits.get(key) || 0) + 1);
  }
  const exits = new Map();
  const lanes = [];
  function add(pts, road, reverse, startDistance) {
    const points = reverse ? [...pts].reverse() : pts;
    const lengths = [0], headings = [];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i - 1][0], dz = points[i][1] - points[i - 1][1];
      const len = Math.hypot(dx, dz);
      lengths.push(lengths[i - 1] + len);
      headings.push([dx / len, dz / len]);
    }
    const length = lengths.at(-1);
    if (length < 1.5) return;
    const lane = { road, points, lengths, headings, length, end: pointId(points.at(-1)), start: pointId(points[0]), id: lanes.length };
    lane.profile=profiles.get(road);lane.startDistance=startDistance+(reverse?length:0);lane.direction=reverse?-1:1;
    // Reject paths whose driving lane enters a ground-level building or water.
    const probe={lane,segment:0,s:0},steps=Math.ceil(length/2.4);
    for(let j=0;j<=steps;j++){
      probe.s=length*j/steps;sampleLane(probe);
      if(blocked(probe.x,probe.z,probe.yaw,...envelope,.22,probe.y))return;
    }
    lanes.push(lane);
    if (!exits.has(lane.start)) exits.set(lane.start, []);
    exits.get(lane.start).push(lane);
  }
  for (const road of usable) {
    let pts = [road.p[0]],distance=0,startDistance=0;
    for (let i = 1; i < road.p.length; i++) {
      if (pointId(road.p[i]) === pointId(pts.at(-1))) continue;
      distance+=Math.hypot(road.p[i][0]-pts.at(-1)[0],road.p[i][1]-pts.at(-1)[1]);pts.push(road.p[i]);
      if (i !== road.p.length - 1 && hits.get(pointId(road.p[i])) < 2) continue;
      add(pts, road, false,startDistance);
      if (!road.oneway) add(pts, road, true,startDistance);
      pts = [road.p[i]];startDistance=distance;
    }
  }
  // Peel off dead ends so a driver at a junction can prefer a continuous
  // route over a sequence of access roads that ends at a wall or a ramp.
  const incoming=new Map(),terminal=[];
  for(const lane of lanes){
    const dir=lane.headings.at(-1);
    lane.exits=(exits.get(lane.end)||[]).filter(next=>next.end!==lane.start&&
      next.headings[0][0]*dir[0]+next.headings[0][1]*dir[1]>-.78);
    lane.through=lane.exits.length;
    if(!lane.through)terminal.push(lane);
    for(const next of lane.exits){if(!incoming.has(next))incoming.set(next,[]);incoming.get(next).push(lane);}
  }
  for(let i=0;i<terminal.length;i++)for(const upstream of incoming.get(terminal[i])||[]){
    if(--upstream.through===0)terminal.push(upstream);
  }
  return lanes;
}

function sampleLane(car) {
  const { lane, s } = car;
  let i = car.segment;
  while (i + 1 < lane.headings.length && lane.lengths[i + 1] < s) i++;
  while (i > 0 && lane.lengths[i] > s) i--;
  car.segment = i;
  const [dx, dz] = lane.headings[i];
  const d = s - lane.lengths[i];
  let hx = dx, hz = dz;
  // Ease the visual steering before and after a mapped bend.
  const previous = lane.headings[i - 1], next = lane.headings[i + 1];
  const remaining = lane.lengths[i + 1] - s;
  if (d < 3 && previous) {
    const a = .5 * (1 - d / 3);
    hx += (previous[0] - dx) * a; hz += (previous[1] - dz) * a;
  } else if (remaining < 3 && next) {
    const a = .5 * (1 - remaining / 3);
    hx += (next[0] - dx) * a; hz += (next[1] - dz) * a;
  }
  const section=lane.profile&&atStation(lane.profile,lane.startDistance+lane.direction*s);
  car.y=section?.y??.28;car.pitch=section?-Math.atan(section.slope*lane.direction):0;
  const width=section?.width??lane.road.width, count=lane.road.lanes||1;
  let drivingOffset=lane.road.oneway?(count%2===0?width/(2*count):0):Math.min(3.1,width*.23);
  if(!lane.road.oneway&&count>=4&&count%2===0)drivingOffset=width/count*((car.lanePreference??0)>0?1.5:.5);
  if(lane.profile?.family&&lane.road.oneway&&count>=3)
    drivingOffset+=(car.lanePreference??0)*(width-.68)/count*section.blend;
  const offset=car.kerb??drivingOffset;
  car.x = lane.points[i][0] + dx * d - hz * offset;
  car.z = lane.points[i][1] + dz * d + hx * offset;
  car.yaw = Math.atan2(hx, hz);
}

function junctionTurn(car,random,blocked){
  const lane=car.lane,from=Math.max(car.s,lane.length-Math.min(6,lane.length*.38));
  const start={lane,s:from,segment:lane.headings.length-1,lanePreference:car.lanePreference};sampleLane(start);
  const incoming=lane.headings.at(-1),choices=[];
  for(const next of lane.exits){
    if(lane.through&&!next.through)continue;
    const aim=next.headings[0],dot=incoming[0]*aim[0]+incoming[1]*aim[1];
    choices.push({next,rank:(next.through?2:0)+dot+random()*.88});
  }
  choices.sort((a,b)=>b.rank-a.rank);
  for(const {next} of choices){
    const to=Math.min(6,next.length*.38),end={lane:next,s:to,segment:0,lanePreference:car.lanePreference};sampleLane(end);
    const a=new THREE.Vector2(start.x,start.z),d=new THREE.Vector2(end.x,end.z);
    const arm=a.distanceTo(d)*.38;
    const curve=new THREE.CubicBezierCurve(a,a.clone().add(new THREE.Vector2(Math.sin(start.yaw),Math.cos(start.yaw)).multiplyScalar(arm)),
      d.clone().sub(new THREE.Vector2(Math.sin(end.yaw),Math.cos(end.yaw)).multiplyScalar(arm)),d);
    curve.arcLengthDivisions=24;
    const length=curve.getLength(),n=Math.max(2,Math.ceil(length/.85));
    let clear=length>.15;
    for(let i=0;clear&&i<=n;i++){
      const t=i/n,p=curve.getPointAt(t),v=curve.getTangentAt(t);
      clear=!blocked(p.x,p.y,Math.atan2(v.x,v.y),car.l*2,car.w*2,car.height,.22,THREE.MathUtils.lerp(start.y,end.y,t));
    }
    if(clear)return {from,to,curve,length,next,y0:start.y,y1:end.y};
  }
  return null;
}
function followingPose(car,travel,pose){
  const turn=car.turn,s=car.s+travel;
  Object.assign(pose,{lane:car.lane,s,segment:car.segment,l:car.l,w:car.w,height:car.height,radius:car.radius,lanePreference:car.lanePreference});
  if(turn&&s>=turn.from){
    const u=(s-turn.from)/turn.length;
    if(u<1){
      const p=turn.curve.getPointAt(u),v=turn.curve.getTangentAt(u);
      pose.x=p.x;pose.z=p.y;pose.yaw=Math.atan2(v.x,v.y);
      pose.y=THREE.MathUtils.lerp(turn.y0,turn.y1,u);pose.pitch=-Math.atan2(turn.y1-turn.y0,turn.length);return;
    }
    pose.lane=turn.next;pose.segment=0;pose.s=Math.min(turn.next.length,turn.to+s-turn.from-turn.length);
  }else pose.s=Math.min(pose.s,car.lane.length);
  sampleLane(pose);
}

export function makeTraffic(data, options={}) {
  const random = randomGenerator(20261121);
  const blocked=streetObstacles(data,options.stadiumAreas),occupied=new TrafficOccupancy();
  const hero={x:curbTaxi.x,z:curbTaxi.z,yaw:curbTaxi.yaw,y:curbTaxi.floor,model:'e6'};
  const spots=options.parkedSpots?.length?options.parkedSpots:[hero,{...curbModel3,y:curbModel3.floor,model:'model3'}];
  const fixed=spots.map(p=>{
    const [length,width]=(VEHICLE_CATALOG.find(m=>m.id===p.model)??VEHICLE_CATALOG[0]).size;
    return {...p,yaw:p.yaw||0,l:length/2,w:width/2,radius:Math.hypot(length,width)/2};
  });
  function laneBlocked(x,z,yaw,length,width,height,pad,y){
    if(blocked(x,z,yaw,length,width,height,pad,y))return true;
    return fixed.some(car=>Math.abs(car.x-x)<7&&Math.abs(car.z-z)<7&&
      bodiesOverlap({x,z,y,yaw,height,l:length/2,w:width/2,radius:Math.hypot(length,width)/2},car,.18));
  }
  const lanes=createNetwork(data.roads,laneBlocked,roadProfiles(data)),junctionAt=trafficJunctions(lanes);
  const signals=options.signals??trafficSignals(data);
  bindSignalStops(lanes,signals);
  function planTurn(c){
    if(c.turn===undefined)c.turn=junctionTurn(c,random,laneBlocked);
    return c.turn;
  }
  function nextTurn(turn,c){
    if(turn.follow===undefined)turn.follow=junctionTurn({...c,lane:turn.next,s:turn.to},random,laneBlocked);
    return turn.follow;
  }
  function signalLimit(c){
    let lane=c.lane,start=c.s,ahead=0,turn;
    for(let hop=0;hop<5&&ahead<36;hop++){
      for(const gate of lane.signalStops){
        const front=ahead+gate.s-start-c.l;
        if(front<-.02||front>35)continue;
        if(gate===c.clearing){
          if(front<.1||c.speed>.18)continue;
          // A queue may have stopped a committed driver before the line.
          c.clearing=null;
        }
        const {arm}=gate;
        let movement='through';
        if(arm.protectedLeft){
          // A divided junction often has several short internal ways. Reserve
          // the actual route before deciding which arrow this driver needs.
          const end=lane.points.at(-1),center=arm.site.center;
          const inJunction=Math.hypot(end[0]-center[0],end[1]-center[1])<=arm.site.radius+8;
          let link=inJunction?(hop?nextTurn(turn,c):planTurn(c)):null;
          for(let i=0;link&&i<7;i++){
            const next=link.next,dir=next.headings[0];
            if(arm.dir[0]*dir[1]-arm.dir[1]*dir[0]<-.46){movement='left';break;}
            if(Math.hypot(next.points.at(-1)[0]-arm.site.center[0],next.points.at(-1)[1]-arm.site.center[1])>arm.site.radius+8)break;
            link=nextTurn(link,c);
          }
        }
        const aspect=signalAspect(arm,movement,signals.time);
        if(aspect==='amber'&&front<c.speed*.55+c.speed*c.speed/8){
          c.clearing=gate;continue;
        }
        if(aspect!=='green')return Math.max(0,front-.48);
      }
      if(ahead+lane.length-start>38)break;
      turn=hop?nextTurn(turn,c):planTurn(c);
      if(!turn)break;
      ahead+=turn.from+turn.length-start;lane=turn.next;start=turn.to;
    }
    return Infinity;
  }
  const cars = [], distribution = [0, 0, 0, 1, 1, 2, 2, 3, 4, 4, 5];
  function vehicle(lane, s, parked, model, fixedColor = false) {
    const def = VEHICLE_CATALOG[model];
    return {
      model, lane, s, parked, segment: 0, wheel: random() * Math.PI, lanePreference:cars.length%3-1,
      color: new THREE.Color(def.colors[fixedColor ? 0 : Math.floor(random() * def.colors.length)]),
      cruise: (lane?.road.kind === 'service' ? 3 : lane?.road.kind === 'residential' ? 6 : 8) + random() * 3.6,
      speed:4,granted:Infinity,x:0,z:0,yaw:0,l:def.size[0]/2,w:def.size[1]/2,height:def.size[2],radius:Math.hypot(def.size[0],def.size[1])/2,
    };
  }
  function spawn(car){
    if(!car.parked&&junctionAt(car.x,car.z,car.y))return;
    if(blocked(car.x,car.z,car.yaw,car.l*2,car.w*2,car.height,.1,car.y)||occupied.blocked(car,null))return;
    occupied.place(car);cars.push(car);
  }
  for (const lane of lanes) {
    const rd = lane.road;
    const spacing = rd.kind === 'service' ? 260 : rd.kind === 'residential' ? 155 : 125;
    for (let s = 4 + random() * spacing; lane.through && s < lane.length - 4; s += spacing * (.75 + random() * .55)) {
      const model = distribution[Math.floor(random() * distribution.length)];
      const car = vehicle(lane, s, false, model);
      sampleLane(car); spawn(car);
    }
    if (rd.bridge||rd.layer>0||!['residential', 'tertiary', 'unclassified', 'service'].includes(rd.kind) || rd.width < 6 || lane.length < 36 || random() > .47) continue;
    for (let s = 12 + random() * 22; s < lane.length - 11; s += 16 + random() * 42) {
      const car = vehicle(lane, s, true, Math.floor(random() * 6));
      car.kerb = Math.max(1.5, rd.width / 2 - 1.06);
      const drivingOffset=lane.road.oneway?(rd.lanes>1?.75:0):Math.min(3.1,rd.width*.23);
      if(car.kerb-drivingOffset<car.w+1.17)continue;
      sampleLane(car);spawn(car);
    }
  }
  for (const spot of spots) {
    const index = VEHICLE_CATALOG.findIndex(m => m.id === spot.model);
    const car = vehicle(null, 0, true, Math.max(0, index), true);
    Object.assign(car, { x: spot.x, z: spot.z, yaw: spot.yaw || 0, y: spot.y, wheel:0, hero:true });
    // Reserve the authored photo poses even when a random parked car selected the same bay.
    for(let i=cars.length-1;i>=0;i--){
      const other=cars[i];if(!bodiesOverlap(car,other))continue;
      occupied.cells.get(other.cell).delete(other);cars.splice(i,1);
    }
    spawn(car);
  }
  // Carry through-traffic into and out of the simulated district away from the
  // visible horizon. Otherwise cars eventually queue behind the frozen far LOD.
  const portals=[];
  for(const lane of lanes){
    if(!lane.through)continue;
    const n=Math.max(1,Math.ceil(lane.length/36)),probe={lane,segment:0};
    for(let i=0;i<n;i++){
      probe.s=(i+.5)*lane.length/n;sampleLane(probe);
      if(!junctionAt(probe.x,probe.z,probe.y))portals.push({...probe});
    }
  }
  let entries=[],entryIndex=0,zoneX=Infinity,zoneZ=Infinity,zoneRadius=0;
  function refreshEntries(eye,horizon){
    if(Math.hypot(eye.x-zoneX,eye.z-zoneZ)<18&&Math.abs(horizon-zoneRadius)<12)return;
    zoneX=eye.x;zoneZ=eye.z;zoneRadius=horizon;entryIndex=0;
    entries=portals.filter(p=>{
      const dx=eye.x-p.x,dz=eye.z-p.z,d=Math.hypot(dx,dz);
      return d>horizon+31&&d<horizon+86&&dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw)>d*.40;
    });
  }
  function reenter(c,eye,horizon){
    const dx=c.x-eye.x,dz=c.z-eye.z,d=Math.hypot(dx,dz);
    if(d<=horizon+32||dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw)<d*.10&&c.speed>.1)return false;
    for(let i=0;i<Math.min(12,entries.length);i++){
      const slot=entries[entryIndex++%entries.length];
      if(Math.hypot(slot.x-eye.x,slot.z-eye.z)<horizon+18)continue;
      const pose={...slot,l:c.l+.95,w:c.w,radius:c.radius+1,height:c.height,lanePreference:c.lanePreference};
      sampleLane(pose);
      if(occupied.blocked(pose,c)||blocked(pose.x,pose.z,pose.yaw,c.l*2,c.w*2,c.height,.1,pose.y))continue;
      if(c.junction){c.junction.owner=null;c.junction=null;}
      Object.assign(c,slot,{x:pose.x,z:pose.z,turn:undefined,clearing:null,leader:null,priority:false,granted:Infinity,speed:Math.min(5,c.cruise)});occupied.place(c);return true;
    }
    return false;
  }
  const occupancy = new Map();
  let queueAge=1,reservationAge=1;
  let moving=[];
  return {
    cars,
    blocksWalker:(x,z,radius=.23,y=.28)=>occupied.blocksWalker(x,z,y,radius),
    step(dt,eye,horizon) {
      if(dt<=0)return;
      if(!options.signals)signals.time+=dt;
      refreshEntries(eye,horizon);
      queueAge+=dt;
      reservationAge+=dt;
      if (queueAge>=.22) {
        queueAge=0; occupancy.clear(); moving=[];
        const limit=(horizon+96)**2;
        for (const c of cars) {
          if (c.parked || (c.x-eye.x)**2+(c.z-eye.z)**2>limit) continue;
          moving.push(c);
          const key=c.lane.id*3+(c.lane.profile?.family&&c.lane.road.lanes>=3?c.lanePreference:0);
          if (!occupancy.has(key)) occupancy.set(key, []);
          occupancy.get(key).push(c);
        }
        for (const group of occupancy.values()) {
          group.sort((a, b) => b.s - a.s);
          for (let i=0;i<group.length;i++) group[i].leader=group[i-1];
        }
      }
      const walkers=options.walkers?.(),pose={};
      if(reservationAge>=.18){
        reservationAge=0;
        const reserved=new TrafficOccupancy();
        // The first driver with a clear path holds enough space to finish a
        // crossing. A second approach waits before its nose enters that path.
        const order=moving.slice().sort((a,b)=>Number(!!b.priority)-Number(!!a.priority)||b.speed-a.speed);
        for(const c of order){
          if(c.turn===undefined&&c.lane.length-c.s<26)c.turn=junctionTurn(c,random,laneBlocked);
          const here=junctionAt(c.x,c.z,c.y);
          if(c.junction){
            if(here===c.junction)c.entered=true;
            else if(c.entered||c.speed<.1){c.junction.owner=null;c.junction=null;}
          }
          const limit=signalLimit(c),samples=[],reach=Math.min(16,8+c.speed*.7,limit);
          c.granted=limit;
          for(let s=.4;s<reach;s+=1.7){
            followingPose(c,s,pose);
            const junction=junctionAt(pose.x,pose.z,pose.y);
            if(junction&&!junction.owner&&!c.junction&&limit===Infinity){
              // Reserve the junction only with room to leave it. The same
              // reservation spans both halves of a split carriageway.
              let clear=true;const ahead={};
              for(let exit=s;exit<s+40;exit+=2){
                followingPose(c,exit,ahead);
                if(occupied.blocked(ahead,c,walkers)){clear=false;break;}
                if(!junctionAt(ahead.x,ahead.z,ahead.y)&&exit>s+4)break;
              }
              if(clear){junction.owner=c;c.junction=junction;c.entered=here===junction;}
            }
            if((junction&&junction.owner!==c)||occupied.blocked(pose,c,walkers)||reserved.blocked(pose,c)){
              c.granted=Math.max(0,s-1.8);break;
            }
            samples.push({...pose,owner:c});
          }
          c.priority=c.granted>4;
          for(const p of samples)reserved.place(p);
        }
      }
      for(const c of moving){
        if(reenter(c,eye,horizon))continue;
        if(c.turn===undefined&&c.lane.length-c.s<26)c.turn=junctionTurn(c,random,laneBlocked);
        const leader=c.leader;
        const free=leader?.lane===c.lane?Math.max(0,leader.s-c.s-c.l-leader.l-1.1):Infinity;
        if(c.clearing&&Math.hypot(c.x-c.clearing.arm.stop[0],c.z-c.clearing.arm.stop[1])>42)c.clearing=null;
        const end=Math.min(c.turn===null?Math.max(0,c.lane.length-c.s-.45):Infinity,signalLimit(c));
        let desired=Math.min(c.cruise,free*.68,Math.sqrt(6*end),Math.sqrt(6*(c.granted??Infinity)));
        if(c.turn&&c.s>c.turn.from-3)desired=Math.min(desired,6.5);
        c.speed+=THREE.MathUtils.clamp(desired-c.speed,-5*dt,2.2*dt);
        const travel=Math.max(0,Math.min(c.speed*dt,free,end,c.granted??Infinity));
        if(travel<.00001)continue;
        // Substeps cover both translation and steering even on a delayed frame.
        let moved=0;
        while(moved<travel-1e-7){
          const step=Math.min(.42,travel-moved);
          followingPose(c,step,pose);
          if(blocked(pose.x,pose.z,pose.yaw,c.l*2,c.w*2,c.height,.14,pose.y)||occupied.blocked(pose,c,walkers)){c.speed=0;break;}
          if(c.lane!==pose.lane)c.turn=c.turn?.follow;
          c.lane=pose.lane;c.s=pose.s;c.segment=pose.segment;c.x=pose.x;c.z=pose.z;c.y=pose.y;c.pitch=pose.pitch;c.yaw=pose.yaw;
          occupied.place(c);moved+=step;
        }
        c.granted=Math.max(0,c.granted-moved);
        c.wheel=(c.wheel+moved/VEHICLE_CATALOG[c.model].radius)%(Math.PI*2);
      }
    },
  };
}

// Preserve each material's physical response with one instanced body draw per type.
function packMeshes(parts) {
  const chunks = [];
  const headTint = new THREE.Color(1.0, .96, .86), tailTint = new THREE.Color(1.0, .12, .08);
  for (const { mesh, matrix } of parts) {
    const original = mesh.geometry;
    const g = original.clone();
    g.applyMatrix4(matrix);
    const mat = mesh.material, count = g.attributes.position.count;
    const mName = mat.name || '';
    const paint = mName === 'Body paint';
    const exterior=/paint|pearl white|glass|windscreen|roof|frit|solar band|satin black trim/i.test(mName);
    const isCombinedLamp = /headlamps and tail lamps/i.test(mName);
    const isHeadLamp = /headlight|traffic headlight|white ribbon diffuser|drl|projector/i.test(mName);
    const isTailLamp = /rear light|traffic rear|ruby tail|stop lamp|garnet lens|tail optics/i.test(mName);
    const col = paint ? new THREE.Color(1, 1, 1) : mat.color;
    const colors = new Float32Array(count * 3), surface = new Float32Array(count * 4);
    const baseGlow = mat.emissive ? Math.max(mat.emissive.r, mat.emissive.g, mat.emissive.b) * mat.emissiveIntensity : 0;
    const posAttr = g.attributes.position;
    for (let i = 0; i < count; i++) {
      let c = col, glow = baseGlow;
      if (isCombinedLamp) {
        const front = posAttr.getZ(i) > 0;
        c = front ? headTint : tailTint;
        glow = front ? 2.6 : 1.9;
      } else if (isHeadLamp) {
        c = headTint;
        glow = Math.max(baseGlow, 2.8);
      } else if (isTailLamp) {
        c = tailTint;
        glow = Math.max(baseGlow, 2.1);
      }
      c.toArray(colors, i * 3);
      surface.set([mat.metalness ?? 0, mat.roughness ?? .5, glow, +paint], i * 4);
    }
    for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    if (!g.index) g.setIndex(Array.from({ length: count }, (_, i) => i));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('vehicleSurface', new THREE.BufferAttribute(surface, 4));
    g.setAttribute('snowExposure',new THREE.Uint8BufferAttribute(new Uint8Array(count).fill(Number(exterior)),1));
    chunks.push(g);
  }
  const joined = mergeGeometries(chunks);
  for (const g of chunks) g.dispose();
  return joined;
}

function fleetMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .3 });
  mat.userData.packedTraffic=true;
  const night = { value: .25 };
  mat.onBeforeCompile = shader => {
    shader.uniforms.vehicleNight = night;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute vec4 vehicleSurface; varying vec4 vVehicleSurface;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        vVehicleSurface = vehicleSurface;
        vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, vehicleSurface.w);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec4 vVehicleSurface; uniform float vehicleNight;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vVehicleSurface.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vVehicleSurface.x;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += diffuseColor.rgb * vVehicleSurface.z * vehicleNight;');
  };
  return { mat, night };
}

function instance(geometry, material, capacity, group) {
  const m = new THREE.InstancedMesh(geometry, material, capacity);
  m.count = 0; m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.setColorAt(0, new THREE.Color(1,1,1));
  group.add(m);
  return m;
}

function setupType(scene, material, group) {
  scene.updateMatrixWorld(true);
  const body = [], wheel = [], glazings = [], marks = [], offsets = [],distant=[];
  scene.traverse(node => {
    if (node.name.startsWith('wheel_') && node.userData.rolling_radius) offsets.push(node.position.clone());
    if (!node.isMesh) return;
    let root=node;
    while (root.parent && !root.userData.rolling_radius && !root.userData.design_reference && !root.userData.distant_taxi && !root.userData.distant_vehicle) root=root.parent;
    if(root.userData.distant_taxi||root.userData.distant_vehicle){distant.push({mesh:node,matrix:node.matrixWorld});return;}
    if (root.userData.rolling_radius) {
      if (root.name !== 'wheel_LF') return;
      const local = root.matrixWorld.clone().invert().multiply(node.matrixWorld);
      wheel.push({ mesh:node, matrix:local }); return;
    }
    if (node.material.map) marks.push(node);
    else if (node.material.transparent) glazings.push(node);
    else body.push({ mesh:node, matrix:node.matrixWorld });
  });
  const capacity = 45;
  const near = instance(packMeshes(body), material, capacity, group);
  const rim = wheel.length===1 && wheel[0].mesh.material.map ? wheel[0] : null;
  const wheels = rim
    ? instance(rim.mesh.geometry.clone().applyMatrix4(rim.matrix),rim.mesh.material.clone(),capacity*4,group)
    : instance(packMeshes(wheel),material,capacity*4,group);
  const white = new THREE.Color(1,1,1);
  if(rim) for(let i=0;i<capacity*4;i++) wheels.setColorAt(i,white);
  const extra = [...marks,...glazings].map(node => {
    const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const m = node.material.clone();
    if (m.map) { m.map.anisotropy=8; m.transparent=false; m.alphaTest=.35; m.depthWrite=true; }
    else { m.depthWrite=false; m.side=THREE.FrontSide; }
    if(m.userData.fleet_paint) {
      const base = new THREE.Color(m.userData.fleet_paint);
      m.userData.paintInverse = new THREE.Color(1/base.r,1/base.g,1/base.b);
      m.alphaTest = 0;
      m.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
          'diffuseColor.rgb *= mix(vec3(1.), vColor.rgb, sampledDiffuseColor.a); diffuseColor.a = 1.;');
      };
    }
    const obj = instance(g,m,capacity,group);
    // Standard materials multiply the instance colour; decals and glass retain their original tint.
    for (let i=0;i<capacity;i++) obj.setColorAt(i,new THREE.Color(1,1,1));
    return obj;
  });
  const farMat = material.clone(); farMat.onBeforeCompile=material.onBeforeCompile; farMat.side=THREE.DoubleSide;
  const far = instance(packMeshes(distant),farMat,440,group);
  return {near, wheels, extra, far, offsets, paintColor:new THREE.Color()};
}

function contactShadows(group) {
  const size=48,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=Math.abs(2*(x+.5)/size-1),v=Math.abs(2*(y+.5)/size-1);
    const edge=Math.hypot(Math.max(0,(u-.47)/.53), Math.max(0,(v-.60)/.40));
    const alpha=1-THREE.MathUtils.smoothstep(edge,0,1);
    pixels.set([255,255,255,Math.round(255*alpha)],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearFilter; texture.needsUpdate=true;
  const geo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const mat=new THREE.MeshBasicMaterial({map:texture,color:0x141822,transparent:true,opacity:.61,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const mesh=instance(geo,mat,1000,group);mesh.renderOrder=1;
  return mesh;
}

const LAMP_LAYOUT = [
  // halfX, headY, headZ, tailY, tailZ, beamLen, poolW
  { hx: .66, hy: .73, hz: 2.25, ty: .86, tz: -2.26, beam: 16.5, pw: 6.4 }, // e6
  { hx: .68, hy: .65, hz: 2.27, ty: .82, tz: -2.28, beam: 17.5, pw: 6.6 }, // model3
  { hx: .78, hy: .86, hz: 2.46, ty: .98, tz: -2.48, beam: 18.5, pw: 7.0 }, // tang
  { hx: .74, hy: .84, hz: 2.48, ty: .98, tz: -2.48, beam: 18.0, pw: 6.8 }, // mifa9
  { hx: .72, hy: .66, hz: 2.34, ty: .80, tz: -2.35, beam: 16.5, pw: 6.4 }, // civic
  { hx: .66, hy: .68, hz: 2.12, ty: .82, tz: -2.12, beam: 15.0, pw: 5.8 }, // mini
];

function createVehicleLighting(group, lowQuality = false) {
  // 1. Projected dual-beam road illumination pool ahead of each lit vehicle.
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = poolCanvas.height = 256;
  const pctx = poolCanvas.getContext('2d');
  pctx.clearRect(0, 0, 256, 256);
  // Two overlapping warm-white headlight throws fanning forward (y=256 is bumper, y=0 is far).
  for (const cx of [104, 152]) {
    const grad = pctx.createRadialGradient(cx, 236, 4, cx + (cx < 128 ? -16 : 16), 124, 134);
    grad.addColorStop(0, 'rgba(255, 248, 224, 0.95)');
    grad.addColorStop(0.22, 'rgba(255, 244, 212, 0.56)');
    grad.addColorStop(0.58, 'rgba(244, 236, 214, 0.19)');
    grad.addColorStop(1, 'rgba(230, 232, 240, 0.0)');
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.moveTo(cx - 10, 254);
    pctx.quadraticCurveTo(cx - 96, 135, cx - 108, 12);
    pctx.lineTo(cx + 108, 12);
    pctx.quadraticCurveTo(cx + 96, 135, cx + 10, 254);
    pctx.closePath();
    pctx.fill();
  }
  const poolTex = new THREE.CanvasTexture(poolCanvas);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  // Plane sits in XZ with z in [0, 1] (0 at bumper, +1 far forward)
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  poolGeo.translate(0, 0, 0.5);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: 0xfff3d8, transparent: true, opacity: .68,
    blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  function lightBatch(geometry, material, capacity, name, order) {
    const m = new THREE.InstancedMesh(geometry, material, capacity);
    m.count = 0; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.name = name; m.renderOrder = order;
    group.add(m);
    return m;
  }
  const pools = lightBatch(poolGeo, poolMat, 220, '汽车 · 路面车灯光斑', 3);

  // 2. Soft volumetric headlight light cones (view-angle & distance faded).
  const coneGeo = new THREE.CylinderGeometry(1.18, .12, 1, 12, 1, true);
  coneGeo.rotateX(Math.PI / 2);
  coneGeo.translate(0, 0, .5);
  const conePower = { value: 0 };
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { beamPower: conePower },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying float vAlong, vEdge;
      void main(){
        vAlong = position.z;
        vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);
        vec3 viewDir = normalize(-mvPos.xyz);
        vEdge = pow(abs(dot(n, viewDir)), 1.35);
        gl_Position = projectionMatrix * mvPos;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float beamPower;
      varying float vAlong, vEdge;
      void main(){
        #include <logdepthbuf_fragment>
        float fade = smoothstep(0.0, 0.08, vAlong) * pow(max(0.0, 1.0 - vAlong), 2.15);
        float alpha = fade * vEdge * beamPower * 0.24;
        if (alpha < 0.002) discard;
        vec3 col = mix(vec3(1.0, 0.96, 0.86), vec3(0.86, 0.92, 1.0), vAlong * 0.35);
        gl_FragColor = vec4(col * alpha, alpha);
      }`
  });
  const beams = lightBatch(coneGeo, coneMat, 260, '汽车 · 前照灯光束', 5);

  // 3. Directional headlamp & taillamp optical bloom flares (billboard-like crossed glow discs).
  const flareGeo = new THREE.PlaneGeometry(1, 1);
  const flarePower = { value: 0 };
  function makeFlareMat(isTail) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { flarePower },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv;
        varying float vFacing;
        void main(){
          vUv = uv;
          vec3 worldCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 lampDir = normalize((modelMatrix * instanceMatrix * vec4(0.0, 0.0, ${isTail ? '-1.0' : '1.0'}, 0.0)).xyz);
          vec3 toCam = normalize(cameraPosition - worldCenter);
          vFacing = smoothstep(-0.18, 0.65, dot(lampDir, toCam));
          float sz = length(instanceMatrix[0].xyz);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 worldPos = worldCenter + (right * position.x + up * position.y) * sz;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float flarePower;
        varying vec2 vUv;
        varying float vFacing;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float core = exp(-12.0 * r * r);
          float halo = exp(-3.4 * r * r) * (1.0 - smoothstep(0.65, 1.0, r));
          float streak = exp(-22.0 * p.y * p.y) * exp(-2.8 * p.x * p.x) * ${isTail ? '0.18' : '0.45'};
          float gain = (core * 1.15 + halo * 0.55 + streak) * (0.18 + 0.82 * vFacing) * flarePower;
          if (gain < 0.003) discard;
          vec3 col = ${isTail
            ? 'mix(vec3(1.0, 0.08, 0.05), vec3(1.0, 0.55, 0.42), core)'
            : 'mix(vec3(1.0, 0.92, 0.76), vec3(1.0, 0.99, 0.96), core)'};
          gl_FragColor = vec4(col * gain, clamp(gain, 0.0, 1.0));
        }`
    });
  }
  const headFlares = lightBatch(flareGeo, makeFlareMat(false), 480, '汽车 · 前大灯光晕', 6);
  const tailFlares = lightBatch(flareGeo, makeFlareMat(true), 480, '汽车 · 尾灯光晕', 6);

  // 4. Pool of real dynamic SpotLights for the nearest oncoming/nearby cars.
  const spotCount = lowQuality ? 0 : 4;
  const spots = [];
  for (let i = 0; i < spotCount; i++) {
    const light = new THREE.SpotLight(0xfff1d6, 0, 36, Math.PI * 0.27, 0.68, 1.45);
    light.castShadow = false;
    light.visible = false;
    group.add(light, light.target);
    spots.push(light);
  }

  return {
    pools, beams, headFlares, tailFlares, spots, conePower, flarePower, poolMat,
    dispose() {
      poolTex.dispose();
      for (const m of [pools, beams, headFlares, tailFlares]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    }
  };
}

export async function createVehicles(scene, data, options = {}) {
  const group = new THREE.Group(); group.name = 'Shenzhen road traffic';
  group.userData.excludeFromProbe=true;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const traffic = makeTraffic(data, options);
  const [assets,taxi,tesla] = await Promise.all([
    Promise.all(VEHICLE_CATALOG.map(s => loader.loadAsync(modelPath(s.id)))),
    loadDetailedVehicle('e6'),loadDetailedVehicle('model3')
  ]);
  const { mat,night } = fleetMaterial();
  const types = assets.map(asset => setupType(asset.scene,mat,group));
  const snowFinishes=new Set([mat]);
  for(const type of types){
    snowFinishes.add(type.far.material);
    for(const obj of type.extra)snowFinishes.add(obj.material);
  }
  // Detailed street models have their own material instances, separate from the studio viewer.
  const outside=/clearcoat|Body paint|windscreen|panoramic roof|roof shell|roof screen prints|roof cap enamel|window frit|ceramic frit|solar band/i;
  for(const asset of [taxi,tesla])asset.model.traverse(o=>{
    if(o.isMesh&&outside.test(o.material.name))snowFinishes.add(o.material);
  });
  function enableSnow(amount){
    for(const material of snowFinishes)installVehicleSnow(material,amount);
    snowFinishes.clear();
  }
  const shadow=contactShadows(group);
  const lighting=createVehicleLighting(group,!!options.low);
  scene.add(group);
  const masters=new Map([['e6',detailedFleet(taxi,'e6',group)],['model3',detailedFleet(tesla,'model3',group)]]);
  const pos=new THREE.Vector3(), rot=new THREE.Quaternion(), scale=new THREE.Vector3(1,1,1);
  const transform=new THREE.Matrix4(), wheelLocal=new THREE.Matrix4(), wheelWorld=new THREE.Matrix4();
  const wheelRot=new THREE.Quaternion(), flip=new THREE.Quaternion().setFromAxisAngle(UP,Math.PI);
  const beamTilt=new THREE.Quaternion().setFromAxisAngle(AXLE,0.065);
  const localLamp=new THREE.Matrix4(), lampWorld=new THREE.Matrix4(), lampPos=new THREE.Vector3(), lampScale=new THREE.Vector3();
  const spotOrigin=new THREE.Vector3(), spotTarget=new THREE.Vector3();
  const buckets = types.map(() => []);
  const litNearest = [];
  const isBlocked=traffic.blocksWalker;
  let nightLevel=0, weatherKind='clear', headlightsMode='auto', headlightsActive=false;
  function syncLightStrength(){
    const isNightLike = nightLevel >= .45 || weatherKind === 'aurora';
    const autoOn = isNightLike || weatherKind === 'rain' || weatherKind === 'snow';
    headlightsActive = headlightsMode === 'on' ? true : headlightsMode === 'off' ? false : autoOn;
    const effectiveNight = weatherKind === 'aurora' ? Math.max(nightLevel, 1) : nightLevel;
    const nightBoost = .55 + effectiveNight * .85;
    const weatherBoost = weatherKind === 'rain' || weatherKind === 'snow' ? 1.28 : 1;
    const power = headlightsActive ? nightBoost : 0;
    night.value = headlightsActive ? (1.1 + effectiveNight * 2.5) : (.12 + effectiveNight * .25);
    taxi.setLights(power, effectiveNight);
    tesla.setLights(power, effectiveNight);
    lighting.poolMat.opacity = headlightsActive ? (.22 + effectiveNight * .52) : 0;
    lighting.conePower.value = headlightsActive ? ((.18 + effectiveNight * .88) * weatherBoost) : 0;
    lighting.flarePower.value = headlightsActive ? (.52 + effectiveNight * .62) : 0;
    const show = headlightsActive;
    lighting.pools.visible = show;
    lighting.beams.visible = show;
    lighting.headFlares.visible = show;
    lighting.tailFlares.visible = show;
    if (!show) {
      for (const s of lighting.spots) { s.visible = false; s.intensity = 0; }
    }
  }
  syncLightStrength();
  function update(dt, eye) {
    if (!eye) return;
    dt = Math.max(0, Math.min(.15, dt || 0));
    for (const list of buckets) list.length=0;
    const horizon = Math.min(2050, Math.max(560, eye.y * 2.8));
    traffic.step(dt,eye,horizon);
    const floor = options.roadSurfaceY ?? .28;
    const probe=scene.userData.streetProbe,origin=probe?.userData.capturePosition;
    const environment=origin&&origin.distanceToSquared(eye)<150**2?probe:null;
    shadow.count=0;
    lighting.pools.count=0; lighting.beams.count=0; lighting.headFlares.count=0; lighting.tailFlares.count=0;
    litNearest.length=0;
    const emitBeams = headlightsActive && !scene.userData.capturingProbe;
    for (const car of traffic.cars) {
      const dx=car.x-eye.x, dz=car.z-eye.z;
      car.distance=dx*dx+dz*dz;
      if (car.distance<horizon*horizon) buckets[car.model].push(car);
    }
    for (let m=0;m<types.length;m++) {
      const t=types[m], list=buckets[m], layout=LAMP_LAYOUT[m];
      list.sort((a,b)=>a.distance-b.distance);
      const detail=masters.get(VEHICLE_CATALOG[m].id);
      let detailCount=0;
      if(detail&&!scene.userData.capturingProbe){
        for(const car of list){
          const dist2=car.distance+(eye.y-(car.y??floor))**2;
          car.showMaster=dist2<(car.showMaster?54:48)**2;
          if(car.showMaster)detailCount++;
        }
      }
      detail?.begin(detailCount,environment);
      let close=0, far=0;
      for (const car of list) {
        if(scene.userData.capturingProbe&&car.distance<4**2)continue;
        pos.set(car.x,car.y??floor,car.z); rot.setFromAxisAngle(UP,car.yaw);
        if(car.pitch)rot.multiply(wheelRot.setFromAxisAngle(AXLE,car.pitch));
        transform.compose(pos,rot,scale);
        if(detailCount&&car.showMaster){
          detail.add(transform,car.wheel);
        } else if (car.distance+(eye.y-pos.y)**2 < (detail?125:65)**2 && close<45) {
          t.near.setMatrixAt(close,transform); t.near.setColorAt(close,car.color);
          for (const item of t.extra) {
            item.setMatrixAt(close,transform);
            const inverse=item.material.userData.paintInverse;
            if(inverse) item.setColorAt(close,t.paintColor.copy(car.color).multiply(inverse));
          }
          t.offsets.forEach((off,k) => {
            wheelRot.setFromAxisAngle(AXLE,car.wheel);
            if (off.x>0) wheelRot.multiply(flip);
            wheelLocal.compose(off,wheelRot,scale); wheelWorld.multiplyMatrices(transform,wheelLocal);
            t.wheels.setMatrixAt(close*4+k,wheelWorld);
            if(!t.wheels.material.map) t.wheels.setColorAt(close*4+k,car.color);
          });
          close++;
        } else if (far<440) {
          t.far.setMatrixAt(far,transform); t.far.setColorAt(far,car.color); far++;
        }
        if (car.distance+eye.y*eye.y<250*250 && shadow.count<1000) {
          const [len,w]=VEHICLE_CATALOG[m].size;
          pos.y+=.004;
          scale.set(w*1.24,1,len*1.1);
          wheelWorld.compose(pos,rot,scale);
          shadow.setMatrixAt(shadow.count++,wheelWorld);
          scale.set(1,1,1);
        }
        // Headlight beams, road pools & flares for moving cars and hero curb cars.
        if (emitBeams && (!car.parked || car.hero)) {
          const dist2 = car.distance + (eye.y - pos.y) ** 2;
          if (dist2 < 240 * 240 && lighting.pools.count < 220) {
            lampPos.set(0, .042, layout.hz - .15);
            lampScale.set(layout.pw, 1, layout.beam);
            localLamp.compose(lampPos, wheelRot.identity(), lampScale);
            lampWorld.multiplyMatrices(transform, localLamp);
            lighting.pools.setMatrixAt(lighting.pools.count++, lampWorld);
          }
          if (dist2 < 145 * 145 && lighting.beams.count + 2 <= 260) {
            for (const side of [-1, 1]) {
              lampPos.set(side * layout.hx, layout.hy, layout.hz);
              lampScale.set(1, .82, 8.6);
              localLamp.compose(lampPos, beamTilt, lampScale);
              lampWorld.multiplyMatrices(transform, localLamp);
              lighting.beams.setMatrixAt(lighting.beams.count++, lampWorld);
            }
          }
          if (dist2 < 460 * 460 && lighting.headFlares.count + 2 <= 480) {
            const flareSize = .54 + Math.min(.75, Math.sqrt(dist2) * .0028);
            const tailSize = .44 + Math.min(.62, Math.sqrt(dist2) * .0022);
            for (const side of [-1, 1]) {
              lampPos.set(side * layout.hx, layout.hy, layout.hz + .05);
              lampScale.set(flareSize, flareSize, flareSize);
              localLamp.compose(lampPos, wheelRot.identity(), lampScale);
              lampWorld.multiplyMatrices(transform, localLamp);
              lighting.headFlares.setMatrixAt(lighting.headFlares.count++, lampWorld);

              lampPos.set(side * (layout.hx * .96), layout.ty, layout.tz - .04);
              lampScale.set(tailSize, tailSize, tailSize);
              localLamp.compose(lampPos, wheelRot.identity(), lampScale);
              lampWorld.multiplyMatrices(transform, localLamp);
              lighting.tailFlares.setMatrixAt(lighting.tailFlares.count++, lampWorld);
            }
          }
          if (lighting.spots.length && dist2 < 62 * 62) {
            litNearest.push({ dist2, car, layout });
          }
        }
      }
      detail?.finish();
      t.near.count=close; t.wheels.count=close*4; t.far.count=far;
      for (const extra of t.extra) extra.count=close;
      for (const mesh of [t.near,t.wheels,t.far,...t.extra]) {
        if (mesh.count) { mesh.instanceMatrix.needsUpdate=true; mesh.instanceColor.needsUpdate=true; }
      }
    }
    if(shadow.count) shadow.instanceMatrix.needsUpdate=true;
    if (emitBeams) {
      for (const m of [lighting.pools, lighting.beams, lighting.headFlares, lighting.tailFlares]) {
        if (m.count) m.instanceMatrix.needsUpdate = true;
      }
      if (lighting.spots.length) {
        litNearest.sort((a, b) => a.dist2 - b.dist2);
        const spotStrength = 14 + nightLevel * 38;
        for (let i = 0; i < lighting.spots.length; i++) {
          const spot = lighting.spots[i];
          const item = litNearest[i];
          if (!item) { spot.visible = false; spot.intensity = 0; continue; }
          const { car, layout } = item;
          const sy = Math.sin(car.yaw), cy = Math.cos(car.yaw);
          const baseY = car.y ?? floor;
          spotOrigin.set(car.x + sy * (layout.hz + .15), baseY + layout.hy + .08, car.z + cy * (layout.hz + .15));
          spotTarget.set(car.x + sy * (layout.hz + 14), baseY - .35, car.z + cy * (layout.hz + 14));
          spot.position.copy(spotOrigin);
          spot.target.position.copy(spotTarget);
          spot.target.updateMatrixWorld();
          spot.intensity = spotStrength;
          spot.visible = true;
        }
      }
    }
  }
  function dispose() {
    scene.remove(group);
    lighting.dispose();
    for(const master of masters.values())master.dispose();
    const materials=new Set(), geometries=new Set(), textures=new Set();
    for (const source of [group,...assets.map(a=>a.scene)]) {
      source.traverse(n=>{
        if (n.geometry) geometries.add(n.geometry);
        if (n.material) materials.add(n.material);
        if (n.isInstancedMesh) n.dispose();
      });
    }
    for (const geom of geometries) geom.dispose();
    for (const m of materials) { if (m.map) textures.add(m.map); m.dispose(); }
    for (const texture of textures) texture.dispose();
  }
  return {
    update, isBlocked, dispose, enableSnow,
    setNight(value, weather = weatherKind) {
      const prevNight = nightLevel, prevWeather = weatherKind;
      nightLevel = Math.max(0, Math.min(1, Number(value) || 0));
      weatherKind = weather || 'clear';
      const enteringDark = (nightLevel >= .45 && prevNight < .45) || (weatherKind === 'aurora' && prevWeather !== 'aurora') || (nightLevel >= .95 && prevNight < .95);
      // Automatically turn headlights ON by default whenever entering night / dusk / aurora night.
      if (enteringDark && headlightsMode === 'off') headlightsMode = 'auto';
      syncLightStrength();
    },
    setHeadlightsMode(mode) {
      headlightsMode = mode === 'on' || mode === 'off' ? mode : 'auto';
      syncLightStrength();
      return headlightsActive;
    },
    toggleHeadlights() {
      headlightsMode = headlightsActive ? 'off' : 'on';
      syncLightStrength();
      return headlightsActive;
    },
    get headlightsOn() { return headlightsActive; },
    get headlightsMode() { return headlightsMode; },
    models: VEHICLE_CATALOG,
    count: traffic.cars.length
  };
}
