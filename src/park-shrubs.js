import * as T from 'three';
import {Grid,Instances,Surface,inArea,random} from './city-geometry.js';

const assets=new WeakMap(),lawns=new WeakMap(),tau=Math.PI*2;
const point=(x,y,z)=>new T.Vector3(x,y,z);
const offset=(p,a,d,h)=>point(p.x+Math.cos(a)*d,p.y+h,p.z+Math.sin(a)*d);

export function shrubTurf(map,x,z){
  if(!lawns.has(map)){
    const grid=new Grid(40);
    for(const area of map.land)if(area.turfY)grid.add(area,area.bbox);
    lawns.set(map,grid);
  }
  return lawns.get(map).query(x,z).reduce((h,f)=>f.turfY>h&&inArea(x,z,f)?f.turfY:h,0);
}

// Every strip is anchored at a stem or at soil level. The texture contains a
// single spray, blade or tuft with transparent gaps between its leaves.
function strip(surface,tile,rows,color){
  const first=surface.p.length/3,left=(tile%4+.008)/4,bottom=1-(Math.floor(tile/4)+.992)/4;
  for(let i=0;i<rows.length;i++){
    const [center,width,fold,t,shade]=rows[i];
    for(let col=0;col<3;col++){
      const p=center.clone().addScaledVector(width,col-1);
      if(col===1)p.add(fold);
      surface.vertex(p.toArray(),[left+col*.123,bottom+t*.246],color.clone().multiplyScalar(shade));
    }
    if(!i)continue;
    for(let k=0;k<2;k++){
      const j=first+(i-1)*3+k;surface.indices.push(j,j+1,j+4,j,j+4,j+3);
    }
  }
}
const zero=point(0,0,0);
function spray(near,far,tile,base,angle,run,height,radius,yaw,color){
  const across=point(Math.cos(yaw)*radius,0,Math.sin(yaw)*radius);
  const tip=offset(base,angle,run,height),bow=point(-Math.sin(yaw)*radius*.24,0,Math.cos(yaw)*radius*.24);
  const middle=offset(base,angle,run*.38,height*.54);
  strip(near,tile,[[base,across,zero,0,.58],[middle,across,bow,.5,.88],[tip,across,zero,1,1.07]],color);
  const u=(tile%4+.008)/4,v=1-(Math.floor(tile/4)+.992)/4,span=.246;
  far.quad(base.clone().sub(across).toArray(),base.clone().add(across).toArray(),
    tip.clone().add(across).toArray(),tip.clone().sub(across).toArray(),[[u,v],[u+span,v],[u+span,v+span],[u,v+span]],color);
  return tip;
}

