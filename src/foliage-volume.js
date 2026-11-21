import * as T from 'three';

const url=name=>import.meta.env.BASE_URL+'foliage/'+name;
const closeRange=90, middleRange=260;
const closeLimit=38, middleLimit=132;

function unpack(buf){
  if(new TextDecoder().decode(new Uint8Array(buf,0,4))!=='BT01')throw Error('Invalid tree asset');
  const dv=new DataView(buf);let cursor=4;
  const vector=(size)=>{const a=new Float32Array(buf,cursor,size);cursor+=size*4;return a;};
  return Array.from({length:3},()=>{
    const vertices=dv.getUint32(cursor,true),indices=dv.getUint32(cursor+4,true);cursor+=8;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(vector(vertices*3),3));
    g.setAttribute('normal',new T.BufferAttribute(vector(vertices*3),3));
    g.setAttribute('uv',new T.BufferAttribute(vector(vertices*2),2));
    g.setIndex(new T.BufferAttribute(new Uint32Array(buf,cursor,indices),1));cursor+=indices*4;
    g.computeBoundingSphere();return g;
  });
}

async function readModel(name){
  const loader=new T.TextureLoader();
  async function tex(key,color){
    const t=await loader.loadAsync(url(name+'-'+key+'.webp'));t.flipY=false;
    if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
  }
  const [geometry,base,norm,leaves]=await Promise.all([
    fetch(url(name+'.bin')).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(unpack),
    tex('bark',true),tex('normal',false),tex('canopy',true)
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
        float glow=pow(max(0.,dot(normalize(-vViewPosition),directionalLights[0].direction)),3.);
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*
          vec3(.75,.92,.42)*(throughLeaf+glow*.23);
      #endif
    `);
  };
  return {geometry,wood,leaf};
}

function batch(parent,model,far){
  const count=far?middleLimit:closeLimit;
  const branch=new T.InstancedMesh(model.geometry[far?2:0],model.wood,count);
  const leaves=new T.InstancedMesh(model.geometry[1],model.leaf,count);
  for(const mesh of [branch,leaves]){
    mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow=!far;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.name=mesh===branch?'真实树干与分叉':'三维树冠与叶簇';
    parent.add(mesh);
  }
  return {branch,leaves,used:0};
}

function togglePhoto(p,on){
  if(!p.mesh)return;
  const d=p.mesh.instanceMatrix.array,j=p.slot*16;
  d[j]=on?p.photoX:0;d[j+5]=on?p[2]:0;
  p.mesh.instanceMatrix.needsUpdate=true;
}

export function volumetricTrees(root,plants){
  const scene=root.parent;
  if(!scene||!plants.length)return;
  const promise=Promise.all(['island_tree_01','island_tree_02'].map(readModel)).then(models=>{
    if(!root.parent)return;
    const groups=models.map(m=>[batch(root,m,false),batch(root,m,true)]);
    const tiles=new Map(),tileSize=112,cell=(x,z)=>Math.floor(x/tileSize)+':'+Math.floor(z/tileSize);
    for(const p of plants){
      const key=cell(p[0],p[1]);let list=tiles.get(key);if(!list){list=[];tiles.set(key,list);}list.push(p);
    }
    const matrix=new T.Matrix4(),rot=new T.Quaternion(),pos=new T.Vector3(),scale=new T.Vector3(),up=new T.Vector3(0,1,0),tint=new T.Color();
    let active=new Set(),last=new T.Vector3(Infinity,0,0);
    root.userData.updateTrees=function(position){
      if(!root.parent||last.distanceToSquared(position)<24)return;
      last.copy(position);
      const candidates=[],cx=Math.floor(last.x/tileSize),cz=Math.floor(last.z/tileSize);
      if(last.y<middleRange)for(let x=cx-3;x<=cx+3;x++)for(let z=cz-3;z<=cz+3;z++){
        for(const p of tiles.get(x+':'+z)||[]){
          const dx=p[0]-last.x,dz=p[1]-last.z,dy=last.y-p[2]*.45;
          const d=dx*dx+dz*dz+dy*dy;if(d<middleRange*middleRange)candidates.push([d,p]);
        }
      }
      candidates.sort((a,b)=>a[0]-b[0]);
      for(const list of groups)for(const group of list)group.used=0;
      let first=0,middle=0;const shown=new Set();
      for(const [dist,p] of candidates){
        const near=dist<closeRange*closeRange&&first<closeLimit;
        if(!near&&middle>=middleLimit)break;
        if(near)first++;else middle++;
        const r=p[3],type=p.species??(r>.58?1:0),group=groups[type][near?0:1],i=group.used++,h=p[2];
        const girth=(.77+.18*r)*(p.street?.81:1);
        pos.set(p[0],p.street?.29:.13,p[1]);rot.setFromAxisAngle(up,6.2831853*r);
        scale.set(h*girth,h,h*girth*(.87+.19*r));matrix.compose(pos,rot,scale);
        group.branch.setMatrixAt(i,matrix);group.leaves.setMatrixAt(i,matrix);
        tint.setRGB(.54+r*.16,.97+r*.18,.74+r*.27);group.leaves.setColorAt(i,tint);
        shown.add(p);if(!active.has(p))togglePhoto(p,false);
      }
      for(const p of active)if(!shown.has(p))togglePhoto(p,true);
      for(const list of groups)for(const group of list)for(const mesh of [group.branch,group.leaves]){
        mesh.count=group.used;mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      }
      root.userData.activeCrownCount=shown.size;active=shown;
    };
  }).catch(e=>{console.warn('Detailed tree asset unavailable',e);});
  return promise;
}
