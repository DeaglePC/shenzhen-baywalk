import * as T from 'three';

// UVs are converted to metres before cut lines, slab edges and office bays are
// evaluated. This keeps the curtain wall on a human rather than texture scale.
const styles={
  silver: { tint:0xa3bac3, panel:[1.62,3.95], metal:.53, rough:.17, slab:.095, room:.37 },
  blue:   { tint:0x719aaf, panel:[1.44,3.65], metal:.57, rough:.15, slab:.077, room:.36 },
  office: { tint:0xa4aaa8, panel:[1.68,3.8], metal:.41, rough:.20, slab:.18, room:.62 },
  fins:   { tint:0xb4bcb7, panel:[1.38,3.65], metal:.45, rough:.18, slab:.14, room:.52 },
  bamboo: { tint:0x9fb7c4, panel:[1.37,4.48], metal:.54, rough:.13, slab:.075, room:.32 },
  bayOffice: { tint:0xa8bac5, panel:[1.47,4.56], metal:.50, rough:.151, slab:.062, room:.39 },
  bayHome: { tint:0x98a7a6, panel:[1.72,4.15], metal:.32, rough:.163, slab:.056, room:.55 },
  atrium: { tint:0xa7c3c4, panel:[1.83,4.5], metal:.36, rough:.12, slab:.038, room:.68 }
};
export function curtainWall(style,uvScale=[1,1],probe='district'){
  const opt=styles[style];
  const mat=new T.MeshPhysicalMaterial({
    color:0xffffff,roughness:opt.rough,metalness:opt.metal,clearcoat:.82,clearcoatRoughness:.085,
    specularIntensity:.98,ior:1.49,envMapIntensity:1.18,emissive:0xffead7,emissiveIntensity:0,
    vertexColors:true,side:T.DoubleSide
  });
  mat.name='双层Low-E幕墙 · '+style;
  mat.userData.cityProbe=probe;
  const anchor={value:new T.Vector3()},local={value:0};
  mat.onBeforeRender=()=>{
    const at=mat.envMap?.userData.capturePosition;
    local.value=at?1:0;if(at)anchor.value.copy(at);
  };
  mat.customProgramCacheKey=()=> 'office-glass-v3';
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{
      glassUVScale:{value:new T.Vector2(...uvScale)},glassPane:{value:new T.Vector2(...opt.panel)},
      glassTint:{value:new T.Color(opt.tint)},glassProfile:{value:new T.Vector3(opt.rough,opt.metal,opt.slab)},
      roomStrength:{value:opt.room},glassCapture:anchor,hasGlassCapture:local,
      residence:{value:style==='bayHome'?1:0},bayCladding:{value:style.startsWith('bay')?1:0}
    });
    shader.vertexShader=`
      uniform vec2 glassUVScale;
      varying vec2 vFacadeMeters;
      varying vec3 vPanePosition;
      varying vec3 vPaneNormal;
    `+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vFacadeMeters=uv*glassUVScale;
      vPanePosition=(modelMatrix*vec4(position,1.)).xyz;
      vPaneNormal=normalize(mat3(modelMatrix)*normal);
    `);
    shader.fragmentShader=`
      uniform vec2 glassPane;
      uniform vec3 glassTint;
      uniform vec3 glassProfile;
      uniform float roomStrength,hasGlassCapture,residence,bayCladding;
      uniform vec3 glassCapture;
      varying vec2 vFacadeMeters;
      varying vec3 vPanePosition;
      varying vec3 vPaneNormal;
      float officeHash(vec2 a){
        vec3 p=fract(vec3(a.xyx)*vec3(.1031,.11369,.13787));
        p+=dot(p,p.yzx+19.19);
        return fract((p.x+p.y)*p.z);
      }
      // Analytic coverage gives a subpixel mullion the correct averaged value
      // when viewed across the lake, avoiding the shimmer of hard floor lines.
      float glazingBand(float f,float width,float pixel){
        float dist=min(f,1.-f);
        float value=clamp((width+.5*pixel-dist)/max(.0002,pixel),0.,1.);
        return mix(value,2.*width,smoothstep(.36,1.3,pixel));
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 grid=vFacadeMeters/glassPane;
      vec2 paneId=floor(grid),pane=fract(grid),aa=max(fwidth(grid),vec2(.0002));
      vec3 surfaceN=normalize(vPaneNormal);
      vec3 tangent=normalize(vec3(surfaceN.z,0.,-surfaceN.x)+vec3(.0001,0.,0.));
      vec3 eyeRay=normalize(vPanePosition-cameraPosition);
      float facing=max(.13,abs(dot(eyeRay,surfaceN)));
      float closeDetail=1.-smoothstep(.08,.65,max(aa.x,aa.y));
      float branch=officeHash(floor(vec2(vPanePosition.x*.003+vPanePosition.z*.004,1.)));
      float floorRnd=officeHash(vec2(paneId.y+branch*13.,2.));
      float bayRnd=officeHash(paneId+floor(vPanePosition.xz*.015));
      float roomGroup=officeHash(vec2(floor((paneId.x+floorRnd*3.)/4.),paneId.y)+branch*11.);
      float night=clamp(max(emissive.r,max(emissive.g,emissive.b)),0.,1.);
      float occupancy=smoothstep(.71-.19*night,.87-.19*night,roomGroup*.68+floorRnd*.32);
      float frameX=glazingBand(pane.x,.020,aa.x);
      float frameY=glazingBand(pane.y,.013,aa.y);
      float slab=glazingBand(pane.y,glassProfile.z*.5,aa.y);
      float glassArea=(1.-frameX)*(1.-frameY)*(1.-slab*.86);
      // A room is three bays wide and a floor high. Intersect the viewing ray
      // with its box to expose the ceiling/side walls as the observer moves.
      vec2 roomUV=vec2(fract((grid.x+floorRnd)/3.),pane.y);
      vec2 slope=vec2(dot(eyeRay,tangent),eyeRay.y)/facing*vec2(.72,.85);
      vec2 edge=mix(vec2(0.),vec2(1.),step(vec2(0.),slope));
      vec2 exitT=(edge-roomUV)/(slope+vec2(.00003));
      float depth=clamp(min(exitT.x,exitT.y),.0,1.);
      vec2 hit=clamp(roomUV+slope*depth,vec2(.001),vec2(.999));
      float top=step(.988,hit.y),floorHit=1.-step(.013,hit.y);
      float glazing=1.-max(top,floorHit);
      float interior=mix(.44,.75,depth)+top*.14-floorHit*.18;
      float shade=step(.84,bayRnd)*(1.-smoothstep(-.015,.02,pane.y-(.71+bayRnd*.15)));
      float furniture=(1.-smoothstep(.014,.045,abs(hit.y-.31)))*glazing;
      float wallReveal=(1.-smoothstep(.005,.017,abs(fract(hit.x*3.+floorRnd)-.48)))*glazing;
      interior-=.17*furniture+.1*wallReveal;
      float closeRoom=mix(.63,interior,closeDetail);
      float shadeLevel=mix(1.,.74,shade*closeDetail);
      vec3 finish=glassTint*(.48+.49*closeRoom+.08*bayRnd)*shadeLevel;
      finish=mix(finish,vec3(.25,.27,.265),shade*closeDetail*.43);
      float curtain=1.-smoothstep(.03,.12,abs(hit.x-.11)-(.025+.12*roomGroup));
      float pleat=.93+.07*cos(130.*hit.x);
      finish=mix(finish,vec3(.345,.326,.286)*pleat,residence*curtain*closeDetail*.64);
      vec3 satin=mix(vec3(.15,.19,.195),vec3(.39,.42,.42),frameX*.75+frameY*.2);
      diffuseColor.rgb=mix(satin,finish,glassArea)*diffuseColor.rgb;
      float lamella=glazingBand(fract(grid.y*1.0+.15),.012,aa.y);
      vec3 lampColor=mix(vec3(1.0,.52,.24),vec3(.80,.89,.97),smoothstep(.85,1.11,roomGroup+floorRnd*.24));
      float luminance=occupancy*(.12+.89*night)*glassArea;
      float ceiling=1.-smoothstep(.025+aa.y*.38,.13+aa.y*.65,abs(pane.y-.87));
      float interiorLamp=roomStrength*(.22+.34*closeRoom+.90*ceiling+.48*lamella)*luminance*mix(1.,.52+.48*night,bayCladding);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      roughnessFactor=mix(.36,glassProfile.x+(bayRnd-.5)*.04,glassArea);
    `).replace('#include <metalnessmap_fragment>',`
      #include <metalnessmap_fragment>
      metalnessFactor=mix(.69,glassProfile.y-.09*occupancy,glassArea);
    `).replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      // Tempered glazing bows by only a few millimetres: one skyline reflection
      // spans many adjacent panes, bending locally along gasketed boundaries.
      vec2 bend=(pane-.5)*.008+vec2(bayRnd-.5,floorRnd-.5)*.0035;
      vec3 wt=tangent*bend.x+vec3(0,1,0)*bend.y;
      normal=normalize(normal+mat3(viewMatrix)*wt*glassArea*mix(.2,1.,closeDetail));
    `).replace('#include <emissivemap_fragment>',`
      totalEmissiveRadiance=lampColor*interiorLamp;
    `).replace('#include <opaque_fragment>',`
      #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
        // An elevated city probe is local: across one tall elevation its
        // nearby skyline must move while distant clouds remain at infinity.
        vec3 worldN=inverseTransformDirection(normal,viewMatrix);
        vec3 reflectedRay=reflect(eyeRay,worldN);
        float localWeight=hasGlassCapture*(1.-smoothstep(220.,920.,distance(vPanePosition.xz,glassCapture.xz)));
        localWeight*=1.-smoothstep(.12,.65,reflectedRay.y);
        vec3 offset=vPanePosition-glassCapture;
        vec3 corrected=normalize(reflectedRay+offset/360.);
        vec3 lookup=normalize(mix(reflectedRay,corrected,localWeight));
        vec3 surroundings=textureCubeUV(envMap,envMapRotation*lookup,glassProfile.x*.78).rgb*envMapIntensity;
        float incidence=clamp(abs(dot(worldN,-eyeRay)),0.,1.);
        float grazing=pow(1.-incidence,4.);
        float coating=(.26+.47*grazing)*glassArea;
        vec3 laminated=surroundings*mix(vec3(.88,.96,1.),vec3(1.),grazing)+totalEmissiveRadiance;
        outgoingLight=mix(outgoingLight,laminated,coating);
      #endif
      #include <opaque_fragment>
    `);
  };
  return mat;
}

