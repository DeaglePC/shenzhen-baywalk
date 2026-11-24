import * as T from 'three';
import {Surface,Instances,Grid,bounds,inArea,inRing,sideWall,random,clamp} from './city-geometry.js';
import {photo} from './city-materials.js';

// Each mapped roof outline is one triangular membrane.
export const isTidalSail=id=>id>=1277839436&&id<=1277839449;

function plazaStone(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d'),rng=random(39887);ctx.fillStyle='#7e807c';ctx.fillRect(0,0,512,512);
  for(let row=0;row<16;row++)for(let col=-1;col<4;col++){
    const x=col*128+(row%2)*64,z=row*32,t=rng();
    const v=Math.round((t<.14?114:t<.34?163:199)+rng()*16);
    ctx.fillStyle='rgb('+v+','+(v-1)+','+(v-4)+')';ctx.fillRect(x+1,z+1,126,30);
  }
  const im=ctx.getImageData(0,0,512,512);
  for(let i=0;i<im.data.length;i+=4){const n=(rng()-.5)*14;for(let k=0;k<3;k++)im.data[i+k]+=n;}
  ctx.putImageData(im,0,0);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;tex.wrapS=tex.wrapT=T.RepeatWrapping;
  return new T.MeshStandardMaterial({map:tex,roughness:.86,side:T.DoubleSide});
}

