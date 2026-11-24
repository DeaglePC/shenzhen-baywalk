import * as T from 'three';
import {Instances,Surface,along,random,inArea,segmentDistance,clamp} from './city-geometry.js';
import {streetFurniture} from './street-furniture.js';
import {asset} from './city-materials.js';
import {volumetricTrees} from './foliage-volume.js';
import {atStation,footRoad} from './road-profiles.js';
import localCrowns from './foliage-samples.json';
import parkInfill from './park-infill.json';
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
    let spread=1;
    if(!photoName.startsWith('shrub')){
      const form=random(Math.round(p[0]*1613+p[1]*7229));
      p.crownWidth=p.street?.91+.17*form():.77+.43*form();
      p.crownDepth=.83+.31*form();
      spread=Math.sqrt(p.crownWidth*p.crownDepth);
    }
    p.photoX=p[2]*ratio*spread*(p[3]>.5?-1:1);p.mesh=mesh;p.slot=i;
    M.makeScale(p.photoX,p[2],p[2]);M.setPosition(p[0],p.baseY??.05,p[1]);mesh.setMatrixAt(i,M);
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
// Tall Washingtonia fan palm (华盛顿棕榈 / 老人葵) crown matching Shenzhen Talent Park groves.
function fanPalmCrownGeo(){
  const surf=new Surface(),R=random(3831),col=new T.Color();
  const total=30;
  for(let k=0;k<total;k++){
    const layer=k/total;
    const a=k*2.399963+R()*.22;
    const sx=Math.sin(a),sz=Math.cos(a);
    const rx=sz,rz=-sx;
    // Upper fronds reach up and out; outer/lower fronds spread wider and droop.
    const petiole=1.08+layer*.76+R()*.30;
    const elev=(1.02-layer*1.28)+(R()-.5)*.20;
    const sag=.16+layer*.56;
    const tipX=sx*petiole,tipY=Math.sin(elev)*petiole-sag,tipZ=sz*petiole;
    const midX=tipX*.52,midY=tipY*.58+.15,midZ=tipZ*.52;
    // Petiole stalk
    const pw=.036;
    col.setRGB(.13+.03*R(),.20+.04*R(),.07+.02*R());
    surf.quad([-rx*pw,-.06,-rz*pw],[rx*pw,-.06,rz*pw],[midX+rx*pw*.7,midY,midZ+rz*pw*.7],[midX-rx*pw*.7,midY,midZ-rz*pw*.7],undefined,col);
    surf.quad([midX-rx*pw*.7,midY,midZ-rz*pw*.7],[midX+rx*pw*.7,midY,midZ+rz*pw*.7],[tipX+rx*pw*.45,tipY,tipZ+rz*pw*.45],[tipX-rx*pw*.45,tipY,tipZ-rz*pw*.45],undefined,col);
    // Palmate fan segments radiating from the petiole tip with natural drooping fingers
    const dry=layer>.85&&R()<.46;
    const fanR=.86+R()*.32-(layer>.82?.12:0);
    const fingers=9;
    for(let f=0;f<fingers;f++){
      const u=(f/(fingers-1))*2-1; // -1..1 across the fan
      const fanAng=u*1.08;
      const forward=Math.cos(fanAng),side=Math.sin(fanAng);
      const dirX=sx*forward+rx*side,dirZ=sz*forward+rz*side;
      const segLen=fanR*(1-.14*u*u)*(.9+.2*R());
      const pitch=.32-layer*.60-.18*Math.abs(u);
      const p1=[tipX+dirX*segLen*.54,tipY+pitch*segLen*.48-.09*segLen,tipZ+dirZ*segLen*.54];
      const p2=[tipX+dirX*segLen,tipY+pitch*segLen*.40-.50*segLen*(.68+layer*.62),tipZ+dirZ*segLen];
      const w=.125+(.045*(1-Math.abs(u)));
      const sideX=-dirZ*w,sideZ=dirX*w;
      const pleat=(f%2===0?.04:-.035);
      const shade=.74+.32*R();
      if(dry)col.setRGB(.30*shade,.24*shade,.13*shade);
      else col.setRGB((.075+.042*R())*shade,(.165+.078*R())*shade,(.048+.030*R())*shade);
      const base=[tipX,tipY,tipZ];
      const left=[p1[0]-sideX,p1[1]+pleat,p1[2]-sideZ];
      const right=[p1[0]+sideX,p1[1]+pleat,p1[2]+sideZ];
      surf.quad(base,left,p2,right,undefined,col);
    }
  }
  return surf.geometry();
}
// Shaggy dark-brown dead-frond petticoat sheath wrapped below the Washingtonia crown.
function fanPalmSkirtGeo(){
  const surf=new Surface(),R=random(3832),col=new T.Color();
  const layers=10,fronds=14;
  for(let r=0;r<layers;r++){
    const t=r/(layers-1);
    const y0=-t*.84;
    const len=.22+.12*R();
    const baseRad=.21+(1-t)*.07;
    for(let s=0;s<fronds;s++){
      const a=(s+(r%2)*.5)*TAU/fronds+(R()-.5)*.18;
      const sx=Math.sin(a),sz=Math.cos(a),rx=sz,rz=-sx;
      const w=.055+.025*R();
      const out=baseRad+.03+.065*R()*(1-t*.35);
      const shade=.60+.48*R();
      col.setRGB(.145*shade,.105*shade,.068*shade);
      const p0=[sx*baseRad-rx*w,y0,sz*baseRad-rz*w];
      const p1=[sx*baseRad+rx*w,y0,sz*baseRad+rz*w];
      const p2=[sx*out+rx*(w*.35),y0-len,sz*out+rz*(w*.35)];
      const p3=[sx*out-rx*(w*.35),y0-len,sz*out-rz*(w*.35)];
      surf.quad(p0,p1,p2,p3,undefined,col);
    }
  }
  return surf.geometry();
}
function greyPalmTrunkMat(){
  const c=document.createElement('canvas');c.width=128;c.height=256;
  const g=c.getContext('2d'),rng=random(3839);
  g.fillStyle='#9e9b93';g.fillRect(0,0,128,256);
  // Subtle horizontal leaf-scar rings & weathered grey fibrous bark grain
  for(let y=0;y<256;y+=4){
    const ring=Math.sin(y*.65)*.5+.5;
    const v=Math.round(134+ring*28+(rng()-.5)*16);
    g.fillStyle=`rgb(${v+4},${v+1},${v-4})`;
    g.fillRect(0,y,128,2+Math.round(rng()*2));
  }
  for(let i=0;i<1400;i++){
    const v=Math.round(108+rng()*66);
    g.fillStyle=`rgba(${v+3},${v},${v-5},0.35)`;
    g.fillRect(rng()*128,rng()*256,2+rng()*6,1+rng()*3);
  }
  const tex=new T.CanvasTexture(c);
  tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(1.5,5.5);tex.anisotropy=4;
  return new T.MeshStandardMaterial({map:tex,roughness:.96});
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
export function furnishing(root,map,m,grid,canopy=[],lowQuality=false){
  const rand=random(70717), species=[[],[],[],[],[]], affected=[];
  const cube=new T.BoxGeometry(1,1,1),furniture=streetFurniture(root,m);
  const frames=new Instances(cube,m.dark,'城市家具底座'),wood=new Instances(cube,m.wood,'座椅木条');
  const palms=new Instances(palmGeo(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82}),'棕榈叶冠');
  const trunks=new Instances(new T.CylinderGeometry(.72,1,1,8,3),m.trunk,'棕榈树干');
  const fanTrunks=new Instances(new T.CylinderGeometry(.66,1,1,10,2),greyPalmTrunkMat(),'棕榈树干 · 华盛顿扇棕');
  const fanSkirts=new Instances(fanPalmSkirtGeo(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.98}),'棕榈叶鞘 · 枯叶裙');
  const fanCrowns=new Instances(fanPalmCrownGeo(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.84}),'棕榈叶冠 · 华盛顿扇棕');
  const shadows=[],spots=new Set();let palmCount=0,fanPalmCount=0;
  const park=map.land.find(f=>f.kind==='park'&&f.name?.includes('人才公园'));
  const nonLeafyKinds=new Set(['plaza','playground','parking','pitch','track','shingle','sand','beach','construction']);
  const parkNoTree=park?map.land.filter(f=>nonLeafyKinds.has(f.kind)&&f.bbox&&f.bbox[2]>park.bbox[0]&&f.bbox[0]<park.bbox[2]&&f.bbox[3]>park.bbox[1]&&f.bbox[1]<park.bbox[3]):[];
  const parkWoods=park?map.land.filter(f=>['wood','forest','garden','scrub'].includes(f.kind)&&f.bbox&&f.bbox[2]>park.bbox[0]&&f.bbox[0]<park.bbox[2]&&f.bbox[3]>park.bbox[1]&&f.bbox[1]<park.bbox[3]):[];
  const parkTurf=park?map.land.filter(f=>f.turfY>park.turfY):[];
  const contains=(index,x,z)=>index.query(x,z).some(f=>inArea(x,z,f));
  const inParkBlocked=(x,z)=>parkNoTree.some(f=>inArea(x,z,f));
  function plantBlocked(x,z,height,siteTree=false,roadPad=.37){
    if(grid.southWalk?.reservesPlant(x,z)||grid.tidal?.heightAt(x,z)!=null)return true;
    if(grid.flowerbed?.reservesPlant(x,z,height))return true;
    const landscape=grid.flowerLandscape,localGround=landscape?.heightAt(x,z);
    if(!siteTree&&(localGround!=null||landscape?.blocked(x,z)))return true;
    if(contains(grid.water,x,z)||contains(grid.buildings,x,z))return true;
    if(grid.tencentHardscape?.some(area=>inArea(x,z,area)))return true;
    const overlaps=grid.roads.query(x,z).some(s=>segmentDistance(x,z,s.a,s.b)<s.width/2+(s.y>=1?2.6:roadPad));
    if(overlaps||grid.platforms.areaAt(x,z)||grid.starLandings?.heightAt(x,z)!=null||grid.parkBridges?.heightAt(x,z)!=null||grid.parkDetails?.blocked(x,z)||grid.parkDetails?.onPromenade(x,z,.85))return true;
    return false;
  }
  function plantFanPalm(x,z,height,cellStep=3.4){
    if(plantBlocked(x,z,height,false,.95)||inParkBlocked(x,z))return false;
    const cell=Math.floor(x/cellStep)+','+Math.floor(z/cellStep);
    if(spots.has(cell))return false;
    spots.add(cell);
    const floor=grid.southGround?.heightAt(x,z)??(park?parkTurf.reduce((y,f)=>f.turfY>y&&inArea(x,z,f)?f.turfY:y,park.turfY):.04);
    const crownH=2.0+rand()*.65;
    const trunkH=Math.max(5.5,height-crownH);
    const baseR=.165+(.045*Math.min(1,(height-8)/8))+.022*rand();
    const yaw=rand()*TAU;
    fanTrunks.at(x,floor+trunkH*.5,z,baseR,trunkH,baseR,yaw);
    const skirtH=Math.min(trunkH*.38,2.2+rand()*1.35);
    const skirtR=baseR/.21;
    fanSkirts.at(x,floor+trunkH-.04,z,skirtR,skirtH,skirtR,yaw+rand()*.5);
    const crownS=.90+Math.min(.42,(height-9)*.052)+rand()*.24;
    fanCrowns.at(x,floor+trunkH+.12,z,crownS,crownS*(.92+rand()*.18),crownS,yaw+rand()*TAU);
    shadows.push([x+.55,z+.29,Math.min(3.2,1.5+crownS*1.05)]);
    fanPalmCount++;
    return true;
  }
  function plant(x,z,height,type,allowPalm=false,street=false,siteTree=false){
    const landscape=grid.flowerLandscape,localGround=landscape?.heightAt(x,z);
    if(plantBlocked(x,z,height,siteTree,.37))return;
    const cell=(x/3|0)+','+(z/3|0);if(spots.has(cell))return;spots.add(cell);
    if(allowPalm&&palmCount<720&&Math.hypot(x,z)<1750){
      const floor=grid.southGround?.heightAt(x,z)??0;
      const h=height*.87,r=.19+.07*rand();trunks.at(x,floor+h*.5,z,r,h,r,rand()*TAU);const sz=.83+rand()*.41;palms.at(x,floor+h-.15,z,sz,sz,sz,rand()*TAU);palmCount++;
    }else{
      const tree=[x,z,height,rand()];tree.street=street;
      const floor=localGround??grid.southGround?.heightAt(x,z);
      if(floor!=null)tree.baseY=floor;
      if(street)tree.species=tree[3]>.32?1:0;
      else if(type<2)tree.species=type;
      species[type].push(tree);
    }
    if(type<3&&Math.abs(x)<1700&&Math.abs(z)<1700)shadows.push([x+.55,z+.29,height*(type===0?.35:.47)]);
    return true;
  }
  if(canopy.length){
    for(const [x,z,h] of [...canopy,...localCrowns]){
      const nearby=grid.roads.query(x,z);
      const avenue=h<13&&nearby.some(s=>s.width>8&&s.y<1&&segmentDistance(x,z,s.a,s.b)<s.width*.5+7);
      const inTalent=park&&inArea(x,z,park)&&!inParkBlocked(x,z);
      // Scale up undersized park canopy trees to match real Talent Park mature heights.
      const height=inTalent&&h<8.5?Math.max(h*1.32,7.8+rand()*3.8):h;
      const inPhotoPalm=inTalent&&Math.hypot(x+471.05,z-172.75)<17;
      if(inTalent&&!avenue&&(inPhotoPalm||(h>=7.5&&rand()<.24))&&plantFanPalm(x,z,10.5+rand()*5.2,3.4))continue;
      if(inPhotoPalm)continue;
      plant(x,z,height,rand()<.7?2:rand()*2|0,avenue&&rand()<.42);
    }
  }
  for(const [x,z,h] of grid.tidal?.trees??[])plant(x,z,h,0);
  for(const [x,z,h] of grid.parkDetails?.trees??[])plant(x,z,h,rand()<.6?2:rand()*2|0);
  for(const [x,z,h,baseY] of grid.cultureTrees??[]){
    const cell=(x/4|0)+','+(z/4|0);if(spots.has(cell))continue;
    spots.add(cell);
    const type=rand()<.65?2:rand()*2|0;
    const tree=[x,z,h,rand()];tree.baseY=baseY;
    if(type<2)tree.species=type;
    species[type].push(tree);
    shadows.push([x+.55,z+.29,h*(type===0?.35:.47)]);
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
  for(const [x,z,h] of grid.frontageTrees??[]){
    if(!plant(x,z,h,0,false,true))continue;
    treeBeds.at(x,.30,z,.75,.12,.75);edging.at(x,.36,z,.76,.55,.76);
  }
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
  let lights=0,benches=0;
  const lampGrid=new Set();
  const lampCell=(x,z,step)=>Math.floor(x/step)+','+Math.floor(z/step);
  const mainRoad=new Set(['residential','primary','secondary','tertiary','pedestrian','unclassified','living_street']);
  const lampRoads=map.roads.filter(rd=>!rd.bridge&&rd.layer>=0&&rd.p.length>=2).sort((a,b)=>{
    const da=Math.min(...a.p.map(([x,z])=>Math.hypot(x+220,z+120)));
    const db=Math.min(...b.p.map(([x,z])=>Math.hypot(x+220,z+120)));
    return da-db;
  });
  for(const rd of lampRoads){
    const major=mainRoad.has(rd.kind),walk=rd.kind==='footway'||rd.kind==='path'||rd.kind==='cycleway';
    const inPark=park&&rd.p.some(([x,z])=>inArea(x,z,park));
    const near=rd.p.some(p=>Math.hypot(...p)<1650)||inPark;
    if(!major&&!(walk&&near))continue;
    const interval=major?28:26;
    along(rd.p,interval,5+rand()*9,(x,z,dx,dz,distance)=>{
      const local=grid.flowerLandscape?.path;
      if(rd===local?.road&&z<=rd.p[local.first][1]&&z>=rd.p[local.last][1])return;
      const profile=grid.profiles.get(rd);
      if(profile&&atStation(profile,distance).y>.48)return;
      const d=Math.hypot(x,z);if(d>2150)return;
      const prefSide=Math.round(distance/interval)%2===0?-1:1,w=rd.width/2;
      const pX=x-dz*(w+2.6)*prefSide,pZ=z+dx*(w+2.6)*prefSide;
      if(!canopy.length&&d<1900&&rand()<.87)plant(pX,pZ,5+rand()*4,rand()<.6?2:rand()*2|0,major&&near&&rand()<.48);
      if(walk&&!near)return;
      const index=Math.floor(distance/interval);
      let placedSide=0,px=0,pz=0;
      for(const candSide of [prefSide,-prefSide]){
        const cx=x-dz*(w+.78)*candSide,cz=z+dx*(w+.78)*candSide;
        if(grid.southWalk?.reservesPlant(cx,cz)||contains(grid.water,cx,cz)||contains(grid.buildings,cx,cz)||grid.platforms.areaAt(cx,cz)||grid.starLandings?.heightAt(cx,cz)!=null||grid.tidal?.heightAt(cx,cz)!=null||grid.parkBridges?.heightAt(cx,cz)!=null||grid.parkDetails?.onPromenade(cx,cz,.55))continue;
        if(grid.roads.query(cx,cz).some(s=>s.rd!==rd&&!footRoad(s.rd)&&s.y<1&&segmentDistance(cx,cz,s.a,s.b)<s.width*.5+.45))continue;
        placedSide=candSide;px=cx;pz=cz;break;
      }
      if(!placedSide)return;
      if(lights<11500){
        const cell=lampCell(px,pz,major?18:16);
        if(!lampGrid.has(cell)){
          const tipX=px+dz*placedSide*2.15,tipZ=pz-dx*placedSide*2.15;
          const nearDeck=[[tipX,tipZ],[(px+tipX)*.5,(pz+tipZ)*.5],[px+2.6,pz],[px-2.6,pz],[px,pz+2.6],[px,pz-2.6]]
            .some(([ax,az])=>grid.platforms.areaAt(ax,az));
          if(!nearDeck){
            lampGrid.add(cell);
            lights++;
            const byTencent=px> -1550&&px< -1265&&pz> -1468&&pz< -1225;
            furniture.lamp(px,pz,dx,dz,placedSide,major&&rd.kind!=='pedestrian',d<900||byTencent);
            if(major&&(d<900&&index%6===0||byTencent&&index%4===0))furniture.sign(rd.name,px,pz,dx,dz);
          }
        }
      }
      if(walk&&index%4===1&&d<900&&benches<240){
        benches++;const rot=Math.atan2(dx,dz),ox=-dz*placedSide,oz=dx*placedSide;
        for(const off of [-.7,.7]){frames.at(px+dx*off,.25,pz+dz*off,.46,.48,.09,rot);}
        for(let j=0;j<4;j++){const off=(j-1.5)*.12;wood.at(px+ox*off,.52,pz+oz*off,.1,.075,1.92,rot);}
        wood.at(px+ox*.22,.87,pz+oz*.22,.07,.2,1.92,rot);
        frames.at(px+dx*1.86,.53,pz+dz*1.86,.38,1.01,.45,rot);
      }
    });
  }
  if(canopy.length)for(const [x,z,h] of parkInfill)plant(x,z,h,rand()<.48?0:1);
  // Populate Shenzhen Talent Park groves to match real-world density & mature
  // Washingtonia palm / broadleaf height (calibrated to IMG_0383 at -471, 173).
  if(park){
    const parkRng=random(20260383);
    const groveField=(x,z)=>
      .50+.26*Math.sin(x*.029+z*.017)+.16*Math.cos(x*.019-z*.031)+.08*Math.sin((x-z)*.057);
    const palmPocket=(x,z)=>
      .50+.30*Math.sin(x*.023-z*.027+1.2)+.20*Math.cos(x*.041+z*.019-.7);
    // 1. Curated hero Washingtonia palm grove & shrubs at IMG_0383 (-471.05, 172.75, dir 246°).
    const fx=-0.9135,fz=0.4067,rx=-fz,rz=fx; // forward (WSW) and right axes
    const heroPalms=[
      [10.2,-1.6,15.4],[13.5,-5.8,13.2],[14.2,3.4,14.6],[17.8,-2.1,12.8],
      [18.5,7.2,12.4],[16.0,-9.8,11.6],[21.5,-6.4,13.9],[22.0,1.8,11.8],
      [23.5,10.5,12.9],[11.8,-10.5,10.8],[26.0,-1.5,13.4],[27.5,6.2,11.9],
      [25.5,-9.5,11.5],[30.5,2.5,12.2],[19.2,-13.2,11.4],[14.5,10.8,11.2],
      [29.0,-6.5,12.6],[32.0,-1.0,11.8],[28.0,12.0,11.6]
    ];
    for(const [ahead,side,h] of heroPalms){
      const px=-471.05+fx*ahead+rx*side,pz=172.75+fz*ahead+rz*side;
      plantFanPalm(px,pz,h,3.1);
    }
    const heroShrubs=[
      [5.5,-3.6,1.15],[6.8,-4.5,1.25],[8.2,-5.0,1.05],[7.4,2.8,1.05],
      [9.2,4.2,1.2],[11.5,5.4,1.15],[10.4,1.5,0.95],[13.2,5.8,1.1]
    ];
    for(const [ahead,side,h] of heroShrubs){
      const px=-471.05+fx*ahead+rx*side,pz=172.75+fz*ahead+rz*side;
      if(!inParkBlocked(px,pz))plant(px,pz,h,3+(parkRng()*2|0));
    }
    // 2. Dense groves inside OSM wood / forest / garden / scrub zones of Talent Park.
    for(const zone of parkWoods){
      const [x0,z0,x1,z1]=zone.bbox;
      const step=zone.kind==='wood'||zone.kind==='forest'?5.0:5.6;
      const isPhotoWood=zone.id===775214632||zone.id===775214631;
      for(let gx=x0+2;gx<x1-1;gx+=step){
        for(let gz=z0+2;gz<z1-1;gz+=step){
          const x=gx+(parkRng()-.5)*step*.72,z=gz+(parkRng()-.5)*step*.72;
          if(!inArea(x,z,zone)||!inArea(x,z,park)||inParkBlocked(x,z))continue;
          const r=parkRng();
          const nearPhotoForeground=Math.hypot(x+471.05,z-172.75)<17;
          const palmShare=isPhotoWood?(nearPhotoForeground?.92:.74):.52;
          if(r<palmShare){
            plantFanPalm(x,z,10.4+parkRng()*5.6,3.3);
          }else if(r<.90&&!nearPhotoForeground){
            plant(x,z,8.2+parkRng()*5.4,parkRng()<.55?2:parkRng()*2|0);
          }else{
            plant(x,z,.85+parkRng()*.85,3+(parkRng()*2|0));
          }
        }
      }
    }
    // 3. Clustered palm & shade-tree groves across Talent Park lawns (keeping open sightlines).
    const [px0,pz0,px1,pz1]=park.bbox,step=6.8;
    for(let gx=px0+4;gx<px1-4;gx+=step){
      for(let gz=pz0+4;gz<pz1-4;gz+=step){
        const x=gx+(parkRng()-.5)*step*.76,z=gz+(parkRng()-.5)*step*.76;
        if(!inArea(x,z,park)||inParkBlocked(x,z))continue;
        // Preserve calibrated open lawn foreground at the lakefront flowerbed emblem.
        if(x>130&&x<225&&z>-240&&z<-160)continue;
        const density=groveField(x,z);
        if(density<.44||parkRng()>density*1.08-.16)continue;
        const pProb=palmPocket(x,z);
        const r=parkRng();
        if(pProb>.52&&r<.52){
          plantFanPalm(x,z,9.8+parkRng()*5.6,3.6);
        }else if(r<.88){
          plant(x,z,8.0+parkRng()*5.6,parkRng()<.58?2:parkRng()*2|0);
        }else{
          plant(x,z,.8+parkRng()*.85,3+(parkRng()*2|0));
        }
      }
    }
  }
  for(const [x,z,h,type] of grid.flowerLandscape?.trees??[])plant(x,z,h,type,false,false,true);
  for(const [x,z,h,type] of grid.southWalk?.trees??[])plant(x,z,h,type,false,false,true);
  for(const [x,z,h,type] of grid.vergeTrees??[])plant(x,z,h,type,false,false,true);
  const trees=species.slice(0,3).flat();
  if(park){
    for(const p of trees){
      const [x,z,h]=p;
      if(p.street||!inArea(x,z,park))continue;
      const roads=grid.roads.query(x,z).filter(s=>s.y<1);
      const free=roads.reduce((r,s)=>Math.min(r,segmentDistance(x,z,s.a,s.b)-s.width*.5-.15),2);
      const radius=Math.min(free,.85+h*.12);
      if(radius<.55||[[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>
        contains(grid.water,x+dx,z+dz)||contains(grid.buildings,x+dx,z+dz)))continue;
      p.floorY=p.baseY??parkTurf.reduce((y,f)=>f.turfY>y&&inArea(x,z,f)?f.turfY:y,park.turfY);
      p.floorRadius=radius;
    }
  }
  const ratios=[.93,1.5,1.33,.95,1];['island_tree_01','island_tree_02','jacaranda_tree','shrub_02','shrub_03'].forEach((n,i)=>{const mat=makeBillboards(root,species[i],n,ratios[i]);if(mat)affected.push(mat);});
  root.userData.foliageReady=Promise.all([volumetricTrees(root,trees,lowQuality,grid.blossomTrees??[]),...affected.map(a=>a.userData.photoReady)]);
  if(shadows.length){
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),rad=g.createRadialGradient(32,32,1,32,32,32);rad.addColorStop(0,'rgba(36,40,23,.66)');rad.addColorStop(.32,'rgba(34,44,28,.36)');rad.addColorStop(1,'rgba(32,46,27,0)');g.fillStyle=rad;g.fillRect(0,0,64,64);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);const batch=new Instances(geo,new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),'树下环境阴影');
    for(const [x,z,r] of shadows)batch.at(x,.115,z,r*2.1,1,r*1.64,0);batch.flush(root);
  }
  furniture.finish();
  m.parkLights.buildPools?.();
  for(const obj of [frames,wood,palms,trunks,fanTrunks,fanSkirts,fanCrowns]){
    const cast=obj===trunks||obj===frames||obj===fanTrunks||obj===fanCrowns;
    const range=(obj===palms||obj===trunks||obj===fanTrunks||obj===fanSkirts||obj===fanCrowns)?1450:440;
    obj.flush(root,cast,range);
  }
  return affected;
}
