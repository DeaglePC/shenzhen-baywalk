import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTraffic} from '../src/vehicles.js';
import {streetObstacles,bodiesOverlap,TrafficOccupancy} from '../src/traffic-collision.js';
import {stadiumMotorAreas} from '../src/city-stadium.js';

test('a bumper clips a thin wall, while a courtyard and a raised link remain passable',()=>{
  const square=(x,z,size)=>[[x,z],[x+size,z],[x+size,z+size],[x,z+size]];
  const wall=streetObstacles({buildings:[
    {p:square(0,0,24),holes:[square(4,4,16)]},
    {p:[[30,-2],[30.06,-2],[30.06,2],[30,2]]},
    {p:square(40,0,8),minH:6}
  ],water:[]});
  assert.equal(wall(27.8,0,Math.PI/2,4.7,1.8),true);
  assert.equal(wall(11,10,.7,4.7,1.8),false);
  assert.equal(wall(44,4,0,4.7,1.8),false);
  const occupied=new TrafficOccupancy(),car={x:12,z:12,yaw:Math.PI/2,l:2.35,w:.9,radius:2.52,height:1.6};
  occupied.place(car);
  assert(occupied.blocksWalker(9.55,12,.2,.26));
  assert(!occupied.blocksWalker(9.55,12,3.2,.26));
  assert(occupied.blocked({...car,x:9,l:1},null));
});

test('surface traffic keeps moving around the rendered sports centre without entering it',()=>{
  const data=JSON.parse(readFileSync(new URL('../public/data/shenzhen.json',import.meta.url),'utf8'));
  const sim=makeTraffic(data,{stadiumAreas:stadiumMotorAreas});
  const walls=streetObstacles(data,stadiumMotorAreas),eye={x:85,z:-785},dt=.05;
  for(const c of sim.cars)assert(!walls(c.x,c.z,c.yaw,2*c.l,2*c.w,c.height,.03,c.y),'invalid spawn');
  let distance=0,junctions=0;
  const tracked=sim.cars.filter(c=>!c.parked&&Math.hypot(c.x-eye.x,c.z-eye.z)<440);
  assert(tracked.length>5);
  for(let frame=0;frame<1800;frame++){
    const last=tracked.map(c=>[c.x,c.z,c.lane]);
    sim.step(dt,eye,560);
    tracked.forEach((c,i)=>{
      const [x,z,lane]=last[i],step=Math.hypot(c.x-x,c.z-z);
      if(Math.hypot(c.x-eye.x,c.z-eye.z)<560||Math.hypot(x-eye.x,z-eye.z)<560){
        assert(step<1,'vehicle jumped in view');distance+=step;if(c.lane!==lane)junctions++;
      }
      assert(!walls(c.x,c.z,c.yaw,2*c.l,2*c.w,c.height,.03,c.y),'vehicle entered obstacle');
    });
    if(frame%20===0){
      const visible=sim.cars.filter(c=>Math.hypot(c.x-eye.x,c.z-eye.z)<560);
      for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)
        assert(!bodiesOverlap(visible[i],visible[j],0),'overlapping bodies at intersection');
    }
  }
  assert(distance>3000&&junctions>10,'traffic did not drive through the district');
});
