// Weather is evaluated on the existing GIS geometry, so snow cannot form a
// separate sheet through trees, building façades or the water's surface.
import * as T from 'three';

const noise = `
  float wxHash(vec2 p){
    vec3 h=fract(vec3(p.xyx)*.1031);h+=dot(h,h.yxz+33.33);return fract((h.x+h.y)*h.z);
  }
  float wxNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(wxHash(i),wxHash(i+vec2(1.,0.)),f.x),mix(wxHash(i+vec2(0.,1.)),wxHash(i+1.),f.x),f.y);
  }
  vec2 wxRing(vec2 p,float time){
    vec2 cell=floor(p);
    vec2 center=.28+.44*vec2(wxHash(cell),wxHash(cell+13.92));
    vec2 delta=fract(p)-center;
    float radius=max(.005,length(delta));
    float phase=fract(time*1.37+wxHash(cell+8.23));
    float band=radius-phase*.57;
    float ripple=sin(89.*band)*exp(-37.*abs(band))*smoothstep(.01,.12,phase)*(1.-phase);
    return delta/radius*ripple;
  }
`;

const declarations = `
  varying vec3 wxWorld;
  uniform float wxRain, wxSnow, wxTime;
  uniform vec3 wxSeason;
`+noise;

function kind(name) {
  if (/棕榈叶冠/.test(name)) return 'palm';
  if (/三维树冠与叶簇|树冠 ·|沿岸.*(灌|草)|麦冬|枝叶|沿阶草/.test(name)) return name.includes('jacaranda')?'flower':'leaf';
  if (/园林草地|岸线植被|岛岸坡/.test(name)) return 'grass';
  if (/建筑屋顶|连续银色屋盖|屋面|屋盖|建筑檐口|巴士亭.*顶|公交.*顶棚/.test(name)) return 'roof';
  if (/沥青|停车场|道路中心线|路缘线|斑马线|导向标线/.test(name)) return 'road';
  if (/广场|铺装|人行道|步道|桥面|桥板|缓坡|红色骑行道|路缘花岗石|导向砖|平台板|花岗岩|地面瓷砖|护岸块石/.test(name)) return 'paving';
  return null;
}

function patch(mat, type, controls) {
  const leaf=['leaf','flower','palm'].includes(type);
  const plant=leaf||type==='grass';
  const oldHook=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey;
  const previousKey=oldKey.call(mat);
  mat.customProgramCacheKey=()=>previousKey+'|shenzhen-weather-3-'+type;
  mat.onBeforeCompile=function(shader,renderer) {
    oldHook.call(this,shader,renderer);
    Object.assign(shader.uniforms,controls);
    const billboard=shader.vertexShader.includes('vec3 plantWorld');
    shader.vertexShader='varying vec3 wxWorld;\n'+shader.vertexShader;
    const world=billboard?'wxWorld=(modelMatrix*vec4(plantWorld,1.)).xyz;':`
      vec4 wxLocation=vec4(transformed,1.);
      #ifdef USE_BATCHING
        wxLocation=batchingMatrix*wxLocation;
      #endif
      #ifdef USE_INSTANCING
        wxLocation=instanceMatrix*wxLocation;
      #endif
      wxWorld=(modelMatrix*wxLocation).xyz;
    `;
    shader.vertexShader=shader.vertexShader.replace('#include <logdepthbuf_vertex>',world+'\n#include <logdepthbuf_vertex>');
    shader.fragmentShader=declarations+shader.fragmentShader;
    const response=type==='palm'?.18:type==='leaf'?.51:type==='flower'?.68:1.;
    const plantColor=plant?`
      float wxVariation=wxNoise(wxWorld.xz*.18+wxWorld.y*.055);
      float wxGreen=clamp((diffuseColor.g-diffuseColor.r*.78)*8.+.36,.15,1.);
      vec3 tint=vec3(1.)+wxSeason.x*vec3(.17,.34,-.095)+
                wxSeason.y*vec3(.68,-.095,-.25)+wxSeason.z*vec3(.23,-.065,-.095);
      diffuseColor.rgb*=mix(vec3(1.),tint,${response.toFixed(2)}*(.35+.65*wxVariation)*wxGreen);
      ${type==='grass'?`float lawnLuma=dot(diffuseColor.rgb,vec3(.23,.68,.09));
        float dryBlades=.26+.53*wxNoise(wxWorld.xz*.089);
        diffuseColor.rgb=mix(diffuseColor.rgb,lawnLuma*vec3(1.38,1.10,.50),wxSeason.y*dryBlades*.42);
        diffuseColor.rgb=mix(diffuseColor.rgb,lawnLuma*vec3(1.11,1.035,.77),wxSeason.z*dryBlades*.96);`:''}
      ${type==='flower'?`float bloom=smoothstep(.61,.83,wxNoise(wxWorld.xz*.94+wxWorld.y*.55))*
        smoothstep(.44,.66,wxNoise(wxWorld.xz*.046))*.37*wxSeason.x;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.22,.42)*(.48+wxVariation),bloom);`:''}
    `:'';
    const cover=type==='roof'?.95:type==='grass'?.98:type==='paving'?.80:type==='road'?.61:.31;
    const groundSnow=leaf?`
      // Leaf clusters carry thin sheets. Restrict dusting to the high tips,
      // retaining the deep green of evergreen canopy interiors and palm fronds.
      float exposure=smoothstep(.43,.81,wxNoise(wxWorld.xz*.74+wxWorld.y*.47));
      wxAmount=wxSnow*${type==='palm'?'.09':'.20'}*exposure;
    `:`
      vec3 geometric=cross(dFdx(wxWorld),dFdy(wxWorld));
      float up=geometric.y*inversesqrt(max(dot(geometric,geometric),1e-18));
      float field=.54*wxNoise(wxWorld.xz*vec2(.042,.081)+4.1)+.29*wxNoise(wxWorld.xz*.36)+.17*wxNoise(wxWorld.xz*1.95);
      float drifts=smoothstep(.56-wxSnow*.36,.81-wxSnow*.27,field);
      wxAmount=wxSnow*${cover.toFixed(2)}*drifts*smoothstep(.49,.91,up);
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
      ${plantColor}
      float wxAmount=0.;
      if(wxSnow>.001){
        ${groundSnow}
        float crystals=.86+.14*wxNoise(wxWorld.xz*6.21);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.91,.95)*crystals,wxAmount);
      }
      diffuseColor.rgb*=1.-wxRain*${leaf?'.16':type==='grass'?'.24':'.22'};
    `);
    // The original road shader restricts planar reflections to the calibrated
    // street camera. Extend the wet film elsewhere while preserving that camera.
    shader.fragmentShader=shader.fragmentShader.replace('waterFilm*=max(localStreet,localBridge*.56);',
      'waterFilm=mix(waterFilm*max(localStreet,localBridge*.56),.17+.83*waterFilm,wxRain);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`
      roughnessFactor=mix(roughnessFactor, min(roughnessFactor,${leaf?'.42':type==='grass'?'.58':'.235'}),wxRain*${leaf?'.58':'.85'});
      roughnessFactor=mix(roughnessFactor,.91,wxAmount);
      #include <metalnessmap_fragment>
    `);
    if(type==='road'||type==='paving'){
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(wxRain>.01){
          float nearWet=1.-smoothstep(19.,47.,distance(cameraPosition,wxWorld));
          if(nearWet>.001){
            vec2 wave=wxRing(wxWorld.xz*1.8,wxTime)*.041*wxRain*nearWet;
            normal=normalize(normal+mat3(viewMatrix)*vec3(wave.x,0.,wave.y));
          }
        }
      `);
    }
  };
  mat.needsUpdate=true;
  return ()=>{mat.onBeforeCompile=oldHook;mat.customProgramCacheKey=oldKey;mat.needsUpdate=true;};
}

