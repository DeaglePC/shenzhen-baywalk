import * as T from 'three';
import {Surface,Instances,Grid,clamp,random,segmentDistance} from './city-geometry.js';
import {photo} from './city-materials.js';
import {groundIndex} from './star-south-ground.js';

export const parkBridgeIds=new Set([
  537568300, // 双曲桥（北渠观景桥）
  570468707, // π桥（派桥）
  571169638, // π桥东侧石板桥
  808097526, // 西岸南亲水桥
  832163846, // 西岸北亲水桥
  537564665, // 西南角外桥
  562534117, // 西南角内桥
  1415882807,// 未来智汇廊桥
  259033235, // 东岸滨海绿道大桥（后海大桥东侧）
  571629067  // 东岸滨海绿道北桥（后海二桥东侧）
]);

// The two railings share the 2,017 decimal places commemorating the park's opening year.
const piDigits=
  '3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421'+
  '170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489'+
  '549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936'+
  '072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213'+
  '841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527'+
  '248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931'+
  '767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301'+
  '465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999'+
  '983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378'+
  '387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805'+
  '321712268066130019278766111959092164201989380952572010654858632788659361533818279682303019520353'+
  '018529689957736225994138912497217752834791315155748572424541506959508295331168617278558890750983'+
  '817546374649393192550604009277016711390098488240128583616035637076601047101819429555961989467678'+
  '374494482553797747268471040475346462080466842590694912933136770289891521047521620569660240580381'+
  '501935112533824300355876402474964732639141992726042699227967823547816360093417216412199245863150'+
  '302861829745557067498385054945885869269956909272107975093029553211653449872027559602364806654991'+
  '198818347977535663698074265425278625518184175746728909777727938000816470600161452491921732172147'+
  '723501414419735685481613611573525521334757418494684385233239073941433345477624168625189835694855'+
  '620992192221842725502542568876717904946016534668049886272327917860857843838279679766814541009538'+
  '837863609506800642251252051173929848960841284886269456042419652850222106611863067442786220391949'+
  '450471237137869609563643719172874677646575739624138908658326459958133904780275900994657640789512'+
  '694';

const BASE_Y=0.256;

function linearGraniteMat(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d'),rng=random(20512);
  g.fillStyle='#6c7072';g.fillRect(0,0,512,512);
  const tones=['#a4a7a9','#96999c','#b1b3b2','#8d9195','#a9aba9','#9fa2a4'];
  // Linear narrow granite slabs matching IMG_0205, IMG_0212, IMG_0367
  const cols=16,colW=512/cols;
  for(let col=0;col<cols;col++){
    let y=-(rng()*64);
    while(y<512){
      const h=64+Math.floor(rng()*64);
      g.fillStyle=tones[Math.floor(rng()*tones.length)];
      g.fillRect(col*colW+1,y+1,colW-2,h-2);
      y+=h;
    }
  }
  const img=g.getImageData(0,0,512,512);
  for(let i=0;i<img.data.length;i+=4){
    const n=(rng()-.5)*14;
    img.data[i]=clamp(img.data[i]+n,0,255);
    img.data[i+1]=clamp(img.data[i+1]+n,0,255);
    img.data[i+2]=clamp(img.data[i+2]+n,0,255);
  }
  g.putImageData(img,0,0);
  const map=new T.CanvasTexture(c);
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
  return new T.MeshStandardMaterial({map,roughness:.88,side:T.DoubleSide});
}

function kioskTexture(title,subtitle){
  const c=document.createElement('canvas');c.width=256;c.height=384;
  const g=c.getContext('2d');
  g.fillStyle='#3b7d8e';g.fillRect(0,0,256,384);
  g.strokeStyle='#275966';g.lineWidth=10;g.strokeRect(5,5,246,374);
  g.fillStyle='#eef5f6';g.textAlign='center';
  g.font='bold 24px "Microsoft YaHei",sans-serif';g.fillText(title,128,58);
  g.font='600 13px Arial';g.fillText(subtitle,128,80);
  // Stylized park lake map graphic
  g.fillStyle='#dce5e4';g.fillRect(30,104,196,178);
  g.fillStyle='#5c8f68';g.fillRect(36,110,184,166);
  g.fillStyle='#397ea8';g.beginPath();
  g.ellipse(128,195,62,48,-.2,0,Math.PI*2);g.fill();
  g.strokeStyle='#d6ecf5';g.lineWidth=3;
  g.beginPath();g.moveTo(155,148);g.lineTo(148,236);g.stroke();
  g.fillStyle='#e55342';g.beginPath();g.arc(112,155,6,0,Math.PI*2);g.fill();
  g.fillStyle='#ffffff';g.font='12px "Microsoft YaHei",sans-serif';
  g.fillText('文明旅游导览图',128,312);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
  return t;
}

