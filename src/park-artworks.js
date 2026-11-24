import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {bounds, Instances, random} from './city-geometry.js';
import {mountSculpture} from './park-sculpture.js';
import {applyDetailMaps} from './procedural-textures.js';
import {buildSdfGeometry, smin, smax, sdPolyline} from './sdf-mesh.js';

const finish=(color,roughness=.65,metalness=.15,detail)=>{
  const mat=new T.MeshStandardMaterial({color,roughness,metalness});
  const preset=detail??(metalness>=.35?'brushedMetal':roughness>=.82?'granite':'stucco');
  return applyDetailMaps(mat,preset,{normalScale:metalness>=.35?.26:.34});
};
const prism=new T.BoxGeometry(1,1,1), post=new T.CylinderGeometry(1,1,1,10);
function solid(group,geometry,material,x,y,z){
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}

function campusDial(group){
  const radius=3.1,slope=.23,top=z=>1.02+slope*z;
  const stone=[0xa58377,0xa88a7b,0x967a6a,0xb29a88].map(c=>finish(c,.90,.02));
  const wedges=stone.map(()=>[]);
  const rng=random(1983);
  for(let row=0;row<5;row++){
    for(let j=0;j<38;j++){
      const a=(j+(row%2)*.5)*Math.PI/19,b=a+Math.PI/19-.004;
      const pts=[[Math.cos(a)*radius,Math.sin(a)*radius],[Math.cos(b)*radius,Math.sin(b)*radius]];
      const co=[];
      for(const [k,t] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
        const [x,z]=pts[k];co.push(x,(row+t)*(top(z)-.17)/5+(t?-.003:.003),z);
      }
      wedges[Math.floor(rng()*stone.length)].push(...co);
    }
  }
  wedges.forEach((co,i)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(co,3));g.computeVertexNormals();stone[i].side=T.DoubleSide;solid(group,g,stone[i],0,0,0);});
  const disc=new T.Group();disc.position.y=1.02;disc.rotation.x=-Math.atan(slope);group.add(disc);
  solid(disc,new T.CylinderGeometry(radius+.04,radius+.02,.19,96),finish(0xbebeb7,.84),0,-.09,0);
  const c=document.createElement('canvas');c.width=c.height=768;const g=c.getContext('2d');
  g.fillStyle='#c8c6bc';g.fillRect(0,0,768,768);
  for(let i=0;i<30000;i++){g.fillStyle=i%2?'rgba(68,64,58,.16)':'rgba(255,255,250,.24)';g.fillRect(rng()*768,rng()*768,1.6,1.4);}
  g.translate(384,384);g.strokeStyle='#68675f';g.fillStyle='#52524c';g.lineWidth=1.3;
  for(const r of [63,156,231,298,339,371]){g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();}
  for(let j=0;j<120;j++){
    g.save();g.rotate(j*Math.PI/60);g.beginPath();g.moveTo(0,339);g.lineTo(0,j%10===0?369:351);g.stroke();
    if(j%10===0){g.font='28px KaiTi,serif';g.textAlign='center';g.fillText('子丑寅卯辰巳午未申酉戌亥'[j/10],0,317);
      g.beginPath();g.moveTo(0,65);g.lineTo(0,232);g.stroke();}
    g.restore();
  }
  const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=8;
  solid(disc,new T.CircleGeometry(radius,96).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:tx,roughness:.93}),0,.012,0);
  solid(disc,new T.ConeGeometry(.063,3.05,12),finish(0x494841,.46,.67),0,1.535,0);
}

