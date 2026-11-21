import * as T from 'three';
import {Surface, Instances, along, area, bounds, inRing, sideWall} from './city-geometry.js';
import {curtainWall, architecturalMetal, bayStone} from './city-curtainwall.js';
import {label,photo} from './city-materials.js';
import {bamboo} from './city-bamboo.js';
import {buildStadium} from './city-stadium.js';
import {starBridge} from './city-starbridge.js';
import {cultureIDs} from './city-culture-square.js';

const t7Parts=[1274780082,1274780083,1274780084];
const bayTowers=[571169610,571169616,571169612,571169614,571169595,571169597,571169593];
const bayPodiums=[8129656,571169602,571169604,571169606,571169608];
export const specialBuildings = new Set([529272473,665408865,665408866,665408867,9244350,9244351,...cultureIDs,736632011,...t7Parts,...bayTowers,...bayPodiums]);

const clearTint=new T.Color(0xf4f4f1), coolTint=new T.Color(0xc9d5dc);
function wallFace(surface,a,b,c,d,color,offset=0) {
  const length=Math.hypot(c[0]-b[0],c[2]-b[2]);
  surface.quad(a,b,c,d,[[offset,a[1]],[offset,b[1]],[offset+length,c[1]],[offset+length,d[1]]],color);
}
function belt(surface,low,high,color) {
  let u=0;
  for(let i=0;i<low.length;i++){
    const j=(i+1)%low.length;
    wallFace(surface,low[i],high[i],high[j],low[j],color,u);
    u+=Math.hypot(low[i][0]-low[j][0],low[i][2]-low[j][2]);
  }
}
function ledge(surface,inside,outside) {
  for(let i=0;i<inside.length;i++){
    const j=(i+1)%inside.length;
    surface.quad(inside[i],inside[j],outside[j],outside[i]);
  }
}
function cap(surface,ring) {
  surface.polygon(ring.map(p=>[p[0],p[2]]),[],ring[0][1],1);
}
function raised(points,y){return points.map(([x,z])=>[x,y,z]);}

