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
  seafront: { tint:0x92afbe, panel:[1.50,4.82], metal:.44, rough:.16, slab:.08, room:.43 },
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
  mat.customProgramCacheKey=()=> 'office-glass-v4';
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
      vec3 rawPaneN=mat3(modelMatrix)*normal;
      vPaneNormal=dot(rawPaneN,rawPaneN)>1e-8?normalize(rawPaneN):vec3(0.,1.,0.);
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
      vec3 surfaceN=dot(vPaneNormal,vPaneNormal)>1e-8?normalize(vPaneNormal):vec3(0.,1.,0.);
      vec3 rawTan=vec3(surfaceN.z,0.,-surfaceN.x);
      vec3 tangent=dot(rawTan,rawTan)>1e-8?normalize(rawTan):vec3(1.,0.,0.);
      vec3 rawEye=vPanePosition-cameraPosition;
      vec3 eyeRay=dot(rawEye,rawEye)>1e-8?normalize(rawEye):vec3(0.,0.,-1.);
      float facing=max(.13,abs(dot(eyeRay,surfaceN)));
      float closeDetail=1.-smoothstep(.08,.65,max(aa.x,aa.y));
      float branch=officeHash(floor(vec2(vPanePosition.x*.003+vPanePosition.z*.004,1.)));
      float floorRnd=officeHash(vec2(paneId.y+branch*13.,2.));
      float bayRnd=officeHash(paneId+floor(vPanePosition.xz*.015));
      float roomGroup=officeHash(vec2(floor((paneId.x+floorRnd*3.)/4.),paneId.y)+branch*11.);
      float night=clamp(max(emissive.r,max(emissive.g,emissive.b)),0.,1.);
      float occupancy=smoothstep(.71-.055*night,.87-.055*night,roomGroup*.68+floorRnd*.32);
      float frameX=glazingBand(pane.x,.020,aa.x);
      float frameY=glazingBand(pane.y,.013,aa.y);
      float slab=glazingBand(pane.y,glassProfile.z*.5,aa.y);
      float glassArea=(1.-frameX)*(1.-frameY)*(1.-slab*.86);
      // Enhanced 3D Parallax Interior Mapping: intersect viewing ray with a recessed
      // office volume (depth=0.95) to reveal receding ceilings, light troffers, partitions & floor slabs.
      vec2 roomUV=vec2(fract((grid.x+floorRnd)/3.),pane.y);
      vec2 slope=vec2(dot(eyeRay,tangent),eyeRay.y)/facing*vec2(.92,1.08);
      vec2 edge=mix(vec2(0.),vec2(1.),step(vec2(0.),slope));
      vec2 safeSlope=vec2(abs(slope.x)<1e-4?(slope.x<0.?-1e-4:1e-4):slope.x,abs(slope.y)<1e-4?(slope.y<0.?-1e-4:1e-4):slope.y);
      vec2 exitT=(edge-roomUV)/safeSlope;
      float depth=clamp(min(min(exitT.x,exitT.y),.96),0.,1.);
      vec2 hit=clamp(roomUV+slope*depth,vec2(.001),vec2(.999));
      float top=step(.982,hit.y),floorHit=1.-step(.018,hit.y);
      float sideWallHit=step(.982,hit.x)+(1.-step(.018,hit.x));
      float backWall=step(.94,depth);
      float glazing=1.-max(top,floorHit);
      // Recessed ceiling troffer strips moving in true parallax depth
      float troffer=top*smoothstep(.15,.45,sin(hit.x*18.85+floorRnd*6.28))*smoothstep(.20,.65,sin(depth*12.56));
      float deskLine=(1.-smoothstep(.016,.052,abs(hit.y-.29)))*glazing*(.5+.5*backWall);
      float roomDiv=(1.-smoothstep(.006,.022,abs(fract(hit.x*2.+floorRnd)-.5)))*glazing;
      float depthAO=mix(.92,.36,depth);
      float interior=(.38+.54*depthAO)+top*.22-floorHit*.22-sideWallHit*.10+troffer*.26;
      interior-=.20*deskLine+.13*roomDiv;
      float shade=step(.82,bayRnd)*(1.-smoothstep(-.015,.02,pane.y-(.68+bayRnd*.18)));
      float closeRoom=mix(.60,clamp(interior,.16,1.15),closeDetail);
      float shadeLevel=mix(1.,.70,shade*closeDetail);
      vec3 roomTint=mix(vec3(.88,.93,.98),vec3(1.02,.95,.86),floorRnd);
      vec3 finish=glassTint*roomTint*(.42+.58*closeRoom+.08*bayRnd)*shadeLevel;
      finish=mix(finish,vec3(.24,.26,.26),shade*closeDetail*.46);
      float curtain=1.-smoothstep(.03,.12,abs(hit.x-.11)-(.025+.12*roomGroup));
      float pleat=.93+.07*cos(130.*hit.x);
      finish=mix(finish,vec3(.345,.326,.286)*pleat,residence*curtain*closeDetail*.64);
      vec3 satin=mix(vec3(.13,.17,.18),vec3(.41,.44,.44),frameX*.75+frameY*.2);
      diffuseColor.rgb=mix(satin,finish,glassArea)*diffuseColor.rgb;
      float lamella=glazingBand(fract(grid.y*1.0+.15),.012,aa.y);
      vec3 lampColor=mix(vec3(1.0,.64,.34),vec3(.78,.89,1.0),smoothstep(.62,1.05,roomGroup+floorRnd*.32));
      float luminance=occupancy*(.14+.56*night)*glassArea;
      float ceiling=(1.-smoothstep(.025+aa.y*.38,.14+aa.y*.65,abs(pane.y-.87)))+.85*troffer*closeDetail;
      float interiorLamp=roomStrength*(.20+.38*closeRoom+.88*ceiling+.45*lamella)*luminance*mix(1.,.52+.48*night,bayCladding);
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
        vec3 rawCorr=reflectedRay+offset/360.;
        vec3 corrected=dot(rawCorr,rawCorr)>1e-8?normalize(rawCorr):reflectedRay;
        vec3 rawLookup=mix(reflectedRay,corrected,localWeight);
        vec3 lookup=dot(rawLookup,rawLookup)>1e-8?normalize(rawLookup):reflectedRay;
        vec3 surroundings=textureCubeUV(envMap,envMapRotation*lookup,glassProfile.x*.78).rgb*envMapIntensity;
        float incidence=clamp(abs(dot(worldN,-eyeRay)),0.,1.);
        float grazing=pow(max(1.-incidence,1e-4),4.);
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

