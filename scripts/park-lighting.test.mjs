import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three';
import {parkLighting} from '../src/park-lighting.js';

test('switching to afternoon extinguishes park lamps while preserving the shader light count',()=>{
  const root=new Group(),lighting=parkLighting(root),eye=new Vector3();
  lighting.fixture(0,4,0,0xffcc88,80,18);
  const visibleLights=()=>{
    const lights=[];
    root.traverseVisible(object=>{if(object.isPointLight)lights.push(object);});
    return lights;
  };
  const pool=visibleLights();
  assert.ok(pool.length>0);
  for(const level of [.19,0,1,0]){
    lighting.setNight(level);
    lighting.update(eye);
    assert.deepEqual(visibleLights(),pool);
    assert.equal(pool.some(light=>light.intensity>0),level>0);
  }
});
