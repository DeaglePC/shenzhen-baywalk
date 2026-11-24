import * as T from 'three';
import {parkFloor} from './park-floor.js';
import {silkFlossGrove} from './silk-floss.js';

const url=name=>import.meta.env.BASE_URL+'foliage/'+name;
const closeRange=95, middleRange=265;
const closeLimit=48, middleLimit=164;

function unpack(buf,close=false){
  if(new TextDecoder().decode(new Uint8Array(buf,0,4))!==(close?'BC02':'BT01'))throw Error('Invalid tree asset');
  const dv=new DataView(buf);let cursor=4;
  const vector=(size)=>{const a=new Float32Array(buf,cursor,size);cursor+=size*4;return a;};
  if(!close)return Array.from({length:3},()=>{
    const vertices=dv.getUint32(cursor,true),indices=dv.getUint32(cursor+4,true);cursor+=8;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(vector(vertices*3),3));
    g.setAttribute('normal',new T.BufferAttribute(vector(vertices*3),3));
    g.setAttribute('uv',new T.BufferAttribute(vector(vertices*2),2));
    g.setIndex(new T.BufferAttribute(new Uint32Array(buf,cursor,indices),1));cursor+=indices*4;
    g.computeBoundingSphere();return g;
  });
  const twigVertices=dv.getUint32(4,true),twigCount=dv.getUint32(8,true),blades=dv.getUint32(12,true);
  cursor=16;
  function packed(vertices,padded){
    const g=new T.BufferGeometry();
    for(const [key,Type,size] of [['position',Int16Array,3],['normal',Int8Array,3],['uv',Uint16Array,2]]){
      const a=new Type(buf,cursor,vertices*size);cursor+=a.byteLength;
      g.setAttribute(key,new T.BufferAttribute(a,size,true));if(padded)cursor=Math.ceil(cursor/4)*4;
    }
    g.computeBoundingSphere();return g;
  }
  const twigs=packed(twigVertices,true);
  const segments=new Uint8Array(buf,cursor,twigCount*2);
  cursor=Math.ceil((cursor+segments.byteLength)/4)*4;
  let total=0;
  for(let n=0;n<segments.length;n+=2)total+=(segments[n]-1)*segments[n+1]*6;
  const twigFaces=twigVertices>65535?new Uint32Array(total):new Uint16Array(total);
  let next=0,base=0;
  for(let n=0;n<segments.length;n+=2){
    const rings=segments[n],sides=segments[n+1],row=sides+1;
    for(let r=1;r<rings;r++)for(let s=0;s<sides;s++){
      const i=base+(r-1)*row+s;
      twigFaces[next++]=i;twigFaces[next++]=i+1;twigFaces[next++]=i+row;
      twigFaces[next++]=i+row;twigFaces[next++]=i+1;twigFaces[next++]=i+row+1;
    }
    base+=rings*row;
  }
  twigs.setIndex(new T.BufferAttribute(twigFaces,1));
  const leaves=packed(blades*6,false);
  const Index=blades*6>65535?Uint32Array:Uint16Array,indices=new Index(blades*12);
  const strip=[0,2,1,1,2,3,2,4,3,3,4,5];
  for(let i=0;i<blades;i++)for(let j=0;j<12;j++)indices[i*12+j]=6*i+strip[j];
  leaves.setIndex(new T.BufferAttribute(indices,1));return [twigs,leaves];
}

