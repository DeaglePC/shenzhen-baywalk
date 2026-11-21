import * as T from 'three';
import {Surface} from './city-geometry.js';

const faceBottom=3.282, faceTop=5.046;
const brushedSteel='#adb1ae';
const font='"Microsoft YaHei","PingFang SC",sans-serif';

function plateMaterial(tex,rows,materials,nameLightOnly=false){
  const mat=new T.MeshPhysicalMaterial({map:tex,metalness:.84,roughness:.25,clearcoat:.14,clearcoatRoughness:.21,
    side:T.FrontSide,emissive:0xffefbc,emissiveIntensity:0});
  mat.userData.cityProbe='bridge';
  materials.walls.push(mat);
  mat.customProgramCacheKey=()=>'starlight-engraving-'+rows+'-'+nameLightOnly;
  mat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float steelPlate=smoothstep(.037,.32,dot(diffuseColor.rgb,vec3(.22,.68,.10)));
      roughnessFactor=mix(.77,roughnessFactor,steelPlate);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor*=steelPlate;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float row=1.-fract(vMapUv.y*${rows.toFixed(1)});
      float lettering=(1.-smoothstep(.07,.27,dot(diffuseColor.rgb,vec3(.22,.68,.10))))*smoothstep(.462,${nameLightOnly?'.48':'.50'},row)*(1.-smoothstep(${nameLightOnly?'.573,.581':'.69,.74'},row));
      totalEmissiveRadiance*=lettering*.90;`);
  };
  return mat;
}

function drawIdentification(ctx,record,x,y,w,h){
  ctx.fillStyle=brushedSteel;ctx.fillRect(x,y,w,h);ctx.textAlign='center';ctx.fillStyle='#232827';
  const text=record.inscription?.length?[...record.inscription]:[record.name];
  const fragments=record.inscriptionFragments||[];
  const observed=fragments.filter(f=>!(f.line===1 && (record.survey||record.literature) && record.name.startsWith(f.text)));
  for(const piece of observed)text[piece.line-1]=piece.text;
  for(const [i,line] of text.entries()){
    if(!line)continue;
    const fragment=observed.find(p=>p.line===i+1);
    const size=i===0?(fragment?.rightMissing ? .035 : .056):i===1?.029:.024;
    ctx.font=(i===0?'500 ':'')+Math.round(h*size)+'px '+font;
    const centerY=i===0?.528:i===1?.568:.600+(i-2)*.028;
    const alignedLeft=fragment?.rightMissing&&!fragment.leftMissing;
    ctx.save();ctx.translate(x+w*(alignedLeft?.145:.5),y+h*centerY);
    // A flat pixel here covers more steel vertically than horizontally.
    // Compensate in object space so Han characters stay square from the front.
    ctx.scale(1.06,.66);ctx.textBaseline='middle';ctx.textAlign=alignedLeft?'left':'center';
    ctx.fillText(line,0,0,w*(alignedLeft?.68:.89));ctx.restore();
  }
}

function addCurvedFace(surface,normals,c,side,arc,x,y,w,h,canvas,bottom=faceBottom,topEdge=faceTop){
  const yaw=Math.atan2(c.dz,-c.dx)+side*Math.PI;
  const vertex=(a,height)=>{
    const radius=.2168-(height-2.4)*.001;
    return [c.x+radius*Math.sin(a),height,c.z+radius*Math.cos(a)];
  };
  const U=u=>(x+1+u*(w-2))/canvas.width,top=1-(y+1)/canvas.height,bot=1-(y+h-1)/canvas.height;
  for(let j=0;j<48;j++){
    const u=j/48,v=(j+1)/48,a=yaw+(u-.5)*arc,b=yaw+(v-.5)*arc;
    surface.quad(vertex(a,bottom),vertex(b,bottom),vertex(b,topEdge),vertex(a,topEdge),[[U(u),bot],[U(v),bot],[U(v),top],[U(u),top]]);
    for(const angle of [a,b,b,a])normals.push(Math.sin(angle),.001,Math.cos(angle));
  }
}

export function engravedFaces(root,columns,materials){
  const faces=columns.flatMap(c=>c.faces.flatMap((record,side)=>record?[{c,record,side}]:[]));
  const jobs=[];
  function page(batch,full=false){
    if(!batch.length)return;
    const cols=full?1:4,rows=Math.ceil(batch.length/cols),w=full?1152:512,h=full?3072:960;
    const canvas=document.createElement('canvas');canvas.width=cols*w;canvas.height=rows*h;
    const ctx=canvas.getContext('2d');
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=16;
    const surface=new Surface(),normals=[];
    batch.forEach(({c,record,side},i)=>{
      const x=(i%cols)*w,y=Math.floor(i/cols)*h;
      drawIdentification(ctx,record,x,y,w,h);
      const url=record.faceTexture||record.portrait;
      if(url){
        const img=new Image();
        jobs.push(new Promise(resolve=>{
          img.onload=()=>{
            if(full)ctx.drawImage(img,x,y,w,h);
            else {
              const naturalWidth=Math.min(w*.71,h*.37*img.width/img.height);
              const compensate=record.portraitKind?.startsWith('site-study')||record.id==='wang-jian';
              const width=naturalWidth*(compensate?1.20:1);
              const height=naturalWidth*img.height/img.width*(compensate?.86:1);
              ctx.drawImage(img,x+(w-width)/2,y+h*.429-height,width,height);
            }
            tex.needsUpdate=true;resolve();
          };
          img.onerror=resolve;img.src=url;
        }));
      }
      addCurvedFace(surface,normals,c,side,full?3.06:2.64,x,y,w,h,canvas);
    });
    const mesh=surface.mesh(root,plateMaterial(tex,rows,materials,full&&batch[0].record.id==='zhu-shiping'),'弧面人物铭牌');
    mesh.geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));tex.needsUpdate=true;
  }
  // Small inventory stickers are visible above the steel sleeve on the 2021 walk.
  const marks=faces.filter(f=>f.record.survey);
  if(marks.length){
    const canvas=document.createElement('canvas'),w=120,h=48,cols=8;
    canvas.width=cols*w;canvas.height=Math.ceil(marks.length/cols)*h;
    const ctx=canvas.getContext('2d'),surface=new Surface(),normals=[];
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='25px Arial,sans-serif';
    marks.forEach(({c,side,record},i)=>{
      const x=(i%cols)*w,y=Math.floor(i/cols)*h;
      ctx.fillStyle='#bcbdb9';ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#363937';ctx.fillText(record.survey.code,x+w*.5,y+h*.52);
      addCurvedFace(surface,normals,c,side,.56,x,y,w,h,canvas,5.127,5.172);
    });
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
    const mat=new T.MeshStandardMaterial({map:tex,roughness:.64,metalness:.14});
    const mesh=surface.mesh(root,mat,'2021 年 A 区柱号标签');
    mesh.geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  }
  for(const face of faces.filter(f=>f.record.faceTexture))page([face],true);
  const others=faces.filter(f=>!f.record.faceTexture);
  // Short pages keep the long side under the WebGL2 minimum maximum texture size.
  for(let i=0;i<others.length;i+=12)page(others.slice(i,i+12));
  return Promise.all(jobs);
}
