import * as T from 'three';
import {Surface,Instances,ribbon,along,random,bounds} from './city-geometry.js';
import {bridgeHandrail} from './bridge-handrail.js';
import {columnsOnBridge,routePoint,sleeve} from './talent-bridge.js';
import {engravedFaces} from './talent-faces.js';
import {photo} from './city-materials.js';
import {architecturalMetal} from './city-curtainwall.js';

const columnLightColor=0xffbf45;
const columnLightIntensity=5.6;

function columnMaterial(){
  const rng=random(2453),w=512,h=2464;
  const contexts=Array.from({length:4},()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c.getContext('2d');});
  const [albedo,rough,metal,glow]=contexts;
  albedo.fillStyle='#3d4546';albedo.fillRect(0,0,w,h);
  rough.fillStyle='#a2a2a2';metal.fillStyle='#d4d4d4';glow.fillStyle='#000';
  for(const c of [rough,metal,glow])c.fillRect(0,0,w,h);
  // Scattered apertures in the powder-coated cylindrical sleeve. The bright
  // acrylic core is slightly recessed inside the dark countersunk rim.
  for(let i=0;i<237;i++){
    const y=rng()*h;if(y>h*(1-sleeve.top/sleeve.height)&&y<h*(1-sleeve.bottom/sleeve.height))continue;
    const x=rng()*w,r=2.6+Math.pow(rng(),2.4)*13,light=.4+rng()*.57;
    for(const xx of [x-w,x,x+w]){
      const rim=r+2.2,halo=glow.createRadialGradient(xx,y,r-.3,xx,y,rim);
      halo.addColorStop(0,`rgba(255,255,255,${light*.22})`);halo.addColorStop(1,'rgba(255,255,255,0)');
      glow.fillStyle=halo;glow.fillRect(xx-rim,y-rim,rim*2,rim*2);
      for(const [c,radius,color] of [[albedo,r+1.6,'#172124'],[albedo,r+.48,'#87918f'],[albedo,r-.15,'#ccd4cc'],[metal,r,'#242424'],[rough,r,'#4b4b4b'],[glow,r-.3,'rgba(255,255,255,'+light+')']]){
        c.fillStyle=color;c.beginPath();c.arc(xx,y,radius,0,Math.PI*2);c.fill();
      }
    }
  }
  const c1=h*(1-sleeve.top/sleeve.height),c2=h*(1-sleeve.bottom/sleeve.height);
  albedo.fillStyle='#adb1ae';albedo.fillRect(0,c1,w,c2-c1);
  for(let i=0;i<1150;i++){const l=Math.floor(100+rng()*100);albedo.fillStyle='rgba('+l+','+Math.min(255,l+2)+','+l+',.15)';albedo.fillRect(rng()*w,c1+rng()*(c2-c1),10+rng()*120,.45);}
  for(const y of [c1,c2]){albedo.fillStyle='#4e5654';albedo.fillRect(0,y,w,2);}
  rough.fillStyle='#696969';rough.fillRect(0,c1,w,c2-c1);
  const tx=contexts.map((c,i)=>{const t=new T.CanvasTexture(c.canvas);t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=T.RepeatWrapping;t.anisotropy=8;return t;});
  const mat=new T.MeshPhysicalMaterial({map:tx[0],roughnessMap:tx[1],metalnessMap:tx[2],emissiveMap:tx[3],roughness:.73,metalness:.88,clearcoat:.26,clearcoatRoughness:.22,emissive:columnLightColor,emissiveIntensity:0});
  mat.userData.cityProbe='bridge';mat.name='星光柱 · 穿孔金属与透光树脂';return mat;
}
// Timber scan (CC0) https://polyhaven.com/a/wood_floor_deck
function decking(spill,spillBounds,glow){
  const color=photo('bridge-deck-color.webp'),norm=photo('bridge-deck-normal.webp'),arm=photo('bridge-deck-arm.webp');
  norm.colorSpace=arm.colorSpace=T.NoColorSpace;
  const mat=new T.MeshPhysicalMaterial({map:color,normalMap:norm,roughnessMap:arm,aoMap:arm,aoMapIntensity:.65,roughness:.73,metalness:.035,
    normalScale:new T.Vector2(.57,.57),clearcoat:.64,clearcoatRoughness:.23,envMapIntensity:1.12,side:T.DoubleSide});
  mat.userData.cityProbe='bridge';
  mat.onBeforeCompile=shader=>{
    shader.uniforms.bridgeSpill={value:spill};shader.uniforms.bridgeGlow=glow;shader.uniforms.spillBounds={value:spillBounds};
    shader.uniforms.bridgeLampColor={value:new T.Color(columnLightColor)};
    shader.fragmentShader='uniform sampler2D bridgeSpill;uniform float bridgeGlow;uniform vec4 spillBounds;uniform vec3 bridgeLampColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float pool=texture2D(bridgeSpill,(boardPosition.xz-spillBounds.xy)*spillBounds.zw).r;
      totalEmissiveRadiance+=pool*bridgeGlow*.28*bridgeLampColor*(.44+diffuseColor.rgb);`);
    shader.vertexShader='varying vec3 boardPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nboardPosition=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`
      varying vec3 boardPosition;
      float plankHash(vec2 p){vec3 v=fract(vec3(p.xyx)*.1031);v+=dot(v,v.yzx+33.33);return fract((v.x+v.y)*v.z);}
      float wetNoise(vec2 p){vec2 k=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(plankHash(k),plankHash(k+vec2(1,0)),f.x),mix(plankHash(k+vec2(0,1)),plankHash(k+1.),f.x),f.y);}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float agedGray=dot(diffuseColor.rgb,vec3(.25,.64,.11));
      diffuseColor.rgb=mix(diffuseColor.rgb,agedGray*vec3(1.0,.98,.91),.82)*.84;
      float plank=floor(vMapUv.y*12.),offset=plankHash(vec2(plank,8.));
      vec2 laid=vec2(vMapUv.x/1.74+offset,vMapUv.y*12.);
      float cuts=min(fract(laid.x),1.-fract(laid.x));
      float joint=1.-smoothstep(.0006,.006+fwidth(laid.x),cuts);
      diffuseColor.rgb*=mix(.91,1.08,plankHash(floor(laid)))*(1.-.59*joint);
      vec2 pos=boardPosition.xz;
      float basin=wetNoise(pos*.53)*.58+wetNoise(pos*1.25)*.30+wetNoise(pos*3.8)*.12;
      float timberFilm=smoothstep(.34,.71,basin+offset*.09-.04);
      diffuseColor.rgb*=mix(.95,.47,timberFilm);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(clamp(roughnessFactor,.46,.92),.21,timberFilm*.91);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
      material.clearcoat=mix(.055,.77,timberFilm);
      material.clearcoatRoughness=mix(.47,.15,timberFilm);`);
  };
  return mat;
}

// The side elevation shows white splayed pier heads beneath dark longitudinal
// girders. Build the open bays so the lake remains visible between the supports.
function bridgeFrame(root,path,width,m){
  const tube=new T.CylinderGeometry(1,1,1,10);
  const soffit=new Surface(),fascia=new Instances(new T.BoxGeometry(),m.cream,'星光桥 · 分缝浅色封边');
  const chord=new Instances(tube,m.rail,'星光桥 · 下弦钢管');
  const legs=new Instances(tube,m.cream,'星光桥 · 分叉钢桥墩');
  const girders=new Instances(new T.BoxGeometry(),m.dark,'星光桥 · 纵梁和横隔梁');
  const ties=new Instances(tube,m.rail,'星光桥 · 腹杆');
  const feet=new Instances(new T.BoxGeometry(),m.curb,'星光桥 · 水线承台');
  const bearings=new Instances(new T.BoxGeometry(),m.dark,'星光桥 · 梁端橡胶支座');
  for(let i=1;i<path.length;i++){
    const [x,z]=path[i-1],[bx,bz]=path[i],dx=bx-x,dz=bz-z,l=Math.hypot(dx,dz);
    if(!l)continue;
    const nx=-dz/l,nz=dx/l,angle=Math.atan2(dx,dz),panels=Math.ceil(l/2.8),panel=l/panels;
    for(const side of [-1,1]){
      const off=side*(width*.5-.23),ox=nx*off,oz=nz*off;
      girders.at((x+bx)*.5+ox,1.84,(z+bz)*.5+oz,.18,.58,l,angle);
      chord.between(x+ox,1.54,z+oz,bx+ox,1.54,bz+oz,.105);
      // The narrow recess at each panel joint exposes the continuous backing.
      for(let n=0;n<panels;n++){
        const t=(n+.5)/panels,edge=side*(width*.5-.053);
        fascia.at(x+t*dx+nx*edge,2.23,z+t*dz+nz*edge,.106,.345,panel-.019,angle);
        const web=side*(width*.5-.114),sx=x+dx*n/panels+nx*web,sz=z+dz*n/panels+nz*web;
        ties.between(sx,2.10,sz,sx+dx/panels*.53,1.57,sz+dz/panels*.53,.046);
        ties.between(sx+dx/panels*.53,2.10,sz+dz/panels*.53,sx+dx/panels,1.57,sz+dz/panels,.046);
      }
    }
    for(const end of [0,1]){
      if(end===0&&i!==1||end===1&&i!==path.length-1)continue;
      const toward=end===0?1:-1,ex=end===0?x:bx,ez=end===0?z:bz;
      girders.at(ex,2.22,ez,width-.12,.36,.24,angle);
      feet.at(ex+toward*dx/l*.23,1.19,ez+toward*dz/l*.23,width+.02,.47,.7,angle);
      for(const flank of [-1,1]){
        const off=flank*(width*.5-.30);
        bearings.at(ex+nx*off+toward*dx/l*.28,1.47,ez+nz*off+toward*dz/l*.28,.46,.105,.44,angle);
      }
    }
  }
  ribbon(soffit,path,width-.12,2.085,3);soffit.mesh(root,m.dark,'星光桥 · 桥板底面',true);
  along(path,3,1,(x,z,dx,dz)=>{
    girders.at(x,1.98,z,width-.8,.23,.16,Math.atan2(dx,dz));
  });
  along(path,24,13,(x,z,dx,dz)=>{
    const nx=-dz,nz=dx,angle=Math.atan2(dx,dz);
    for(const side of [-1,1]){
      const cx=x+nx*width*.24*side,cz=z+nz*width*.24*side;
      feet.at(cx,.17,cz,1.45,.32,2.4,angle);
      for(const fore of [-1,1]){
        legs.between(cx,.26,cz,cx+dx*fore*.92+nx*side*.48,1.95,cz+dz*fore*.92+nz*side*.48,.24);
      }
    }
    girders.at(x,1.89,z,width-.75,.33,.60,angle);
  });
  for(const batch of [legs,girders,ties,feet,fascia,chord,bearings])batch.flush(root,true);
}

export function starBridge(root,rd,m,grid){
  const s=new Surface(),paint=new Surface(),lane=new Surface(),p=rd.p,h=2.4,w=rd.width||13;
  bridgeFrame(root,p,w,m);
  const columns=columnsOnBridge(p),canvas=document.createElement('canvas');
  const [x0,z0,x1,z1]=bounds(p),left=x0-7,top=z0-7;
  canvas.width=Math.ceil((x1-left+7)*2);canvas.height=Math.ceil((z1-top+7)*2);
  const spillBounds=new T.Vector4(left,top,2/canvas.width,2/canvas.height),ctx=canvas.getContext('2d');
  ctx.fillStyle='black';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='lighter';
  for(const {x,z} of columns.filter(c=>c.onDeck)){
    const u=(x-left)*2,v=(z-top)*2,g=ctx.createRadialGradient(u,v,0,u,v,8.8);
    g.addColorStop(0,'#cecece');g.addColorStop(.37,'#525252');g.addColorStop(1,'#000');
    ctx.fillStyle=g;ctx.fillRect(u-9,v-9,18,18);
  }
  const spill=new T.CanvasTexture(canvas);spill.flipY=false;
  const column=m.parkLights.finish(columnMaterial(),columnLightIntensity);
  const wood=decking(spill,spillBounds,{get value(){return column.emissiveIntensity/columnLightIntensity;}});
  ribbon(s,p,w+.016,h+.012,1.93);
  // The planks cross the walking direction in IMG_0233. Use both ends of
  // each span so the timber grain also has scale on a two-node centreline.
  let run=0;
  for(let i=1;i<p.length;i++){
    const next=run+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]),k=(i-1)*8;
    s.uv.splice(k,8,0,run/1.93,0,next/1.93,w/1.93,next/1.93,w/1.93,run/1.93);
    run=next;
  }
  s.mesh(root,wood,'星光桥 · 湿润实木桥面');
  // The jogging strip occupies the east side of the deck. Store its offset
  // relative to the actual first-to-last direction of the OSM centreline.
  const vz=p[p.length-1][1]-p[0][1],side=vz>0?-1:1;
  const offset=side*(w*.5-2.55),laneWidth=2.06;
  ribbon(lane,p,laneWidth,h+.019,3.1,offset);
  for(const q of [-1,1])ribbon(paint,p,.095,h+.024,3,offset+q*laneWidth*.5);
  const blue=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x3b84be,roughness:.88,side:T.DoubleSide});
  lane.mesh(root,blue,'环湖蓝色慢跑带');paint.mesh(root,m.paint,'跑道白边');
  for(const c of columns){
    if(!c.onDeck)c.base=Math.max(grid.southWalk.heightAt(c.x,c.z)??0,grid.starLandings?.heightAt(c.x,c.z)??0);
  }
  root.userData.talentReady=engravedFaces(root,columns,m);
  const post=new Instances(new T.CylinderGeometry(1,1,1,48,1),column,'穿孔星光柱');
  const satin=architecturalMetal(0xafb9b9,.24,'bridge'),steel=architecturalMetal(0x5e6f70,.28,'bridge');
  const cap=new Instances(new T.CylinderGeometry(1,1,1,24,1),satin,'圆形不锈钢柱脚');
  const screws=new Instances(new T.CylinderGeometry(1,1,1,6),steel,'地脚紧固件');
  const seams=new Instances(new T.BoxGeometry(1,1,1),steel,'铭牌侧接缝');
  const pins=new Instances(new T.SphereGeometry(1,8,5),satin,'金属铭牌沉头螺钉');
  const timberCap=bridgeHandrail(),plate=new Instances(new T.BoxGeometry(),satin,'栏杆柱脚、桥面伸缩缝压条');
  const expansion=new Instances(new T.BoxGeometry(),m.dark,'桥面弹性伸缩缝');
  const handrail=new Instances(new T.CylinderGeometry(1,1,1,10,1,true),steel,'深色扶手');
  const wire=new Instances(new T.CylinderGeometry(1,1,1,4,1,true),satin,'细钢索水平防护');
  const whiteFin=new T.MeshStandardMaterial({color:0xd8dad6,metalness:.36,roughness:.36});
  const bevel=new Instances(new T.BoxGeometry(.42,1,.88),whiteFin,'星光桥 · V形白色斜撑栏柱');
  const kick=new Instances(new T.BoxGeometry(1,1,1),m.kerb,'星光桥 · 倒角花岗石边石');
  for(const flank of [-1,1]){
    const off=(w*.5-.12)*flank;
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
      const ox=nx*off,oz=nz*off;
      timberCap.span(a[0]+ox,h+1.185,a[1]+oz,b[0]+ox,h+1.185,b[1]+oz);
      handrail.between(a[0]+ox,h+1.13,a[1]+oz,b[0]+ox,h+1.13,b[1]+oz,.048);
      for(let k=1;k<=6;k++)wire.between(a[0]+ox,h+.22+k*.132,a[1]+oz,b[0]+ox,h+.22+k*.132,b[1]+oz,.009);
      kick.at((a[0]+b[0])*.5+ox,h+.12,(a[1]+b[1])*.5+oz,.22,.24,l+.015,Math.atan2(dx,dz));
    }
    along(p,2.72,.2,(x,z,dx,dz)=>{
      const nx=-dz,nz=dx,ox=nx*off,oz=nz*off;
      const px=x+ox,pz=z+oz,yaw=Math.atan2(dx,dz);
      plate.at(px,h+.245,pz,.18,.026,.22,yaw);
      for(const sign of [-1,1])screws.at(px+sign*(dx*.07+nx*.05),h+.262,pz+sign*(dz*.07+nz*.05),.014,.018,.014,yaw);
      // Paired V-shaped white inclined stanchions matching IMG_0272
      bevel.between(px-dx*.04,h+.25,pz-dz*.04,px-dx*.44,h+1.11,pz-dz*.44,.078);
      bevel.between(px+dx*.04,h+.25,pz+dz*.04,px+dx*.44,h+1.11,pz+dz*.44,.078);
    });
  }
  for(const {x,z,dx,dz,base,yaw,record} of columns){
    const {height,radius,bottom,top}=sleeve;
    m.parkLights.fixture(x,base+1.48,z,columnLightColor,14,8.5);
    post.at(x,base+height/2,z,radius,height,radius,yaw+record.field.index*2.39996);
    cap.at(x,base+.018,z,radius+.026,.032,radius+.026,yaw);
    cap.at(x,base+height,z,radius,.014,radius,yaw);
    for(const sign of [-1,1]){
      const px=x+sign*(radius+.001)*dx,pz=z+sign*(radius+.001)*dz;
      seams.at(px,base+(top+bottom)/2,pz,.003,top-bottom,.003,yaw);
      for(const y of [bottom+.042,top-.042])pins.at(px,base+y,pz,.005,.005,.005,yaw);
    }
  }
  along(p,24,13,(x,z,dx,dz)=>{const yaw=Math.atan2(dx,dz);
    expansion.at(x,h+.026,z,w-.30,.01,.047,yaw);
    for(const sign of [-1,1])plate.at(x+dx*sign*.034,h+.027,z+dz*sign*.034,w-.30,.009,.018,yaw);
  });
  const railPath=p[0][1]<p.at(-1)[1]?p:[...p].reverse();
  const buoy=routePoint(railPath,124,w/2-.22);
  const ring=new T.Mesh(new T.TorusGeometry(.252,.052,10,44),new T.MeshStandardMaterial({color:0xc84424,roughness:.82}));
  ring.name='星光桥 · 湖侧救生圈';ring.position.set(buoy.x,h+.63,buoy.z);ring.rotation.y=Math.atan2(buoy.dz,-buoy.dx);root.add(ring);
  const signMap=new T.TextureLoader().load('/talent/field/rail-sign.webp');signMap.colorSpace=T.SRGBColorSpace;
  const signMat=new T.MeshStandardMaterial({map:signMap,alphaTest:.32,roughness:.78,side:T.DoubleSide});
  const signGeo=new T.PlaneGeometry(.47,.49);
  for(const station of [26.0,179.3]){
    const q=routePoint(railPath,station,w/2-.19),sign=new T.Mesh(signGeo,signMat);
    sign.name='星光桥 · 实拍蓝色护栏提示牌';sign.position.set(q.x,h+.71,q.z);sign.rotation.y=Math.atan2(q.dz,-q.dx);root.add(sign);
  }
  timberCap.finish(root);
  post.flush(root,true).receiveShadow=false;
  [cap,screws,seams,pins,handrail,wire,bevel,kick,plate,expansion].forEach(obj=>obj.flush(root,obj===bevel));
  return columns;
}

