import {peacocks} from './park-peacocks.js';
import * as T from 'three';
import {Grid,Instances,Surface,clamp,random} from './city-geometry.js';
import {photo} from './city-materials.js';
import {southWalk} from './talent-field.js';
import {routePoint} from './talent-bridge.js';
import {drape,groundIndex,landingPaving} from './star-south-ground.js';
import {parkShrubs} from './park-shrubs.js';

const tau=Math.PI*2,brickHalf=2.05,blueOffset=-5.65;
const segments=new Grid(20);
let length=0;
for(let i=1;i<southWalk.length;i++){
  const [x,z]=southWalk[i-1],[bx,bz]=southWalk[i],span=Math.hypot(bx-x,bz-z);
  segments.add({x,z,dx:(bx-x)/span,dz:(bz-z)/span,span,start:length},
    [Math.min(x,bx)-22,Math.min(z,bz)-22,Math.max(x,bx)+22,Math.max(z,bz)+22]);
  length+=span;
}
function nearest(x,z){
  let best=null,distance=Infinity;
  for(const segment of segments.query(x,z)){
    const {x:ax,z:az,dx,dz,start,span}=segment;
    const along=(x-ax)*dx+(z-az)*dz,t=clamp(along,0,span);
    const d=(x-ax-dx*t)**2+(z-az-dz*t)**2;
    if(d>=distance)continue;
    distance=d;best={s:start+t,offset:-(x-ax)*dz+(z-az)*dx,beyond:along-t};
  }
  return best;
}
function sample(s,offset){
  s=clamp(s,0,length);
  const c=routePoint(southWalk,s),a=routePoint(southWalk,Math.max(0,s-1.5)),b=routePoint(southWalk,Math.min(length,s+1.5));
  const l=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/l,dz=(b.z-a.z)/l;
  return {x:c.x-dz*offset,z:c.z+dx*offset,dx,dz,s};
}
function brickMaterial(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),rand=random(359),tile=32;
  ctx.fillStyle='#737370';ctx.fillRect(0,0,512,512);
  for(let i=-1;i<16;i++)for(let j=-1;j<16;j++){
    const k=((i-j)%4+4)%4;if(k!==0&&k!==3)continue;
    const w=k===0?tile*2:tile,h=k===0?tile:tile*2,g=129+Math.floor(rand()*32);
    ctx.fillStyle='rgb('+g+','+(g-1)+','+(g-3)+')';ctx.fillRect(i*tile+1,j*tile+1,w-2,h-2);
    ctx.fillStyle='rgba(235,230,226,.35)';ctx.fillRect(i*tile+1,j*tile+1,w-2,1);
  }
  const img=ctx.getImageData(0,0,512,512);
  for(let i=0;i<img.data.length;i+=4){const v=(rand()-.5)*18;for(let k=0;k<3;k++)img.data[i+k]+=v;}
  ctx.putImageData(img,0,0);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
  return new T.MeshStandardMaterial({map,roughness:.92,side:T.DoubleSide});
}

function palmCrown(){
  const surf=new Surface(),rand=random(9347),tone=new T.Color();
  // Each rachis carries two ranks of narrow, folded leaflets. Outer fronds
  // arch below the growing point. Juvenile spears remain upright at the centre.
  for(let k=0;k<42;k++){
    const ring=k/41,a=k*2.39996+rand()*.16,dx=Math.sin(a),dz=Math.cos(a);
    const run=1.05+2.65*ring**.54+rand()*.38,rise=2.55-1.35*ring,fall=.34+3.1*ring**2;
    const at=t=>new T.Vector3(dx*run*t,rise*Math.sin(t*1.95)-fall*t*t,dz*run*t);
    const green=.17+rand()*.11;
    for(let j=0;j<36;j++){
      const t=j/36,base=at(t),next=at((j+1)/36),w=.029*(1-t)+.005;
      const point=(v,out)=>[v.x+dz*out,v.y,v.z-dx*out];
      tone.setRGB(.14+green*.24,.18+green*.20,.07);
      surf.quad(point(base,-w),point(base,w),point(next,w*.87),point(next,-w*.87),undefined,tone);
      for(const side of [-1,1]){
        const len=(.17+.85*Math.sin(Math.PI*(.12+t*.85))**.77)*(1-.32*t)*(.82+rand()*.30);
        const out=len*side,back=.12+.35*t,drop=.20+.72*ring+rand()*.18;
        const tip=(v,d,b,h)=>[base.x+dz*out*v+dx*(back*v+d),base.y+b-drop*len*v*v+h,base.z-dx*out*v+dz*(back*v+d)];
        const width=.026+rand()*.012,shade=.78+rand()*.31;
        tone.setRGB((green*.64+.022)*shade,(green+.035)*shade,(green*.52+.018)*shade);
        const p0=tip(0,0,0,0),p1=tip(.50,-width,.09,0),p2=tip(.51,.004,.09,.031),p3=tip(.51,width,.09,0),end=tip(1,0,0,0);
        surf.quad(p0,p1,end,p2,undefined,tone);tone.multiplyScalar(.79);surf.quad(p0,p2,end,p3,undefined,tone);
      }
    }
  }
  return surf.geometry();
}

