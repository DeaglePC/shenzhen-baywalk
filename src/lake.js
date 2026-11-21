import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {Surface} from './city-geometry.js';

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

const lakeShader={
  name:'Shenzhen tidal water',
  uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{
    tDiffuse:{value:null},color:{value:new T.Color()},textureMatrix:{value:new T.Matrix4()},
    waves:{value:null},banks:{value:null},time:{value:0},sunDirection:{value:new T.Vector3()},
    sunColor:{value:new T.Color()},night:{value:0}
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
    uniform sampler2D tDiffuse,waves,banks;
    uniform mat4 textureMatrix;
    uniform vec3 sunColor,sunDirection;
    uniform float time,night;
    varying vec4 reflected; varying vec3 where;
    float windHash(vec2 p){vec3 s=fract(vec3(p.xyx)*.1031);s+=dot(s,s.yzx+33.33);return fract((s.x+s.y)*s.z);}
    float windNoise(vec2 p){
      vec2 k=floor(p),v=fract(p);v=v*v*(3.-2.*v);
      return mix(mix(windHash(k),windHash(k+vec2(1,0)),v.x),mix(windHash(k+vec2(0,1)),windHash(k+1.),v.x),v.y);
    }
    vec2 swell(vec2 p,vec2 axis,float frequency,float velocity,float slope){
      float k=dot(p,axis)*frequency;
      float filterWidth=fwidth(k);
      return axis*(slope*cos(k-time*velocity))*(1.-smoothstep(.5,2.9,filterWidth));
    }
    vec2 projectRay(vec3 d){
      vec4 r=textureMatrix*vec4(d.x,-d.z,d.y,0.);
      return r.xy/max(.02,r.w);
    }
    void main(){
      #include <logdepthbuf_fragment>
      vec3 V=normalize(cameraPosition-where);
      vec2 p=where.xz,uv=p*vec2(1.,-1.)/1200.+.5;
      vec2 coast=texture2D(banks,uv).rg;
      float inland=coast.g*step(0.,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
      float depth=mix(1.,coast.r,inland);
      float windPatch=.67*windNoise(p*vec2(.042,.063)+vec2(time*.025,0.))+.33*windNoise(p*.113+vec2(time*.038,0.));
      float breeze=smoothstep(.28,.73,windPatch);
      float drift=texture2D(waves,p*.0071+vec2(time*.0009,0.)).r;
      vec2 advected=p+vec2(drift*1.7,drift*.8);
      vec2 slope=swell(advected,vec2(.64,.768),2.2,1.45,.012)
                +swell(advected,vec2(-.24,.971),3.7,2.15,.010)
                +swell(p+drift,vec2(.84,.543),9.4,3.72,.015)
                +swell(p,vec2(.54,.841),17.8,4.85,.009);
      vec2 fine=texture2D(waves,p*vec2(.154,.195)+vec2(time*.008,-time*.006)).rg*2.-1.;
      fine+=texture2D(waves,p.yx*vec2(.27,-.24)+vec2(time*.009,time*.005)).gr*2.-1.;
      slope+=swell(advected,vec2(.89,.456),1.52,1.26,.016*breeze);
      slope=(slope+fine*.023)*mix(1.22,.95,inland)*mix(.72,1.,depth)*mix(.72,2.22,breeze);
      vec3 N=normalize(vec3(-slope.x,1.,-slope.y));
      vec2 center=reflected.xy/reflected.w;
      vec2 offset=projectRay(reflect(-V,N))-projectRay(reflect(-V,vec3(0.,1.,0.)));
      vec2 sampleUV=clamp(center+clamp(offset,vec2(-.045),vec2(.045))*.58,vec2(.002),vec2(.998));
      float ndv=clamp(mix(max(dot(N,V),0.),max(V.y,0.),.43),0.,1.);
      float fresnel=.0204+.9796*pow(1.-ndv,5.);
      float lod=.48+.82*(1.-fresnel)+.42*length(fine)+.87*breeze;
      vec3 reflection=texture2DLodEXT(tDiffuse,sampleUV,lod).rgb;
      vec3 deep=mix(vec3(.022,.087,.095),vec3(.013,.062,.062),inland);
      vec3 body=mix(vec3(.082,.141,.105),deep,smoothstep(.01,.78,depth));
      body*=mix(.96,.24,night);
      vec3 H=normalize(V+sunDirection);
      float sparkle=pow(max(dot(N,H),0.),850.)*.73;
      vec3 light=mix(body,reflection*.94,clamp(fresnel*(.95-.13*breeze)+.025,0.,1.));
      light+=sunColor*sparkle*(1.-night)*smoothstep(0.,.14,sunDirection.y+.025);
      gl_FragColor=vec4(light,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`
};

export function makeLake(root,map,options){
  const surface=new Surface();
  for(const feature of map.water)surface.polygon(feature.p,feature.holes,0,1);
  const geom=surface.geometry();if(!geom)return null;
  geom.rotateX(Math.PI/2);
  const water=new Reflector(geom,{textureWidth:512,textureHeight:288,shader:lakeShader,clipBias:.00005,multisample:0});
  water.name='人才湖与深圳湾 · 水面反射';water.rotation.x=-Math.PI/2;water.position.y=.151;water.material.fog=true;
  const uniforms=water.material.uniforms;
  uniforms.waves.value=new T.TextureLoader().load('/city/waternormals.jpg');
  uniforms.waves.value.wrapS=uniforms.waves.value.wrapT=T.RepeatWrapping;
  uniforms.banks.value=bankTexture(map.water.find(f=>Number(f.id)===map.landmarks.lake.id));
  const rt=water.getRenderTarget();rt.texture.minFilter=T.LinearMipmapLinearFilter;rt.texture.generateMipmaps=true;
  const excluded=root.children.filter(o=>['后海 · Sentinel-2 真彩色地表','园林草地','硬质铺装广场','停车场','潮间带','运动场'].includes(o.name));
  const reflect=water.onBeforeRender,eye=new T.Vector3(1e6,0,0),rot=new T.Quaternion(),size=new T.Vector2();
  let last=-1e6;
  water.onBeforeRender=function(renderer,scene,camera,...args){
    if(scene.userData.capturingProbe || scene.userData.reflectingRoad || camera.isArrayCamera)return;
    const now=performance.now(),low=options.quality==='low';
    renderer.getDrawingBufferSize(size);
    const scale=Math.min(low?.46:.70,(low?640:1536)/size.x);
    const width=Math.max(160,Math.round(size.x*scale)),height=Math.max(128,Math.round(size.y*scale));
    const resizing=rt.width!==width||rt.height!==height;
    if(resizing)rt.setSize(width,height);
    if(!resizing && now-last<(low?135:80) && eye.distanceToSquared(camera.position)<.0225 && rot.angleTo(camera.quaternion)<.006)return;
    const visible=excluded.map(o=>o.visible);excluded.forEach(o=>o.visible=false);
    try{reflect.call(this,renderer,scene,camera,...args);}
    finally{excluded.forEach((o,i)=>o.visible=visible[i]);}
    last=now;eye.copy(camera.position);rot.copy(camera.quaternion);
  };
  root.add(water);return water;
}