export function architecturalMetal(color,roughness,probe='district'){
  const mat=new T.MeshPhysicalMaterial({color,metalness:.88,roughness,clearcoat:.24,clearcoatRoughness:.18,envMapIntensity:1.14,side:T.DoubleSide});
  mat.userData.cityProbe=probe;
  return mat;
}

// The pale cladding has honed faces and narrow panel joints that are visible
// from the promenade. All coordinates are in metres, including sloping bands.
export function bayStone() {
  const mat=new T.MeshStandardMaterial({color:0xc9c7bb,roughness:.61,metalness:.08,side:T.DoubleSide});
  mat.name='深圳湾一号 · 分缝浅色石材';
  mat.customProgramCacheKey=()=> 'one-bay-honed-stone';
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vStoneM;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vStoneM=uv;');
    shader.fragmentShader='varying vec2 vStoneM;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 cell=vStoneM/vec2(1.62,.83);
      vec2 aa=max(fwidth(cell),vec2(.0001)),d=abs(fract(cell+.5)-.5);
      vec2 joint=(1.-smoothstep(vec2(.002),.004+aa*.68,d))*(1.-smoothstep(.07,.49,aa));
      vec2 id=floor(cell);
      float slab=fract(sin(dot(mod(id,149.),vec2(52.7,17.1)))*4376.9);
      float grain=sin(vStoneM.x*54.+sin(vStoneM.y*19.))*sin(vStoneM.y*78.);
      diffuseColor.rgb*= (.973+.044*slab-.28*max(joint.x,joint.y)+.014*grain*(1.-smoothstep(.008,.048,max(aa.x,aa.y))));
    `);
  };
  return mat;
}

