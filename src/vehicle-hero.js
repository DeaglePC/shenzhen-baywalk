import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const heroURL = () => `${import.meta.env.BASE_URL}models/e6-hero.glb`;
const glaze = /glass|windscreen|clear lens/i;
const lacquer = /Ocean Blue clearcoat|Pearl White clearcoat|Fleet side enamel/;
const NOISE = `
  varying vec3 vTaxiMeters;
  uniform vec3 taxiOrigin;
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

function finishPaint(material, origin) {
  material.clearcoat=1;
  material.clearcoatRoughness=.145;
  material.envMapIntensity=1.0;
  material.onBeforeCompile=shader=>{
    shader.uniforms.taxiOrigin={value:origin};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vTaxiMeters; uniform vec3 taxiOrigin;')
      .replace('#include <project_vertex>',
        '#include <project_vertex>\nvTaxiMeters=(modelMatrix*vec4(transformed,1.)).xyz-taxiOrigin;');
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
  material.customProgramCacheKey=()=> 'e6-clearcoat-v2';
}

export async function loadHeroTaxi() {
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const {scene:model}=await loader.loadAsync(heroURL());
  const origin=new T.Vector3(), reflective=[],materials=new Set();
  model.traverse(node=>{
    if (!node.isMesh) return;
    node.castShadow=true; node.receiveShadow=true;
    const mat=node.material;
    if(materials.has(mat)) return;
    materials.add(mat);
    if(mat.map) mat.map.anisotropy=8;
    if(mat.name==='Fleet print') {
      mat.transparent=false;mat.alphaTest=.35;mat.alphaToCoverage=true;mat.depthWrite=true;
      mat.polygonOffset=true;mat.polygonOffsetFactor=-1;mat.polygonOffsetUnits=-1;
    }
    if(lacquer.test(mat.name)) finishPaint(mat,origin);
    if(glaze.test(mat.name) && mat.transparent) {
      mat.side=T.FrontSide;mat.depthWrite=false;mat.envMapIntensity=1.09;
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
  model.name='Parked Shenzhen e6 · close detail';
  model.userData.excludeFromProbe=true;
  let environment;
  return {
    model,
    setEnvironment(texture) {
      origin.copy(model.position);
      if(texture===environment)return;
      environment=texture;
      for(const mat of reflective) {
        mat.envMap=texture??null;mat.envMapRotation?.set(0,0,0);mat.needsUpdate=true;
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

// Long studio cards and dark flags create readable reflections along curved doors.
export function taxiStudio(renderer) {
  const scene=new T.Scene();
  scene.background=new T.Color(.195,.218,.236);
  function card(position,look,width,height,color,intensity) {
    const m=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide});
    const panel=new T.Mesh(new T.PlaneGeometry(width,height),m);
    panel.position.fromArray(position);panel.lookAt(...look);scene.add(panel);
  }
  card([0,-2,0],[0,1,0],50,50,0x6e7777,.54);
  card([0,6,0],[0,0,0],10,5,0xb8c6ca,.64);
  card([5,2,-.8],[0,0,0],9.5,.68,0xe3f2f6,3.15);
  card([4,.72,-1],[0,0,0],9.1,.18,0x85999f,.81);
  card([-4,2.7,-1],[0,0,0],9,2.4,0xfbebe0,3.1);
  card([.5,1.55,-5],[0,0,0],6.3,.82,0xdae9f4,2.1);
  card([-.9,1.9,5.0],[0,0,0],5,.61,0xffffff,2.9);
  card([4,-.12,1],[0,0,0],10,.69,0x303234,.53);
  card([-3,-.13,2],[0,0,0],8,.32,0x253032,.4);
  const pmrem=new T.PMREMGenerator(renderer), target=pmrem.fromScene(scene,.012,.1,100);
  pmrem.dispose(); for(const o of scene.children){o.geometry.dispose();o.material.dispose();}
  return target;
}
