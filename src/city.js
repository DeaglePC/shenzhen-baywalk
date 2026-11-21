import * as T from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {Surface,Grid,Instances,bounds,inArea,random,segmentDistance,ribbon,clamp} from './city-geometry.js';
import {materials,asset} from './city-materials.js';
import {landmarks} from './city-landmarks.js';
import {streets,cityBlocks} from './city-blocks.js';
import {furnishing} from './city-nature.js';

const canopyData=fetch(import.meta.env.BASE_URL+'data/houhai-canopy.json')
  .then(response=>response.ok?response.json():null).then(data=>data?.trees||[]).catch(()=>[]);
function terrain(root,map,m,grid){
  const satellite=new T.TextureLoader().load(import.meta.env.BASE_URL+'data/houhai-sentinel.webp');
  satellite.colorSpace=T.SRGBColorSpace;satellite.anisotropy=8;
  const earth=new T.Mesh(new T.PlaneGeometry(6400,6400),new T.MeshStandardMaterial({map:satellite,color:0xdad9cd,roughness:1}));
  earth.name='后海 · Sentinel-2 真彩色地表';earth.rotation.x=-Math.PI/2;earth.position.y=-.1;earth.receiveShadow=true;root.add(earth);
  const grass=new Surface(),plazas=new Surface(),parking=new Surface(),sand=new Surface(),sports=new Surface();
  const groups={park:1,grass:2,scrub:3,forest:4,wood:4,garden:3,playground:2,nature_reserve:4,flowerbed:3,golf_course:2,wetland:4,common:2,greenfield:2,recreation_ground:1};
  const tones={park:0xd5e1b7,grass:0xe3e7be,wood:0x93a882,forest:0x93a882,flowerbed:0xe0cca2,wetland:0xb2ba85};
  for(const l of map.land){l.bbox=bounds(l.p);const k=l.kind;
    if(groups[k]){const color=new T.Color(tones[k]||0xc1cdaa);grass.polygon(l.p,l.holes,.025+groups[k]*.014,4,color);}
    else if(k==='plaza'||k==='playground')plazas.polygon(l.p,l.holes,.13,4);
    else if(k==='parking')parking.polygon(l.p,l.holes,.14,6);
    else if(k==='sand'||k==='beach'||k==='shingle')sand.polygon(l.p,l.holes,.035,6);
    else if(k==='pitch'||k==='track')sports.polygon(l.p,l.holes,.137,8);
  }
  // Keep the high-resolution meadow texture at walking distance and recover
  // the actual canopy patterns in the orthophoto as the viewer rises.
  m.grass.onBeforeCompile=shader=>{
    shader.uniforms.citySatellite={value:satellite};shader.vertexShader='varying vec3 cityGround;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncityGround=position;');
    shader.fragmentShader='uniform sampler2D citySatellite; varying vec3 cityGround;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 aerial=texture2D(citySatellite,vec2(cityGround.x,-cityGround.z)/6400.+.5).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,aerial*1.10,smoothstep(110.,1000.,distance(cityGround,cameraPosition))*.72);`);
  };
  grass.mesh(root,m.grass,'园林草地');plazas.mesh(root,m.paving,'硬质铺装广场');parking.mesh(root,m.asphalt,'停车场');
  sand.mesh(root,new T.MeshStandardMaterial({color:0xbbaa88,roughness:.98,side:T.DoubleSide}),'潮间带');sports.mesh(root,m.field,'运动场');
  for(const w of map.water){w.bbox=bounds(w.p);grid.water.add(w,w.bbox);}
  const edges=new Surface();
  const lake=map.water.find(f=>Number(f.id)===-10175109);
  if(lake){ribbon(edges,[...lake.p,lake.p[0]],.67,.171,4);edges.mesh(root,m.curb,'内湖驳岸');}
  const plantedFeatures=map.land.filter(f=>groups[f.kind]);return plantedFeatures;
}
function farTerrain(root){
  const state={active:true};
  fetch(asset('terrain-201.bin')).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(raw=>{
    if(!state.active)return;
    const n=201,elev=new Int16Array(raw);if(elev.length!==n*n)return;
    const pos=[],cols=[],idx=[],col=new T.Color(),high=new T.Color('#566b67'),low=new T.Color('#808a7c'),water=new T.Color('#789795');
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const x=(i-100)*220,z=(j-100)*220,h=elev[j*n+i],range=Math.max(Math.abs(x),Math.abs(z)),blend=clamp((range-3130)/430,0,1);
      pos.push(x,Math.max(h,0)*blend-.55,z);
      col.copy(h<2?water:low).lerp(high,h<2?0:Math.min(.94,h/280));cols.push(col.r,col.g,col.b);
      if(i>=n-1||j>=n-1||(Math.abs(x+110)<3115&&Math.abs(z+110)<3115))continue;const k=j*n+i;
      idx.push(k,k+n,k+1,k+1,k+n,k+n+1);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(cols,3));g.setIndex(idx);g.computeVertexNormals();
    const mountains=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));mountains.name='真实高程 · 香港与南山山脊';root.add(mountains);
  }).catch(e=>console.warn('Regional terrain unavailable',e));return state;
}
function lakeSurface(root,map,options,m){
  const s=new Surface();for(const f of map.water)s.polygon(f.p,f.holes,0,1);
  const g=s.geometry();if(!g)return null;
  // Water's reflection plane is local XY. Bake the projection into that plane.
  g.rotateX(Math.PI/2);
  const normals=new T.TextureLoader().load(asset('waternormals.jpg'));normals.wrapS=normals.wrapT=T.RepeatWrapping;
  const dir=new T.Vector3(-.71,.37,-.52).normalize();
  const water=new Water(g,{textureWidth:options.quality==='low'?256:512,textureHeight:options.quality==='low'?256:512,
    waterNormals:normals,sunDirection:dir,sunColor:0xffdeac,waterColor:0x4c7774,distortionScale:1.18,
    clipBias:.0003,side:T.DoubleSide,fog:true});
  water.name='深圳湾与人才湖 · 实时镜面水域';water.rotation.x=-Math.PI/2;water.position.y=.151;
  water.material.uniforms.size.value=3.7;
  water.material.fragmentShader=water.material.fragmentShader
    .replace('float rf0 = 0.3;','float rf0 = 0.13;')
    .replace('diffuseLight * 0.3','diffuseLight * 0.12')
    .replace('vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight','vec3( 0.012 ) + reflectionSample * 0.86 + reflectionSample * min(specularLight,vec3(1.3))');
  // Limit the additional scene pass, while keeping the wave shader continuous.
  const excluded=root.children.filter(o=>['后海 · Sentinel-2 真彩色地表','园林草地','硬质铺装广场','停车场','潮间带','运动场','树下环境阴影'].includes(o.name));
  const reflect=water.onBeforeRender;let last=-1000,hasReflection=false;
  const lastCamera=new T.Vector3(Infinity,0,0);
  water.onBeforeRender=function(renderer,scene,camera,...rest){
    if(camera.isArrayCamera)return;
    const now=performance.now(),nearLake=Math.hypot(camera.position.x,camera.position.z)<970,rate=nearLake?75:180;
    if(!hasReflection||now-last>rate||lastCamera.distanceToSquared(camera.position)>100){
      const previous=excluded.map(o=>o.visible);excluded.forEach(o=>o.visible=false);
      try{reflect.call(this,renderer,scene,camera,...rest);}
      finally{excluded.forEach((o,i)=>o.visible=previous[i]);}
      last=now;lastCamera.copy(camera.position);hasReflection=true;
    }
  };
  root.add(water);return water;
}
export function createCity(scene,map,options={}){
  const root=new T.Group();root.name='深圳人才公园与后海城区';scene.add(root);
  const m=materials(),grid={buildings:new Grid(100),water:new Grid(100),roads:new Grid(72)};
  terrain(root,map,m,grid);cityBlocks(root,map,m,grid);streets(root,map,m,grid);landmarks(root,map.roads,m);
  let foliage=[],night=0;
  const far=farTerrain(root),water=lakeSurface(root,map,options,m);
  const ready=canopyData.then(trees=>{if(far.active)foliage=furnishing(root,map,m,grid,trees);});
  function roadAt(x,z){
    let height=0;
    for(const seg of grid.roads.query(x,z)){
      if(seg.y<=height||segmentDistance(x,z,seg.a,seg.b)>=seg.width*.5+.28)continue;
      if(seg.rampStart||seg.rampEnd){
        const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],along=(x-seg.a[0])*dx+(z-seg.a[1])*dz;
        if((seg.rampStart&&along<0)||(seg.rampEnd&&along>dx*dx+dz*dz))continue;
      }
      if(seg.endY!==undefined){
        const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],u=clamp(((x-seg.a[0])*dx+(z-seg.a[1])*dz)/(dx*dx+dz*dz||1),0,1);
        height=Math.max(height,T.MathUtils.lerp(seg.y,seg.endY,u));
      }else height=seg.y;
    }
    return height;
  }
  function groundHeight(x,z){return Math.max(.15,roadAt(x,z));}
  function isWalkable(x,z){
    if(!Number.isFinite(x+z)||Math.hypot(x,z)>map.radius)return false;
    const h=roadAt(x,z);if(h>1.2)return true;
    if(grid.water.query(x,z).some(f=>inArea(x,z,f)))return false;
    if(grid.buildings.query(x,z).some(f=>inArea(x,z,f)))return false;
    return true;
  }
  let lastTone=-1;const lastDetailEye=new T.Vector3(Infinity,0,0);let detailCount=-1;
  function update(time,camera){
    if(water)water.material.uniforms.time.value=time*.56;
    const details=root.userData.localDetails||[];
    if(camera&&(detailCount!==details.length||lastDetailEye.distanceToSquared(camera.position)>25)){
      for(const {item,range} of details){
        const s=item.boundingSphere;item.visible=s.center.distanceTo(camera.position)<range+s.radius;
      }
      lastDetailEye.copy(camera.position);detailCount=details.length;
    }
    // Tree photographs have baked diffuse lighting. Match the environment
    // intensity so the vegetation also responds to dusk and evening.
    const intensity=(1-.75*night)*(typeof scene.environmentIntensity==='number'?clamp(scene.environmentIntensity,.18,1.2):1);
    if(Math.abs(lastTone-intensity)>.02){for(const a of foliage)a.color.setHex(0xe4ebdc).multiplyScalar(.67+.3*intensity);lastTone=intensity;}
  }
  function setNight(fraction){
    night=clamp(fraction,0,1);for(const wall of m.walls)wall.emissiveIntensity=night*1.14;
    m.lamp.emissiveIntensity=.36+night*2.6;
    m.shop.emissiveIntensity=.16+night*.69;
  }
  function setSun(direction,color){if(!water)return;water.material.uniforms.sunDirection.value.copy(direction).normalize();if(color)water.material.uniforms.sunColor.value.set(color);}
  function dispose(){far.active=false;scene.remove(root);root.traverse(obj=>{obj.geometry?.dispose();const mats=Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[];mats.forEach(mat=>mat.dispose());});}
  return {root,ready,update,groundHeight,isWalkable,setSun,setNight,dispose,water,bounds:[-3000,-3000,3000,3000]};
}