function tradeArch(group){
  const blue=finish(0x157fc0,.40,.49),pale=finish(0x81c4cc,.41,.46);
  const piece=(points,depth,color,z)=>{
    const path=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
    solid(group,new T.ExtrudeGeometry(path,{depth,bevelEnabled:false}),color,0,0,z);
  };
  const outer=[[-18.4,.08],[-16.6,3.64],[-13.9,6.98],[-10.48,9.82],[-9.5,9.05],[-7.1,10.62],[-3.8,12.1],[.2,13.48],[3.29,13.87],[5.7,11.78],[9.3,10.75],[11.4,8.1],[15.3,5.4],[18.4,2.44],[18.4,.08]];
  const inner=Array.from({length:35},(_,i)=>{const x=18.4-36.8*i/34;return [x,.08+7.72*(1-(x/18.4)**2)];});
  piece([...outer,...inner],1.18,blue,-.59);
  const crown=[[-15.9,3.19],[-13.4,6.08],[-9.5,8.51],[-6.6,9.75],[-1.9,11.23],[3.3,11.85],[9.04,11.43],[11.15,6.59]];
  const lip=Array.from({length:25},(_,i)=>{const x=11.15-27.05*i/24;return [x,.40+7.93*(1-(x/18.4)**2)];});
  piece([...crown,...lip],1.21,pale,-.605);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=240;
  const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#22596a';
  for(const [line,y,size] of [['中国（广东）自由贸易试验区',58,62],['CHINA (GUANG DONG) PILOT FREE TRADE ZONE',112,30],['深圳前海蛇口片区',159,45],['QIANHAI & SHEKOU AREA OF SHENZHEN',204,24]]){
    ctx.font='bold '+size+'px Arial, "Microsoft YaHei", sans-serif';ctx.fillText(line,512,y);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const ink=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.2,depthWrite:false,roughness:.64});
  for(const side of [-1,1])solid(group,new T.PlaneGeometry(13.6,2.8),ink,.1,9.82,side*.613).rotation.y=side<0?Math.PI:0;
}
function mainTorch(group){
  const book=new RoundedBoxGeometry(1,1,1,2,.035), rng=random(2011);
  const stone=new Instances(book,finish(0xffffff,.91,.03),'主火炬塔 · 26册花岗岩书卷');
  const mill=new Instances(prism,finish(0x98877e,.81,.04),'书脊和浅浮雕分层');
  solid(group,new T.CylinderGeometry(3.75,3.95,.4,64),finish(0xa0988d),0,.2,0);
  let base=.4;
  for(let i=0;i<26;i++){
    const k=i/25,h=i===25?1.32:(25.6-1.32)/25;
    // The shaft opens out into overhanging, rotated books near the bowl.
    const fan=T.MathUtils.smoothstep(k,.30,.86),width=2.65+3.02*fan;
    const yaw=.14*Math.sin(i*.57)+fan*(.42*Math.sin(i*1.79));
    const dx=.35*fan*Math.sin(i*.91),dz=.30*fan*Math.cos(i*1.26);
    const col=new T.Color().setHSL(.058+rng()*.024,.12+rng()*.08,.51+rng()*.12);
    stone.at(dx,base+h/2,dz,width,h,width*(.76+.06*Math.cos(i)),yaw,col);
    if(k>.35){
      const face=width*(.76+.06*Math.cos(i))*.5;
      for(const v of [.15,.23,.82])mill.at(dx+Math.sin(yaw)*face,base+h*v,dz+Math.cos(yaw)*face,width*.91,.032,.033,yaw);
    }
    base+=h;
  }
  stone.flush(group,true);mill.flush(group);
}

function shenzhener(group){
  // Stroke colours, the unsupported diagonals and the gap between characters
  // follow the published front view. Image coordinates preserve their spacing.
  const palette=[0xfdfbf4,0xe62737,0xffbe1d,0x1477ac,0x6bb966,0xf4dc58];
  const unit=.019, point=(x,y)=>[(x-351)*unit,(340-y)*unit];
  function stroke(a,b,w,c,z=0){
    const [x,y]=point(...a),[u,v]=point(...b);
    const mesh=solid(group,prism,materials[c],(x+u)/2,(y+v)/2,z);
    mesh.scale.set(Math.hypot(u-x,v-y)+.017,w*unit,.30);mesh.rotation.z=Math.atan2(v-y,u-x);
  }
  const materials=palette.map(c=>finish(c,.42,.28));
  const strokes=[
    [57,207,110,207,12,4],[91,214,88,334,14,0],[53,284,111,284,13,2],[65,248,160,248,12,5],[133,211,133,272,12,1],[152,208,152,254,13,3],[119,308,162,269,11,0],[135,286,155,333,10,1],
    [209,239,264,239,10,3],[212,250,252,250,7,5],[262,233,261,257,8,3],[260,257,253,265,8,3],[253,265,210,265,8,3],[207,275,267,275,9,0],[209,285,208,321,9,2],[215,306,235,317,9,1],[233,317,268,317,9,1],[237,280,236,306,8,5],[235,295,265,294,7,5],
    [344,250,344,276,9,2],[342,279,342,324,9,1],[359,231,398,231,9,5],[364,235,364,259,9,5],[397,234,397,258,9,3],[348,270,408,270,9,0],[356,273,356,319,7,0],[373,266,373,322,8,0],[387,263,387,320,8,0],[399,277,400,320,8,2],
    [458,248,486,248,9,1],[473,217,475,323,11,1],[462,319,486,319,8,2],[499,216,502,323,10,3],[519,213,524,323,10,5],[543,216,550,322,10,4],
    [602,223,605,267,12,2],[605,266,573,321,12,2],[607,275,645,321,11,1]];
  for(const [x,y,u,v,width,col] of strokes)stroke([x,y],[u,v],width,col,-(col%3)*.025);
  const p=point(344,234);solid(group,new T.SphereGeometry(.14,12,8),materials[4],p[0],p[1],0);
}