function trees(root,at,m,landing){
  const rand=random(347),bark=new T.TextureLoader().load('/talent/field/palm-bark.webp');
  bark.colorSpace=T.SRGBColorSpace;bark.wrapS=bark.wrapT=T.RepeatWrapping;bark.repeat.set(3,2.1);
  const stems=new Instances(new T.CylinderGeometry(.82,1,1,12),new T.MeshStandardMaterial({map:bark,roughness:.96}),'南岸 · 棕榈粗鳞纹树干');
  const crowns=new Instances(palmCrown(),new T.MeshStandardMaterial({vertexColors:true,roughness:.9,side:T.DoubleSide}),'南岸 · 羽状棕榈叶');
  // IMG_0344 and IMG_0347 show the row on the far side of the blue track.
  for(const s of [135,143,151,158,166,173,181,190,198,207]){
    const p=at(s,-12-rand()*1.6),h=5.0+rand()*1.9,r=.28+rand()*.065;
    stems.at(p.x,p.y+h*.5,p.z,r,h,r,rand()*tau);
    crowns.at(p.x,p.y+h-.1,p.z,1.12,1.12,1.12,rand()*tau);

  }
  const barkMap=new T.TextureLoader().load(import.meta.env.BASE_URL+'foliage/twig-bark.webp');
  barkMap.colorSpace=T.SRGBColorSpace;barkMap.wrapS=barkMap.wrapT=T.RepeatWrapping;barkMap.repeat.set(1,2);
  const boughs=new Instances(new T.CylinderGeometry(.58,1,1,7),new T.MeshStandardMaterial({map:barkMap,color:0xbdada0,roughness:.99}),'南岸 · 乔木分枝');
  const leafMap=new T.TextureLoader().load('/talent/field/leaf-sprays.webp');leafMap.colorSpace=T.SRGBColorSpace;
  const leaves=new Surface(),v=(x,y,z)=>new T.Vector3(x,y,z);
  const green=new T.Color();
  function twig(a,b,r){boughs.between(a.x,a.y,a.z,b.x,b.y,b.z,r);}
  function spray(tip,scale){
    const yaw=rand()*tau,cs=Math.cos(yaw),sn=Math.sin(yaw);
    const tile=Math.floor(rand()*4),leafUv=[[tile/4,0],[(tile+1)/4,0],[(tile+1)/4,1],[tile/4,1]];
    const reach=.47*(1+rand()*.46)*scale,up=v((rand()-.5)*.32,reach*.6,(rand()-.5)*.32);
    const side=v(cs*reach,0,sn*reach),centre=tip.clone().addScaledVector(side,.23);
    green.setRGB(.92+rand()*.22,1.00+rand()*.12,.91);
    leaves.quad(...[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>centre.clone().addScaledVector(side,i).addScaledVector(up,j).toArray()),leafUv,green);
  }
  function tree(s,off,height){
    const p=at(s,off),base=v(p.x,p.y,p.z),lean=v((rand()-.5)*.7,0,(rand()-.5)*.7);
    // Never plant a tree on top of Starlight Bridge's paved south landing ramp!
    if(landing?.heightAt(p.x,p.z)!=null)return;
    const crownWidth=.83+.39*rand(),clearance=.33+.16*rand();
    const fork=base.clone().add(v(lean.x,height*clearance,lean.z));twig(base,fork,height*.024);
    for(let arm=0;arm<6;arm++){
      const yaw=(arm+rand()*.57)*tau/6,spread=height*crownWidth*(.16+rand()*.10),dir=v(Math.cos(yaw),0,Math.sin(yaw));
      const origin=base.clone().lerp(fork,.52+rand()*.48);
      const elbow=origin.clone().addScaledVector(dir,spread*(.52+rand()*.42)).add(v(0,height*(.20+rand()*.19),0));
      twig(origin,elbow,height*(.009+rand()*.011));
      for(let j=0;j<4;j++){
        const a=yaw+(rand()-.5)*1.8,run=spread*(.53+rand()*.67);
        const outer=elbow.clone().add(v(Math.cos(a)*run,height*(.13+rand()*.18),Math.sin(a)*run));
        twig(elbow,outer,height*.006);
        for(let k=0;k<5;k++){
          const b=a+(rand()-.5)*2.8,l=height*(.06+rand()*.095);
          const tip=outer.clone().add(v(Math.cos(b)*l,height*(.014+rand()*.13),Math.sin(b)*l));
          twig(outer,tip,.017+rand()*.012);
          for(let cluster=0;cluster<2;cluster++){
            const t=tip.clone().lerp(outer,rand()*.71);
            spray(t,.85+rand()*.7);
          }
        }
      }
    }
  }
  for(const [s,off,h] of [[9,5.5,5],[23,5.8,5.2],[39,4.8,5.5],[55,5.8,7.5],[71,-3.8,6.3],[84,5.6,6.7],[101,5.2,6.4],[118,-3.8,6.7],[131,5.2,6.4],[148,6.4,5.8],[168,4.8,6.1]])tree(s,off,h);
  leaves.mesh(root,new T.MeshStandardMaterial({map:leafMap,alphaTest:.24,vertexColors:true,roughness:.88,side:T.DoubleSide}),'南岸 · 乔木疏叶');
  for(const b of [stems,crowns,boughs])b.flush(root,true);
  const blossoms=[];
  for(const [s,off,h] of [[127,-13,6.8],[151,6.8,6.3],[176,6.7,7.1],[192,6.5,6.1],[201,6.3,7.5],[220,-7.3,7.8],[239,-7.4,6.9],[254,-7.1,7.2],[268,-7.4,6.7]]){
    const p=at(s,off);
    if(landing?.heightAt(p.x,p.z)==null)blossoms.push([p.x,p.z,h,rand(),p.y]);
  }
  return blossoms;
}

