import * as T from 'three';
import {weatherSurfaces} from './weather-surfaces.js';
import {weatherSky} from './weather-sky.js';

const light={
  clear:{sun:1,environment:1,background:1,hemi:1,fog:null,density:null,night:0},
  rain:{sun:.20,environment:.57,background:.60,hemi:1.14,fog:0x809098,density:.00059,night:.18},
  snow:{sun:.36,environment:.82,background:.75,hemi:1.22,fog:0xb9c6c9,density:.00049,night:.09},
  aurora:{sun:.82,environment:.83,background:.9,hemi:.92,fog:0x253746,density:.00020,night:1}
};
export function weatherLighting(weather){return light[weather]||light.clear;}

function seeds(n,seed){
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const data=new Float32Array(n*4);
  for(let i=0;i<data.length;i++)data[i]=random();
  return data;
}

const head=`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float wxClock,wxScreen,wxDark;
  uniform sampler2D wxCover;
  uniform float wxCoverExtent;
  attribute vec4 mark;
  varying float wxAlpha,wxTint,wxFine;
  vec3 wrapWorld(vec3 pos,vec3 extent){
    // Seeds wrap into the camera's current volume. Their trajectories remain
    // fixed in city coordinates as one walks past or turns the camera.
    return cameraPosition+mod(pos-cameraPosition+extent*.5,extent)-extent*.5;
  }
  float exposureToSky(vec3 world){
    vec2 uv=world.xz/(2.*wxCoverExtent)+.5;
    if(any(lessThan(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return 1.;
    float code=texture2D(wxCover,uv).r;
    if(code<=0.)return 1.;
    float roof=code*code*640.;
    return smoothstep(roof-.08,roof+.13,world.y);
  }
`;
const rainVertex=head+`
  void main(){
    float farLayer=step(.44,mark.w);
    vec3 span=mix(vec3(24.,18.,24.),vec3(68.,39.,68.),farLayer);
    float gust=sin(wxClock*.32+mark.x*4.1);
    vec3 velocity=vec3(2.36+1.65*mark.z,-11.-8.9*mark.x,.91+mark.y*.72);
    vec3 p=wrapWorld(mark.xyz*span+velocity*wxClock+vec3(gust*.34,0.,gust*.19),span);
    vec3 eye=cameraPosition-p;
    float distanceToEye=length(eye);
    vec3 tangent=normalize(cross(velocity,eye));
    float width=max(.0037+mark.y*.0048,distanceToEye*.00048);
    float lengthMetres=.12+.25*mark.z+.05*farLayer;
    p+=tangent*position.x*width+normalize(velocity)*position.y*lengthMetres;
    vec3 boundary=abs((p-cameraPosition)/span)*2.;
    float edge=1.-smoothstep(.79,1.,max(max(boundary.x,boundary.z),boundary.y));
    wxAlpha=step(1.,wxScreen)*(.28+.47*mark.y)*edge*smoothstep(.25,.8,distanceToEye)*smoothstep(.13,.30,p.y)*exposureToSky(p);
    wxTint=mark.z;wxFine=position.y;
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
    #include <logdepthbuf_vertex>
  }`;
const snowVertex=head+`
  void main(){
    float farLayer=step(.42,mark.w);
    vec3 span=mix(vec3(22.,16.,22.),vec3(58.,34.,58.),farLayer);
    float t=wxClock;
    vec3 p=mark.xyz*span+vec3(1.02+.59*mark.y,-.63-.91*mark.z,.19+.34*mark.z)*t;
    p.x+=sin(t*(.49+.26*mark.w)+mark.x*39.)*(.13+.47*mark.y);
    p.z+=cos(t*(.59+.35*mark.y)+mark.z*19.)*(.16+.47*mark.w);
    p.y+=.055*sin(t*(1.+mark.x)+mark.w*28.);
    p=wrapWorld(p,span);
    vec3 edge=2.*abs((p-cameraPosition)/span);
    float fade=1.-smoothstep(.78,1.,max(edge.x,max(edge.y,edge.z)));
    vec4 mv=viewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    float roll=.76+.24*abs(sin(t*(.49+mark.x)+mark.z*57.));
    float size=(.021+pow(mark.y,2.)*.044)*roll*wxScreen*projectionMatrix[1][1]/max(.38,-mv.z);
    gl_PointSize=clamp(size,1.0,13.);
    wxAlpha=step(1.,wxScreen)*fade*smoothstep(.42,.91,-mv.z)*smoothstep(.13,.26,p.y)*(.50+.48*mark.y)*min(1.,size+.22)*exposureToSky(p);
    wxFine=roll;wxTint=mark.w*6.283;
    #include <logdepthbuf_vertex>
  }`;
