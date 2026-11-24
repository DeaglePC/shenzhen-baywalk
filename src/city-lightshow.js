import * as T from 'three';
import {area,bounds,Surface} from './city-geometry.js';

// The reference waterfront elevations use these luminaire layouts. Other
// buildings also join the programme, at a scale set by their height and use.
const displays=new Map([
  [529272469,0],[782988197,0],[782988198,0],[529272471,1],
  [1190750263,2],[1190750264,1],[1190750265,0],[1190795454,1],
  [1190750257,1],[1190750258,1],[1190750259,2],[1190750260,1],
  [737426464,1],[737426466,0],[1190833384,0],[1190833407,1],
  [586621902,0],[586623959,1],[736645106,0],[700827684,1],
  [736645095,1],[1356839142,2],[737426475,1],[737426474,1]
]);

export function markBuildingFacade(s,f){
  const data=s.showProfile??=[],h=Math.max(2.4,f.h),known=displays.get(f.id);
  const style=known??(/house|apartments|residential|dorm/.test(f.kind)?2:Math.abs(f.id)%3);
  const gain=known!=null?1.8:.35+Math.min(1,h/185)*.86;
  // Packed in the same order as the batched wall vertices, including courtyards and setbacks.
  while(data.length<s.p.length)data.push(style,gain,h);
}

export function cityFacadeMesh(surface,root,mat,name){
  const mesh=surface.mesh(root,mat,name,true);
  if(mesh)mesh.geometry.setAttribute('showProfile',new T.Float32BufferAttribute(surface.showProfile,3));
}

function installShow(mat,clock,level,perBuilding,profile){
  const previous=mat.onBeforeCompile,key=mat.customProgramCacheKey();
  mat.customProgramCacheKey=()=>key+'|city-show-'+(perBuilding?'batched':'landmark');
  mat.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.showTime=clock;shader.uniforms.showLevel=level;
    if(!perBuilding)shader.uniforms.showProfile={value:new T.Vector3(...profile)};
    shader.vertexShader=(perBuilding?'attribute':'uniform')+` vec3 showProfile;
      varying vec3 showWorld,showLayout;varying float showU;
      `+shader.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        vec4 lampPos=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          lampPos=instanceMatrix*lampPos;
        #endif
        showWorld=(modelMatrix*lampPos).xyz;showLayout=showProfile;
        vec3 faceNormal=mat3(modelMatrix)*objectNormal;
        vec2 rawShowTan=vec2(faceNormal.z,-faceNormal.x);
        vec2 tangent=dot(rawShowTan,rawShowTan)>1e-8?normalize(rawShowTan):vec2(1.,0.);
        showU=dot(showWorld.xz,tangent);`);
    shader.fragmentShader=`uniform float showTime,showLevel;
      varying vec3 showWorld,showLayout;varying float showU;
      float ledStrip(float v,float duty){
        float w=max(fwidth(v),.0001),d=abs(fract(v+.5)-.5);
        return mix(clamp((.5*duty+.5*w-d)/w,0.,1.),duty,smoothstep(.38,1.,w));
      }
      vec3 cityProgramme(){
        float y=showWorld.y,phase=dot(showWorld.xz,vec2(.0024,.0035));
        float wave=.5+.5*sin(y*.047+phase*2.4-showTime*.83+1.2*sin(phase*1.7+showTime*.19));
        float crest=smoothstep(.52,.99,wave),cue=.5-.5*cos(showTime*.19);
        float pink=smoothstep(.18,.79,cue);
        vec3 blue=mix(vec3(.008,.047,.88),vec3(.008,.84,1.),crest);
        vec3 purple=mix(vec3(.18,.018,.82),vec3(.99,.016,.32),crest);
        vec3 ink=mix(blue,purple,pink);
        float ribbon=1.-smoothstep(.02,.20,abs(sin(phase+y*.033-showTime*.58)));
        ink=mix(ink,mix(vec3(.18,.78,1.),vec3(1.,.44,.78),pink),ribbon*.62);
        float floors=ledStrip(y/(showLayout.z<32.?3.15:4.25),.145);
        float vertical=ledStrip(showU/(showLayout.z<32.?2.8:2.10),.155);
        float groups=mix(.22,1.,smoothstep(.08,.22,fract(showU/11.1)));
        float lamp=showLayout.x<.5?vertical:showLayout.x<1.5?floors:floors*groups;
        float moving=smoothstep(.12,.89,wave);
        return ink*showLevel*showLayout.y*(.010+lamp*(.48+1.10*moving));
      }
      `+shader.fragmentShader.replace('#include <opaque_fragment>',`
        if(showLevel>.001)outgoingLight+=cityProgramme();
        #include <opaque_fragment>`);
  };
  mat.needsUpdate=true;
}

