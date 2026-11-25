import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {surfaceNoise} from './weather-surfaces.js';
import {atmosphereChunk} from './atmosphere-glsl.js';
import {Surface} from './city-geometry.js';
import regional from './bay-crossing.json';

// A distance-to-bank mask from the mapped lake outline, including island shores.
function bankTexture(lake){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
  const c=canvas.getContext('2d');c.fillStyle='#ff0000';c.fillRect(0,0,768,768);
  c.setTransform(.64,0,0,.64,384,384);
  c.beginPath();
  for(const ring of [lake.p,...(lake.holes||[])]){
    ring.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.closePath();
  }
  c.fillStyle='#ffff00';c.fill('evenodd');c.clip('evenodd');c.lineJoin='round';
  for(let i=32;i>=1;i--){c.lineWidth=i*2;c.strokeStyle='rgb('+Math.round((i-1)/32*255)+',255,0)';c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.NoColorSpace;
  return texture;
}

// Coastal shallow-shelf distance mask for open Shenzhen Bay sea (covers x:-3200..3200, z:-400..6000).
function seaBankTexture(sea){
  const size=1024,span=6400,scale=size/span,cz=2800;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d');c.fillStyle='#ff0000';c.fillRect(0,0,size,size);
  c.setTransform(scale,0,0,scale,size*.5,size*.5-cz*scale);
  c.beginPath();
  for(const ring of [sea.p,...(sea.holes||[])]){
    ring.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.closePath();
  }
  c.fillStyle='#ffff00';c.fill('evenodd');c.clip('evenodd');c.lineJoin='round';
  for(let i=28;i>=1;i--){c.lineWidth=i*2;c.strokeStyle='rgb('+Math.round((i-1)/28*255)+',255,0)';c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.NoColorSpace;
  return texture;
}

const lakeShader={
  name:'Shenzhen tidal water',
  uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{
    tDiffuse:{value:null},color:{value:new T.Color()},textureMatrix:{value:new T.Matrix4()},
    waves:{value:null},banks:{value:null},seaBanks:{value:null},time:{value:0},sunDirection:{value:new T.Vector3()},
    sunColor:{value:new T.Color()},night:{value:0},rainAmount:{value:0},snowCover:{value:0},
    bridgeEnds:{value:new T.Vector4()},bridgeHalfWidth:{value:0},
    uAtmoSunDir:{value:new T.Vector3(.1,.75,-.66)},uAtmoSunColor:{value:new T.Color(0xffeed6)},
    uAtmoTime:{value:0},uAtmoCloud:{value:0},uAtmoHeight:{value:.0085},uAtmoMie:{value:.3},uAtmoNight:{value:0}
  }]),
  vertexShader:`
    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    uniform mat4 textureMatrix;
    varying vec4 reflected; varying vec3 where;
    void main(){
      where=(modelMatrix*vec4(position,1.)).xyz;
      reflected=textureMatrix*vec4(position,1.);
      vec4 mvPosition=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }`,
  fragmentShader:`
    #include <common>
    #include <logdepthbuf_pars_fragment>
    #include <fog_pars_fragment>
    uniform sampler2D tDiffuse,waves,banks,seaBanks;
    uniform mat4 textureMatrix;
    uniform vec3 sunColor,sunDirection;
    uniform float time,night,rainAmount,snowCover;
    uniform vec4 bridgeEnds;uniform float bridgeHalfWidth;
    ${surfaceNoise}
    ${atmosphereChunk}
    varying vec4 reflected; varying vec3 where;
    float windHash(vec2 p){vec3 s=fract(vec3(p.xyx)*.1031);s+=dot(s,s.yzx+33.33);return fract((s.x+s.y)*s.z);}
    float windNoise(vec2 p){
      vec2 k=floor(p),v=fract(p);v=v*v*(3.-2.*v);
      return mix(mix(windHash(k),windHash(k+vec2(1,0)),v.x),mix(windHash(k+vec2(0,1)),windHash(k+1.),v.x),v.y);
    }
    float fbmWater(vec2 p){
      return .54*windNoise(p)+.28*windNoise(p*2.07+3.1)+.18*windNoise(p*4.31-5.7);
    }
    // Trochoidal (Gerstner-like) wave component returning vec3(height, dH/dx, dH/dz).
    // Sharper wave crests & broader smooth troughs create realistic liquid ocean silhouettes.
    vec3 gerstner(vec2 p,vec2 dir,float freq,float speed,float amp,float sharp){
      float phase=dot(p,dir)*freq-time*speed;
      float fw=fwidth(phase);
      float atten=1.-smoothstep(.45,2.6,fw);
      float s=sin(phase)*.5+.5;
      float crest=pow(max(s,.0001),sharp);
      float h=(crest*2.-1.)*amp*atten;
      float dh=sharp*pow(max(s,.0001),max(sharp-1.,0.))*cos(phase)*freq*amp*atten;
      return vec3(h,dir*dh);
    }
    // Underwater caustic web projected onto shallow sand/rock seabed.
    float caustics(vec2 p,float t){
      vec2 a=p*.62+vec2(t*.24,-t*.19);
      vec2 b=p*.88+vec2(-t*.21,t*.27);
      float w1=abs(sin(a.x+sin(a.y*1.4+t*.6))+cos(a.y+cos(a.x*1.3-t*.5)));
      float w2=abs(sin(b.x*1.2-cos(b.y*1.1+t*.7))+cos(b.y*1.1+sin(b.x*1.2-t*.4)));
      float c1=pow(max(0.,1.-w1*.48),4.5);
      float c2=pow(max(0.,1.-w2*.48),4.5);
      return clamp((c1+c2)*.72,0.,1.);
    }
    vec2 projectRay(vec3 d){
      vec4 r=textureMatrix*vec4(d.x,-d.z,d.y,0.);
      return r.xy/max(.02,r.w);
    }
    void main(){
      #include <logdepthbuf_fragment>
      vec3 V=normalize(cameraPosition-where);
      float camDist=distance(cameraPosition,where);
      vec2 p=where.xz,uv=p*vec2(1.,-1.)/1200.+.5;
      vec2 coast=texture2D(banks,uv).rg;
      float inland=coast.g*step(0.,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
      // Sample coastal depth for open Shenzhen Bay sea too.
      vec2 seaUv=vec2(p.x/6400.+.5,.5-(p.y-2800.)/6400.);
      float inSeaBox=step(0.,min(min(seaUv.x,seaUv.y),min(1.-seaUv.x,1.-seaUv.y)));
      float seaCoast=mix(1.,texture2D(seaBanks,clamp(seaUv,0.,1.)).r,inSeaBox);
      float depth=mix(seaCoast,coast.r,inland);
      float openSea=1.-inland;

      // Multi-scale wind & current field with macro calm/gust patches (breaks up periodic aerial striping).
      float macroPatch=fbmWater(p*.0085+vec2(time*.007,-time*.005));
      float windPatch=.55*windNoise(p*vec2(.021,.031)+vec2(time*.028,time*.011))
                     +.45*windNoise(p*.074+vec2(time*.044,-time*.018));
      float breeze=smoothstep(.20,.82,windPatch*.70+macroPatch*.30);
      float drift=texture2D(waves,p*.0065+vec2(time*.0014,time*.0006)).r;
      // Strong low-frequency domain warp eliminates parallel "washboard" bands from drone altitudes.
      vec2 warp=vec2(
        fbmWater(p*.016+vec2(time*.011,-time*.008))-.5,
        fbmWater(p*.016+vec2(-time*.009,time*.012)+vec2(13.7,5.2))-.5
      )*mix(15.5,24.0,openSea);
      vec2 adv=p+warp+vec2(drift*3.6,drift*2.1);

      // Sheltered Talent Lake stays gentle & mirror-like; open Shenzhen Bay keeps coastal chop.
      float aerialCalm=1.-smoothstep(65.,340.,camDist)*.68;
      float seaScale=mix(.24,1.25,openSea)*mix(.52,1.0,smoothstep(0.,.22,depth))*aerialCalm;
      vec3 w1=gerstner(adv,normalize(vec2(.64,.77)),.36,1.05,.18*seaScale,1.45);
      vec3 w2=gerstner(adv*1.04+vec2(7.,-11.),normalize(vec2(-.58,.81)),.69,1.42,.13*seaScale,1.50);
      vec3 w3=gerstner(adv*.97+vec2(-19.,4.),normalize(vec2(.93,-.36)),1.31,1.95,.085*seaScale,1.55);
      vec3 w4=gerstner(p+warp*.45,normalize(vec2(-.84,-.54)),2.45,2.65,.046*seaScale,1.45);
      vec3 w5=gerstner(p+warp*.2,normalize(vec2(.28,.96)),4.9,3.5,.024*seaScale,1.35);
      vec3 w6=gerstner(p,normalize(vec2(-.41,.91)),9.2,4.6,.012*seaScale,1.3);

      float gustMod=.42+.74*breeze;
      float waveH=(w1.x+w2.x+w3.x+w4.x+w5.x+w6.x)*gustMod;
      vec2 slope=(w1.yz+w2.yz+w3.yz+w4.yz+w5.yz+w6.yz)*gustMod;

      // Multi-octave capillary ripples from waternormals.jpg (smoothly attenuated at long distance).
      float detailFade=1.-smoothstep(55.,460.,camDist);
      vec2 fine1=texture2D(waves,p*vec2(.085,.102)+vec2(time*.012,-time*.009)).rg*2.-1.;
      vec2 fine2=texture2D(waves,p.yx*vec2(.19,-.16)+vec2(time*.016,time*.010)).gr*2.-1.;
      vec2 micro=texture2D(waves,p*vec2(.42,.47)+vec2(-time*.022,time*.017)).rg*2.-1.;
      vec2 fine=fine1*.52+fine2*.34+micro*.22*detailFade;
      slope+=fine*mix(.032,.064,openSea)*(.48+.78*breeze)*mix(.62,1.,detailFade);

      float ice=inland*smoothstep(.03,.70,snowCover);
      if(rainAmount>.001){
        float nearSurface=1.-smoothstep(35.,115.,camDist);
        slope*=1.+.42*rainAmount;
        if(nearSurface>.001)slope+=nearSurface*rainAmount*(.095*wxRing(p*2.18,time)+.052*wxRing(p.yx*3.76+11.7,time*1.11));
      }
      if(ice>.001){
        vec2 frozen=texture2D(waves,p*.095).rg*2.-1.;
        slope=mix(slope,frozen*.008,ice);breeze*=1.-ice;fine=mix(fine,frozen,ice);waveH*=1.-ice;
      }
      vec3 N=normalize(vec3(-slope.x,1.,-slope.y));

      // Planar reflection with physically-bounded wave distortion.
      vec2 center=reflected.xy/max(.001,reflected.w);
      vec2 offset=projectRay(reflect(-V,N))-projectRay(reflect(-V,vec3(0.,1.,0.)));
      vec2 sampleUV=clamp(center+clamp(offset,vec2(-.058),vec2(.058))*.66,vec2(.002),vec2(.998));
      float ndv=clamp(mix(max(dot(N,V),0.),max(V.y,0.),.32),0.,1.);
      float fresnel=.022+.978*pow(max(1.-ndv,1e-4),5.);
      float lod=.35+.75*(1.-fresnel)+.38*length(fine)+.72*breeze;
      vec3 reflection=texture2DLodEXT(tDiffuse,sampleUV,lod).rgb;
      if(night>.25&&ice<.99){
        float roughNight=smoothstep(.25,.95,night)*(1.-ice);
        vec2 blur=vec2(.0028*(fine.x+slope.x*10.),.008+.022*breeze+.013*length(fine));
        vec3 streak=reflection*.26;
        for(int i=1;i<=3;i++){
          float s=float(i)/3.,weight=(4.-float(i))*.06167;
          streak+=weight*(texture2DLodEXT(tDiffuse,clamp(sampleUV+blur*s,.002,.998),lod+.80).rgb+
                          texture2DLodEXT(tDiffuse,clamp(sampleUV-blur*s,.002,.998),lod+.80).rgb);
        }
        reflection=mix(reflection,streak,roughNight*.88);
      }

      // Natural Shenzhen Bay & Talent Lake optical palette (grounded coastal jade-slate, less neon-pool teal).
      float daylight=1.-smoothstep(.15,.92,night);
      float overcast=clamp(rainAmount*.65+snowCover*.4,0.,1.);
      vec3 shallowSea=vec3(.095,.36,.40);     // Sunlit coastal shallow teal-slate
      vec3 midSea=vec3(.036,.22,.30);         // Natural Shenzhen Bay estuary green-blue
      vec3 deepSea=vec3(.018,.125,.205);      // Deep outer bay marine blue
      vec3 shallowLake=vec3(.085,.31,.32);    // Calm park lagoon shallow jade
      vec3 deepLake=vec3(.024,.135,.175);     // Deep calm Talent Lake body

      vec3 waterShallow=mix(shallowSea,shallowLake,inland);
      vec3 waterMid=mix(midSea,mix(shallowLake,deepLake,.54),inland);
      vec3 waterDeep=mix(deepSea,deepLake,inland);
      vec3 body=mix(waterShallow,waterMid,smoothstep(.02,.34,depth));
      body=mix(body,waterDeep,smoothstep(.26,.92,depth));
      // Subtle ambient wind-patch tone variation across large lake expanses
      body*=.92+.16*macroPatch;
      // Modulate saturation slightly on overcast rain/snow days and deepen cleanly at night.
      body=mix(body,vec3(dot(body,vec3(.25,.60,.15)))*vec3(.78,.94,.98),overcast*.42);
      body*=mix(.22,1.00,daylight);

      // Shallow seabed sand translucency & subtle underwater caustics near banks.
      float shallowMask=(1.-smoothstep(.0,.24,depth))*(1.-fresnel*.80)*(1.-ice)*daylight;
      if(shallowMask>.005){
        vec2 refrP=p+N.xz*(.42+depth*1.4);
        float cWeb=caustics(refrP,time)*(1.-smoothstep(38.,160.,camDist));
        vec3 sandBed=mix(vec3(.36,.38,.31),vec3(.16,.36,.36),smoothstep(.0,.18,depth));
        vec3 causticGlow=vec3(.26,.58,.56)*cWeb*(.52+.48*max(sunDirection.y,0.))*(1.-overcast*.6);
        body=mix(body,sandBed*.50+body*.65,shallowMask*.44)+causticGlow*shallowMask*.46;
      }
      // Wet darkened shoreline contact edge softens the hard join between lake and stone banks.
      float bankShade=smoothstep(.0,.038,depth);
      body*=mix(.72,1.0,bankShade);

      // Physical Subsurface Scattering (SSS) restrained on calm inner lake to prevent striped bands.
      float crest=smoothstep(.02,.32,waveH);
      float backLight=pow(max(1e-4,clamp(dot(V,-sunDirection+N*.45),0.,1.)),3.4);
      float viewTilt=pow(max(1.-ndv,1e-4),1.6);
      float sssMask=crest*(.24+.62*backLight+.34*viewTilt)*daylight*(1.-overcast*.5)*(1.-ice)*aerialCalm;
      vec3 sssTint=mix(vec3(.05,.46,.46),vec3(.10,.58,.56),openSea);
      body+=sssTint*sssMask*mix(.18,.48,openSea)*max(.25,sunDirection.y+.38);

      // Combine refracted water body with Schlick Fresnel planar reflection (stronger mirror sky on calm patches).
      float reflWeight=clamp(fresnel*(.95-.08*breeze)+.045*(1.-breeze),0.,1.);
      vec3 light=mix(body,reflection*.97,reflWeight);

      // Shoreline lapping surf foam & gentle open-sea whitecap wisps on steep crests.
      float foamNoise=fbmWater(p*.42+vec2(time*.16,-time*.12));
      float foamFine=fbmWater(p*1.65+vec2(-time*.28,time*.22)+slope*2.4);
      float lapWave=.5+.5*sin(depth*34.-time*2.6+foamNoise*4.2);
      float shoreBand=(1.-smoothstep(.0,.075,depth))*smoothstep(.26,.76,foamNoise*.58+foamFine*.42+.24*lapWave);
      float edgeLip=(1.-smoothstep(.0,.022,depth))*(.45+.55*foamFine);
      float crestChop=openSea*smoothstep(.16,.44,waveH+length(slope)*.22)*smoothstep(.48,.82,foamNoise*.5+foamFine*.5)*breeze;
      float foam=clamp((shoreBand*.62+edgeLip*.55+crestChop*.52)*(1.-ice),0.,1.);
      vec3 foamColor=mix(vec3(.84,.94,.96),vec3(.24,.31,.38),night)*(1.-overcast*.18);
      light=mix(light,foamColor,foam*mix(.52,.78,openSea));

      // Dual-lobe solar & lunar specular glitter (broad sheen + crisp diamond wave sparkles).
      vec3 rawH=V+sunDirection;
      vec3 H=dot(rawH,rawH)>1e-8?normalize(rawH):vec3(0.,1.,0.);
      float ndh=max(dot(N,H),1e-4);
      float sunVis=smoothstep(-.03,.14,sunDirection.y);
      float sunBroad=pow(ndh,90.)*.16;
      float sunGlint=pow(ndh,760.)*1.15;
      float lightFactor=mix(1.,0.42,night)*(1.-overcast*.72)*(1.-ice*.7);
      float cloudWater=atmoDirectCloudFactor(p,uAtmoTime,uAtmoCloud*.92);
      vec3 glintColor=mix(sunColor,vec3(.96,.88,.70),night*.85);
      light+=glintColor*(sunBroad+sunGlint)*sunVis*lightFactor*cloudWater;

      if(night>.2&&bridgeHalfWidth>0.){
        vec2 span=bridgeEnds.zw-bridgeEnds.xy,relative=p-bridgeEnds.xy;
        float lengthM=length(span),alongM=dot(relative,span)/lengthM;
        float offsetM=abs(relative.x*span.y-relative.y*span.x)/lengthM;
        float spill=exp(-abs(offsetM-bridgeHalfWidth)*.27)*
          smoothstep(-1.,2.,alongM)*smoothstep(-1.,2.,lengthM-alongM);
        light+=vec3(.0018,.018,.183)*spill*night*(.74+.26*drift)*(1.-ice);
      }

      if(ice>.001){
        float field=.56*windNoise(p*vec2(.047,.092))+.29*windNoise(p*.28)+.15*windNoise(p*1.37);
        float powder=snowCover*smoothstep(.33,.68,field+.19*(1.-depth));
        // Slightly warped fracture lines stay fixed in the ice under moving reflections.
        vec2 cell=p*.23+.27*vec2(windNoise(p*.59),windNoise(p*.45+5.1));
        vec2 id=floor(cell),f=fract(cell);float near1=8.,near2=8.;
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
          vec2 off=vec2(float(i),float(j));
          vec2 q=off+.18+.64*vec2(windHash(id+off),windHash(id+off+7.3))-f;
          float d=dot(q,q);near2=min(near2,max(near1,d));near1=min(near1,d);
        }
        float fissure=1.-smoothstep(.012,.041+fwidth(near2-near1),near2-near1);
        vec3 sheet=mix(vec3(.12,.28,.33),vec3(.42,.58,.62),field)+fissure*vec3(.18,.22,.22);
        float ambient=mix(1.,.12,night);
        sheet=mix(sheet*ambient,reflection,.22+.45*fresnel);
        vec3 frost=vec3(.82,.89,.93)*(.80+.20*field)*ambient;
        light=mix(light,mix(sheet,frost,powder),ice);
      }
      gl_FragColor=vec4(light,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #ifdef USE_FOG
        #ifdef FOG_EXP2
          gl_FragColor.rgb=atmoHeightFog(gl_FragColor.rgb,where,fogColor,fogDensity);
        #else
          #include <fog_fragment>
        #endif
      #endif
    }`
};

