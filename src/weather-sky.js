import * as T from 'three';

function random(seed) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
const noise=`
 float skyHash(vec2 p){vec3 k=fract(vec3(p.xyx)*.1031);k+=dot(k,k.yzx+33.33);return fract((k.x+k.y)*k.z);}
 float skyNoise(vec2 p){
   vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
   return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+1.),f.x),f.y);
 }
 float cloud(vec2 p){return .54*skyNoise(p)+.26*skyNoise(p*2.07+1.8)+.13*skyNoise(p*4.31-9.2)+.07*skyNoise(p*8.9+4.4);}
`;
const skyVertex=`
 varying vec3 skyDir;
 void main(){
   skyDir=position;
   // Rotating the active camera preserves the sky in planar/cubemap captures.
   gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);
   gl_Position.z=gl_Position.w*.9999998;
 }`;

function skyDome(){
  const mat=new T.ShaderMaterial({
    side:T.BackSide,depthTest:false,depthWrite:false,uniforms:{
      skyMode:{value:1},skyClock:{value:0},horizon:{value:new T.Color()},
      periodNight:{value:0},skyWarm:{value:0}
    },vertexShader:skyVertex,fragmentShader:`
      varying vec3 skyDir;
      uniform float skyMode,skyClock,periodNight,skyWarm;
      uniform vec3 horizon;
      ${noise}
      void main(){
        vec3 d=normalize(skyDir);
        float h=max(d.y,0.),haze=smoothstep(-.035,.52,d.y);
        vec2 plane=d.xz/(.16+h*.84);
        vec3 result;
        if(skyMode>2.5){
          float band=exp(-8.*abs(dot(d,normalize(vec3(.47,.49,-.72)))-.17));
          float dust=cloud(d.xz*12.+d.y*5.);
          vec3 high=vec3(.007,.015,.041)+band*dust*vec3(.014,.017,.025);
          float glow=pow(1.-min(h,1.),10.)*(.79+.21*sin(atan(d.x,d.z)*3.5));
          result=mix(horizon,high,haze)+vec3(.033,.019,.010)*glow;
        }else{
          vec2 travel=vec2(skyClock*.0026,skyClock*.00113);
          float high=cloud(plane*1.83+travel),low=cloud(plane*3.23-travel*.74+high*.73);
          float deck=high*.60+low*.40;
          vec3 zenith=skyMode>1.5?vec3(.53,.61,.68):vec3(.17,.22,.28);
          zenith*=mix(1.,.30,periodNight);
          vec3 base=mix(horizon,zenith,haze);
          float soft=pow(max(0.,dot(d,normalize(vec3(-.72,.46,-.28)))),3.);
          vec3 light=vec3(.99,1.02,1.04)+skyWarm*vec3(.10,.012,-.09);
          result=base*(1.+(deck-.50)*mix(.78,1.68,haze))+
                 light*soft*haze*(.021+.064*high)*(1.-periodNight*.60);
        }
        gl_FragColor=vec4(result,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh=new T.Mesh(new T.SphereGeometry(1,72,40),mat);mesh.name='天气 · 层云与高空散射';
  mesh.frustumCulled=false;mesh.renderOrder=-19000;return mesh;
}

function stars(low) {
  const n=low?1900:4400,r=random(937715);
  const positions=[],intensity=[],tints=[],sizes=[];
  for(let i=0;i<n;i++){
    const y=.025+.975*r(),a=r()*Math.PI*2,x=Math.sqrt(1-y*y);
    positions.push(x*Math.cos(a),y,x*Math.sin(a));
    const magnitude=Math.pow(r(),4.4),heat=r();
    intensity.push((.20+1.5*magnitude)*Math.min(1,(y-.013)*6.));
    sizes.push(.63+1.94*magnitude);
    tints.push(heat>.84?1:.76+.24*heat,heat>.84?.84:.86+.14*heat,heat>.84?.65:1);
  }
  const geom=new T.BufferGeometry();
  geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geom.setAttribute('gain',new T.Float32BufferAttribute(intensity,1));
  geom.setAttribute('temperature',new T.Float32BufferAttribute(tints,3));
  geom.setAttribute('diameter',new T.Float32BufferAttribute(sizes,1));
  const mat=new T.ShaderMaterial({transparent:false,blending:T.AdditiveBlending,depthTest:false,depthWrite:false,
    uniforms:{skyClock:{value:0},skyScale:{value:1}},vertexShader:`
      attribute float gain,diameter;attribute vec3 temperature;uniform float skyClock,skyScale;
      varying vec3 starColor;varying float starGain;
      void main(){
        gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position.z=gl_Position.w*.999999;
        gl_PointSize=clamp(diameter*skyScale,1.,5.);
        starColor=temperature;starGain=gain*(.95+.05*sin(skyClock*1.1+position.x*132.));
      }`,fragmentShader:`
      varying vec3 starColor;varying float starGain;
      void main(){float r=length(gl_PointCoord-.5)*2.;
        float profile=exp(-4.6*r*r)*(1.-smoothstep(.74,1.,r));
        gl_FragColor=vec4(starColor,clamp(starGain*profile,0.,.94));
        #include <colorspace_fragment>
      }`});
  const o=new T.Points(geom,mat);o.name='极光夜 · 星空';o.frustumCulled=false;o.renderOrder=-18800;return o;
}

function rayTexture(){
  // The long, unevenly spaced magnetic rays remain coherent along a whole
  // curtain, unlike two-dimensional clouds with independently shimmering pixels.
  const n=2048,r=random(354839),data=new Uint8Array(n*4);
  const amplitudes=[.32,.21,.17,.13,.10,.07];
  const banks=amplitudes.map((_,k)=>Float32Array.from({length:[9,23,51,113,227,479][k]},r));
  for(let i=0;i<n;i++){
    let sum=0;
    for(let k=0;k<banks.length;k++){
      const bank=banks[k],v=i/n*bank.length,j=Math.floor(v),f=v-j,w=f*f*(3-2*f);
      sum+=amplitudes[k]*(bank[j]*(1-w)+bank[(j+1)%bank.length]*w);
    }
    const thin=.5+.5*Math.sin(i/n*1905+sum*19);
    data.set([Math.round(255*sum),Math.round(255*thin),Math.round(255*(.5+.5*Math.cos(i/n*122+sum*8))),255],i*4);
  }
  const tex=new T.DataTexture(data,n,1,T.RGBAFormat);
  tex.wrapS=T.RepeatWrapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;return tex;
}

function aurora(low,texture){
  const group=new T.Group();group.name='极光夜 · 高空磁场光帘';
  const ridges=[
    // azimuth, span, floor elevation, vertical spread, bends, longitudinal offset
    [-.31,2.73,.252,.30,19.1,.04],[.55,2.03,.36,.26,34.4,.41],
    [-1.61,1.54,.32,.18,55.3,.77],[2.34,2.35,.16,.18,86.2,.18],
  ];
  for(const [i,[center,span,floor,height,seed,texOffset]] of ridges.entries()){
    const g=new T.PlaneGeometry(1,1,low?160:290,low?9:14);
    const mat=new T.ShaderMaterial({side:T.DoubleSide,transparent:false,depthTest:false,depthWrite:false,blending:T.AdditiveBlending,
      uniforms:{curtain:{value:texture},skyClock:{value:0},arc:{value:new T.Vector4(center,span,floor,height)},seed:{value:seed},offset:{value:texOffset},intensity:{value:[.64,.53,.36,.17][i]}},
      vertexShader:`
        varying vec2 vArc;varying float fold,horizonFade;
        uniform vec4 arc;uniform float seed,skyClock;
        void main(){
          float u=uv.x,v=uv.y,t=skyClock*.028;
          float knot=sin(u*9.7+seed+.23*t+sin(u*7.+seed*.8)*.94);
          float bend=sin(u*16.2+seed+sin(u*6.3+t*.41)*1.36);
          float az=arc.x+(u-.5)*arc.y+.145*knot+.025*bend;
          float base=arc.z+.104*knot+.052*bend+.019*sin(u*39.+seed+t*.41)+.009*sin(u*79.+seed+1.3*knot);
          float elev=base+v*arc.w*(.81+.20*sin(u*12.+seed)+.09*bend);
          az+=v*(.045*sin(u*7.2+seed)+.023*bend)+v*v*.025;
          vec3 ray=vec3(sin(az)*cos(elev),sin(elev),-cos(az)*cos(elev));
          vArc=uv;fold=.65+.35*sin(u*21.8+seed+2.*knot);horizonFade=smoothstep(.03,.19,elev);
          gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*ray,1.);
          gl_Position.z=gl_Position.w*.999998;
        }`,fragmentShader:`
        varying vec2 vArc;varying float fold,horizonFade;
        uniform sampler2D curtain;uniform float skyClock,seed,offset,intensity;
        void main(){
          vec2 uv=vArc;float t=skyClock*.00154;
          vec3 ray=texture2D(curtain,vec2(uv.x*.82+offset+t+.004*sin(uv.y*3.+uv.x*14.+seed),.5)).rgb;
          float strand=mix(.09,1.09,smoothstep(.29,.70,ray.r))*(.77+.23*ray.g);
          float lo=.067+.046*ray.b;
          float base=smoothstep(.0,lo,uv.y)*exp(-max(0.,uv.y-lo)*(5.2+2.8*ray.b));
          float upper=smoothstep(.14,.30,uv.y)*(1.-smoothstep(.40,.95,uv.y));
          float taper=smoothstep(.0,.14,uv.x)*(1.-smoothstep(.82,1.,uv.x));
          vec3 green=mix(vec3(.08,1.,.31),vec3(.026,.85,.53),ray.r);
          vec3 color=green*base+vec3(.38,.09,.30)*upper*.23;
          float gain=taper*strand*(.40+.60*fold)*horizonFade*intensity
                    *(1.-smoothstep(.61,1.,uv.y))*smoothstep(.0,.055,uv.y);
          gl_FragColor=vec4(color,clamp(gain,0.,1.));
          #include <colorspace_fragment>
        }`});
    const mesh=new T.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=-18796+i;group.add(mesh);
  }
  return group;
}

export function weatherSky(scene,low){
  const root=new T.Group();root.name='季候天空';scene.add(root);
  const dome=skyDome(),star=stars(low),texture=rayTexture(),lights=aurora(low,texture);
  root.add(dome,star,lights);root.visible=false;
  return {
    set(weather,period,horizon){
      root.visible=weather!=='clear';star.visible=lights.visible=weather==='aurora';
      const u=dome.material.uniforms;u.skyMode.value=weather==='aurora'?3:weather==='snow'?2:1;
      u.periodNight.value=period==='dusk'?1:0;u.skyWarm.value=period==='sunset'?1:0;
      u.horizon.value.setHex(horizon??0x9ba9b0);
    },
    update(t,camera){
      if(!root.visible)return;
      dome.material.uniforms.skyClock.value=t;
      if(lights.visible){
        const u=star.material.uniforms;u.skyClock.value=t;u.skyScale.value=Math.max(.72,Math.min(1.65,67/(camera.fov||67)));
        lights.children.forEach(m=>m.material.uniforms.skyClock.value=t);
      }
    },
    dispose(){scene.remove(root);root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});texture.dispose();}
  };
}
