import * as T from 'three';
import {Grid,bounds,inRing} from './city-geometry.js';

export function addRoadsidePaving(root,material,buffer){
  if(!buffer)return ()=>false;
  const view=new DataView(buffer);
  // Used once while siting the tree wells. Keep the exact paving edges clear
  // even where a cycleway or lawn narrows the pedestrian apron.
  const footprints=new Grid(32);
  let offset=0;
  while(offset<buffer.byteLength){
    const count=view.getUint32(offset,true),indices=view.getUint32(offset+4,true);
    offset+=8;
    const xz=new Int16Array(buffer,offset,count*2);
    const xyz=new Float32Array(count*3),normals=new Float32Array(count*3),uv=new Float32Array(count*2);
    for(let i=0;i<count;i++){
      const x=xz[i*2]*.1,z=xz[i*2+1]*.1;
      xyz[i*3]=x;xyz[i*3+1]=.12;xyz[i*3+2]=z;
      normals[i*3+1]=1;uv[i*2]=x/3.2;uv[i*2+1]=z/3.2;
    }
    offset+=xz.byteLength;
    const index=new Uint16Array(buffer,offset,indices);
    offset+=index.byteLength;
    for(let j=0;j<indices;j+=3){
      const ring=[index[j],index[j+1],index[j+2]].map(k=>[xyz[k*3],xyz[k*3+2]]);
      footprints.add(ring,bounds(ring));
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(xyz,3));
    g.setAttribute('normal',new T.BufferAttribute(normals,3));
    g.setAttribute('uv',new T.BufferAttribute(uv,2));
    g.setIndex(new T.BufferAttribute(index,1));
    g.computeBoundingSphere();
    const mesh=new T.Mesh(g,material);
    mesh.name='沿街人行道 · 地砖铺装';mesh.receiveShadow=true;root.add(mesh);
  }
  return (x,z)=>footprints.query(x,z).some(ring=>inRing(x,z,ring));
}