export function makeLake(root,map,options){
  const surface=new Surface();
  surface.polygon(regional.sea.p,regional.sea.holes,0,1);
  for(const feature of map.water)surface.polygon(feature.p,feature.holes,0,1);
  const geom=surface.geometry();if(!geom)return null;
  geom.rotateX(Math.PI/2);
  const water=new Reflector(geom,{textureWidth:512,textureHeight:288,shader:lakeShader,clipBias:.00005,multisample:0});
  water.name='人才湖与深圳湾 · 水面反射';water.rotation.x=-Math.PI/2;water.position.y=.151;water.material.fog=true;
  const uniforms=water.material.uniforms;
  const bridge=map.roads.find(r=>r.id===562534109);
  if(bridge){uniforms.bridgeEnds.value.set(...bridge.p[0],...bridge.p.at(-1));uniforms.bridgeHalfWidth.value=bridge.width*.5;}
  uniforms.waves.value=new T.TextureLoader().load('/city/waternormals.jpg');
  uniforms.waves.value.wrapS=uniforms.waves.value.wrapT=T.RepeatWrapping;
  uniforms.banks.value=bankTexture(map.water.find(f=>Number(f.id)===map.landmarks.lake.id));
  uniforms.seaBanks.value=seaBankTexture(regional.sea);
  const rt=water.getRenderTarget();rt.texture.minFilter=T.LinearMipmapLinearFilter;rt.texture.generateMipmaps=true;
  const excluded=root.children.filter(o=>['后海 · Sentinel-2 真彩色地表','园林草地','硬质铺装广场','停车场','潮间带','运动场'].includes(o.name));
  const smallInReflection=/灌木|三角梅|绿篱|根际阴影|隔离护栏|雨水|井盖|井圈|导向砖|盲道|垃圾桶|消防栓|共享单车|环网柜|石球|树池|沿阶草|枯叶裙|卵石|座椅|底座|接头|透镜|检修盖|花箱|镶边|框线|接触阴影|环境阴影/;
  const reflect=water.onBeforeRender,eye=new T.Vector3(1e6,0,0),rot=new T.Quaternion(),size=new T.Vector2();
  let last=-1e6;
  water.onBeforeRender=function(renderer,scene,camera,...args){
    if(scene.userData.capturingProbe || scene.userData.reflectingRoad || camera.isArrayCamera)return;
    const now=performance.now(),low=options.quality==='low'||scene.userData.perfTier>=1;
    renderer.getDrawingBufferSize(size);
    const scale=Math.min(low?.36:.48,(low?640:960)/size.x);
    const width=Math.max(160,Math.round(size.x*scale)),height=Math.max(128,Math.round(size.y*scale));
    const resizing=rt.width!==width||rt.height!==height;
    if(resizing)rt.setSize(width,height);
    const minInterval=low?50:28;
    const idleInterval=low?160:95;
    if(!resizing && now-last<minInterval)return;
    if(!resizing && now-last<idleInterval && eye.distanceToSquared(camera.position)<.0225 && rot.angleTo(camera.quaternion)<.006)return;
    const hidden=[];
    for(const o of excluded){if(o.visible){hidden.push(o);o.visible=false;}}
    const details=root.userData.localDetails;
    if(details){
      for(let i=0;i<details.length;i++){
        const item=details[i].item;
        if(item.visible && smallInReflection.test(item.name)){hidden.push(item);item.visible=false;}
      }
    }
    scene.userData.reflectingWater=true;
    try{reflect.call(this,renderer,scene,camera,...args);}
    finally{
      for(let i=0;i<hidden.length;i++)hidden[i].visible=true;
      scene.userData.reflectingWater=false;
    }
    last=now;eye.copy(camera.position);rot.copy(camera.quaternion);
  };
  root.add(water);return water;
}
