import * as T from 'three';
import {Surface,bounds,sideWall,Instances,inRing,random,clamp} from './city-geometry.js';
import {photo} from './city-materials.js';
import {architecturalMetal} from './city-curtainwall.js';

// Shenzhen Bay Culture Square (深圳湾文化广场) — reconstructed from MAD's
// completed plan and on-site photography (IMG_0159, IMG_0165, IMG_0226,
// IMG_0230, IMG_0278, IMG_0385).
export const cultureIDs=[1441599159,1441599154,1441599155,1441599156,1441599157,1441599158];
const tau=Math.PI*2;

function granite(verticalSeams=false){
  const normals=photo('museum-granite-normal.webp'),rough=photo('museum-granite-rough.webp');
  normals.colorSpace=rough.colorSpace=T.NoColorSpace;
  const mat=new T.MeshPhysicalMaterial({
    map:photo('museum-granite-color.webp'),color:0xf3f2ec,
    normalMap:normals,normalScale:new T.Vector2(.14,.14),
    roughnessMap:rough,roughness:.64,metalness:.02,clearcoat:.16,clearcoatRoughness:.40,side:T.DoubleSide
  });
  mat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 strips=vMapUv/vec2(.28,1.25);
      strips.y+=mod(floor(strips.x),3.)*.3333;
      vec2 cell=fract(strips),width=fwidth(strips);
      vec2 margin=min(cell,1.-cell);
      vec2 joint=1.-smoothstep(vec2(.012,.003),vec2(.012,.003)+max(width,.0001),margin);
      float reveal=max(joint.x*(1.-smoothstep(.08,.45,width.x)),joint.y*(1.-smoothstep(.08,.45,width.y)));
      float shade=fract(sin(dot(floor(strips),vec2(47.1,19.2)))*33134.7);
      ${verticalSeams?`
      // Bold sweeping architectural vertical contour seams on the North Tall Egg (IMG_0230)
      float archU=fract(vMapUv.x/28.5);
      float archLine=1.-smoothstep(.004,.012,min(archU,1.-archU));
      diffuseColor.rgb*=(1.-.26*archLine);`:''}
      diffuseColor.rgb*=(1.-.28*reveal)*mix(.97,1.025,shade);`);
  };
  return mat;
}

function squareSignTex(){
  const c=document.createElement('canvas');c.width=1536;c.height=160;
  const g=c.getContext('2d');
  g.clearRect(0,0,c.width,c.height);
  g.fillStyle='#2a2f32';
  g.textBaseline='middle';
  g.font='600 62px "Microsoft YaHei","PingFang SC",sans-serif';
  g.fillText('深圳湾文化广场',36,82);
  g.font='500 44px "Times New Roman",Georgia,serif';
  g.fillText('SHENZHEN  BAY  CULTURE  SQUARE',515,84);
  const tex=new T.CanvasTexture(c);
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  return tex;
}

function lightGraniteMat(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d'),rng=random(144159);
  g.fillStyle='#bfc2be';g.fillRect(0,0,512,512);
  const tones=['#d2d4cf','#caccc8','#dcdcd6','#c3c6c2','#d6d7d2'];
  const cols=16,cw=512/cols;
  for(let col=0;col<cols;col++){
    let y=-(rng()*64);
    while(y<512){
      const h=64+Math.floor(rng()*64);
      g.fillStyle=tones[Math.floor(rng()*tones.length)];
      g.fillRect(col*cw+1,y+1,cw-2,h-2);
      y+=h;
    }
  }
  const tex=new T.CanvasTexture(c);
  tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=8;
  return new T.MeshStandardMaterial({map:tex,roughness:.84,side:T.DoubleSide});
}

function concreteShellMat(){
  return new T.MeshStandardMaterial({color:0xc9cbc6,roughness:.72,metalness:.06,side:T.DoubleSide});
}

export function cultureSquare(root,m,map,grid){
  const city=new Map(map.buildings.filter(f=>cultureIDs.includes(f.id)).map(f=>[f.id,f]));
  if(!city.has(1441599159))return;
  const grp=new T.Group();grp.name='深圳湾文化广场 · 南北馆与绿坡公园';root.add(grp);

  const stone=granite(false);
  const eggStone=granite(true);
  const glaze=architecturalMetal(0x283e45,.16);
  const seal=new T.MeshStandardMaterial({color:0x444e50,roughness:.48,side:T.DoubleSide});
  const concrete=concreteShellMat();
  const courtyardStone=lightGraniteMat();
  const darkRecess=new T.MeshStandardMaterial({color:0x1e2528,roughness:.72,side:T.DoubleSide});
  const glassRailMat=new T.MeshPhysicalMaterial({color:0x9eb4ba,roughness:.14,metalness:.1,transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide});
  glaze.userData.showFacade=[1,.92,38];
  stone.userData.showFacade=[1,.34,38];
  eggStone.userData.showFacade=[1,.34,38];

  const windows=new Surface(),jambs=new Surface(),grounds=new Surface(),grass=new Surface();
  const concreteSurf=new Surface(),glassRails=new Surface(),darkSurf=new Surface();
  const skylights=new Surface(),ribs=new Instances(new T.CylinderGeometry(1,1,1,7),seal,'展厅天窗弧形压条');
  const railPosts=new Instances(new T.CylinderGeometry(1,1,1,8),seal,'广场玻璃护栏立柱');
  const hillTone=new T.Color(0xcbd8a8);

  function center(id){
    const b=bounds(city.get(id).p);return [(b[0]+b[2])*.5,(b[1]+b[3])*.5];
  }
  const South=center(1441599154),North=center(1441599156),Library=center(1441599155),Studio=center(1441599157),Garden=center(1441599158);

  // =========================================================================
  // 1. Sculpted light-granite river-stone exhibition halls
  //    Calibrated 1:1 to IMG_0278 (wide lakefront) & IMG_0230 (North Egg closeup)
  // =========================================================================
  const volumes=[
    // South main grounded sweeping boulder (IMG_0278 left & IMG_0226: plump rounded south body, smooth sloping north tail into hillside)
    {c:South,delta:[6,-6],r:[24.5,40.0],h:18.6,y:.6,rot:-.10,tilt:0,lean:[-1.0,2.5],style:1,
      slot:{v0:.22,v1:.29,az:0.15,span:.35},eye:[.22,.72,.26,.085],taperNorth:true},
    // Perched flat oval cap stone resting visibly on the high south shoulder (IMG_0278 left!)
    {c:South,delta:[-2,26],r:[13.8,11.0],h:6.6,y:17.2,rot:-.18,tilt:.02,lean:[.4,.2],style:3},
    // Lower south-west companion stone nestled into the hillside
    {c:South,delta:[-16,-6],r:[17.5,14.5],h:9.6,y:.6,rot:.22,tilt:-.04,lean:[1.0,0],style:2},
    // Far-south garden pebble behind Sail Tower (IMG_0278 far left)
    {c:Garden,delta:[0,0],r:[17.2,14.4],h:9.4,y:.6,rot:.36,tilt:.06,lean:[.4,-.8],style:2,
      slot:{v0:.30,v1:.38,az:.25,span:.32}},
    // Iconic North Tall Egg (IMG_0230 closeup: sleek tapered egg dome, visible pill ribbon window, oval skylight on east nose)
    {c:North,delta:[3.8,-3.5],r:[22.4,20.8],h:44.5,y:.6,rot:-.14,tilt:0,lean:[-4.2,1.6],style:0,
      egg:true,slot:{v0:.155,v1:.222,az:.08,span:-.05},eye:[.18,.785,.50,.095]},
    // North oblique leaning stone emerging cleanly from the green slope & tucking into the Tall Egg's south flank (IMG_0230 & IMG_0278)
    {c:Studio,delta:[2.5,-4.0],r:[10.8,26.5],h:12.6,y:.8,rot:-.12,tilt:-.32,lean:[1.0,-8.0],style:2},
    // North-east low pebble behind Talent Station (IMG_0230 far right)
    {c:Library,delta:[0,0],r:[18.4,13.6],h:9.8,y:.6,rot:.44,tilt:-.10,lean:[-1.0,.5],style:3,
      eye:[.52,.78,.30,.060]}
  ];

  const stoneFootprints=[];
  for(const shell of volumes){
    const [x,z]=[shell.c[0]+shell.delta[0],shell.c[1]+shell.delta[1]];
    stoneFootprints.push({x,z,rx:shell.r[0]+5.5,rz:shell.r[1]+5.5});
    const cs=Math.cos(shell.rot),sn=Math.sin(shell.rot),[rx,rz]=shell.r;

    function point(a,v,push=0){
      const phi=(v-.5)*Math.PI,hf=(Math.sin(phi)+1)*.5,ca=Math.cos(a),sa=Math.sin(a),raw=Math.max(0,Math.cos(phi));
      // Grounded smooth egg profile (IMG_0230): sturdy grounded belly tapering cleanly to a refined egg crown
      const band=shell.egg
        ? (v<.18 ? (.88+.12*Math.sin(v/.18*Math.PI*.5)) : Math.pow(Math.cos((v-.14)/.86*Math.PI*.5),.74))
        : (shell.taperNorth ? (v<.18 ? (.86+.14*Math.sin(v/.18*Math.PI*.5)) : Math.pow(raw,.72)) : Math.pow(raw,.76));
      const warp=1+.042*Math.cos(3*a+.62*shell.style)+.032*Math.sin(2*a+v*1.7);
      const ex=rx*band*ca*warp+shell.lean[0]*(hf-.35)+ca*push;
      const ez=rz*band*sa*(1+.040*Math.sin(3*a+2.0*hf))+shell.lean[1]*(hf-.35)+sa*push;
      let y=shell.y+shell.h*hf+shell.tilt*rz*sa*band+shell.h*.03*band*Math.sin(a+.56*shell.style);
      // Taper ONLY the upper/north slope of the south boulder down into the hillside while keeping the south belly firmly grounded!
      if(shell.taperNorth){
        const northFrac=clamp((-sa*band+0.35)/1.35,0,1);
        const topFactor=clamp(hf*1.2,0,1);
        y=T.MathUtils.lerp(y,shell.y+1.4+shell.h*.16*hf,northFrac*northFrac*topFactor*.78);
      }
      return [x+ex*cs+ez*sn,Math.max(.45,y),z-ex*sn+ez*cs];
    }

    const N=84,V=48,pos=[],uv=[],idx=[];
    for(let j=0;j<=V;j++)for(let i=0;i<=N;i++){
      const a=i*tau/N,p=point(a,j/V);pos.push(...p);
      uv.push(i/N*tau*(rx+rz)*.5,j/V*shell.h*1.44);
    }
    for(let j=0;j<V;j++)for(let i=0;i<N;i++){
      const k=j*(N+1)+i,a=(i+.5)*tau/N,v=(j+.5)/V;
      if(shell.slot&&v>shell.slot.v0&&v<shell.slot.v1&&Math.cos(a-shell.slot.az)>shell.slot.span){
        const a0=i*tau/N,a1=(i+1)*tau/N,v0=j/V,v1=(j+1)/V;
        const pp=[point(a0,v0,-.45),point(a1,v0,-.45),point(a1,v1,-.45),point(a0,v1,-.45)];
        windows.quad(...pp);
        // Vertical slim dark mullions inside the recessed ribbon window (IMG_0230)
        if(i%3===0)ribs.between(...pp[0],...pp[3],.06);
        if((j-1)/V<=shell.slot.v0)jambs.quad(point(a0,v0),point(a1,v0),pp[1],pp[0]);
        if((j+2)/V>=shell.slot.v1)jambs.quad(point(a0,v1),point(a1,v1),pp[2],pp[3]);
        continue;
      }
      idx.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    g.setIndex(idx);g.computeVertexNormals();
    const volume=new T.Mesh(g,shell.egg?eggStone:stone);
    volume.castShadow=true;volume.receiveShadow=true;volume.name='深圳湾文化广场 · 原石展厅';grp.add(volume);

    if(shell.eye){
      const [az,v,aw,vw]=shell.eye;
      const eye=(u,w,lift)=>point(az+u*aw,v+w*vw,lift);
      for(let i=0;i<52;i++){
        const u=i*tau/52,t=(i+1)*tau/52,fn=(p,r,lift)=>point(az+Math.cos(p)*aw*r,v+Math.sin(p)*vw*r,lift);
        jambs.quad(fn(u,1,.10),fn(t,1,.10),fn(t,.91,.14),fn(u,.91,.14));
        for(let k=0;k<8;k++){
          const r=.91*k/8,next=.91*(k+1)/8;
          skylights.quad(fn(u,r,.18),fn(t,r,.18),fn(t,next,.18),fn(u,next,.18));
        }
      }
      for(const vertical of [true,false])for(let i=-3;i<=3;i++){
        const offset=i*.23,extent=Math.sqrt(Math.max(0,.91**2-offset**2));
        const at=t=>vertical?eye(offset,t,.24):eye(t,offset,.24);
        for(let j=0;j<12;j++)ribs.between(...at(-extent+2*extent*j/12),...at(-extent+2*extent*(j+1)/12),.082);
      }
    }
  }

  // =========================================================================
  // 2. Sculpted Green-Roof Hillside Park & Clean Light-Granite Courtyards
  // =========================================================================
  const compound=city.get(1441599159),p=compound.p,b=bounds(p),cx=(b[0]+b[2])*.5,cz=(b[1]+b[3])*.5;
  const upper=p.map(([x,z])=>[cx+(x-cx)*.955,cz+(z-cz)*.955]);
  for(let i=0;i<p.length;i++){
    const a=p[i],bPt=p[(i+1)%p.length],A=upper[i],B=upper[(i+1)%p.length];
    const corners=[[a[0],.12,a[1]],[bPt[0],.12,bPt[1]],[B[0],1.48,B[1]],[A[0],1.48,A[1]]];
    grass.quad(...corners,corners.map(q=>[q[0]/4,q[2]/4]),hillTone);
  }
  grass.polygon(upper,[],1.48,4,hillTone);

  // Subtle sculpted hillside knolls on the rooftop park between the boulders
  for(const [kx,kz,rx,rz,kh] of [
    [-388,-102,30,22,2.2],[-360,-202,28,24,2.4],[-420,-150,26,24,2.0],
    [-395,-42,32,22,2.1],[-330,-232,24,20,1.9],[-455,-265,34,26,2.2]
  ]){
    const rings=6,segs=24;
    let prev=null;
    for(let r=1;r<=rings;r++){
      const f=r/rings,y=1.46+kh*Math.cos(f*Math.PI*.5)**1.5;
      const cur=[];
      for(let s=0;s<=segs;s++){
        const a=s*tau/segs;
        cur.push([kx+Math.cos(a)*rx*f,y,kz+Math.sin(a)*rz*f]);
      }
      if(r===1){
        const apex=[kx,1.46+kh,kz];
        for(let s=0;s<segs;s++)grass.quad(apex,cur[s],cur[s+1],apex,[apex,cur[s],cur[s+1],apex].map(q=>[q[0]/4,q[2]/4]),hillTone);
      }else{
        for(let s=0;s<segs;s++)grass.quad(prev[s],cur[s],cur[s+1],prev[s+1],[prev[s],cur[s],cur[s+1],prev[s+1]].map(q=>[q[0]/4,q[2]/4]),hillTone);
      }
      prev=cur;
    }
  }

  // Clean light-grey granite entrance aprons around the boulder bases (replaces muddy brown m.paving)
  for(const id of cultureIDs.slice(1)){
    const bp=city.get(id).p,[x,z]=center(id);
    const apron=bp.map(([px,pz])=>[x+(px-x)*1.07,z+(pz-z)*1.07]);
    grounds.polygon(apron,[],1.54,3.5);
  }

  // Winding light-grey granite rooftop promenade connecting South Hall -> Central Arch -> North Hall
  function addPathStrip(pts,halfW,y){
    const curve=new T.CatmullRomCurve3(pts.map(([x,z])=>new T.Vector3(x,0,z)));
    const steps=44;
    let prevL=null,prevR=null;
    for(let i=0;i<=steps;i++){
      const u=i/steps,pt=curve.getPointAt(u),tg=curve.getTangentAt(u);
      const l=Math.hypot(tg.x,tg.z)||1,nx=-tg.z/l,nz=tg.x/l;
      const L=[pt.x-nx*halfW,y,pt.z-nz*halfW],R=[pt.x+nx*halfW,y,pt.z+nz*halfW];
      if(prevL)grounds.quad(prevL,L,R,prevR,[[0,(i-1)],[0,i],[1,i],[1,(i-1)]]);
      prevL=L;prevR=R;
    }
  }
  addPathStrip([[-412,-28],[-396,-64],[-372,-88],[-342,-118],[-344,-158],[-362,-195],[-342,-238],[-336,-276]],2.6,1.56);
  addPathStrip([[-342,-118],[-314,-116],[-286,-106]],3.4,.32);

  // =========================================================================
  // 3. Central Sunken Circular Courtyard & Sweeping White Curved Arch Portal
  //    (Dead center of IMG_0278 — replaces the flat white satellite smudge!)
  // =========================================================================
  {
    const pcx=-348,pcz=-118,plazaR=32.5;
    const segs=40;
    const disc=[];
    for(let i=0;i<segs;i++){
      const a=i*tau/segs;
      disc.push([pcx+Math.cos(a)*plazaR,pcz+Math.sin(a)*plazaR]);
    }
    grounds.polygon(disc,[],.30,4.5);

    // Concentric curved granite amphitheater steps around the western & north/south arc
    const tiers=7;
    for(let k=0;k<tiers;k++){
      const r0=plazaR-k*1.35,r1=r0-1.35,y0=.30+k*.32,y1=y0+.32;
      const aStart=Math.PI*.48,aEnd=Math.PI*1.52,nA=24;
      for(let i=0;i<nA;i++){
        const a0=aStart+(aEnd-aStart)*i/nA,a1=aStart+(aEnd-aStart)*(i+1)/nA;
        const o0=[pcx+Math.cos(a0)*r0,y1,pcz+Math.sin(a0)*r0],o1=[pcx+Math.cos(a1)*r0,y1,pcz+Math.sin(a1)*r0];
        const in0=[pcx+Math.cos(a0)*r1,y1,pcz+Math.sin(a0)*r1],in1=[pcx+Math.cos(a1)*r1,y1,pcz+Math.sin(a1)*r1];
        const b0=[pcx+Math.cos(a0)*r1,y0,pcz+Math.sin(a0)*r1],b1=[pcx+Math.cos(a1)*r1,y0,pcz+Math.sin(a1)*r1];
        grounds.quad(in0,o0,o1,in1);
        concreteSurf.quad(b0,in0,in1,b1);
      }
    }

    // Sweeping white-grey curved arch canopy / pedestrian skybridge spanning the circular courtyard (IMG_0278 center!)
    const Narch=36;
    const z0=-154,z1=-82;
    let prev=[];
    for(let i=0;i<=Narch;i++){
      const u=i/Narch,s=Math.sin(Math.PI*u);
      const z=z0+(z1-z0)*u;
      // Curves slightly eastward at the crown, embracing the circular plaza
      const xCenter=-344+10.5*s;
      const halfSpan=7.6+2.2*(1-s);
      const topY=1.65+7.8*Math.pow(s,1.35);
      const thick=1.15+.65*(1-s);
      const botY=Math.max(.32,topY-thick);
      const eTop=[xCenter+halfSpan,topY,z],wTop=[xCenter-halfSpan,topY,z];
      const eBot=[xCenter+halfSpan-.65,botY,z],wBot=[xCenter-halfSpan+.65,botY,z];
      const eMid=[xCenter+halfSpan+.35,(topY+botY)*.5+.12,z];
      if(i>0){
        const [peTop,pwTop,peBot,pwBot,peMid]=prev;
        // Smooth sculpted top walkway & beveled front lip + curved underside soffit
        grounds.quad(pwTop,wTop,eTop,peTop);
        concreteSurf.quad(peTop,eTop,eMid,peMid);
        concreteSurf.quad(peMid,eMid,eBot,peBot);
        concreteSurf.quad(peBot,eBot,wBot,pwBot);
        concreteSurf.quad(pwBot,wBot,wTop,pwTop);
        // Subtle glass balustrade along the arch's east crest
        if(u>.12&&u<.88){
          glassRails.quad(peTop,eTop,[eTop[0],eTop[1]+1.05,eTop[2]],[peTop[0],peTop[1]+1.05,peTop[2]]);
          if(i%3===0)railPosts.between(eTop[0],eTop[1],eTop[2],eTop[0],eTop[1]+1.05,eTop[2],.035);
        }
        // Recessed curved dark architectural glass gallery wall tucked deep under the arch shadow
        if(u>.18&&u<.82){
          const gx0=xCenter-halfSpan+2.2,gx1=peBot[0]-halfSpan*1.5+2.2;
          windows.quad([gx1,.30,prev[0][2]],[gx0,.30,z],[gx0,botY+.2,z],[gx1,peBot[1]+.2,prev[0][2]]);
        }
      }
      prev=[eTop,wTop,eBot,wBot,eMid];
    }
  }

  // =========================================================================
  // 4. Sculpted Curved Concrete Entrance Canopies & Signage (IMG_0159 & IMG_0385)
  //    North entrance near (-422, -310) & South entrance near (-472, +28)
  // =========================================================================
  const signTex=squareSignTex();
  const signMat=new T.MeshStandardMaterial({map:signTex,transparent:true,alphaTest:.12,roughness:.55,side:T.DoubleSide});
  const entrances=[
    {pos:[-424,-310],yaw:Math.PI-.08,width:38,depth:10.5,h:6.2,name:'深圳湾文化广场 · 北入口雨篷'},
    {pos:[-472,30],yaw:-.12,width:36,depth:10.0,h:6.0,name:'深圳湾文化广场 · 南入口雨篷'}
  ];
  for(const ent of entrances){
    const eg=new T.Group();eg.name=ent.name;
    eg.position.set(ent.pos[0],.26,ent.pos[1]);eg.rotation.y=ent.yaw;
    grp.add(eg);
    // Sweeping thick overhanging light-grey sculpted concrete fascia canopy (IMG_0159, IMG_0385)
    const eSurf=new Surface(),eGlass=new Surface(),eStair=new Surface();
    const nSeg=24,hw=ent.width*.5;
    let pTop=null,pLip=null,pBot=null,pBack=null;
    for(let i=0;i<=nSeg;i++){
      const u=i/nSeg,t=u*2-1,arch=Math.cos(t*Math.PI*.5);
      const x=t*hw,zOut=ent.depth*(.42+.58*arch);
      const yTop=ent.h+.55*arch,yLip=ent.h-.75+.35*arch,yBot=ent.h-1.85+.25*arch;
      const curTop=[x,yTop,zOut-.35],curLip=[x,yLip,zOut+.25],curBot=[x,yBot,zOut-2.8],curBack=[x,yTop,-2.5];
      if(pTop){
        eSurf.quad(pBack,curBack,curTop,pTop);
        eSurf.quad(pTop,curTop,curLip,pLip);
        eSurf.quad(pLip,curLip,curBot,pBot);
        // Organic curved recessed glass gallery facade tucked beneath overhang
        if(Math.abs(t)<.78){
          const gH=yBot+.35;
          eGlass.quad([pBot[0],0,pBot[2]-.4],[curBot[0],0,curBot[2]-.4],[curBot[0],gH,curBot[2]-.4],[pBot[0],gH,pBot[2]-.4]);
        }
      }
      pTop=curTop;pLip=curLip;pBot=curBot;pBack=curBack;
    }
    // Wide granite plaza apron & glass-railed entrance steps + slim glass mullions (IMG_0159)
    eStair.polygon([[-hw-4,1],[hw+4,1],[hw+4,ent.depth+7],[-hw-4,ent.depth+7]],[],.02,3);
    const eMull=new Instances(new T.BoxGeometry(1,1,1),seal,'入口玻璃幕墙竖框');
    for(let k=-6;k<=6;k++){
      const mx=k*2.1;
      const u=(mx/hw+1)*.5,arch=Math.cos((u*2-1)*Math.PI*.5);
      const mz=ent.depth*(.42+.58*arch)-3.15,mh=ent.h-1.5+.25*arch;
      eMull.at(mx,mh*.5,mz,.07,mh,.09);
    }
    eMull.flush(eg);
    const eRail=new Surface();
    for(let s=0;s<6;s++){
      const sy=.02+s*.14,sz=ent.depth+2.5-s*.48;
      eStair.quad([-8,sy,sz],[8,sy,sz],[8,sy,sz-.48],[-8,sy,sz-.48]);
    }
    for(const sx of [-8.1,8.1]){
      eRail.quad([sx,.02,ent.depth+2.6],[sx,.02,ent.depth-.3],[sx,1.15,ent.depth-.3],[sx,1.15,ent.depth+2.6]);
    }
    eSurf.mesh(eg,concrete,'雕塑感弧形混凝土雨篷',true);
    eGlass.mesh(eg,glaze,'入口弧形玻璃幕墙');
    eRail.mesh(eg,glassRailMat,'入口阶梯玻璃护栏');
    eStair.mesh(eg,courtyardStone,'入口石材广场与阶梯');
    // Recessed signage "深圳湾文化广场  SHENZHEN BAY CULTURE SQUARE" on curved front lip
    const signMesh=new T.Mesh(new T.PlaneGeometry(18.5,1.95),signMat);
    signMesh.position.set(0,ent.h-.12,ent.depth+.32);
    eg.add(signMesh);
  }

  // =========================================================================
  // 5. Lush Green-Roof Park Trees (registered for city-nature.js volumetric foliage)
  // =========================================================================
  const cultureTrees=[];
  const tRng=random(1441599);
  const insideStone=(x,z)=>stoneFootprints.some(s=>((x-s.x)/s.rx)**2+((z-s.z)/s.rz)**2<1.05);
  const insideCentralPlaza=(x,z)=>Math.hypot(x+348,z+118)<39;
  // Dense green hillside trees along the eastern rim facing Talent Park (IMG_0278, IMG_0230)
  for(let i=0;i<190;i++){
    const x=b[0]+14+tRng()*(b[2]-b[0]-20);
    const z=b[1]+14+tRng()*(b[3]-b[1]-28);
    if(!inRing(x,z,upper))continue;
    if(insideStone(x,z)||insideCentralPlaza(x,z))continue;
    // Concentrate trees on the eastern scenic rim and around north/south flanks
    const eastBias=x>-385?.92:.52;
    if(tRng()>eastBias)continue;
    const h=5.4+tRng()*5.2;
    cultureTrees.push([x,z,h,1.46]);
  }
  // Curated row of lush trees framing the eastern rim directly behind Talent Park's blue track
  for(const [tx,tz,th] of [
    [-312,-165,7.8],[-308,-178,8.5],[-302,-192,7.4],[-316,-208,8.0],[-305,-226,8.4],
    [-296,-242,7.6],[-292,-258,8.2],[-308,-272,7.8],[-322,-285,8.6],[-350,-296,8.0],
    [-372,-62,8.4],[-368,-44,7.8],[-378,-26,8.6],[-392,-12,8.0],[-408,4,7.6],
    [-358,-154,7.4],[-358,-80,7.8],[-386,-142,8.2],[-390,-92,8.4],[-420,-152,8.8]
  ]){
    if(!insideStone(tx,tz))cultureTrees.push([tx,tz,th,1.46]);
  }
  if(grid)grid.cultureTrees=cultureTrees;

  grass.mesh(grp,m.grass,'深圳湾文化广场 · 屋顶绿坡公园');
  grounds.mesh(grp,courtyardStone,'深圳湾文化广场 · 浅灰花岗石庭院与步廊');
  concreteSurf.mesh(grp,concrete,'深圳湾文化广场 · 弧形白混凝土拱廊与阶座',true);
  darkSurf.mesh(grp,darkRecess,'深圳湾文化广场 · 阴影退界墙');
  windows.mesh(grp,glaze,'原石展厅的水平窗带与天窗');
  jambs.mesh(grp,seal,'凿口收边');
  glassRails.mesh(grp,glassRailMat,'广场玻璃护栏');
  skylights.mesh(grp,new T.MeshPhysicalMaterial({color:0x7c959e,roughness:.20,metalness:.36,clearcoat:.72,side:T.DoubleSide}),'原石展厅椭圆采光顶');
  ribs.flush(grp);
  railPosts.flush(grp);
}