export function weatherSurfaces(city) {
  const controls={wxRain:{value:0},wxSnow:{value:0},wxTime:{value:0},wxSeason:{value:new T.Vector3()}};
  const patched=new Map();
  let installed=false,disposed=false,snowFalling=false;
  function scan(){
    if(disposed||!installed)return;
    city.root.traverse(o=>{
      const type=kind(o.name);
      if(!type||!o.isMesh)return;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(!m||patched.has(m)||!(m.isMeshStandardMaterial||m.isMeshBasicMaterial)||m.transparent)continue;
        patched.set(m,patch(m,type,controls));
      }
    });
    const lake=city.water?.material;
    if(lake?.isShaderMaterial&&!patched.has(lake)){
      const prev=lake.fragmentShader;
      Object.assign(lake.uniforms,{wxRain:controls.wxRain});
      lake.fragmentShader='uniform float wxRain;\n'+noise+prev.replace('vec3 N=normalize(vec3(-slope.x,1.,-slope.y));',`
        if(wxRain>.001){
          float nearSurface=1.-smoothstep(35.,105.,distance(cameraPosition,where));
          slope*=1.+.39*wxRain;
          if(nearSurface>.001){
            slope+=nearSurface*wxRain*(.085*wxRing(p*2.18,time)+.046*wxRing(p.yx*3.76+11.7,time*1.11));
          }
        }
        vec3 N=normalize(vec3(-slope.x,1.,-slope.y));`);
      lake.needsUpdate=true;
      patched.set(lake,()=>{lake.fragmentShader=prev;delete lake.uniforms.wxRain;lake.needsUpdate=true;});
    }
  }
  city.ready?.then(scan);
  return {
    set(weather,season){
      if(!installed&&(weather!=='clear'||season!=='summer')){installed=true;scan();}
      controls.wxSeason.value.set(+(season==='spring'),+(season==='autumn'),+(season==='winter'));
      controls.wxRain.value=+(weather==='rain');
      snowFalling=weather==='snow';
      if(snowFalling)controls.wxSnow.value=Math.max(.67,controls.wxSnow.value);
      else if(weather!=='aurora'||season!=='winter')controls.wxSnow.value=0;
    },
    update(time,dt){
      controls.wxTime.value=time;
      if(snowFalling)controls.wxSnow.value=Math.min(1,controls.wxSnow.value+dt*.011);
      else if(controls.wxSnow.value>0)controls.wxSnow.value=Math.max(0,controls.wxSnow.value-dt*.0013);
    },
    dispose(){disposed=true;for(const restore of patched.values())restore();patched.clear();}
  };
}
