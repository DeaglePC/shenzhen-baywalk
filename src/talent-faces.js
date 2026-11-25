import * as T from 'three';
import {Instances,Surface} from './city-geometry.js';
import {sleeve} from './talent-bridge.js';
import layout from './talent-plate-layout.json' with {type:'json'};

const baseUrl='/talent/field/';
const split=sleeve.top-(sleeve.top-sleeve.bottom)*layout.upperFraction;
const upper=[split,sleeve.top],footer=[sleeve.bottom,split];
const pageSize=grid=>grid.columns*grid.rows;
const pageFor=(index,grid)=>Math.floor(index/pageSize(grid));

function cellRect(index,grid){
  const {columns,width,height,rows}=grid,gutter=layout.gutter;
  const pitchX=width+2*gutter,pitchY=height+2*gutter;
  const atlasW=columns*pitchX,atlasH=rows*pitchY;
  const cell=index%pageSize(grid);
  const x=cell%columns*pitchX+gutter,y=Math.floor(cell/columns)*pitchY+gutter;
  return [(x+.5)/atlasW,1-(y+height-.5)/atlasH,(width-1)/atlasW,1-(y+.5)/atlasH];
}

// Each half of the cylinder is a frontal projection. Both sides read left to right.
function doubleFace(surface,normals,col,rect,[bottom,top]){
  const {x,z,base,yaw}=col,r=sleeve.radius+.0009;
  const vertex=(a,h)=>[x+r*Math.sin(a),base+h,z+r*Math.cos(a)];
  for(const side of [0,Math.PI]){
    for(let j=0;j<32;j++){
      const a=(j/32-.5)*Math.PI,b=((j+1)/32-.5)*Math.PI;
      const u=angle=>rect[0]+rect[2]*(.5+.5*Math.sin(angle));
      const A=yaw+side+a,B=yaw+side+b;
      surface.quad(vertex(A,bottom),vertex(B,bottom),vertex(B,top),vertex(A,top),
        [[u(a),rect[1]],[u(b),rect[1]],[u(b),rect[3]],[u(a),rect[3]]]);
      for(const angle of [A,B,B,A])normals.push(Math.sin(angle),0,Math.cos(angle));
    }
  }
}

function geometry(surface,normals,[bottom,top]){
  const g=surface.geometry(),rows=new Float32Array(normals.length/3);
  const row=h=>(sleeve.top-h)/(sleeve.top-sleeve.bottom);
  for(let i=0;i<rows.length;i+=4){
    rows[i]=rows[i+1]=row(bottom);rows[i+2]=rows[i+3]=row(top);
  }
  g.setAttribute('plaqueRow',new T.BufferAttribute(rows,1));
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  // Brushing follows the circumference regardless of the atlas cell's aspect ratio.
  const tangents=new Float32Array(rows.length*4);
  for(let i=0;i<rows.length;i++){
    tangents[i*4]=normals[i*3+2];tangents[i*4+2]=-normals[i*3];tangents[i*4+3]=1;
  }
  g.setAttribute('tangent',new T.BufferAttribute(tangents,4));
  return g;
}

function finish(materials){
  const mat=new T.MeshPhysicalMaterial({metalness:.72,roughness:.245,anisotropy:.38,
    envMapIntensity:1.38,specularIntensity:.65,emissive:0xffe9ce});
  mat.userData.cityProbe='bridge';
  materials.parkLights.finish(mat,.065);
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float plaqueRow; varying float vPlaqueRow;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvPlaqueRow=plaqueRow;');
    // The neutral silver in the artwork is exposed steel. The darker stencil
    // and the coloured park seal scatter light like ink on that steel.
    shader.fragmentShader='varying float vPlaqueRow;\n'+shader.fragmentShader
      .replace('#include <map_fragment>',`#include <map_fragment>
      float plateValue=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
      float steel=smoothstep(.09,.40,plateValue);
      diffuseColor.rgb*=mix(vec3(.90),vec3(.89,.93,.95),steel);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float brush=clamp(plateValue-.474,-.035,.035);
      roughnessFactor=mix(.63,roughnessFactor+brush,steel);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor*=steel;`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float nameBand=smoothstep(.42,.47,vPlaqueRow)*(1.-smoothstep(.70,.73,vPlaqueRow));
      totalEmissiveRadiance *= (1.-steel)*nameBand;`)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      // The hemisphere fill also catches the brushed steel at grazing angles.
      float grazing=1.-saturate(dot(geometryNormal,geometryViewDir));
      reflectedLight.indirectSpecular+=steel*irradiance*RECIPROCAL_PI*(.07+.38*grazing*grazing);`);
  };
  return mat;
}
function configure(tex){
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}

