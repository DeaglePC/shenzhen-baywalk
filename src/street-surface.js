import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {along,Instances,Surface,ribbon} from './city-geometry.js';

const taxi=new T.Vector2(-126.8,-420.7);
const ignoreInGroundReflection=new Set(['后海 · Sentinel-2 真彩色地表','沥青车道','城市人行道','人行步道','红色骑行道','停车场','沿街橱窗前铺装','沥青排水沟边','硬质铺装广场']);

function frontageHardware(root,roads){
  const metal=new T.MeshStandardMaterial({color:0x52534b,metalness:.62,roughness:.59});
  const drain=new Instances(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x252621,roughness:.98}),'路缘雨水口');
  const bars=new Instances(new T.BoxGeometry(),metal,'雨水篦格栅');
  const strip=new Surface(),clay=new T.MeshStandardMaterial({color:0xbba16c,roughness:.89});
  const ridges=new Instances(new T.BoxGeometry(),clay,'脚下导向砖凸纹');
  const nearby=(x,z)=>Math.hypot(x-taxi.x,z-taxi.y)<166;
  for(const rd of roads.filter(r=>r.id===1436530936||r.id===1190795443)){
    const clearance=rd.width*.5,offset=clearance+2.58;
    for(let i=1;i<rd.p.length;i++){
      const a=rd.p[i-1],b=rd.p[i];if(!nearby(...a)&&!nearby(...b))continue;
      ribbon(strip,[a,b],.295,.203,1,offset);
    }
    along(rd.p,.304,.17,(x,z,dx,dz)=>{
      if(!nearby(x,z))return;const yaw=Math.atan2(dx,dz);
      for(let i=-1;i<=1;i++){
        const side=offset+i*.075;ridges.at(x-dz*side,.207,z+dx*side,.026,.009,.237,yaw);
      }
    });
    along(rd.p,18.5,8.5,(x,z,dx,dz)=>{
      if(!nearby(x,z))return;
      const side=clearance-.235,cx=x-dz*side,cz=z+dx*side,yaw=Math.atan2(dx,dz);
      drain.at(cx,.298,cz,.318,.014,.74,yaw);
      for(let i=-6;i<=6;i++)bars.at(cx+dx*i*.052,.31,cz+dz*i*.052,.29,.012,.024,yaw);
      for(const sign of [-1,1])bars.at(cx-dz*.15*sign,.308,cz+dx*.15*sign,.023,.014,.714,yaw);
    });
  }
  strip.mesh(root,clay,'登良路旁导向砖');drain.flush(root);bars.flush(root,false,90);ridges.flush(root,false,75);
}

