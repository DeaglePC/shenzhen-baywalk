import * as T from 'three';
import {bridgeHandrail} from './bridge-handrail.js';
import {Grid,Surface,Instances,clamp,segmentDistance} from './city-geometry.js';
import {photo} from './city-materials.js';
import {drape,groundIndex,landingPaving} from './star-south-ground.js';

const pathY=.246,deckY=2.412;
const point=([x,z])=>new T.Vector3(x,0,z);
const level=(v,y)=>new T.Vector3(v.x,y,v.z);
const normal=d=>new T.Vector3(-d.z,0,d.x);
const shift=(p,d,s)=>p.clone().addScaledVector(d,s);
const mix=(a,b,t)=>a.clone().lerp(b,t);
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];

function routesAt(roads,at){
  return roads.filter(r=>!r.bridge&&r.layer>=0&&r.kind==='footway'&&
    (same(r.p[0],at)||same(r.p.at(-1),at)));
}
function fromEnd(road,at){return same(road.p[0],at)?road.p:road.p.slice().reverse();}

// Follow the mapped paths to the park, stopping at the next junction if it is closer.
function approachSections(road,junction,roads,plane){
  const path=fromEnd(road,junction),nodes=[point(junction)];
  let length=0;
  for(const coord of path.slice(1)){
    const last=nodes.at(-1),next=point(coord),span=last.distanceTo(next);
    if(span<.01)continue;
    const run=Math.min(29-length,span);
    nodes.push(mix(last,next,run/span));length+=run;
    if(length>=28.99||routesAt(roads,coord).some(r=>r!==road))break;
  }
  if(length<=6.1)return null;
  const samples=[],sections=[],distances=[0];
  for(let i=1;i<nodes.length;i++)distances.push(distances[i-1]+nodes[i].distanceTo(nodes[i-1]));
  const mouth=5.9,firstDir=nodes[1].clone().sub(nodes[0]).normalize();
  const sectionAt=d=>{
    let k=1;while(k<nodes.length-1&&distances[k]<d)k++;
    const tangent=nodes[k].clone().sub(nodes[k-1]).normalize();
    const center=shift(nodes[k-1],tangent,d-distances[k-1]);
    let cross=normal(tangent);
    if(Math.abs(d-distances[k])<.001&&k<nodes.length-1){
      const next=normal(nodes[k+1].clone().sub(nodes[k]).normalize());
      const bisector=cross.clone().add(next).normalize();cross=bisector.multiplyScalar(1/Math.max(.5,bisector.dot(cross)));
    }
    const t=clamp((d-mouth)/(length-mouth),0,1);
    const half=T.MathUtils.lerp(1.92,road.width*.5,t);
    const edge=side=>{
      const p=shift(center,cross,side*half);
      const start=shift(shift(nodes[0],firstDir,mouth),normal(firstDir),side*1.92);
      // Ease into the level path at the toe. The two sides inherit the landing's crossfall.
      p.y=pathY+(plane(start)-pathY)*(1-t)*(1-t*.55);
      return p;
    };
    return {left:edge(1),right:edge(-1)};
  };
  for(let d=mouth;d<length;d+=2)samples.push(d);
  samples.push(...distances.filter(d=>d>mouth));
  for(const d of [...new Set(samples)].sort((a,b)=>a-b))sections.push(sectionAt(d));
  return {sections,direction:firstDir};
}

