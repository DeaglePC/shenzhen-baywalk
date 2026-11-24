import * as T from 'three';
import {Instances,Surface,along,bounds,random,ribbon} from './city-geometry.js';
import {photo} from './city-materials.js';

// The long planter on the southwest approach is parallel to the diagonal
// paving. Local X reads left-to-right from the public side of the lettering.
const monument={x:-1477.7,z:-1306.5,yaw:Math.atan2(-.881,.473),width:12.8,depth:2.15};
function onPlinth(u,v){
  const c=Math.cos(monument.yaw),s=Math.sin(monument.yaw);
  return [monument.x+c*u+s*v,monument.z-s*u+c*v];
}
function monumentRing(){
  const w=monument.width/2,d=monument.depth/2;
  return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,v])=>onPlinth(u,v));
}
function clippedPineSpray(){
  const s=new Surface(),rng=random(219),tone=new T.Color();
  // Scaled as one flattened spray. Small lanceolate leaves break up both its
  // silhouette and surface when standing a few metres from the planter.
  for(let i=0;i<520;i++){
    const a=rng()*Math.PI*2,v=rng()*2-1,r=Math.sqrt(1-v*v)*(.68+.32*rng());
    const x=r*Math.cos(a),z=r*Math.sin(a),y=v*.86,l=.13+.16*rng(),w=.020+.036*rng();
    const dx=Math.cos(a),dz=Math.sin(a),lift=l*(.35+1.4*rng());
    tone.setRGB(.40+.27*rng(),.56+.30*rng()+.07*v,.34+.27*rng());
    const k=s.vertex([x,y,z],undefined,tone);
    s.vertex([x+dx*l*.48-dz*w,y+lift*.42,z+dz*l*.48+dx*w],undefined,tone);
    s.vertex([x+dx*l,y+lift,z+dz*l],undefined,tone);
    s.vertex([x+dx*l*.48+dz*w,y+lift*.42,z+dz*l*.48-dx*w],undefined,tone);
    s.indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  return s.geometry();
}
export function entryMonument(root,m,place){
  const {width,depth,x,z,yaw}=monument,box=new T.BoxGeometry();
  const granite=new T.MeshStandardMaterial({map:photo('museum-granite-color.webp'),color:0x41464a,roughness:.56});
  const stone=new Instances(box,granite,'西广场 · 深灰花岗岩字座');
  const tiles=6,unit=width/tiles;
  for(let i=0;i<tiles;i++){
    const [px,pz]=onPlinth(-width/2+unit*(i+.5),0);
    stone.at(px,.68,pz,unit-.013,.91,depth,yaw);
  }
  stone.at(x,1.145,z,width+.045,.055,depth+.055,yaw);stone.flush(root,true);
  const letters=new T.MeshStandardMaterial({color:0xe3e1d6,metalness:.39,roughness:.33,emissive:0xffe5c1});
  m.parkLights.finish(letters,.24);
  const [px,pz]=onPlinth(0,.69),nx=Math.sin(yaw),nz=Math.cos(yaw);
  place(root,{x:px,y:1.174,z:pz,nx,nz,width:12.05,depth:.19,face:letters,
    side:new T.MeshStandardMaterial({color:0x848981,metalness:.48,roughness:.40}),name:'入口西广场 · Tencent 腾讯 立体字'});
  const leaves=new Instances(clippedPineSpray(),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.91}),'西广场 · 罗汉松修剪枝叶');
  const boughs=new Instances(new T.CylinderGeometry(.73,1,1,7),m.trunk,'西广场 · 造型松树干');
  const rng=random(7301);
  for(const [u,v,h] of [[-.8,-2.9,4.8],[3.9,-2.45,3.2],[-4.6,-3,2.9]]){
    const [cx,cz]=onPlinth(u,v);let start=[cx,.24,cz];
    for(let k=0;k<5;k++){
      const y=.28+h*(k+1)/5,end=[cx+Math.sin(k*1.5)*.29,y,cz+k*.08];
      boughs.between(...start,...end,.19*(1-k*.13));
      if(k>0)for(let j=0;j<(k===4?1:3);j++){
        const angle=j*2.1+k*1.8,reach=k===4?.21:h*(.24+.06*rng())*(1.24-k*.12);
        const bx=end[0]+Math.cos(angle)*reach,bz=end[2]+Math.sin(angle)*reach;
        boughs.between(...start,bx,y-.03,bz,.065);
        for(let l=0;l<8;l++){
          const a=rng()*Math.PI*2,r=Math.sqrt(rng())*.52,sz=.42+rng()*.37;
          const tone=new T.Color().setHSL(.24+rng()*.045,.36,.22+rng()*.10);
          leaves.at(bx+r*Math.cos(a),y+.12+rng()*.25,bz+r*Math.sin(a),sz,.23+rng()*.13,sz*.82,a,tone);
        }
      }
      start=end;
    }
  }
  boughs.flush(root,true);
  const fine=leaves.flush(root,true);
  const distant=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0xabb29d,roughness:.96}),fine.count);
  distant.instanceMatrix=fine.instanceMatrix;distant.instanceColor=fine.instanceColor;distant.computeBoundingSphere();
  const lod=new T.LOD();lod.name='西广场造型松';lod.position.set(x,0,z);
  fine.position.set(-x,0,-z);distant.position.copy(fine.position);
  lod.addLevel(fine,0);lod.addLevel(distant,42,.12);root.add(lod);
  const bed=new Surface(),rim=new Surface();
  const ring=[[-6.45,-1.02],[-6.65,-2.0],[-6.35,-3.65],[-5.5,-4.3],[5.5,-4.3],[6.4,-3.5],[6.52,-1.02]].map(([u,v])=>onPlinth(u,v));
  bed.polygon(ring,[],.39,1.2);
  const loop=[...ring,ring[0]];ribbon(rim,loop,.23,.44,1.1);
  for(let i=1;i<loop.length;i++){const [x,z]=loop[i-1],[X,Z]=loop[i];rim.quad([x,.24,z],[x,.44,z],[X,.44,Z],[X,.24,Z]);}
  bed.mesh(root,new T.MeshStandardMaterial({map:photo('grass.webp'),color:0x67784b,roughness:.98,side:T.DoubleSide}),'西广场松树种植池');
  rim.mesh(root,granite,'西广场种植池花岗岩压顶');
  for(const u of [-4,0,4]){const [x,z]=onPlinth(u,1.24);m.parkLights.fixture(x,.45,z,0xffdfbe,14,5);}
}

