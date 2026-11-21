import * as T from 'three';
import {Surface,bounds,sideWall} from './city-geometry.js';
import {photo} from './city-materials.js';
import {architecturalMetal} from './city-curtainwall.js';

// Roof plan and longitudinal section published by MAD at
// https://www.i-mad.com/articles/shenzhen-bay-culture-square-completion
// Five mapped roof outlines locate the clusters. The smaller caps and
// supporting stones are local reconstructions of the nine visible volumes.
export const cultureIDs=[1441599159,1441599154,1441599155,1441599156,1441599157,1441599158];
const tau=Math.PI*2;
function granite(){
  const normals=photo('museum-granite-normal.webp'),rough=photo('museum-granite-rough.webp');
  normals.colorSpace=rough.colorSpace=T.NoColorSpace;
  const mat=new T.MeshPhysicalMaterial({map:photo('museum-granite-color.webp'),normalMap:normals,normalScale:new T.Vector2(.16,.16),
    roughnessMap:rough,roughness:.69,metalness:.025,clearcoat:.18,clearcoatRoughness:.38,side:T.DoubleSide});
  mat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 strips=vMapUv/vec2(.24,1.18);
      strips.y+=mod(floor(strips.x),3.)*.3333;
      vec2 cell=fract(strips),width=fwidth(strips);
      vec2 margin=min(cell,1.-cell);
      vec2 joint=1.-smoothstep(vec2(.013,.003),vec2(.013,.003)+max(width,.0001),margin);
      float reveal=max(joint.x*(1.-smoothstep(.08,.45,width.x)),joint.y*(1.-smoothstep(.08,.45,width.y)));
      float shade=fract(sin(dot(floor(strips),vec2(47.1,19.2)))*33134.7);
      diffuseColor.rgb*=(1.-.34*reveal)*mix(.965,1.025,shade);`);
  };return mat;
}
export function cultureSquare(root,m,map){
  const city=new Map(map.buildings.filter(f=>cultureIDs.includes(f.id)).map(f=>[f.id,f]));
  if(!city.has(1441599159))return;
  const grp=new T.Group();grp.name='深圳湾文化广场 · 南北馆';root.add(grp);
  const stone=granite(),glaze=architecturalMetal(0x36545b,.20),seal=new T.MeshStandardMaterial({color:0x525e5d,roughness:.51,side:T.DoubleSide});
  const windows=new Surface(),jambs=new Surface(),grounds=new Surface(),grass=new Surface();
  const white=new T.Color(0xd5d5cb);
  function center(id){
    const b=bounds(city.get(id).p);return [(b[0]+b[2])*.5,(b[1]+b[3])*.5];
  }
  const South=center(1441599154),North=center(1441599156),Library=center(1441599155),Studio=center(1441599157),Garden=center(1441599158);
  // For each boulder, axes, lean and soffit elevation differ. South's broad,
  // lifted gallery rests over a narrower stone. The high northern gallery
  // leans into its neighbouring oblique volume rather than repeating a dome.
  const volumes=[
    {c:South,delta:[1,0],r:[38,27],h:18.8,y:8.0,rot:-.68,tilt:.14,lean:[2.2,-3.5],style:1,slot:true,eye:[-.58,.79,.26,.044]},
    {c:South,delta:[-10,-3],r:[24,18],h:11.5,y:.9,rot:-.48,tilt:-.09,lean:[3,0],style:2},
    {c:South,delta:[3,-10],r:[12.6,9.0],h:6.1,y:23.2,rot:-.71,tilt:.12,lean:[1.2,-.6],style:3},
    {c:South,delta:[11,23],r:[9.3,7.0],h:5.1,y:1.2,rot:1.13,tilt:-.11,lean:[.7,.9],style:0},
    {c:Garden,delta:[0,0],r:[16.5,13.8],h:9.2,y:1.4,rot:.38,tilt:.12,lean:[.6,-1.2],style:2,slot:true},
    {c:North,delta:[4.6,-3.8],r:[23.0,16.7],h:48.2,y:3.0,rot:-.21,tilt:-.04,lean:[-8.2,2.2],style:0,slot:true,eye:[.81,.73,.32,.069]},
    {c:North,delta:[-17.0,4.8],r:[24.7,9.4],h:10.6,y:15.0,rot:-.37,tilt:.32,lean:[.6,1.5],style:2},
    {c:Studio,delta:[.4,0],r:[15.4,8.8],h:9.1,y:2.0,rot:1.02,tilt:.18,lean:[-2.8,-.8],style:1},
    {c:Library,delta:[0,0],r:[17.8,14.2],h:12.1,y:1.5,rot:.48,tilt:-.16,lean:[-1.4,.65],style:3,eye:[.60,.77,.31,.062]}
  ];
  for(const shell of volumes){
    const [x,z]=[shell.c[0]+shell.delta[0],shell.c[1]+shell.delta[1]],cs=Math.cos(shell.rot),sn=Math.sin(shell.rot),[rx,rz]=shell.r;
    function point(a,v,push=0){
      const phi=(v-.5)*Math.PI,hf=(Math.sin(phi)+1)*.5,ca=Math.cos(a),sa=Math.sin(a),raw=Math.max(0,Math.cos(phi));
      const band=Math.pow(raw,.79),warp=1+.064*Math.cos(3*a+.62*shell.style)+.053*Math.sin(2*a+v*1.8);
      const ex=rx*band*ca*warp+shell.lean[0]*(hf-.37)+ca*push,
        ez=rz*band*sa*(1+.062*Math.sin(3*a+2.2*hf))+shell.lean[1]*(hf-.37)+sa*push;
      const y=shell.y+shell.h*hf+shell.tilt*rx*ca*band+shell.h*.064*band*Math.sin(a+.56*shell.style);
      return [x+ex*cs+ez*sn,y,z-ex*sn+ez*cs];
    }
    const N=82,V=45,pos=[],uv=[],idx=[];
    for(let j=0;j<=V;j++)for(let i=0;i<=N;i++){
      const a=i*tau/N,p=point(a,j/V);pos.push(...p);
      uv.push(i/N*tau*(rx+rz)*.5,j/V*shell.h*1.44);
    }
    for(let j=0;j<V;j++)for(let i=0;i<N;i++){
      const k=j*(N+1)+i,a=(i+.5)*tau/N,v=(j+.5)/V;
      if(shell.slot&&v>.385&&v<.427&&Math.cos(a-.68)>.16){
        const a0=i*tau/N,a1=(i+1)*tau/N,v0=j/V,v1=(j+1)/V;
        const pp=[point(a0,v0,-.31),point(a1,v0,-.31),point(a1,v1,-.31),point(a0,v1,-.31)];
        windows.quad(...pp);
        if(j===17||j===18){jambs.quad(point(a0,v0),point(a1,v0),pp[1],pp[0]);}
        if(j===18){jambs.quad(point(a0,v1),point(a1,v1),pp[2],pp[3]);}
        continue;
      }
      idx.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    g.setIndex(idx);g.computeVertexNormals();
    const volume=new T.Mesh(g,stone);volume.castShadow=true;volume.receiveShadow=true;volume.name='浅色花岗岩原石展厅';grp.add(volume);
    if(shell.eye){
      const [az,v,aw,vw]=shell.eye;
      for(let i=0;i<52;i++){
        const u=i*tau/52,t=(i+1)*tau/52,fn=(p,r,lift)=>point(az+Math.cos(p)*aw*r,v+Math.sin(p)*vw*r,lift);
        jambs.quad(fn(u,1,.10),fn(t,1,.10),fn(t,.91,.14),fn(u,.91,.14));
        windows.quad(fn(u,.91,.14),fn(t,.91,.14),fn(t,.012,.15),fn(u,.012,.15));
      }
    }
  }
  const compound=city.get(1441599159),p=compound.p,b=bounds(p),cx=(b[0]+b[2])*.5,cz=(b[1]+b[3])*.5;
  const upper=p.map(([x,z])=>[cx+(x-cx)*.945,cz+(z-cz)*.945]);
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],A=upper[i],B=upper[(i+1)%p.length];
    const corners=[[a[0],.12,a[1]],[b[0],.12,b[1]],[B[0],1.38,B[1]],[A[0],1.38,A[1]]];
    grass.quad(...corners,corners.map(q=>[q[0]/4,q[2]/4]),white);
  }
  grass.polygon(upper,[],1.38,4,white);
  for(const id of cultureIDs.slice(1)){
    const p=city.get(id).p,[x,z]=center(id);
    const apron=p.map(([px,pz])=>[x+(px-x)*1.085,z+(pz-z)*1.085]);
    grounds.polygon(apron,[],1.42,3.2);
  }
  grass.mesh(grp,m.grass,'屋顶绿坡与草坪');grounds.mesh(grp,m.paving,'展厅入口庭院');
  windows.mesh(grp,glaze,'原石展厅的水平窗带和天窗');jambs.mesh(grp,seal,'凿口收边');
}
