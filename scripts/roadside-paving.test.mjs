import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,MeshStandardMaterial} from 'three';
import {addRoadsidePaving} from '../src/roadside-paving.js';

test('Keyuan and Dengliang sidewalks cover the verge gaps and leave carriageways and mapped land clear',()=>{
  const file=readFileSync(new URL('../public/data/roadside-paving.bin',import.meta.url));
  const root=new Group(),material=new MeshStandardMaterial();
  const covers=addRoadsidePaving(root,material,file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
  for(const [x,z] of [[-539,103],[-538,84],[-577,75]])assert.ok(covers(x,z),`missing sidewalk at ${x}, ${z}`);
  for(const [place,x,z] of [
    ['Keyuan South carriageway',-549.35,103.19],['Dengliang junction',-548.2,66.5],
    ['roadside wood',-495.41,165.95],['park car park',-342.79,30.5],['Talent Park',-1.88,4.95],
  ])assert.equal(covers(x,z),false,place);
});