function cane(surface,a,b,radius){
  const side=point(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(radius);
  const c=new T.Color(0x68573b),uv=Array(4).fill([.96,.125]);
  surface.quad(a.clone().sub(side).toArray(),a.clone().add(side).toArray(),
    b.clone().addScaledVector(side,.55).toArray(),b.clone().addScaledVector(side,-.55).toArray(),uv,c);
}

function grassBlade(s,p,a,h,run,w,color,arc=2.48){
  const side=point(-Math.sin(a)*w,0,Math.cos(a)*w);
  const k=s.p.length/3;
  for(const t of [0,.34,.67,1]){
    const c=offset(p,a,run*t*t,h*Math.sin(t*arc)),width=1-.99*t*t;
    for(const u of [-1,0,1]){
      const q=c.clone().addScaledVector(side,width*u);
      if(!u)q.y+=w*width*.62;
      s.vertex(q.toArray(),[.81+.052*u,.003+.242*t],color.clone().multiplyScalar((.56+.73*t)*(u===0?1.14:1)));
    }
  }
  for(let i=0;i<3;i++)for(let j=0;j<2;j++){
    const a=k+i*3+j;s.indices.push(a,a+1,a+4,a,a+4,a+3);
  }
}

function shrubShape(seed,style){
  const rand=random(seed),near=new Surface(),far=new Surface();
  const grassOnly=style==='copper'||style==='silver',blooms=style==='flower'||style==='violet';
  const leafTint=()=>new T.Color().setRGB(.19+.14*rand(),.32+.20*rand(),.10+.10*rand());
  if(!grassOnly)for(let pocket=0;pocket<5;pocket++){
    const dir=pocket*2.4+rand()*.66,center=offset(zero,dir,.15+.32*rand(),0),vigor=.58+.43*rand();
    for(let stem=0;stem<6;stem++){
      const a=dir+(rand()-.5)*3.8,foot=offset(center,a,rand()*.19,-.025);
      const joint=offset(foot,a,.09+.21*rand(),vigor*(.10+.22*rand()));
      cane(near,foot,joint,.008+rand()*.004);
      // Arching understory shoots spread below the taller leaders and shade
      // their bases. Lower leaves follow the ground independently of the crown.
      const lowAngle=a+.8*(rand()-.5);
      spray(near,far,Math.floor(rand()*9),foot,lowAngle,.25+.27*rand(),.24+.27*rand(),
        .22+.08*rand(),lowAngle+1.6,leafTint().multiplyScalar(.57));
      for(let twig=0;twig<3;twig++){
        const az=a+(twig-1)*(.6+rand()*.50),rise=vigor*(.48+.49*rand())*(twig===1?1.13:.71);
        const base=foot.clone().lerp(joint,twig===1?1:.52+.37*rand());
        const tip=spray(near,far,Math.floor(rand()*9),base,az,.16+.32*rand(),rise,.16+.15*rand(),
          az+Math.PI/2+(rand()-.5)*1.45,leafTint());
        if(twig!==1)continue;
        // The exposed tips carry separate folded leaves with their photographed veins.
        const start=joint.clone().lerp(tip,.79),end=offset(tip,az,.055,.105);
        cane(near,start,end,.0028);
        for(let n=0;n<7;n++){
          const joint=start.clone().lerp(end,n/6),turn=az+(n%2?1:-1)*(.56+rand()*1.13);
          const length=.070+.060*rand(),wide=.019+.013*rand(),side=point(-Math.sin(turn)*wide,0,Math.cos(turn)*wide);
          const mid=offset(joint,turn,length*.48,.034),edge=offset(joint,turn,length,.019+(rand()-.5)*.06);
          strip(near,12+Math.floor(rand()*2),[[joint,side,zero,0,.72],[mid,side,point(0,wide*.3,0),.5,1],[edge,side,zero,1,1]],leafTint());
        }
        if(blooms&&rand()<.49){
          const pigment=new T.Color(style==='violet'?0x8f78b0:rand()<.66?0xad3c62:0xc75d7e);
          for(let petal=0;petal<3;petal++){
            const turn=az+petal*tau/3,side=point(-Math.sin(turn)*.022,0,Math.cos(turn)*.022);
            const mid=offset(end,turn,.022,.032),outer=offset(end,turn,.052,.049);
            for(const surface of [near,far])strip(surface,14,[[end,side,zero,0,.72],
              [mid,side,point(0,.007,0),.5,1],[outer,side,zero,1,.95]],pigment);
          }
        }
      }
    }
  }
  const pockets=grassOnly?23:17;
  for(let i=0;i<pockets;i++){
    const a=i*2.39996+rand()*.65,r=grassOnly?Math.sqrt(rand())*.65:.28+.52*rand();
    const foot=offset(zero,a,r,-.018),height=grassOnly?.64+.55*rand():.28+.53*rand();
    const tone=style==='copper'?new T.Color(.57,.34,.16):new T.Color(.28,.48,.20);
    for(let k=0;k<2;k++){
      const dir=a+(rand()-.5)*2.5;
      spray(near,far,9+Math.floor(rand()*3),foot,dir,.07+.13*rand(),height*(.7+.34*rand()),
        (.16+.12*rand())*(grassOnly?1.1:.76),dir+Math.PI/2, tone);
    }
    for(let j=0;j<(grassOnly?12:5);j++){
      const dir=a+(rand()-.5)*3.6,straw=rand()<.08;
      const color=style==='copper'?new T.Color(rand()<.3?0x936145:0x827447):style==='silver'&&rand()<.34?
        new T.Color(0xa5ae7a):new T.Color(straw?0x9b8652:rand()<.5?0x5e713a:0x70814a);
      grassBlade(near,offset(foot,dir,rand()*.065,0),dir,height*(.48+.67*rand()),.10+.27*rand(),.006+rand()*.010,color);
    }
  }
  // A low fringe follows the footprint of the plants. Its outer blades curl
  // back to the turf, exposing small gaps between neighbouring root fans.
  for(let i=0;i<16;i++){
    const a=i*2.4+rand()*.7,r=.59+.21*rand(),root=offset(zero,a,r,-.018);
    const h=.11+.17*rand(),tint=new T.Color(.39,.50,.22);
    spray(near,far,9+i%3,root,a,.09+.12*rand(),h,.11+.06*rand(),a+1.4,tint);
    for(let j=0;j<5;j++){
      const turn=a+(rand()-.5)*2.8;
      grassBlade(near,root,turn,h,.16+.19*rand(),.007+rand()*.008,new T.Color(0x80844d),2.91);
    }
  }
  function finish(s){
    const g=s.geometry(),pos=g.attributes.position,norm=g.attributes.normal,n=point(0,0,0);
    // Small leaves receive diffuse skylight on both sides. Keep a radial component
    // so backlit edges and shadows still give the clump depth.
    for(let i=0;i<pos.count;i++){
      n.set(pos.getX(i)*.52+norm.getX(i)*.15,.64+pos.getY(i)*.23,pos.getZ(i)*.52+norm.getZ(i)*.15).normalize();
      norm.setXYZ(i,n.x,n.y,n.z);
    }
    return g;
  }
  return {near:finish(near),far:finish(far)};
}

function shrubAssets(root){
  if(assets.has(root))return assets.get(root);
  const loader=new T.TextureLoader(),pending=[];
  function load(file){
    let texture;
    pending.push(new Promise(resolve=>{
      texture=loader.load(import.meta.env.BASE_URL+'foliage/'+file,resolve,undefined,resolve);
    }));
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const map=load('understory.webp'),soil=load('root-soil.webp');
  root.userData.shrubReady=Promise.all(pending);
  const time=root.userData.shrubWindTime={value:0};
  function bendTips(shader){
    shader.uniforms.shrubTime=time;
    shader.vertexShader='uniform float shrubTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec2 site=instanceMatrix[3].xz;
      float phase=dot(site,vec2(.21,.14))-shrubTime*1.7;
      vec3 direction=vec3(.8,0.,.6);
      vec2 bend=vec2(dot(normalize(instanceMatrix[0].xyz),direction),dot(normalize(instanceMatrix[2].xyz),direction));
      transformed.xz+=bend*position.y*position.y*(.013*sin(phase)+.006*sin(phase*1.8+position.x*4.));
    `);
  }
  const leaves=new T.MeshPhysicalMaterial({map,color:0xb5b7a2,vertexColors:true,alphaTest:.24,alphaToCoverage:true,side:T.DoubleSide,roughness:.91,specularIntensity:.50});
  leaves.onBeforeCompile=shader=>{
    bendTips(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\nnormal *= faceDirection;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
      #include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float backlight=max(0.,-dot(normal,directionalLights[0].direction));
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*(.10+.17*backlight);
      #endif
    `);
  };
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map,alphaTest:leaves.alphaTest,side:T.DoubleSide});
  depth.onBeforeCompile=bendTips;
  const size=64,rgba=new Uint8Array(size*size*4),rand=random(399);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(z+.5)/size*2-1;
    const edge=Math.hypot(u,v)+.07*Math.sin(8*u+3*v)+.06*Math.cos(9*v-4*u);
    const i=(z*size+x)*4;
    rgba[i+1]=Math.round(210*(1-T.MathUtils.smoothstep(edge,.40,.96))*(.74+.26*rand()));
    rgba[i+3]=255;
  }
  const contact=new T.DataTexture(rgba,size,size);contact.magFilter=contact.minFilter=T.LinearFilter;contact.needsUpdate=true;
  const shade=new T.MeshStandardMaterial({map:soil,alphaMap:contact,color:0x958c74,roughness:1,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const forms=new Map(),meshes=[];
  const kit={leaves,depth,shade,forms,meshes};
  assets.set(root,kit);
  root.addEventListener('removed',()=>{
    for(const {near,far} of forms.values()){near.dispose();far.dispose();}
    for(const mesh of meshes)mesh.dispose();
    map.dispose();soil.dispose();contact.dispose();depth.dispose();
  });
  return kit;
}

export function parkShrubs(root,label,floorAt,style='mixed'){
  if(style===true)style='flower';
  const kit=shrubAssets(root),tiles=new Map();
  return {
    at(x,y,z,sx,sy,sz,yaw){
      const tileX=Math.floor(x/30),tileZ=Math.floor(z/30);
      const variant=((tileX*31+tileZ*67)>>>0)%3,formKey=style+variant;
      if(!kit.forms.has(formKey))kit.forms.set(formKey,shrubShape(3761+variant*5789,style));
      const key=tileX+','+tileZ;
      const form=kit.forms.get(formKey);
      if(!tiles.has(key))tiles.set(key,{form,batch:new Instances(form.far,kit.leaves,label+' · 枝叶'),shade:new Surface()});
      const {batch,shade}=tiles.get(key),floor=floorAt(x,z);
      const height=Math.max(sy,sy+Math.min(y-floor,sy*.72)),tone=.83+.22*(.5+.5*Math.sin(x*.42+z*.15));
      batch.at(x,floor,z,sx,height,sz,yaw+.16*Math.sin(x*13+z*7),new T.Color(tone*.94,tone,tone*.91));
      const cs=Math.cos(yaw),sn=Math.sin(yaw);
      const point=(u,v)=>{
        const px=x+1.04*(cs*u*sx+sn*v*sz),pz=z+1.04*(-sn*u*sx+cs*v*sz);
        return [px,floorAt(px,pz)+.01,pz];
      };
      for(let u=-1;u<1;u++)for(let v=-1;v<1;v++){
        const uv=[[u,v],[u,v+1],[u+1,v+1],[u+1,v]];
        shade.quad(...uv.map(([a,b])=>point(a,b)),uv.map(([a,b])=>[(a+1)/2,(b+1)/2]));
      }
    },
    flush(group,cast=true){
      const details=root.userData.localDetails??=[];
      for(const {batch,shade,form} of tiles.values()){
        const item=batch.flush(group,cast);item.customDepthMaterial=kit.depth;kit.meshes.push(item);
        // Include the taller individual blades in the bounds at both detail levels.
        item.geometry=form.near;item.computeBoundingSphere();item.geometry=form.far;
        details.push({item,range:550,lod:{distance:14,near:form.near,far:form.far}});
        const shadow=shade.mesh(group,kit.shade,label+' · 根际阴影');details.push({item:shadow,range:46});
      }
      tiles.clear();
    }
  };
}