function bayCentralTower(parts,s) {
  const p=parts.flatMap(f=>f.p),xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);
  const left=Math.min(...xs),right=Math.max(...xs),north=Math.min(...zs),south=Math.max(...zs);
  const cx=(left+right)/2,cz=(north+south)/2,h=parts[0].h;
  const sx=(right-left)/2,sz=(south-north)/2;
  // Concave short faces in KPF's plan between the two full-height outer frames.
  const plan=[[-1,-1],[-.82,-.97],[-.49,-.914],[0,-.90],[.49,-.914],[.82,-.97],[1,-1],
    [1,-.79],[.963,-.78],[.963,.78],[1,.79],[1,1],[.82,.97],[.49,.914],[0,.90],
    [-.49,.914],[-.82,.97],[-1,1],[-1,.79],[-.963,.78],[-.963,-.78],[-1,-.79]];
  const curtainFaces=new Set([8,19]),stoneFaces=new Set([6,7,9,10,17,18,20,21]);
  function point(x,z,y,out=0) {
    const t=y/h,wx=sx*(1-.175*t),wz=sz*(1-.15*t);
    return [cx+x*(wx+out),y,cz+z*(wz+out)];
  }
  function ring(y,out=0){return plan.map(([x,z])=>point(x,z,y,out));}
  const upper=h-15.9, step=(upper-7.8)/69;
  const elevationUV=(bottom,top)=>s.elevationUV.push(1,bottom,1,top,0,top,0,bottom);
  let base=ring(.22);
  for(let k=0;k<=69;k++){
    const y=k===0?7.8:7.8+k*step,top=ring(y);
    const service=[16,31,44,63].includes(k);
    let u=0;
    for(let i=0;i<plan.length;i++){
      const j=(i+1)%plan.length;
      const structure=stoneFaces.has(i);
      const surface=i===8?s.east:structure?s.stone:s.office;
      wallFace(surface,base[i],top[i],top[j],base[j],structure?null:curtainFaces.has(i)?clearTint:coolTint,u);
      if(i===8)elevationUV(.935*(base[i][1]-.22)/(upper-.22),.935*(y-.22)/(upper-.22));
      u+=Math.hypot(top[j][0]-top[i][0],top[j][2]-top[i][2]);
    }
    const width=service?1.04:k<2?.86:.32;
    const bot=ring(y-width,.15),rim=ring(y,.15);
    for(let i=0;i<plan.length;i++){
      if(stoneFaces.has(i))continue;
      const j=(i+1)%plan.length;
      wallFace(service?s.shadow:s.stone,bot[i],rim[i],rim[j],bot[j]);
      if(service){
        const lip=ring(y-.32,.21);
        wallFace(s.trim,lip[i],rim[i],rim[j],lip[j]);
      }
    }
    ledge(s.soffit,top,rim);
    base=top;
  }
  cap(s.soffit,ring(upper+.05));
  // The occupied sky hall is set back. It leaves daylight below two long
  // bridge-like parapets, as seen on the waterfront elevation.
  const skyPlan=[[-.77,-.79],[.77,-.79],[.77,.79],[-.77,.79]];
  const hallRing=y=>skyPlan.map(([x,z])=>point(x,z,y));
  const hallBase=hallRing(upper),hallTop=hallRing(upper+7.35);
  for(let i=0;i<4;i++){const j=(i+1)%4;
    wallFace(i===1?s.east:s.office,hallBase[i],hallTop[i],hallTop[j],hallBase[j],coolTint);
    if(i===1)elevationUV(.935,1);
  }
  cap(s.soffit,hallTop);
  for(const side of [-1,1]){
    function rail(x,z,y){return point(x*side,z,y);}
    const topY=z=>h-(z+1)*.70;
    for(const zsign of [-1,1]){
      const pier=[[.81,zsign*.87],[1,zsign*.85],[1,zsign],[.81,zsign*.977]];
      if(side*zsign<0)pier.reverse();
      const foot=pier.map(([x,z])=>rail(x,z,upper));
      const head=pier.map(([x,z])=>rail(x,z,topY(z)));
      belt(s.stone,foot,head);cap(s.stone,head);
    }
    const footprint=[[.88,-.975],[1,-.98],[1,.98],[.88,.975]];
    if(side<0)footprint.reverse();
    const high=footprint.map(([x,z])=>rail(x,z,topY(z)));
    const low=footprint.map(([x,z])=>rail(x,z,topY(z)-2.5));
    belt(s.trim,low,high);s.soffit.quad(...low);s.stone.quad(...high);
  }
}

