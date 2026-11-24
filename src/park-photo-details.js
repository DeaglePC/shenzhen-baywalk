import * as T from 'three';
import {Surface,Instances,inArea,random,segmentDistance} from './city-geometry.js';
import {photo} from './city-materials.js';
import {parkShrubs,shrubTurf} from './park-shrubs.js';

const TAU=Math.PI*2;

function makeTex(w,h,paint,repeat=false){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  paint(c.getContext('2d'),w,h);
  const t=new T.CanvasTexture(c);
  t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
  if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;
  return t;
}

// IMG_0168: "海德一道 Haide 1st Rd" dark Houhai directory & map totem outside NW entrance.
function haideTotemTex(){
  return makeTex(512,1024,(g,w,h)=>{
    g.fillStyle='#101820';g.fillRect(0,0,w,h);
    // Header bar
    g.fillStyle='#16222d';g.fillRect(16,18,w-32,108);
    g.fillStyle='#3ea2e8';g.beginPath();g.arc(62,62,14,0,TAU);g.fill();
    g.beginPath();g.arc(w-62,62,14,0,TAU);g.fill();
    g.fillStyle='#f3f7fb';g.textAlign='center';g.textBaseline='middle';
    g.font='bold 44px "Microsoft YaHei",sans-serif';g.fillText('海德一道',w/2,58);
    g.font='600 22px Arial,sans-serif';g.fillStyle='#b8cad9';g.fillText('Haide 1st Rd',w/2,100);
    // Directional bands (blue urban + green park) matching IMG_0168
    const rows=[
      ['#214b7a','深圳湾万象城','SHENZHEN BAY MIXC','50M'],
      ['#214b7a','深圳湾文化广场','SHENZHEN BAY CULTURE SQUARE','150M'],
      ['#367948','中心河','Zhongxin River','400M'],
      ['#367948','深圳人才公园','Shenzhen Talent Park','100M']
    ];
    rows.forEach(([bg,cn,en,dist],i)=>{
      const y=144+i*62;
      g.fillStyle=bg;g.fillRect(16,y,w-32,56);
      g.fillStyle='#ffffff';g.textAlign='left';
      g.font='bold 24px "Microsoft YaHei",sans-serif';g.fillText(cn,38,y+21);
      g.font='500 13px Arial,sans-serif';g.fillStyle='#d9ecff';g.fillText(en,38,y+43);
      g.textAlign='right';g.font='bold 22px Arial,sans-serif';g.fillStyle='#ffffff';g.fillText(dist,w-30,y+29);
    });
    // Stylized blue Houhai & Talent Park map panel
    const my=410,mh=430;
    g.fillStyle='#0d2238';g.fillRect(16,my,w-32,mh);
    // Talent Lake teal shape on right side of map
    g.fillStyle='#247d86';
    g.beginPath();g.ellipse(w*.70,my+mh*.56,88,125,-.18,0,TAU);g.fill();
    g.fillStyle='#1f6356';
    g.beginPath();g.ellipse(w*.71,my+mh*.55,112,155,-.18,0,TAU);g.strokeStyle='#39b29a';g.lineWidth=4;g.stroke();
    // Houhai street grid lines
    g.strokeStyle='#3b74a8';g.lineWidth=3;
    for(let x=48;x<w-180;x+=46){g.beginPath();g.moveTo(x,my+18);g.lineTo(x+14,my+mh-18);g.stroke();}
    for(let y=my+36;y<my+mh-20;y+=52){g.beginPath();g.moveTo(26,y);g.lineTo(w-120,y-12);g.stroke();}
    // You-are-here pin
    g.fillStyle='#ff6b4a';g.beginPath();g.arc(w*.52,my+mh*.42,10,0,TAU);g.fill();
    g.strokeStyle='#ffffff';g.lineWidth=3;g.stroke();
    // Bottom slogan band
    g.fillStyle='#111a24';g.fillRect(16,860,w-32,140);
    g.fillStyle='#d9e4ec';g.textAlign='center';
    g.font='600 22px "Microsoft YaHei",sans-serif';g.fillText('世界湾区  活力后海',w/2,916);
    g.font='500 18px Arial,sans-serif';g.fillStyle='#8ea7ba';g.fillText('Global Bay, Vibrant Houhai',w/2,956);
  });
}

// IMG_0168: Purple-magenta street pole banner.
function bannerTex(){
  return makeTex(256,512,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#5d2f7a');grad.addColorStop(.55,'#7f2763');grad.addColorStop(1,'#96244f');
    g.fillStyle=grad;g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=6;g.strokeRect(12,12,w-24,h-24);
    g.fillStyle='#f9edf5';g.textAlign='center';g.textBaseline='middle';
    g.font='bold 38px "Microsoft YaHei",sans-serif';
    const col1='建设亚太共同体',col2='促进共同繁荣';
    for(let i=0;i<col1.length;i++)g.fillText(col1[i],w*.64,95+i*46);
    for(let i=0;i<col2.length;i++)g.fillText(col2[i],w*.36,115+i*46);
    g.font='bold 18px Arial,sans-serif';g.fillStyle='#ffd2e6';
    g.fillText('SHENZHEN BAY',w/2,h-42);
  });
}

