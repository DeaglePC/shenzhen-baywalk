import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// gltfpack stores positions in normalized integers with a decode matrix on the
// node. Transforming those attributes in-place would clip the car to [0, 1].
function bakePart(node, pivot) {
  const source=node.geometry, result=new T.BufferGeometry();
  for(const [name,attr] of Object.entries(source.attributes)){
    const values=new Float32Array(attr.count*attr.itemSize);
    for(let i=0;i<attr.count;i++) for(let k=0;k<attr.itemSize;k++){
      values[i*attr.itemSize+k]=attr.getComponent(i,k);
    }
    result.setAttribute(name,new T.BufferAttribute(values,attr.itemSize));
  }
  result.setIndex(source.index?.clone()??Array.from({length:source.attributes.position.count},(_,i)=>i));
  const toCar=new T.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z).multiply(node.matrixWorld);
  result.applyMatrix4(toCar);
  if(toCar.determinant()<0){
    const indices=result.index.array;
    for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  }
  return result;
}

// Each batch renders one finish of the body or a wheel. The parked and moving
// vehicles write transforms into the same batches and share their materials.
export function detailedFleet(asset, id, parent){
  const group=new T.Group();group.name=id+' · street detail';parent.add(group);
  const origins=[new T.Vector3()], wheelSlots=new Map(), batches=new Map();
  asset.model.updateMatrixWorld(true);
  asset.model.traverseVisible(node=>{
    if(!node.isMesh)return;
    let axle=node;
    while(axle&&!axle.userData.rolling_radius)axle=axle.parent;
    if(axle&&!wheelSlots.has(axle)){
      wheelSlots.set(axle,origins.length);origins.push(axle.getWorldPosition(new T.Vector3()));
    }
    const slot=axle?wheelSlots.get(axle):0;
    const key=[slot,node.material.uuid,...Object.keys(node.geometry.attributes).sort()].join('/');
    if(!batches.has(key))batches.set(key,{slot,material:node.material,parts:[]});
    batches.get(key).parts.push(bakePart(node,origins[slot]));
  });
  for(const b of batches.values()){
    b.geometry=mergeGeometries(b.parts);
    for(const part of b.parts)part.dispose();
    delete b.parts;
  }
  let capacity=0,count=0,visibleCount=0;
  const matrices=origins.map(()=>new T.Matrix4()),roll=new T.Matrix4();
  return {
    begin(required,environment){
      count=0;visibleCount=required;group.visible=required>0;
      if(!required)return;
      asset.setEnvironment(environment);
      if(required<=capacity)return;
      capacity=2**Math.ceil(Math.log2(Math.max(4,required)));
      for(const b of batches.values()){
        if(b.mesh){group.remove(b.mesh);b.mesh.dispose();}
        b.mesh=new T.InstancedMesh(b.geometry,b.material,capacity);
        b.mesh.castShadow=!b.material.transparent;b.mesh.receiveShadow=true;b.mesh.frustumCulled=false;
        b.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        group.add(b.mesh);
      }
    },
    add(root,angle){
      matrices[0].copy(root);roll.makeRotationX(angle);
      for(let i=1;i<origins.length;i++){
        const p=origins[i];
        matrices[i].makeTranslation(p.x,p.y,p.z).premultiply(root).multiply(roll);
      }
      // The traffic list is nearest first. Blend glass on the distant copies first.
      for(const b of batches.values()){
        b.mesh.setMatrixAt(b.material.transparent?visibleCount-1-count:count,matrices[b.slot]);
      }
      count++;
    },
    finish(){
      for(const b of batches.values())if(b.mesh){b.mesh.count=count;if(count)b.mesh.instanceMatrix.needsUpdate=true;}
    },
    dispose(){
      parent.remove(group);
      for(const b of batches.values()){b.mesh?.dispose();b.geometry.dispose();}
      asset.dispose();
    }
  };
}