let cachedHandGeo=null;
function handHeartHalfGeometry(){
  if(cachedHandGeo)return cachedHandGeo;
  // Sculpt one crisp, gracefully chamfered heart-hand ribbon (side=+1) via spline-sampled SDF
  // intersected smoothly with front/back architectural planes (smax) and grounded firmly at y=0.
  const sample=(ctrl,rads,n)=>{
    const c=new T.CatmullRomCurve3(ctrl.map(p=>new T.Vector3(...p)));
    const pts=[],rs=[];
    for(let i=0;i<=n;i++){
      const t=i/n,v=c.getPoint(t),f=t*(rads.length-1),i0=Math.floor(f),i1=Math.min(rads.length-1,i0+1);
      pts.push([v.x,v.y,v.z]);rs.push(rads[i0]+(rads[i1]-rads[i0])*(f-i0));
    }
    return {pts,rs};
  };
  const upper=sample(
    [[0.04,2.24,0],[-0.34,2.62,0],[-0.76,2.66,0],[-1.18,2.24,0],[-1.52,1.52,0],[-1.95,0.72,0],[-2.32,0.10,0]],
    [0.24,0.32,0.34,0.31,0.28,0.29,0.26],14
  );
  const lower=sample(
    [[-2.26,0.12,0],[-1.60,0.30,0],[-0.98,0.62,0],[-0.44,0.58,0],[0.04,0.52,0]],
    [0.24,0.25,0.25,0.22,0.19],10
  );
  const sdf=(x,y,z)=>{
    const d1=sdPolyline(x,y,z,upper.pts,upper.rs,0.14);
    const d2=sdPolyline(x,y,z,lower.pts,lower.rs,0.14);
    let body=smin(d1,d2,0.20);
    // Smooth architectural front/back slab chamfer (thickness ~0.46m) + flat ground base at y=0
    const slab=Math.abs(z)-0.23;
    body=smax(body,slab,0.11);
    body=smax(body,-y,0.06);
    return Math.max(body,x);
  };
  cachedHandGeo=buildSdfGeometry(sdf,[-2.62,-0.04,-0.32],[0.06,3.04,0.32],46,1.4);
  return cachedHandGeo;
}
function handHeart(group){
  // The two folded hands meet at the fingertips and thumbs; the heart stays open.
  const geoRight=handHeartHalfGeometry();
  for(const side of [1,-1]){
    let geo=geoRight;
    if(side<0){
      geo=geoRight.clone();
      const pos=geo.attributes.position,norm=geo.attributes.normal;
      for(let i=0;i<pos.count;i++){pos.setX(i,-pos.getX(i));norm.setX(i,-norm.getX(i));}
      const idx=geo.index.array;
      for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
      geo.computeBoundingBox();geo.computeBoundingSphere();
    }
    solid(group,geo,finish(side>0?0x213875:0xc42e25,.30,.42,'brushedMetal'),0,0,0);
  }
}

function wisdom(group){
  // Two face profiles, joined above the path. Source: the Baijieshan entrance.
  const profile=[[62,191],[79,173],[94,156],[108,144],[111,135],[103,132],[99,127],[102,122],[99,120],[94,120],[95,114],[84,112],[88,106],[99,100],[104,94],[102,89],[98,86],[101,79],[110,75],[114,69],[120,65],[126,68],[143,72],[151,69],[159,75],[168,76]];
  const mat=finish(0xaea99b,.39,.68);
  for(const side of [-1,1]){
    const path=profile.map(([u,v])=>[(u-168)*.030*side,(191-v)*.030]);
    for(let i=0;i<path.length-1;i++){
      const [x,y]=path[i],[u,v]=path[i+1];
      const bar=solid(group,prism,mat,(x+u)*.5,(y+v)*.5,0);
      bar.scale.set(Math.hypot(u-x,v-y)+.068,.19,.36);bar.rotation.z=Math.atan2(v-y,u-x);
    }
  }
}