const loader=new T.TextureLoader();
async function texture(name,color){
  const t=await loader.loadAsync(url(name+'.webp'));t.flipY=false;
  if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
async function geometryFile(name,close=false){
  const r=await fetch(url(name+'.bin'));if(!r.ok)throw Error(r.status);return unpack(await r.arrayBuffer(),close);
}

function windMaterial(mat,wind,flutter=false,part='broadleaf'){
  const single=part==='flower',tree=single?'modelMatrix':'instanceMatrix';
  const previous=mat.onBeforeCompile,key=mat.customProgramCacheKey();
  mat.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.parkWindTime=wind.time;shader.uniforms.parkWindStrength=wind.strength;
    shader.uniforms.parkWakePos=wind.wake;
    shader.vertexShader='uniform float parkWindTime,parkWindStrength;\nuniform vec3 parkWakePos;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec2 site=${tree}[3].xz;
      vec3 treePoint=${single?'(instanceMatrix*vec4(transformed,1.)).xyz':'transformed'};
      ${part==='broadleaf'?`float fork=fract(dot(site,vec2(.151,.237)))-.5;
      treePoint.y+=.57*fork*treePoint.y*(1.-treePoint.y);`:''}
      vec3 displacement=vec3(0.);
      float phase=dot(site,vec2(.085,.059))-.91*parkWindTime;
      float gust=sin(phase)*.63+sin(phase*.46+.34*parkWindTime+site.x*.021)*.37;
      vec2 windDir=vec2(.84,.54);
      vec2 ax0=${tree}[0].xz,ax2=${tree}[2].xz;
      vec2 u0=dot(ax0,ax0)>1e-8?normalize(ax0):vec2(1.,0.);
      vec2 u2=dot(ax2,ax2)>1e-8?normalize(ax2):vec2(0.,1.);
      vec2 bend=vec2(dot(u0,windDir),dot(u2,windDir));
      float tip=max(treePoint.y,0.);
      displacement.xz+=bend*(.010*gust*tip*tip)*parkWindStrength;
      // Subtle physical wake bend when walker/camera brushes close to foliage (inspired by Crimson Loong 66_wake.js)
      vec3 wakeWorld=(${tree}*vec4(treePoint+displacement,1.)).xyz;
      vec2 wakeDelta=wakeWorld.xz-parkWakePos.xz;
      float wakeDist=length(wakeDelta);
      if(wakeDist<4.8 && wakeDist>.02 && abs(wakeWorld.y-parkWakePos.y)<4.5){
        float push=(1.-smoothstep(.4,4.8,wakeDist))*.22*clamp(tip,0.,1.6);
        vec2 pushWorld=wakeDelta/wakeDist*push;
        displacement.xz+=vec2(dot(u0,pushWorld),dot(u2,pushWorld));
      }
      ${flutter?`float flicker=sin(phase*2.3+parkWindTime*3.6+dot(treePoint,vec3(44.,37.,28.)));
      displacement.y+=flicker*.0017*tip*parkWindStrength;`:''}
      ${single?'transformed+=transpose(mat3(instanceMatrix))*displacement/max(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),1.e-8);':'transformed=treePoint+displacement;'}
    `);
  };
  mat.customProgramCacheKey=()=>key+'|park-wind-'+part+Number(flutter);return mat;
}

async function readModel(name,wind){
  const [geometry,base,norm,leaves]=await Promise.all([
    geometryFile(name),texture(name+'-bark',true),texture(name+'-normal',false),texture(name+'-canopy',true)
  ]);
  const wood=new T.MeshStandardMaterial({map:base,normalMap:norm,normalScale:new T.Vector2(.7,.7),color:0xf6eee2,roughness:.9,side:T.DoubleSide});
  const leaf=new T.MeshStandardMaterial({map:leaves,roughness:.9,metalness:0,alphaTest:.23,side:T.DoubleSide});
  // Each cluster carries the crown's averaged outward normal. Both faces of
  // the thin leaf sheets share the sky illumination and transmit warm sun.
  leaf.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n normal *= gl_FrontFacing ? 1.0 : -1.0;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
      #include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float throughLeaf=.13+.21*max(0.,-dot(normal,directionalLights[0].direction));
        vec3 viewDir=dot(vViewPosition,vViewPosition)>1e-8?normalize(-vViewPosition):vec3(0.,0.,1.);
        float glow=pow(max(1e-4,dot(viewDir,directionalLights[0].direction)),3.);
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*
          vec3(.75,.92,.42)*(throughLeaf+glow*.23);
      #endif
    `);
  };
  windMaterial(wood,wind);windMaterial(leaf,wind);
  return {geometry,wood,leaf};
}

