import * as T from 'three';

export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function random(seed=67921) {
  return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296;};
}
export function bounds(p) {
  let x=Infinity,z=Infinity,X=-Infinity,Z=-Infinity;
  for(const a of p){x=Math.min(x,a[0]);z=Math.min(z,a[1]);X=Math.max(X,a[0]);Z=Math.max(Z,a[1]);}
  return [x,z,X,Z];
}
export function area(p) {
  let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j][0]*p[i][1]-p[i][0]*p[j][1];return a/2;
}
export function inRing(x,z,ring) {
  let inside=false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export class Grid {
  constructor(size=110){this.size=size;this.cells=new Map();}
  key(i,j){return i+','+j;}
  add(item,box){const n=this.size;for(let i=Math.floor(box[0]/n);i<=Math.floor(box[2]/n);i++)for(let j=Math.floor(box[1]/n);j<=Math.floor(box[3]/n);j++){const k=this.key(i,j);let a=this.cells.get(k);if(!a)this.cells.set(k,a=[]);a.push(item);}}
  query(x,z){return this.cells.get(this.key(Math.floor(x/this.size),Math.floor(z/this.size)))||[];}
}
export function inArea(x,z,f){
  const b=f.bbox;
  return x>=b[0]&&z>=b[1]&&x<=b[2]&&z<=b[3]&&inRing(x,z,f.p)&&!(f.holes||[]).some(r=>inRing(x,z,r));
}
export function segmentDistance(x,z,a,b){
  const dx=b[0]-a[0], dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
// The same diagonal as Surface.quad. Restrict ramp heights to the deck's
// actual outline so a higher neighbouring segment cannot lift the walker.
export function quadHeight(q,x,z){
  const [a,b,c,d]=q;
  const dx=x-a[0],dz=z-a[2];
  function triangle(p,r){
    const px=p[0]-a[0],pz=p[2]-a[2],rx=r[0]-a[0],rz=r[2]-a[2],det=px*rz-pz*rx;
    if(Math.abs(det)<1e-8)return null;
    const u=(dx*rz-dz*rx)/det,v=(px*dz-pz*dx)/det;
    return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001 ? a[1]+u*(p[1]-a[1])+v*(r[1]-a[1]) : null;
  }
  return triangle(b,c)??triangle(c,d);
}
export class Surface {
  constructor(){this.p=[];this.uv=[];this.c=[];this.indices=[];}
  vertex(v,u=[0,0],color=null){const id=this.p.length/3;this.p.push(...v);this.uv.push(...u);if(color)this.c.push(color.r,color.g,color.b);return id;}
  quad(a,b,c,d,uv=[[0,0],[1,0],[1,1],[0,1]],color=null){
    const k=this.p.length/3;
    this.vertex(a,uv[0],color);this.vertex(b,uv[1],color);this.vertex(c,uv[2],color);this.vertex(d,uv[3],color);
    this.indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  polygon(p,holes=[],y=0,scale=1,color=null) {
    if(p.length<3)return;
    const arr=[p,...holes.filter(h=>h.length>2)].map(r=>r.map(a=>new T.Vector2(a[0],a[1])));
    const tri=T.ShapeUtils.triangulateShape(arr[0],arr.slice(1)),k=this.p.length/3;
    for(const ring of arr)for(const a of ring)this.vertex([a.x,y,a.y],[a.x/scale,a.y/scale],color);
    for(const [a,b,c] of tri)this.indices.push(k+c,k+b,k+a);
  }
  geometry(){
    if(!this.indices.length)return null;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setIndex(this.indices);
    g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));if(this.c.length===this.p.length)g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  mesh(parent,mat,name,cast=false){const g=this.geometry();if(!g)return null;const m=new T.Mesh(g,mat);m.name=name;m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;}
}
export function sideWall(s,p,y,h,repeatX=1,repeatY=1,color=null) {
  const ring=area(p)>0?p:p.slice().reverse();let offset=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];const l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.08)continue;
    s.quad([a[0],y,a[1]],[a[0],h,a[1]],[b[0],h,b[1]],[b[0],y,b[1]],[[offset/repeatX,y/repeatY],[offset/repeatX,h/repeatY],[(offset+l)/repeatX,h/repeatY],[(offset+l)/repeatX,y/repeatY]],color);offset+=l;
  }
}
export function ribbon(surface,points,width,y,scale=4,offset=0,color=null){
  if(points.length<2)return;
  const normals=[];
  for (let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;normals.push([-dz/l,dx/l]);}
  let prevL,prevR,dis=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],n0=normals[Math.max(0,i-1)],n1=normals[Math.min(normals.length-1,i)];
    let nx=(n0[0]+n1[0]),nz=n0[1]+n1[1];let m=Math.hypot(nx,nz);if(m<.01){nx=n1[0];nz=n1[1];m=1;}nx/=m;nz/=m;
    const k=1/Math.max(.45,nx*n1[0]+nz*n1[1]);
    const l=[a[0]+nx*k*(offset+width/2),y,a[1]+nz*k*(offset+width/2)],r=[a[0]+nx*k*(offset-width/2),y,a[1]+nz*k*(offset-width/2)];
    if(i){const d=Math.hypot(a[0]-points[i-1][0],a[1]-points[i-1][1]);surface.quad(prevL,l,r,prevR,[[0,dis/scale],[0,(dis+d)/scale],[width/scale,(dis+d)/scale],[width/scale,dis/scale]],color);dis+=d;}
    prevL=l;prevR=r;
  }
}
export function along(p,interval,start,fn) {
  let walked=0,next=start;
  for(let i=1;i<p.length;i++){
    const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
    while(next<walked+len){const t=(next-walked)/len;fn(a[0]+dx*t,a[1]+dz*t,dx/len,dz/len,next);next+=interval;}
    walked+=len;
  }
}
const mid=new T.Vector3(),up=new T.Vector3(0,1,0),dir=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3(),matrix=new T.Matrix4();
export class Instances {
  constructor(geometry,material,label){this.geo=geometry;this.mat=material;this.label=label;this.matrices=[];this.colors=[];}
  at(x,y,z,sx,sy,sz,rot=0,col=null){
    mid.set(x,y,z);quat.setFromAxisAngle(up,rot);scale.set(sx,sy,sz);matrix.compose(mid,quat,scale);this.matrices.push(matrix.clone());if(col)this.colors.push(col);
  }
  between(x1,y1,z1,x2,y2,z2,r,col=null){
    mid.set((x1+x2)*.5,(y1+y2)*.5,(z1+z2)*.5);dir.set(x2-x1,y2-y1,z2-z1);const len=dir.length();if(len<.01)return;quat.setFromUnitVectors(up,dir.multiplyScalar(1/len));scale.set(r,len,r);matrix.compose(mid,quat,scale);this.matrices.push(matrix.clone());if(col)this.colors.push(col);
  }
  flush(group,cast=false,detailRange=0,lod=null){
    if(!this.matrices.length)return;
    if(detailRange&&(lod||this.matrices.length>60)){
      const tiles=new Map(),hasColors=this.colors.length===this.matrices.length;
      const tileSize=lod?.tileSize??520;
      this.matrices.forEach((m,i)=>{
        const x=m.elements[12],z=m.elements[14],key=Math.floor(x/tileSize)+','+Math.floor(z/tileSize);
        let sub=tiles.get(key);if(!sub)tiles.set(key,sub=new Instances(this.geo,this.mat,this.label));
        sub.matrices.push(m);if(hasColors)sub.colors.push(this.colors[i]);
      });
      const list=group.userData.localDetails||(group.userData.localDetails=[]);
      tiles.forEach(batch=>{
        const item=batch.flush(group,cast);
        list.push({item,range:detailRange,lod});
      });
      this.matrices.length=0;this.colors.length=0;return;
    }
    const m=new T.InstancedMesh(this.geo,this.mat,this.matrices.length);m.name=this.label;
    for(let i=0;i<this.matrices.length;i++){m.setMatrixAt(i,this.matrices[i]);if(this.colors.length===this.matrices.length)m.setColorAt(i,this.colors[i]);}
    m.castShadow=cast;m.receiveShadow=true;m.computeBoundingSphere();group.add(m);this.matrices.length=0;this.colors.length=0;return m;
  }
}
