import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Surface} from '../src/city-geometry.js';
import {columnsOnBridge} from '../src/talent-bridge.js';
import {southGround,groundIndex,drape,landingPaving} from '../src/star-south-ground.js';

const map=JSON.parse(readFileSync(new URL('../public/data/shenzhen.json',import.meta.url),'utf8'));
const bridge=map.roads.find(r=>r.id===562534109);
const terrain=southGround(map,bridge);
const meshHeight=groundIndex([terrain.surface]);

test('the turf continues through the first pillar and its walking height follows the rendered bank',()=>{
  const posts=columnsOnBridge(bridge.p).filter(c=>!c.onDeck);
  assert.equal(posts[0].record.id,'tang-tao');
  for(const c of posts){
    assert.ok(meshHeight(c.x,c.z)>0);
    assert.ok(Math.abs(terrain.heightAt(c.x,c.z)-meshHeight(c.x,c.z))<1e-6);
  }
  const c=posts[0];
  for(let off=-7;off<=7;off+=.5){
    let last;
    for(let s=-3;s<=3;s+=.125){
      const x=c.x+c.dx*s-c.dz*off,z=c.z+c.dz*s+c.dx*off,h=meshHeight(x,z);
      assert.ok(h!==null&&Math.abs(terrain.heightAt(x,z)-h)<1e-6);
      if(last!==undefined)assert.ok(Math.abs(last-h)<.035);
      last=h;
    }
  }
  assert.equal(terrain.heightAt(190,155),null);
});

test('paving stays flush through the fork and meets the full width of the bridge deck',()=>{
  const footprint=new Surface();
  footprint.quad([198,0,164],[198,0,179],[215,0,179],[215,0,164]);
  const paved=groundIndex([drape(footprint,terrain,landingPaving)]);
  for(let x=198.1;x<215;x+=.37)for(let z=164.1;z<179;z+=.41){
    assert.ok(Math.abs(paved(x,z)-terrain.heightAt(x,z)-landingPaving)<1e-6);
  }
  const [a,b]=bridge.p,len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(const side of [-1,0,1]){
    const offset=side*bridge.width/2;
    const x=b[0]-(b[1]-a[1])*offset/len,z=b[1]+(b[0]-a[0])*offset/len;
    assert.ok(Math.abs(terrain.heightAt(x,z)+landingPaving-2.412)<.001);
  }
});