function overlook(root,at,m){
  // The pair of white steel birds stands on the timber lookout.
  const c=at(229,0),dx=-c.dz,dz=c.dx,rx=c.dx,rz=c.dz;
  const p=(u,w,h)=>[c.x+dx*u+rx*w,h,c.z+dz*u+rz*w];
  const deck=new Surface(),posts=new Instances(new T.CylinderGeometry(1,1,1,10),m.rail,'亲水平台 · 钢扶手');
  const wear=.32;
  deck.quad(p(-2,-1.38,wear),p(12,-1.38,wear),p(12,1.38,wear),p(-2,1.38,wear),[[0,0],[7,0],[7,1.5],[0,1.5]]);
  const rod=(batch,a,b,r)=>batch.between(...a,...b,r);
  for(const side of [-1,1]){
    for(let u=2;u<=12;u+=2)rod(posts,p(u,1.35*side,wear),p(u,1.35*side,1.42),.03);
    for(const h of [.56,.84,1.42])rod(posts,p(2,1.35*side,h),p(12,1.35*side,h),h===1.42?.038:.014);
  }
  rod(posts,p(12,-1.35,1.42),p(12,1.35,1.42),.038);
  deck.mesh(root,new T.MeshStandardMaterial({map:photo('bridge-deck-color.webp'),side:T.DoubleSide,roughness:.72}),'南岸 · 亲水木平台');
  posts.flush(root,true);
  const plumage=new T.Group();plumage.name='孔雀亭';
  plumage.position.set(...p(8.7,0,wear));plumage.rotation.y=Math.atan2(-dx,-dz);
  peacocks(plumage);root.add(plumage);
  return (x,z)=>{const a=x-c.x,b=z-c.z,u=a*dx+b*dz,w=a*rx+b*rz;return u>=-2&&u<=12&&Math.abs(w)<=1.38;};
}

