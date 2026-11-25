import {starBridge} from './city-starbridge.js';
import {sleeve} from './talent-bridge.js';
import {southPromenade} from './star-south.js';
import {southGround} from './star-south-ground.js';
import * as T from 'three';
import {parkLighting} from './park-lighting.js';
import {waterfrontShow} from './city-lightshow.js';
import {makeLake} from './lake.js';
import {soundHabitat} from './sound-habitat.js';
import {bayBridge} from './bay-bridge.js';
import {islandShores} from './lake-shores.js';
import {streetSurface} from './street-surface.js';
import {Surface,Grid,Instances,bounds,inArea,random,segmentDistance,quadHeight,ribbon,clamp} from './city-geometry.js';
import {materials,asset} from './city-materials.js';
import {calibrateTencent,tencentLinks} from './tencent-towers.js';
import {landmarks} from './city-landmarks.js';
import {streets,cityBlocks} from './city-blocks.js';
import {furnishing} from './city-nature.js';
import {buildWeatherCover} from './precipitation-cover.js';
import {tidalSquare} from './tidal-square.js';
import {parkArtworks} from './park-artworks.js';
import {parkMonuments} from './park-monuments.js';
import {parkFlowerbed} from './park-flowerbed.js';
import {flowerbedLandscape} from './flowerbed-landscape.js';
import {parkBridges} from './park-bridges.js';
import {parkDetails} from './park-details.js';
import {buildUrbanLife} from './urban-life.js';
import {buildParkEnrichment} from './park-enrichment.js';
import {buildSkylineBranding} from './skyline-branding.js';
import {createShenzhenBuses} from './shenzhen-buses.js';
import {buildCoastalCity} from './coastal-city.js';

const canopyData=fetch(import.meta.env.BASE_URL+'data/houhai-canopy.json')
  .then(response=>response.ok?response.json():null).then(data=>data?.trees||[]).catch(()=>[]);
