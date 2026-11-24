import * as T from 'three';
import {Surface,Instances,area,bounds,sideWall} from './city-geometry.js';
import {curtainWall,architecturalMetal} from './city-curtainwall.js';
import {markBuildingFacade,cityFacadeMesh} from './city-lightshow.js';

const volc=1415189513,aac=-900000601,site=-900000602;
const oilTowers=new Set([736645095,700827684]),balconyTowers=new Set([1190750264,1190750265]);
const station=562534108;
const surveyYaw=1.313;
function footprint(id,name,cx,cz,w,d,height){
  const c=Math.cos(surveyYaw),s=Math.sin(surveyYaw);
  return {id,name,h:height,kind:'commercial',p:[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[cx+c*u+s*v,cz-s*u+c*v])};
}
// The older city extract omits these two lots east of 中心路. Use the same
// footprints in the collision, precipitation and render passes.
export function surveyHouhai(map){
  const tower=map.buildings.find(b=>b.id===volc);
  if(tower){tower.h=150;tower.name='景湖大厦';}
  if(!map.buildings.some(b=>b.id===aac)){
    map.buildings.push(footprint(aac,'瑞声科技深圳后海总部',-681,-126,41,39,100),
      footprint(site,'潮汐广场对岸施工楼体',-661,-73,43,40,83));
  }
}
function lettering(title,sub,style){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=232;
  const g=canvas.getContext('2d');g.fillStyle='#f2f2ed';
  if(style==='volc'){
    // The blue three-peaked mark and the two lines are separate raised elements.
    for(const [color,points] of [['#16468c',[[15,184],[66,67],[111,185]]],
      ['#2678d7',[[64,182],[124,34],[184,183]]],['#1451af',[[118,183],[172,75],[228,184]]]]){
      g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.fill();
    }
    g.fillStyle='#fffaf0';g.font='bold 147px "Microsoft YaHei",sans-serif';g.fillText(title,246,147);
    g.font='600 54px Arial';g.fillText(sub,252,213);
  }else if(style==='lenovo'){
    g.fillStyle='#bc2928';g.fillRect(12,29,563,176);g.fillStyle='white';g.font='bold 133px Arial';g.fillText('Lenovo',30,168);
    g.font='bold 140px "Microsoft YaHei",sans-serif';g.fillText('联想',595,165);
  }else if(style==='aac'){
    g.lineWidth=20;g.lineJoin='round';g.beginPath();g.moveTo(22,164);g.lineTo(99,27);g.lineTo(167,166);g.closePath();g.strokeStyle='#ecefed';g.stroke();
    g.font='bold 93px Arial';g.fillText('AAC',209,100);g.font='65px Arial';g.fillText('Technologies',210,181);
  }else{
    g.fillStyle=style==='ali'?'#f18b42':'#f2f3ed';
    g.textAlign='center';g.font=(sub?'bold 115px ':'bold italic 143px ')+(style==='ali'||style==='hisense'?'Arial':'"Microsoft YaHei",sans-serif');
    g.fillText(title,512,sub?122:165,985);
    if(sub){g.font='bold 73px Arial';g.fillText(sub,512,205,940);}
  }
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}
export function houhaiElevations(root,m){
  const shell=new Surface(),roof=new Surface(),panel=new Surface(),cladding=new Surface(),dark=new Surface(),decks=new Surface();
  const glass=curtainWall('seafront'),silver=architecturalMetal(0xa9afb0,.41),shade=architecturalMetal(0x414d55,.49);
  m.walls.push(glass);
  const alloyMap=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/tidal-alloy.webp');
  alloyMap.colorSpace=T.SRGBColorSpace;alloyMap.wrapS=alloyMap.wrapT=T.RepeatWrapping;alloyMap.anisotropy=8;alloyMap.repeat.set(1/7.6,1/11.4);
  const alloy=architecturalMetal(0xf3f4f3,.42);alloy.map=alloyMap;
  const cube=new T.BoxGeometry(),tube=new T.CylinderGeometry(1,1,1,8);
  const fins=new Instances(cube,silver,'滨湖天际线 · 窗间翼板及水平压顶');
  const recess=new Instances(cube,shade,'设备层、竖向凹槽与窗间阴影');
  const cranes=new Instances(tube,new T.MeshStandardMaterial({color:0x9c8961,roughness:.81}),'施工楼顶塔吊桁架');
  const braces=new Instances(tube,silver,'中建塔楼立面钢支撑');
  const signs=new T.Group();signs.name='潮汐广场实拍 · 楼宇字标';root.add(signs);
  const neutral=new T.Color(.86,.93,.96),smoke=new T.Color(.55,.65,.71);
  function mount(title,tex,x,y,z,yaw,w,h){
    const material=new T.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:0,transparent:true,alphaTest:.14,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3,roughness:.5,metalness:.12});
    m.parkLights.finish(material,.90,.32);
    const sign=new T.Mesh(new T.PlaneGeometry(w,h),material);sign.name=title;sign.position.set(x,y,z);sign.rotation.y=yaw;signs.add(sign);
  }
  function parkFace(f){
    const ring=area(f.p)>0?f.p:f.p.slice().reverse();
    let best=null,score=-Infinity;
    for(let i=0;i<ring.length;i++){
      const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%ring.length],len=Math.hypot(bx-ax,bz-az);
      if(len<9)continue;
      const nx=(bz-az)/len,nz=(ax-bx)/len,x=(ax+bx)/2,z=(az+bz)/2;
      const towards=(nx*(-72-x)+nz*(-312-z))/Math.hypot(-72-x,-312-z);
      const rank=towards+Math.min(len,40)*.002;
      if(rank>score){score=rank;best={x,z,nx,nz,len,yaw:Math.atan2(nx,nz)};}
    }
    return best;
  }
  function detail(f){
    const bespoke=f.id===volc||f.id===aac||f.id===site||f.id===station||oilTowers.has(f.id)||balconyTowers.has(f.id);
    if(!bespoke&&!inscriptions.has(f.id))return false;
    const b=bounds(f.p),x=(b[0]+b[2])*.5,z=(b[1]+b[3])*.5;
    const c=Math.cos(surveyYaw),s=Math.sin(surveyYaw);
    const at=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
    const ring=(u,v,w,d)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>at(u+a*w*.5,v+b*d*.5));
    function block(surface,u,v,w,d,lo,hi,tint=neutral){
      const p=ring(u,v,w,d);sideWall(surface,p,lo,hi,1,1,tint);roof.polygon(p,[],hi,5);return p;
    }
    function trim(batch,u,v,y,w,h,d){
      const [px,pz]=at(u,v);batch.at(px,y,pz,w,h,d,surveyYaw);
    }
    function photoSign(file){
      const tex=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/'+file+'.webp');tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
    }
    if(f.id===volc){
      block(shell,0,0,40.8,49,.25,116);
      block(shell,-4.55,2.0,31.7,45.0,116,147.8);
      block(shell,-6,-3,23.4,30,147.8,150);
      block(shell,16.1,-.85,10.8,46.4,6,114,smoke);
      for(let u=11.2;u<22;u+=1.14)trim(recess,u,22.42,60,.21,107,.43);
      // Silver volumes wrap a darker, recessed centre. Break the front into
      // jambs and spandrels so the two-storey reveals have real depth.
      for(const [u,v,w,d,lo,hi] of [[0,2,42.3,51,6,32],[-14,4,14,53,32,71],[14,4,14,53,32,71],
        [0,4,42,53,71,81],[-15,4,12,53,81,96],[16,4,10,53,81,96],[0,4,42,53,96,116]]){
        block(cladding,u,v,w,d,lo,hi);
        for(let j=-w/2+1.55;j<w/2;j+=1.55)trim(fins,u+j,v+d/2+.02,(lo+hi)/2,.085,hi-lo,.09);
        for(let h=lo+3.8;h<hi;h+=3.8){
          trim(recess,u,v+d*.5+.025,h,w,.08,.06);
          for(const side of [-1,1])trim(recess,u+side*(w*.5+.025),v,h,.06,.075,d);
        }
      }
      for(let y=39;y<69;y+=6)trim(fins,0,25,y,18,.9,1.3);
      for(let y=119;y<147;y+=4.7)trim(recess,-4.55,2,y,31.94,.24,45.24);
      const [px,pz]=at(-.7,24.91);mount('火山引擎 · volcengine',lettering('火山引擎','volcengine','volc'),px,144.1,pz,surveyYaw,21.9,4.96);
    }else if(f.id===aac){
      block(shell,0,0,41,39,0,100,smoke);
      for(const u of [-18.7,18.7])trim(recess,u,0,51,1.45,98,39.7);
      for(let u=-19;u<21;u+=1.45)trim(fins,u,19.55,51,.10,98,.22);
      const [px,pz]=at(-6.6,19.9);mount('AAC Technologies',lettering('','','aac'),px,94.3,pz,surveyYaw,23,5.3);
    }else if(f.id===site){
      block(dark,0,-4,17,14,0,81);
      for(let y=1.1;y<83;y+=4.1)block(decks,0,0,43,40,y,y+.56);
      for(const v of [-18.5,0,18.5])for(let u=-20;u<22;u+=8)trim(fins,u,v,41,.72,82,.70);
      for(let j=0;j<2;j++){
        const [cx,cz]=at(-12+j*29,-11+j*19),h=104+j*8;
        for(const a of [-.72,.72])for(const b of [-.72,.72])cranes.between(cx+a,63,cz+b,cx+a,h,cz+b,.13);
        for(let y=65;y<h-2;y+=3)cranes.between(cx-.72,y,cz+.72,cx+.72,y+3,cz+.72,.085);
        for(const zz of [-.6,.6])cranes.between(cx-10,h,cz+zz,cx+30,h,cz+zz,.12);
        for(let k=-10;k<30;k+=2.5){cranes.between(cx+k,h,cz-.6,cx+k+1.25,h+1.1,cz,.09);cranes.between(cx+k+1.25,h+1.1,cz,cx+k+2.5,h,cz+.6,.09);}
        cranes.between(cx,h+5,cz,cx+23,h,cz,.07);
      }
    }else if(f.id===station){
      // Rebuilt 1:1 from IMG_0230 & IMG_0278: crisp white volunteer service pavilion
      // (left/south) + taller white cantilevered portal canopy with 4 vertical white
      // cultural banner pylons (right/north) + glass-railed lakeside deck & tiered stone steps.
      const stGroup=new T.Group();stGroup.name='人才驿站 · 志愿服务站与临湖门廊';
      stGroup.position.set(x,0,z);stGroup.rotation.y=surveyYaw;
      root.add(stGroup);
      const whiteArch=new T.MeshStandardMaterial({color:0xf0f1ec,roughness:.44,metalness:.06,side:T.DoubleSide});
      const soffitMat=new T.MeshStandardMaterial({color:0xdde0dc,roughness:.62,side:T.DoubleSide});
      const darkCore=new T.MeshStandardMaterial({color:0x232a2e,roughness:.72,side:T.DoubleSide});
      const glassWall=new T.MeshPhysicalMaterial({color:0x7c979e,roughness:.12,metalness:.25,clearcoat:.9,transparent:true,opacity:.56,depthWrite:false,side:T.DoubleSide});
      const glassRail=new T.MeshPhysicalMaterial({color:0xa8bfc4,roughness:.14,metalness:.12,transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide});
      const warmInt=new T.MeshStandardMaterial({color:0xe8dfd0,emissive:0xffe4be,emissiveIntensity:.18,roughness:.85});
      const deckMat=new T.MeshStandardMaterial({color:0xc5c7c2,roughness:.82,side:T.DoubleSide});

      const box=(w,h,d,mat,px,py,pz)=>{const ms=new T.Mesh(new T.BoxGeometry(w,h,d),mat);ms.position.set(px,py,pz);ms.castShadow=true;ms.receiveShadow=true;stGroup.add(ms);return ms;};

      // 1. South/Left wing: Volunteer Service Station (u in [-13.4, -0.8], IMG_0230 left)
      box(12.8,.85,9.8,whiteArch,-7.0,4.55,.2); // Crisp white overhanging flat roof slab
      box(12.2,.18,9.2,soffitMat,-7.0,4.08,.2);
      box(9.8,3.6,5.8,warmInt,-7.0,2.15,-1.0); // Bright recessed interior room
      // Floor-to-ceiling glass curtain wall with slim silver/white mullions
      const frontGlass=new T.Mesh(new T.PlaneGeometry(11.6,3.8),glassWall);
      frontGlass.position.set(-7.0,2.22,4.35);stGroup.add(frontGlass);
      for(let u=-12.6;u<=-1.2;u+=1.9)box(.09,3.85,.12,whiteArch,u,2.22,4.38);
      box(11.8,.12,.14,whiteArch,-7.0,4.06,4.38);
      box(11.8,.14,.16,whiteArch,-7.0,.35,4.38);

      // Authentic "志愿深圳 · 人才公园志愿服务站" fascia header (IMG_0230)
      const fc=document.createElement('canvas');fc.width=1024;fc.height=128;
      const fg=fc.getContext('2d');
      fg.fillStyle='#f3f4ef';fg.fillRect(0,0,1024,128);
      fg.fillStyle='#c9342b';fg.fillRect(22,18,238,92);
      fg.fillStyle='#ffffff';fg.font='bold 50px "Microsoft YaHei",sans-serif';fg.textAlign='center';fg.textBaseline='middle';
      fg.fillText('志愿深圳',141,66);
      // 4 crisp circular emblem badges in center
      for(let k=0;k<4;k++){
        fg.strokeStyle=k%2?'#c9342b':'#2b6d9e';fg.lineWidth=6;
        fg.beginPath();fg.arc(312+k*64,64,22,0,Math.PI*2);fg.stroke();
        fg.fillStyle=k%2?'#e36a5b':'#5294c4';
        fg.beginPath();fg.arc(312+k*64,64,10,0,Math.PI*2);fg.fill();
      }
      fg.fillStyle='#242c30';fg.textAlign='left';fg.font='bold 46px "Microsoft YaHei",sans-serif';
      fg.fillText('人才公园志愿服务站',560,66);
      const fasciaTex=new T.CanvasTexture(fc);fasciaTex.colorSpace=T.SRGBColorSpace;fasciaTex.anisotropy=8;
      const signPlane=new T.Mesh(new T.PlaneGeometry(12.6,.98),new T.MeshStandardMaterial({map:fasciaTex,roughness:.45}));
      signPlane.position.set(-7.0,4.55,5.16);stGroup.add(signPlane);

      // 2. North/Right wing: Taller white cantilevered architectural portal frame (u in [-0.6, +13.6], IMG_0230 right)
      box(14.6,1.15,11.6,whiteArch,6.6,5.88,.4); // Prominent tall white portal roof canopy
      box(14.0,.14,10.8,soffitMat,6.6,5.25,.4);
      box(1.15,5.2,9.8,whiteArch,13.1,2.85,.2); // Crisp north white side pier
      box(.95,5.2,9.2,whiteArch,-.15,2.85,.1); // Center dividing white pier
      box(12.2,4.85,6.8,darkCore,6.5,2.70,-1.4); // Recessed dark gallery core inside portal
      // Warm architectural entrance light strip inside portal
      box(9.4,.12,.45,m.lamp,6.5,5.16,2.8);

      // 3. Four iconic tall vertical white/sage-green cultural banner pylons rising above portal (IMG_0230 & IMG_0278)
      const bc=document.createElement('canvas');bc.width=128;bc.height=384;
      const bg=bc.getContext('2d');
      bg.fillStyle='#f0f2ed';bg.fillRect(0,0,128,384);
      bg.fillStyle='#5c8d6f';bg.fillRect(16,24,96,170);
      bg.fillStyle='#89b492';bg.fillRect(28,44,72,90);
      bg.fillStyle='#3b5246';bg.fillRect(24,225,80,14);bg.fillRect(24,255,64,12);
      const bannerTex=new T.CanvasTexture(bc);bannerTex.colorSpace=T.SRGBColorSpace;
      const bannerMat=new T.MeshStandardMaterial({map:bannerTex,roughness:.52});
      for(let k=0;k<4;k++){
        const px=1.2+k*3.3;
        box(1.15,3.55,.28,whiteArch,px,8.20,-1.2);
        const bp=new T.Mesh(new T.PlaneGeometry(1.06,3.35),bannerMat);
        bp.position.set(px,8.20,-1.04);stGroup.add(bp);
      }

      // 4. Raised lakeside viewing deck with glass balustrade + wide tiered granite steps (IMG_0230)
      box(28.0,.36,5.2,deckMat,0,.44,7.4);
      const railFront=new T.Mesh(new T.PlaneGeometry(27.2,1.08),glassRail);
      railFront.position.set(0,1.16,9.95);stGroup.add(railFront);
      box(27.4,.05,.06,whiteArch,0,1.72,9.95);
      for(let u=-13.2;u<=13.2;u+=2.64)box(.05,1.12,.05,whiteArch,u,1.16,9.95);
      // 4 tiered granite steps descending east toward the lakefront promenade
      for(let k=0;k<4;k++){
        box(32.0,.18,1.15,deckMat,0,.38-k*.07,10.6+k*1.05);
      }
      f.h=9.9;
    }else if(balconyTowers.has(f.id)){
      const inset=f.p.map(([px,pz])=>[x+(px-x)*.945,z+(pz-z)*.945]);
      const north=f.id===1190750265,crown=f.h-(north?10.4:2.8);
      sideWall(shell,inset,.25,crown,1,1,neutral);roof.polygon(inset,[],crown,5);
      for(let h=3.8,i=0;h<crown;h+=3.75,i++){
        sideWall(panel,f.p,h,h+.40,1,1,neutral);
        for(const sign of [-1,1])trim(fins,(i%5-2)*1.8,sign*12.15,h+.22,24+(i%3)*3.4,.44,1.28);
      }
      // The floor edges project past the glazing. The inset balcony openings
      // facing the lake follow the two separate elevations in photograph 5.
      const front=new Surface(),img=photoSign('tidal-balconies-'+(north?'north':'south'));
      const facade=new T.MeshPhysicalMaterial({map:img,roughness:.34,metalness:.19,clearcoat:.46,side:T.DoubleSide});
      const L=at(-22.65,11.88),R=at(22.65,11.88),mid=crown-112.5;
      for(const [lo,hi] of [[mid-112.5,mid],[mid,crown-.58]]){
        front.quad([L[0],lo,L[1]],[R[0],lo,R[1]],[R[0],hi,R[1]],[L[0],hi,L[1]]);
      }
      markBuildingFacade(front,f);cityFacadeMesh(front,root,facade,'双塔临湖面 · 错层阳台');
      block(shell,-2.4,-.6,42.2,22.5,crown,f.h,smoke);
      trim(fins,-2.4,-.6,f.h+.13,42.6,.26,22.9);
    }else{
      const spec=inscriptions.get(f.id);
      if(!spec)return false;
      const face=parkFace(f);if(!face)return false;
      const {nx,nz,yaw,len}=face;
      const [label,sub,style,w,yFrac]=spec;
      const wSign=Math.min(len*.92,w),off=.53;
      const tex=style==='photo'?photoSign(sub):lettering(label,sub,style);
      tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
      const h=style==='photo'?wSign*(sub==='bay-gold'?.28:sub==='tidal-d-crown'?.14:.20):wSign*.2266;
      mount(label,tex,face.x+nx*off,f.h*yFrac,face.z+nz*off,yaw,wSign,h);
      if(oilTowers.has(f.id)){
        const tint=new T.Color(.69,.88,.83),edge=f.p.map(([a,b])=>[x+(a-x)*1.007,z+(b-z)*1.007]);
        sideWall(shell,f.p,.25,f.h,1,1,tint);roof.polygon(f.p,[],f.h,5);
        for(let y=8;y<f.h-3;y+=8.35)sideWall(dark,edge,y,y+.38,1,1);
        for(const [px,pz] of f.p)braces.between(px,1,pz,px,f.h,pz,.17);
      }
      if(f.id===586623959){
        const ex=Math.cos(yaw),ez=-Math.sin(yaw);
        mount('CSCEC · 蓝色楼标',photoSign('bay-cscec-square'),face.x+nx*.6-ex*len*.39,f.h*.954,face.z+nz*.6-ez*len*.39,yaw,4.15,5);
        for(let y=13;y+13<f.h*.77;y+=14){
          for(const sign of [-1,1])braces.between(face.x+nx*.62+ex*sign*len*.30,y,face.z+nz*.62+ez*sign*len*.30,face.x+nx*.62-ex*sign*len*.30,y+13.6,face.z+nz*.62-ez*sign*len*.30,.42);
        }
      }
    }
    if(bespoke)markBuildingFacade(shell,f);
    if(f.id===volc)markBuildingFacade(cladding,f);
    return bespoke;
  }
  const inscriptions=new Map([
    [736645095,['中国海油','CNOOC','oil',22,.953]],[700827684,['中国海油','CNOOC','oil',21,.954]],
    [586621902,['Hisense','','hisense',25,.958]],[586623959,['中建科工集团','bay-cscec','photo',29,.953]],
    [586621892,['Alibaba','','ali',20,.945]],[586621891,['临湖金色字标','bay-gold','photo',21,.954]],
    [1351253333,['深圳湾南侧高楼冠部字标','tidal-d-crown','photo',23,.965]],
    [1190750257,['Lenovo 联想','','lenovo',36,.955]]
  ]);
  return {detail,finish(){
    cityFacadeMesh(shell,root,glass,'后海总部 · 分段青灰玻璃幕墙');
    cityFacadeMesh(cladding,root,alloy,'景湖大厦 · 银灰色金属分格及悬挑框体');
    panel.mesh(root,silver,'滨湖建筑 · 银色收边',true);dark.mesh(root,shade,'凹槽与楼芯');decks.mesh(root,m.curb,'在建楼层混凝土楼板',true);
    roof.mesh(root,m.roof,'总部屋面与挑台');fins.flush(root,true);recess.flush(root);cranes.flush(root,true);braces.flush(root);
  }};
}