export function southPromenade(root,m,landing,ground){
  const paths=[];
  const at=(s,off)=>{
    const p=sample(s,off);
    p.y=ground.heightAt(p.x,p.z)??.039;
    return p;
  };
  function strip(name,lo,hi,material,start=0,end=length,lift=.012,lip=null){
    const surface=new Surface(),samples=[start];
    for(let s=start+1.6;s<end;s+=1.6)samples.push(s);samples.push(end);
    const row=(s,k)=>{
      const p=at(s,k===0?lo:hi),v=[p.x,p.y+lift,p.z];
      if(!lip)return v;
      const t=clamp((s-start)/7,0,1);
      return v.map((n,j)=>T.MathUtils.lerp(lip[k].getComponent(j),n,t));
    };
    let a=row(start,0),b=row(start,1);
    const uv=v=>[(v[0]+v[2])*.43,(v[2]-v[0])*.43];
    for(const s of samples.slice(1)){
      const c=row(s,0),d=row(s,1);
      surface.quad(a,b,d,c,[a,b,d,c].map(uv));a=c;b=d;
    }
    const fitted=drape(surface,ground,lift);
    fitted.mesh(root,material,name,true);paths.push(fitted);
  }
  strip('南岸 · 灰色人字砖步道',-brickHalf,brickHalf,brickMaterial(),0,length,landingPaving+.005);
  const blue=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x3b84be,roughness:.90,side:T.DoubleSide});
  let start=0,lip=landing?.southLaneEnd;
  if(lip){
    const center=lip[0].clone().lerp(lip[1],.5);start=nearest(center.x,center.z)?.s??0;
    const l=at(start,blueOffset-1);
    if(Math.hypot(lip[1].x-l.x,lip[1].z-l.z)<Math.hypot(lip[0].x-l.x,lip[0].z-l.z))lip=[lip[1],lip[0]];
  }
  strip('南岸 · 蓝色慢跑道',blueOffset-1.06,blueOffset+1.06,blue,start,length,landingPaving+.011,lip);
  strip('南岸 · 浅石步行道',-10.65,-8.05,m.path,34,length,landingPaving);
  const edging=new T.MeshStandardMaterial({color:0xb6b4a6,roughness:.95,side:T.DoubleSide});
  for(const offset of [-brickHalf,brickHalf])strip('砖道边石',offset-.08,offset+.08,edging,0,length,landingPaving+.009);
  const hedge=parkShrubs(root,'南岸 · 修剪绿篱',(x,z)=>ground.heightAt(x,z)??.039);
  const rand=random(344);
  // Keep clear of Starlight Bridge south landing ramp (s < 32); place hedges strictly on turf strips between paths.
  for(const [a,b,off] of [[32,135,-7.42],[143,182,-7.45],[199,220,4.1],[221,226,3.8],[232,238,3.7],[241,272,4.1]]){
    for(let s=a;s<b;s+=.57){
      const p=at(s,off);
      if(landing?.heightAt(p.x,p.z)!=null)continue;
      hedge.at(p.x,p.y+.33,p.z,.65+rand()*.15,.48+rand()*.08,.79,Math.atan2(p.dx,p.dz));
    }
  }
  hedge.flush(root,true);
  const seats=new Instances(new T.BoxGeometry(),m.wood,'南岸 · 临路长凳'),feet=new Instances(new T.BoxGeometry(),m.curb,'南岸 · 座凳石基');
  for(const s of [266,269,272,275]){
    const p=at(s,-2.65),rot=Math.atan2(p.dx,p.dz);
    for(const t of [-.82,.82])feet.at(p.x+p.dx*t,p.y+.18,p.z+p.dz*t,.59,.36,.30,rot);
    for(let i=-2;i<=2;i++)seats.at(p.x-p.dz*i*.115,p.y+.44,p.z+p.dx*i*.115,.108,.09,2.89,rot);
  }
  seats.flush(root,true);feet.flush(root,true);const blossoms=trees(root,at,m,landing);
  const onLookout=overlook(root,at,m),pathHeight=groundIndex(paths);
  const pavedHeightAt=(x,z)=>onLookout(x,z)?Math.max(.32,pathHeight(x,z)??0):pathHeight(x,z);
  const southBlueEnd=at(length,blueOffset);
  return {
    southBlueEnd,blossoms,
    trees:Array.from({length:60},(_,i)=>{
      const s=6+i*4.45,off=i%3===0?-21-rand()*3:-14.8-rand()*3.5,p=at(s,off);
      return [p.x,p.z,6.4+rand()*3.8,i%2];
    }),
    pavedHeightAt,
    heightAt(x,z){
      const turf=ground.heightAt(x,z),paving=pavedHeightAt(x,z);
      if(turf==null)return paving;
      return Math.max(turf,paving??0);
    },
    reservesPlant(x,z){
      const q=nearest(x,z);
      return !!q&&Math.abs(q.beyond)<2&&q.offset>=-14.5&&q.offset<=6.5;
    }
  };
}
