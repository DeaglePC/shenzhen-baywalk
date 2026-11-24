import * as T from 'three';
import {Grid} from './city-geometry.js';

function makePoolTexture(){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const rad=g.createRadialGradient(64,64,2,64,64,64);
  rad.addColorStop(0,'rgba(255,226,178,0.52)');
  rad.addColorStop(0.28,'rgba(255,212,148,0.32)');
  rad.addColorStop(0.62,'rgba(255,196,120,0.10)');
  rad.addColorStop(1,'rgba(255,180,100,0)');
  g.fillStyle=rad;g.fillRect(0,0,128,128);
  const tex=new T.CanvasTexture(c);
  tex.colorSpace=T.SRGBColorSpace;
  return tex;
}

// Keep all fixtures visible, drive the nearest ten real PointLights around the camera,
// and render a single-draw instanced warm ground light-pool layer at night so distant
// streets and park promenades glow warmly instead of falling into pitch darkness.
export function parkLighting(root){
  const grid=new Grid(28), finishes=[], points=[], poolSpots=[];
  let level=0, poolMesh=null, poolMat=null, poolDirty=false;
  for(let i=0;i<10;i++){
    const light=new T.PointLight(0xffffff,0,28,1.35);
    light.visible=false;root.add(light);points.push(light);
  }
  function rebuildPools(){
    poolDirty=false;
    if(!poolSpots.length||typeof document==='undefined')return;
    if(poolMesh){
      root.remove(poolMesh);
      poolMesh.geometry.dispose();
    }
    if(!poolMat){
      poolMat=new T.MeshBasicMaterial({
        map:makePoolTexture(),
        transparent:true,
        opacity:0,
        depthWrite:false,
        blending:T.AdditiveBlending,
        polygonOffset:true,
        polygonOffsetFactor:-2
      });
    }
    const geo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
    const mesh=new T.InstancedMesh(geo,poolMat,poolSpots.length);
    mesh.name='全城路灯与公园灯 · 夜间地面暖光晕';
    mesh.renderOrder=4;
    const M=new T.Matrix4(),Q=new T.Quaternion(),P=new T.Vector3(),S=new T.Vector3(),C=new T.Color();
    poolSpots.forEach((s,i)=>{
      P.set(s.x,s.y,s.z);
      S.set(s.radius*2,1,s.radius*2);
      M.compose(P,Q,S);
      mesh.setMatrixAt(i,M);
      C.setHex(s.color).multiplyScalar(s.weight);
      mesh.setColorAt(i,C);
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
    mesh.visible=level>.01;
    poolMat.opacity=level*.88;
    root.add(mesh);
    poolMesh=mesh;
  }
  return {
    fixture(x,y,z,color,power,range,groundY=null){
      const boostedRange=Math.max(range,range<12?range*1.25:range*1.22);
      grid.add({position:new T.Vector3(x,y,z),color,power,range:boostedRange},
        [x-boostedRange-14,z-boostedRange-14,x+boostedRange+14,z+boostedRange+14]);
      // Add warm ground glow pool for streetlamps, park lamps & bollards (skip high viaducts)
      const gy=groundY!=null?groundY:(y<9.8?.33:null);
      if(gy!=null&&range>=6){
        const radius=Math.min(13.5,Math.max(4.0,range*.64));
        const weight=T.MathUtils.clamp(power/85,.42,1.05);
        poolSpots.push({x,y:gy,z,color,radius,weight});
        poolDirty=true;
      }
    },
    buildPools(){rebuildPools();},
    finish(material,intensity,daylight=0){
      finishes.push({material,intensity,daylight});material.emissiveIntensity=daylight+(intensity-daylight)*level;
      return material;
    },
    setNight(value){
      level=T.MathUtils.smoothstep(value,.16,.92);
      for(const {material,intensity,daylight} of finishes)material.emissiveIntensity=daylight+(intensity-daylight)*level;
      for(const light of points){light.visible=level>0;light.intensity=0;}
      if(level>.01&&poolDirty)rebuildPools();
      if(poolMesh){poolMesh.visible=level>.01;poolMat.opacity=level*.88;}
    },
    update(eye){
      if(!level)return;
      if(poolDirty)rebuildPools();
      const seen=new Set(),sources=[];
      // Query a 3x3 cell neighborhood around the camera so nearby streetlamps are always captured
      for(const ox of [-28,0,28])for(const oz of [-28,0,28]){
        for(const source of grid.query(eye.x+ox,eye.z+oz)){
          if(seen.has(source))continue;
          seen.add(source);
          const d=source.position.distanceToSquared(eye);
          const maxD=Math.max(source.range*1.65,42);
          if(d<maxD*maxD)sources.push({source,d,maxD});
        }
      }
      sources.sort((a,b)=>a.d-b.d);
      points.forEach((light,i)=>{
        if(!sources[i]){light.intensity=0;return;}
        const {source,d,maxD}=sources[i];
        light.position.copy(source.position);
        light.color.setHex(source.color);
        light.distance=source.range;
        light.intensity=source.power*.72*level*(1-T.MathUtils.smoothstep(Math.sqrt(d),maxD*.72,maxD));
      });
    }
  };
}
