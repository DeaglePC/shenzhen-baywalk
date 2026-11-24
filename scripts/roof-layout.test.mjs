import test from 'node:test';
import assert from 'node:assert/strict';
import {roofPlantSite,supportsRoofSetback} from '../src/roof-layout.js';

test('central fixtures and a setback fit a rectangular roof in either winding',()=>{
  const ring=[[1,1],[17,1],[17,13],[1,13]];
  for(const p of [ring,ring.toReversed()]){
    assert.deepEqual(roofPlantSite(p,5,3),[9,7]);
    assert.equal(supportsRoofSetback(p,9,7),true);
  }
});

test('a narrow courtyard notch between two fixture corners is kept clear',()=>{
  const p=[[0,0],[24,0],[24,16],[14,16],[14,8.5],[13,8.5],[13,16],[0,16]];
  const [x,z]=roofPlantSite(p,8,4);
  assert.ok(x+4<13||x-4>14||z+2<8.5);
  assert.equal(supportsRoofSetback(p,12,8),false);
});

test('unsupported fixtures are omitted from narrow wings around a courtyard',()=>{
  const p=[[0,0],[20,0],[20,20],[18,20],[18,2],[2,2],[2,20],[0,20]];
  assert.equal(roofPlantSite(p,3,3),null);
});
