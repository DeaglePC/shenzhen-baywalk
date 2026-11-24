import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {roadProfiles} from '../src/road-profiles.js';
import {parkBridgeIds} from '../src/park-bridges.js';

const map=JSON.parse(fs.readFileSync(new URL('../public/data/shenzhen.json',import.meta.url),'utf8'));

test('Houhai 2nd Bridge side cycleway bridges share its elevated viaduct height',()=>{
  const profiles=roadProfiles(map);
  for(const id of [386160793,535137387]){
    const rd=map.roads.find(r=>r.id===id);
    assert.ok(rd,`missing road ${id}`);
    const prof=profiles.get(rd);
    assert.ok(prof,`side bridge ${id} should be graded by roadProfiles`);
    assert.equal(prof.side,true,`side bridge ${id} should share viaduct deck`);
    const mid=prof.points[Math.floor(prof.points.length/2)];
    assert.ok(mid.y>5.2&&mid.y<6.2,`expected elevated viaduct height ~5.7m, got ${mid.y}`);
  }
});

test('all mapped Talent Park bridges are owned by park-bridges.js with valid endpoints',()=>{
  const expected=[537568300,570468707,571169638,808097526,832163846,537564665,562534117,1415882807,259033235,571629067];
  for(const id of expected){
    assert.ok(parkBridgeIds.has(id),`parkBridgeIds must own bridge ${id}`);
    const rd=map.roads.find(r=>r.id===id);
    assert.ok(rd&&rd.p.length>=2,`bridge ${id} missing in shenzhen.json`);
  }
  const curve=map.decks.find(d=>d.id===1455360665);
  assert.ok(curve&&curve.p.length>=7,'Shuangqu Bridge deck 1455360665 must exist');
});
