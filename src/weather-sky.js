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
        if(skyMode>3.5){
          vec2 drift=vec2(skyClock*.0018,skyClock*.0009);
          float broad=cloud(plane*1.06+drift),edge=cloud(plane*3.85-drift+broad*1.6);
          float cover=smoothstep(.32,.68,.74*broad+.26*edge);
          float cityLight=.42+.58*pow(max(0.,dot(normalize(vec2(-1.,-.45)),normalize(d.xz+.00001))),2.);
          vec3 clear=mix(vec3(.025,.029,.034),vec3(.006,.009,.015),smoothstep(0.,.68,h));
          vec3 cloudLight=vec3(.065,.061,.053)*(.65+.48*cityLight)*(1.-.40*h);
          result=mix(clear,cloudLight,cover)+.52*horizon*exp(-h*11.);
        }else if(skyMode>2.5){
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
          zenith*=mix(1.,.068,periodNight);
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
    uniforms:{skyClock:{value:0},skyScale:{value:1},urban:{value:0}},vertexShader:`
      attribute float gain,diameter;attribute vec3 temperature;uniform float skyClock,skyScale,urban;
      varying vec3 starColor;varying float starGain;
      void main(){
        gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position.z=gl_Position.w*.999999;
        gl_PointSize=clamp(diameter*skyScale,1.,5.);
        starColor=temperature;starGain=gain*(.95+.05*sin(skyClock*1.1+position.x*132.));
        starGain*=mix(1.,smoothstep(.42,.84,position.y)*smoothstep(1.1,1.6,gain)*.19,urban);
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

function moon(){
  // Realistic warm-golden Moon with near-side maria, multi-scale 3D-shaded impact craters,
  // realistic photographic scale, and subtle atmospheric halo.
  const moonDir=new T.Vector3(-.24,.36,-.90).normalize();
  const up=new T.Vector3(0,1,0);
  const right=new T.Vector3().crossVectors(up,moonDir).normalize();
  const trueUp=new T.Vector3().crossVectors(moonDir,right).normalize();
  const mat=new T.ShaderMaterial({
    transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{
      moonDir:{value:moonDir},moonRight:{value:right},moonUp:{value:trueUp},
      moonStrength:{value:1},moonCloud:{value:0},skyClock:{value:0}
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vMoon;
      varying vec3 vRay;
      uniform vec3 moonDir,moonRight,moonUp;
      void main(){
        vMoon=position.xy;
        // Tighter angular span (~11 deg total quad; disc itself ~1.6 deg) for realistic scale.
        vec3 ray=normalize(moonDir+moonRight*(position.x*.105)+moonUp*(position.y*.105));
        vRay=ray;
        // Place moon at 28km sky distance with log-depth so skyscrapers occlude it properly.
        gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*(ray*28000.),1.);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec2 vMoon;
      varying vec3 vRay;
      uniform float moonStrength,moonCloud,skyClock;
      ${noise}
      vec2 moonHash2(vec2 p){
        vec3 a=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
        a+=dot(a,a.yzx+33.33);
        return fract((a.xx+a.yz)*a.zy);
      }
      // Single-scale procedural impact craters returning vec3(height, gradX, gradY).
      vec3 craterField(vec2 uv,float scale,float maxR){
        vec2 g=uv*scale,id=floor(g),f=fract(g);
        float h=0.;vec2 grad=vec2(0.);
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 cell=id+vec2(float(x),float(y));
          vec2 rnd=moonHash2(cell);
          float spawn=skyHash(cell+19.3);
          if(spawn<.38)continue;
          vec2 center=vec2(float(x),float(y))+.18+.64*rnd;
          vec2 diff=f-center;
          float r=(.18+.30*skyHash(cell+71.7))*maxR;
          float d=length(diff);
          if(d>r*1.55)continue;
          float u=d/max(r,.0001);
          // Concave bowl inside u<1, raised annular rim around u=1, gentle outer ejecta skirt.
          float bowl=-.55*(1.-u*u)*smoothstep(1.05,.62,u);
          float rim=.32*exp(-16.*(u-1.)*(u-1.));
          float ch=bowl+rim;
          // Radial derivative for crisp 3D crater wall lighting & shadow.
          float dhdu=(1.10*u*smoothstep(1.05,.62,u)) - (32.*(u-1.)*rim);
          vec2 dir=diff/max(d,.0005);
          h+=ch;
          grad+=dir*(dhdu/max(r,.0001));
        }
        return vec3(h,grad);
      }
      float mareBlob(vec2 p,vec2 c,vec2 r,float rot){
        float s=sin(rot),co=cos(rot);
        vec2 q=mat2(co,-s,s,co)*(p-c)/r;
        return exp(-dot(q,q)*1.85);
      }
      void main(){
        if(moonStrength<=.001)discard;
        float r=length(vMoon);
        if(r>1.)discard;
        #include <logdepthbuf_fragment>
        // Photographic lunar disc occupies ~14.5% of quad radius.
        float discR=.145;
        vec2 p=vMoon/discR;
        float d=length(p);
        vec3 result=vec3(0.);
        float alpha=0.;
        // Subtle drifting night cloud veil matching the sky dome.
        vec3 dir=normalize(vRay);
        vec2 plane=dir.xz/(.16+max(dir.y,0.)*.84);
        vec2 drift=vec2(skyClock*.0018,skyClock*.0009);
        float cBroad=cloud(plane*1.06+drift);
        float cEdge=cloud(plane*3.85-drift+cBroad*1.6);
        float cloudCover=smoothstep(.34,.72,.74*cBroad+.26*cEdge);
        float veil=mix(1.-cloudCover*.26,1.-cloudCover*.68,moonCloud);
        if(d<1.04){
          float z=sqrt(max(0.,1.-min(d*d,1.)));
          vec3 sphereN=normalize(vec3(p.x,p.y,z));
          // Spherical map coordinates so craters & maria curve naturally around the lunar limb.
          vec2 sp=vec2(atan(sphereN.x,sphereN.z),asin(clamp(sphereN.y,-1.,1.)))*.85;
          // Near-side inspired lunar maria basins + organic basalt edge breakup.
          float breakup=(cloud(sp*4.8+1.3)-.5)*.45+(cloud(sp*11.2-2.7)-.5)*.22;
          float m=0.;
          m=max(m,mareBlob(p,vec2(-.28,.22),vec2(.36,.32),.2));   // Mare Imbrium
          m=max(m,mareBlob(p,vec2(-.48,-.12),vec2(.30,.44),-.15));// Oceanus Procellarum
          m=max(m,mareBlob(p,vec2(.14,.28),vec2(.22,.20),-.1));   // Mare Serenitatis
          m=max(m,mareBlob(p,vec2(.34,.04),vec2(.26,.22),.3));    // Mare Tranquillitatis
          m=max(m,mareBlob(p,vec2(.44,-.24),vec2(.22,.16),-.2));  // Mare Fecunditatis
          m=max(m,mareBlob(p,vec2(.64,.16),vec2(.11,.13),.1));    // Mare Crisium
          m=max(m,mareBlob(p,vec2(-.12,-.28),vec2(.26,.18),.1));  // Mare Nubium
          float maria=smoothstep(.26,.72,m+breakup);
          // Multi-scale impact craters (large basins, medium craters, fine pitting).
          vec3 cLarge=craterField(sp+vec2(.4,-.2),3.4,1.05);
          vec3 cMed=craterField(sp+vec2(-1.7,.9),8.2,.95);
          vec3 cFine=craterField(sp+vec2(3.1,-2.4),18.5,.85);
          // Highlands have denser cratering than smooth basaltic maria.
          float rugged=mix(1.0,.42,maria);
          float craterH=(cLarge.x*.52+cMed.x*.34+cFine.x*.18)*rugged;
          vec2 craterGrad=(cLarge.yz*.26+cMed.yz*.17+cFine.yz*.09)*rugged;
          // Bright Tycho-like southern crater + faint radial ejecta rays.
          vec2 tycho=p-vec2(-.10,-.58);
          float td=length(tycho);
          float tAngle=atan(tycho.y,tycho.x);
          float rays=pow(max(0.,sin(tAngle*7.+.4)*sin(tAngle*11.-.9)),2.)*exp(-td*3.4)*smoothstep(.04,.12,td);
          float tychoRim=.28*exp(-380.*(td-.065)*(td-.065))-.20*smoothstep(.075,.02,td);
          // Perturb lunar sphere normal with crater relief & micro regolith grain.
          vec3 n=normalize(sphereN+vec3(craterGrad.x*.34,craterGrad.y*.34,0.));
          // Warm golden-ivory highlands & muted brownish-grey basalt maria (coastal night warmth).
          float regolith=cloud(sp*22.+4.1);
          vec3 highland=vec3(.96,.83,.59)*(.90+.16*regolith);
          vec3 sea=vec3(.46,.40,.32)*(.86+.20*regolith);
          vec3 albedo=mix(highland,sea,maria*.76);
          albedo+=vec3(.16,.13,.08)*(max(craterH,0.)*.55+rays*.55+max(tychoRim,0.));
          albedo*=1.-clamp(-craterH*.26,0.,.28);
          // Slightly angled waxing-gibbous sunlight so crater rims & bowls have clear 3D relief.
          vec3 sunOnMoon=normalize(vec3(.42,.18,.89));
          float ndl=dot(n,sunOnMoon);
          float macroPhase=smoothstep(-.10,.24,dot(sphereN,sunOnMoon));
          float reliefLight=smoothstep(-.18,.88,ndl);
          // Soft Lommel-Seeliger-like lunar limb response (less harsh than Lambertian).
          float limb=pow(max(z,.001),.22);
          float discEdge=1.-smoothstep(.94,1.01,d);
          // Non-clipping photographic brightness so maria & craters remain crisp, never pure white.
          vec3 lit=albedo*(.04+.96*macroPhase*(.42+.58*reliefLight))*(.76+.24*limb)*.92;
          result+=lit*discEdge*veil;
          alpha=max(alpha,discEdge*min(1.,moonStrength*1.05)*veil);
        }
        // Subtle, natural warm lunar glow & whisper-soft atmospheric corona (no overexposure).
        float innerGlow=exp(-7.5*max(0.,r-discR*.85))*.24;
        float outerHalo=exp(-3.2*r)*smoothstep(1.,.14,r)*.085;
        vec3 haloColor=vec3(.92,.78,.54);
        float haloGain=(innerGlow+outerHalo)*mix(1.,1.3,moonCloud)*veil*moonStrength;
        result+=haloColor*haloGain;
        alpha=clamp(max(alpha,haloGain*.75),0.,1.);
        gl_FragColor=vec4(result*moonStrength,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh=new T.Mesh(new T.PlaneGeometry(2,2),mat);
  mesh.name='夜空 · 明月';mesh.frustumCulled=false;mesh.renderOrder=-18750;
  return mesh;
}

export function weatherSky(scene,low){
  const root=new T.Group();root.name='季候天空';scene.add(root);
  const dome=skyDome(),star=stars(low),texture=rayTexture(),lights=aurora(low,texture),lunar=moon();
  root.add(dome,star,lights,lunar);root.visible=false;
  let moonEnabled=true,moonAllowed=false;
  function syncMoonVisibility(){
    lunar.visible=moonEnabled&&moonAllowed;
    root.visible=dome.visible||lunar.visible;
  }
  return {
    set(weather,period,horizon){
      const showDome=weather!=='clear'||period==='night';
      moonAllowed=period==='night'||weather==='aurora'||(period==='dusk'&&weather==='clear');
      dome.visible=showDome;
      lights.visible=weather==='aurora';
      star.visible=lights.visible||(period==='night'&&weather==='clear');
      syncMoonVisibility();
      const u=dome.material.uniforms;u.skyMode.value=lights.visible?3:star.visible?4:weather==='snow'?2:1;
      star.material.uniforms.urban.value=lights.visible?0:1;
      u.periodNight.value=period==='night'?1:period==='dusk'?.65:0;u.skyWarm.value=period==='sunset'?1:0;
      u.horizon.value.setHex(horizon??0x9ba9b0);
      const mu=lunar.material.uniforms;
      const overcast=weather==='rain'||weather==='snow';
      mu.moonStrength.value=period==='night'?(overcast?.34:1):weather==='aurora'?.85:period==='dusk'?.36:0;
      mu.moonCloud.value=overcast?1:0;
    },
    setMoonVisible(visible){
      moonEnabled=!!visible;
      syncMoonVisibility();
      return moonEnabled;
    },
    get moonVisible(){return moonEnabled;},
    update(t,camera){
      if(!root.visible)return;
      if(dome.visible)dome.material.uniforms.skyClock.value=t;
      if(lunar.visible)lunar.material.uniforms.skyClock.value=t;
      if(star.visible){
        const u=star.material.uniforms;u.skyClock.value=t;u.skyScale.value=Math.max(.72,Math.min(1.65,67/(camera.fov||67)));
      }
      if(lights.visible){
        lights.children.forEach(m=>m.material.uniforms.skyClock.value=t);
      }
    },
    dispose(){scene.remove(root);root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});texture.dispose();}
  };
}