function terrain(root,map,m,grid){
  const satellite=new T.TextureLoader().load(import.meta.env.BASE_URL+'data/houhai-sentinel.webp');
  satellite.colorSpace=T.SRGBColorSpace;satellite.anisotropy=8;
  const earthMat=new T.MeshStandardMaterial({map:satellite,color:0xdad9cd,roughness:.96});
  // Blend crisp tiled turf & granite paving detail onto the Sentinel-2 ground at close range
  // so roadside green verges and unmapped median strips never look like blurry flat green plastic.
  earthMat.customProgramCacheKey=()=>'houhai-earth-detail-v1';
  earthMat.onBeforeCompile=shader=>{
    shader.uniforms.uGrassTex={value:m.grass.map};
    shader.uniforms.uPaverTex={value:m.paving.map};
    shader.vertexShader='varying vec3 earthWorld;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nearthWorld=(modelMatrix*vec4(transformed,1.)).xyz;'
    );
    shader.fragmentShader='uniform sampler2D uGrassTex,uPaverTex;\nvarying vec3 earthWorld;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float eDist=distance(earthWorld,cameraPosition);
      float nearDetail=1.-smoothstep(45.,310.,eDist);
      if(nearDetail>.005){
        vec3 baseC=diffuseColor.rgb;
        float gExcess=baseC.g-max(baseC.r,baseC.b)*.86;
        float isBrightConcrete=smoothstep(.42,.62,min(baseC.r,min(baseC.g,baseC.b)));
        float gScore=clamp(smoothstep(-.008,.055,gExcess)*(1.-isBrightConcrete*.85),0.,1.);
        vec3 turfA=texture2D(uGrassTex,earthWorld.xz*.23).rgb;
        vec3 turfB=texture2D(uGrassTex,earthWorld.xz*.061+vec2(.37,.71)).rgb;
        vec3 turf=mix(turfA,turfB,.42);
        // Smooth organic lawn patch variation (zero grid blocks) matching Talent Park turf richness
        float patchVar=.5+.5*sin(earthWorld.x*.085+sin(earthWorld.z*.062)*2.1)*cos(earthWorld.z*.079-earthWorld.x*.031);
        vec3 richGrass=turf*vec3(.95,1.06,.78)*(.84+.24*patchVar);
        vec3 pavers=texture2D(uPaverTex,earthWorld.xz*.36).rgb;
        vec3 urbanGround=mix(baseC,pavers*clamp(dot(baseC,vec3(.33,.50,.17))*2.15,.55,1.25),.58);
        vec3 detailed=mix(urbanGround,richGrass,gScore);
        diffuseColor.rgb=mix(baseC,detailed,nearDetail*.92);
      }`
    );
  };
  const earth=new T.Mesh(new T.PlaneGeometry(6400,6400),earthMat);
  earth.name='后海 · Sentinel-2 真彩色地表';earth.rotation.x=-Math.PI/2;earth.position.y=-.1;earth.receiveShadow=true;root.add(earth);
  const grass=new Surface(),plazas=new Surface(),parking=new Surface(),sand=new Surface(),sports=new Surface();
  const groups={park:1,grass:2,scrub:3,forest:4,wood:4,garden:3,playground:2,nature_reserve:4,flowerbed:3,golf_course:2,wetland:4,common:2,greenfield:2,recreation_ground:1};
  const tones={park:0xd5e1b7,grass:0xe3e7be,wood:0x93a882,forest:0x93a882,flowerbed:0xe0cca2,wetland:0xb2ba85};
  for(const l of map.land){l.bbox=bounds(l.p);const k=l.kind;
    if(groups[k]){l.turfColor=tones[k]||0xc1cdaa;const color=new T.Color(l.turfColor);l.turfY=.025+groups[k]*.014;grass.polygon(l.p,l.holes,l.turfY,4,color);}
    else if(k==='plaza'||k==='playground')plazas.polygon(l.p,l.holes,.13,4);
    else if(k==='parking')parking.polygon(l.p,l.holes,.14,6);
    else if(k==='sand'||k==='beach'||k==='shingle')sand.polygon(l.p,l.holes,.035,6);
    else if(k==='pitch'||k==='track')sports.polygon(l.p,l.holes,.137,8);
  }
  // Keep the high-resolution meadow texture at walking distance and recover
  // the actual canopy patterns in the orthophoto as the viewer rises.
  m.grass.onBeforeCompile=shader=>{
    shader.uniforms.citySatellite={value:satellite};shader.vertexShader='varying vec3 cityGround;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncityGround=(modelMatrix*vec4(transformed,1.)).xyz;');
    const landscape=grid.flowerLandscape;
    if(landscape)shader.uniforms.shoreLawn={value:landscape.lawnMap};
    shader.fragmentShader=(landscape?'uniform sampler2D shoreLawn;\n':'')+'uniform sampler2D citySatellite; varying vec3 cityGround;\n'+shader.fragmentShader;
    // Keep the photographed blades at walking scale. Two grain directions
    // and slower changes in turf colour break up the four-metre repeat.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 site=cityGround.xz;
      vec2 drift=sin(site*vec2(.097,.073)+sin(site.yx*.14));
      vec2 grain=vMapUv+.24*drift;
      vec2 crossed=mat2(.8,.6,-.6,.8)*grain*.76+vec2(.37,.62);
      vec3 blades=mix(texture2D(map,grain).rgb,texture2D(map,crossed).rgb,.44);
      float growth=drift.x*drift.y*.62+sin(dot(site,vec2(.22,-.14))+drift.y)*.38;
      diffuseColor.rgb*=blades*mix(vec3(.83,.92,.83),vec3(1.15,1.04,.91),.5+.5*growth);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      ${landscape?`vec2 local=cityGround.xz-vec2(177.,-208.);
      vec2 lawnAxis=vec2(dot(local,vec2(.65,.76))/114.,dot(local,vec2(.76,-.65))/47.);
      float turf=1.-smoothstep(.75,1.1,length(lawnAxis));
      if(turf>0.)diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(shoreLawn,cityGround.xz/2.8).rgb,turf);`:''}
      vec3 aerial=texture2D(citySatellite,vec2(cityGround.x,-cityGround.z)/6400.+.5).rgb;
      // A ten-metre satellite pixel may straddle a path or a bright roof.
      // Keep local turf colour there, retaining broad canopy shade from the image.
      float green=smoothstep(-.028,.052,aerial.g-max(aerial.r,aerial.b));
      float shade=clamp(.80+dot(aerial,vec3(.31,.64,.05))*1.4,.80,1.18);
      vec3 distant=mix(diffuseColor.rgb*shade,aerial*1.10,green*.76);
      float aerialWeight=smoothstep(110.,1000.,distance(cityGround,cameraPosition))*(1.-smoothstep(3.,12.,cityGround.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,distant,aerialWeight*.72);`);
  };
  grass.mesh(root,m.grass,'园林草地');plazas.mesh(root,m.paving,'硬质铺装广场');const lot=parking.mesh(root,m.asphalt,'停车场');
  if(lot)lot.geometry.setAttribute('snowLane',new T.Float32BufferAttribute(new Float32Array(lot.geometry.attributes.position.count*2),2));
  sand.mesh(root,new T.MeshStandardMaterial({color:0xbbaa88,roughness:.98,side:T.DoubleSide}),'潮间带');sports.mesh(root,m.field,'运动场');
  for(const w of map.water){w.bbox=bounds(w.p);grid.water.add(w,w.bbox);}
  const edges=new Surface();
  const lake=map.water.find(f=>Number(f.id)===-10175109);
  if(lake){
    const natural=grid.flowerLandscape?.shore;
    if(natural?.length){
      const start=lake.p.indexOf(natural[0]),end=lake.p.indexOf(natural.at(-1));
      ribbon(edges,[...lake.p.slice(end),...lake.p.slice(0,start+1)],.67,.171,4);
    }else ribbon(edges,[...lake.p,lake.p[0]],.67,.171,4);
    edges.mesh(root,m.curb,'内湖驳岸');
    islandShores(root,lake,m.grass,grid.flowerLandscape?.shoalRings);
  }
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
    const ground=new T.MeshStandardMaterial({vertexColors:true,roughness:1,transparent:true,depthWrite:false});
    ground.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainXZ=position.xz;');
      shader.fragmentShader='varying vec2 terrainXZ;\n'+shader.fragmentShader.replace('#include <alphamap_fragment>',
        '#include <alphamap_fragment>\ndiffuseColor.a*=1.-smoothstep(8500.,21100.,max(abs(terrainXZ.x),abs(terrainXZ.y)));');
    };
    const mountains=new T.Mesh(g,ground);mountains.renderOrder=-100;mountains.name='真实高程 · 香港与南山山脊';root.add(mountains);
  }).catch(e=>console.warn('Regional terrain unavailable',e));return state;
}
export function createCity(scene,map,options={}){
  const root=new T.Group();root.name='深圳人才公园与后海城区';scene.add(root);
  const m=materials(),grid={buildings:new Grid(100),water:new Grid(100),roads:new Grid(72)};
  m.parkLights=parkLighting(root);
  const landscape=grid.flowerLandscape=flowerbedLandscape(root,map,m);
  calibrateTencent(map.buildings);
  terrain(root,map,m,grid);cityBlocks(root,map,m,grid);
  const bridge=map.roads.find(r=>r.id===562534109);
  if(bridge){
    grid.southGround=southGround(map,bridge);
    grid.southGround.surface.mesh(root,m.grass,'星光桥南岸 · 连续草坡',true);
  }
  streets(root,map,m,grid);
  const postGrid=new Grid(4),postRadius=sleeve.radius+.16;
  if(bridge){
    grid.southWalk=southPromenade(root,m,grid.starLandings,grid.southGround);
    grid.blossomTrees=grid.southWalk.blossoms;
    grid.talentColumns=starBridge(root,bridge,m,grid);
    for(const c of grid.talentColumns)postGrid.add(c,[c.x-postRadius,c.z-postRadius,c.x+postRadius,c.z+postRadius]);
  }
  const flowerbed=grid.flowerbed=parkFlowerbed(root,map);
  const tidal=grid.tidal=tidalSquare(root,map,m);
  const bridges=grid.parkBridges=parkBridges(root,map,m,grid);
  const details=grid.parkDetails=parkDetails(root,map,m,grid);
  const monumentsReady=tidal?parkMonuments(tidal,map):null;
  const artworkReady=parkArtworks(root,map,grid);
  buildUrbanLife(root,map,m,grid);
  buildParkEnrichment(root,map,m,grid);
  buildCoastalCity(root,map,m,grid);
  bayBridge(root,map,m);
  const stadium=landmarks(root,map,m);
  const branding=buildSkylineBranding(root,map,m);
  const buses=createShenzhenBuses(root,map,grid,options.quality==='low');
  const show=waterfrontShow(root,map);
  let weatherCover;
  const getWeatherCover=()=>weatherCover??=buildWeatherCover([...map.buildings,...grid.platforms.roofs],stadium);
  let foliage=[],night=0,sampleHabitat;
  const far=farTerrain(root),water=makeLake(root,map,options);
  const ground=streetSurface(root,m,options,map.roads);
  const ready=canopyData.then(async trees=>{
    if(!far.active)return;
    sampleHabitat=soundHabitat(map,trees);
    foliage=furnishing(root,map,m,grid,trees,options.quality==='low');
    await Promise.all([root.userData.foliageReady,root.userData.shrubReady,root.userData.talentReady,monumentsReady,artworkReady,details.ready]);
  });
  function segmentHeight(seg,x,z){
    if(seg.quad){
      const [x0,z0,x1,z1]=seg.bbox;
      if(x<x0||z<z0||x>x1||z>z1)return null;
      return quadHeight(seg.quad,x,z);
    }
    if(seg.endY===undefined)return seg.y;
    const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],u=clamp(((x-seg.a[0])*dx+(z-seg.a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    return T.MathUtils.lerp(seg.y,seg.endY,u);
  }
  function roadAt(x,z,ceiling=Infinity){
    let height=ceiling>=.277&&grid.junctions.junctionAt(x,z) ? .277 : 0;
    for(const seg of grid.roads.query(x,z)){
      if(!seg.quad&&(Math.max(seg.y,seg.endY??seg.y)<=height||segmentDistance(x,z,seg.a,seg.b)>=seg.width*.5+.28))continue;
      if(seg.rampStart||seg.rampEnd){
        const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],along=(x-seg.a[0])*dx+(z-seg.a[1])*dz;
        if((seg.rampStart&&along<0)||(seg.rampEnd&&along>dx*dx+dz*dz))continue;
      }
      const y=segmentHeight(seg,x,z);
      if(y!=null&&(!seg.graded||y<=ceiling))height=Math.max(height,y);
    }
    return height;
  }
  function groundHeight(x,z,ceiling=Infinity){
    const deck=grid.platforms.areaAt(x,z),top=deck?.height(x,z)??0;
    const bridgeY=bridges?.heightAt(x,z);
    return Math.max(top<=ceiling?top:0,.15,bridgeY!=null&&bridgeY<=ceiling?bridgeY:0,details?.heightAt?.(x,z)??0,roadAt(x,z,ceiling),grid.southWalk?.heightAt(x,z)??0,tidal?.heightAt(x,z)??0,flowerbed?.heightAt(x,z)??0,landscape?.heightAt(x,z)??0,grid.starLandings?.heightAt(x,z)??0,stadium?.groundHeight(x,z)??0);
  }
  const links=map.buildings.filter(f=>tencentLinks.has(f.id));
  const atPost=(x,z,test)=>postGrid.query(x,z).some(c=>test(c)&&Math.hypot(x-c.x,z-c.z)<postRadius);
  function flightBlocked(x,y,z){
    if(atPost(x,z,c=>y>=c.base-.15&&y<c.base+sleeve.height+.15))return true;
    if(grid.atDivider?.(x,z,y))return true;
    const bridgeH=bridges?.heightAt(x,z);if(bridgeH!=null&&y<bridgeH+.16&&y>bridgeH-.55)return true;
    const plaza=tidal?.heightAt(x,z);if(plaza!=null&&y<plaza+.1)return true;
    const slope=flowerbed?.heightAt(x,z);if(slope!=null&&y<slope+.15)return true;
    const shoreGround=landscape?.heightAt(x,z);if(shoreGround!=null&&y<shoreGround+.1)return true;
    const deck=grid.platforms.areaAt(x,z),top=deck?.height(x,z);
    if(deck&&y>top-deck.depth-.2&&y<top+.2||grid.platforms.railAt(x,z,y))return true;
    if(grid.bridgePiers.query(x,z).some(p=>y<p.top+.3&&Math.hypot(x-p.x,z-p.z)<p.r+.27))return true;
    for(const s of grid.roads.query(x,z)){
      if(!s.graded||s.foot&&!s.solid||!s.quad&&segmentDistance(x,z,s.a,s.b)>s.width*.5+.15)continue;
      const top=segmentHeight(s,x,z);
      if(top!=null&&y<top+.22&&y>(s.solid?top-s.depth-.22:-1))return true;
    }
    const shore=grid.starLandings?.heightAt(x,z);
    if(shore!=null&&y<shore+.1)return true;
    if(links.some(f=>y>f.minH-.25&&y<f.h+.35&&inArea(x,z,f)))return true;
    const stands=stadium?.flightBlocked(x,y,z);
    if(stands)return true;
    return grid.buildings.query(x,z).some(f=>!stadium?.ownsFootprint(f)&&y>(f.minH||0)-.25&&y<(f.h||3)+.35&&inArea(x,z,f));
  }
  function isWalkable(x,z,ceiling=Infinity){
    if(!Number.isFinite(x+z)||atPost(x,z,c=>ceiling>=c.base))return false;
    if(tidal?.blocked(x,z)||details?.blocked(x,z))return false;
    if(bridges?.onRail(x,z))return false;
    if(flowerbed?.heightAt(x,z)!=null)return false;
    if(landscape?.blocked(x,z))return false;
    const deck=grid.platforms.areaAt(x,z);
    if(grid.atDivider?.(x,z,Number.isFinite(ceiling)?ceiling-.95:deck?.height(x,z)??.28))return false;
    if(!deck&&Math.hypot(x,z)>map.radius)return false;
    if(grid.platforms.railAt(x,z,Number.isFinite(ceiling)?ceiling-.95:deck?.height(x,z)))return false;
    if(deck&&deck.height(x,z)<=ceiling){
      const floor=deck.height(x,z);
      return !grid.buildings.query(x,z).some(f=>floor+1.7>(f.minH||0)&&floor<(f.h||3)&&inArea(x,z,f));
    }
    const venue=stadium?.walkable(x,z);if(venue!=null)return venue;
    if(grid.starLandings?.onRail(x,z))return false;
    if(bridges?.heightAt(x,z)!=null)return true;
    if(grid.starLandings?.heightAt(x,z)!=null||grid.southWalk?.pavedHeightAt(x,z)!=null)return true;
    if(Number.isFinite(ceiling)){
      if(grid.bridgePiers.query(x,z).some(p=>ceiling<p.top+1&&Math.hypot(x-p.x,z-p.z)<p.r+.22))return false;
      if(grid.roads.query(x,z).some(s=>s.graded&&!s.solid&&!s.foot&&(segmentHeight(s,x,z)??-Infinity)>ceiling&&(s.quad||segmentDistance(x,z,s.a,s.b)<s.width*.5)))return false;
    }
    const h=roadAt(x,z,ceiling);if(h>1.2)return true;
    if(tidal?.heightAt(x,z)!=null)return !grid.buildings.query(x,z).some(f=>!stadium?.ownsFootprint(f)&&inArea(x,z,f));
    if(grid.water.query(x,z).some(f=>inArea(x,z,f)))return false;
    if(grid.buildings.query(x,z).some(f=>!stadium?.ownsFootprint(f)&&inArea(x,z,f)))return false;
    return true;
  }
  let lastTone=-1;const lastDetailEye=new T.Vector3(Infinity,0,0);let detailCount=-1;
  function update(time,camera,showTime=time){
    if(root.userData.shrubWindTime)root.userData.shrubWindTime.value=time;
    grid.updateSignals(showTime);
    show.update(showTime);
    branding.update(showTime);
    buses.update(showTime);
    if(camera){if(!scene.userData.capturingProbe)root.userData.updateTalentPlate?.(camera.position);root.userData.updateTrees?.(camera.position,time);m.parkLights.update(camera.position);}
    if(water)water.material.uniforms.time.value=time;
    const details=root.userData.localDetails||[];
    if(camera&&(detailCount!==details.length||lastDetailEye.distanceToSquared(camera.position)>25)){
      for(const {item,range,lod} of details){
        const s=item.boundingSphere??item.geometry.boundingSphere,d=s.center.distanceTo(camera.position)-s.radius;
        item.visible=d<range;
        if(lod&&item.visible)item.geometry=d<lod.distance?lod.near:lod.far;
      }
      lastDetailEye.copy(camera.position);detailCount=details.length;
    }
    // Tree photographs have baked diffuse lighting. Match the environment
    // intensity so the vegetation also responds to dusk and evening.
    const intensity=(1-.48*night)*(typeof scene.environmentIntensity==='number'?clamp(scene.environmentIntensity,.34,1.25):1);
    if(Math.abs(lastTone-intensity)>.02){const tone=(.76+.26*intensity)*(1-.40*T.MathUtils.smoothstep(night,.25,1));
      for(const a of foliage)a.color.setHex(0xe8efe0).multiplyScalar(tone);lastTone=intensity;}
  }
  function setNight(fraction,officeOccupancy=1){
    night=clamp(fraction,0,1);if(water)water.material.uniforms.night.value=night;for(const wall of m.walls)wall.emissiveIntensity=night*1.14*officeOccupancy;
    m.parkLights.setNight(night);
    show.setNight(night);
    branding.setNight(night);
    buses.setNight(night);
    m.lamp.emissiveIntensity=.36+night*2.6;
    m.shop.emissiveIntensity=.36+night*.72;
  }
  function setSun(direction,color){ground.invalidate();if(!water)return;water.material.uniforms.sunDirection.value.copy(direction).normalize();if(color)water.material.uniforms.sunColor.value.set(color);}
  function dispose(){root.userData.disposeTalentPlates?.();root.userData.disposeBlossoms?.();weatherCover?.texture.dispose();ground.dispose();water?.dispose();flowerbed?.dispose();landscape?.dispose();bridges?.dispose();details?.dispose();far.active=false;scene.remove(root);root.traverse(obj=>{obj.geometry?.dispose();const mats=Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[];mats.forEach(mat=>mat.dispose());});}
  return {root,ready,update,habitatAt(position){return sampleHabitat?.(position);},talentColumns:grid.talentColumns??[],signals:grid.signals,parkWalkPaths:tidal?.walkPaths??[],stadiumAreas:stadium?.motorExclusions??[],captureStreet:ground.capture,groundHeight,isWalkable,flightBlocked,getWeatherCover,setSun,setNight,dispose,water,bounds:[-3000,-3000,3000,3000]};
}
