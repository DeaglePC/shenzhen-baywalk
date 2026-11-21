import * as T from 'three';
import {Surface,Instances,ribbon,along,random} from './city-geometry.js';
import {photo} from './city-materials.js';
import {architecturalMetal} from './city-curtainwall.js';

function columnMaterial(){
  const rng=random(2453),w=512,h=1536;
  const contexts=Array.from({length:4},()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c.getContext('2d');});
  const [albedo,rough,metal,glow]=contexts;
  albedo.fillStyle='#3d4546';albedo.fillRect(0,0,w,h);
  rough.fillStyle='#a2a2a2';metal.fillStyle='#d4d4d4';glow.fillStyle='#000';
  for(const c of [rough,metal,glow])c.fillRect(0,0,w,h);
  // Scattered apertures in the powder-coated cylindrical sleeve. The bright
  // acrylic core is slightly recessed inside the dark countersunk rim.
  for(let i=0;i<640;i++){
    const y=rng()*h;if(y>h*.52&&y<h*.76)continue;
    const x=rng()*w,r=2.2+Math.pow(rng(),2.7)*9.6,light=.4+rng()*.57;
    for(const xx of [x-w,x,x+w]){
      for(const [c,radius,color] of [[albedo,r+1.6,'#172124'],[albedo,r+.48,'#87918f'],[albedo,r-.15,'#ccd4cc'],[metal,r,'#242424'],[rough,r,'#4b4b4b'],[glow,r-.3,'rgba(210,231,232,'+light+')']]){
        c.fillStyle=color;c.beginPath();c.arc(xx,y,radius,0,Math.PI*2);c.fill();
      }
    }
  }
  const c1=h*.52,c2=h*.76;
  albedo.fillStyle='#a5aca3';albedo.fillRect(0,c1,w,c2-c1);
  for(let i=0;i<1150;i++){const l=Math.floor(100+rng()*100);albedo.fillStyle='rgba('+l+','+Math.min(255,l+2)+','+l+',.15)';albedo.fillRect(rng()*w,c1+rng()*(c2-c1),10+rng()*120,.45);}
  albedo.fillStyle='#434c4c';albedo.textAlign='center';albedo.font='500 24px "Microsoft YaHei",sans-serif';albedo.fillText('人才星光桥',w*.52,c1+118);
  albedo.font='11px Arial';albedo.fillText('STARLIGHT BRIDGE',w*.52,c1+142);
  albedo.font='13px "Microsoft YaHei",sans-serif';albedo.fillText('深圳人才公园',w*.52,c1+204);albedo.font='10px Arial';albedo.fillText('NANSHAN · SHENZHEN',w*.52,c1+226);
  for(const y of [c1,c2]){albedo.fillStyle='#4e5654';albedo.fillRect(0,y,w,2);}
  rough.fillStyle='#696969';rough.fillRect(0,c1,w,c2-c1);
  const tx=contexts.map((c,i)=>{const t=new T.CanvasTexture(c.canvas);t.colorSpace=i===0||i===3?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=T.RepeatWrapping;t.anisotropy=8;return t;});
  const mat=new T.MeshPhysicalMaterial({map:tx[0],roughnessMap:tx[1],metalnessMap:tx[2],emissiveMap:tx[3],roughness:.73,metalness:.88,clearcoat:.26,clearcoatRoughness:.22,emissive:0xc9e5e6,emissiveIntensity:.20});
  mat.userData.cityProbe='bridge';mat.name='星光柱 · 穿孔金属与透光树脂';return mat;
}
// Timber scan (CC0) https://polyhaven.com/a/wood_floor_deck
function decking(){
  const color=photo('bridge-deck-color.webp'),norm=photo('bridge-deck-normal.webp'),arm=photo('bridge-deck-arm.webp');
  norm.colorSpace=arm.colorSpace=T.NoColorSpace;
  const mat=new T.MeshPhysicalMaterial({map:color,normalMap:norm,roughnessMap:arm,aoMap:arm,aoMapIntensity:.65,roughness:.73,metalness:.035,
    normalScale:new T.Vector2(.57,.57),clearcoat:.64,clearcoatRoughness:.23,envMapIntensity:1.12,side:T.DoubleSide});
  mat.userData.cityProbe='bridge';
  mat.onBeforeCompile=shader=>{
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

export function starBridge(root,rd,m){
  const s=new Surface(),paint=new Surface(),lane=new Surface(),wood=decking(),p=rd.p,h=2.4,w=rd.width||13;
  ribbon(s,p,w+.016,h+.012,1.93);
  for(let i=0;i<s.uv.length;i+=2){const u=s.uv[i];s.uv[i]=s.uv[i+1];s.uv[i+1]=u;}
  s.mesh(root,wood,'星光桥 · 湿润实木桥面');
  // The jogging strip occupies the east side of the deck. Store its offset
  // relative to the actual first-to-last direction of the OSM centreline.
  const vz=p[p.length-1][1]-p[0][1],side=vz>0?-1:1;
  const offset=side*(w*.5-2.55),laneWidth=2.06;
  ribbon(lane,p,laneWidth,h+.019,3.1,offset);
  for(const q of [-1,1])ribbon(paint,p,.095,h+.024,3,offset+q*laneWidth*.5);
  const blue=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x4599b6,roughness:.87,side:T.DoubleSide});
  lane.mesh(root,blue,'环湖蓝色慢跑带');paint.mesh(root,m.paint,'跑道白边');
  const column=columnMaterial();m.walls.push(column);
  const post=new Instances(new T.CylinderGeometry(.98,1,1,32,1),column,'穿孔星光柱');
  const satin=architecturalMetal(0xafb9b9,.24,'bridge'),steel=architecturalMetal(0x5e6f70,.28,'bridge');
  const cap=new Instances(new T.CylinderGeometry(1,1,1,24,1),satin,'圆形不锈钢柱脚');
  const screws=new Instances(new T.CylinderGeometry(1,1,1,6),steel,'地脚紧固件');
  const handrail=new Instances(new T.CylinderGeometry(1,1,1,10,1,true),steel,'深色扶手');
  const wire=new Instances(new T.CylinderGeometry(1,1,1,4,1,true),satin,'细钢索水平防护');
  const bevel=new Instances(new T.BoxGeometry(.77,1,1.25),satin,'斜撑扁钢');
  const kick=new Instances(new T.BoxGeometry(1,1,1),satin,'桥面边缘收口');
  for(const flank of [-1,1]){
    const off=(w*.5-.1)*flank;
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
      const ox=nx*off,oz=nz*off;
      handrail.between(a[0]+ox,h+1.13,a[1]+oz,b[0]+ox,h+1.13,b[1]+oz,.055);
      for(let k=1;k<=6;k++)wire.between(a[0]+ox,h+.17+k*.131,a[1]+oz,b[0]+ox,h+.17+k*.131,b[1]+oz,.009);
      kick.at((a[0]+b[0])*.5+ox,h+.105,(a[1]+b[1])*.5+oz,.09,.21,l+.015,Math.atan2(dx,dz));
    }
    along(p,2.72,.2,(x,z,dx,dz)=>{
      const nx=-dz,nz=dx,ox=nx*off,oz=nz*off;
      bevel.between(x+ox-dx*.17-nx*flank*.12,h+.15,z+oz-dz*.17-nz*flank*.12,x+ox+dx*.2,h+1.10,z+oz+dz*.2,.108);
    });
    along(p,9.2,5,(x,z,dx,dz)=>{
      const ox=-dz*(11.8*.5-.38)*flank,oz=dx*(11.8*.5-.38)*flank,rot=Math.atan2(dx,dz);
      const plaqueYaw=Math.atan2(-dz*flank,dx*flank);post.at(x+ox,h+2.10,z+oz,.216,4.20,.216,plaqueYaw);cap.at(x+ox,h+.036,z+oz,.265,.062,.265,rot);
      for(let k=0;k<4;k++){const a=rot+Math.PI*.5*k;screws.at(x+ox+.238*Math.sin(a),h+.077,z+oz+.238*Math.cos(a),.014,.013,.014,rot);}
      cap.at(x+ox,h+4.20,z+oz,.212,.020,.212,rot);
    });
  }
  [post,cap,screws,handrail,wire,bevel,kick].forEach(obj=>obj.flush(root,obj===post||obj===bevel));
}

