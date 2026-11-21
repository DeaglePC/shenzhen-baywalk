import * as T from 'three';
import {Surface, Instances, area, along, sideWall, bounds} from './city-geometry.js';

// Plan outlines are from OSM. Section depths and the extent of the upper
// storey are estimated from the lighting designer's exterior photographs.
const library=571169618, gallery=570468705, beacon=562534106;
const white=0xe6e6df, graphite=0x313a3d;
const finish=(color,roughness,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness,side:T.DoubleSide});
const panels=(probe)=> {
  const m=new T.MeshPhysicalMaterial({color:0x657f83,metalness:.43,roughness:.12,clearcoat:1,clearcoatRoughness:.09,
    transparent:true,opacity:.51,side:T.FrontSide,depthWrite:false,envMapIntensity:1.12});
  m.userData.cityProbe=probe;
  m.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float incidence=1.-abs(dot(normal,normalize(vViewPosition)));
      diffuseColor.a=mix(diffuseColor.a*.83,.91,incidence*incidence);
      #include <opaque_fragment>`);
  };
  return m;
};
function inset(ring,width){
  return ring.map(([x,z],i)=>{
    const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
    const p=new T.Vector2(x-a[0],z-a[1]).normalize(),q=new T.Vector2(b[0]-x,b[1]-z).normalize();
    const k=width/Math.max(.3,1+p.dot(q));
    return [x-(p.y+q.y)*k,z+(p.x+q.x)*k];
  });
}
function smoothArcs(ring){
  return ring.flatMap((a,i)=>{const b=ring[(i+1)%ring.length];return [.22,.78].map(t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);});
}
function pavilion(group,f,m,isLibrary,upperFootprint){
  const ring=area(f.p)>0?f.p:f.p.slice().reverse(),outer=isLibrary?ring:smoothArcs(ring);
  const slabs=new Surface(),soffit=new Surface(),fascia=new Surface(),shadowBand=new Surface(),glass=new Surface();
  const trim=new Instances(new T.BoxGeometry(1,1,1),finish(graphite,.37,.45),'窗框及阳台栏杆');
  const cols=new Instances(new T.CylinderGeometry(1,1,1,24),finish(white,.43,.15),'外廊白色圆柱');
  const spots=new Instances(new T.CylinderGeometry(1,1,1,12),m.lamp,'檐底嵌灯');
  const core=new Surface(),shelves=new Instances(new T.BoxGeometry(1,1,1),finish(0xb8a080,.69),'室内书架与展台');
  const books=new Instances(new T.BoxGeometry(1,1,1),finish(0xffffff,.86),'书脊');
  const bookColors=[0x92786c,0x666d70,0x9c998a,0x647676,0xb0aa90].map(c=>new T.Color(c));
  function edge(ring,y,depth,width,inst){
    ring.forEach(([x,z],i)=>{const [bx,bz]=ring[(i+1)%ring.length];inst.at((x+bx)/2,y,(z+bz)/2,width,depth,Math.hypot(bx-x,bz-z)+.012,Math.atan2(bx-x,bz-z));});
  }
  function slab(plan,y,depth){
    const base=y-depth;
    soffit.polygon(plan,[],base);slabs.polygon(plan,[],y);
    sideWall(fascia,plan,base+.11,y);sideWall(shadowBand,plan,base,base+.11);
    along([...plan,plan[0]],1.62,1,(x,z,dx,dz)=>trim.at(x+dz*.008,y-depth*.43,z-dx*.008,.018,depth*.76,.009,Math.atan2(dx,dz)));
  }
  function storey(plan,base,top){
    const glazing=inset(plan,isLibrary?2.7:2.15);
    sideWall(glass,glazing,base,top);
    edge(glazing,base+.065,.13,.095,trim);edge(glazing,top-.085,.17,.1,trim);
    for(let i=0;i<glazing.length;i++){
      const a=glazing[i],b=glazing[(i+1)%glazing.length],dx=b[0]-a[0],dz=b[1]-a[1];
      const count=Math.max(1,Math.round(Math.hypot(dx,dz)/1.62));
      for(let j=0;j<count;j++)trim.at(a[0]+dx*j/count,(top+base)/2,a[1]+dz*j/count,.09,top-base,.051,Math.atan2(dx,dz));
    }
    const porch=inset(plan,.92);
    along([...porch,porch[0]],6.4,1.3,(x,z)=>cols.at(x,(base+top)/2,z,.19,top-base,.19));
    along([...porch,porch[0]],3.2,2.2,(x,z)=>spots.at(x,top-.015,z,.074,.023,.074));
    // A recessed service wall and objects behind clear glazing give the
    // windows independent reflections and parallax at footpath distance.
    const inside=inset(plan,isLibrary?6.1:4.3);
    if(isLibrary)sideWall(core,inset(plan,7.5),base,top);
    for(let i=0;i<inside.length;i++){
      const a=inside[i],b=inside[(i+1)%inside.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.2)continue;
      const angle=Math.atan2(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
      if(isLibrary&&len>10){
        for(let s=1.4;s<len-1.3;s+=3.5){const x=a[0]+dx*s,z=a[1]+dz*s;
          for(let j=0;j<4;j++){const y=base+.23+j*.37;shelves.at(x,y,z,.45,.052,2.15,angle);
            for(let k=0;k<10;k++){const t=-.91+k*.195,ht=.20+.08*(Math.abs(i+j+k)%3)/2;
              books.at(x+t*dx,y+.03+ht/2,z+t*dz,.22,ht,.15,angle,bookColors[(i*3+j+k*7)%bookColors.length]);}
          }
        }
      }
      if(i%4===0||isLibrary&&i===1)core.quad([a[0],base,a[1]],[a[0],top,a[1]],[b[0],top,b[1]],[b[0],base,b[1]]);
    }
  }
  const mezz=isLibrary?5.05:4.55,top=isLibrary?9.75:8.8;
  const topPlan=upperFootprint?.p;
  const upper=isLibrary?inset(outer,.6):topPlan?smoothArcs(area(topPlan)>0?topPlan:topPlan.slice().reverse()):inset(outer,1.7);
  slab(outer,.30,.13);storey(outer,.30,mezz-.42);slab(outer,mezz,.42);
  const balustrade=inset(outer,.17);
  edge(balustrade,mezz+1.02,.062,.054,trim);
  along([...balustrade,balustrade[0]],.16,.08,(x,z)=>trim.at(x,mezz+.52,z,.018,1.02,.021));
  storey(upper,mezz,top-.28);slab(upper,top,.28);
  f.h=top;soffit.mesh(group,finish(0xdcddd4,.54,.11),'挑檐底板');slabs.mesh(group,finish(0xb7bab4,.74),'平台与屋面',true);
  fascia.mesh(group,finish(0xc0c5c4,.35,.62),'银灰折边铝板',true);shadowBand.mesh(group,finish(0x586064,.49,.37),'檐口阴影缝');
  core.mesh(group,finish(isLibrary?0x9a8e79:0x888d85,.8),'室内实体隔墙',true);
  glass.mesh(group,panels(isLibrary?'library':'gallery'),'退后的通高玻璃');[trim,cols,shelves,spots,books].forEach(batch=>batch.flush(group,batch===cols));
}
function sailTower(group,f,m){
  const b=bounds(f.p),x=(b[0]+b[2])/2,z=(b[1]+b[3])/2;
  const skin=new Surface(),treads=new Surface(),rims=new Surface(),outer=new Surface(),deck=new Surface();
  const ribs=new Instances(new T.CylinderGeometry(1,1,1,8),m.rail,'帆塔外圈细钢肋');
  const point=(radius,angle,y)=>[x+radius*Math.cos(angle),y,z+radius*Math.sin(angle)];
  const ring=(r,y)=>Array.from({length:80},(_,i)=>{const v=point(r,i*Math.PI/40,y);return [v[0],v[2]];});
  for(let j=0;j<7;j++){const y=.19+j*.15,r=8.5-j*.52;treads.polygon(ring(r,y),[],y);sideWall(rims,ring(r,y),y-.15,y);}
  const floor=1.1,slant=a=>12.05+2.90*Math.cos(a+.30),r=y=>2.34+(y-floor)*.095;
  for(let i=0;i<80;i++){
    const a=i*Math.PI/40,aa=(i+1)*Math.PI/40,ya=slant(a),yb=slant(aa);
    if(i%2===0)ribs.between(...point(r(floor),a,floor),...point(r(ya),a,ya),.041);
    outer.quad(point(r(ya),a,ya-.075),point(r(ya),a,ya),point(r(yb),aa,yb),point(r(yb),aa,yb-.075));
    for(const y of [3.45,6.3,9.05])outer.quad(point(r(y),a,y-.035),point(r(y),a,y+.035),point(r(y),aa,y+.035),point(r(y),aa,y-.035));
  }
  sideWall(skin,ring(1.98,0),floor,10.82);sideWall(deck,ring(2.84,0),10.55,11.13);deck.polygon(ring(2.84,0),[],11.13);
  const stair=new Instances(new T.BoxGeometry(1,1,1),m.cream,'塔内螺旋楼梯');
  for(let j=0;j<49;j++){const a=j*.255;stair.at(x+Math.cos(a)*1.10,floor+j*.194,z+Math.sin(a)*1.10,.99,.10,.44,-a);}
  stair.flush(group,true);ribs.flush(group,true);treads.mesh(group,m.curb,'环形石阶');rims.mesh(group,m.dark,'踏步踢面');
  skin.mesh(group,panels('bridge'),'帆塔内层玻璃');outer.mesh(group,m.rail,'倾斜帆缘及环箍');deck.mesh(group,m.cream,'塔顶圆台',true);f.h=14.95;
}
export function parkBuilding(root,f,m,upperFootprint){
  if(![library,gallery,beacon].includes(f.id))return false;
  const group=new T.Group();group.name=f.name;root.add(group);
  if(f.id===beacon)sailTower(group,f,m);else pavilion(group,f,m,f.id===library,upperFootprint);
  return true;
}
