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
  const lid=document.createElement('canvas');lid.width=lid.height=256;
  const g=lid.getContext('2d');g.fillStyle='#676660';g.fillRect(0,0,256,256);
  for(const [r,w] of [[118,5],[108,3],[46,3]]){g.beginPath();g.arc(128,128,r,0,Math.PI*2);g.strokeStyle='#363b38';g.lineWidth=w;g.stroke();}
  for(let y=14;y<245;y+=14)for(let x=12;x<245;x+=15){
    const r=Math.hypot(x-128,y-128);if(r>105||r<49)continue;
    const slope=(Math.floor(y/14)%2?1:-1)*3;
    g.beginPath();g.moveTo(x-5,y+slope);g.lineTo(x+4,y-slope);g.lineWidth=3;g.strokeStyle='#999991';g.stroke();
  }
  g.fillStyle='#aaaaa1';g.font='bold 26px "Microsoft YaHei",sans-serif';g.textAlign='center';g.fillText('市政',128,138);
  for(const x of [42,203]){g.fillStyle='#232623';g.fillRect(x,125,12,5);}
  const tex=new T.CanvasTexture(lid);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const covers=new Instances(new T.CircleGeometry(1,40).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:tex,bumpMap:tex,bumpScale:.009,roughness:.69,metalness:.40}),'车道路面 · 铸铁检查井盖');
  const rim=new Instances(new T.CylinderGeometry(1,1,1,40),metal,'车道路面 · 井圈');
  for(const rd of roads){
    if(rd.layer||rd.tunnel||rd.bridge||rd.width<6||!['primary','secondary','tertiary','residential'].includes(rd.kind))continue;
    const frontage=rd.id===1436530936||rd.id===1190795443;
    along(rd.p,49,12+Math.abs(rd.id)%29,(x,z,dx,dz,s)=>{
      if(Math.hypot(x,z)>1100)return;
      const side=(Math.floor(s/49)%2?1:-1),yaw=Math.atan2(dx,dz),off=side*(rd.width*.5-1.56);
      const cx=x-dz*off,cz=z+dx*off;rim.at(cx,.285,cz,.39,.019,.39);covers.at(cx,.296,cz,.356,1,.356,yaw);
      if(frontage)return;
      const edge=side*(rd.width/2-.20),ex=x-dz*edge,ez=z+dx*edge;
      drain.at(ex,.298,ez,.30,.017,.64,yaw);
      for(let i=-5;i<=5;i++)bars.at(ex+dx*i*.052,.311,ez+dz*i*.052,.284,.017,.026,yaw);
    });
  }
  rim.flush(root,false,100);covers.flush(root,false,130);
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
  const smallInRoadReflection=/灌木|三角梅|绿篱|根际阴影|雨水|井盖|井圈|导向砖|盲道|垃圾桶|消防栓|石球|沿阶草|枯叶裙|卵石|接触阴影|环境阴影/;
  root.traverse(o=>{if(ignoreInGroundReflection.has(o.name)||o.isReflector)hidden.push(o);});
  function capture(renderer,scene,camera,seconds){
    if(scene.userData.perfTier>=2){active.value=0;return;}
    const distance=Math.hypot(camera.position.x-taxi.x,camera.position.z-taxi.y);
    if(distance>124||camera.position.y>26||camera.position.y<proxy.position.y){active.value=0;return;}
    const throttled=low||scene.userData.perfTier>=1;
    renderer.getDrawingBufferSize(size);
    const scale=Math.min(throttled?.30:.42,(throttled?480:840)/size.x);
    const w=Math.max(160,Math.round(size.x*scale)),h=Math.max(96,Math.round(size.y*scale)),resize=w!==rt.width||h!==rt.height;
    if(!resize && active.value && seconds-last<(throttled?.08:.035))return;
    if(!resize && active.value && seconds-last<(throttled?.18:.09)&&eye.distanceToSquared(camera.position)<.018&&quat.angleTo(camera.quaternion)<.005)return;
    if(resize)rt.setSize(w,h);
    active.value=0;sampler.value=null;scene.userData.reflectingRoad=true;
    const extra=[];
    const details=root.userData.localDetails;
    if(details){for(let i=0;i<details.length;i++){const it=details[i].item;if(it.visible&&smallInRoadReflection.test(it.name)){extra.push(it);it.visible=false;}}}
    const state=hidden.map(o=>o.visible);hidden.forEach(o=>o.visible=false);
    try{proxy.onBeforeRender(renderer,scene,camera);}
    finally{hidden.forEach((o,i)=>o.visible=state[i]);extra.forEach(o=>o.visible=true);scene.userData.reflectingRoad=false;}
    matrix.value.copy(proxy.material.uniforms.textureMatrix.value).multiply(inverse);
    sampler.value=rt.texture;active.value=1;last=seconds;eye.copy(camera.position);quat.copy(camera.quaternion);
  }
  function dispose(){proxy.geometry.dispose();proxy.dispose();for(const t of textures)t.dispose();}
  return {capture,invalidate(){active.value=0;last=-100;},dispose};
}
