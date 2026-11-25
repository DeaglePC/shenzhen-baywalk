import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Group,Texture,TextureLoader} from 'three';
import {columnsOnBridge,personView} from '../src/talent-bridge.js';
import {engravedFaces} from '../src/talent-faces.js';
import {deckPlates,shorePlates,filmedPlates} from '../src/talent-field.js';

const publicDir=new URL('../public/',import.meta.url);
const map=JSON.parse(readFileSync(new URL('data/shenzhen.json',publicDir),'utf8'));
const path=map.roads.find(r=>r.id===562534109).p;
const columns=columnsOnBridge(path);

test('each November observation belongs to one physical column and has its own readable photograph',()=>{
  assert.deepEqual([deckPlates.length,shorePlates.length,filmedPlates.length],[65,45,14]);
  assert.equal(new Set(columns.map(c=>c.record.id)).size,124);
  assert.equal(new Set(columns.map(c=>c.record.field.image)).size,124);
  for(const [i,c] of columns.entries()){
    assert.equal(c.record.field.index,i);
    assert.ok(c.record.field.excerpt);
    assert.ok(existsSync(new URL(c.record.field.image.slice(1),publicDir)));
  }
  assert.equal(columns[4].record.id,'esteban-busso');
  assert.equal(columns[5].record.id,'cai-zhiming');
});

test('the walk follows the capture order and puts the first of a paired row to the right',()=>{
  for(const segment of [columns.filter(c=>c.onDeck),columns.filter(c=>!c.onDeck)]){
    for(let i=1;i<segment.length;i++){
      const a=segment[i-1],b=segment[i];
      assert.ok(b.station>=a.station);
      if(b.station===a.station)assert.ok(a.offset>b.offset);
    }
  }
  const reversed=columnsOnBridge([...path].reverse());
  assert.deepEqual(reversed.map(c=>[c.x,c.z]),columns.map(c=>[c.x,c.z]));
});

test('front and reverse views target the same inscription on the same column',()=>{
  for(const c of columns){
    const a=personView(map,c.record.id),b=personView(map,c.record.id,'reverse');
    assert.equal(a.personId,b.personId);
    assert.deepEqual(a.portrait.target,b.portrait.target);
    assert.ok(Math.hypot((a.x+b.x)/2-c.x,(a.z+b.z)/2-c.z)<1e-8);
  }
  assert.equal(personView(map,'ma-huateng'),null);
});

test('all 124 close-ups keep the common two-sided footer clear of the individual photograph',async t=>{
  t.mock.method(TextureLoader.prototype,'loadAsync',async url=>{
    assert.ok(existsSync(new URL(url.slice(1),publicDir)),url);
    const texture=new Texture();texture.name=url;return texture;
  });
  const root=new Group();
  await engravedFaces(root,columns,{parkLights:{finish(){}}});
  const footer=root.children.find(o=>o.isInstancedMesh);
  assert.equal(footer.count,columns.length);
  assert.equal(footer.material.map.name,'/talent/field/common-footer.webp');
  assert.equal(footer.receiveShadow,false);
  const uv=footer.geometry.attributes.uv.array;
  assert.deepEqual(uv.slice(0,uv.length/2),uv.slice(uv.length/2));
  const detail=root.getObjectByName('现场铭文近读');
  footer.geometry.computeBoundingBox();
  for(const c of columns){
    root.userData.updateTalentPlate({x:c.x,y:c.base+1.85,z:c.z});
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(detail.visible,c.record.id);
    assert.match(detail.material.map.name,/\/close\/plates-\d+\.webp$/);
    detail.geometry.computeBoundingBox();
    assert.ok(Math.abs(detail.geometry.boundingBox.min.y-c.base-footer.geometry.boundingBox.max.y)<1e-6);
  }
  root.userData.disposeTalentPlates();
});
