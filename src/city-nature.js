import * as T from 'three';
import {Instances,Surface,along,random,inArea,segmentDistance,clamp} from './city-geometry.js';
import {asset,label} from './city-materials.js';
import {volumetricTrees} from './foliage-volume.js';
import localCrowns from './foliage-samples.json';
const TAU=Math.PI*2;
const leafy=new Set(['grass','park','forest','wood','scrub','garden','nature_reserve','recreation_ground','greenfield','flowerbed','common','golf_course']);
function makeBillboards(scene,plants,photoName,ratio){
  if(!plants.length)return;
  let finish;
  const ready=new Promise(resolve=>{finish=resolve;});
  const tex=new T.TextureLoader().load(asset(photoName+'.webp'),finish,undefined,finish);tex.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,alphaTest:.235,transparent:false,color:0xf5f3da});
  mat.userData.photoReady=ready;
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec3 plantCenter = instanceMatrix[3].xyz;
      vec3 eyeDir = normalize(cameraPosition-plantCenter);
      vec2 orient = normalize(eyeDir.xz+vec2(0.0001,0.0001));
      vec3 plantRight=vec3(orient.y,0.,-orient.x);
      float topView=smoothstep(0.55,1.,eyeDir.y)*0.75;
      vec3 plantUp=normalize(mix(vec3(0,1,0),normalize(cross(eyeDir,plantRight)),topView));
      vec3 plantWorld=plantCenter+plantRight*position.x*instanceMatrix[0].x+plantUp*position.y*instanceMatrix[1].y;
      vec4 mvPosition = viewMatrix * modelMatrix * vec4(plantWorld,1.);
      gl_Position=projectionMatrix*mvPosition;
    `);
  };
  const geometry=new T.PlaneGeometry(1,1);geometry.translate(0,.5,0);
  const mesh=new T.InstancedMesh(geometry,mat,plants.length),M=new T.Matrix4(),color=new T.Color();mesh.name='树冠 · '+photoName;
  plants.forEach((p,i)=>{
    p.photoX=p[2]*ratio*(p[3]>.5?-1:1);p.mesh=mesh;p.slot=i;
    M.makeScale(p.photoX,p[2],p[2]);M.setPosition(p[0],.05,p[1]);mesh.setMatrixAt(i,M);
    color.setRGB(.92+.27*p[3],1.03+.24*p[3],.85+.15*p[3]);mesh.setColorAt(i,color);
  });
  mesh.computeBoundingSphere();scene.add(mesh);return mat;
}
function palmGeo(){
  const surf=new Surface(),R=random(342),col=new T.Color();
  for(let k=0;k<13;k++){
    const a=k*TAU/13+R()*.36,len=2.7+1.1*R(),rise=1.02+R()*.7;
    const at=t=>[Math.sin(a)*len*t,Math.sin(t*Math.PI*.98)*rise-1.08*t*t,Math.cos(a)*len*t];
    const sine=Math.sin(a),cos=Math.cos(a);
    for(let n=0;n<18;n++){
      let t=.025+n*.051,base=at(t),next=at(t+.05),long=(.16+.77*Math.sin(Math.PI*t)**.65)*(1-.35*t);
      col.setRGB(.12+.07*R(),.24+.12*R(),.078+.055*R());
      surf.quad([base[0]-.025*cos,base[1],base[2]+.025*sine],[next[0]-.015*cos,next[1],next[2]+.015*sine],[next[0]+.015*cos,next[1],next[2]-.015*sine],[base[0]+.025*cos,base[1],base[2]-.025*sine],undefined,col);
      for(const side of [-1,1]){
        const tip=[base[0]+cos*side*long+sine*.29,base[1]-.37*long,base[2]-sine*side*long+cos*.29];
        const mid=[base[0]+cos*side*long*.62+sine*.06,base[1]+.08,base[2]-sine*side*long*.62+cos*.06];
        surf.quad(base,mid,tip,next,undefined,col);
      }
    }
  }
  return surf.geometry();
}
function underplanting(){
  const s=new Surface(),rng=random(9121),color=new T.Color();
  for(let i=0;i<52;i++){
    const a=rng()*TAU,r=.10*Math.sqrt(rng()),x=Math.cos(a)*r,z=Math.sin(a)*r;
    const out=.1+rng()*.19,height=.18+rng()*.22,w=.009+rng()*.009,c=Math.cos(a),d=Math.sin(a);
    let lx=x,lz=z,ly=0,lw=w*.75;
    for(let j=1;j<=3;j++){
      const t=j/3,nx=x+c*out*t*t,nz=z+d*out*t*t,ny=height*Math.sin(t*2.03),nw=w*(1-t*.99);
      color.setRGB(.025+.046*t,.085+.125*t+rng()*.015,.022+.035*t);
      s.quad([lx-d*lw,ly,lz+c*lw],[lx+d*lw,ly,lz-c*lw],[nx+d*nw,ny,nz-c*nw],[nx-d*nw,ny,nz+c*nw],undefined,color);
      lx=nx;lz=nz;ly=ny;lw=nw;
    }
  }
  return s.geometry();
}
export function furnishing(root,map,m,grid,canopy=[]){
  const rand=random(70717), species=[[],[],[],[],[]], affected=[];
  const cube=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,5,1,true);
  const poles=new Instances(cylinder,m.dark,'街灯与信号灯杆'),metal=new Instances(cylinder,m.rail,'金属立柱'),lamps=new Instances(cube,m.lamp,'灯具'),frames=new Instances(cube,m.dark,'城市家具底座'),wood=new Instances(cube,m.wood,'座椅木条');
  const palms=new Instances(palmGeo(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82}),'棕榈叶冠');
  const trunks=new Instances(new T.CylinderGeometry(.72,1,1,8,3),m.trunk,'棕榈树干');
  const shadows=[],spots=new Set();let palmCount=0;
  const contains=(index,x,z)=>index.query(x,z).some(f=>inArea(x,z,f));
  function plant(x,z,height,type,allowPalm=false,street=false){
    const cell=(x/3|0)+','+(z/3|0);if(spots.has(cell)||contains(grid.water,x,z)||contains(grid.buildings,x,z))return;
    const overlaps=grid.roads.query(x,z).some(s=>s.y<1&&segmentDistance(x,z,s.a,s.b)<s.width/2+.37);
    if(overlaps)return;spots.add(cell);
    if(allowPalm&&palmCount<360&&Math.hypot(x,z)<1750){
      const h=height*.87,r=.19+.07*rand();trunks.at(x,h*.5,z,r,h,r,rand()*TAU);const sz=.83+rand()*.41;palms.at(x,h-.15,z,sz,sz,sz,rand()*TAU);palmCount++;
    }else{
      const tree=[x,z,height,rand()];tree.street=street;if(street)tree.species=tree[3]>.32?1:0;
      species[type].push(tree);
    }
    if(type<3&&Math.abs(x)<1700&&Math.abs(z)<1700)shadows.push([x+.55,z+.29,height*(type===0?.35:.47)]);
    return true;
  }
  if(canopy.length){
    for(const [x,z,h] of [...canopy,...localCrowns]){
      const nearby=grid.roads.query(x,z);
      const avenue=h<13&&nearby.some(s=>s.width>8&&s.y<1&&segmentDistance(x,z,s.a,s.b)<s.width*.5+7);
      plant(x,z,h,rand()<.7?2:rand()*2|0,avenue&&rand()<.42);
    }
  }
  // Dengliang Road's main carriageways have separate frontage roads. Place
  // small roadside trees only on outer landing strips with a clear trunk site.
  const treeBeds=new Instances(new T.CylinderGeometry(1,1,1,16),
    new T.MeshStandardMaterial({color:0x49382a,roughness:1}),'行道树种植穴');
  const edging=new Instances(new T.TorusGeometry(1,.055,5,24).rotateX(-Math.PI/2),
    new T.MeshStandardMaterial({color:0x9d9786,roughness:.94}),'树池边缘');
  const stakes=new Instances(new T.CylinderGeometry(.74,1,1,6),
    new T.MeshStandardMaterial({color:0x795c42,roughness:.98}),'行道树木支撑');
  const groundCover=new Instances(underplanting(),new T.MeshStandardMaterial({vertexColors:true,
    roughness:.84,side:T.DoubleSide}),'树下沿阶草');
  const original=species.slice(0,3).flat().filter(p=>Math.hypot(p[0]+122,p[1]+418)<210);
  for(const road of map.roads){
    if(road.id!==1436530936&&road.id!==1190795443)continue;
    along(road.p,11,7,(x,z,dx,dz,distance)=>{
      const px=x-dz*(road.width*.5+1.45),pz=z+dx*(road.width*.5+1.45);
      const d=Math.hypot(px+121.8,pz+418.1);
      if(d<5.8||d>142||original.some(p=>Math.hypot(px-p[0],pz-p[1])<5.4))return;
      const height=6.0+.95*Math.sin(distance*.113)+(road.id===1190795443?1.25:0);
      if(!plant(px,pz,height,0,false,true))return;
      treeBeds.at(px,.27,pz,.82,.10,.81);edging.at(px,.319,pz,.85,.60,.84);
      const angle=distance*.357;
      for(let j=0;j<3;j++){
        const a=angle+j*TAU/3,s=Math.sin(a),c=Math.cos(a);
        stakes.between(px+s*.57,.30,pz+c*.57,px+s*.15,1.68,pz+c*.15,.035);
      }
      for(let j=0;j<7;j++){
        const a=j*TAU/7+angle,s=.79+.18*rand();
        groundCover.at(px+Math.cos(a)*.56,.31,pz+Math.sin(a)*.56,s,s,s,angle+j*2.7);
      }
    });
  }
  for(const batch of [treeBeds,edging,stakes,groundCover])batch.flush(root,true);
  for(const f of map.land){
    if(!leafy.has(f.kind))continue;const b=f.bbox,bb=(b[2]-b[0])*(b[3]-b[1]);
    let density=['forest','wood','scrub','garden'].includes(f.kind)?1/125:1/430;
    if(f.kind==='grass'||f.kind==='flowerbed')density=1/620;
    const count=Math.min(8300,Math.ceil(bb*density));
    for(let i=0;i<count;i++){
      const x=b[0]+rand()*(b[2]-b[0]),z=b[1]+rand()*(b[3]-b[1]);
      if(!inArea(x,z,f))continue;
      let shrub=rand()<.21;if(canopy.length&&!shrub)continue;const type=shrub?3+(rand()*2|0):rand()<.63?2:rand()*2|0;
      plant(x,z,shrub?.7+rand()*1.5:4.9+rand()*6,type);
    }
  }
  const signage=new Map(),objColor=new T.Color('#417c75');
  const streetSign=(name,english,x,y,z,angle)=>{
    const key=name+' '+english;
    if(!signage.has(key))signage.set(key,new Instances(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({map:label(name,english,640,'#266c71'),side:T.DoubleSide,roughness:.61}),'路牌 · '+name));
    signage.get(key).at(x,y,z,2.46,.71,1,angle);
  };
  let lights=0,benches=0;
  const mainRoad=new Set(['residential','primary','secondary','tertiary','pedestrian','unclassified']);
  for(const rd of map.roads){
    if(rd.bridge||rd.layer<0||rd.p.length<2)continue;
    const major=mainRoad.has(rd.kind), walk=rd.kind==='footway'||rd.kind==='path',near=rd.p.some(p=>Math.hypot(...p)<820);
    if(!major&&!(walk&&near))continue;
    const interval=major?21:33;
    along(rd.p,interval,4+rand()*11,(x,z,dx,dz,distance)=>{
      const d=Math.hypot(x,z);if(d>2200&&!major)return;
      const side=Math.round(distance/interval)%2===0?-1:1,w=rd.width/2;
      const pX=x-dz*(w+2.6)*side,pZ=z+dx*(w+2.6)*side;
      if(!canopy.length&&d<1900&&rand()<.87)plant(pX,pZ,5+rand()*4,rand()<.6?2:rand()*2|0,major&&near&&rand()<.48);
      if(walk&&!near)return;
      const h=major?8.35:4.35,px=x-dz*(w+.73)*side,pz=z+dx*(w+.73)*side;
      if(contains(grid.water,px,pz)||contains(grid.buildings,px,pz))return;
      const index=Math.floor(distance/interval);
      if((major&&index%2===0||walk&&index%3===0)&&lights<3500){
        lights++;
        poles.between(px,.16,pz,px,h,pz,major?.092:.063);
        const lx=px+dz*side*(major?1.65:.42),lz=pz-dx*side*(major?1.65:.42);
        poles.between(px,h-.25,pz,lx,h+.10,lz,.052);
        lamps.at(lx,h+.08,lz,.23,.13,major?.91:.42,Math.atan2(dx,dz)+Math.PI/2);
        if(major&&near&&index%8===0&&rd.name&&rd.name.length<13&&signage.size<=24){
          streetSign(rd.name,{'科苑南路':'KEYUAN SOUTH RD','海德三道':'HAIDE 3RD RD','东滨路':'DONGBIN RD','登良路':'DENGLIANG RD','创业路':'CHUANGYE RD','望海路':'WANGHAI RD'}[rd.name]||'NANSHAN  ·  SHENZHEN',px,3.2,pz,Math.atan2(dx,dz));
        }
      }
      if(walk&&index%3===1&&near&&benches<240){
        benches++;const rot=Math.atan2(dx,dz),ox=-dz*side,oz=dx*side;
        for(const off of [-.7,.7]){frames.at(px+dx*off,.25,pz+dz*off,.46,.48,.09,rot);}
        for(let j=0;j<4;j++){const off=(j-1.5)*.12;wood.at(px+ox*off,.52,pz+oz*off,.1,.075,1.92,rot);}
        wood.at(px+ox*.22,.87,pz+oz*.22,.07,.2,1.92,rot);
        frames.at(px+dx*1.86,.53,pz+dz*1.86,.38,1.01,.45,rot);
      }
    });
  }
  const ratios=[.93,1.5,1.33,.95,1];['island_tree_01','island_tree_02','jacaranda_tree','shrub_02','shrub_03'].forEach((n,i)=>{const mat=makeBillboards(root,species[i],n,ratios[i]);if(mat)affected.push(mat);});
  root.userData.foliageReady=Promise.all([volumetricTrees(root,species.slice(0,3).flat()),...affected.map(a=>a.userData.photoReady)]);
  if(shadows.length){
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),rad=g.createRadialGradient(32,32,1,32,32,32);rad.addColorStop(0,'rgba(36,40,23,.66)');rad.addColorStop(.32,'rgba(34,44,28,.36)');rad.addColorStop(1,'rgba(32,46,27,0)');g.fillStyle=rad;g.fillRect(0,0,64,64);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);const batch=new Instances(geo,new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),'树下环境阴影');
    for(const [x,z,r] of shadows)batch.at(x,.115,z,r*2.1,1,r*1.64,0);batch.flush(root);
  }
  for(const obj of [poles,metal,lamps,frames,wood,palms,trunks,...signage.values()])obj.flush(root,obj===trunks||obj===frames,obj===palms||obj===trunks?1200:440);
  return affected;
}