async function closeMaterials(wind){
  const [map,normalMap,bark]=await Promise.all([texture('leaf-blades',true),texture('leaf-veins',false),texture('twig-bark',true)]);
  bark.wrapS=bark.wrapT=T.RepeatWrapping;
  const leaf=new T.MeshStandardMaterial({map,normalMap,normalScale:new T.Vector2(.28,.28),roughness:.83,alphaTest:.38,side:T.DoubleSide});
  leaf.onBeforeCompile=shader=>{
    shader.vertexShader='varying float crownExposure;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      crownExposure=smoothstep(.12,.52,length((position-vec3(0.,.67,0.))*vec3(1.,1.28,1.)));
    `);
    shader.fragmentShader='varying float crownExposure;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb*=mix(vec3(.68,.72,.63),vec3(1.10,1.07,.95),crownExposure);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n normal *= gl_FrontFacing ? 1.0 : -1.0;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
      #include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float backlight=max(0.,-dot(normal,directionalLights[0].direction));
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*vec3(.77,.93,.46)*(.13+.24*backlight);
      #endif
    `);
  };
  return {leaf:windMaterial(leaf,wind,true),twig:windMaterial(new T.MeshStandardMaterial({map:bark,roughness:.96}),wind)};
}

function batch(parent,model,level,count,wind){
  const far=level==='far',close=level==='close';
  const branch=new T.InstancedMesh(model.geometry[far?2:0],model.wood,count);
  const leaves=new T.InstancedMesh(close?model.close.geometry[1]:model.geometry[1],close?model.close.leaf:model.leaf,count);
  const meshes=[branch,leaves];
  if(close)meshes.push(new T.InstancedMesh(model.close.geometry[0],model.close.twig,count));
  for(const mesh of meshes){
    mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow=!far&&(mesh===branch||mesh===leaves);mesh.receiveShadow=true;
    mesh.name=mesh===leaves?'三维树冠与叶簇':'真实树干与分叉';
    if(close)mesh.name+=' · 近景'+(mesh===branch?'主干':mesh===leaves?'单叶':'细枝');
    if(mesh.castShadow){
      const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:mesh===leaves?mesh.material.map:null,alphaTest:mesh.material.alphaTest,side:mesh.material.side});
      mesh.customDepthMaterial=windMaterial(depth,wind,close&&mesh===leaves);
    }
    parent.add(mesh);
  }
  return {meshes,leaves,used:0};
}

function togglePhoto(p,on){
  if(!p.mesh)return;
  const d=p.mesh.instanceMatrix.array,j=p.slot*16;
  d[j]=on?p.photoX:0;d[j+5]=on?p[2]:0;
  p.mesh.instanceMatrix.needsUpdate=true;
}

