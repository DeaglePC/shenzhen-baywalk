import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,MeshStandardMaterial} from 'three';
import {parkPlayground} from '../src/park-playground.js';
import {area,inRing} from '../src/city-geometry.js';

test('play surfaces fill the two surveyed outlines and leave the shade trees inside planting beds',()=>{
  const map=JSON.parse(readFileSync(new URL('../public/data/shenzhen.json',import.meta.url),'utf8'));
  const group=new Group(),surfaces=[],fixtures=[];
  const trees=parkPlayground(group,map,{curb:new MeshStandardMaterial()},{
    trackTex:t=>t,addPavedArea:(ring,beds)=>surfaces.push({ring,beds}),addBoxObstacle:ring=>fixtures.push(ring)
  });
  assert.equal(surfaces.length,2);
  const mesh=group.getObjectByName('嬉乐园 · 彩色弹性铺装与白沙池');
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index.array;
  let covered=0;
  for(let i=0;i<idx.length;i+=3){
    const triangle=[idx[i],idx[i+1],idx[i+2]].map(j=>[p.getX(j),p.getZ(j)]);
    covered+=Math.abs(area(triangle));
  }
  const footprint=surfaces.reduce((sum,{ring})=>sum+Math.abs(area(ring)),0);
  assert.ok(Math.abs(covered-footprint)<.01);
  assert.ok(trees.every(([x,z])=>surfaces.some(({beds})=>beds.some(p=>inRing(x,z,p)))));
  assert.ok(fixtures.length>0&&fixtures.every(r=>r.every(([x,z])=>inRing(x,z,surfaces[0].ring))));
});
