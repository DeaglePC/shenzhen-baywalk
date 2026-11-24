import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader=new GLTFLoader();

export async function mountSculpture(parent,file,y=0){
  const base=import.meta.env.BASE_URL+'city/'+file;
  const levels=await Promise.all(['.glb','-far.glb'].map(ext=>loader.loadAsync(base+ext)));
  const lod=new T.LOD();lod.position.y=y;lod.name=file;
  levels.forEach(({scene},i)=>{
    scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    lod.addLevel(scene,i?42:0,.1);
  });
  parent.add(lod);
}