export function volumetricTrees(root,plants,lowQuality=false,blossomTrees=[]){
  const scene=root.parent;
  if(!scene||(!plants.length&&!blossomTrees.length))return;
  const names=['island_tree_01','island_tree_02'];
  const wind={time:{value:0},strength:{value:1},wake:{value:new T.Vector3(1e6,0,1e6)}};
  root.userData.setTreeWeather=weather=>{wind.strength.value=weather==='rain'?2.1:weather==='snow'?.65:1;};
  root.userData.setTreeWeather(root.userData.treeWeather);
  const grove=silkFlossGrove(root,blossomTrees,wind,windMaterial,lowQuality);
  const last=new T.Vector3(Infinity,0,0);
  let lastProbe=false,updateBroadleaves;
  root.userData.updateTrees=(position,time)=>{
    wind.time.value=time;
    const probe=!!scene.userData.capturingProbe;
    if(!probe)wind.wake.value.copy(position);
    if(!root.parent||(lastProbe===probe&&last.distanceToSquared(position)<4))return;
    lastProbe=probe;
    last.copy(position);
    grove?.update(position,probe);
    updateBroadleaves?.(probe);
  };
  if(grove){
    root.userData.disposeBlossoms=grove.dispose;
    root.dispatchEvent({type:'foliageadded'});
  }
  const promise=Promise.all(names.map(n=>readModel(n,wind))).then(models=>{
    if(!root.parent)return;
    const heroLimit=lowQuality?2:4;
    const updateFloor=parkFloor(root,lowQuality?9:20);
    const groups=models.map(m=>[batch(root,m,'near',closeLimit,wind),batch(root,m,'far',middleLimit,wind)]);
    const tiles=new Map(),tileSize=112,cell=(x,z)=>Math.floor(x/tileSize)+':'+Math.floor(z/tileSize);
    for(const p of plants){
      const key=cell(p[0],p[1]);let list=tiles.get(key);if(!list){list=[];tiles.set(key,list);}list.push(p);
    }
    const matrix=new T.Matrix4(),rot=new T.Quaternion(),pos=new T.Vector3(),scale=new T.Vector3(),up=new T.Vector3(0,1,0),tint=new T.Color();
    let active=new Set(),previousClose=new Set();
    let loadingClose=false,retryAfter=0;
    async function loadClose(){
      loadingClose=true;
      try{
        const [materials,...shapes]=await Promise.all([closeMaterials(wind),...names.map(n=>geometryFile(n+'-close',true))]);
        if(!root.parent)return;
        models.forEach((m,i)=>{
          m.close={...materials,geometry:shapes[i]};groups[i].push(batch(root,m,'close',heroLimit,wind));
        });
        root.dispatchEvent({type:'foliageadded'});
      }catch(e){retryAfter=performance.now()+30000;console.warn('Close tree asset unavailable',e);}
      finally{loadingClose=false;last.x=Infinity;}
    }
    last.x=Infinity;
    root.dispatchEvent({type:'foliageadded'});
    updateBroadleaves=function(probe){
      const candidates=[],cx=Math.floor(last.x/tileSize),cz=Math.floor(last.z/tileSize);
      if(last.y<middleRange)for(let x=cx-3;x<=cx+3;x++)for(let z=cz-3;z<=cz+3;z++){
        for(const p of tiles.get(x+':'+z)||[]){
          const dx=p[0]-last.x,dz=p[1]-last.z,dy=last.y-p[2]*.45;
          const d=dx*dx+dz*dz+dy*dy;if(d<middleRange*middleRange)candidates.push([d,p]);
        }
      }
      candidates.sort((a,b)=>a[0]-b[0]);
      const detail=!probe&&groups[0].length===3;
      if(!probe&&!detail&&!loadingClose&&performance.now()>=retryAfter&&candidates.length&&candidates[0][0]<55*55)loadClose();
      updateFloor(candidates);
      for(const list of groups)for(const group of list)group.used=0;
      // Keep the current closest trees through small changes in rank and range.
      const close=new Set(detail?candidates.filter(([d,p])=>d<(previousClose.has(p)?32:27)**2)
        .map(([d,p])=>[Math.sqrt(d)-(previousClose.has(p)?2:0),p])
        .sort((a,b)=>a[0]-b[0]).slice(0,heroLimit).map(([,p])=>p):[]);
      previousClose=close;
      let first=0,middle=0;const shown=new Set();
      for(const [dist,p] of candidates){
        const near=dist<closeRange*closeRange&&first<closeLimit;
        if(!near&&middle>=middleLimit)break;
        if(near)first++;else middle++;
        const r=p[3],type=p.species??(r>.58?1:0),group=groups[type][close.has(p)?2:near?0:1],i=group.used++,h=p[2];
        const girth=(.77+.18*r)*(p.street?.81:1);
        pos.set(p[0],p.street?.29-h*.022:(p.baseY??.055)-h*.043,p[1]);rot.setFromAxisAngle(up,6.2831853*r);
        scale.set(h*girth*(p.crownWidth??1),h,h*girth*(.87+.19*r)*(p.crownDepth??1));matrix.compose(pos,rot,scale);
        for(const mesh of group.meshes)mesh.setMatrixAt(i,matrix);
        tint.setRGB(.54+r*.16,.97+r*.18,.74+r*.27);group.leaves.setColorAt(i,tint);
        shown.add(p);if(!active.has(p))togglePhoto(p,false);
      }
      for(const p of active)if(!shown.has(p))togglePhoto(p,true);
      for(const list of groups)for(const group of list)for(const mesh of group.meshes){
        mesh.count=group.used;mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;
        if(mesh.visible){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.6;}
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      }
      root.userData.activeCrownCount=shown.size;active=shown;
    };
  }).catch(e=>{console.warn('Detailed tree asset unavailable',e);});
  return Promise.all([promise,grove?.ready]);
}