function samplePath(pts,step=1.4,smooth=true){
  const vecs=pts.map(([x,z])=>new T.Vector3(x,0,z));
  const curve=smooth&&pts.length>=3?new T.CatmullRomCurve3(vecs,false,'centripetal',0.4):null;
  let total=0;
  if(curve){
    total=curve.getLength();
    const n=Math.max(8,Math.ceil(total/step));
    const out=[];
    for(let i=0;i<=n;i++){
      const u=i/n,p=curve.getPointAt(u),t=curve.getTangentAt(u);
      const l=Math.hypot(t.x,t.z)||1;
      out.push({x:p.x,z:p.z,dx:t.x/l,dz:t.z/l,nx:-t.z/l,nz:t.x/l,s:u*total,u});
    }
    return {pts:out,length:total};
  }
  const dists=[0];
  for(let i=1;i<pts.length;i++)dists.push(dists[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  total=dists.at(-1);
  const n=Math.max(8,Math.ceil(total/step));
  const out=[];
  for(let i=0;i<=n;i++){
    const s=total*i/n;
    let k=1;while(k<dists.length-1&&dists[k]<s)k++;
    const a=pts[k-1],b=pts[k],seg=dists[k]-dists[k-1]||1,t=clamp((s-dists[k-1])/seg,0,1);
    const dx=(b[0]-a[0])/seg,dz=(b[1]-a[1])/seg;
    out.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,dx,dz,nx:-dz,nz:dx,s,u:s/(total||1)});
  }
  return {pts:out,length:total};
}

function archHeight(s,length,peak,rampRun){
  const rise=peak-BASE_Y;
  if(rampRun<=0){
    const u=clamp(s/(length||1),0,1);
    return BASE_Y+rise*Math.pow(Math.sin(Math.PI*u),1.35);
  }
  const end=Math.min(s,length-s);
  const ramp=T.MathUtils.smoothstep(end,0,Math.min(rampRun,length*.45));
  const crown=0.86+0.14*Math.sin(Math.PI*clamp(s/(length||1),0,1));
  return BASE_Y+rise*ramp*crown;
}

function cityPointer(group,x,y,z,yaw,label,en,lat,lon){
  const rad=Math.PI/180,p=22.51*rad,q=lat*rad,d=(lon-113.95)*rad;
  const heading=Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d));
  const h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(d/2)**2;
  const km=Math.round(2*6371*Math.asin(Math.sqrt(h))/10)*10;
  const c=document.createElement('canvas');c.width=384;c.height=192;
  const g=c.getContext('2d');g.fillStyle='#ecece4';g.fillRect(0,0,384,192);g.fillStyle='#344849';
  g.font='bold 50px "Microsoft YaHei", sans-serif';g.fillText(label,14,62);g.font='29px Arial';g.fillText(en,15,108);
  g.font='25px Arial';g.fillText('≈ '+km.toLocaleString('en-US')+' km',15,151);
  g.save();g.translate(334,92);g.rotate(heading+yaw);
  g.beginPath();g.moveTo(0,-43);g.lineTo(16,7);g.lineTo(4,2);g.lineTo(4,37);g.lineTo(-4,37);g.lineTo(-4,2);g.lineTo(-16,7);g.closePath();g.fill();g.restore();
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
  const plate=new T.Mesh(new T.PlaneGeometry(.43,.21).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:t,roughness:.57}));
  plate.position.set(x,y,z);plate.rotation.y=yaw;plate.name='全球科创城市 · '+label;group.add(plate);
}
function buildPiDigits(root,samples,width,lights){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;
  const ctx=canvas.getContext('2d');ctx.font='bold 78px Arial';ctx.fillStyle='#ffffff';
  ctx.textAlign='center';ctx.textBaseline='middle';
  const glyphs='0123456789.';
  for(let i=0;i<glyphs.length;i++)ctx.fillText(glyphs[i],32+64*i,50);
  const tex=new T.CanvasTexture(canvas);tex.anisotropy=8;
  const mat=new T.MeshStandardMaterial({map:tex,color:0xd8ccb4,metalness:.55,roughness:.36,
    alphaTest:.32,emissive:0xffce8c,side:T.FrontSide});
  lights.finish(mat,.95);
  const digits=new Surface();
  const total=samples.at(-1).s;
  const count=Math.ceil(piDigits.length/4);
  const atS=s=>{
    const idx=clamp(Math.floor(s/total*(samples.length-1)),0,samples.length-2);
    const a=samples[idx],b=samples[idx+1],t=clamp((s-a.s)/((b.s-a.s)||1),0,1);
    return {
      x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
      dx:a.dx,dz:a.dz,nx:a.nx,nz:a.nz
    };
  };
  const step=(total-2.4)/count;
  for(const side of [-1,1]){
    for(let st=0;st<count;st++){
      const s=side<0?1.2+(st+.5)*step:total-1.2-(st+.5)*step;
      const p=atS(s);
      const off=side*(width*.5-.06);
      const cx=p.x+p.nx*off,cz=p.z+p.nz*off;
      const dir=side<0?1:-1;
      for(let row=0;row<2;row++){
        const index=(side>0?count*2:0)+row*count+st;
        if(index>=piDigits.length)continue;
        const gIdx=glyphs.indexOf(piDigits[index]);
        if(gIdx<0)continue;
        const u=(gIdx*64+.5)/768,v=((gIdx+1)*64-.5)/768;
        const y=p.y+0.26+(1-row)*0.34,hw=step*.46;
        // Order left->right along walking view on each rail so digits never appear mirrored
        const aX=cx-p.dx*dir*hw,aZ=cz-p.dz*dir*hw,bX=cx+p.dx*dir*hw,bZ=cz+p.dz*dir*hw;
        const corners=[[aX,y,aZ],[bX,y,bZ],[bX,y+.31,bZ],[aX,y+.31,aZ]];
        const uv=[[u,0],[v,0],[v,1],[u,1]];
        digits.quad(...corners,uv);
        digits.quad(corners[1],corners[0],corners[3],corners[2],uv);
      }
    }
  }
  digits.mesh(root,mat,'π桥 · 圆周率数字栏板');
}

