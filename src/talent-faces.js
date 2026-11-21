import * as T from 'three';
import {Surface} from './city-geometry.js';

// Several UV islands share one material per atlas. Geometry follows the
// actual cylinder, including its lower curvature when approached from aside.
export function engravedFaces(root,columns,materials){
  const faces=columns.flatMap(c=>c.faces.flatMap((record,side)=>record?[{c,record,side}]:[]));
  const jobs=[],tileW=384,tileH=768,cols=4,rows=4,capacity=cols*rows;
  for(let first=0;first<faces.length;first+=capacity){
    const canvas=document.createElement('canvas');canvas.width=cols*tileW;canvas.height=rows*tileH;
    const ctx=canvas.getContext('2d'),tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=12;
    const surface=new Surface(),normals=[];
    const mat=new T.MeshPhysicalMaterial({map:tex,bumpMap:tex,bumpScale:.00065,metalness:.87,roughness:.21,clearcoat:.22,clearcoatRoughness:.18,
      side:T.FrontSide,emissive:0xffefbc,emissiveIntensity:0});
    mat.userData.cityProbe='bridge';materials.walls.push(mat);
    mat.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float steelPlate=smoothstep(.045,.32,dot(diffuseColor.rgb,vec3(.22,.68,.10)));
        roughnessFactor=mix(.63,roughnessFactor,steelPlate);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
        metalnessFactor*=steelPlate;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float row=1.-fract(vMapUv.y*4.);
        float lettering=(1.-smoothstep(.09,.29,dot(diffuseColor.rgb,vec3(.22,.68,.10))))*smoothstep(.462,.50,row)*(1.-smoothstep(.69,.74,row));
        totalEmissiveRadiance*=lettering*.90;`);
    };
    faces.slice(first,first+capacity).forEach(({c,record,side},n)=>{
      const x=(n%cols)*tileW,y=Math.floor(n/cols)*tileH,mid=x+tileW/2;
      ctx.fillStyle='#adb1ae';ctx.fillRect(x,y,tileW,tileH);ctx.textAlign='center';ctx.fillStyle='#28302f';
      ctx.font='500 43px "Microsoft YaHei","PingFang SC",sans-serif';ctx.fillText(record.name,mid,y+tileH*.545,tileW*.84);
      // A biographical summary is never substituted for unreadable wording.
      if(record.inscription){
        const lines=record.inscription.filter(s=>s!==record.name);
        for(let j=0;j<lines.length;j++){
          ctx.font=(j===0?22:18)+'px "Microsoft YaHei","PingFang SC",sans-serif';
          ctx.fillText(lines[j],mid,y+tileH*.594+j*24,tileW*.88);
        }
      }
      const full=record.id==='fang-binxing',imageUrl=full?'/talent/fang-binxing-face.webp':record.portrait;
      if(imageUrl){
        const img=new Image();jobs.push(new Promise(resolve=>{
          img.onload=()=>{
            if(full)ctx.drawImage(img,x,y,tileW,tileH);
            else{const w=Math.min(tileW*.71,tileH*.37*img.width/img.height),h=w*img.height/img.width;
              ctx.drawImage(img,mid-w/2,y+tileH*.429-h,w,h);}
            tex.needsUpdate=true;resolve();
          };img.onerror=resolve;img.src=imageUrl;
        }));
      }
      const yaw=Math.atan2(c.dz,-c.dx)+side*Math.PI;
      for(let j=0;j<28;j++){
        const u=j/28,v=(j+1)/28,a=yaw+(u-.5)*2.64,b=yaw+(v-.5)*2.64;
        const vertex=(angle,h)=>{const r=.2168-(h-2.4)*.001;return [c.x+r*Math.sin(angle),h,c.z+r*Math.cos(angle)];};
        const U=t=>(x+1+t*(tileW-2))/canvas.width,top=1-(y+1)/canvas.height,bot=1-(y+tileH-1)/canvas.height;
        surface.quad(vertex(a,3.282),vertex(b,3.282),vertex(b,5.046),vertex(a,5.046),[[U(u),bot],[U(v),bot],[U(v),top],[U(u),top]]);
        for(const angle of [a,b,b,a])normals.push(Math.sin(angle),.001,Math.cos(angle));
      }
    });
    const mesh=surface.mesh(root,mat,'弧面人物铭牌');
    mesh.geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));tex.needsUpdate=true;
  }
  return Promise.all(jobs);
}
