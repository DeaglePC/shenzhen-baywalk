import * as T from 'three';
import {Surface} from './city-geometry.js';
import {sleeve} from './talent-bridge.js';

const pageSize=32,cellWidth=156,cellHeight=488,gutter=4;
const baseUrl='/talent/field/';

// The image is a frontal photographic projection of a cylinder. Sample with
// sin(theta) so the engraving retains its photographed proportions from the front.
function doubleFace(surface,normals,col,rect){
  const {x,z,base,yaw}=col;
  const {bottom,top,radius}=sleeve;
  const r=radius+.0009;
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

function finish(materials,high){
  const mat=new T.MeshStandardMaterial({color:0xffffff,metalness:.39,roughness:.48,
    emissive:0xffe3ac,emissiveIntensity:0,polygonOffset:high,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  mat.userData.cityProbe='bridge';
  materials.parkLights.finish(mat,.46);
  mat.customProgramCacheKey=()=>high?'talent-sleeve-engraving':'talent-sleeve-atlas';
  mat.onBeforeCompile=shader=>{
    if(high){
      // Estimate the recess from the photographed strokes against the local
      // brushed metal. Restrict the relief to the name and credentials band.
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float groove=0.;
        #ifdef USE_MAP
        const vec3 plateLuma=vec3(.2126,.7152,.0722);
        float surround=dot(textureLod(map,vMapUv,3.5).rgb,plateLuma);
        groove=smoothstep(.035,.27,(surround-dot(diffuseColor.rgb,plateLuma))/max(.07,surround));
        groove*=smoothstep(.43,.49,vPlaqueRow)*(1.-smoothstep(.70,.75,vPlaqueRow));
        diffuseColor.rgb*=1.-.66*groove;
        #endif`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.78,groove);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);
        vec3 sx=cross(py,normal),sy=cross(normal,px);
        float det=dot(px,sx);
        normal=normalize(max(abs(det),1e-10)*normal+
          sign(det)*.00065*(dFdx(groove)*sx+dFdy(groove)*sy));`);
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float lettering=1.0-smoothstep(.038,.25,dot(diffuseColor.rgb,vec3(.21,.72,.07)));
      totalEmissiveRadiance *= lettering * smoothstep(.42,.47,vPlaqueRow)*(1.-smoothstep(.66,.72,vPlaqueRow));`);
    shader.vertexShader='attribute float plaqueRow; varying float vPlaqueRow;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvPlaqueRow=plaqueRow;');
    shader.fragmentShader='varying float vPlaqueRow;\n'+shader.fragmentShader;
  };
  return mat;
}
function geometry(surface,normals){
  const g=surface.geometry(),rows=new Float32Array(normals.length/3);
  for(let i=0;i<rows.length;i+=4){rows[i]=1;rows[i+1]=1;}
  g.setAttribute('plaqueRow',new T.BufferAttribute(rows,1));
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return g;
}
function configure(tex){
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}
export function engravedFaces(root,columns,materials){
  const loader=new T.TextureLoader(),jobs=[],maps=[];
  let disposed=false;
  for(let start=0;start<columns.length;start+=pageSize){
    const batch=columns.slice(start,start+pageSize),height=Math.ceil(batch.length/8)*cellHeight,width=8*cellWidth;
    const surface=new Surface(),normals=[];
    batch.forEach((column,i)=>{
      const x=(i%8)*cellWidth+gutter,y=Math.floor(i/8)*cellHeight+gutter;
      doubleFace(surface,normals,column,[(x+.5)/width,1-(y+cellHeight-2*gutter-.5)/height,
        (cellWidth-2*gutter-1)/width,1-(y+.5)/height]);
    });
    const mat=finish(materials,false);
    jobs.push(loader.loadAsync(baseUrl+'plates-'+start/pageSize+'.webp').then(texture=>{
      if(disposed){texture.dispose();return;}
      maps.push(texture);mat.map=configure(texture);mat.needsUpdate=true;
    }));
    const mesh=new T.Mesh(geometry(surface,normals),mat);mesh.name='现场人物铭牌 · '+(start+1)+'–'+(start+batch.length);
    mesh.receiveShadow=true;root.add(mesh);
  }
  // Keep the full-resolution sleeve for the person the walker is reading.
  // Both opposing faces share one texture, including in the close-up view.
  const material=finish(materials,true),detail=new T.Mesh(new T.BufferGeometry(),material);
  detail.visible=false;detail.name='现场铭文近读';detail.receiveShadow=true;detail.renderOrder=1;root.add(detail);
  const cache=new Map();
  let current=null,request=0;
  root.userData.updateTalentPlate=eye=>{
    let closest=null,best=3.4**2;
    for(const col of columns){
      const dist=(eye.x-col.x)**2+(eye.z-col.z)**2+(eye.y-col.base-1.85)**2;
      if(dist<best){closest=col;best=dist;}
    }
    if(closest===current)return;
    const version=++request;current=closest;detail.visible=false;
    if(!current)return;
    const col=current,key=col.record.id;
    const show=tex=>{
      if(current!==col)return;
      const surface=new Surface(),normals=[];doubleFace(surface,normals,col,[0,0,1,1]);
      detail.geometry.dispose();detail.geometry=geometry(surface,normals);
      material.map=tex;material.needsUpdate=true;detail.visible=true;
    };
    if(cache.has(key)){const tex=cache.get(key);cache.delete(key);cache.set(key,tex);show(tex);return;}
    loader.loadAsync(col.record.field.image).then(tex=>{
      if(current!==col||version!==request){tex.dispose();return;}
      cache.set(key,configure(tex));show(tex);
      if(cache.size>5){const oldest=cache.keys().next().value;cache.get(oldest).dispose();cache.delete(oldest);}
    }).catch(()=>{if(current===col&&version===request)current=null;});
  };
  root.userData.disposeTalentPlates=()=>{
    disposed=true;current=null;
    for(const tex of [...maps,...cache.values()])tex.dispose();
    cache.clear();maps.length=0;
  };
  return Promise.all(jobs);
}
