import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

const glaze = /glass|windscreen|clear lens/i;
const lacquer = /Ocean Blue clearcoat|Pearl White clearcoat|Fleet side enamel/;
const NOISE = `
  varying vec3 vTaxiMeters;
  float taxiHash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x+p.y)*p.z);
  }
  float taxiNoise(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    vec2 k=vec2(0.,1.);
    return mix(mix(mix(taxiHash(i+k.xxx),taxiHash(i+k.yxx),f.x),
                   mix(taxiHash(i+k.xyx),taxiHash(i+k.yyx),f.x),f.y),
               mix(mix(taxiHash(i+k.xxy),taxiHash(i+k.yxy),f.x),
                   mix(taxiHash(i+k.xyy),taxiHash(i+k.yyy),f.x),f.y),f.z);
  }
`;

function finishPaint(material) {
  material.clearcoat=1;
  material.clearcoatRoughness=.065;
  material.envMapIntensity=1.17;
  if(material.name==='Ocean Blue clearcoat'){
    material.roughness=.205;material.metalness=.59;
  }
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute vec3 taxiMeters; varying vec3 vTaxiMeters;')
      .replace('#include <project_vertex>',
        '#include <project_vertex>\nvTaxiMeters=taxiMeters;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+NOISE)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float taxiGrain=taxiNoise(vTaxiMeters*185.);
        float taxiDetail=1.-smoothstep(.002,.012,length(fwidth(vTaxiMeters)));
        float taxiSill=(1.-smoothstep(.20,.61,vTaxiMeters.y))*(.53+.47*taxiNoise(vTaxiMeters*8.));
        roughnessFactor=clamp(roughnessFactor+.115*taxiSill+.047*(taxiGrain-.5)*taxiDetail,.12,.77);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.86+vec3(.017,.014,.010),.45*taxiSill);
      `)
      .replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
        vec3 txQ0=dFdx(-vViewPosition), txQ1=dFdy(-vViewPosition);
        vec3 txR0=cross(txQ1,clearcoatNormal),txR1=cross(clearcoatNormal,txQ0);
        float txDet=dot(txQ0,txR0);
        float txBump=taxiGrain*.000017*taxiDetail;
        if(abs(txDet)>1.e-12) clearcoatNormal=normalize(abs(txDet)*clearcoatNormal-sign(txDet)*(dFdx(txBump)*txR0+dFdy(txBump)*txR1));
      `);
  };
  material.customProgramCacheKey=()=> 'pengcheng-pearl';
}

export async function loadDetailedVehicle(id='e6') {
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const taxi=id==='e6',file=taxi?'e6-pengcheng':'model3-detail';
  const {scene:model}=await loader.loadAsync(import.meta.env.BASE_URL+'models/'+file+'.glb');
  const reflective=[],materials=new Set(),paintMeshes=new Set(),point=new T.Vector3();
  model.updateMatrixWorld(true);
  model.traverse(node=>{
    if (!node.isMesh) return;
    node.castShadow=true; node.receiveShadow=true;
    const mat=node.material;
    if(lacquer.test(mat.name)){
      if(paintMeshes.has(node.geometry))node.geometry=node.geometry.clone();
      paintMeshes.add(node.geometry);
      const position=node.geometry.attributes.position,meters=new Float32Array(position.count*3);
      for(let i=0;i<position.count;i++)point.fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld).toArray(meters,3*i);
      node.geometry.setAttribute('taxiMeters',new T.BufferAttribute(meters,3));
    }
    if(materials.has(mat)) return;
    materials.add(mat);
    if(mat.map) mat.map.anisotropy=8;
    if(mat.map && mat.alphaTest>0) {
      mat.transparent=false;mat.alphaToCoverage=true;mat.depthWrite=true;
      mat.polygonOffset=true;mat.polygonOffsetFactor=-1;mat.polygonOffsetUnits=-1;
    }
    if(lacquer.test(mat.name)) finishPaint(mat);
    if(!taxi&&mat.name==='Heated rear windscreen'&&mat.transparent){
      mat.depthWrite=false;
      // BLEND glass otherwise transmits a constant fraction even edge-on. Use
      // the two glass/air interfaces for the transmitted alpha. The physical
      // material still computes its own specular reflections from the scene.
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          float backlightCosine=clamp(dot(normal,normalize(vViewPosition)),0.,1.);
          float backlightTransmission=1.-pow(1.-backlightCosine,5.);
          diffuseColor.a=1.-(1.-diffuseColor.a)*backlightTransmission*backlightTransmission;
        `);
      };
      mat.customProgramCacheKey=()=> 'model3-backlight-fresnel';
    }
    if(taxi&&glaze.test(mat.name) && mat.transparent) {
      mat.side=T.FrontSide;mat.depthWrite=false;mat.envMapIntensity=1.09;
      const automotiveGlass=!/lens/i.test(mat.name);
      if(automotiveGlass){
        mat.metalness=.48;mat.roughness=.073;
        mat.color.set(mat.name.includes('Privacy')?0x19262d:0x374b59);
        mat.opacity=mat.name.includes('Privacy')?.92:mat.name.includes('windscreen')?.77:.82;
        mat.envMapIntensity=1.23;
      }
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          float taxiGrazing=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),3.);
          diffuseColor.a=mix(diffuseColor.a,.96,.88*taxiGrazing);
        `);
      };
      mat.customProgramCacheKey=()=> 'e6-glazing-v2';
    }
    if(mat.isMeshStandardMaterial) reflective.push(mat);
  });
  model.name=taxi?'深圳巴士集团鹏程出租车 · AT-099':'特斯拉 Model 3 · 后轮驱动版';
  model.userData.excludeFromProbe=true;
  let environment;
  return {
    model,
    setEnvironment(texture,rotation=0) {
      if(texture===environment)return;
      environment=texture;
      for(const mat of reflective) {
        mat.envMap=texture??null;mat.envMapRotation?.set(0,rotation,0);mat.needsUpdate=true;
      }
    },
    dispose() {
      const geometry=new Set(),textures=new Set();
      model.traverse(node=>{if(node.geometry)geometry.add(node.geometry);});
      for(const mat of materials) {
        for(const [name,value] of Object.entries(mat)) if(name!=='envMap'&&value?.isTexture)textures.add(value);
        mat.dispose();
      }
      for(const g of geometry)g.dispose();
      for(const tex of textures)tex.dispose();
    }
  };
}

// Use one measured, overcast courtyard for the rotating catalogue inspection.
export async function vehicleStudio(renderer,isActive,id){
  const file=id==='model3'?'models/model3-studio.hdr':'media/courtyard.hdr';
  const texture=await new HDRLoader().loadAsync(import.meta.env.BASE_URL+file);
  if(!isActive()){texture.dispose();return null;}
  const pmrem=new T.PMREMGenerator(renderer);
  try{return pmrem.fromEquirectangular(texture);}
  finally{pmrem.dispose();texture.dispose();}
}
