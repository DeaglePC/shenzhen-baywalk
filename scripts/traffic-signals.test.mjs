import test from 'node:test';
import assert from 'node:assert/strict';
import {trafficSignals,signalAspect} from '../src/traffic-signals.js';
import {makeTraffic} from '../src/vehicles.js';

function fixture(){
  const road=(id,p,width=8)=>({id,name:'Road '+id,p,width,lanes:2,oneway:true,layer:0,kind:'secondary'});
  const approach=road(1,[[-200,0],[0,0]],10.5);
  return {roads:[approach,road(2,[[0,0],[0,-180]]),road(3,[[0,-180],[-200,-180],[-200,0]]),
    road(4,[[0,180],[0,0]]),{...road(5,[[-15,-12],[-15,12]],3.6),kind:'footway',footway:'crossing'}],
    pois:[{kind:'traffic_signals',p:[0,0]}],buildings:[],land:[],water:[]};
}

test('left, through and crossing indications clear their conflict zones before release',()=>{
  const plan=trafficSignals(fixture()),[site]=plan.sites;
  const main=site.arms.find(a=>a.road.id===1),side=site.arms.find(a=>a.road.id===4);
  assert(main.protectedLeft&&main.mappedCrossing);
  assert(Math.abs(main.stop[0]+18.35)<.01);
  site.offset=0;
  for(let t=0;t<192;t+=.25){
    const moving=(a,k)=>signalAspect(a,k,t)!=='red';
    assert(!(moving(main,'left')&&moving(main,'through')));
    assert(!((moving(main,'through')||moving(main,'left'))&&(moving(side,'through')||moving(side,'left'))));
    if(moving(main,'walk'))assert(!moving(main,'through')&&!moving(main,'left')&&!moving(side,'left'));
  }
  assert.deepEqual([25,26,29,32,42,45].map(t=>[signalAspect(main,'through',t),signalAspect(main,'left',t)]),
    [['green','red'],['amber','red'],['red','red'],['red','green'],['red','amber'],['red','red']]);
  plan.time=8;
  assert.equal(plan.allowsPedestrian({x:-15,y:5.66},{x:-15,y:5.61}),false);
  assert.equal(plan.allowsPedestrian({x:-15,y:2.9},{x:-15,y:2.8}),true);
  plan.time=54;
  assert.equal(plan.allowsPedestrian({x:-15,y:5.66},{x:-15,y:5.61}),true);
});

test('a left-turn driver waits with its bumper upstream of the stripe, then takes its planned turn',()=>{
  const map=fixture(),plan=trafficSignals(map),site=plan.sites[0],arm=site.arms.find(a=>a.road.id===1);
  site.offset=0;plan.time=8;
  const sim=makeTraffic(map,{signals:plan,parkedSpots:[{x:2400,z:2400,model:'mini'}]});
  const cars=sim.cars.filter(c=>!c.parked&&c.lane.road.id===1&&c.x<arm.stop[0]-8).sort((a,b)=>b.x-a.x);
  assert(cars.length>0);const lead=cars[0],eye={x:0,z:0};
  for(let i=0;i<1200;i++){sim.step(.05,eye,560);assert(lead.x+lead.l<arm.stop[0]);}
  assert(Math.abs(lead.x+lead.l-arm.stop[0]+.48)<.12);
  plan.time=35;
  for(let i=0;i<300;i++)sim.step(.05,eye,560);
  assert(lead.z<-8&&lead.lane.road.id===2);
});