function bayNeighbour(f,s,office) {
  const ring=area(f.p)>0?f.p:f.p.slice().reverse();
  const n=ring.length,h=f.h;
  const cx=ring.reduce((v,p)=>v+p[0],0)/n,cz=ring.reduce((v,p)=>v+p[1],0)/n;
  const levels=Math.max(8,Math.round((h-9)/(office?4.1:4.38))),floor=(h-9)/levels;
  const edges=ring.map((a,i)=>{
    const b=ring[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
    return {a,b,l,nx:dz/l,nz:-dx/l};
  });
  // Continuous edge coordinates meet at each mapped corner. Angled outer
  // balcony edges leave the rectilinear glazed living spaces recessed.
  const samples=[0,.13,.15,.44,.66,.68,.87];
  function floorRing(y,type,group) {
    const points=[];
    edges.forEach(({a,b,nx,nz},i)=>{
      for(const [j,t] of samples.entries()){
        let x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t);
        const e=Math.max(0,nx),side=Math.abs(nz);
        const bay=group%2?1:0;
        const outer=[0,.38,.44,.94,1,.24,.18][j]*(5.40+bay*1.25);
        const inner=[0,.12,.26,.56,.68,.09,.05][j]*(2.7+bay*.9);
        if(type==='wall'){
          x=cx+(x-cx)*(office?.97:.913);z=cz+(z-cz)*(office?.97:.913);
          if(!office){x+=nx*inner*e;z+=nz*inner*e;}
        }else if(!office){
          const corner=nx>.42?e*outer:side*Math.sin(Math.PI*t)*2.4*(i%2?t:1-t);
          const projection=corner*(type==='guard'?.97:1);
          const radial=type==='guard'?.988:1.009;
          x=cx+(x-cx)*radial+nx*projection;z=cz+(z-cz)*radial+nz*projection;
        }
        points.push([x,y,z]);
      }
    });
    return points;
  }
  const mat=office?s.office:s.homes;
  belt(mat,floorRing(.22,'wall',0),floorRing(7.1,'wall',0),clearTint);
  for(let l=0;l<levels;l++){
    const y=7.1+l*floor,top=y+floor,group=Math.floor(l/7)+(f.id%2);
    const lip=office?.34:.56;
    const line=floorRing(y,'edge',group),up=floorRing(y+lip,'edge',group),glass=floorRing(y,'wall',group);
    belt(mat,glass,floorRing(top,'wall',group),clearTint);
    belt(s.stone,line,up);ledge(s.soffit,glass,line);ledge(s.stone,floorRing(y+lip,'wall',group),up);
    if(!office){
      const lo=floorRing(y+lip,'guard',group),hi=floorRing(y+1.55,'guard',group);
      for(let i=0;i<line.length;i++){
        const edge=edges[Math.floor(i/samples.length)],j=(i+1)%line.length;
        if(edge.nx<-.52||i%samples.length===1&&edge.nx<.43)continue;
        wallFace(s.guards,lo[i],hi[i],hi[j],lo[j]);
        const f0=[hi[i][0],hi[i][1]+.065,hi[i][2]],f1=[hi[j][0],hi[j][1]+.065,hi[j][2]];
        wallFace(s.trim,hi[i],f0,f1,hi[j]);
      }
      // The structure at the two ends of the large terrace runs between
      // floors behind the low, clear glass balustrades.
      for(let i=0;i<glass.length;i++){
        const edge=edges[Math.floor(i/samples.length)];
        if(edge.nx<.48||![1,4].includes(i%samples.length))continue;
        const j=(i+1)%line.length;
        wallFace(s.stone,glass[i],[glass[i][0],top,glass[i][2]],[glass[j][0],top,glass[j][2]],glass[j]);
      }
    }
  }
  const terrace=h-1.9,topRing=floorRing(terrace,'edge',0);
  belt(s.stone,topRing,floorRing(terrace+.52,'edge',0));cap(s.soffit,floorRing(terrace+.52,'edge',0));
  const pent=ring.map(([x,z])=>[cx+(x-cx)*.73,cz+(z-cz)*.73]);
  sideWall(s.shadow,pent,terrace+.52,h,1,1);cap(s.soffit,raised(pent,h));
  for(const e of edges){
    const a=e.a,b=e.b,tx=(b[0]-a[0])/e.l,tz=(b[1]-a[1])/e.l;
    const start=office?.08:e.nx>.52?.71:.08,end=office?.92:e.nx>.52?.97:e.nx<-.55?.58:.42;
    const count=Math.max(2,Math.round(e.l*(end-start)/1.18));
    for(let j=0;j<=count;j++){
      const t=T.MathUtils.lerp(start,end,j/count);
      const x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t);
      const inner=[x+e.nx*.07,7.2,z+e.nz*.07],outer=[x+e.nx*.64+tx*.16,7.2,z+e.nz*.64+tz*.16];
      const edge=[outer[0]+tx*.17,7.2,outer[2]+tz*.17];
      wallFace(s.soffit,inner,[inner[0],terrace,inner[2]],[outer[0],terrace,outer[2]],outer);
      wallFace(s.trim,outer,[outer[0],terrace,outer[2]],[edge[0],terrace,edge[2]],edge);
    }
  }
}