// IMG_0381: Orange-and-white smart beverage / park vending kiosk.
function kioskFrontTex(){
  return makeTex(512,512,(g,w,h)=>{
    g.fillStyle='#eb6b26';g.fillRect(0,0,w,h);
    g.fillStyle='#fff6ee';g.fillRect(0,0,w,92);
    g.fillStyle='#d94c1a';g.textAlign='center';g.textBaseline='middle';
    g.font='bold 38px "Microsoft YaHei",sans-serif';g.fillText('智慧驿站 · 饮品售卖',w/2,48);
    // Display glass window with beverage shelves
    g.fillStyle='#24313d';g.fillRect(36,116,300,270);
    g.fillStyle='#3c4f61';g.fillRect(46,126,280,250);
    const cols=['#e94b3c','#3898db','#f0b429','#48a868','#edf2f7','#f27a38'];
    for(let r=0;r<4;r++){
      g.fillStyle='#1f2a33';g.fillRect(46,178+r*60,280,7);
      for(let c=0;c<7;c++){
        g.fillStyle=cols[(r*3+c)%cols.length];
        g.fillRect(58+c*38,142+r*60,22,34);
      }
    }
    // Right touchscreen + pickup bay
    g.fillStyle='#16222c';g.fillRect(358,136,118,164);
    g.fillStyle='#3ca0e8';g.fillRect(368,148,98,96);
    g.fillStyle='#1a2026';g.fillRect(58,412,260,64);
  });
}

// IMG_0383 / IMG_0384: Light-grey cobblestone brick footpath texture.
function cobblePathMat(){
  const tex=makeTex(512,512,(g,w,h)=>{
    const rng=random(3837);
    g.fillStyle='#6c6e6a';g.fillRect(0,0,w,h);
    const bw=32,bh=16;
    for(let row=0;row<h/bh;row++){
      const shift=(row%2)*(bw/2);
      for(let col=-1;col<w/bw+1;col++){
        const v=166+Math.floor(rng()*34);
        g.fillStyle=`rgb(${v+2},${v},${v-4})`;
        g.fillRect(col*bw+shift+1.2,row*bh+1.2,bw-2.4,bh-2.4);
      }
    }
  },true);
  return new T.MeshStandardMaterial({map:tex,roughness:.92,side:T.DoubleSide});
}

// IMG_0383 & IMG_0384 foreground: Arching variegated green-white spider grass & copper sedge clump geometry.


// Flowering silk floss trees surveyed along the walking route in IMG_0373 and IMG_0360.
function registerSilkFlossTree(grid,x,z,scale=1,seed=373){
  grid.blossomTrees=grid.blossomTrees||[];
  const rng=random(seed);
  grid.blossomTrees.push([x,z,8.4*scale,rng()]);
}