function courtSurface(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=608;
  const g=canvas.getContext('2d');g.fillStyle='#af7062';g.fillRect(0,0,1024,608);
  const scale=30,w=28*scale,h=15*scale,x=(1024-w)/2,y=(608-h)/2;
  g.translate(x,y);g.fillStyle='#748897';g.fillRect(0,0,w,h);
  g.strokeStyle='#ede7d7';g.lineWidth=2.2;g.strokeRect(0,0,w,h);
  function line(x1,y1,x2,y2){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();}
  line(w/2,0,w/2,h);g.beginPath();g.arc(w/2,h/2,1.8*scale,0,2*Math.PI);g.stroke();
  for(const side of [0,1]){
    g.save();if(side){g.translate(w,0);g.scale(-1,1);}
    g.strokeRect(0,h/2-2.45*scale,5.8*scale,4.9*scale);
    g.beginPath();g.arc(5.8*scale,h/2,1.8*scale,-Math.PI/2,Math.PI/2);g.stroke();
    const basket=1.575*scale,r=6.75*scale,dy=h/2-.9*scale,angle=Math.asin(dy/r);
    const px=basket+r*Math.cos(angle);line(0,.9*scale,px,.9*scale);line(0,h-.9*scale,px,h-.9*scale);
    g.beginPath();g.arc(basket,h/2,r,-angle,angle);g.stroke();g.restore();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  return new T.MeshStandardMaterial({map:texture,roughness:.91,side:T.DoubleSide});
}
function haitianCourt(root,site,m,solid){
  // The long sides of the surveyed rectangle follow the curved street.
  const p=site.p,[a,b,c,d]=p,field=new Surface();
  field.quad([a[0],.23,a[1]],[d[0],.23,d[1]],[c[0],.23,c[1]],[b[0],.23,b[1]]);
  field.mesh(root,courtSurface(),'海天二路篮球场 · 场地铺装');
  const meshCanvas=document.createElement('canvas');meshCanvas.width=meshCanvas.height=64;
  const g=meshCanvas.getContext('2d');g.strokeStyle='#c7c9c2';g.lineWidth=2.7;
  g.beginPath();g.moveTo(-1,-1);g.lineTo(65,65);g.moveTo(-1,65);g.lineTo(65,-1);g.stroke();
  const wire=new T.CanvasTexture(meshCanvas);wire.wrapS=wire.wrapT=T.RepeatWrapping;wire.colorSpace=T.SRGBColorSpace;wire.anisotropy=8;
  const fabric=new Surface(),tube=new T.CylinderGeometry(1,1,1,8),rail=new Instances(tube,m.rail,'海天二路球场 · 银色立柱与围网横杆');
  const addFence=(a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    fabric.quad([a[0],.32,a[1]],[b[0],.32,b[1]],[b[0],3.75,b[1]],[a[0],3.75,a[1]],[[0,0],[len/.19,0],[len/.19,3.43/.19],[0,3.43/.19]]);
    for(let i=0,n=Math.ceil(len/2.85);i<=n;i++)rail.at(a[0]+dx*i/n,2.03,a[1]+dz*i/n,.045,3.56,.045);
    for(const y of [.32,2.12,3.78])rail.between(a[0],y,a[1],b[0],y,b[1],.042);
    const nx=-dz/len*.07,nz=dx/len*.07;
    solid([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],3.8);
  };
  for(let i=0;i<4;i++){
    const A=p[i],B=p[(i+1)%4],lerp=t=>A.map((v,j)=>v+(B[j]-v)*t);
    if(i===3){addFence(A,lerp(.23));addFence(lerp(.29),B);}else addFence(A,B);
  }
  fabric.mesh(root,new T.MeshStandardMaterial({map:wire,alphaTest:.30,alphaToCoverage:true,roughness:.62,side:T.DoubleSide}),'海天二路球场 · 菱形围网');
  const hoop=new T.MeshStandardMaterial({color:0xc35e38,roughness:.57}),white=new T.MeshStandardMaterial({color:0xd6e2dc,roughness:.53});
  const backs=new Instances(new T.BoxGeometry(),white,'球场 · 篮板'),rims=new Instances(new T.TorusGeometry(.225,.019,7,32).rotateX(Math.PI/2),hoop,'球场 · 篮圈');
  const mid=(u,v)=>[(u[0]+v[0])/2,(u[1]+v[1])/2],ends=[mid(a,b),mid(c,d)];
  for(let i=0;i<2;i++){
    const [x,z]=ends[i],dx=ends[1-i][0]-x,dz=ends[1-i][1]-z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
    const inset=len*(1-840/1024)/2;
    rail.at(x+ux*(inset-.55),1.9,z+uz*(inset-.55),.095,3.45,.095);
    rail.between(x+ux*(inset-.55),2.95,z+uz*(inset-.55),x+ux*(inset+1.20),3.62,z+uz*(inset+1.20),.066);
    backs.at(x+ux*(inset+1.20),3.65,z+uz*(inset+1.20),1.8,1.05,.056,Math.atan2(ux,uz));
    rims.at(x+ux*(inset+1.58),3.28,z+uz*(inset+1.58),1,1,1);
  }
  rail.flush(root,true);backs.flush(root,true);rims.flush(root,true);
}

function parkedCycles(root,path,m){
  const tube=new T.CylinderGeometry(1,1,1,7),box=new T.BoxGeometry();
  const rubber=new Instances(new T.TorusGeometry(.282,.035,7,32).rotateY(Math.PI/2),m.dark,'海天二路 · 停车区车轮');
  const spokes=new Instances(tube,m.rail,'停车区 · 轮辐与车把'),frame=new Instances(tube,new T.MeshStandardMaterial({color:0xffffff,metalness:.35,roughness:.52}),'停车区 · 单车车架');
  const seat=new Instances(box,m.dark,'停车区 · 鞍座与踏板');
  let n=0;
  along(path,1.13,.54,(x,z,dx,dz)=>{
    if(n>=6)return;
    const o=-5.65,px=x-dz*o,pz=z+dx*o,yaw=Math.atan2(-dz,-dx)+.28+.16*Math.sin(n*2);
    const c=Math.cos(yaw),s=Math.sin(yaw),color=new T.Color([0x358d98,0x697b7c,0x487580,0xa29a61][n++%4]);
    const at=(u,v,y)=>[px+c*u+s*v,.32+y,pz-s*u+c*v];
    const bar=(batch,a,b,r,tint)=>batch.between(...at(...a),...at(...b),r,tint);
    for(const v of [-.52,.53]){
      const [bx,by,bz]=at(0,v,.32);
      rubber.at(bx,by,bz,1,1,1,yaw);
      for(let j=0;j<8;j++){
        const a=j*Math.PI/8,h=Math.sin(a)*.267,l=Math.cos(a)*.267;
        bar(spokes,[0,v-l,.32-h],[0,v+l,.32+h],.005);
      }
    }
    for(const [a,b,r] of [[[0,-.52,.32],[0,-.13,.76],.027],[[0,-.52,.32],[0,-.04,.30],.024],
      [[0,-.04,.30],[0,-.15,.84],.036],[[0,-.04,.30],[0,.38,.65],.059],[[0,.38,.65],[0,.47,.99],.036],
      [[0,.53,.32],[0,.38,.72],.033]])bar(frame,a,b,r,color);
    bar(spokes,[-.24,.45,1],[.24,.45,1],.021);bar(spokes,[0,-.10,.30],[-.18,-.30,0],.015);
    // Wire basket rims and ribs follow the bike orientation and front fork.
    if(n%3!==0){
      for(const [h,w,v0,v1] of [[.77,.128,.54,.72],[.96,.17,.50,.78]]){
        bar(spokes,[-w,v0,h],[w,v0,h],.008);bar(spokes,[-w,v1,h],[w,v1,h],.008);
        for(const side of [-1,1])bar(spokes,[side*w,v0,h],[side*w,v1,h],.008);
      }
      for(const u of [-.12,-.06,0,.06,.12]){
        for(const v of [.55,.71])bar(spokes,[u,v,.77],[u*1.29,v>.6?.78:.50,.96],.005);
      }
    }
    for(const side of [-1,1])bar(frame,[side*.033,-.49,.55],[side*.033,-.62,.53],.024,color);
    const [sx,sy,sz]=at(0,-.16,.86);seat.at(sx,sy,sz,.22,.079,.26,yaw);
    const [tx,ty,tz]=at(0,.04,.32);seat.at(tx,ty,tz,.34,.04,.094,yaw);
  });
  for(const b of [rubber,spokes,frame,seat])b.flush(root,true);
}

export function tencentFrontage(root,map,m,grid,layout){
  const site=map.land.find(f=>f.id===737149477),street=map.roads.find(r=>r.id===830807174);
  if(!site||!street)return;
  const solid=(p,h)=>{const bbox=bounds(p);grid.buildings.add({p,bbox,h},bbox);};
  solid(monumentRing(),2.82);
  const granite=new T.MeshStandardMaterial({map:photo('museum-granite-color.webp'),color:0xc9cccc,roughness:.88,side:T.DoubleSide});
  granite.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 plazaCoord;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nplazaCoord=position.xz;');
    shader.fragmentShader='varying vec2 plazaCoord;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 slab=mat2(.473,-.881,.881,.473)*plazaCoord/vec2(1.22,.62);
      slab.x+=.5*mod(floor(slab.y),2.);
      vec2 edge=.5-abs(fract(slab)-.5);
      vec2 joint=1.-smoothstep(vec2(.002),vec2(.006)+fwidth(slab)*.8,edge);
      float grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(vec3(grey),diffuseColor.rgb,.23)*(.94+.09*fract(sin(dot(floor(slab),vec2(12.3,76.8)))*4678.));
      diffuseColor.rgb*=1.-.45*max(joint.x,joint.y);`);
  };
  const paving=new Surface(),yellow=new Surface(),court=map.land.find(f=>f.id===543268967);
  const plaza=map.land.find(f=>f.id===1434393000);
  if(plaza)paving.polygon(plaza.p,plaza.holes,.251,3.2);
  const apron=[[-1494,-1316.6],[-1484,-1321],[-1479,-1316.8],[-1473,-1319.8],[-1460,-1294],[-1463,-1287],[-1475,-1282],[-1484,-1292],[-1493,-1304]];
  paving.polygon(apron,[],.252,3.2);
  grid.tencentHardscape=[{p:apron,bbox:bounds(apron)},...(court?[court]:[])];
  const entrance=[[-1382,-1340],[-1396,-1371],[-1384,-1396],[-1380,-1395],[-1366,-1370],[-1349,-1353],[-1348,-1336],[-1359,-1334]];
  paving.polygon(entrance,[],.248,3.2);
  // Paving follows the two mapped sidewalks along the inside and outside of
  // the bend. Keep the motor access from Haitian 2nd Road clear.
  const foot=map.roads.find(r=>r.id===1191357746);
  if(foot)ribbon(paving,foot.p.filter(([x,z])=>x>=-1383&&x<=-1230&&z>=-1416&&z<=-1330),3.65,.252,2.7);
  const east=street.p.filter(([x])=>x<=-1283);
  ribbon(paving,east,3.75,.254,3,-(street.width/2+2.35));
  if(court){
    const perimeter=[...court.p,court.p[0]];
    ribbon(paving,perimeter,2.8,.215,2);
    // Fill the public strip between the basketball enclosure and the road.
    paving.polygon([[-1366,-1399],[-1362,-1399],court.p[3],court.p[0],[-1301,-1352],[-1317,-1355],[-1336,-1365],[-1356,-1381]],[],.218,3);
    haitianCourt(root,court,m,solid);
  }

  // The yellow hatch visible in the panorama lies inside the kerb line at the
  // campus entrance. Build it in the local road frame so the lanes still flow.
  const junction=street.p.findIndex(([x,z])=>x===-1339.6&&z===-1361.9);
  if(junction>0)parkedCycles(root,street.p.slice(junction-1,junction+2),m);
  const lines=layout.clearRuns(street);
  for(const line of lines){
    const local=line.filter(([x])=>x< -1240);
    for(const side of [-1,1]){
      ribbon(yellow,local,.12,.326,1,side*(street.width/2-.17));
      ribbon(paving,line,1.32,.351,2.8,side*(street.width/2+.81));
    }
  }
  if(junction>1){
    const path=street.p.slice(junction-2,junction+2),width=2.55,off=street.width/2+width/2;
    const bay=new Surface();ribbon(bay,path,width,.365,3,off);
    const pavement=new T.MeshStandardMaterial({map:photo('asphalt.webp'),color:0x7b8184,roughness:.88,side:T.DoubleSide});
    bay.mesh(root,pavement,'海天二路 · 门前路侧沥青');
    const pointAt=(s,v)=>{
      let point;
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
        point=[a[0]+dx*Math.min(s/l,1)-dz/l*v,a[1]+dz*Math.min(s/l,1)+dx/l*v];
        if(s<=l)break;s-=l;
      }
      return point;
    };
    const length=path.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-path[i][0],b[1]-path[i][1]),0);
    for(const side of [-1,1])ribbon(yellow,path,.12,.386,1,off+side*(width/2-.07));
    for(let s=0;s<length-2.6;s+=4.8){
      ribbon(yellow,[pointAt(s,off-width/2),pointAt(s+2.55,off+width/2)],.115,.388);
      ribbon(yellow,[pointAt(s,off+width/2),pointAt(s+2.55,off-width/2)],.115,.388);
    }
  }
  const bollards=new Instances(new T.CylinderGeometry(.112,.122,1,12),m.rail,'海天二路 · 不锈钢隔离桩');
  const bands=new Instances(new T.CylinderGeometry(.119,.119,1,12),m.yellow,'海天二路 · 桩身反光环');
  const mouth=street.p[junction];
  if(mouth)along(street.p.slice(2,junction+4),2.65,.8,(x,z,dx,dz)=>{
    if(Math.hypot(x-mouth[0],z-mouth[1])<5.1)return;
    const offset=street.width/2+3.06,px=x-dz*offset,pz=z+dx*offset;
    bollards.at(px,.72,pz,1,.86,1);bands.at(px,1.045,pz,1,.074,1);
    solid([[px-.12,pz-.12],[px+.12,pz-.12],[px+.12,pz+.12],[px-.12,pz+.12]],1.15);
  });
  bollards.flush(root,true);bands.flush(root);
  yellow.mesh(root,m.yellow,'海天二路 · 黄色禁停边线与网状导向标线');
  paving.mesh(root,granite,'腾讯滨海大厦 · 广场与弯道人行道铺装');

  // Reuse the city's full tree models at these planting strips. Keep the front
  // of the monument open and leave gaps at the drop-off and at real crossings.
  grid.frontageTrees=[];
  along(street.p.slice(0,junction+5),8.4,3.2,(x,z,dx,dz,s)=>{
    for(const side of [-1,1]){
      if(mouth&&Math.hypot(x-mouth[0],z-mouth[1])<9)continue;
      const o=side<0?-5.3:8.2;grid.frontageTrees.push([x-dz*o,z+dx*o,5.9+1.2*Math.sin(s/15)]);
    }
  });
  for(const p of [[-1495,-1304,8],[-1489,-1320,8],[-1464,-1280,6.5],[-1482,-1283,7.4],[-1476,-1337,6.6],[-1464,-1357,7.7],[-1455,-1390,6.6]])grid.frontageTrees.push(p);
}

