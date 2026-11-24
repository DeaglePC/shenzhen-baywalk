import * as T from 'three';
import {Surface} from './city-geometry.js';
import {photo} from './city-materials.js';

// Flattened timber cap over a separate steel rail. Keep the top level across
// its width on sloping approaches and run the timber grain along each span.
export function bridgeHandrail(){
  const skin=new Surface(),profile=[[-.099,-.029],[-.106,-.018],[-.106,.016],[-.095,.030],[.095,.030],[.106,.016],[.106,-.018],[.099,-.029]];
  return {
    span(x,y,z,X,Y,Z){
      const dx=X-x,dz=Z-z,len=Math.hypot(dx,dz);if(len<.01)return;
      const nx=-dz/len,nz=dx/len;
      const ring=(a,b,c)=>profile.map(([w,h])=>[a+w*nx,b+h,c+w*nz]);
      const a=ring(x,y,z),b=ring(X,Y,Z);
      for(let i=0;i<a.length;i++){
        const j=(i+1)%a.length;
        skin.quad(a[i],b[i],b[j],a[j],[[0,0],[len/2.4,0],[len/2.4,.32],[0,.32]]);
      }
      for(let i=1;i<a.length-1;i++){
        skin.quad(a[0],a[i],a[i+1],a[0]);skin.quad(b[0],b[i+1],b[i],b[0]);
      }
    },
    finish(root){
      const mat=new T.MeshStandardMaterial({map:photo('bridge-deck-color.webp'),color:0x60453c,roughness:.42,side:T.DoubleSide});
      skin.mesh(root,mat,'星光桥 · 木质扶手面盖',true);
    }
  };
}