export function buildStarLandings(root,map,rd,m,southGround){
  const paving=()=>({top:new Surface(),runway:new Surface(),lines:new Surface()});
  const north=paving(),south=paving(),banks=new Surface(),walls=new Surface(),caps=new Surface();
  const tube=new T.CylinderGeometry(1,1,1,10);
  const posts=new Instances(new T.BoxGeometry(.78,1,1.2),m.rail,'星光桥头 · 斜撑栏柱');
  const rails=new Instances(tube,m.dark,'星光桥头 · 连续扶手'),wires=new Instances(tube,m.rail,'星光桥头 · 横向钢索');
  const timberCap=bridgeHandrail();
  const railGrid=new Grid(12),ends=new Set(),grassTint=new T.Color(0xd5e1b7);
  const registerRail=(a,b)=>{
    const p=[a.x,a.z],q=[b.x,b.z];
    railGrid.add({p,q},[Math.min(a.x,b.x)-.2,Math.min(a.z,b.z)-.2,Math.max(a.x,b.x)+.2,Math.max(a.z,b.z)+.2]);
  };
  const quad=(s,a,b,c,d,scale=3.4,color)=>s.quad(...[a,b,c,d].map(v=>v.toArray()),
    [a,b,c,d].map(v=>[v.x/scale,v.z/scale]),color);
  const rod=(batch,a,b,r)=>batch.between(...a.toArray(),...b.toArray(),r);
  let southLaneEnd=null;
  const bridgeDir=point(rd.p.at(-1)).sub(point(rd.p[0])).normalize();
  for(const end of [0,rd.p.length-1]){
    const entry=rd.p[end],connector=routesAt(map.roads,entry)[0];
    if(!connector)continue;
    const junction=fromEnd(connector,entry).at(-1),branches=routesAt(map.roads,junction).filter(r=>r!==connector);
    if(branches.length!==2)continue;
    const j=point(junction),head=point(entry),towardDeck=head.clone().sub(j).normalize();
    const onSouth=entry[1]===Math.max(rd.p[0][1],rd.p.at(-1)[1]);
    const {top,runway,lines}=onSouth?south:north;
    const inward=end===0?bridgeDir:bridgeDir.clone().negate();
    const plane=p=>deckY+.064*((p.x-head.x)*inward.x+(p.z-head.z)*inward.z);
    const arms=branches.map(r=>approachSections(r,junction,map.roads,plane));
    if(arms.some(a=>!a))continue;
    const mouth=shift(j,towardDeck,4.9),cross=normal(towardDeck);
    const atPlane=v=>level(v,plane(v)),endCross=normal(bridgeDir).multiplyScalar(end===0?1:-1);
    const bridge={direction:towardDeck,sections:[]};
    for(let i=0;i<=6;i++){
      const t=i/6,center=mix(mouth,head,t),crossDir=mix(cross,endCross,t).normalize();
      const half=T.MathUtils.lerp(4.5,rd.width/2,t*t*(3-2*t));
      const edge=side=>atPlane(shift(center,crossDir,side*half));
      bridge.sections.push({left:edge(1),right:edge(-1)});
    }
    const lakeArm=arms.reduce((a,b)=>a.direction.x<b.direction.x?a:b);
    arms.push(bridge);arms.sort((a,b)=>Math.atan2(a.direction.z,a.direction.x)-Math.atan2(b.direction.z,b.direction.x));
    ends.add(end);
    const rim=[],gates=new Set(),mouths=[];
    for(const arm of arms){
      const rows=arm.sections;
      for(let k=1;k<rows.length;k++)quad(top,rows[k-1].left,rows[k].left,rows[k].right,rows[k-1].right);
      mouths.push(rows[0].right,rows[0].left);
      rim.push(...rows.map(s=>s.right));gates.add(rim.length-1);
      rim.push(...rows.map(s=>s.left).reverse());
    }
    const center=atPlane(j);
    for(let i=0;i<mouths.length;i++){
      const a=mouths[i],b=mouths[(i+1)%mouths.length];
      const ids=[center,b,a].map(v=>top.vertex(v.toArray(),[v.x/3.4,v.z/3.4]));top.indices.push(...ids);
    }

    // Carry the blue lake circuit through the paved fork to the lakeside path.
    const stripe=(row,frac,width)=>{
      const span=row.left.distanceTo(row.right),f=width/(2*span);
      return [frac-f,frac+f].map(t=>{const p=mix(row.right,row.left,t);p.y+=.011;return p;});
    };
    const band=(a,b)=>{
      quad(runway,a[0],b[0],b[1],a[1],3.1);
      for(const side of [0,1]){
        const u=mix(a[side],a[1-side],.045),v=mix(b[side],b[1-side],.045);
        const vertices=[a[side],b[side],v,u].map(p=>level(p,p.y+.004));
        quad(lines,...vertices);
      }
    };
    const laneSide=end===0?-1:1;
    const lip=stripe(bridge.sections.at(-1),.5+laneSide*(rd.width/2-2.55)/rd.width,2.06).reverse();
    // On the south landing, shift the blue track cleanly inland to match southWalk's
    // blueOffset (-5.65), staying completely clear of the shore starlight columns at -3.05!
    const roadBands=lakeArm.sections.map((row,idx)=>{
      const frac=idx/Math.max(1,lakeArm.sections.length-1);
      const base=stripe(row,.5,Math.min(1.95,row.left.distanceTo(row.right)*.59));
      if(!onSouth)return base;
      const across=row.right.clone().sub(row.left).normalize();
      // Gently arc 1.6m inland past the first shore columns, returning cleanly to 0 at frac=1 to weld into star-south.js!
      const shiftAmt=1.65*Math.sin(Math.PI*frac);
      return base.map(p=>p.clone().addScaledVector(across,shiftAmt));
    });
    if(onSouth)southLaneEnd=roadBands.at(-1);
    const curves=lip.map((a,i)=>{
      const b=roadBands[0][i];
      return new T.CubicBezierCurve3(a,shift(a,towardDeck,-head.distanceTo(j)*.63),
        shift(b,lakeArm.direction,-4),b);
    });
    let previous=lip;
    for(let k=1;k<=18;k++){
      const pair=curves.map(curve=>{const p=curve.getPoint(k/18);return level(p,plane(p)+.011);});
      band(previous,pair);previous=pair;
    }
    for(let k=1;k<roadBands.length;k++)band(roadBands[k-1],roadBands[k]);

    if(onSouth)for(const p of rim)p.y=(southGround.heightAt(p.x,p.z)??0)+landingPaving;
    const outward=rim.map((a,i)=>{
      const b=rim[(i+1)%rim.length];return normal(level(b,0).sub(level(a,0)).normalize()).negate();
    });
    const sections=rim.map((a,i)=>{
      const before=(i+rim.length-1)%rim.length,isGate=gates.has(before)||gates.has(i);
      const n=gates.has(before)?outward[i]:gates.has(i)?outward[before]:outward[i].clone().add(outward[before]).normalize();
      const outwardScale=isGate?1:1/Math.max(.57,n.dot(outward[i]));
      const nudge=(offset,y)=>level(shift(a,n,offset*outwardScale),y);
      const shoulder=.03+Math.max(0,a.y-.27)*.65*(isGate?0:1);
      return {cap:nudge(.10,a.y+.095),inner:nudge(-.16,a.y+.095),post:nudge(-.10,a.y),
        outer:nudge(.10,a.y-.055),earth:nudge(.015,shoulder),
        slope:nudge(.3+shoulder*.91,shoulder*.65),skirt:nudge(.39+shoulder*2.00,.045+shoulder*.10),
        toe:nudge(.51+shoulder*2.61,-.04)};
    });
    let wallStation=0,nextPost=0;
    const firstGate=gates.values().next().value;
    for(let step=1;step<=rim.length;step++){
      const i=(firstGate+step)%rim.length;
      const k=(i+1)%rim.length,a=rim[i],b=rim[k],s=sections[i],e=sections[k],len=a.distanceTo(b);
      // The new earth bank carries all three arms on the south side. Only the
      // immediate abutment at the deck still has a retaining wall and rail.
      if(onSouth&&Math.max(head.distanceTo(level(a,0)),head.distanceTo(level(b,0)))>8){nextPost=0;continue;}
      const baseA=level(a,-.13),baseB=level(b,-.13);
      walls.quad(...[baseA,a,b,baseB].map(v=>v.toArray()),[[wallStation,-.13],[wallStation,a.y],[wallStation+len,b.y],[wallStation+len,-.13]]);
      wallStation+=len;
      if(gates.has(i)){nextPost=0;continue;}
      quad(caps,s.inner,e.inner,e.cap,s.cap);quad(caps,s.cap,e.cap,e.outer,s.outer);
      if(!onSouth){
        quad(banks,s.earth,e.earth,e.slope,s.slope,4,grassTint);
        quad(banks,s.slope,e.slope,e.skirt,s.skirt,4,grassTint);quad(banks,s.skirt,e.skirt,e.toe,s.toe,4,grassTint);
      }
      const A=s.post,B=e.post;
      timberCap.span(A.x,A.y+1.178,A.z,B.x,B.y+1.178,B.z);
      rod(rails,level(A,A.y+1.12),level(B,B.y+1.12),.052);
      for(let k=1;k<=6;k++)rod(wires,level(A,A.y+.17+k*.131),level(B,B.y+.17+k*.131),.009);
      const railLength=A.distanceTo(B);
      const before=(i+rim.length-1)%rim.length;
      if(outward[before].dot(outward[i])<.88)nextPost=0;
      for(;nextPost<railLength;nextPost+=2.65){
        const foot=mix(A,B,nextPost/railLength),tip=shift(foot,outward[i],.06);
        rod(posts,level(foot,foot.y+.085),level(tip,tip.y+1.10),.092);
      }
      nextPost-=railLength;
      if(gates.has(k))rod(posts,level(B,B.y+.085),level(B,B.y+1.10),.092);
      registerRail(A,B);
    }
  }
  for(let i=1;i<rd.p.length;i++){
    const a=point(rd.p[i-1]),b=point(rd.p[i]),cross=normal(b.clone().sub(a).normalize());
    for(const side of [-1,1]){
      const offset=side*(rd.width/2-.1);registerRail(shift(a,cross,offset),shift(b,cross,offset));
    }
  }
  south.top=drape(south.top,southGround,landingPaving);
  south.runway=drape(south.runway,southGround,landingPaving+.011);
  south.lines=drape(south.lines,southGround,landingPaving+.015);
  for(const end of [north,south])end.top.mesh(root,m.path,'星光桥 · 桥头分岔铺装',true);
  const block=new T.MeshStandardMaterial({map:photo('concrete.webp'),roughness:.94,side:T.DoubleSide});
  block.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 course=vMapUv*vec2(1./1.18,1./.32);
      course.x+=mod(floor(course.y),2.)*.5;
      vec2 seam=min(fract(course),1.-fract(course));
      float mortar=min(smoothstep(.003,.008+fwidth(course.x),seam.x),smoothstep(.009,.023+fwidth(course.y),seam.y));
      float stone=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=(.15+stone*.75)*vec3(.99,1.01,1.)*mix(.57,1.,mortar);`);
  };
  walls.mesh(root,block,'星光桥 · 桥台与错缝挡墙',true);caps.mesh(root,m.kerb,'星光桥 · 花岗石压顶',true);
  banks.mesh(root,m.grass,'星光桥 · 岸线植被边坡',true);
  const blue=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x3b84be,roughness:.88,side:T.DoubleSide});
  for(const end of [north,south]){
    end.runway.mesh(root,blue,'桥头蓝色慢跑带');
    end.lines.mesh(root,m.paint,'桥头跑道白边');
  }
  timberCap.finish(root);
  for(const b of [posts,rails,wires])b.flush(root,b!==wires);
  return {ends,southLaneEnd,heightAt:groundIndex([north.top,banks,south.top,south.runway,south.lines]),onRail:(x,z)=>railGrid.query(x,z).some(({p,q})=>segmentDistance(x,z,p,q)<.17)};
}