export function streetSurface(root,materials,options,roads){
  frontageHardware(root,roads);
  const loader=new T.TextureLoader(),textures=[];
  const load=(url,color)=>{const t=loader.load('/city/'+url+'.webp');t.wrapS=t.wrapT=T.RepeatWrapping;
    t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=8;textures.push(t);return t;};
  const scans={};
  for(const key of ['street','stone'])scans[key]={map:load(key+'-color',true),normalMap:load(key+'-normal',false),arm:load(key+'-arm',false)};
  const matrix={value:new T.Matrix4()},sampler={value:null},active={value:0};
  for(const [name,key] of [['asphalt','street'],['gutter','street'],['paving','stone'],['path','stone']]){
    const mat=materials[name],scan=scans[key];
    mat.map=scan.map;mat.normalMap=scan.normalMap;mat.roughnessMap=mat.aoMap=scan.arm;mat.aoMapIntensity=.9;
    mat.normalScale.setScalar(key==='street'?.65:.67);
    mat.roughness=key==='street'?.97:.87;mat.envMapIntensity=.87;
    if(name==='asphalt')mat.color.setHex(0x9b9b9b);
    if(name==='path')mat.userData.cityProbe='district';
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{streetMirror:sampler,mirrorTransform:matrix,mirrorReady:active});
      shader.vertexShader='varying vec3 surfaceWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nsurfaceWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=`
        varying vec3 surfaceWorld;
        uniform sampler2D streetMirror;uniform mat4 mirrorTransform;uniform float mirrorReady;
        float groundHash(vec2 p){vec3 h=fract(vec3(p.xyx)*.1031);h+=dot(h,h.yzx+33.33);return fract((h.x+h.y)*h.z);}
        float groundNoise(vec2 p){vec2 g=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(groundHash(g),groundHash(g+vec2(1,0)),f.x),mix(groundHash(g+vec2(0,1)),groundHash(g+1.),f.x),f.y);}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        vec2 wp=surfaceWorld.xz;
        float grain=texture2D(roughnessMap,vRoughnessMapUv).g;
        float basin=.55*groundNoise(wp*vec2(.41,.31))+.28*groundNoise(wp*1.16)+.17*groundNoise(wp*3.11);
        float waterFilm=smoothstep(.49,.72,basin+(grain-.55)*.16);
        float localStreet=1.-smoothstep(55.,135.,length(wp-vec2(-126.8,-420.7)));
        float localBridge=1.-smoothstep(145.,205.,length(wp-vec2(233.9,41.9)));
        waterFilm*=max(localStreet,localBridge*.56);
        roughnessFactor=mix(clamp(roughnessFactor,.52,.97),.19+.18*grain,waterFilm);
        diffuseColor.rgb*=mix(1.,.61,waterFilm);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        if(mirrorReady>.5 && localStreet>.001 && waterFilm>.005){
          vec4 projected=mirrorTransform*vec4(surfaceWorld,1.);
          vec2 base=projected.xy/max(.001,projected.w);
          vec2 micro=texture2D(normalMap,vNormalMapUv).rg-.5;
          vec2 uv=clamp(base+micro*(.0035-.002*waterFilm),.002,.998);
          vec3 reflection=texture2DLodEXT(streetMirror,uv,1.5+3.9*(1.-waterFilm)).rgb;
          float nv=clamp(normalize(cameraPosition-surfaceWorld).y,0.,1.);
          float fresnel=.035+.965*pow(1.-nv,4.);
          float edge=step(0.,min(min(base.x,base.y),min(1.-base.x,1.-base.y)));
          outgoingLight=mix(outgoingLight,reflection,min(.63,fresnel)*waterFilm*localStreet*edge);
        }
        #include <opaque_fragment>
      `);
    };
    mat.needsUpdate=true;
  }
  const low=options.quality==='low',proxy=new Reflector(new T.PlaneGeometry(1,1),{textureWidth:256,textureHeight:144,multisample:0,clipBias:.0001});
  proxy.rotation.x=-Math.PI/2;proxy.position.y=.287;proxy.updateMatrixWorld();
  const inverse=proxy.matrixWorld.clone().invert(),rt=proxy.getRenderTarget(),size=new T.Vector2(),eye=new T.Vector3(1e7,0,0),quat=new T.Quaternion();
  rt.texture.minFilter=T.LinearMipmapLinearFilter;rt.texture.generateMipmaps=true;
  let last=-100;
  const hidden=[];
  root.traverse(o=>{if(ignoreInGroundReflection.has(o.name)||o.isReflector)hidden.push(o);});
  function capture(renderer,scene,camera,seconds){
    const distance=Math.hypot(camera.position.x-taxi.x,camera.position.z-taxi.y);
    if(distance>124||camera.position.y>26||camera.position.y<proxy.position.y){active.value=0;return;}
    renderer.getDrawingBufferSize(size);
    const scale=Math.min(low?.33:.56,(low?512:1280)/size.x);
    const w=Math.max(160,Math.round(size.x*scale)),h=Math.max(96,Math.round(size.y*scale)),resize=w!==rt.width||h!==rt.height;
    if(!resize && active.value && seconds-last<(low?.15:.065)&&eye.distanceToSquared(camera.position)<.018&&quat.angleTo(camera.quaternion)<.005)return;
    if(resize)rt.setSize(w,h);
    active.value=0;sampler.value=null;scene.userData.reflectingRoad=true;
    const state=hidden.map(o=>o.visible);hidden.forEach(o=>o.visible=false);
    try{proxy.onBeforeRender(renderer,scene,camera);}
    finally{hidden.forEach((o,i)=>o.visible=state[i]);scene.userData.reflectingRoad=false;}
    matrix.value.copy(proxy.material.uniforms.textureMatrix.value).multiply(inverse);
    sampler.value=rt.texture;active.value=1;last=seconds;eye.copy(camera.position);quat.copy(camera.quaternion);
  }
  function dispose(){proxy.geometry.dispose();proxy.dispose();for(const t of textures)t.dispose();}
  return {capture,invalidate(){active.value=0;last=-100;},dispose};
}
