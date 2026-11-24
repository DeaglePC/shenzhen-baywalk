import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atStation, footRoad, roadProfiles} from '../src/road-profiles.js';
import {makeTraffic} from '../src/vehicles.js';
import {bayHeight} from '../src/bay-alignment.js';
import {streetJunctions,wenxinDivider} from '../src/street-junctions.js';
import {streetObstacles} from '../src/traffic-collision.js';

const map=JSON.parse(readFileSync(new URL('../public/data/shenzhen.json',import.meta.url),'utf8'));
const profiles=roadProfiles(map);
const bridgeIDs=new Set([232498909,232498913]);

test('both regional carriageways meet the exact local bridge edges',()=>{
  const {axes}=JSON.parse(readFileSync(new URL('../src/bay-crossing.json',import.meta.url),'utf8'));
  for(const [i,id] of [276506946,568424517].entries()){
    const road=map.roads.find(r=>r.id===id),profile=profiles.get(road);
    const cut=profile.points.find(p=>p.z===3200);
    assert.deepEqual([cut.x,cut.z],axes[i][0]);
    assert(Math.abs(cut.y-bayHeight(3200))<.001);
    assert(axes[i].at(-1)[1]>6700);
  }
});

test('skywalk steps reach the lower sidewalk and the upper deck continuously',()=>{
  const stair=profiles.get(map.roads.find(r=>r.id===255634819));
  assert.equal(stair.points[0].y,6.25);
  assert(Math.abs(stair.points.at(-1).y-.246)<.001);
  let last=Infinity;
  for(let s=0;s<stair.length;s+=.15){
    const h=atStation(stair,s).y;
    assert(h<=last+.001&&(last===Infinity||last-h<.12));last=h;
  }
});

test('longitudinal markings leave gaps at crossings and the central fence blocks cars',()=>{
  const layout=streetJunctions(map),divider=wenxinDivider(map),road=divider.road;
  const crossing=road.p[1];
  assert(layout.clearRuns(road).every(path=>path.every(p=>Math.hypot(p[0]-crossing[0],p[1]-crossing[1])>1)));
  const blocked=streetObstacles({water:[],buildings:[],roads:[road]});
  const [x,z]=divider.at(45);
  assert(blocked(x,z,0,4.5,1.85));assert(!blocked(x,z,0,4.5,1.85,2,.1,6.25));
});

test('mapped junctions and merge points retain a common driving height',()=>{
  const ramp=map.roads.find(r=>r.id===165265385);
  const main=map.roads.find(r=>r.id===101317742);
  assert(main.p.slice(1,-1).some(p=>p.toString()===ramp.p.at(-1).toString()),'missing mapped slip-road merge');
  const nodes=new Map();
  for(const road of map.roads){
    if(footRoad(road)||road.tunnel||road.layer<0)continue;
    const profile=profiles.get(road);
    if(road.bridge||road.layer>0)assert(profile,'missing elevated road');
    let distance=0;
    for(let i=0;i<road.p.length;i++){
      const [x,z]=road.p[i];
      if(i)distance+=Math.hypot(x-road.p[i-1][0],z-road.p[i-1][1]);
      const k=x+','+z,y=profile?atStation(profile,distance).y:.28;
      if(nodes.has(k))assert(Math.abs(y-nodes.get(k))<.001,'vertical step at '+k);
      nodes.set(k,y);
    }
    if(!profile)continue;
    for(let i=1;i<profile.points.length;i++){
      const a=profile.points[i-1],b=profile.points[i];
      assert(Math.abs(b.y-a.y)<.083*(b.s-a.s),'steep motor approach on '+road.id);
    }
  }
});

test('drivers enter, cross and leave both carriageways of Houhai Bridge',()=>{
  const traffic=makeTraffic(map),eye={x:336,z:54},crossings=new Set(),previous=new Map();
  for(let frame=0;frame<1800;frame++){
    traffic.step(.05,eye,800);
    for(const c of traffic.cars){
      if(c.parked||Math.hypot(c.x-eye.x,c.z-eye.z)>450)continue;
      const road=c.lane.road,last=previous.get(c);
      if(bridgeIDs.has(road.id)&&c.s>8&&c.s<c.lane.length-8){
        assert(Math.abs(c.y-atStation(profiles.get(road),c.s).y)<.01,'car above or below deck');
        if(last?.approaching)last.onBridge=road.id;
      }
      if(road.name==='沙河西路'){
        if(last?.onBridge&&last.entry!==road.id)crossings.add(last.onBridge);
        previous.set(c,{approaching:true,entry:road.id});
      }else if(!bridgeIDs.has(road.id))previous.delete(c);
    }
  }
  assert.deepEqual(crossings,bridgeIDs);
});