function itArch(group){
  const gloss=finish(0xd5dcdb,.20,.80);
  const bodies=new Instances(new T.SphereGeometry(1,12,8),gloss,'我是IT人 · 抛光人物');
  const links=new Instances(post,gloss,'相接的手臂与腿部');
  const vec=(x,y,z)=>new T.Vector3(x,y,z);
  for(let i=0;i<19;i++){
    const a=(i+.5)/19*Math.PI;
    const mid=vec(-2.25*Math.cos(a),3.8*Math.sin(a),0),up=vec(2.25*Math.sin(a),3.8*Math.cos(a),0).normalize();
    const side=vec(-up.y,up.x,0),twist=Math.sin(i*1.73)*.14;
    const pt=(h,w=0,d=0)=>mid.clone().addScaledVector(up,h).addScaledVector(side,w).add(vec(0,0,d));
    const torso=pt(.015),head=pt(.215);
    const q=new T.Quaternion().setFromUnitVectors(vec(0,1,0),up);
    bodies.matrices.push(new T.Matrix4().compose(torso,q,vec(.086,.16,.067)));
    bodies.at(head.x,head.y,head.z,.073,.078,.066);
    for(const k of [-1,1]){
      const joint=(a,b,r)=>links.between(...a.toArray(),...b.toArray(),r);
      const arm=pt(.04,.14*k,twist),hand=pt(.28,.20*k,twist*.8);
      joint(pt(.12,.063*k),arm,.033);joint(arm,hand,.029);
      const knee=pt(-.19,.11*k,-twist),foot=pt(-.32,.095*k,-twist*.65);
      joint(pt(-.10,.051*k),knee,.042);joint(knee,foot,.032);
    }
  }
  bodies.flush(group,true);links.flush(group,true);
}

function quoteStone(group){
  const granite=finish(0xb3aca2,.91,.03);
  const body=solid(group,new RoundedBoxGeometry(6.91,1.57,.91,4,.12),granite,0,.83,0);
  const points=body.geometry.attributes.position;
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
    const rim=T.MathUtils.smoothstep(Math.max(Math.abs(x)/3.45,Math.abs(y)/.79),.74,1);
    const grain=Math.sin(x*15.0+z*3.2)*Math.sin(y*12.2+x*3.14);
    points.setXYZ(i,x+.032*grain*rim,y+.039*rim*Math.sin(x*9.8+z*9),z+.025*grain*rim);
  }
  body.geometry.computeVertexNormals();
  const c=document.createElement('canvas');c.width=1536;c.height=240;
  const ctx=c.getContext('2d');ctx.fillStyle='#b9b3a8';ctx.fillRect(0,0,c.width,c.height);
  const rng=random(7128);
  for(let i=0;i<33500;i++){ctx.fillStyle=rng()>.5?'rgba(64,56,60,.18)':'rgba(255,255,246,.26)';ctx.fillRect(rng()*1536,rng()*240,1+rng()*3,1.4);}
  ctx.strokeStyle='#736c62';ctx.lineWidth=4;ctx.strokeRect(2,2,1532,236);
  ctx.fillStyle='#633f38';ctx.font='94px KaiTi, STKaiti, serif';ctx.textBaseline='middle';ctx.textAlign='center';
  Array.from('創新驅動實質上是人才驅動').forEach((ch,j)=>ctx.fillText(ch,91+123*j,123));
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  solid(group,new T.PlaneGeometry(6.55,1.00),new T.MeshStandardMaterial({map:texture,roughness:.92}),0,.83,.483);
  const border=new Instances(new T.IcosahedronGeometry(1,1),finish(0xffffff,.95),'语录石前花带');
  const petals=[0xb6313c,0xa52c3b,0xc74b48,0x963c40,0x64723b].map(v=>new T.Color(v));
  for(let i=0;i<110;i++){const x=(rng()-.5)*8.4,z=.62+rng()*.62; border.at(x,.12+rng()*.09,z,.12+rng()*.08,.10+rng()*.08,.14,rng()*6,petals[i%5]);}
  border.flush(group);
}