const rainFragment=`
    float tip=pow(max(0.,1.-abs(wxFine)*1.72),.41);
    vec3 color=mix(vec3(.48,.58,.67),vec3(.85,.90,.92),wxTint)*mix(1.,.54,wxDark);
    gl_FragColor=vec4(color,wxAlpha*tip*.59);
`;
const snowFragment=`
    vec2 p=(gl_PointCoord-.5)*2.;
    float d=length(p);
    float arms=.78+.13*cos(6.*atan(p.y,p.x)+wxTint);
    float soft=(1.-smoothstep(arms*.30,arms,d))*.89+.11*exp(-4.*d*d);
    vec3 color=mix(vec3(.75,.83,.89),vec3(1.,1.,.985),wxFine)*mix(1.,.72,wxDark);
    gl_FragColor=vec4(color,wxAlpha*soft);
`;

function particles(snow,low,cover){
  const n=snow?(low?2400:7300):(low?2900:8700);
  const geo=snow?new T.BufferGeometry():new T.InstancedBufferGeometry();
  if(snow){
    geo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(n*3),3));
    geo.setAttribute('mark',new T.BufferAttribute(seeds(n,9100),4));
  }else{
    geo.setAttribute('position',new T.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
    geo.setIndex([0,1,2,0,2,3]);geo.instanceCount=n;
    geo.setAttribute('mark',new T.InstancedBufferAttribute(seeds(n,3011),4));
  }
  const mat=new T.ShaderMaterial({
    side:T.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{wxClock:{value:0},wxScreen:{value:430},wxDark:{value:0},...cover},
    vertexShader:snow?snowVertex:rainVertex,fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float wxDark;varying float wxAlpha,wxTint,wxFine;
      void main(){
        if(wxAlpha<.004)discard;
        #include <logdepthbuf_fragment>
        ${snow?snowFragment:rainFragment}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  mat.forceSinglePass=true;
  const o=snow?new T.Points(geo,mat):new T.Mesh(geo,mat);
  o.name=snow?'季候 · 世界坐标风雪':'季候 · 世界坐标雨丝';
  o.frustumCulled=false;o.renderOrder=96;o.visible=false;o.userData.excludeFromProbe=true;
  const bufferSize=new T.Vector2();
  o.onBeforeRender=function(renderer,scene,camera){
    // Exclude precipitation from the street's wet-road reflection and cube
    // probes. Actual lake reflections still contain the overcast sky/aurora.
    const reflection=scene.userData.reflectingRoad||scene.userData.capturingProbe||camera.userData?.isReflector||camera.isArrayCamera;
    mat.uniforms.wxScreen.value=reflection?0:renderer.getDrawingBufferSize(bufferSize).y*.5;
  };
  return o;
}

export function createWeather(scene,city,{low=false,vehicles}={}){
  const surfaces=weatherSurfaces(city,vehicles),sky=weatherSky(scene,low);
  const cover={wxCover:{value:null},wxCoverExtent:{value:3200}};
  const rain=particles(false,low,cover),snow=particles(true,low,cover);scene.add(rain,snow);
  let current='clear',emptyCover;
  return {
    set({weather='clear',season='summer'}={},skyContext={}){
      current=Object.hasOwn(light,weather)?weather:'clear';
      const period=typeof skyContext==='string'?skyContext:skyContext?.period||'day';
      const horizon=skyContext?.fog??weatherLighting(current).fog;
      sky.set(current,period,horizon);
      rain.visible=current==='rain';snow.visible=current==='snow';
      if((rain.visible||snow.visible)&&!cover.wxCover.value){
        const map=city.getWeatherCover?.();
        if(map?.texture){
          cover.wxCover.value=map.texture;cover.wxCoverExtent.value=map.extent;
        }else{
          emptyCover=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);
          emptyCover.needsUpdate=true;cover.wxCover.value=emptyCover;
        }
      }
      rain.material.uniforms.wxDark.value=snow.material.uniforms.wxDark.value=period==='night'?1:period==='dusk'?.55:0;
      surfaces.set(current,season,period);
    },
    setMoonVisible(visible){return sky.setMoonVisible(visible);},
    get moonVisible(){return sky.moonVisible;},
    update(time,dt,camera){
      surfaces.update(time,dt);
      sky.update(time,camera);
      if(rain.visible)rain.material.uniforms.wxClock.value=time;
      if(snow.visible)snow.material.uniforms.wxClock.value=time;
    },
    dispose(){
      surfaces.dispose();sky.dispose();emptyCover?.dispose();
      for(const o of [rain,snow]){scene.remove(o);o.geometry.dispose();o.material.dispose();}
    }
  };
}