export function parkPhotoDetails(root,map,m,grid,hooks={}){
  const group=new T.Group();group.name='人才公园 · 实拍分区精细景观';root.add(group);
  const disposables=[];
  const track=t=>{disposables.push(t);return t;};
  const addObstacle=hooks.addObstacle||(()=>{});
  const addPavedSeg=hooks.addPavedSeg||(()=>{});

  const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,12);
  const darkMetal=new T.MeshStandardMaterial({color:0x2e3539,roughness:.52,metalness:.46});
  const stainless=new T.MeshStandardMaterial({color:0xc9d0d4,roughness:.28,metalness:.78});
  const graniteMat=new T.MeshStandardMaterial({map:photo('pavers.webp'),color:0xd8d5cd,roughness:.88,side:T.DoubleSide});
  const concreteMat=new T.MeshStandardMaterial({color:0xb9b8b0,roughness:.92,side:T.DoubleSide});
  const whiteMat=new T.MeshStandardMaterial({color:0xedece6,roughness:.45});
  const hedgeMat=new T.MeshStandardMaterial({map:photo('flowerbed-hedge.webp'),color:0x5f7d3a,roughness:.96,side:T.DoubleSide});
  const bollardLampMat=m.parkLights.finish(new T.MeshStandardMaterial({color:0xfff1d4,emissive:0xffd494,roughness:.35}),2.4,.12);

  const darkBoxes=new Instances(box,darkMetal,'公园实拍 · 深灰金属构件');
  const darkCyls=new Instances(cyl,darkMetal,'公园实拍 · 智慧灯杆与立柱');
  const steelPipes=new Instances(cyl,stainless,'公园实拍 · 不锈钢扶手与护栏');
  const whiteParts=new Instances(new T.SphereGeometry(1,12,8),whiteMat,'公园实拍 · 球形监控探头');
  const bollardCaps=new Instances(cyl,bollardLampMat,'公园实拍 · 草坪灯发光玻璃罩');

  // =========================================================================
  // 1. 西北主入口海德一道导览柱、街灯紫红道旗与入口黑网格护栏 (IMG_0168, IMG_0171)
  // =========================================================================
  {
    const totemTex=track(haideTotemTex());
    const totem=new T.Group();totem.name='西北入口 · 海德一道智慧导览柱';
    totem.position.set(-274.2,.25,-299.6);totem.rotation.y=0.14;
    group.add(totem);
    const frame=new T.Mesh(new T.BoxGeometry(.84,2.35,.11),darkMetal);
    frame.position.y=1.18;frame.castShadow=true;totem.add(frame);
    const faceMat=new T.MeshStandardMaterial({map:totemTex,emissiveMap:totemTex,emissive:0xffffff,emissiveIntensity:.22,roughness:.4});
    for(const side of [-1,1]){
      const face=new T.Mesh(new T.PlaneGeometry(.76,1.88),faceMat);
      face.position.set(0,1.32,side*.058);if(side<0)face.rotation.y=Math.PI;totem.add(face);
    }
    addObstacle(-274.2,-299.6,.55);

    // Tall grey street poles with purple-magenta banners (IMG_0168)
    const bTex=track(bannerTex());
    const bMat=new T.MeshStandardMaterial({map:bTex,side:T.DoubleSide,roughness:.72});
    for(const [px,pz,yaw] of [[-271.2,-299.2,.18],[-256.5,-298.8,.12],[-241.0,-303.5,.28]]){
      darkCyls.at(px,3.4,pz,.09,6.6,.09);
      darkBoxes.at(px,3.1,pz,.34,.36,.24,yaw);
      for(const s of [-1,1]){
        const flag=new T.Mesh(new T.PlaneGeometry(.62,1.42),bMat);
        flag.position.set(px+Math.cos(yaw)*s*.48,4.65,pz-Math.sin(yaw)*s*.48);
        flag.rotation.y=yaw;group.add(flag);
      }
    }

    // Black welded-mesh guardrail + low clipped hedge curving along NW entrance (IMG_0171)
    const fencePts=[[-247,-308.5],[-241.5,-304.8],[-236.5,-300.5],[-231.5,-296.0],[-226.5,-291.2]];
    const fenceCurve=new T.CatmullRomCurve3(fencePts.map(([x,z])=>new T.Vector3(x,0,z)));
    const fLen=fenceCurve.getLength(),fSteps=Math.ceil(fLen/1.5);
    const hedgeSurf=new Surface();
    let prevH=null;
    for(let i=0;i<=fSteps;i++){
      const u=i/fSteps,p=fenceCurve.getPointAt(u),t=fenceCurve.getTangentAt(u);
      const l=Math.hypot(t.x,t.z)||1,dx=t.x/l,dz=t.z/l,nx=-dz,nz=dx;
      darkBoxes.at(p.x,.75,p.z,.035,1.02,.035);
      if(i<fSteps){
        const np=fenceCurve.getPointAt((i+1)/fSteps);
        const mx=(p.x+np.x)/2,mz=(p.z+np.z)/2,segL=Math.hypot(np.x-p.x,np.z-p.z);
        const ang=Math.atan2(np.x-p.x,np.z-p.z);
        darkBoxes.at(mx,1.24,mz,.04,.04,segL,ang);
        darkBoxes.at(mx,.36,mz,.035,.035,segL,ang);
        for(let k=1;k<=4;k++){
          const f=k/5;
          darkBoxes.at(p.x+(np.x-p.x)*f,.80,p.z+(np.z-p.z)*f,.016,.88,.016);
        }
      }
      // Clipped low hedge hugging the inside of the mesh fence
      const inner=[p.x+nx*.16,.25,p.z+nz*.16],outer=[p.x+nx*.86,.25,p.z+nz*.86];
      const topI=[inner[0],.86,inner[2]],topO=[outer[0],.86,outer[2]];
      if(prevH){
        hedgeSurf.quad(prevH.topI,topI,topO,prevH.topO,[[0,i-1],[0,i],[1,i],[1,i-1]]);
        hedgeSurf.quad(prevH.inner,inner,topI,prevH.topI,[[0,i-1],[0,i],[1,i],[1,i-1]]);
        hedgeSurf.quad(outer,prevH.outer,prevH.topO,topO,[[0,i-1],[0,i],[1,i],[1,i-1]]);
      }
      prevH={inner,outer,topI,topO};
    }
    hedgeSurf.mesh(group,hedgeMat,'西北入口 · 护栏内侧绿篱',true);
  }

  // =========================================================================
  // 2. 北岸功勋墙东侧 · 之字形无障碍不锈钢扶手坡道 (IMG_0204 at 20..42, -324..-302)
  // =========================================================================
  {
    const rampSurf=new Surface(),wallSurf=new Surface();
    // 3 switchback flights descending smoothly from upper terrace (y=1.18) down to lake path (y=0.28)
    const flights=[
      [[20.5,-322.5,1.18],[34.5,-319.0,.86]],
      [[34.5,-317.0,.86],[22.0,-313.6,.56]],
      [[22.0,-311.6,.56],[39.5,-306.8,.28]]
    ];
    const rw=1.75;
    for(const [a,b] of flights){
      const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1;
      const ux=dx/len,uz=dz/len,nx=-uz,nz=ux;
      const hw=rw/2;
      const p0=[a[0]-nx*hw,a[1],a[2]-nz*hw],p1=[a[0]+nx*hw,a[1],a[2]+nz*hw];
      const p2=[b[0]+nx*hw,b[1],b[2]+nz*hw],p3=[b[0]-nx*hw,b[1],b[2]-nz*hw];
      rampSurf.quad(p0,p3,p2,p1,[[0,0],[0,len/2.2],[rw/2.2,len/2.2],[rw/2.2,0]]);
      // Concrete side curbs
      wallSurf.quad([p0[0],.24,p0[2]],[p3[0],.24,p3[2]],p3,p0);
      wallSurf.quad(p1,p2,[p2[0],.24,p2[2]],[p1[0],.24,p1[2]]);
      addPavedSeg([a[0],a[2]],[b[0],b[2]],hw+.35);
      // Twin-rail stainless steel handrails on both sides (IMG_0204)
      const posts=Math.max(4,Math.ceil(len/1.45));
      for(const side of [-1,1]){
        const sx=nx*side*(hw-.07),sz=nz*side*(hw-.07);
        steelPipes.between(a[0]+sx,a[1]+.92,a[2]+sz,b[0]+sx,b[1]+.92,b[2]+sz,.024);
        steelPipes.between(a[0]+sx,a[1]+.62,a[2]+sz,b[0]+sx,b[1]+.62,b[2]+sz,.018);
        for(let k=0;k<=posts;k++){
          const f=k/posts,px=a[0]+dx*f+sx,py=a[1]+(b[1]-a[1])*f,pz=a[2]+dz*f+sz;
          steelPipes.between(px,py,pz,px,py+.92,pz,.019);
        }
      }
      // Lawn bollards along outer edge of ramp
      for(let k=1;k<4;k++){
        const f=k/4,bx=a[0]+dx*f-nx*(hw+.42),bz=a[2]+dz*f-nz*(hw+.42);
        darkCyls.at(bx,.52,bz,.062,.58,.062);
        bollardCaps.at(bx,.80,bz,.065,.10,.065);
        m.parkLights.fixture(bx,.84,bz,0xffd698,6,3.8);
      }
    }
    // Switchback landings & upper retaining wall (IMG_0204 upper-left)
    for(const [lx,lz,ly] of [[34.8,-318.0,.86],[21.7,-312.6,.56]]){
      rampSurf.quad([lx-1.3,ly,lz-1.6],[lx+1.3,ly,lz-1.6],[lx+1.3,ly,lz+1.6],[lx-1.3,ly,lz+1.6],[[0,0],[1,0],[1,1],[0,1]]);
    }
    wallSurf.quad([14,.25,-324.5],[36,.25,-322.2],[36,1.24,-322.2],[14,1.24,-324.5]);
    rampSurf.mesh(group,graniteMat,'北岸 · 无障碍之字形花岗石坡道',true);
    wallSurf.mesh(group,concreteMat,'北岸 · 坡道挡土墙与压顶',true);
  }

  // =========================================================================
  // 3. π桥东岸繁花海岸灌木带 & 西南岸盛放「美丽异木棉」林荫道 (IMG_0360, IMG_0373)
  // =========================================================================
  {
    const rng=random(3601);
    const turf=(x,z)=>shrubTurf(map,x,z);
    const shoreBushes=parkShrubs(root,'南岸亲水 · 沿岸灌木',turf);
    const flowering=parkShrubs(root,'π桥东岸 · 勒杜鹃花丛',turf,true);
    const lake=map.water.find(area=>area.name==='深圳湾内湖');
    // Lush flowering shrub berm along lake edge east of π bridge (IMG_0360 at 28..74, 351..362)
    for(let i=0;lake&&i<36;i++){
      const x=28+i/35*46+.34*Math.sin(i*1.91);
      const sx=.85+rng()*.55,sy=.55+rng()*.34,sz=.85+rng()*.55;
      // This bed follows the south bank, which bends north at its western
      // end. Use its mapped edge and keep the whole crown off the footways.
      const hits=[];
      for(let j=0;j<lake.p.length;j++){
        const a=lake.p[j],b=lake.p[(j+1)%lake.p.length];
        if((a[0]>x)!==(b[0]>x))hits.push(a[1]+(x-a[0])/(b[0]-a[0])*(b[1]-a[1]));
      }
      if(!hits.length)continue;
      const z=Math.max(...hits)+2.2+.45*Math.sin(i*.72)+rng()*.65;
      if(grid.roads.query(x,z).some(s=>segmentDistance(x,z,s.a,s.b)<s.width/2+Math.max(sx,sz)))continue;
      const height=sy*(.93+.20*Math.sin(i*.64));
      (rng()<.67?flowering:shoreBushes).at(x,.12+height*.61,z,sx,height,sz,rng()*TAU);
      if(i%4<2)shoreBushes.at(x+.34,.31,z-.61,sx*.72,height*.56,sz*.68,i*2.4);
    }
    // Southwest promenade low granite seating curb & lush border bushes (IMG_0373 at -318..-278, 384..395)
    const swCurb=new Surface();
    const swPts=[[-280,393.5],[-292,391.2],[-304,388.4],[-316,385.5]];
    const swCurve=new T.CatmullRomCurve3(swPts.map(([x,z])=>new T.Vector3(x,0,z)));
    const swLen=swCurve.getLength(),swN=Math.ceil(swLen/2.0);
    let prevSw=null;
    for(let i=0;i<=swN;i++){
      const u=i/swN,p=swCurve.getPointAt(u),t=swCurve.getTangentAt(u);
      const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l,nz=t.x/l;
      const a=[p.x+nx*2.6,.68,p.z+nz*2.6],b=[p.x+nx*3.18,.68,p.z+nz*3.18];
      if(prevSw){
        swCurb.quad(prevSw.a,a,b,prevSw.b,[[0,i-1],[0,i],[1,i],[1,i-1]]);
        swCurb.quad([prevSw.a[0],.24,prevSw.a[2]],[a[0],.24,a[2]],a,prevSw.a);
      }
      prevSw={a,b};
    }
    swCurb.mesh(group,concreteMat,'西南大道 · 花岗石条石坐凳矮墙',true);
    // Overlapping, lengthwise drifts on the outer sides of the curb and path.
    // Each bed has its own rhythm and tapers at both entrances.
    for(const [side,offset,phase] of [[1,4.25,.4],[-1,3.45,2.8]]){
      for(let s=1.35;s<swLen-1;){
        const u=s/swLen,p=swCurve.getPointAt(u),t=swCurve.getTangentAt(u);
        const end=Math.min(1,s/4,(swLen-s)/4),crest=.5+.5*Math.sin(s*.43+phase);
        const off=side*(offset+.24*Math.sin(s*.58+phase));
        const depth=.66+.19*crest,height=(.38+.36*crest+.12*rng())*(.62+.38*end);
        const reach=(1.15+.82*rng()+.36*crest)*(.64+.36*end);
        const yaw=Math.atan2(t.x,t.z)+(rng()-.5)*.22;
        for(const extra of [0,.6,1.2,1.8,2.4,3.0,3.6]){
          const x=p.x-t.z*(off+side*extra),z=p.z+t.x*(off+side*extra);
          const clear=[-1,0,1].every(k=>{
            const px=x+k*reach*Math.sin(yaw),pz=z+k*reach*Math.cos(yaw);
            return !hooks.onPromenade?.(px,pz,depth+.17)&&(!lake||!inArea(px,pz,lake))&&
              !grid.roads.query(px,pz).some(s=>s.y<1&&segmentDistance(px,pz,s.a,s.b)<s.width*.5+depth);
          });
          if(clear){shoreBushes.at(x,turf(x,z)+height*.46,z,depth,height,reach,yaw);break;}
        }
        s+=reach*(1.10+.32*rng());
      }
    }
    shoreBushes.flush(group,true);
    flowering.flush(group,true);

    // Blooming pink Shenzhen November Silk Floss Trees (美丽异木棉 — IMG_0373 & IMG_0360)
    registerSilkFlossTree(grid,39.5,355.2,.95,3602);
    registerSilkFlossTree(grid,-293.5,395.5,1.15,3731);
    registerSilkFlossTree(grid,-307.2,390.8,1.02,3732);
    registerSilkFlossTree(grid,-276.0,398.5,.92,3733);
    registerSilkFlossTree(grid,-478.0,262.0,.96,3779);
  }

  // =========================================================================
  // 4. 求贤阁南侧 · 蓝红阶梯花台艺术装置 & 野餐草坪氛围 (IMG_0377 at -472..-460, 248..264)
  // =========================================================================
  {
    const stepBase=new T.MeshStandardMaterial({color:0x1b4f9c,roughness:.55});
    const redFlowerMat=new T.MeshStandardMaterial({color:0xc92a22,roughness:.88});
    const install=new T.Group();install.name='求贤阁南侧 · 蓝红阶梯花台装置';
    install.position.set(-468.5,.25,254.5);install.rotation.y=0.45;
    group.add(install);
    for(let tier=0;tier<3;tier++){
      const w=6.8-tier*.8,d=1.65,h=.42+tier*.38;
      const base=new T.Mesh(new T.BoxGeometry(w,h,d),stepBase);
      base.position.set(0,h/2,-tier*1.35);base.castShadow=true;base.receiveShadow=true;install.add(base);
      const bed=new T.Mesh(new T.BoxGeometry(w-.24,.14,d-.24),redFlowerMat);
      bed.position.set(0,h+.04,-tier*1.35);install.add(bed);
    }
    addObstacle(-468.5,254.5,3.2);
  }

  // =========================================================================
  // 5. 西岸求贤阁 → 棕榈林大道 · 整齐绿篱、小砖曲径、花境草丛、智慧杆、贩卖亭与野餐垫
  //    (IMG_0381, IMG_0383, IMG_0384 at -498..-460, 118..226)
  // =========================================================================
  {
    // 5a. Continuous manicured boxwood hedge ribbon separating granite walkway & blue track (IMG_0381)
    const rWest=map.roads.find(r=>Number(r.id)===536079055);
    if(rWest){
      const pts=rWest.p.slice().reverse().filter(([,z])=>z>=112&&z<=224);
      if(pts.length>=3){
        const curve=new T.CatmullRomCurve3(pts.map(([x,z])=>new T.Vector3(x,0,z)));
        const len=curve.getLength(),steps=Math.ceil(len/1.6);
        const boxHedge=new Surface();
        let prev=null;
        for(let i=0;i<=steps;i++){
          const u=i/steps,s=u*len,p=curve.getPointAt(u),t=curve.getTangentAt(u);
          // Natural pedestrian crossing breaks every ~34m matching IMG_0381
          const gap=(s>24&&s<30)||(s>62&&s<68)||(s>98&&s<104);
          if(gap){prev=null;continue;}
          const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l,nz=t.x/l;
          // Sit cleanly on the lawn verge just outside the blue track (+nx points toward lake)
          const o0=2.35,o1=3.55,h=.82;
          const a=[p.x+nx*o0,.25,p.z+nz*o0],b=[p.x+nx*o1,.25,p.z+nz*o1];
          const ta=[a[0],.25+h,a[2]],tb=[b[0],.25+h,b[2]];
          if(prev){
            boxHedge.quad(prev.ta,ta,tb,prev.tb,[[0,i-1],[0,i],[1,i],[1,i-1]]);
            boxHedge.quad(prev.a,a,ta,prev.ta,[[0,i-1],[0,i],[1,i],[1,i-1]]);
            boxHedge.quad(b,prev.b,prev.tb,tb,[[0,i-1],[0,i],[1,i],[1,i-1]]);
          }
          prev={a,b,ta,tb};
        }
        boxHedge.mesh(group,hedgeMat,'西岸大道 · 修剪方正绿篱带',true);
      }
    }

    // 5b. Curved light-grey cobblestone brick footpath winding through Washingtonia palm grove (IMG_0383)
    const cobblePts=[
      [-468.5,171.8],[-473.5,174.0],[-479.8,176.8],[-486.2,179.4],[-493.0,182.0],[-499.5,184.5]
    ];
    const cobbleCurve=new T.CatmullRomCurve3(cobblePts.map(([x,z])=>new T.Vector3(x,0,z)));
    const cLen=cobbleCurve.getLength(),cSteps=Math.ceil(cLen/1.1);
    const cobbleSurf=new Surface(),cobbleEdging=new Surface();
    let prevC=null;
    for(let i=0;i<=cSteps;i++){
      const u=i/cSteps,p=cobbleCurve.getPointAt(u),t=cobbleCurve.getTangentAt(u);
      const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l,nz=t.x/l;
      const hw=1.08;
      const a=[p.x-nx*hw,.256,p.z-nz*hw],b=[p.x+nx*hw,.256,p.z+nz*hw];
      const ea=[p.x-nx*(hw+.10),.262,p.z-nz*(hw+.10)],eb=[p.x+nx*(hw+.10),.262,p.z+nz*(hw+.10)];
      if(prevC){
        cobbleSurf.quad(prevC.a,a,b,prevC.b,[[0,i-1],[0,i],[1,i],[1,i-1]]);
        cobbleEdging.quad(prevC.ea,ea,a,prevC.a);
        cobbleEdging.quad(prevC.b,b,eb,prevC.eb);
        addPavedSeg([prevC.x,prevC.z],[p.x,p.z],hw+.22);
      }
      prevC={a,b,ea,eb,x:p.x,z:p.z};
      // Black lawn bollards with glowing frosted caps along the brick footpath (IMG_0383)
      if(i===3||i===10||i===18||i===26){
        const side=i%2===0?1:-1;
        const bx=p.x+nx*side*(hw+.38),bz=p.z+nz*side*(hw+.38);
        darkCyls.at(bx,.54,bz,.068,.62,.068);
        bollardCaps.at(bx,.83,bz,.070,.11,.070);
        m.parkLights.fixture(bx,.88,bz,0xffd79b,7,4.2);
      }
    }
    cobbleSurf.mesh(group,cobblePathMat(),'西岸棕榈林 · 浅灰小块砖曲径');
    cobbleEdging.mesh(group,concreteMat,'西岸棕榈林 · 曲径石材收边');

    // 5c. Multi-layered variegated spider grass, copper sedge & violet flowerbeds flanking brick path (IMG_0383, IMG_0384)
    const turf=(x,z)=>shrubTurf(map,x,z);
    const varGrass=parkShrubs(root,'棕榈林花境 · 银边吊兰',turf,'silver');
    const copGrass=parkShrubs(root,'棕榈林花境 · 铜红狼尾草',turf,'copper');
    const violets=parkShrubs(root,'棕榈林花境 · 紫花翠芦莉',turf,'violet');
    const cushionShrub=parkShrubs(root,'棕榈林花境 · 常绿灌木',turf);
    const nearPath=(x,z,r)=>hooks.onPromenade?.(x,z,r)||
      grid.roads.query(x,z).some(s=>s.y<1&&segmentDistance(x,z,s.a,s.b)<s.width*.5+r);
    const gRng=random(3836);
    // Left foreground variegated spider-grass bed (IMG_0383 bottom-left)
    for(let i=0;i<24;i++){
      const x=-474.5-gRng()*8.5;
      let z=176.2+gRng()*4.2;
      const sc=.85+gRng()*.55;
      const h=sc*(.45+gRng()*.15),yaw=gRng()*TAU;
      for(let n=0;n<5&&nearPath(x,z,sc);n++)z+=.62;
      if(nearPath(x,z,sc))continue;
      varGrass.at(x,turf(x,z),z,sc,h,sc,yaw);
      if(i%3===0)violets.at(x,turf(x,z),z,.32,.43,.29,gRng()*TAU);
    }
    // Right-center copper-bronze sedge + rounded green cushions (IMG_0383 mid-right)
    for(let i=0;i<18;i++){
      const x=-477.5-gRng()*7.0;
      let z=170.0-gRng()*4.6;
      const sc=.82+gRng()*.52;
      const h=sc*(.48+gRng()*.15),yaw=gRng()*TAU;
      for(let n=0;n<5&&nearPath(x,z,sc);n++)z-=.62;
      if(!nearPath(x,z,sc))copGrass.at(x,turf(x,z),z,sc,h,sc,yaw);
    }
    for(const [cx,cz,rx,ry] of [
      [-474.8,169.5,1.25,.52],[-476.8,166.4,1.45,.56],[-482.0,168.0,1.35,.54],
      [-486.0,174.5,1.15,.48],[-481.2,179.8,1.30,.52],[-475.5,180.5,1.15,.48]
    ]){
      if(!nearPath(cx,cz,rx*.86))cushionShrub.at(cx,.24+ry*.65,cz,rx,ry,rx*.85,gRng()*TAU);
    }
    for(const b of [varGrass,copGrass,violets,cushionShrub])b.flush(group,false);

    // 5d. Tall dark-grey Smart Park Poles with dome CCTV camera & black PA speaker box (IMG_0383, IMG_0377)
    const smartPoles=[
      [-478.2,173.4,.35],[-488.5,176.8,.42],[-483.0,164.2,-.20],
      [-472.5,244.5,.15],[-464.0,152.0,.10],[38.0,352.5,-.40]
    ];
    for(const [sx,sz,yaw] of smartPoles){
      const dx=Math.sin(yaw),dz=Math.cos(yaw);
      darkCyls.at(sx,2.95,sz,.075,5.6,.075);
      // Horizontal camera arm + white CCTV dome
      darkBoxes.at(sx+dx*.42,4.72,sz+dz*.42,.06,.06,.92,yaw);
      whiteParts.at(sx+dx*.82,4.55,sz+dz*.82,.14,.16,.14);
      // Black rectangular PA speaker mounted mid-pole
      darkBoxes.at(sx-dx*.22,3.15,sz-dz*.22,.28,.44,.22,yaw);
      // Angled top LED flood hood
      darkBoxes.at(sx+dx*.16,5.68,sz+dz*.16,.38,.12,.48,yaw);
      m.parkLights.fixture(sx+dx*.22,5.55,sz+dz*.22,0xffe4b8,24,10.5);
    }

    // 5e. Orange-and-white smart beverage vending kiosk along west promenade (IMG_0381 left)
    const kTex=track(kioskFrontTex());
    const kiosk=new T.Group();kiosk.name='西岸大道 · 橙白智慧饮品售货亭';
    kiosk.position.set(-468.2,.25,148.5);kiosk.rotation.y=Math.PI*.48;
    group.add(kiosk);
    const kBody=new T.Mesh(new T.BoxGeometry(2.4,2.25,1.08),new T.MeshStandardMaterial({color:0xeb6b26,roughness:.52}));
    kBody.position.y=1.12;kBody.castShadow=true;kBody.receiveShadow=true;kiosk.add(kBody);
    const kFront=new T.Mesh(new T.PlaneGeometry(2.26,2.10),new T.MeshStandardMaterial({map:kTex,emissiveMap:kTex,emissive:0xffffff,emissiveIntensity:.18,roughness:.42}));
    kFront.position.set(0,1.12,.545);kiosk.add(kFront);
    addObstacle(-468.2,148.5,1.5);

    // 5f. Relaxing picnic blankets scattered on sunny Talent Park lawns (IMG_0383 right, IMG_0377 left, IMG_0221)
    const blanketGeo=new T.PlaneGeometry(2.1,1.75);blanketGeo.rotateX(-Math.PI/2);
    const blanketMat=new T.MeshStandardMaterial({roughness:.94,side:T.DoubleSide});
    const blankets=new Instances(blanketGeo,blanketMat,'人才公园 · 草坪野餐垫');
    const bColors=[new T.Color('#d8b48a'),new T.Color('#8bb4c9'),new T.Color('#d98d82'),new T.Color('#e5d7b4'),new T.Color('#97b88c')];
    const picnicSites=[
      [-472.5,163.5,.4],[-478.0,160.2,1.1],[-484.5,166.8,-.3],
      [-466.5,244.0,.8],[-463.8,248.5,1.5]
    ];
    picnicSites.forEach(([px,pz,rot],idx)=>{
      blankets.at(px,.27,pz,1,1,1,rot,bColors[idx%bColors.length]);
    });
    blankets.flush(group,false,320);
    const lawn=grid.flowerLandscape?.lawnMesh;
    if(lawn){
      const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
      for(const [x,z,yaw,color] of [[162,-210,.6,0xa99779],[167,-205,-.4,0x819cab]]){
        const cloth=new T.PlaneGeometry(2.1,1.75,4,4).rotateX(-Math.PI/2).rotateY(yaw).translate(x,0,z);
        const v=cloth.attributes.position;
        for(let i=0;i<v.count;i++){
          ray.ray.origin.set(v.getX(i),8,v.getZ(i));
          const [hit]=ray.intersectObject(lawn,false);
          v.setY(i,(hit?.point.y??0)+.012);
        }
        cloth.computeVertexNormals();
        const mat=blanketMat.clone();mat.color.setHex(color);
        const rug=new T.Mesh(cloth,mat);rug.name='花坛 · 临湖草坪野餐垫';rug.receiveShadow=true;group.add(rug);
      }
    }
  }

  // =========================================================================
  // 6. 全园统一配套：蓝灰分类垃圾驿站 & 环湖蓝色圆形方向标识 (IMG_0233, IMG_0381)
  // =========================================================================
  {
    const binBlue=new T.MeshStandardMaterial({color:0x2b6ca8,roughness:.54,metalness:.25});
    const bins=new Instances(box,binBlue,'人才公园 · 蓝色分类垃圾箱');
    const binSites=[
      [252.5,-75.5,.35],[48.5,-321.5,1.4],[46.2,355.0,-.2],[-475.5,216.0,1.5],[-467.2,162.0,1.5]
    ];
    for(const [bx,bz,yaw] of binSites){
      bins.at(bx,.76,bz,1.18,1.02,.52,yaw);
      darkBoxes.at(bx,1.30,bz,1.24,.09,.58,yaw);
      addObstacle(bx,bz,.75);
    }
    bins.flush(group,true,420);

    // Blue circular jogging-track sign discs on slender dark posts (IMG_0381 along blue track)
    const signDisc=new Instances(new T.CylinderGeometry(.22,.22,.035,16).rotateX(Math.PI/2),binBlue,'环湖跑道 · 蓝色圆形里程标识牌');
    const trackSigns=[
      [-463.5,155.0,.15],[-465.2,195.0,.12],[52.0,-320.5,1.4],[175.0,-212.0,-.5],[34.0,358.0,-.2],[-290.0,390.5,.3]
    ];
    for(const [tx,tz,yaw] of trackSigns){
      darkCyls.at(tx,1.25,tz,.032,2.05,.032);
      signDisc.at(tx,2.22,tz,1,1,1,yaw);
    }
    signDisc.flush(group,true,360);
  }

  for(const inst of [darkBoxes,darkCyls,steelPipes,whiteParts,bollardCaps]){
    inst.flush(group,inst!==bollardCaps&&inst!==whiteParts,520);
  }
  return {
    dispose(){disposables.forEach(t=>t.dispose());}
  };
}