export function tidalSquare(root,map,m){
  const lake=map.water.find(f=>f.id===-10175109);
  if(!lake)return;
  const group=new T.Group();group.name='人才公园 · 潮汐广场与功勋墙';root.add(group);
  // Surveyed shoreline control points run east to west, then south to the existing promontory.
  const controls=[[66,-274],[-40.6,-301.3],[-63.1,-308.2],[-83.4,-305.8],[-111.1,-299.7],
    [-136.7,-287.3],[-151.6,-276.3],[-166.2,-261.6],[-173.8,-239.8],[-178,-220]];
  const arc=new T.CatmullRomCurve3(controls.map(([x,z])=>new T.Vector3(x,0,z)));
  const len=arc.getLength(),tiles=new Grid(24),obstacles=new Grid(12);
  const deck=new Surface(),paving=new Surface(),steps=new Surface(),risers=new Surface(),woodSeat=new Surface();
  const woodMap=photo('tidal-boards.webp'),timber=new T.MeshStandardMaterial({map:woodMap,roughness:.79,side:T.DoubleSide});
  const granite=new T.MeshStandardMaterial({color:0x99978d,roughness:.87,side:T.DoubleSide});
  const panels=new Surface(),plaques=new Surface(),walkPaths=[],trees=[];
  const steel=new T.MeshStandardMaterial({color:0xe1dfd6,metalness:.36,roughness:.39});
  const concrete=new Instances(new T.BoxGeometry(),granite,'坐凳石墩与座椅基础');
  const posts=new Instances(new T.CylinderGeometry(.91,1,1,14),m.dark,'临水黑色系缆柱');
  const rims=new Instances(new T.CylinderGeometry(1,1,1,16),m.rail,'系缆柱金属压盖');
  const tube=new T.CylinderGeometry(1,1,1,10);
  const mast=new Instances(new T.CylinderGeometry(.76,1,1,14),steel,'斜撑白色桅杆');
  const wire=new Instances(tube,m.rail,'风帆拉索、索头及玻璃扶手');
  const rope=new Instances(tube,new T.MeshStandardMaterial({color:0x9c735e,roughness:.95}),'岸线垂弧绳');
  const lamps=new Instances(tube,m.dark,'滨湖弯臂步道灯');
  const led=new Instances(tube,m.parkLights.finish(new T.MeshStandardMaterial({color:0xffe1aa,emissive:0xffce85}),2.1,.06),'步道灯嵌入灯条');
  const glass=new Surface(),sails=new Surface(),hems=new Instances(tube,steel,'白色膜面包边');
  function point(s,off,y){
    const t=clamp(s/len,0,1),c=arc.getPointAt(t),d=arc.getTangentAt(t);
    return [c.x-d.z*off,y,c.z+d.x*off];
  }
  function tile(grid,world,data){
    const p=world.map(v=>[v[0],v[2]]),bbox=bounds(p);grid.add({...data,p,bbox},bbox);
  }
  function obstacle(x,z,r){
    const p=[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]],bbox=bounds(p);obstacles.add({p,bbox},bbox);
  }
  function level(s,off){
    // The promenade broadens into the western amphitheatre. Ease both ends
    // back to the park grade so every entrance is traversable.
    const end=Math.min(T.MathUtils.smoothstep(s,0,17),1-T.MathUtils.smoothstep(s,len-18,len));
    const stair=clamp(Math.floor((off-14)/1.48)+1,0,7)*.205;
    return .265+end*Math.min(stair,Math.max(0,37-off)*.17);
  }
  const offsets=[0,2.35,6.25,14,...Array.from({length:7},(_,i)=>15.48+i*1.48),31,37];
  const n=Math.ceil(len/2.8);
  for(let i=0;i<n;i++){
    const a=i*len/n,b=(i+1)*len/n;
    for(let j=1;j<offsets.length;j++){
      const u=offsets[j-1],v=offsets[j],mid=(u+v)/2;
      const surface=u===2.35||a<83&&u<2.35?deck:u>=14&&u<24?steps:paving;
      const slope=u>=24,ya=level(a,slope?u:mid),yb=level(b,slope?u:mid);
      const corners=[point(a,u,ya),point(a,v,level(a,slope?v:mid)),point(b,v,level(b,slope?v:mid)),point(b,u,yb)];
      surface.quad(...corners,[[a/2,u/2],[a/2,v/2],[b/2,v/2],[b/2,u/2]]);
      tile(tiles,corners,{corners});
      if(u>=14&&u<24)risers.quad(point(a,u,level(a,u-.05)),corners[0],corners[3],point(b,u,level(b,u-.05)));
      if(j===1)risers.quad(point(a,0,-.32),corners[0],corners[3],point(b,0,-.32));
    }
  }
  const heightAt=(x,z)=>{
    const cell=tiles.query(x,z).find(c=>inArea(x,z,c));if(!cell)return null;
    const [a,b,,d]=cell.corners;
    const dx=x-a[0],dz=z-a[2],bx=b[0]-a[0],bz=b[2]-a[2],ux=d[0]-a[0],uz=d[2]-a[2],det=bx*uz-bz*ux;
    return a[1]+(dx*uz-dz*ux)/det*(b[1]-a[1])+(bx*dz-bz*dx)/det*(d[1]-a[1]);
  };
  // The pointed lookout under the last sails follows the surveyed lake outline.
  const pier=lake.p.slice(57,61),pierTop=.285;
  deck.polygon(pier,[],pierTop,2);sideWall(risers,pier,-.25,pierTop);
  tile(tiles,pier.map(([x,z])=>[x,pierTop,z]),{corners:pier.map(([x,z])=>[x,pierTop,z])});
  function cable(batch,a,b,r){batch.between(...a,...b,r);}
  let previous;
  for(let s=2;s<len-2;s+=2.85){
    const p=point(s,.28,.26),edge=point(s,-1,.26);
    if(inRing(edge[0],edge[2],pier)){previous=null;continue;}
    posts.at(p[0],.57,p[2],.142,.61,.142);rims.at(p[0],.88,p[2],.15,.039,.15);
    if(previous){
      const mid=[(p[0]+previous[0])/2,.52,(p[2]+previous[2])/2];
      cable(rope,[previous[0],.75,previous[2]],mid,.014);cable(rope,mid,[p[0],.75,p[2]],.014);
    }
    previous=p;
  }
  const feet=[];
  for(const f of map.buildings.filter(b=>isTidalSail(b.id))){
    const ring=f.p.map(([x,z])=>new T.Vector3(x,0,z));
    const corners=ring.filter((p,i)=>p.clone().sub(ring[(i+ring.length-1)%ring.length]).normalize()
      .dot(ring[(i+1)%ring.length].clone().sub(p).normalize())<.65);
    if(corners.length!==3)continue;
    const center=corners.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/3);
    const anchors=corners.map((p,i)=>{
      const dir=p.clone().sub(center).normalize();
      const foot=p.clone().addScaledVector(dir,-1.0),existing=feet.find(a=>Math.hypot(a.x-foot.x,a.z-foot.z)<1.45);
      if(existing)return existing;
      foot.y=heightAt(foot.x,foot.z)??.246;
      const top=p.clone();top.y=foot.y+(i===f.id%3?6.25:4.58);
      const tip=top.clone().addScaledVector(dir,.08);tip.y+=.36;
      cable(mast,foot.toArray(),tip.toArray(),.133);obstacle(foot.x,foot.z,.21);
      const guy=p.clone().addScaledVector(dir,1.9);guy.y=heightAt(guy.x,guy.z)??.246;
      const turnbuckle=tip.clone().lerp(guy,.84),lower=tip.clone().lerp(guy,.89);
      cable(mast,turnbuckle.toArray(),lower.toArray(),.045);
      cable(mast,[foot.x,foot.y+.025,foot.z],[foot.x,foot.y+.135,foot.z],.245);
      cable(wire,tip.toArray(),guy.toArray(),.016);feet.push(top);return top;
    });
    function sheet(u,v){
      const w=1-u-v,p=anchors[0].clone().multiplyScalar(w).addScaledVector(anchors[1],u).addScaledVector(anchors[2],v);
      const bend=4*(w*u+u*v+v*w);
      p.x+=(center.x-p.x)*.077*bend;p.z+=(center.z-p.z)*.077*bend;p.y-=.59*bend+2*w*u*v;return p.toArray();
    }
    const count=12,rows=[];
    for(let i=0;i<=count;i++){
      const row=[];for(let j=0;j<=count-i;j++)row.push(sails.vertex(sheet(i/count,j/count)));
      rows.push(row);
    }
    for(let i=0;i<count;i++)for(let j=0;j<count-i;j++){
      sails.indices.push(rows[i][j],rows[i+1][j],rows[i][j+1]);
      if(j<count-i-1)sails.indices.push(rows[i+1][j],rows[i+1][j+1],rows[i][j+1]);
    }
    for(let j=0;j<count;j++){
      const a=j/count,b=(j+1)/count;
      for(const edge of [t=>[0,t],t=>[t,0],t=>[t,1-t]])cable(hems,sheet(...edge(a)),sheet(...edge(b)),.026);
    }
  }
  // Raised monument terrace, laminated glass on round point fixings and benches.
  for(let s=16;s<134;s+=2.05){
    if(s%30>23)continue; // access steps between successive exhibit panels
    const off=20.8,y=level(s,off)+.91,a=point(s,off,y),b=point(s+1.99,off,y);
    const left=point(s,off-.65,level(s,off-.65)),right=point(s+1.99,off-.65,level(s+1.99,off-.65));
    panels.quad(left,right,b,a); tile(obstacles,[left,right,b,a],{});
    plaques.quad(point(s+.16,off-.59,left[1]+.10),point(s+1.82,off-.59,right[1]+.10),
      point(s+1.82,off-.05,y-.075),point(s+.16,off-.05,y-.075),[[1,0],[0,0],[0,1],[1,1]]);
    glass.quad(a,b,[b[0],y+1.07,b[2]],[a[0],y+1.07,a[2]]);
    cable(wire,point(s,off+.13,y+.89),point(s+1.99,off+.13,y+.89),.035);
    cable(wire,point(s,off+.14,y),point(s,off+.14,y+.89),.037);
    for(const h of [.16,.83])cable(wire,point(s+.10,off-.04,y+h),point(s+.10,off+.12,y+h),.049);
  }
  for(let s=20;s<135;s+=11.8){
    const y=level(s,27.6),p=point(s,27.6,y),q=point(s+3.7,27.6,y),yaw=Math.atan2(q[0]-p[0],q[2]-p[2]);
    for(const ds of [.45,3.25]){const v=point(s+ds,27.6,y);concrete.at(v[0],y+.21,v[2],.55,.42,.37,yaw);}
    for(let i=0;i<4;i++){const u=27.29+.15*i;woodSeat.quad(point(s,u,y+.45),point(s,u+.138,y+.45),point(s+3.7,u+.138,y+.45),point(s+3.7,u,y+.45));}
  }
  // Low stone planter-benches with the purple flowering groundcover in photo 10.
  const planter=new Surface(),soil=new Surface(),leaves=new Surface(),petals=new Surface(),rng=random(8423);
  for(let s=6;s<108;s+=15){
    const start=s,end=s+10.4,off=7.2,w=1.26;
    const bed=[point(start,off,.72),point(start,off+w,.72),point(end,off+w,.72),point(end,off,.72)];
    const ring=bed.map(([x,,z])=>[x,z]);sideWall(planter,ring,.265,.72,1.2,1);
    woodSeat.quad(point(start,off-.34,.74),point(start,off+.05,.74),point(end,off+.05,.74),point(end,off-.34,.74));
    soil.quad(...bed);tile(obstacles,bed,{});
    for(let j=0;j<93;j++){
      const [x,,z]=point(start+rng()*(end-start),off+.1+rng()*(w-.2),0);
      const h=.84+rng()*.27;
      for(let k=0;k<6;k++){
        const angle=rng()*Math.PI*2,dx=Math.cos(angle)*.19,dz=Math.sin(angle)*.19;
        const c=new T.Color().setRGB(.055+rng()*.06,.11+rng()*.08,.048+rng()*.04);
        leaves.quad([x,.72,z],[x+dx*.52-dz*.11,h-.07,z+dz*.52+dx*.11],[x+dx,h,z+dz],[x+dx*.52+dz*.11,h-.11,z+dz*.52-dx*.11],undefined,c);
      }
      if(j%3===0)for(let k=0;k<5;k++){
        const a=k*Math.PI*.4,b=(k+1)*Math.PI*.4;
        petals.quad([x,h-.01,z],[x+.042*Math.cos(a),h+.024,z+.042*Math.sin(a)],[x+.055*Math.cos((a+b)*.5),h+.031,z+.055*Math.sin((a+b)*.5)],[x+.042*Math.cos(b),h+.024,z+.042*Math.sin(b)]);
      }
    }
    const foot=point(s+1.1,off+w-.18,.72),shoulder=point(s+1.1,off+w-.41,3.02),peak=point(s+1.1,off+w-1.18,4.16);
    cable(lamps,foot,shoulder,.055);cable(lamps,shoulder,peak,.048);
    const strip=point(s+1.1,off+w-.84,3.60);
    cable(led,[strip[0],strip[1]-.04,strip[2]],[peak[0],peak[1]-.04,peak[2]],.019);
    m.parkLights.fixture(peak[0],peak[1]-.13,peak[2],0xffd69e,30,8.5);
  }
  planter.mesh(group,granite,'滨水花池石座');soil.mesh(group,new T.MeshStandardMaterial({color:0x453b2f,side:T.DoubleSide}),'花池土壤');
  leaves.mesh(group,new T.MeshStandardMaterial({vertexColors:true,roughness:.89,side:T.DoubleSide}),'沿岸紫花草丛');
  petals.mesh(group,new T.MeshStandardMaterial({color:0x986bab,roughness:.89,side:T.DoubleSide}),'花池紫色花冠');
  deck.mesh(group,timber,'临水深色木栈道');paving.mesh(group,plazaStone(),'潮汐广场 · 错缝深浅条石');steps.mesh(group,granite,'七级弧形看台');
  panels.mesh(group,new T.MeshStandardMaterial({color:0x977a68,roughness:.81,side:T.DoubleSide}),'功勋墙斜面展板');
  plaques.mesh(group,new T.MeshStandardMaterial({map:photo('tidal-inscription.webp'),roughness:.86,side:T.DoubleSide}),'功勋墙 · 实拍图文');
  risers.mesh(group,granite,'阶前踢面与驳岸');woodSeat.mesh(group,timber,'木条坐凳');
  glass.mesh(group,new T.MeshPhysicalMaterial({color:0xc3d7d2,metalness:.1,roughness:.12,transparent:true,opacity:.25,depthWrite:false,side:T.DoubleSide}),'功勋墙点式玻璃栏');
  sails.mesh(group,new T.MeshPhysicalMaterial({color:0xfff9e9,roughness:.78,side:T.DoubleSide,sheen:.46,sheenColor:0xfff9e9}),'潮汐广场 · 张拉膜帆棚',true);
  for(const batch of [mast,hems,wire,posts,rims,rope,concrete,lamps,led])batch.flush(group,true);
  for(const off of [4.6,10.2,29.8]){
    const p=[];for(let s=5;s<len-4;s+=6){const [x,,z]=point(s,off,0);p.push([x,z]);}
    walkPaths.push({kind:'footway',width:3.2,p});
  }
  for(let s=6;s<172;s+=7.1){
    for(const off of [39.4,47.9]){const [x,,z]=point(s+(off>40?3:0),off+Math.sin(s)*1.5,0);trees.push([x,z,8.5+2.8*Math.sin(s*.34)]);}
  }
  return {group,heightAt,obstacle,trees,walkPaths,blocked:(x,z)=>obstacles.query(x,z).some(o=>inArea(x,z,o))};
}