function bayRetail(f,s) {
  const base=area(f.p)>0?f.p:f.p.slice().reverse();
  const halls=[8129656,571169608].includes(Math.abs(f.id));
  const floors=halls?3:5,roof=halls?16.2:f.h,step=roof/floors;
  // KPF documents three outdoor retail levels. This 5.4 m retail storey
  // is an estimate; the shared map feature also drives flight/rain queries.
  if(halls)f.h=roof;
  const rings=[base,...(f.holes||[])];
  for(const r of rings){
    const [x0,z0,x1,z1]=bounds(r),cx=(x0+x1)/2,cz=(z0+z1)/2;
    let last=base;
    for(let j=1;j<=floors;j++){
      const y=j*step;
      const inset=halls?0:j===4?.16:j===5?.09:0;
      const level=r.map(([x,z])=>[cx+(x-cx)*(1-inset),cz+(z-cz)*(1-inset)]);
      sideWall(s.homes,level,Math.max(.18,(j-1)*step),y-1.05,1,1,clearTint);
      sideWall(s.shadow,level,y-.91,y-.75,1,1);
      sideWall(s.stone,level,y-.75,y,1,1);
      sideWall(s.trim,level,y-1.05,y-.91,1,1);
      if(!halls&&j>=4)ledge(s.soffit,raised(level,(j-1)*step),raised(last,(j-1)*step));
      last=level;
    }
    if(!halls)s.soffit.polygon(last,[],roof,1);
  }
  if(halls)s.soffit.polygon(base,f.holes||[],roof,1);
}
function bayGardens(podiums,towers,s) {
  // KPF's site plan and the AECOM courtyard photographs show linear paths
  // and elongated beds overlooking the three open retail levels.
  const main=podiums.find(f=>Math.abs(f.id)===8129656);if(!main)return;
  const court=main.holes?.[0],plazas=podiums.filter(f=>[8129656,571169608].includes(Math.abs(f.id)));
  function layBeds(ring,y,exclusions,spacing,width) {
    const [x0,z0,x1,z1]=bounds(ring),inside=p=>inRing(...p,ring)&&!exclusions.some(r=>inRing(...p,r));
    for(let z=z0+6;z<z1-4;z+=spacing){
      for(let x=x0+4;x<x1-6;x+=19.3){
        const r=[[x,z],[x+14.7,z+1.4],[x+14.1,z+width],[x-1.3,z+width-1.2]];
        if(!r.every(inside)||!inside([x+7,z+width*.5]))continue;
        sideWall(s.stone,r,y+.03,y+.5,1,1);s.lawns.polygon(r,[],y+.50,4,new T.Color('#c6d6aa'));
        const hedge=[r[0],[x+13.8,z+1.18],[x+13.7,z+1.82],[x-.17,z+.76]];
        sideWall(s.leaves,hedge,y+.49,y+1.03,1,1);s.leaves.polygon(hedge,[],y+1.04,1);
      }
    }
  }
  const blocks=towers.concat(podiums.filter(f=>f!==main&&Math.abs(f.id)!==571169608)).map(f=>f.p);
  for(const f of plazas)layBeds(f.p,f.h,[...blocks,...(f.holes||[])],10.1,3.8);
  if(court){
    s.pavers.polygon(court,[],.182,3);layBeds(court,.182,[],13.7,8);
  }
}
function oneShenzhenBay(root,map,m) {
  const byId=new Map();
  for(const f of map.buildings){const id=Math.abs(Number(f.id));if(specialBuildings.has(id))byId.set(id,f);}
  const s=Object.fromEntries(['office','east','homes','stone','guards','soffit','shadow','trim','lawns','leaves','pavers'].map(k=>[k,new Surface()]));
  s.elevationUV=[];
  const parts=t7Parts.map(id=>byId.get(id)).filter(Boolean);
  if(parts.length===3)bayCentralTower(parts,s);
  for(const id of bayTowers)if(byId.has(id))bayNeighbour(byId.get(id),s,id===bayTowers[0]);
  const podiums=bayPodiums.map(id=>byId.get(id)).filter(Boolean);
  for(const f of podiums)bayRetail(f,s);
  bayGardens(podiums,[...parts,...bayTowers.map(id=>byId.get(id)).filter(Boolean)],s);
  const g=new T.Group();g.name='深圳湾一号 · 八座塔楼与临水商业';root.add(g);
  const office=curtainWall('bayOffice'),homes=curtainWall('bayHome');m.walls.push(office,homes);
  if(s.east.indices.length){
    const east=curtainWall('bayOffice'),image=photo('t7-east-elevation.webp');
    image.wrapS=image.wrapT=T.ClampToEdgeWrapping;
    const glaze=east.onBeforeCompile;
    east.onBeforeCompile=shader=>{
      glaze(shader);shader.uniforms.eastSurvey={value:image};
      shader.vertexShader='attribute vec2 elevationCoord; varying vec2 eastUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neastUv=elevationCoord;');
      shader.fragmentShader='uniform sampler2D eastSurvey; varying vec2 eastUv;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
        vec3 measured=texture2D(eastSurvey,eastUv).rgb / vec3(.462,.527,.571);
        diffuseColor.rgb*=mix(vec3(1.),clamp(measured,vec3(.19),vec3(2.35)),.85);
        #include <alphatest_fragment>`);
    };
    east.customProgramCacheKey=()=>'t7-east-photo-v1';m.walls.push(east);
    const shell=s.east.mesh(g,east,'T7临湖面 · 实拍窗格、百叶与鹏瑞标识',true);
    shell.geometry.setAttribute('elevationCoord',new T.Float32BufferAttribute(s.elevationUV,2));
  }
  const glass=new T.MeshPhysicalMaterial({color:0x9bb1b1,metalness:.19,roughness:.14,transparent:true,opacity:.23,depthWrite:false,clearcoat:.89,side:T.DoubleSide});
  glass.userData.cityProbe='district';
  s.office.mesh(g,office,'T7与T1 · 超白单元式幕墙',true);s.homes.mesh(g,homes,'住宅与商业步廊的内退玻璃',true);
  s.stone.mesh(g,bayStone(),'横向石材挂板、层间阳台与冠框',true);
  s.soffit.mesh(g,new T.MeshStandardMaterial({color:0x8c8c80,roughness:.72,side:T.DoubleSide}),'阳台底板、露台与屋面');
  s.shadow.mesh(g,m.dark,'T7设备层与公寓屋顶');
  s.trim.mesh(g,architecturalMetal(0xaeb2af,.31),'卧室方向竖向遮阳翼、窗台与设备百叶');
  s.guards.mesh(g,glass,'临湾露台玻璃栏板');
  s.lawns.mesh(g,m.grass,'内院与商业露台种植池');s.pavers.mesh(g,m.paving,'内院游径');
  s.leaves.mesh(g,new T.MeshStandardMaterial({color:0x495f3c,roughness:.98,side:T.DoubleSide}),'露台修剪绿篱');
}