function reefSquare(group){
  // The site's survey supplies a centre point. Outer extent is approximated up to the paths.
  const mat=finish(0xffffff,.9,.02);
  const mesh=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const bed=solid(group,new T.CircleGeometry(1,80).rotateX(-Math.PI/2),finish(0xa6a194,.94),0,.009,0);
  bed.scale.set(22,1,17);
  const pavers=new Instances(mesh,mat,'礁石广场 · 波纹砖阵');
  const rng=random(4768),cool=new T.Color(0x9b9995),warm=new T.Color(0xe4ded2);
  for(let row=-36;row<=36;row++){
    const z=row*.52;
    for(let col=-27;col<=27;col++){
      const x=(col+(row%2)*.5)*.92;
      if((x/22)**2+(z/17)**2>1)continue;
      const wave=.5+.5*Math.sin(z*.71+Math.sin(x*.15)*1.9+x*.10);
      pavers.at(x,.014,z,.91,1,.51,0,cool.clone().lerp(warm,.18+.58*wave+.19*rng()));
    }
  }
  pavers.flush(group);
}
const portraits=[
  ['牛憨笨','niu',.9],['袁庚','yuan',1],['爱因斯坦','einstein',1.2],['牛顿','newton',1.2],
  ['爱迪生，瓦特和达芬奇','inventors',1.8],['焦耳','joule',1.35],['两弹一星','space-scientists',2.0],['孔子','confucius',1.18],
  ['本地郎','locals',2.0],['外来妹','riders',2.6]
];
export function parkArtworks(root,map,grid){
  const all=new T.Group();all.name='公园与大运地标';root.add(all);
  function place(name,yaw=.12){
    const poi=map.pois.find(f=>f.name===name);if(!poi)return null;
    const g=new T.Group();g.name=name;g.position.set(poi.p[0],.245,poi.p[1]);g.rotation.y=yaw;all.add(g);return g;
  }
  function obstacle(g,x,z,halfW,halfD,height){
    g.updateMatrixWorld();
    const p=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([a,b])=>{const v=new T.Vector3(x+a*halfW,0,z+b*halfD).applyMatrix4(g.matrixWorld);return [v.x,v.z];});
    const bbox=bounds(p);grid.buildings.add({p,bbox,h:g.position.y+height},bbox);
  }
  const installations=[
    ['日晷',campusDial,0,[[0,0,2.4,2.4,1.5]]],
    ['蛇口自贸区拱门',tradeArch,-.335,[[-17.4,0,.85,.59,3.1],[17.4,0,.85,.59,3.1]]],
    ['第26届世界大学生夏季运动会主火炬塔',mainTorch,.05,[[0,0,1.82,1.55,26]]],
    ['我是深圳人雕塑',shenzhener,.33,[]],['红·蓝马甲',handHeart,.43,[[-1.6,0,.62,.36,2.1],[1.6,0,.62,.36,2.1]]],
    ['智慧之门',wisdom,.13,[[-2.55,0,.38,.21,2.7],[2.55,0,.38,.21,2.7]]],
    ['我是IT人',itArch,.2,[[-2.14,0,.19,.26,2.3],[2.14,0,.19,.26,2.3]]],
    ['总书记语录石',quoteStone,.43,[[0,0,3.38,.51,1.65]]],
    ['礁石广场',reefSquare,.33,[]]
  ];
  for(const [name,build,yaw,solids] of installations){
    const g=place(name,yaw);if(!g)continue;build(g);
    for(const box of solids)obstacle(g,...box);
    if(name==='我是深圳人雕塑'){
      g.scale.setScalar(.78);
      const pad=solid(g,new T.BoxGeometry(13.0,.075,3.6),finish(0xcec6b8,.92),0,-.024,0);pad.receiveShadow=true;
    }
    if(name==='我是深圳人雕塑')for(const x of [-4.6,-2.25,0,2.68,4.8])obstacle(g,x,0,.53,.17,2);
  }
  return Promise.all(portraits.map(async([name,file,r])=>{
    const g=place(name,.40);if(!g)return;
    if(name==='牛憨笨')solid(g,new T.BoxGeometry(2.2,.31,1.95),finish(0xb6b0a4,.89),0,.155,0);
    obstacle(g,0,0,r*.72,r*.55,2.2);
    await mountSculpture(g,file+'-h31',name==='牛憨笨'?.31:0);
  }));
}