function lampMaterial(clock,level,body){
  return new T.ShaderMaterial({uniforms:{showTime:clock,level},transparent:true,blending:T.AdditiveBlending,
    side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    vertexShader:`varying vec2 metre;varying vec3 world;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){metre=uv;world=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`uniform float showTime,level;varying vec2 metre;varying vec3 world;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      float strip(float coord,float duty){
        float w=max(fwidth(coord),.0001),d=abs(fract(coord+.5)-.5);
        return mix(clamp((.5*duty+.5*w-d)/w,0.,1.),duty,smoothstep(.38,1.,w));
      }
      void main(){
        #include <logdepthbuf_fragment>
        ${body}
        gl_FragColor=vec4(radiance*level,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
}

export function waterfrontShow(root,map){
  const group=new T.Group();group.name='后海滨水夜景';group.visible=false;root.add(group);
  const clock={value:0},level={value:0},patched=new Set();
  root.traverse(mesh=>{
    if(!mesh.isMesh||patched.has(mesh.material))return;
    const profile=mesh.material.userData?.showFacade,perBuilding=!!mesh.geometry.getAttribute('showProfile');
    if(!profile&&!perBuilding)return;
    installShow(mesh.material,clock,level,perBuilding,profile);
    patched.add(mesh.material);
  });
  const hotel=map.buildings.find(f=>f.id===529272469);
  if(hotel){
    const ring=area(hotel.p)>0?hotel.p:hotel.p.slice().reverse(),box=bounds(ring);
    const inset=1-Math.min(.095,1.6/Math.max(8,Math.min(box[2]-box[0],box[3]-box[1])));
    for(let i=0;i<ring.length;i++){
      const [x,z]=ring[i],[bx,bz]=ring[(i+1)%ring.length],dx=bx-x,dz=bz-z,len=Math.hypot(dx,dz);
      if(dz/len<.88||len<20)continue;
      const c=document.createElement('canvas');c.width=512;c.height=96;
      const ctx=c.getContext('2d');ctx.font='600 72px Arial';ctx.textAlign='center';
      ctx.fillStyle='#fff3df';ctx.fillText('A N D A Z',256,75);
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
      const logo=new T.Mesh(new T.PlaneGeometry(18.2,3.42),new T.MeshBasicMaterial({map:tex,alphaTest:.42}));
      logo.name='安达仕 · 塔冠灯字';
      logo.position.set(((x+bx)*inset+(box[0]+box[2])*(1-inset))*.5+.25*dz/len,hotel.h-3.15,
        ((z+bz)*inset+(box[1]+box[3])*(1-inset))*.5-.25*dx/len);
      logo.rotation.y=Math.atan2(dz,-dx);group.add(logo);
    }
  }

  const girder=new Surface(),bridge=map.roads.find(r=>r.id===562534109);
  let distance=0;
  if(bridge)for(let i=1;i<bridge.p.length;i++){
    const [x,z]=bridge.p[i-1],[bx,bz]=bridge.p[i],dx=bx-x,dz=bz-z,len=Math.hypot(dx,dz);
    for(const side of [-1,1]){
      const offset=(bridge.width/2-.132)*side,ox=-dz/len*offset,oz=dx/len*offset;
      girder.quad([x+ox,1.56,z+oz],[x+ox,2.075,z+oz],[bx+ox,2.075,bz+oz],[bx+ox,1.56,bz+oz],
        [[distance,0],[distance,1],[distance+len,1],[distance+len,0]]);
    }
    distance+=len;
  }
  girder.mesh(group,lampMaterial(clock,level,`
    float bay=fract(metre.x/2.82),v=metre.y,panel=.5+.5*sin(metre.x*.11+showTime*.16);
    float cone=exp(-3.6*abs(bay-.50)/(.19+.85*v))*(1.-.65*v);
    vec2 led=vec2((bay-.5)*2.82,(v-.16)*.52);
    vec3 radiance=mix(vec3(.007,.026,.76),vec3(.005,.27,.98),panel)*
      (.62+1.85*cone)+vec3(.32,.77,1.)*3.4*exp(-dot(led,led)/.009);`),'星光桥 · 蓝色桥侧洗墙灯');

  const bank=new Surface(),lake=map.water.find(w=>w.id===map.landmarks.lake.id);
  if(lake){
    let station=0;
    for(let k=0;k<lake.p.length;k++){
      const a=lake.p[k],b=lake.p[(k+1)%lake.p.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if((a[0]<-65||a[1]<-215)&&len>.05){
        const p=(q,y)=>[q[0],y,q[1]];
        bank.quad(p(a,.21),p(a,.49),p(b,.49),p(b,.21),[[station,0],[station,1],[station+len,1],[station+len,0]]);
      }
      station+=len;
    }
  }
  bank.mesh(group,lampMaterial(clock,level,`
    float dotLight=strip(metre.x/5.7,.08);
    vec3 radiance=vec3(1.,.49,.11)*(.60+2.8*dotLight);`),'人才湖 · 岸线暖光');
  return {update(time){clock.value=time;},setNight(night){level.value=T.MathUtils.smoothstep(night,.20,.96);group.visible=level.value>.001;}};
}