function mesh(parent,geo,mat,x,y,z,name){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function parkStructures(root,roads,m){
  const rail=new Instances(new T.CylinderGeometry(1,1,1,6),m.rail,'湖桥不锈钢扶手');
  roads.forEach(rd=>{
    if(Number(rd.id)===562534109){starBridge(root,rd,m);return;}
    if(Number(rd.id)!==570468707)return;
    const p=rd.p,w=2.35,deck=2.4;
    for(const side of [-1,1]){
      for(let k=1;k<p.length;k++){
        const A=p[k-1],B=p[k],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*w*.5*side,oz=dx/L*w*.5*side;
        for(const dy of [.53,1.12])rail.between(A[0]+ox,deck+dy,A[1]+oz,B[0]+ox,deck+dy,B[1]+oz,.047);
      }
      along(p,2.65,.4,(x,z,dx,dz)=>{const ox=-dz*w*.5*side,oz=dx*w*.5*side;rail.between(x+ox,deck,z+oz,x+ox,deck+1.14,z+oz,.045);});
    }
  });
  rail.flush(root);
  const board=new T.MeshStandardMaterial({map:label('深圳人才公园','SHENZHEN TALENT PARK',1024,'#355147'),roughness:.77});
  const boardBack=new T.MeshStandardMaterial({color:0x61665b});
  // Monument at the west gates, facing visitors approaching from the road.
  const panel=mesh(root,new T.BoxGeometry(.32,1.7,7.6),[boardBack,board,boardBack,boardBack,boardBack,boardBack],-454,1.25,223,'西入口园名标识');
  panel.rotation.y=-.13;
}
export function landmarks(group,map,m){
  bamboo(group,m);oneShenzhenBay(group,map,m);parkStructures(group,map.roads,m);
  return buildStadium(group,m,map);
}

