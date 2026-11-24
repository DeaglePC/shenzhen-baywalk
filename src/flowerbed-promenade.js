import * as T from 'three';
import {Surface,random,clamp} from './city-geometry.js';
import {photo} from './city-materials.js';

// Continuous east-shore lakeside promenade covering the ENTIRE mapped road 537564125:
// seamlessly joins Starlight Bridge north approach toe (s ≈ 28m) -> Story Portals ->
// Flowerbed viewing terrace -> Shuangqu Bridge east entrance (s ≈ length - 4.5m).
export function flowerbedPromenade(root,road,m){
  const first=0,last=road.p.length-1,points=road.p.slice(first,last+1);
  const arc=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal',0.4);
  const length=arc.getLength(),rng=random(735037);
  // Starlight Bridge north ramp stops at junction index 2 (d ≈ 23.4m).
  // End at sEnd = length - 5.6m to meet Shuangqu Bridge east entrance cleanly without overlap!
  const sStart=23.1,sEnd=length-5.6;
  const half=s=>{
    const rampIn=T.MathUtils.smoothstep(s,sStart,sStart+22);
    const flowerBelly=T.MathUtils.smoothstep(s,75,110)*(1-T.MathUtils.smoothstep(s,215,255));
    return 1.32+1.48*rampIn+0.60*flowerBelly;
  };
  const stations=arc.getLengths((points.length-1)*16);
  const widths=new Map(points.slice(1).map((_,i)=>[first+i+1,2*half((stations[i*16]+stations[(i+1)*16])*.5)]));
  function at(s,offset,y){
    const t=clamp(s/length,0,1),p=arc.getPointAt(t),d=arc.getTangentAt(t);
    return [p.x-d.z*offset,y,p.z+d.x*offset];
  }
  // Lateral edges (in metres) of the 2.10m blue jogging lane:
  // Centered on Starlight ramp toe at s=sStart, smoothly shifting to the lakeside edge (-X)
  // so it joins Shuangqu Bridge's east blue track seamlessly!
  function blueEdges(s){
    const blend=T.MathUtils.smoothstep(s,sStart,sStart+24);
    const h=half(s);
    const left=T.MathUtils.lerp(-0.82,-h+0.08,blend);
    const right=T.MathUtils.lerp(0.82,-h+2.18,blend);
    return [left,right];
  }
  const stone=new Surface(),rubber=new Surface(),grout=new Surface(),drain=new Surface(),slots=new Surface();
  function slabM(surface,s,e,l0,r0,l1,r1,height,color){
    const a=at(s,l0,height),b=at(e,l1,height),c=at(e,r1,height),d=at(s,r0,height);
    surface.quad(a,b,c,d,[a,b,c,d].map(([x,,z])=>[x/2.4,z/2.4]),color);
  }
  const swatches=['#939598','#9a9c9d','#888b8d','#a0a09d','#83878a','#939797'].map(v=>new T.Color(v));
  for(let s=sStart;s<sEnd;s+=1.25){
    const e=Math.min(sEnd,s+1.25),hs=half(s),he=half(e);
    const [bl0,br0]=blueEdges(s),[bl1,br1]=blueEdges(e);
    slabM(grout,s,e,-hs,hs,-he,he,.249);
    slabM(rubber,s,e,bl0,br0,bl1,br1,.260);
    // Light granite curb divider between blue lane and stone promenade + outer drain edge
    slabM(drain,s,e,br0,br0+.11,br1,br1+.11,.258);
    slabM(drain,s,e,hs-.22,hs,he-.22,he,.258);
  }
  const courses=12;
  for(let course=0;course<courses;course++){
    const f0=course/courses,f1=(course+1)/courses;
    for(let s=sStart;s<sEnd;){
      const e=Math.min(sEnd,s+(s===sStart?.3+rng()*.6:.68+rng()*.65));
      if(e-s>.02){
        const hs=half(s),he=half(e);
        const [,br0]=blueEdges(s),[,br1]=blueEdges(e);
        const span0=Math.max(.2,(hs-.22)-(br0+.11)),span1=Math.max(.2,(he-.22)-(br1+.11));
        const l0=br0+.11+span0*f0+.004,r0=br0+.11+span0*f1-.004;
        const l1=br1+.11+span1*f0+.004,r1=br1+.11+span1*f1-.004;
        slabM(stone,s+.004,e-.004,l0,r0,l1,r1,.257,swatches[rng()*swatches.length|0]);
      }
      s=e;
    }
  }
  for(let s=sStart+.2;s<sEnd;s+=.16){
    const e=Math.min(sEnd,s+.024),hs=half(s),he=half(e);
    slabM(slots,s,e,hs-.15,hs-.05,he-.15,he-.05,.260);
  }
  const granite=photo('museum-granite-color.webp');
  const mat=(options)=>new T.MeshStandardMaterial({roughness:.9,side:T.DoubleSide,...options});
  grout.mesh(root,mat({color:0x64696a}),'湖滨步道 · 石板灰缝');
  stone.mesh(root,mat({map:granite,vertexColors:true}),'湖滨步道 · 灰色条石铺装');
  rubber.mesh(root,mat({map:m.running.map,color:0x3b84be}),'湖滨慢跑带 · 蓝色弹性路面');
  drain.mesh(root,mat({map:granite,color:0xb9b49f}),'湖滨步道 · 浅色收边排水沟');
  slots.mesh(root,mat({color:0x42433d}),'湖滨步道 · 排水槽孔');

  const poles=new Surface(),diffusers=new Surface(),bases=new Surface(),posts=[];
  for(let s=sStart+14;s<sEnd-8;s+=21.6){
    const [x,,z]=at(s,half(s)+1.15,.1),t=arc.getTangentAt(s/length);
    const p=(w,y,out)=>[x+t.x*w+t.z*out,y,z+t.z*w-t.x*out];
    function ring(y,out,thickness,width){
      return [p(-width,y,out-thickness),p(width,y,out-thickness),p(width,y,out+thickness),p(-width,y,out+thickness)];
    }
    // Keep the central viewing terrace lit below the flower lettering.
    const terrace=s>140&&s<150;
    const sections=terrace?[ring(.075,0,.115,.095),ring(.76,0,.10,.09)]:[ring(.075,0,.115,.095),ring(3.55,.06,.081,.076),ring(3.74,.11,.079,.076),
      ring(4.88,1.41,.086,.074)];
    for(let i=1;i<sections.length;i++)for(let k=0;k<4;k++){
      const j=(k+1)%4;poles.quad(sections[i-1][k],sections[i-1][j],sections[i][j],sections[i][k]);
    }
    poles.quad(...sections.at(-1));
    if(terrace)diffusers.quad(p(-.072,.64,.105),p(.072,.64,.105),p(.072,.71,.105),p(-.072,.71,.105));
    else diffusers.quad(p(-.049,3.84,.309),p(.049,3.84,.309),p(.049,4.79,1.389),p(-.049,4.79,1.389));
    bases.quad(p(-.048,.36,.116),p(.048,.36,.116),p(.048,.67,.117),p(-.048,.67,.117));
    posts.push([x,z]);const light=terrace?p(0,.68,.12):p(0,4.31,.85);
    m.parkLights.fixture(...light,0xffe4be,terrace?8:60,terrace?5:15);
  }
  poles.mesh(root,mat({color:0x42484c,metalness:.48,roughness:.53}),'湖滨 · 折臂庭院灯',true);
  bases.mesh(root,mat({color:0x596065}),'湖滨 · 灯杆检修盖');
  diffusers.mesh(root,m.parkLights.finish(mat({color:0xdde0d7,emissive:0xffdfaa}),2.3,.06),'湖滨 · 灯臂嵌入光带');
  // Export exact east end of the blue track & granite edges so Shuangqu Bridge joins seamlessly!
  const [eb0,eb1]=blueEdges(sEnd),eh=half(sEnd);
  return {
    road,first,last,widths,posts,
    eastJoin:{blueLeft:at(sEnd,eb0,.260),blueRight:at(sEnd,eb1,.260),stoneOuter:at(sEnd,eh,.257),center:at(sEnd,0,.257)},
    dispose(){granite.dispose();}
  };
}
