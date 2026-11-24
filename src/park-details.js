import * as T from 'three';
import {Surface,Instances,Grid,bounds,inArea,random,clamp,segmentDistance} from './city-geometry.js';
import {mountSculpture} from './park-sculpture.js';
import {parkLetters} from './park-lettering.js';
import {photo} from './city-materials.js';
import {parkPhotoDetails} from './park-photo-details.js';

function makeCanvasTex(w,h,paint){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  paint(c.getContext('2d'),w,h);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}

function linearStoneMat(){
  const t=makeCanvasTex(512,512,(g,w,h)=>{
    const rng=random(38101);
    g.fillStyle='#727679';g.fillRect(0,0,w,h);
    const cols=16,cw=w/cols,shades=['#9fa3a6','#93979a','#adb0b1','#898e92','#a5a8aa'];
    for(let c=0;c<cols;c++){
      let y=-(rng()*60);
      while(y<h){
        const bh=58+Math.floor(rng()*62);
        g.fillStyle=shades[Math.floor(rng()*shades.length)];
        g.fillRect(c*cw+1,y+1,cw-2,bh-2);
        y+=bh;
      }
    }
  });
  t.wrapS=t.wrapT=T.RepeatWrapping;
  return new T.MeshStandardMaterial({map:t,roughness:.9,side:T.DoubleSide});
}

function cortenTitleTex(baseImg){
  return makeCanvasTex(1536,384,(g,w,h)=>{
    g.fillStyle='#9f7967';g.fillRect(0,0,w,h);
    if(baseImg)g.drawImage(baseImg,0,0,w,h);
    // Subtle weathering grain matching IMG_0178
    const rng=random(1781);
    for(let i=0;i<14000;i++){
      g.fillStyle=rng()<.5?'rgba(62,38,28,0.06)':'rgba(195,152,130,0.05)';
      g.fillRect(rng()*w,rng()*h,2,2);
    }
    // Triple parallel ~60° angled recessed slits flanking "深圳人才公园" (IMG_0178)
    g.strokeStyle='#352118';g.lineWidth=8;
    for(const x of [175,208,241,1235,1268,1301]){
      g.beginPath();g.moveTo(x+90,0);g.lineTo(x-90,h);g.stroke();
    }
    // Cut-out recessed lettering "深圳人才公园" with depth shadow (IMG_0178)
    g.textAlign='center';g.textBaseline='middle';
    g.font='900 126px "Microsoft YaHei",sans-serif';
    g.fillStyle='#241610';g.fillText('深 圳 人 才 公 园',w*.49,h*.50);
    g.fillStyle='#4a3024';g.fillText('深 圳 人 才 公 园',w*.49+3,h*.50+3);
  });
}

function mathPillarTex(){
  const t=makeCanvasTex(1024,1024,(g,w,h)=>{
    g.fillStyle='#4a4e52';g.fillRect(0,0,w,h);
    const rng=random(3729);
    for(let i=0;i<16000;i++){
      const v=64+Math.floor(rng()*28);
      g.fillStyle=`rgba(${v},${v+2},${v+4},0.22)`;
      g.fillRect(rng()*w,rng()*h,2,2);
    }
    g.fillStyle='#14171a';
    g.textAlign='center';g.textBaseline='middle';
    const colX=[170,512,854];
    const topSet=[
      '1 × 8 + 1 = 9',
      '12 × 8 + 2 = 98',
      '123 × 8 + 3 = 987',
      '1234 × 8 + 4 = 9876',
      '12345 × 8 + 5 = 98765',
      '123456 × 8 + 6 = 987654',
      '1234567 × 8 + 7 = 9876543',
      '12345678 × 8 + 8 = 98765432',
      '123456789 × 8 + 9 = 987654321'
    ];
    const botLeft=[
      '1 × 9 + 2 = 11',
      '12 × 9 + 3 = 111',
      '123 × 9 + 4 = 1111',
      '1234 × 9 + 5 = 11111',
      '12345 × 9 + 6 = 111111',
      '123456 × 9 + 7 = 1111111',
      '1234567 × 9 + 8 = 11111111',
      '12345678 × 9 + 9 = 111111111'
    ];
    const botRight=[
      '1 × 1 = 1',
      '11 × 11 = 121',
      '111 × 111 = 12321',
      '1111 × 1111 = 1234321',
      '11111 × 11111 = 123454321',
      '111111 × 111111 = 12345654321'
    ];
    for(const cx of colX){
      g.font='bold 40px "Microsoft YaHei",sans-serif';
      g.fillText('数学之美',cx,88);
      g.fillText('数学之美',cx,965);
      g.font='600 22px Arial,sans-serif';
      topSet.forEach((line,i)=>g.fillText(line,cx,162+i*42));
      g.font='600 15px Arial,sans-serif';
      botLeft.forEach((line,i)=>g.fillText(line,cx-82,585+i*36));
      botRight.forEach((line,i)=>g.fillText(line,cx+84,585+i*36));
    }
  });
  t.wrapS=T.RepeatWrapping;
  return t;
}

function birdLeafTex(color,title){
  return makeCanvasTex(256,256,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    g.fillStyle=color;
    g.beginPath();g.ellipse(128,128,112,86,-.3,0,Math.PI*2);g.fill();
    g.strokeStyle='#eef4f5';g.lineWidth=6;g.stroke();
    g.fillStyle='#ffffff';g.beginPath();g.arc(128,118,52,0,Math.PI*2);g.fill();
    g.fillStyle='#4a6d52';g.beginPath();g.ellipse(128,126,34,18,0,0,Math.PI*2);g.fill();
    g.fillStyle='#1f2e32';g.textAlign='center';g.font='bold 22px "Microsoft YaHei",sans-serif';
    g.fillText(title,128,202);
  });
}

function addBentLamp(poles,diffusers,bases,lights,x,z,tx,tz,outX,outZ){
  const p=(w,y,out)=>[x+tx*w+outX*out,y,z+tz*w+outZ*out];
  const ring=(y,out,th,wd)=>[
    p(-wd,y,out-th),p(wd,y,out-th),p(wd,y,out+th),p(-wd,y,out+th)
  ];
  const sec=[ring(.15,0,.105,.09),ring(3.55,.06,.078,.072),ring(3.74,.11,.076,.072),ring(4.85,1.38,.082,.070)];
  for(let i=1;i<sec.length;i++)for(let k=0;k<4;k++){
    const j=(k+1)%4;
    poles.quad(sec[i-1][k],sec[i-1][j],sec[i][j],sec[i][k]);
  }
  poles.quad(...sec.at(-1));
  diffusers.quad(p(-.046,3.84,.30),p(.046,3.84,.30),p(.046,4.76,1.35),p(-.046,4.76,1.35));
  bases.quad(p(-.045,.36,.11),p(.045,.36,.11),p(.045,.66,.11),p(-.045,.66,.11));
  const l=p(0,4.30,.82);
  lights.fixture(l[0],l[1],l[2],0xffe4be,48,14);
}