export function engravedFaces(root,columns,materials){
  const loader=new T.TextureLoader(),jobs=[],maps=[];
  let disposed=false;
  const loadMap=(mat,path)=>jobs.push(loader.loadAsync(baseUrl+path).then(tex=>{
    if(disposed){tex.dispose();return;}
    maps.push(tex);mat.map=configure(tex);mat.needsUpdate=true;
  }));

  const overview=layout.overview,batchSize=pageSize(overview);
  for(let start=0;start<columns.length;start+=batchSize){
    const batch=columns.slice(start,start+batchSize),surface=new Surface(),normals=[];
    for(const col of batch)doubleFace(surface,normals,col,cellRect(col.record.field.index,overview),upper);
    const mat=finish(materials);
    loadMap(mat,'plates-'+pageFor(start,overview)+'.webp');
    const mesh=new T.Mesh(geometry(surface,normals,upper),mat);
    mesh.name='现场人物铭牌 · '+(start+1)+'–'+(start+batch.length);root.add(mesh);
  }

  const emblem=new Surface(),markNormals=[];
  doubleFace(emblem,markNormals,{x:0,z:0,base:0,yaw:0},[0,0,1,1],footer);
  const common=finish(materials);
  loadMap(common,'common-footer.webp');
  const footers=new Instances(geometry(emblem,markNormals,footer),common,'星光柱 · 统一园标与标语');
  for(const col of columns)footers.at(col.x,col.base,col.z,1,1,1,col.yaw);
  footers.flush(root).receiveShadow=false;

  const material=finish(materials);
  Object.assign(material,{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const detail=new T.Mesh(new T.BufferGeometry(),material);
  detail.visible=false;detail.name='现场铭文近读';detail.renderOrder=1;root.add(detail);
  const cache=new Map(),loading=new Set(),grid=layout.detail;
  let current=null;
  function showDetail(tex){
    const surface=new Surface(),normals=[];
    doubleFace(surface,normals,current,cellRect(current.record.field.index,grid),upper);
    detail.geometry.dispose();detail.geometry=geometry(surface,normals,upper);
    material.map=tex;material.needsUpdate=true;detail.visible=true;
  }
  root.userData.updateTalentPlate=eye=>{
    let closest=null,best=3.4**2;
    for(const col of columns){
      const dist=(eye.x-col.x)**2+(eye.z-col.z)**2+(eye.y-col.base-1.85)**2;
      if(dist<best){closest=col;best=dist;}
    }
    if(closest===current||disposed)return;
    current=closest;detail.visible=false;
    if(!current)return;
    const page=pageFor(current.record.field.index,grid);
    if(cache.has(page)){
      const tex=cache.get(page);cache.delete(page);cache.set(page,tex);showDetail(tex);return;
    }
    if(loading.has(page))return;
    loading.add(page);
    loader.loadAsync(baseUrl+'close/plates-'+page+'.webp').then(tex=>{
      if(disposed||!current||pageFor(current.record.field.index,grid)!==page){tex.dispose();return;}
      cache.set(page,configure(tex));showDetail(tex);
      if(cache.size>2){const oldest=cache.keys().next().value;cache.get(oldest).dispose();cache.delete(oldest);}
    }).catch(()=>{}).finally(()=>loading.delete(page)); // The overview remains readable on a load failure.
  };
  root.userData.disposeTalentPlates=()=>{
    disposed=true;current=null;
    for(const tex of [...maps,...cache.values()])tex.dispose();
    cache.clear();maps.length=0;
  };
  return Promise.all(jobs);
}