export function parkBridges(root,map,m,grid){
  const group=new T.Group();group.name='人才公园 · 全景景观桥梁';root.add(group);
  const walkableSurfaces=[],railGrid=new Grid(12);
  let shuangquWestJoin=null,swBridgeSouthJoin=null,swBridgeNorthJoin=null;
  const addRail=(ax,az,bx,bz)=>{
    railGrid.add({a:[ax,az],b:[bx,bz]},[Math.min(ax,bx)-.3,Math.min(az,bz)-.3,Math.max(ax,bx)+.3,Math.max(az,bz)+.3]);
  };

  // Shared materials matching field photos (IMG_0205-0213, IMG_0365-0370, IMG_0272)
  const graniteMat=linearGraniteMat();
  const blueTrackMat=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x3b84be,roughness:.88,side:T.DoubleSide});
  const concreteLight=new T.MeshStandardMaterial({map:photo('concrete.webp'),color:0xc9cbc6,roughness:.88,side:T.DoubleSide});
  const plinthMat=new T.MeshStandardMaterial({color:0x58626b,roughness:.76,metalness:.18,side:T.DoubleSide});
  const darkMetal=new T.MeshStandardMaterial({color:0x343c41,metalness:.52,roughness:.44,side:T.DoubleSide});
  const woodCapMat=new T.MeshStandardMaterial({map:photo('bridge-deck-color.webp'),color:0x56392d,roughness:.48,side:T.DoubleSide});
  const whiteSteel=new T.MeshStandardMaterial({color:0xe8e9e4,metalness:.26,roughness:.36,side:T.DoubleSide});
  const stainless=new T.MeshStandardMaterial({color:0xb8bfc0,metalness:.66,roughness:.28,side:T.DoubleSide});
  const glassMat=new T.MeshPhysicalMaterial({color:0xa8c8c6,metalness:.12,roughness:.18,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide});
  const ledMat=m.parkLights.finish(new T.MeshStandardMaterial({color:0xffe9c2,emissive:0xffca7a}),2.2);

  const box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,10),cylFine=new T.CylinderGeometry(1,1,1,16);
  const darkBars=new Instances(cyl,darkMetal,'园桥 · 深色金属扶手与拉杆');
  const darkPosts=new Instances(box,darkMetal,'园桥 · 深色竖向金属栏栅');
  const woodCapSurf=new Surface();
  const darkPiers=new Instances(cylFine,darkMetal,'园桥 · 临水深色钢桥墩');
  const concPiers=new Instances(cylFine,concreteLight,'园桥 · 混凝土双柱桥墩');
  const whitePiers=new Instances(cylFine,whiteSteel,'智汇廊桥 · 白色钢柱');
  const steelRails=new Instances(cyl,stainless,'廊桥 · 不锈钢扶手与拉索');
  const steelPosts=new Instances(box,stainless,'廊桥 · 不锈钢立柱');
  const footLights=new Instances(new T.SphereGeometry(1,10,6),darkMetal,'桥面 · 嵌入式地灯罩');
  const ledStrips=new Instances(cyl,ledMat,'桥身 · 扶手下缘线性灯带');
  const whitePlaques=new Instances(box,whiteSteel,'智汇廊桥 · 全球科创城市方向标');

  const graniteSurf=new Surface(),blueSurf=new Surface(),lightDeckSurf=new Surface(),
        fasciaSurf=new Surface(),plinthSurf=new Surface(),whiteBoxSurf=new Surface(),glassSurf=new Surface();

  // Continuous smoothly-tilted 3D timber handrail ribbon (zero stair-stepping on sloped arches!)
  function addHandrailCap(ax,ay,az,bx,by,bz,w=.16,h=.062){
    const dx=bx-ax,dz=bz-az,hLen=Math.hypot(dx,dz);
    if(hLen<.01)return;
    const nx=-dz/hLen*w*.5,nz=dx/hLen*w*.5,hh=h*.5;
    const alT=[ax+nx,ay+hh,az+nz],arT=[ax-nx,ay+hh,az-nz],alB=[ax+nx,ay-hh,az+nz],arB=[ax-nx,ay-hh,az-nz];
    const blT=[bx+nx,by+hh,bz+nz],brT=[bx-nx,by+hh,bz-nz],blB=[bx+nx,by-hh,bz+nz],brB=[bx-nx,by-hh,bz-nz];
    const u=hLen/2.2;
    woodCapSurf.quad(alT,blT,brT,arT,[[0,0],[u,0],[u,.25],[0,.25]]);
    woodCapSurf.quad(alB,arB,brB,blB,[[0,0],[u,0],[u,.25],[0,.25]]);
    woodCapSurf.quad(alB,blB,blT,alT,[[0,0],[u,0],[u,.12],[0,.12]]);
    woodCapSurf.quad(arT,brT,brB,arB,[[0,0],[u,0],[u,.12],[0,.12]]);
  }

  function addLifebuoy(x,y,z,yaw){
    const ring=new T.Mesh(new T.TorusGeometry(.25,.052,10,32),new T.MeshStandardMaterial({color:0xc83e22,roughness:.75}));
    ring.name='园桥 · 救生圈';ring.position.set(x,y,z);ring.rotation.y=yaw;group.add(ring);
  }

  // =========================================================================
  // 1. 双曲桥 / 北渠观景桥 (DECK 1455360665 + ROAD 537568300) — IMG_0205~0213
  // =========================================================================
  const curveDeck=map.decks?.find(f=>f.id===1455360665);
  if(curveDeck){
    const sqWalk=new Surface();
    // North (channel) edge: smoothly aligned with both west & east approach paths
    const northCurve=new T.CatmullRomCurve3([
      new T.Vector3(54.2,0,-322.2),
      new T.Vector3(62.8,0,-318.8),
      new T.Vector3(79.5,0,-308.6),
      new T.Vector3(95.8,0,-297.8),
      new T.Vector3(102.0,0,-291.2)
    ],false,'centripetal',0.4);
    // South (main lake) flared edge
    const southCurve=new T.CatmullRomCurve3([
      new T.Vector3(50.2,0,-312.6),
      new T.Vector3(59.2,0,-308.9),
      new T.Vector3(64.5,0,-303.0),
      new T.Vector3(79.6,0,-292.6),
      new T.Vector3(86.9,0,-284.4),
      new T.Vector3(91.2,0,-278.4),
      new T.Vector3(96.4,0,-275.4)
    ],false,'centripetal',0.4);

    const NU=32;
    const rows=[];
    const eastJoin=grid?.flowerLandscape?.path?.eastJoin;
    for(let i=0;i<=NU;i++){
      const u=i/NU;
      const nPt=northCurve.getPointAt(u),sPt=southCurve.getPointAt(u);
      // Smooth low arch: flush 0.256m at BOTH ends, gently peaking at 1.42m over channel!
      const y=BASE_Y+1.16*Math.pow(Math.sin(Math.PI*u),1.4);
      const depth=0.18+0.26*Math.sin(Math.PI*u);
      const spanW=Math.hypot(sPt.x-nPt.x,sPt.z-nPt.z);
      const sx=(sPt.x-nPt.x)/spanW,sz=(sPt.z-nPt.z)/spanW;
      // Clean sweeping arc across the bridge: smoothly blends west d=2.7..4.8 to eastJoin with ZERO S-wave!
      let bStart=2.7,bEnd=4.8;
      if(eastJoin){
        const endN=northCurve.getPointAt(1),endS=southCurve.getPointAt(1);
        const eW=Math.hypot(endS.x-endN.x,endS.z-endN.z);
        const esx=(endS.x-endN.x)/eW,esz=(endS.z-endN.z)/eW;
        const projEnd=pt=>(pt[0]-endN.x)*esx+(pt[2]-endN.z)*esz;
        const eA=projEnd(eastJoin.blueRight),eB=projEnd(eastJoin.blueLeft);
        const targetStart=clamp(Math.min(eA,eB),2.0,eW-3.0);
        const targetEnd=clamp(Math.max(eA,eB),targetStart+1.95,eW-.6);
        const tB=u*u*(3-2*u);
        bStart=T.MathUtils.lerp(2.7,targetStart,tB);
        bEnd=T.MathUtils.lerp(4.8,targetEnd,tB);
      }
      const ptAt=d=>[nPt.x+sx*d,y,nPt.z+sz*d];
      rows.push({u,y,depth,n:ptAt(0),b0:ptAt(bStart),b1:ptAt(bEnd),s:ptAt(spanW),spanW,bEnd,sx,sz});
    }
    // Snap exact east blue vertices to eastJoin for a 0mm mathematical weld!
    if(eastJoin){
      const R=rows.at(-1);
      const dR=(eastJoin.blueRight[0]-R.n[0])*R.sx+(eastJoin.blueRight[2]-R.n[2])*R.sz;
      const dL=(eastJoin.blueLeft[0]-R.n[0])*R.sx+(eastJoin.blueLeft[2]-R.n[2])*R.sz;
      R.b0=dR<dL?[...eastJoin.blueRight]:[...eastJoin.blueLeft];
      R.b1=dR<dL?[...eastJoin.blueLeft]:[...eastJoin.blueRight];
      R.b0[1]=BASE_Y;R.b1[1]=BASE_Y;
    }
    const wDirX=rows[1].b0[0]-rows[0].b0[0],wDirZ=rows[1].b0[2]-rows[0].b0[2];
    const wDirL=Math.hypot(wDirX,wDirZ)||1;
    shuangquWestJoin={
      blueNorth:rows[0].b0,blueSouth:rows[0].b1,north:rows[0].n,south:rows[0].s,
      dir:[wDirX/wDirL,wDirZ/wDirL]
    };

    for(let i=1;i<rows.length;i++){
      const A=rows[i-1],B=rows[i];
      const u0=A.u*18,u1=B.u*18;
      // 1. North granite walkway strip
      graniteSurf.quad(A.n,B.n,B.b0,A.b0,[[0,u0],[0,u1],[1.1,u1],[1.1,u0]]);
      // 2. Blue jogging track (slightly proud by 0.008m for crisp edge)
      const lift=(p,dy)=>[p[0],p[1]+dy,p[2]];
      blueSurf.quad(lift(A.b0,.008),lift(B.b0,.008),lift(B.b1,.008),lift(A.b1,.008),[[0,u0],[0,u1],[.8,u1],[.8,u0]]);
      // 3. South viewing terrace
      graniteSurf.quad(A.b1,B.b1,B.s,A.s,[[0,u0],[0,u1],[(B.spanW-B.bEnd)/2.4,u1],[(A.spanW-A.bEnd)/2.4,u0]]);
      // Walkable collision quad covering full width
      sqWalk.quad(A.n,B.n,B.s,A.s);

      // Fascia + solid soffit + grounded end aprons
      const anBot=lift(A.n,-A.depth),bnBot=lift(B.n,-B.depth);
      const asBot=lift(A.s,-A.depth),bsBot=lift(B.s,-B.depth);
      fasciaSurf.quad(anBot,A.n,B.n,bnBot);
      fasciaSurf.quad(A.s,asBot,bsBot,B.s);
      fasciaSurf.quad(anBot,bnBot,bsBot,asBot);

      // Grounded stone abutments at first & last 4 slices so deck never floats over banks
      if(i<=4||i>=rows.length-4){
        const groundY=-.35;
        fasciaSurf.quad([A.n[0],groundY,A.n[2]],anBot,bnBot,[B.n[0],groundY,B.n[2]]);
        fasciaSurf.quad(asBot,[A.s[0],groundY,A.s[2]],[B.s[0],groundY,B.s[2]],bsBot);
      }

      // Railings ONLY along the bridge span (i from 3..NU-2), leaving both promenade approaches wide open!
      if(i>=3&&i<=NU-2){
        // NORTH EDGE (IMG_0207, IMG_0211, IMG_0212):
        // Solid inclined dark blue-grey curb plinth (0.44m tall) + curved stanchions + 2 bars + wood handrail
        const plA=lift(A.n,.44),plB=lift(B.n,.44);
        const plInA=[A.n[0]+A.sx*.22,A.y+.44,A.n[2]+A.sz*.22];
        const plInB=[B.n[0]+B.sx*.22,B.y+.44,B.n[2]+B.sz*.22];
        const flInA=[A.n[0]+A.sx*.28,A.y,A.n[2]+A.sz*.28];
        const flInB=[B.n[0]+B.sx*.28,B.y,B.n[2]+B.sz*.28];
        plinthSurf.quad(A.n,plA,plB,B.n);
        plinthSurf.quad(plA,plInA,plInB,plB);
        plinthSurf.quad(plInA,flInA,flInB,plInB);

        const nrA=[A.n[0]+A.sx*.11,A.y,A.n[2]+A.sz*.11];
        const nrB=[B.n[0]+B.sx*.11,B.y,B.n[2]+B.sz*.11];
        for(const h of [.66,.88]){
          darkBars.between(nrA[0],nrA[1]+h,nrA[2],nrB[0],nrB[1]+h,nrB[2],.016);
        }
        addHandrailCap(nrA[0],nrA[1]+1.08,nrA[2],nrB[0],nrB[1]+1.08,nrB[2],.18,.065);
        // Curved stanchion post every segment
        const outX=-A.sx*.10,outZ=-A.sz*.10;
        darkBars.between(nrA[0],nrA[1]+.43,nrA[2],nrA[0]+outX,nrA[1]+.76,nrA[2]+outZ,.026);
        darkBars.between(nrA[0]+outX,nrA[1]+.76,nrA[2]+outZ,nrA[0],nrA[1]+1.06,nrA[2],.026);
        addRail(nrA[0],nrA[2],nrB[0],nrB[2]);

        // SOUTH EDGE (IMG_0205, IMG_0206, IMG_0213):
        // Dense vertical dark metal pickets + top/bottom bars + flat wood handrail cap
        const srA=[A.s[0]-A.sx*.10,A.y,A.s[2]-A.sz*.10];
        const srB=[B.s[0]-B.sx*.10,B.y,B.s[2]-B.sz*.10];
        const segLen=Math.hypot(srB[0]-srA[0],srB[2]-srA[2]);
        const yaw=Math.atan2(srB[0]-srA[0],srB[2]-srA[2]);
        darkBars.between(srA[0],srA[1]+.10,srA[2],srB[0],srB[1]+.10,srB[2],.022);
        darkBars.between(srA[0],srA[1]+1.04,srA[2],srB[0],srB[1]+1.04,srB[2],.022);
        addHandrailCap(srA[0],srA[1]+1.09,srA[2],srB[0],srB[1]+1.09,srB[2],.18,.062);
        const pickets=Math.max(2,Math.round(segLen/.16));
        for(let k=0;k<pickets;k++){
          const t=k/pickets;
          const px=srA[0]+(srB[0]-srA[0])*t,py=srA[1]+(srB[1]-srA[1])*t,pz=srA[2]+(srB[2]-srA[2])*t;
          darkPosts.at(px,py+.57,pz,.024,.94,.024,yaw);
        }
        if(i%2===0)darkPosts.at(srA[0],srA[1]+.55,srA[2],.065,1.06,.065,yaw);
        addRail(srA[0],srA[2],srB[0],srB[2]);
      }
    }
    // End abutment face closures
    for(const R of [rows[0],rows.at(-1)]){
      fasciaSurf.quad([R.n[0],-.35,R.n[2]],R.n,R.s,[R.s[0],-.35,R.s[2]]);
    }
    // Piers in the water channel beneath midspan
    for(const idx of [11,21]){
      const R=rows[idx];
      for(const frac of [.22,.56,.85]){
        const px=R.n[0]+R.sx*R.spanW*frac,pz=R.n[2]+R.sz*R.spanW*frac;
        const top=R.y-R.depth+.02,bot=-1.6;
        concPiers.at(px,(top+bot)*.5,pz,.34,top-bot,.34);
      }
    }
    // Lifebuoy on south lake rail (IMG_0213)
    const midS=rows[16];
    addLifebuoy(midS.s[0]-midS.sx*.18,midS.y+.65,midS.s[2]-midS.sz*.18,Math.atan2(midS.sx,midS.sz));

    // Two teal leaf-shaped park map kiosks at West approach (IMG_0205 right)
    const kioskMat1=new T.MeshStandardMaterial({map:kioskTexture('深圳人才公园','SHENZHEN TALENT PARK'),roughness:.55});
    const kioskMat2=new T.MeshStandardMaterial({map:kioskTexture('文明旅游导览','PARK GUIDE MAP'),roughness:.55});
    for(const [kx,kz,rot,mat] of [[56.2,-309.8,2.25,kioskMat1],[54.5,-310.7,2.35,kioskMat2]]){
      const panel=new T.Mesh(new T.BoxGeometry(.95,1.82,.09),mat);
      panel.name='双曲桥西端 · 蓝绿叶形导览牌';
      panel.position.set(kx,BASE_Y+.95,kz);panel.rotation.y=rot;panel.castShadow=true;panel.receiveShadow=true;
      group.add(panel);
    }
    walkableSurfaces.push(sqWalk);
  }

  // =========================================================================
  // 2. ALL OTHER PARK & BAY FOOTWAY/CYCLEWAY BRIDGES
  // =========================================================================
  const specs=new Map([
    // π桥: low graceful arc over south lake, flush ends, diagonal steel truss + 2017 digits (IMG_0365~0370)
    [570468707,{style:'pi',width:2.75,peak:1.18,ramp:14,pierStep:6.8,depth:.22,smooth:true}],
    // π桥东侧石板桥: flush stone-tiled bridge, dense dark vertical fins + wood handrail + dome footlights (IMG_0365~0368)
    [571169638,{style:'picket',width:3.45,peak:0.88,ramp:0,pierStep:6.5,depth:.24,smooth:true,footLights:true}],
    // 西岸两座亲水小桥: flush low stone bridges, zero floating ramps
    [808097526,{style:'picket',width:3.0,peak:0.74,ramp:0,pierStep:5.5,depth:.22,smooth:true}],
    [832163846,{style:'picket',width:3.0,peak:0.65,ramp:0,pierStep:5.0,depth:.20,smooth:false}],
    // 西南角外桥（承载环湖蓝色慢跑道）与内桥: smooth low-arched park bridges across SW canal
    [537564665,{style:'picket',width:4.4,peak:1.30,ramp:0,pierStep:9.5,depth:.28,smooth:true,blueSide:1}],
    [562534117,{style:'picket',width:3.2,peak:1.34,ramp:0,pierStep:9.5,depth:.28,smooth:true}],
    // 未来智汇廊桥: white modern circular loop skybridge rising smoothly from ground grade to 3.15m crest
    [1415882807,{style:'zhihui',width:3.3,peak:3.15,ramp:0,pierStep:9.0,depth:.34,smooth:true}],
    // 深圳湾东岸绿道双桥: curved bay bridges with rhythmic paired piers (IMG_0272 background!)
    [259033235,{style:'baycycle',width:4.2,peak:2.05,ramp:18,pierStep:13.5,depth:.40,smooth:true}],
    [571629067,{style:'baycycle',width:4.0,peak:1.90,ramp:16,pierStep:12.5,depth:.38,smooth:true}]
  ]);

  for(const road of map.roads){
    const spec=specs.get(road.id);
    if(!spec)continue;
    const {pts,length}=samplePath(road.p,spec.style==='pi'?1.35:1.5,spec.smooth);
    for(const pt of pts)pt.y=archHeight(pt.s,length,spec.peak,spec.ramp);
    const hw=spec.width*.5;
    const walkSurf=new Surface();

    const deckTarget=spec.style==='picket'?graniteSurf:lightDeckSurf;
    const boxTarget=spec.style==='zhihui'?whiteBoxSurf:fasciaSurf;

    for(let i=1;i<pts.length;i++){
      const A=pts[i-1],B=pts[i];
      const segLen=Math.hypot(B.x-A.x,B.z-A.z);
      const yaw=Math.atan2(B.x-A.x,B.z-A.z);
      const AL=[A.x+A.nx*hw,A.y,A.z+A.nz*hw],AR=[A.x-A.nx*hw,A.y,A.z-A.nz*hw];
      const BL=[B.x+B.nx*hw,B.y,B.z+B.nz*hw],BR=[B.x-B.nx*hw,B.y,B.z-B.nz*hw];
      const uv=[[0,A.s/2.4],[0,B.s/2.4],[spec.width/2.4,B.s/2.4],[spec.width/2.4,A.s/2.4]];
      deckTarget.quad(AL,BL,BR,AR,uv);
      walkSurf.quad(AL,BL,BR,AR);
      // Continuous lakeside blue jogging lane across Southwest Loop Bridge (537564665)
      if(spec.blueSide){
        const bOuter=hw-.16,bInner=hw-2.26;
        const bA0=[A.x+A.nx*spec.blueSide*bOuter,A.y+.009,A.z+A.nz*spec.blueSide*bOuter];
        const bA1=[A.x+A.nx*spec.blueSide*bInner,A.y+.009,A.z+A.nz*spec.blueSide*bInner];
        const bB0=[B.x+B.nx*spec.blueSide*bOuter,B.y+.009,B.z+B.nz*spec.blueSide*bOuter];
        const bB1=[B.x+B.nx*spec.blueSide*bInner,B.y+.009,B.z+B.nz*spec.blueSide*bInner];
        blueSurf.quad(bA0,bB0,bB1,bA1,[[0,A.s/3],[0,B.s/3],[.7,B.s/3],[.7,A.s/3]]);
      }

      const dA=spec.depth*(.55+.45*Math.sin(Math.PI*A.u)),dB=spec.depth*(.55+.45*Math.sin(Math.PI*B.u));
      const ALb=[AL[0],AL[1]-dA,AL[2]],ARb=[AR[0],AR[1]-dA,AR[2]];
      const BLb=[BL[0],BL[1]-dB,BL[2]],BRb=[BR[0],BR[1]-dB,BR[2]];
      boxTarget.quad(ALb,AL,BL,BLb);
      boxTarget.quad(AR,ARb,BRb,BR);
      boxTarget.quad(ALb,BLb,BRb,ARb);

      // Grounded bank abutments near both ends
      if(A.s<3.5||length-B.s<3.5){
        const gY=-.35;
        boxTarget.quad([AL[0],gY,AL[2]],ALb,BLb,[BL[0],gY,BL[2]]);
        boxTarget.quad(ARb,[AR[0],gY,AR[2]],[BR[0],gY,BR[2]],BRb);
      }

      // Railings on both sides
      for(const side of [-1,1]){
        const off=side*(hw-.09);
        const ax=A.x+A.nx*off,ay=A.y,az=A.z+A.nz*off;
        const bx=B.x+B.nx*off,by=B.y,bz=B.z+B.nz*off;
        addRail(ax,az,bx,bz);

        if(spec.style==='pi'){
          // Open diagonal V-truss dark steel frame + horizontal bars + wood/metal top handrail (IMG_0365~0370)
          darkBars.between(ax,ay+.12,az,bx,by+.12,bz,.018);
          darkBars.between(ax,ay+.56,az,bx,by+.56,bz,.014);
          darkBars.between(ax,ay+1.04,az,bx,by+1.04,bz,.026);
          addHandrailCap(ax,ay+1.08,az,bx,by+1.08,bz,.11,.045);
          ledStrips.between(ax,ay+1.01,az,bx,by+1.01,bz,.014);
          if(i%2===1){
            darkBars.between(ax,ay+.04,az,ax,ay+1.06,az,.024);
            // Diagonal V-brace across panel
            const mx=(ax+bx)*.5,my=(ay+by)*.5,mz=(az+bz)*.5;
            darkBars.between(ax,ay+.12,az,mx,my+1.02,mz,.015);
            darkBars.between(mx,my+1.02,mz,bx,by+.12,bz,.015);
          }
        }else if(spec.style==='picket'){
          // Dense dark blue-grey vertical fins + dark steel top/bottom rails + wide dark-brown wood handrail (IMG_0365, IMG_0367)
          darkBars.between(ax,ay+.08,az,bx,by+.08,bz,.02);
          darkBars.between(ax,ay+1.01,az,bx,by+1.01,bz,.02);
          addHandrailCap(ax,ay+1.06,az,bx,by+1.06,bz,.16,.058);
          const count=Math.max(2,Math.round(segLen/.13));
          for(let k=0;k<count;k++){
            const t=k/count;
            darkPosts.at(ax+(bx-ax)*t,ay+(by-ay)*t+.54,az+(bz-az)*t,.022,.92,.028,yaw);
          }
          if(i%2===0)darkPosts.at(ax,ay+.54,az,.056,1.02,.056,yaw);
          // Dome recessed deck foot-lights along both inner edges (IMG_0367)
          if(spec.footLights&&i%3===1){
            const fx=A.x+A.nx*side*(hw-.24),fz=A.z+A.nz*side*(hw-.24);
            footLights.at(fx,A.y+.035,fz,.07,.045,.07);
            m.parkLights.fixture(fx,A.y+.12,fz,0xffd79e,6,5);
          }
        }else if(spec.style==='zhihui'){
          // Sleek stainless + glass + warm LED strip + innovation-city markers
          steelRails.between(ax,ay+1.10,az,bx,by+1.10,bz,.036);
          for(const h of [.32,.62,.90])steelRails.between(ax,ay+h,az,bx,by+h,bz,.011);
          ledStrips.between(ax,ay+1.04,az,bx,by+1.04,bz,.018);
          glassSurf.quad([ax,ay+.14,az],[bx,by+.14,bz],[bx,by+1.02,bz],[ax,ay+1.02,az]);
          if(i%2===0)steelPosts.at(ax,ay+.56,az,.048,1.10,.056,yaw);
          if(side===1&&i%6===3){
            const boston=3+6*Math.max(1,Math.floor((pts.length-4)/12));
            const city=i===3?['硅谷','Silicon Valley',37.39,-122.08]:i===boston?['波士顿','Boston',42.36,-71.06]:null;
            whitePlaques.at(ax,ay+1.15,az,city?.45:.18,.04,city?.23:.34,yaw);
            if(city)cityPointer(group,ax,ay+1.172,az,yaw,...city);
            m.parkLights.fixture(ax,ay+1.02,az,0xffe0b0,12,8);
          }
        }else if(spec.style==='baycycle'){
          // Clean seaside galvanized horizontal rail (IMG_0272 background)
          steelRails.between(ax,ay+1.12,az,bx,by+1.12,bz,.038);
          for(const h of [.28,.56,.84])steelRails.between(ax,ay+h,az,bx,by+h,bz,.016);
          if(i%2===0)steelPosts.at(ax,ay+.56,az,.062,1.12,.062,yaw);
        }
      }
    }

    // Piers beneath the bridge span
    let nextPier=spec.pierStep*.65;
    for(const pt of pts){
      if(pt.s<nextPier||pt.s>length-spec.pierStep*.45)continue;
      nextPier+=spec.pierStep;
      const top=pt.y-spec.depth*.85,bot=-1.65;
      if(top<=0.12)continue;
      if(spec.style==='pi'){
        // Paired slender dark cylindrical steel columns + cross-beam (IMG_0365, IMG_0368, IMG_0369)
        for(const s of [-1,1]){
          const px=pt.x+pt.nx*s*(hw-.32),pz=pt.z+pt.nz*s*(hw-.32);
          darkPiers.at(px,(top+bot)*.5,pz,.13,top-bot,.13);
        }
        darkPosts.at(pt.x,top-.06,pt.z,spec.width-.3,.14,.18,Math.atan2(pt.dx,pt.dz));
      }else if(spec.style==='zhihui'){
        if(pt.y>0.75){
          whitePiers.at(pt.x,(top+bot)*.5,pt.z,.22,top-bot,.22);
        }
      }else if(spec.style==='baycycle'){
        // Rhythmic paired concrete piers matching IMG_0272 background behind Houhai Bridge
        for(const s of [-1,1]){
          const px=pt.x+pt.nx*s*(hw-.65),pz=pt.z+pt.nz*s*(hw-.65);
          concPiers.at(px,(top+bot)*.5,pz,.28,top-bot,.28);
        }
        darkPosts.at(pt.x,top-.10,pt.z,spec.width-.4,.22,.36,Math.atan2(pt.dx,pt.dz));
      }else{
        for(const s of [-1,1]){
          const px=pt.x+pt.nx*s*(hw-.42),pz=pt.z+pt.nz*s*(hw-.42);
          darkPiers.at(px,(top+bot)*.5,pz,.14,top-bot,.14);
        }
      }
    }

    if(spec.style==='pi'){
      buildPiDigits(group,pts,spec.width,m.parkLights);
      const mid=pts[Math.floor(pts.length*.5)];
      addLifebuoy(mid.x+mid.nx*(hw-.16),mid.y+.62,mid.z+mid.nz*(hw-.16),Math.atan2(mid.nx,mid.nz));
      for(let i=0;i<pts.length;i+=7){
        const pt=pts[i];
        m.parkLights.fixture(pt.x,pt.y+1.02,pt.z,0xffd5a4,8,7);
      }
    }
    if(road.id===537564665){
      const p0=pts[0],p1=pts.at(-1),bMid=hw-1.21;
      swBridgeSouthJoin=[p0.x+p0.nx*bMid,p0.z+p0.nz*bMid];
      swBridgeNorthJoin=[p1.x+p1.nx*bMid,p1.z+p1.nz*bMid];
    }
    walkableSurfaces.push(walkSurf);
  }

  graniteSurf.mesh(group,graniteMat,'园桥 · 灰色条石桥面',true);
  blueSurf.mesh(group,blueTrackMat,'双曲桥 · 环湖蓝色慢跑道');
  lightDeckSurf.mesh(group,concreteLight,'园桥 · 浅灰防滑桥面',true);
  fasciaSurf.mesh(group,concreteLight,'园桥 · 弧形梁侧与桥台',true);
  plinthSurf.mesh(group,plinthMat,'双曲桥 · 北侧斜坡蓝灰矮墙',true);
  whiteBoxSurf.mesh(group,whiteSteel,'智汇廊桥 · 白色流线箱梁',true);
  glassSurf.mesh(group,glassMat,'智汇廊桥 · 透明玻璃栏板');
  woodCapSurf.mesh(group,woodCapMat,'园桥 · 连续平顺实木扶手面盖',true);

  for(const b of [darkBars,darkPosts,darkPiers,concPiers,whitePiers,steelRails,steelPosts,footLights,ledStrips,whitePlaques]){
    b.flush(group,[darkPiers,concPiers,whitePiers].includes(b));
  }

  const heightAt=groundIndex(walkableSurfaces);
  const onRail=(x,z)=>railGrid.query(x,z).some(({a,b})=>segmentDistance(x,z,a,b)<.15);
  return {
    heightAt,
    onRail,
    shuangquWestJoin,
    swBridgeSouthJoin,
    swBridgeNorthJoin,
    dispose(){graniteMat.map?.dispose();graniteMat.dispose();}
  };
}