export function parkDetails(root,map,m,grid){
  const group=new T.Group();group.name='人才公园 · 实景细节与主题雕塑';root.add(group);
  let sculptureReady;
  const obstacles=new Grid(16),pavedSegs=new Grid(24),pavedAreas=[],disposables=[];
  const trackTex=t=>{disposables.push(t);return t;};
  const addObstacle=(x,z,r)=>{
    const p=[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];
    obstacles.add({p,bbox:bounds(p)},bounds(p));
  };
  const addBoxObstacle=(p)=>obstacles.add({p,bbox:bounds(p)},bounds(p));
  const addPavedArea=(p)=>pavedAreas.push({p,bbox:bounds(p)});
  const addPavedSeg=(a,b,halfW)=>{
    const pad=halfW+2;
    pavedSegs.add({a,b,halfW},[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]);
  };

  const darkMat=new T.MeshStandardMaterial({color:0x363d42,metalness:.48,roughness:.46,side:T.DoubleSide});
  const silverMat=new T.MeshStandardMaterial({color:0xb8c0c4,metalness:.62,roughness:.32,side:T.DoubleSide});
  const whiteMat=new T.MeshStandardMaterial({color:0xf0f0ec,roughness:.45,side:T.DoubleSide});
  const cortenMat=new T.MeshStandardMaterial({color:0x765140,roughness:.84,metalness:.22,side:T.DoubleSide});
  const darkWood=new T.MeshStandardMaterial({map:photo('bridge-deck-color.webp'),color:0x4e3528,roughness:.70,side:T.DoubleSide});
  const blueTrackMat=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x3b84be,roughness:.88,side:T.DoubleSide});
  const stoneMat=linearStoneMat();trackTex(stoneMat.map);
  const ledMat=m.parkLights.finish(new T.MeshStandardMaterial({color:0xffe9c2,emissive:0xffd89c}),2.3,.06);

  const cyl=new T.CylinderGeometry(1,1,1,12),box=new T.BoxGeometry(1,1,1);
  const bollards=new Instances(cyl,darkMat,'园路 · 黑色圆柱草坪灯');
  const bollardCaps=new Instances(cyl,ledMat,'园路 · 草坪灯发光环');
  const leafPosts=new Instances(cyl,darkMat,'园路 · 叶形导览牌立杆');

  // =========================================================================
  // 1. 西北主入口“深圳人才公园 SHENZHEN TALENT PARK”立体雕塑标志 (IMG_0171)
  // =========================================================================
  {
    const signGroup=new T.Group();signGroup.name='西北入口 · 深圳人才公园立体主标识';
    signGroup.position.set(-232.2,0.25,-304.5);
    signGroup.rotation.y=-2.28; // Faces NW straight toward the Keyuan South / Haide 1st entrance (IMG_0171)
    group.add(signGroup);
    const legs=new Instances(cyl,silverMat,'主标识 · 枝杈形钢立柱');
    legs.between(-1.8,0,0,-3.1,2.55,0,.11);
    legs.between(-1.8,0,0,-0.4,2.55,0,.10);
    legs.between(1.8,0,0,0.6,2.55,0,.10);
    legs.between(1.8,0,0,3.1,2.55,0,.11);
    legs.between(-1.8,0,0,-1.8,2.55,0,.12);
    legs.between(1.8,0,0,1.8,2.55,0,.12);
    legs.flush(signGroup,true);
    const cap=new T.MeshStandardMaterial({color:0xe6e5dc,roughness:.31,metalness:.42});
    const edge=new T.MeshStandardMaterial({color:0x535755,roughness:.41,metalness:.7});
    parkLetters(signGroup,'深圳人才公园',8.1,.19,cap,edge,0,3.06,0);
    parkLetters(signGroup,'SHENZHEN TALENT PARK',7.5,.11,cap,edge,0,2.47,.02);
    for(const y of [2.59,3.39]){
      const beam=new T.Mesh(new T.BoxGeometry(8,.075,.095),edge);
      beam.position.set(0,y,-.07);signGroup.add(beam);
    }
    m.parkLights.fixture(-235.0,2.5,-304.2,0xffe4be,30,12);
    addObstacle(-235.0,-304.2,1.6);
  }

  // =========================================================================
  // 2. 西入口耐候钢“人才”文化墙 + 紫色鼠尾草花池 + 红色消防栓与花境背景
  //    (1:1 photo-faithful restoration from IMG_0172, IMG_0175, IMG_0176, IMG_0177, IMG_0178)
  // =========================================================================
  {
    const wallGroup=new T.Group();wallGroup.name='西入口 · 耐候钢人才文化墙';group.add(wallGroup);
    const tex0172=photo('talent-wall-0172.webp');
    const tex0175=photo('talent-wall-0175.webp');
    const tex0176=photo('talent-wall-0176.webp');
    const texRen=photo('talent-wall-0177-ren.webp');
    const texCai=photo('talent-wall-0177-cai.webp');
    const texTitle=trackTex(cortenTitleTex(null));
    const cortenSteel=new T.MeshStandardMaterial({color:0x7e5d4d,roughness:.80,metalness:.16,side:T.DoubleSide});
    const cortenJoint=new T.MeshStandardMaterial({color:0x36231a,roughness:.90,metalness:.14,side:T.DoubleSide});

    // Follow the real west edge of NW promenade road 537568298 going NORTH -> SOUTH!
    const wallSpine=new T.CatmullRomCurve3([
      new T.Vector3(-240.3,0,-298.0),
      new T.Vector3(-244.4,0,-291.8),
      new T.Vector3(-247.8,0,-285.8),
      new T.Vector3(-251.2,0,-278.5),
      new T.Vector3(-253.8,0,-270.0),
      new T.Vector3(-256.4,0,-259.2),
      new T.Vector3(-259.2,0,-247.5),
      new T.Vector3(-262.4,0,-234.5)
    ],false,'centripetal',.4);
    const totalLen=wallSpine.getLength();
    const atDist=s=>{
      const u=clamp(s/totalLen,0,1),pt=wallSpine.getPointAt(u),tg=wallSpine.getTangentAt(u);
      const l=Math.hypot(tg.x,tg.z)||1;
      return {x:pt.x,z:pt.z,dx:tg.x/l,dz:tg.z/l,nx:-tg.z/l,nz:tg.x/l};
    };

    // 6 true-proportion slabs from North (NW entrance, IMG_0172) to South (IMG_0178).
    // Facing the wall from the park (looking West): RIGHT = North (s0), LEFT = South (s1).
    // For parallel 60° interior seams: Slab N's top-left is at s1 - slant and bottom-left is at s1;
    // Slab N+1's top-right starts at s0 = s1 - slant + 0.10 (bottom-right at s1 + 0.10) -> EXACT uniform 10cm diagonal shadow groove!
    const wallH=1.56,wallY0=.25,wallT=.36,slant=.76;
    const slabs=[
      // Group A: Multilingual Talent Wall (IMG_0172 -> IMG_0175 -> IMG_0176)
      {s0:0.4,  s1:6.2,  tex:tex0172, lStyle:'slash', rStyle:'bevel', u0:.145, u1:1.0,  joint:true,  hydrant:true}, // IMG_0172 hero panel
      {s0:5.54, s1:12.1, tex:tex0175, lStyle:'slash', rStyle:'slash', u0:0.0,  u1:.84,  joint:true},                // IMG_0175 Thai/Greek/Romanian/Ukrainian
      {s0:11.44,s1:18.8, tex:tex0176, lStyle:'bevel', rStyle:'slash', u0:0.0,  u1:1.0,  joint:false},               // IMG_0175/0176 UN dictionaries
      // Group B: "人" & "才" Evolution Wall (IMG_0177)
      {s0:20.0, s1:27.6, tex:texRen,  lStyle:'slash', rStyle:'bevel', u0:0.0,  u1:1.0,  joint:true},                // IMG_0177 "人" evolution + 7 medallions
      {s0:26.94,s1:34.6, tex:texCai,  lStyle:'bevel', rStyle:'slash', u0:0.0,  u1:1.0,  joint:false},               // IMG_0177 "才" evolution + 7 medallions
      // Group C: "深圳人才公园" Title Wall (IMG_0178)
      {s0:35.8, s1:46.2, tex:texTitle,lStyle:'bevel', rStyle:'bevel', u0:0.0,  u1:1.0,  joint:false}                // IMG_0178 Title monolith
    ];

    const planterSurf=new Surface(),soilSurf=new Surface(),foliageSurf=new Surface(),salviaSurf=new Surface(),apronSurf=new Surface();
    const backHedge=new Instances(new T.IcosahedronGeometry(1,2),new T.MeshStandardMaterial({map:photo('flowerbed-hedge.webp'),color:0x76924e,roughness:.96}),'文化墙 · 墙后自然绿篱灌木');
    const backBloomSurf=new Surface(),backPurpleSurf=new Surface();
    const rng=random(1772);

    for(const slab of slabs){
      const A=atDist(slab.s0),B=atDist(slab.s1);
      // Local frame: origin at South (B), +u runs South -> North (B -> A) so u=0 is LEFT, u=len is RIGHT!
      const dx=A.x-B.x,dz=A.z-B.z,len=Math.hypot(dx,dz);
      const ux=dx/len,uz=dz/len;
      const nx=-uz,nz=ux; // Park-facing East normal
      const halfT=wallT*.5;
      const pt=(u,y,n)=>[B.x+ux*u+nx*n,y,B.z+uz*u+nz*n];

      const uBL=0;
      const uTL=slant;
      const uBR=slab.rStyle==='slash'?len-slant:len;
      const uTR=slab.rStyle==='slash'?len:len-slant;

      const mapU=u=>slab.u0+(slab.u1-slab.u0)*(u/len);
      const faceSurf=new Surface(),sideSurf=new Surface();
      const fBL=pt(uBL,wallY0,halfT),fBR=pt(uBR,wallY0,halfT),fTR=pt(uTR,wallY0+wallH,halfT),fTL=pt(uTL,wallY0+wallH,halfT);
      const bBL=pt(uBL,wallY0,-halfT),bBR=pt(uBR,wallY0,-halfT),bTR=pt(uTR,wallY0+wallH,-halfT),bTL=pt(uTL,wallY0+wallH,-halfT);
      faceSurf.quad(fBL,fBR,fTR,fTL,[[mapU(uBL),0],[mapU(uBR),0],[mapU(uTR),1],[mapU(uTL),1]]);
      faceSurf.quad(bBR,bBL,bTL,bTR,[[mapU(uBL),0],[mapU(uBR),0],[mapU(uTR),1],[mapU(uTL),1]]);
      sideSurf.quad(fTL,fTR,bTR,bTL);
      sideSurf.quad(bBL,fBL,fTL,bTL);
      sideSurf.quad(fBR,bBR,bTR,fTR);

      const faceMat=new T.MeshStandardMaterial({
        map:slab.tex,roughness:.76,metalness:.14,
        emissive:0x36241c,emissiveIntensity:.16,side:T.DoubleSide
      });
      faceSurf.mesh(wallGroup,faceMat,'文化墙 · 耐候钢雕刻立面',true);
      sideSurf.mesh(wallGroup,cortenSteel,'文化墙 · 耐候钢斜切边板',true);

      // Recessed dark-Corten 3D diagonal shadow groove channel inside parallel 10cm interior seam (IMG_0172!)
      if(slab.joint){
        const jSurf=new Surface();
        const jW=.16,jN=halfT-.11;
        jSurf.quad(pt(uBL-jW,wallY0,jN),pt(uBL+.04,wallY0,jN),pt(uTL+.04,wallY0+wallH-.02,jN),pt(uTL-jW,wallY0+wallH-.02,jN));
        jSurf.mesh(wallGroup,cortenJoint,'文化墙 · 斜切凹槽阴影缝');
      }

      // Authentic red cast-iron fire hydrant peeking right above the diagonal seam of IMG_0172!
      if(slab.hydrant){
        const hPos=pt(uTL+.65,wallY0,-1.05);
        const hyd=new T.Group();hyd.name='文化墙后 · 红色室外消火栓';
        hyd.position.set(hPos[0],hPos[1],hPos[2]);
        const redIron=new T.MeshStandardMaterial({color:0x8c2d2a,roughness:.56,metalness:.34});
        const body=new T.Mesh(new T.CylinderGeometry(.11,.13,1.98,14),redIron);body.position.y=.99;body.castShadow=true;hyd.add(body);
        const cap=new T.Mesh(new T.SphereGeometry(.125,12,8),redIron);cap.position.y=2.00;hyd.add(cap);
        const flange=new T.Mesh(new T.CylinderGeometry(.155,.155,.065,14),redIron);flange.position.y=1.74;hyd.add(flange);
        const nozzle=new T.Mesh(new T.CylinderGeometry(.06,.06,.34,10),redIron);nozzle.rotation.z=Math.PI/2;nozzle.position.y=1.84;hyd.add(nozzle);
        const frontNoz=new T.Mesh(new T.CylinderGeometry(.07,.07,.20,10),redIron);frontNoz.rotation.x=Math.PI/2;frontNoz.position.set(0,1.82,.10);hyd.add(frontNoz);
        wallGroup.add(hyd);
      }

      // Clean wide light-grey granite walkway right in front of the Corten wall
      const w0=pt(-.25,.254,halfT+.52),w1=pt(len+.25,.254,halfT+.52);
      const w2=pt(len+.25,.254,halfT+4.2),w3=pt(-.25,.254,halfT+4.2);
      apronSurf.quad(w0,w1,w2,w3,[[0,0],[0,len/2.4],[1.6,len/2.4],[1.6,0]]);
      addPavedArea([[w0[0],w0[2]],[w1[0],w1[2]],[w2[0],w2[2]],[w3[0],w3[2]]]);

      // Low dark-Corten planter trough flush along the base (h=0.19m so bottom row of text is 100% readable like IMG_0172!)
      const pw=.46,ph=.19,y0=wallY0;
      const pStart=slab.joint?-.12:0,pEnd=slab.rStyle==='slash'?uBR+.04:len;
      const pA=pt(pStart,y0,halfT),pB=pt(pEnd,y0,halfT),pC=pt(pEnd,y0,halfT+pw),pD=pt(pStart,y0,halfT+pw);
      const up=(v,dy)=>[v[0],v[1]+dy,v[2]];
      planterSurf.quad(pD,up(pD,ph),up(pC,ph),pC);
      if(!slab.joint)planterSurf.quad(pA,up(pA,ph),up(pD,ph),pD);
      if(slab.rStyle!=='slash')planterSurf.quad(pC,up(pC,ph),up(pB,ph),pB);
      soilSurf.quad(up(pA,ph-.02),up(pB,ph-.02),up(pC,ph-.02),up(pD,ph-.02));

      // Delicate low green Salvia rosettes & slender blue-violet flower spikes (max ~0.22m above rim, matching IMG_0172!)
      const count=Math.floor((pEnd-pStart)*34);
      for(let i=0;i<count;i++){
        const u=pStart+rng()*(pEnd-pStart),off=halfT+.06+rng()*(pw-.12);
        const fpt=pt(u,y0+ph-.01,off),fx=fpt[0],fy=fpt[1],fz=fpt[2];
        const a=rng()*Math.PI*2;
        for(let lf=0;lf<3;lf++){
          const la=a+lf*2.094+(rng()-.5)*.4,lLen=.08+rng()*.06,lH=.06+rng()*.045,lW=.020;
          const ca=Math.cos(la),sa=Math.sin(la),px=-sa*lW,pz=ca*lW;
          const midX=fx+ca*lLen*.55,midZ=fz+sa*lLen*.55,tipX=fx+ca*lLen,tipZ=fz+sa*lLen;
          foliageSurf.quad(
            [fx-px*.5,fy,fz-pz*.5],[fx+px*.5,fy,fz+pz*.5],
            [midX+px,fy+lH,midZ+pz],[midX-px,fy+lH,midZ-pz]
          );
          foliageSurf.quad(
            [midX-px,fy+lH,midZ-pz],[midX+px,fy+lH,midZ+pz],
            [tipX,fy+lH*.78,tipZ],[tipX,fy+lH*.78,tipZ]
          );
        }
        if(i%2===0){
          const sh=.12+rng()*.10,lean=(rng()-.5)*.05;
          for(let whorl=0;whorl<5;whorl++){
            const wt=whorl/5,h=fy+.05+(sh-.05)*wt,rad=.014*(1-wt*.55);
            const x=fx+lean*wt;
            for(let petal=0;petal<3;petal++){
              const theta=a+petal*2.094+whorl*.85,pdx=Math.cos(theta)*rad,pdz=Math.sin(theta)*rad;
              salviaSurf.quad([x,h,fz],[x+pdx-pdz*.5,h+.010,fz+pdz+pdx*.5],
                [x+pdx*1.1,h+.024,fz+pdz*1.1],[x+pdx+pdz*.5,h+.010,fz+pdz-pdx*.5]);
            }
          }
        }
      }

      // Organic low-profile textured shrub border cleanly 1.7m–2.8m BEHIND the wall (zero steel clipping!)
      const nHedge=Math.max(5,Math.floor(len*1.35));
      for(let i=0;i<nHedge;i++){
        const u=(i+.5)/nHedge*len,dist=1.75+rng()*.95;
        const bp=pt(u,wallY0,-(halfT+dist));
        const rx=.95+rng()*.45,ry=.82+rng()*.28;
        backHedge.at(bp[0],wallY0+ry*.85,bp[2],rx,ry,rx*.85,rng()*6.28);
        // Fine scattered floral flecks resting on top of the textured hedge (pink left, blue-purple right like IMG_0172!)
        for(let f=0;f<5;f++){
          const fx=bp[0]+(rng()-.5)*rx*1.1,fz=bp[2]+(rng()-.5)*rx*.9,fy=wallY0+ry*1.62+rng()*.12;
          const fw=.045+rng()*.028;
          const target=u<len*.52?backBloomSurf:backPurpleSurf;
          target.quad([fx-fw,fy,fz],[fx+fw,fy,fz],[fx+fw*.5,fy+fw*1.2,fz],[fx-fw*.5,fy+fw*1.2,fz]);
          target.quad([fx,fy,fz-fw],[fx,fy,fz+fw],[fx,fy+fw*1.2,fz+fw*.5],[fx,fy+fw*1.2,fz-fw*.5]);
        }
      }

      addBoxObstacle([
        [B.x-nx*.35,B.z-nz*.35],[A.x-nx*.35,A.z-nz*.35],
        [A.x+nx*(halfT+pw+.1),A.z+nz*(halfT+pw+.1)],[B.x+nx*(halfT+pw+.1),B.z+nz*(halfT+pw+.1)]
      ]);
    }

    apronSurf.mesh(wallGroup,stoneMat,'文化墙 · 墙前花岗石步道');
    planterSurf.mesh(wallGroup,new T.MeshStandardMaterial({color:0x3c271e,roughness:.88,side:T.DoubleSide}),'文化墙 · 耐候钢花槽',true);
    soilSurf.mesh(wallGroup,new T.MeshStandardMaterial({color:0x3d332a,roughness:1,side:T.DoubleSide}),'文化墙 · 种植土');
    foliageSurf.mesh(wallGroup,new T.MeshStandardMaterial({color:0x4b703a,roughness:.92,side:T.DoubleSide}),'文化墙 · 鼠尾草绿叶');
    salviaSurf.mesh(wallGroup,new T.MeshStandardMaterial({color:0x6656c2,roughness:.80,side:T.DoubleSide}),'文化墙 · 蓝紫鼠尾草花穗');
    backHedge.flush(wallGroup,true);
    backBloomSurf.mesh(wallGroup,new T.MeshStandardMaterial({color:0xc86b86,roughness:.85,side:T.DoubleSide}),'文化墙 · 墙后粉红花簇');
    backPurpleSurf.mesh(wallGroup,new T.MeshStandardMaterial({color:0x6e5ec4,roughness:.84,side:T.DoubleSide}),'文化墙 · 墙后蓝紫鼠尾草带');
  }

  // =========================================================================
  // 3. 东岸人才故事门廊：《千金市骨》《三顾茅庐》(IMG_0231, IMG_0232)
  // =========================================================================
  {
    const storyGroup=new T.Group();storyGroup.name='东岸 · 人才故事雕塑门廊';group.add(storyGroup);
    const qianjinTex=photo('story-qianjin.webp');
    const sanguTex=photo('story-sangu.webp');
    const portals=[
      {pos:[200.2,-134.1],yaw:0.68,tex:qianjinTex,label:'千金市骨'},
      {pos:[207.1,-119.8],yaw:0.74,tex:sanguTex,label:'三顾茅庐'},
      // Retain the existing illustrated panel until the third inscription is documented.
      {pos:[216.0,-106.3],yaw:0.78,tex:qianjinTex,label:'故事门廊'}
    ];
    const shellMat=new T.MeshStandardMaterial({color:0x6d7479,roughness:.66,metalness:.26,side:T.DoubleSide});
    for(const prt of portals){
      const g=new T.Group();g.name='人才故事门廊 · '+prt.label;
      g.position.set(prt.pos[0],.25,prt.pos[1]);g.rotation.y=prt.yaw;
      storyGroup.add(g);
      // Tapered asymmetric architectural steel monolith (IMG_0231, IMG_0232)
      const shape=new T.Shape();
      shape.moveTo(-1.45,0);shape.lineTo(1.55,0);shape.lineTo(1.22,4.35);shape.lineTo(-1.72,4.15);shape.closePath();
      const bodyGeo=new T.ExtrudeGeometry(shape,{depth:.56,bevelEnabled:true,bevelSize:.027,bevelThickness:.019,bevelSegments:2});
      bodyGeo.translate(0,0,-.29);
      const body=new T.Mesh(bodyGeo,shellMat);body.castShadow=true;body.receiveShadow=true;g.add(body);
      const slats=new Instances(box,darkWood,'故事门廊 · 竖向木格栅');
      for(let k=0;k<23;k++)slats.at(-.97+k*.082,2.80,.005,.071,2.05,.64);
      slats.flush(g,true);
      const mat=new T.MeshStandardMaterial({map:prt.tex,roughness:.71});
      for(const side of [-1,1]){
        const plaque=new T.Mesh(new T.PlaneGeometry(1.88,1.52),mat);
        plaque.position.set(0,1.22,side*.34);plaque.rotation.y=side<0?Math.PI:0;g.add(plaque);
      }
      // Dark timber bench seat at the base (IMG_0231, IMG_0232)
      const bench=new T.Mesh(new T.BoxGeometry(2.1,.42,.56),darkWood);
      bench.position.set(0,.21,.46);bench.castShadow=true;bench.receiveShadow=true;g.add(bench);
      addObstacle(prt.pos[0],prt.pos[1],1.65);
    }
  }

  // =========================================================================
  // 4. π桥南岸：卵石浅滩 + 黑白几何3D艺术平台 + 4叶观鸟科普牌 (IMG_0365, 0368, 0369)
  // =========================================================================
  {
    const piShore=new T.Group();piShore.name='π桥南岸 · 卵石浅滩与黑白几何艺术平台';group.add(piShore);
    // 4a. Curved pebble shoal island inside π bridge bay (IMG_0365, 0368, 0369)
    const shoalSurf=new Surface();
    const shoalCurve=new T.CatmullRomCurve3([
      new T.Vector3(-42,0,342),new T.Vector3(-25,0,336),new T.Vector3(-10,0,339),new T.Vector3(2,0,347)
    ]);
    const NS=20,Nring=8;
    const prevRing=[];
    for(let i=0;i<=NS;i++){
      const u=i/NS,p=shoalCurve.getPointAt(u),t=shoalCurve.getTangentAt(u);
      const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l,nz=t.x/l;
      const halfW=3.9*Math.sin(Math.PI*u)**.68;
      const row=[];
      for(let j=0;j<=Nring;j++){
        const v=j/Nring*2-1;
        const y=-.08+.46*(1-v*v)*Math.sin(Math.PI*u)**.5;
        row.push([p.x+nx*halfW*v,y,p.z+nz*halfW*v]);
      }
      if(i>0){
        for(let j=0;j<Nring;j++){
          const a=prevRing[j],b=row[j],c=row[j+1],d=prevRing[j+1];
          shoalSurf.quad(a,b,c,d,[a,b,c,d].map(q=>[q[0]/1.8,q[2]/1.8]));
        }
      }
      prevRing.splice(0,prevRing.length,...row);
    }
    shoalSurf.mesh(piShore,new T.MeshStandardMaterial({map:photo('flowerbed-shingle.webp'),color:0xd1c3b6,roughness:.98,side:T.DoubleSide}),'π桥湾 · 卵石浅滩');
    // River stones edging the pebble shoal
    const rocks=new Instances(new T.IcosahedronGeometry(1,2),new T.MeshStandardMaterial({roughness:.90}),'π桥湾 · 浅滩护岸卵石');
    const rRng=random(3681),rCol1=new T.Color('#8c7f73'),rCol2=new T.Color('#cbb9a7');
    for(let i=0;i<390;i++){
      const u=.04+rRng()*.92,p=shoalCurve.getPointAt(u),t=shoalCurve.getTangentAt(u);
      const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l,nz=t.x/l;
      const side=i%2?1:-1,hw=3.9*Math.sin(Math.PI*u)**.68*(.78+rRng()*.28);
      const sc=.055+Math.pow(rRng(),2)*.34;
      rocks.at(p.x+nx*hw*side,.08+rRng()*.14,p.z+nz*hw*side,sc*1.3,sc*.55,sc,rRng()*6.28,rCol1.clone().lerp(rCol2,rRng()));
    }
    rocks.flush(piShore);

    // 4b. Iconic black-and-white 3D stepped geometric art platform (IMG_0369 at -56.6, 347.5)
    const artGroup=new T.Group();artGroup.name='π桥南岸 · 黑白几何阶梯艺术平台';
    artGroup.position.set(-56.6,.22,347.8);
    artGroup.rotation.y=-0.16; // Projects north-northwest right out over the water edge toward π bridge
    piShore.add(artGroup);
    const barWhite=new Instances(box,whiteMat,'黑白平台 · 白色顶面条块');
    const barBlack=new Instances(box,new T.MeshStandardMaterial({color:0x22262b,roughness:.68}),'黑白平台 · 黑色立面基座');
    // Zigzagging parallel & angled monumental geometric bars (IMG_0369)
    for(let i=0;i<14;i++){
      const z=-i*1.08;
      const w=5.6+Math.sin(i*.9)*1.35;
      const xShift=Math.cos(i*1.15)*.65;
      const h=.52+.16*Math.sin(i*.7)+(i<3?.15:0);
      const yaw=(i%3===1)?.18:(i%3===2)?-.14:0;
      barBlack.at(xShift,h/2-.08,z,w,h,.62,yaw);
      barWhite.at(xShift,h-.04,z,w+.02,.08,.64,yaw);
    }
    // Cross-connecting diagonal ribs matching IMG_0369's bold geometric letters/bars
    for(const [x,z,len,rot] of [[-1.6,-3.5,4.8,.35],[1.5,-7.2,5.2,-.32],[-.8,-11.0,4.5,.28]]){
      barBlack.at(x,.28,z,len,.54,.55,rot);
      barWhite.at(x,.56,z,len+.02,.08,.57,rot);
    }
    barBlack.flush(artGroup,true);barWhite.flush(artGroup,true);
    addObstacle(-56.6,348.1,4.2);

    // 4c. 4-leaf cyan bird-watching info stand + low black rail beside the platform (IMG_0369)
    const standPos=[-60.2,355.2];
    leafPosts.at(standPos[0],1.18,standPos[1],.045,1.95,.045);
    const birdTitles=['黑脸琵鹭','白鹭','苍鹭','池鹭'];
    const leafOffsets=[[-.42,1.92,.12],[.38,1.52,-.08],[-.38,1.12,.08],[.36,.74,-.06]];
    leafOffsets.forEach(([ox,oy,oz],idx)=>{
      const lTex=trackTex(birdLeafTex(idx%2===0?'#6cb8c4':'#7bc1ae',birdTitles[idx]));
      const lm=new T.Mesh(new T.PlaneGeometry(.72,.68),new T.MeshStandardMaterial({map:lTex,transparent:true,alphaTest:.2,side:T.DoubleSide,roughness:.55}));
      lm.position.set(standPos[0]+ox,.24+oy,standPos[1]+oz);lm.rotation.y=-.35;
      piShore.add(lm);
    });
    // Small black fence + lush clipped green hedge border (IMG_0369)
    const rail=new Instances(box,darkMat,'观鸟点 · 黑色低矮栏栅');
    for(let k=0;k<10;k++)rail.at(standPos[0]+.45+k*.18,.68,standPos[1]-.4-k*.07,.022,.82,.022,-.35);
    rail.at(standPos[0]+1.25,1.08,standPos[1]-.72,1.85,.04,.04,-.35);
    rail.flush(piShore);
    const piHedge=new Instances(new T.SphereGeometry(1,9,6),new T.MeshStandardMaterial({map:photo('flowerbed-hedge.webp'),color:0x889958,roughness:1}),'π桥南岸 · 修剪灌木绿篱');
    const hRng=random(3694);
    for(let i=0;i<28;i++){
      const t=i/27,hx=-63.5+t*17.5,hz=356.0-Math.sin(t*Math.PI)*3.8;
      if(hx>-58.8&&hx<-53.2)continue;
      piHedge.at(hx,.52,hz,.82+hRng()*.22,.52+hRng()*.12,.76,hRng()*3.14);
    }
    piHedge.flush(piShore,true);
  }

  // =========================================================================
  // 5. “数学之美”圆柱金属雕塑 (IMG_0372 at -159.5, 400.7)
  // =========================================================================
  {
    const mTex=trackTex(mathPillarTex());
    const pillarMat=new T.MeshStandardMaterial({map:mTex,roughness:.56,metalness:.46});
    const pillar=new T.Mesh(new T.CylinderGeometry(.56,.56,2.52,40),pillarMat);
    pillar.name='南岸草坪 · 数学之美圆柱雕塑';
    pillar.position.set(-159.5,1.38,400.7);
    pillar.castShadow=true;pillar.receiveShadow=true;
    group.add(pillar);
    addObstacle(-159.5,400.7,.85);
  }

  // =========================================================================
  // 6. 求贤阁广场细节：石材入口广场 + 红色SZ♥U雕塑 + 深圳人才公园巨石 + 标语 + 棕榈林 (IMG_0378~0383)
  // =========================================================================
  {
    const qxGroup=new T.Group();qxGroup.name='求贤阁 · 入口广场与主题雕塑';group.add(qxGroup);
    // 6a. Light warm-beige granite stone entry forecourt (IMG_0379, IMG_0380)
    const plaza=new Surface();
    const plazaRing=[[-480.8,225.2],[-477.2,201.5],[-466.5,202.2],[-467.8,226.4]];
    plaza.polygon(plazaRing,[],.252,2.4);
    addPavedArea(plazaRing);
    plaza.mesh(qxGroup,new T.MeshStandardMaterial({map:photo('pavers.webp'),color:0xded5c5,roughness:.88,side:T.DoubleSide}),'求贤阁 · 入口米色条石广场');

    // 6b. Red 3D "SZ♥U" sculpture on white bench plinth (IMG_0378 at -477.5, 243.5)
    const szu=new T.Group();szu.name='求贤阁 · 红色SZ♥U雕塑';
    szu.position.set(-477.8,.22,243.2);szu.rotation.y=-Math.PI/2-0.18;
    qxGroup.add(szu);
    const plinth=new T.Mesh(new T.BoxGeometry(3.4,.44,.74),whiteMat);
    plinth.position.y=.22;plinth.castShadow=true;plinth.receiveShadow=true;szu.add(plinth);
    const redMetal=new T.MeshStandardMaterial({color:0xb8241d,roughness:.38,metalness:.22,side:T.DoubleSide});
    // Heart shape (bottom-left)
    const hShape=new T.Shape();
    hShape.moveTo(0,0);
    hShape.bezierCurveTo(-.55,.38,-.75,.95,-.38,1.18);
    hShape.bezierCurveTo(-.14,1.32,0,1.12,0,.95);
    hShape.bezierCurveTo(0,1.12,.14,1.32,.38,1.18);
    hShape.bezierCurveTo(.75,.95,.55,.38,0,0);
    const heart=new T.Mesh(new T.ExtrudeGeometry(hShape,{depth:.36,bevelEnabled:true,bevelThickness:.03,bevelSize:.03}),redMetal);
    heart.position.set(-.62,.44,-.18);heart.castShadow=true;szu.add(heart);
    // "U" shape (bottom-right)
    const uShape=new T.Shape();
    uShape.moveTo(-.48,1.15);uShape.lineTo(-.48,.42);uShape.absarc(0,.42,.48,Math.PI,Math.PI*2,false);uShape.lineTo(.48,1.15);
    uShape.lineTo(.26,1.15);uShape.lineTo(.26,.44);uShape.absarc(0,.44,.26,0,Math.PI,true);uShape.lineTo(-.26,1.15);uShape.closePath();
    const uMesh=new T.Mesh(new T.ExtrudeGeometry(uShape,{depth:.36,bevelEnabled:false}),redMetal);
    uMesh.position.set(.58,.44,-.18);uMesh.castShadow=true;szu.add(uMesh);
    // True extruded 3D "Z" and sculptural thick "S" sitting above Heart & U (IMG_0378)
    const zShape=new T.Shape();
    zShape.moveTo(-.48,1.02);zShape.lineTo(.48,1.02);zShape.lineTo(.48,.82);zShape.lineTo(-.16,.20);
    zShape.lineTo(.48,.20);zShape.lineTo(.48,0);zShape.lineTo(-.48,0);zShape.lineTo(-.48,.20);
    zShape.lineTo(.16,.82);zShape.lineTo(-.48,.82);zShape.closePath();
    const zMesh=new T.Mesh(new T.ExtrudeGeometry(zShape,{depth:.36,bevelEnabled:true,bevelThickness:.02,bevelSize:.02}),redMetal);
    zMesh.position.set(.58,1.58,-.18);zMesh.castShadow=true;szu.add(zMesh);
    // Solid extruded "S" built from bold geometric curves
    const sShape=new T.Shape();
    sShape.moveTo(.44,.86);sShape.lineTo(.26,1.04);sShape.lineTo(-.34,1.04);sShape.lineTo(-.48,.84);
    sShape.lineTo(-.48,.58);sShape.lineTo(-.30,.44);sShape.lineTo(.22,.40);sShape.lineTo(.26,.22);
    sShape.lineTo(-.24,.20);sShape.lineTo(-.46,.30);sShape.lineTo(-.48,.12);sShape.lineTo(-.26,0);
    sShape.lineTo(.34,0);sShape.lineTo(.48,.18);sShape.lineTo(.48,.46);sShape.lineTo(.30,.60);
    sShape.lineTo(-.22,.64);sShape.lineTo(-.26,.82);sShape.lineTo(.24,.84);sShape.closePath();
    const sMesh=new T.Mesh(new T.ExtrudeGeometry(sShape,{depth:.36,bevelEnabled:true,bevelThickness:.02,bevelSize:.02}),redMetal);
    sMesh.position.set(-.60,1.58,-.18);sMesh.castShadow=true;szu.add(sMesh);
    addObstacle(-477.8,243.2,1.75);

    // 6c. Natural rough-hewn granite boulder "深圳人才公园" (IMG_0379 at -474.5, 229.8)
    const titleStone=new T.Group();
    titleStone.position.set(-474.6,.22,229.8);titleStone.rotation.y=-Math.PI/2-.14;
    qxGroup.add(titleStone);
    sculptureReady=mountSculpture(titleStone,'talent-stone-h31');
    addObstacle(-474.6,229.8,1.35);

    // 6d. "深爱人才 圳等您来" colourful lawn sign north of entry (IMG_0378, IMG_0380)
    const motto=new T.Group();
    motto.position.set(-475.8,.28,203.2);motto.rotation.y=-Math.PI/2-.12;qxGroup.add(motto);
    const paint=c=>new T.MeshStandardMaterial({color:c,roughness:.48,metalness:.19});
    const edge=paint(0xd5cbbc);
    parkLetters(motto,'深爱人才',2.95,.105,paint(0xbf3c2e),edge,0,.85,0);
    parkLetters(motto,'圳等您来',2.95,.105,paint(0xc58b2d),edge,0,.12,0);
    for(const x of [-1.05,0,1.05]){
      const support=new T.Mesh(new T.BoxGeometry(.038,1.29,.055),darkMat);
      support.position.set(x,.62,-.07);motto.add(support);
    }
    // (6e. West Washingtonia Palm Grove is now populated uniformly by city-nature.js.)
  }

  // =========================================================================
  // 7. 环湖蓝色慢跑道全线 360° 无缝闭环 + 折臂庭院灯 + 黑色草坪柱灯
  //    Segment A: 西南桥北口 -> 求贤阁 -> 西岸棕榈大道 -> 西入口 -> 潮汐广场北 -> 双曲桥西口
  //    Segment E: 星光桥南岸终点 -> π桥南岸 -> 数学之美 -> 西南桥南口
  //    (与双曲桥、花坛东岸整段、星光桥及南岸共同构成 0 断层 360° 绕湖闭环)
  // =========================================================================
  {
    const blueLoop=new Surface(),stoneLoop=new Surface(),edgeLoop=new Surface();
    const lampPoles=new Surface(),lampDiff=new Surface(),lampBase=new Surface();
    const roadById=new Map(map.roads.map(r=>[r.id,r]));
    const dedup=pts=>{
      const out=[];
      for(const p of pts){
        if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>.8)out.push(p);
      }
      return out;
    };
    const surfaceY=(x,z)=>Math.max(
      .252,
      grid.tidal?.heightAt(x,z)??0,
      grid.southGround?.heightAt(x,z)??0
    );

    function buildContinuousRingSegment(rawPts,{startCentered=false,endCentered=false,weldEndBlue=null,stoneW=3.2,addLamps=true}={}){
      const clean=dedup(rawPts);
      if(clean.length<2)return;
      const curve=new T.CatmullRomCurve3(clean.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal',0.4);
      const len=curve.getLength(),steps=Math.max(12,Math.ceil(len/1.8));
      let prev=null;
      for(let i=0;i<=steps;i++){
        const u=i/steps,s=u*len,p=curve.getPointAt(u),t=curve.getTangentAt(u);
        const l=Math.hypot(t.x,t.z)||1,dx=t.x/l,dz=t.z/l,nx=-dz,nz=dx;
        // Clockwise travel: +normal ALWAYS points toward the lake!
        const startBlend=startCentered?T.MathUtils.smoothstep(s,0,18):1;
        const endBlend=endCentered?T.MathUtils.smoothstep(len-s,0,18):1;
        const blend=Math.min(startBlend,endBlend);
        const bInner=T.MathUtils.lerp(-1.05,.08,blend);
        const bOuter=T.MathUtils.lerp(1.05,2.18,blend);
        const localStoneW=stoneW*(startCentered?startBlend:1);
        const sOuter=bInner-localStoneW;
        const pt=(off,lift)=>{
          const x=p.x+nx*off,z=p.z+nz*off;
          return [x,surfaceY(x,z)+lift,z];
        };
        let b0=pt(bInner,.016),b1=pt(bOuter,.016);
        let st0=pt(sOuter,.009),st1=pt(bInner,.009);
        if(weldEndBlue&&i===steps){
          b0=[weldEndBlue.blueNorth[0],.264,weldEndBlue.blueNorth[2]];
          b1=[weldEndBlue.blueSouth[0],.264,weldEndBlue.blueSouth[2]];
          st0=[weldEndBlue.north[0],.257,weldEndBlue.north[2]];
          st1=[weldEndBlue.blueNorth[0],.257,weldEndBlue.blueNorth[2]];
        }
        const ed0=pt(bInner-.09,.013),ed1=pt(bInner+.04,.013);
        const cur={s,b0,b1,st0,st1,ed0,ed1,midX:(st0[0]+b1[0])*.5,midZ:(st0[2]+b1[2])*.5,halfW:(bOuter-sOuter)*.5};
        if(prev){
          if(localStoneW>.05){
            stoneLoop.quad(prev.st0,cur.st0,cur.st1,prev.st1,
              [[0,prev.s/2.6],[0,cur.s/2.6],[localStoneW/2.6,cur.s/2.6],[localStoneW/2.6,prev.s/2.6]]);
          }
          blueLoop.quad(prev.b0,cur.b0,cur.b1,prev.b1,
            [[0,prev.s/3.0],[0,cur.s/3.0],[.75,cur.s/3.0],[.75,prev.s/3.0]]);
          edgeLoop.quad(prev.ed0,cur.ed0,cur.ed1,prev.ed1);
          addPavedSeg([prev.midX,prev.midZ],[cur.midX,cur.midZ],Math.max(prev.halfW,cur.halfW));
        }
        prev=cur;
      }
      if(addLamps){
        for(let s=14;s<len-12;s+=25){
          const u=s/len,p=curve.getPointAt(u),t=curve.getTangentAt(u);
          const l=Math.hypot(t.x,t.z)||1,dx=t.x/l,dz=t.z/l,nx=-dz,nz=dx;
          const lx=p.x-nx*(stoneW+.95),lz=p.z-nz*(stoneW+.95);
          if(grid.water.query(lx,lz).some(w=>inArea(lx,lz,w)))continue;
          if(grid.buildings.query(lx,lz).some(b=>inArea(lx,lz,b)))continue;
          if(grid.tidal?.heightAt(lx,lz)!=null)continue;
          addBentLamp(lampPoles,lampDiff,lampBase,m.parkLights,lx,lz,dx,dz,nx,nz);
        }
        for(let s=8;s<len-8;s+=16){
          const u=s/len,p=curve.getPointAt(u),t=curve.getTangentAt(u);
          const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l,nz=t.x/l;
          const bx=p.x-nx*(stoneW+.45),bz=p.z-nz*(stoneW+.45);
          if(grid.water.query(bx,bz).some(w=>inArea(bx,bz,w)))continue;
          if(grid.tidal?.heightAt(bx,bz)!=null)continue;
          bollards.at(bx,.54,bz,.075,.64,.075);
          bollardCaps.at(bx,.80,bz,.078,.11,.078);
        }
      }
    }

    // --- SEGMENT A: Complete West + North Shore Continuous Spline ---
    // SW Bridge North Mouth [-461.4, 316.9] -> Qiuxian Ge -> West Palm Grove ->
    // West Corten Wall -> NW Entrance -> Tidal Square North -> Shuangqu Bridge West Mouth!
    const rWest=roadById.get(536079055);
    const rNW=roadById.get(537568298);
    const rNorth=roadById.get(735037171);
    const sqWest=grid.parkBridges?.shuangquWestJoin;
    if(rWest&&rNW&&rNorth){
      // Align centerline cleanly with Shuangqu Bridge west blue-inner edge so ZERO Z-bend occurs!
      const wInner=sqWest?[sqWest.blueNorth[0],sqWest.blueNorth[2]]:rNorth.p.at(-1);
      const wPre=sqWest?[wInner[0]-sqWest.dir[0]*9.5,wInner[1]-sqWest.dir[1]*9.5]:rNorth.p.at(-2);
      const segAPts=[
        ...rWest.p.slice().reverse(),
        ...rNW.p.slice(1),
        ...rNorth.p.slice(1,-2),
        wPre,
        wInner
      ];
      buildContinuousRingSegment(segAPts,{
        weldEndBlue:sqWest,
        stoneW:3.1,addLamps:true
      });
    }

    // --- CONNECTORS FOR 571169638 & π BRIDGE APPROACHES (zero bare-grass gaps!) ---
    function addStoneConnector(pts,width=3.4){
      const curve=new T.CatmullRomCurve3(pts.map(([x,z])=>new T.Vector3(x,0,z)));
      const len=curve.getLength(),steps=Math.max(4,Math.ceil(len/1.6));
      let prev=null;
      for(let i=0;i<=steps;i++){
        const u=i/steps,p=curve.getPointAt(u),t=curve.getTangentAt(u);
        const l=Math.hypot(t.x,t.z)||1,nx=-t.z/l*width*.5,nz=t.x/l*width*.5;
        const a=[p.x-nx,.258,p.z-nz],b=[p.x+nx,.258,p.z+nz];
        if(prev){
          stoneLoop.quad(prev.a,a,b,prev.b,[[0,prev.s/2.4],[0,u*len/2.4],[width/2.4,u*len/2.4],[width/2.4,prev.s/2.4]]);
          addPavedSeg([prev.x,prev.z],[p.x,p.z],width*.5);
        }
        prev={a,b,x:p.x,z:p.z,s:u*len};
      }
    }
    // 571169638 east mouth [27.7,358.8] <-> southWalk end [37.7,360.8]
    addStoneConnector([[38.8,361.0],[33.0,359.8],[27.4,358.7]],3.5);
    // 571169638 west mouth [0.4,354.1] <-> Segment E south promenade
    addStoneConnector([[0.6,354.1],[-6.5,355.0],[-14.0,354.2]],3.5);
    // π桥 east approach (537570365) & west approach (570468708) upgraded to linear grey granite
    const rPiE=roadById.get(537570365);
    if(rPiE)addStoneConnector(rPiE.p,3.0);
    const rPiW=roadById.get(570468708);
    if(rPiW)addStoneConnector(rPiW.p,3.0);

    // --- SEGMENT E: Complete South Shore Continuous Spline ---
    // Starlight South Blue End (38.5, 366.4) -> behind 571169638 -> behind π Bridge & Art Deck ->
    // past Math Beauty Pillar -> SW Bridge South Mouth [-435.6, 356.1]!
    const rSouthPi=roadById.get(571169641);
    const rSouthSW=roadById.get(537564666);
    const sEnd=grid.southWalk?.southBlueEnd;
    if(rSouthPi&&rSouthSW){
      // Overlap 1.2m back into Starlight south blue track along its tangent so 0 gap occurs
      const startPt=sEnd?[sEnd.x-sEnd.dx*1.2,sEnd.z-sEnd.dz*1.2]:[39.5,366.2];
      const segEPts=[
        startPt,
        sEnd?[sEnd.x+sEnd.dx*6,sEnd.z+sEnd.dz*6]:[32.5,367.2],
        [20.0,365.4],
        [6.0,361.8],
        [-5.0,358.2],
        ...rSouthPi.p.slice(1,27), // [-17.4,352.7] -> [-355.7,424.4]
        ...rSouthSW.p.slice(42)    // [-366.4,420.3] -> [-435.6,356.1] (SW Bridge south mouth!)
      ];
      buildContinuousRingSegment(segEPts,{
        startCentered:true,
        stoneW:3.1,addLamps:true
      });
    }

    stoneLoop.mesh(group,stoneMat,'环湖步道 · 灰色线性条石主路');
    blueLoop.mesh(group,blueTrackMat,'环湖步道 · 360°连续蓝色慢跑道');
    edgeLoop.mesh(group,new T.MeshStandardMaterial({color:0xb8b5aa,roughness:.9,side:T.DoubleSide}),'环湖步道 · 花岗石收边条');
    lampPoles.mesh(group,darkMat,'环湖步道 · 折臂黑色庭院灯',true);
    lampBase.mesh(group,new T.MeshStandardMaterial({color:0x586066,roughness:.7}),'环湖步道 · 灯杆检修口');
    lampDiff.mesh(group,ledMat,'环湖步道 · 折臂嵌入灯条');
  }

  // =========================================================================
  // 9. 西岸百杰山圆环草坡广场 + 浅灰花岗石环道与放射阶梯 + 临湖石阶护岸与林带
  //    (Matched to IMG_0278, IMG_0230, IMG_0226, IMG_0197)
  // =========================================================================
  const westTrees=[];
  const lawnCX=-246.8,lawnCZ=-90.1,lawnR=22.4,lawnRise=1.08;
  const westLawnHeight=(x,z)=>{
    const d=Math.hypot(x-lawnCX,z-lawnCZ);
    if(d>=lawnR)return null;
    return .25+lawnRise*Math.pow(Math.cos(d/lawnR*Math.PI*.5),1.35);
  };
  {
    const westGroup=new T.Group();westGroup.name='西岸 · 百杰山圆环草坡与临湖广场';group.add(westGroup);
    const domeSurf=new Surface(),westPave=new Surface(),curbSurf=new Surface(),stepSurf=new Surface();
    const lawnTone=new T.Color(0xc5db94);
    const lightCurbMat=new T.MeshStandardMaterial({color:0xc3c6c0,roughness:.88,side:T.DoubleSide});
    const benchWoodMat=darkWood;

    // 9a. Gently domed sunlit emerald circular lawn (replaces flat dark-green disc at -246.8, -90.1)
    const RINGS=9,SEGS=44;
    let prevRing=null;
    for(let r=1;r<=RINGS;r++){
      const rad=lawnR*r/RINGS;
      const y=.25+lawnRise*Math.pow(Math.cos((r/RINGS)*Math.PI*.5),1.35);
      const row=[];
      for(let s=0;s<=SEGS;s++){
        const a=s*Math.PI*2/SEGS;
        row.push([lawnCX+Math.cos(a)*rad,y,lawnCZ+Math.sin(a)*rad]);
      }
      if(r===1){
        const apex=[lawnCX,.25+lawnRise,lawnCZ];
        for(let s=0;s<SEGS;s++)domeSurf.quad(apex,row[s],row[s+1],apex,[apex,row[s],row[s+1],apex].map(q=>[q[0]/3.6,q[2]/3.6]),lawnTone);
      }else{
        for(let s=0;s<SEGS;s++)domeSurf.quad(prevRing[s],row[s],row[s+1],prevRing[s+1],[prevRing[s],row[s],row[s+1],prevRing[s+1]].map(q=>[q[0]/3.6,q[2]/3.6]),lawnTone);
      }
      prevRing=row;
    }
    // Crisp curved light-grey granite seating curb ringing the circular lawn
    const curbR0=lawnR-.12,curbR1=lawnR+.58,curbY=.50;
    for(let s=0;s<SEGS;s++){
      const a0=s*Math.PI*2/SEGS,a1=(s+1)*Math.PI*2/SEGS;
      const i0=[lawnCX+Math.cos(a0)*curbR0,curbY,lawnCZ+Math.sin(a0)*curbR0];
      const i1=[lawnCX+Math.cos(a1)*curbR0,curbY,lawnCZ+Math.sin(a1)*curbR0];
      const o0=[lawnCX+Math.cos(a0)*curbR1,curbY,lawnCZ+Math.sin(a0)*curbR1];
      const o1=[lawnCX+Math.cos(a1)*curbR1,curbY,lawnCZ+Math.sin(a1)*curbR1];
      const b0=[o0[0],.25,o0[2]],b1=[o1[0],.25,o1[2]];
      curbSurf.quad(i0,o0,o1,i1);
      curbSurf.quad(b0,o0,o1,b1);
    }

    // 9b. Upgrade muddy brown circular & radial footways to crisp warm-grey linear granite paving
    const roadById=new Map(map.roads.map(r=>[Number(r.id),r]));
    function paveGraniteStrip(pts,width=3.2,y=.276,stepped=false){
      if(!pts||pts.length<2)return;
      const vecs=pts.map(([x,z])=>new T.Vector3(x,0,z));
      const curve=pts.length>=3?new T.CatmullRomCurve3(vecs):null;
      const total=curve?curve.getLength():Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]);
      const n=Math.max(4,Math.ceil(total/1.4));
      let prev=null;
      for(let i=0;i<=n;i++){
        const u=i/n;
        let px,pz,dx,dz;
        if(curve){
          const pt=curve.getPointAt(u),tg=curve.getTangentAt(u),l=Math.hypot(tg.x,tg.z)||1;
          px=pt.x;pz=pt.z;dx=tg.x/l;dz=tg.z/l;
        }else{
          px=pts[0][0]+(pts[1][0]-pts[0][0])*u;pz=pts[0][1]+(pts[1][1]-pts[0][1])*u;
          const l=total||1;dx=(pts[1][0]-pts[0][0])/l;dz=(pts[1][1]-pts[0][1])/l;
        }
        const nx=-dz*width*.5,nz=dx*width*.5;
        const a=[px-nx,y,pz-nz],b=[px+nx,y,pz+nz];
        if(prev){
          westPave.quad(prev.a,a,b,prev.b,[[0,prev.s/2.4],[0,u*total/2.4],[width/2.4,u*total/2.4],[width/2.4,prev.s/2.4]]);
          addPavedSeg([prev.px,prev.pz],[px,pz],width*.5+.25);
          if(stepped&&i%2===0){
            const ma=[px-nx*.96,y+.025,pz-nz*.96],mb=[px+nx*.96,y+.025,pz+nz*.96];
            const na=[px-nx*.96-dx*.14,y+.025,pz-nz*.96-dz*.14],nb=[px+nx*.96-dx*.14,y+.025,pz+nz*.96-dz*.14];
            curbSurf.quad(na,ma,mb,nb);
          }
        }
        prev={a,b,px,pz,s:u*total};
      }
    }
    const rRing=roadById.get(562534128);
    if(rRing)paveGraniteStrip(rRing.p,3.4,.276);
    const rOuter=roadById.get(570468659);
    if(rOuter)paveGraniteStrip(rOuter.p.slice(0,18),3.6,.278);
    for(const rid of [570468660,570468661,570468664,570468666,570468667,570468668,570468669,570468670,570468662,570468663,775214617,775214618,775214619,775214620,775214621,1475299794]){
      const rd=roadById.get(rid);
      if(rd)paveGraniteStrip(rd.p,3.1,.278,rd.kind==='steps');
    }

    // 9c. Continuous 3-tier light-grey granite waterfront steps + lakeside dark bollards & benches (IMG_0278 & IMG_0230)
    const lake=map.water.find(w=>Number(w.id)===-10175109);
    const shoreBollards=new Instances(cyl,darkMat,'西岸临湖 · 黑色系缆护栏桩');
    const shoreBenches=new Instances(box,benchWoodMat,'西岸广场 · 观湖长椅');
    const shoreLegs=new Instances(box,darkMat,'西岸广场 · 长椅金属支脚');
    if(lake){
      // Headland waterfront curve (indices 90..103) + Talent Station waterfront (indices 65..74)
      for(const segPts of [lake.p.slice(90,104),lake.p.slice(65,75)]){
        const curve=new T.CatmullRomCurve3(segPts.map(([x,z])=>new T.Vector3(x,0,z)));
        const len=curve.getLength(),steps=Math.max(12,Math.ceil(len/2.2));
        let prevTiers=null;
        for(let i=0;i<=steps;i++){
          const u=i/steps,pt=curve.getPointAt(u),tg=curve.getTangentAt(u);
          const l=Math.hypot(tg.x,tg.z)||1;
          // Outward toward lake (+X) vs inland (-X)
          let nx=-tg.z/l,nz=tg.x/l;
          if(nx<0){nx=-nx;nz=-nz;} // Ensure (nx, nz) points EAST toward the lake!
          const cur=[];
          for(let k=0;k<4;k++){
            const off=-(3-k)*1.25; // Inland (-3.75m) stepping out to shoreline (0m)
            const y=.27-k*.075;
            cur.push([pt.x+nx*off,y,pt.z+nz*off]);
          }
          if(prevTiers){
            for(let k=0;k<3;k++){
              const a=prevTiers[k],b=cur[k],c=cur[k+1],d=prevTiers[k+1];
              stepSurf.quad(a,b,c,d,[[0,i-1],[0,i],[1,i],[1,i-1]]);
              // Vertical riser drop
              const cLow=[c[0],c[1]-.08,c[2]],dLow=[d[0],d[1]-.08,d[2]];
              curbSurf.quad(dLow,cLow,c,d);
            }
          }
          // Dark waterfront bollard posts every ~3.5m along the lake edge (IMG_0230, IMG_0278)
          if(i%2===0){
            shoreBollards.at(pt.x-nx*.35,.55,pt.z-nz*.35,.065,.78,.065);
          }
          // Lakeside benches facing the water along the upper terrace
          if(i>1&&i<steps-1&&i%6===0){
            const bx=pt.x-nx*3.8,bz=pt.z-nz*3.8,byaw=Math.atan2(nx,nz);
            shoreBenches.at(bx,.68,bz,2.2,.09,.56,byaw);
            shoreLegs.at(bx-Math.cos(byaw)*.85,.45,bz+Math.sin(byaw)*.85,.12,.42,.48,byaw);
            shoreLegs.at(bx+Math.cos(byaw)*.85,.45,bz-Math.sin(byaw)*.85,.12,.42,.48,byaw);
          }
          prevTiers=cur;
        }
      }
    }

    // 9d. Lush west-shore tree belt framing Circular Lawn, Sail Tower, Cove & Talent Station (IMG_0278, IMG_0230)
    const wtRng=random(562534);
    // Belt along east side of blue track behind circular lawn & Sail Tower (x in [-276, -245], z in [-230, +16])
    for(const [tx,tz,th] of [
      [-262,-16,8.2],[-265,-28,7.6],[-268,-40,8.5],[-272,-54,7.8],[-275,-68,8.4],
      [-276,-82,7.9],[-274,-96,8.6],[-271,-112,8.1],[-266,-126,7.7],[-258,-138,8.4],
      [-252,-150,7.8],[-248,-164,8.6],[-245,-178,8.0],[-242,-192,7.5],[-238,-228,8.2],
      [-232,-242,7.9],[-225,-254,8.4],[-218,-265,7.6],[-258,-184,8.2],[-255,-170,7.4],
      [-260,-156,8.0],[-264,-142,7.8],[-226,-158,7.6],[-216,-162,8.2],[-210,-152,7.2],
      [-220,-176,8.0],[-214,-190,7.6],[-208,-182,7.4],[-222,-148,7.8],[-232,-142,8.1],
      [-240,-132,7.5],[-230,-42,7.8],[-242,-36,7.2],[-256,-22,8.0],[-260,2,7.8],
      [-258,14,8.4],[-246,18,7.6],[-268,-4,8.2],[-272,-18,7.5],[-268,-128,8.4],
      [-262,-116,7.2],[-270,-102,7.9],[-274,-74,8.1],[-264,-48,7.4],[-254,-44,7.6],
      [-212,-128,7.4],[-204,-118,7.8],[-202,-64,7.6],[-212,-50,7.2],[-224,-40,7.4],
      [-248,-222,8.0],[-244,-236,7.8],[-236,-248,8.4],[-228,-258,7.6],[-215,-236,7.5]
    ]){
      // Keep the sunlit central circular lawn mound completely open!
      if(Math.hypot(tx-lawnCX,tz-lawnCZ)<lawnR+2.5)continue;
      westTrees.push([tx+(wtRng()-.5)*1.4,tz+(wtRng()-.5)*1.4,th+(wtRng()-.5)*1.2]);
    }

    // Lush manicured ornamental shrub clusters at outer circular lawn lawn-path wedges (clear of paths!)
    const westShrubs=new Instances(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({map:photo('flowerbed-hedge.webp'),color:0x7c9652,roughness:.96}),'西岸草坡 · 景观灌木组团');
    const sRng=random(562599);
    for(const [sx,sz,cnt] of [[-222,-66,7],[-218,-112,7],[-252,-128,6],[-256,-52,6],[-214,-154,6],[-238,-18,6]]){
      for(let k=0;k<cnt;k++){
        const ox=(sRng()-.5)*4.2,oz=(sRng()-.5)*4.2,rx=.75+sRng()*.45,ry=.48+sRng()*.28;
        westShrubs.at(sx+ox,.25+ry*.65,sz+oz,rx,ry,rx*.9,sRng()*6.28);
      }
    }

    domeSurf.mesh(westGroup,m.grass,'西岸 · 百杰山微地形圆环草坡');
    westPave.mesh(westGroup,stoneMat,'西岸 · 圆环广场线性花岗石步道');
    stepSurf.mesh(westGroup,lightCurbMat,'西岸 · 临湖三级花岗石观景台阶');
    curbSurf.mesh(westGroup,lightCurbMat,'西岸 · 圆环坐凳压顶与梯级收边',true);
    for(const inst of [shoreBollards,shoreBenches,shoreLegs,westShrubs])inst.flush(westGroup,inst!==shoreBollards);
  }

  // Teal/lime leaf wayfinding signposts around key park junctions (IMG_0380 left)
  const wayPosts=[[-482.5,221.5,-1.2],[-232.0,-288.0,1.4],[198.0,-138.0,2.2],[34.0,356.0,-.4]];
  const leafDirTex=trackTex(birdLeafTex('#4ea0b2','求贤阁 / 湖畔'));
  const leafDirMat=new T.MeshStandardMaterial({map:leafDirTex,transparent:true,alphaTest:.2,side:T.DoubleSide,roughness:.55});
  for(const [wx,wz,rot] of wayPosts){
    leafPosts.at(wx,1.35,wz,.042,2.25,.042);
    const l1=new T.Mesh(new T.PlaneGeometry(.68,.62),leafDirMat);
    l1.position.set(wx+.30,2.05,wz);l1.rotation.y=rot;group.add(l1);
    const l2=new T.Mesh(new T.PlaneGeometry(.58,.52),leafDirMat);
    l2.position.set(wx-.26,1.65,wz);l2.rotation.y=rot+.2;group.add(l2);
  }

  for(const b of [bollards,bollardCaps,leafPosts])b.flush(group,b===leafPosts);
  const photoExtra=parkPhotoDetails(root,map,m,grid,{addObstacle,addPavedSeg});

  const onPromenade=(x,z,margin=.65)=>{
    if(pavedAreas.some(a=>inArea(x,z,a)))return true;
    return pavedSegs.query(x,z).some(s=>segmentDistance(x,z,s.a,s.b)<s.halfW+margin);
  };
  return {
    ready:sculptureReady,
    blocked:(x,z)=>obstacles.query(x,z).some(o=>inArea(x,z,o)),
    heightAt:westLawnHeight,
    trees:westTrees,
    onPromenade,
    dispose(){photoExtra.dispose();disposables.forEach(t=>t.dispose());}
  };
}
