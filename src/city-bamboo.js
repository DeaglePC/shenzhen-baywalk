import * as T from 'three';
import {Surface,Instances} from './city-geometry.js';
import {architecturalMetal} from './city-curtainwall.js';

const height=392.5,columns=56,turn=Math.PI*2;
const section=[[0,30.8],[.045,34.4],[.12,36.25],[.22,36.65],[.34,36.5],
  [.48,35.4],[.62,32.5],[.74,28.1],[.83,22.9],[.89,16.9],[.95,9.1],[.987,2.55],[1,.10]];
function radius(t){
  let j=1;while(j<section.length-1&&t>section[j][0])j++;
  const [a,v]=section[j-1],[b,w]=section[j],l=b-a,s=T.MathUtils.clamp((t-a)/l,0,1);
  const slope=i=>{
    if(i===0)return (section[1][1]-section[0][1])/(section[1][0]-section[0][0]);
    if(i===section.length-1)return (section[i][1]-section[i-1][1])/(section[i][0]-section[i-1][0]);
    const left=(section[i][1]-section[i-1][1])/(section[i][0]-section[i-1][0]);
    const right=(section[i+1][1]-section[i][1])/(section[i+1][0]-section[i][0]);
    return left*right<=0?0:2*left*right/(left+right);
  };
  const s2=s*s,s3=s2*s;
  return (2*s3-3*s2+1)*v+(s3-2*s2+s)*l*slope(j-1)+(-2*s3+3*s2)*w+(s3-s2)*l*slope(j);
}
function polar(a,r,y,tangent=0){
  return [Math.sin(a)*r+Math.cos(a)*tangent,y,Math.cos(a)*r-Math.sin(a)*tangent];
}
function orbitWall(s,r,h0,h1,N,color,offset=0){
  for(let i=0;i<N;i++){
    const a=i*turn/N,b=(i+1)*turn/N;
    s.quad(polar(a,r,h0),polar(b,r,h0),polar(b,r,h1),polar(a,r,h1),
      [[r*a,h0+offset],[r*b,h0+offset],[r*b,h1+offset],[r*a,h1+offset]],color);
  }
}
function annulus(s,inner,outer,y,N){
  for(let i=0;i<N;i++){
    const a=i*turn/N,b=(i+1)*turn/N;
    const p=[polar(a,inner,y),polar(a,outer,y),polar(b,outer,y),polar(b,inner,y)];
    s.quad(...p,p.map(q=>[q[0]/3.2,q[2]/3.2]));
  }
}
function cladding(group,m){
  const facade=new Surface(),crown=new Surface(),rails=new Surface(),screen=new Surface();
  const fin=new Surface(),ribs=new Surface(),brass=new Surface();
  const white=new T.Color('#e4edf1'),crownShade=new T.Color(),crownMetal=architecturalMetal(0xc3cbd0,.23);
  crownMetal.vertexColors=true;
  const mainFin=architecturalMetal(0xc4c9c6,.21);mainFin.vertexColors=true;mainFin.metalness=.74;mainFin.roughness=.25;
  const bronze=architecturalMetal(0xb5966c,.24);
  const glass=m.bambooGlass;
  const skyGlass=new T.MeshPhysicalMaterial({color:0x809aa4,vertexColors:true,metalness:.27,roughness:.12,clearcoat:.87,
    clearcoatRoughness:.10,transparent:true,opacity:.73,side:T.FrontSide,depthWrite:false,envMapIntensity:1.15});
  skyGlass.userData.cityProbe='district';
  const innerFrame=new Instances(new T.CylinderGeometry(.80,1,1,6,1,true),architecturalMetal(0xd3bc9b,.23),'空中大厅内部金属桁架');
  const lightTube=new T.MeshStandardMaterial({color:0xdbccb2,emissive:0xffc181,emissiveIntensity:.18,roughness:.37});
  m.walls.push(lightTube);
  const guides=new Instances(new T.CylinderGeometry(1,1,1,5,1,true),lightTube,'冠部内侧线性照明');
  const edge=new T.MeshStandardMaterial({color:0x536167,metalness:.52,roughness:.32,side:T.DoubleSide});
  const steps=88,N=112;
  for(let j=0;j<steps;j++){
    const t0=.035+j*(1-.035)/steps,t1=.035+(j+1)*(1-.035)/steps,y0=t0*height,y1=t1*height,r0=radius(t0),r1=radius(t1);
    for(let i=0;i<N;i++){
      const a=turn*i/N,b=turn*(i+1)/N;
      // 168 glass lites encircle a typical floor. The number of lights and
      // slab spacing remain consistent as the conical shell narrows.
      const u=i/N*168*1.37,v=(i+1)/N*168*1.37;
      const A=polar(a,r0,y0),B=polar(b,r0,y0),C=polar(b,r1,y1),D=polar(a,r1,y1);
      if(t0<.854)facade.quad(A,B,C,D,[[u,y0],[v,y0],[v,y1],[u,y1]],white);
      else{
        const value=.64+.15*Math.sin(a*2.0+.55)+.09*Math.cos((i%4)*.8);
        crownShade.setRGB(value*.77,value*.87,value);
        crown.quad(A,B,C,D,[[u,y0],[v,y0],[v,y1],[u,y1]],crownShade);
      }
    }
  }
  function band(s,t,h,depth){
    const y=t*height,r0=radius(t)+depth,r1=radius((y+h)/height)+depth;
    for(let i=0;i<112;i++){
      const a=i*turn/112,b=(i+1)*turn/112;
      s.quad(polar(a,r0,y),polar(b,r0,y),polar(b,r1,y+h),polar(a,r1,y+h));
    }
  }
  for(const t of [.306,.628,.829]){
    band(screen,t,1.04,.06);
    for(let k=0;k<4;k++)band(rails,t+k*.0007,.095,.14);
    band(brass,t+.00275,.105,.17);
  }
  // Folded stainless-steel sections have different optical normals across
  // the chamfer and the face, where a cylindrical tube would look flat.
  const tones=[new T.Color('#a3adae'),new T.Color('#e0e5df'),new T.Color('#d1dbd9'),new T.Color('#859298')];
  function sweep(s,at,count){
    let prior;
    for(let j=0;j<=count;j++){
      const v=at(j/count),a=v[0],t=v[1],w=v[2],depth=v[3],r=radius(t)+.095;
      const q=[[-.5,0],[-.45,.32],[-.18,1],[.36,.79],[.50,0]].map(([side,front])=>polar(a,r+depth*front,t*height,w*side));
      if(prior)for(let f=0;f<4;f++)s.quad(prior[f],prior[f+1],q[f+1],q[f],undefined,tones[f]);
      prior=q;
    }
  }
  for(let i=0;i<columns;i++){
    const split=i%2?1:-1,root=2*Math.floor(i/2)+.5;
    sweep(fin,k=>{
      const t=.097+k*(.818-.097),a=i*turn/columns;
      return [a,t,.69-.18*k,.79-.22*k];
    },23);
    sweep(fin,k=>{
      const t=.097*k;
      // From 28 lower portals the structure opens to 56 tower columns.
      const index=k<.44?T.MathUtils.lerp(root,i+split*1.05,k/.44):T.MathUtils.lerp(i+split*1.05,i,(k-.44)/.56);
      return [index*turn/columns,t,.95-.48*k,.94-.3*k];
    },14);
    sweep(ribs,k=>{
      const t=.818+k*.182,merged=root+(i-root)*(1-Math.min(1,k/.61));
      return [merged*turn/columns,t,Math.max(.04,.37*(1-k*.86)),Math.max(.11,.50*(1-k*.76))];
    },18);
  }
  for(let i=0;i<28;i++)for(const side of [-1,1]){
    sweep(ribs,k=>{
      const t=.835+k*.105,index=2*i+.5+side*k*2;
      return [index*turn/columns,t,.43-.16*k,.37];
    },14);
    sweep(fin,k=>[(2*i+.5+side*1.55*k)*turn/columns,k*.043,.36-.11*k,.46],7);
  }
  for(let i=0;i<28;i++){
    const a=i*turn/28;
    for(const sign of [-1,1]){
      const A=polar(a,.89*radius(.854),height*.854),
        B=polar(a+sign*.050,.87*radius(.919),height*.919),
        C=polar(a+sign*.007,.87*radius(.975),height*.975);
      innerFrame.between(...A,...B,.26);innerFrame.between(...B,...C,.19);
      if(i%2===0){guides.between(...A,...B,.11);guides.between(...B,...C,.12);}
    }
  }
  innerFrame.flush(group);guides.flush(group);
  facade.mesh(group,glass,'低辐射弧面双层玻璃',true);crown.mesh(group,skyGlass,'锥形空中大厅玻璃');
  fin.mesh(group,mainFin,'不锈钢折面翼柱 · 基座分叉');
  ribs.mesh(group,crownMetal,'透光冠部斜交格构');
  screen.mesh(group,edge,'设备层暗背板');rails.mesh(group,m.rail,'设备层遮阳百叶');
  brass.mesh(group,bronze,'设备层细金属收边');
}
function lobby(group,m){
  const glassDrum=new Surface(),soffit=new Surface(),paving=new Surface(),channels=new Surface();
  const r=27.65,h=14.15,gaskets=new Instances(new T.CylinderGeometry(1,1,1,6,1,true),architecturalMetal(0x646f70,.28,'street'),'大堂门扇与压条');
  const stainless=architecturalMetal(0xa9ad9f,.25,'street');
  const bands=new Instances(new T.BoxGeometry(1,1,1),stainless,'大堂雨棚收边');
  const warm=new T.MeshStandardMaterial({color:0xe7b98a,emissive:0xffb56d,emissiveIntensity:.78,roughness:.48,side:T.DoubleSide});
  orbitWall(glassDrum,r,.24,h,112,new T.Color('#f0e6ce'));
  annulus(soffit,r-.12,radius(h/height)+.16,h,112);
  for(let i=0;i<4;i++){
    annulus(channels,r+1.1+i*1.2,r+1.17+i*1.2,h-.04,112);
  }
  annulus(paving,r-.4,49.2,.192,112);
  const box=new T.BoxGeometry(1,1,1),blades=new Instances(box,new T.MeshStandardMaterial({color:0x9d9b8d,roughness:.48,metalness:.53}),'大堂阴影百叶');
  for(let i=0;i<56;i++){
    const a=i/56*turn,P=polar(a,r+.08,.28),Q=polar(a,r+.08,h-.06);
    gaskets.between(...P,...Q,i%2?.058:.11);
    if(i%4===0){
      const rot=a;
      const p=polar(a,r+1.0,3.1);
      bands.at(...p,3.65,.12,1.84,rot);
      for(const side of [-1,1]){
        const lo=polar(a,r+.18,.25,side*.89),hi=polar(a,r+.18,3.09,side*.89);
        gaskets.between(...lo,...hi,.055);
        const grip=polar(a,r+.23,1.09,side*.13),gripTop=polar(a,r+.23,1.68,side*.13);gaskets.between(...grip,...gripTop,.026);
      }
      for(let j=0;j<4;j++){
        const l=polar(a,r+.12,9.0+j*.46);
        blades.at(...l,2.7,.12,.17,rot);
      }
    }
  }
  paving.mesh(group,m.paving,'塔前花岗岩铺地');soffit.mesh(group,m.cream,'双层入口室外吊顶');channels.mesh(group,warm,'环形嵌入式照明');
  glassDrum.mesh(group,m.atriumGlass,'后退式高透明入口大堂');gaskets.flush(group);bands.flush(group,true);blades.flush(group);
  const board=new T.Group();board.position.set(35.45,0,9.5);board.rotation.y=1.32;group.add(board);
  const c=document.createElement('canvas');c.width=1024;c.height=208;const ctx=c.getContext('2d');
  ctx.fillStyle='#393e40';ctx.fillRect(0,0,c.width,c.height);
  const random=(n)=>Math.abs(Math.sin(n*942.71)*46.21)%1;
  for(let i=0;i<4400;i++){ctx.fillStyle='rgba(175,179,175,'+(random(i)*.12)+')';ctx.fillRect(random(i+5)*1024,random(i+22)*208,2+random(i+12)*10,1);}
  ctx.font='500 68px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#ddd1ad';ctx.fillText('中国华润大厦',512,99);ctx.font='22px Arial';ctx.fillText('CHINA RESOURCES TOWER',512,153);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const stone=new T.MeshStandardMaterial({color:0x404748,roughness:.48});
  const obj=new T.Mesh(new T.BoxGeometry(6.7,1.38,.40),[stone,stone,stone,stone,new T.MeshStandardMaterial({map:tex,roughness:.46}),stone]);
  obj.position.y=.89;obj.castShadow=true;board.add(obj);
}
export function bamboo(root,m){
  const group=new T.Group();group.name='中国华润大厦 · 春笋';group.position.set(-263.3,0,-456.81);
  group.userData.excludeFromDistrictProbe=true;root.add(group);
  cladding(group,m);lobby(group,m);
}
