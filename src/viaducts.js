import * as T from 'three';
import {Surface,Instances,Grid,clamp,inArea,segmentDistance} from './city-geometry.js';
import {atStation,surfaceRoadOffset} from './road-profiles.js';
import {photo} from './city-materials.js';
import {districtDecks} from './district-decks.js';
import {navigationSpan,northernBayWays} from './bay-alignment.js';
import {skywalkHeight} from './walk-deck-data.js';

const point=(p,off,dy)=>[p.x+p.nx*off,p.y+dy,p.z+p.nz*off];
function strip(surface,a,b,ao,ai,bo,bi,ah=0,al=ah,bh=ah,bl=al,scale=4){
  surface.quad(point(a,ao,ah),point(b,bo,bh),point(b,bi,bl),point(a,ai,al),
    [[ao/scale,a.s/scale],[bo/scale,b.s/scale],[bi/scale,b.s/scale],[ai/scale,a.s/scale]]);
}
function bridgeConcrete(color){
  const mat=new T.MeshStandardMaterial({color,roughness:.94,side:T.DoubleSide,map:photo('concrete.webp')});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 concretePoint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 castPos=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        castPos=instanceMatrix*castPos;
      #endif
      concretePoint=(modelMatrix*castPos).xyz;
      #include <project_vertex>`);
    shader.fragmentShader='varying vec3 concretePoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 face=abs(cross(dFdx(concretePoint),dFdy(concretePoint)));
      vec2 uv=face.y>max(face.x,face.z)?concretePoint.xz:face.x>face.z?concretePoint.zy:concretePoint.xy;
      float aggregate=dot(texture2D(map,uv*.34).rgb,vec3(.21,.71,.08));
      diffuseColor.rgb*=.80+.42*aggregate;
    `);
  };return mat;
}

function photoSpot(root,p){
  const c=document.createElement('canvas');c.width=768;c.height=512;const g=c.getContext('2d');
  g.strokeStyle='#279bd6';g.lineWidth=11;g.strokeRect(12,12,744,488);
  g.fillStyle='#ac915b';g.beginPath();g.arc(384,255,76,0,Math.PI*2);g.fill();
  g.strokeStyle='#5e5037';g.lineWidth=3;g.beginPath();g.arc(384,255,68,0,Math.PI*2);g.stroke();
  g.strokeRect(362,225,44,26);g.beginPath();g.arc(384,238,8,0,Math.PI*2);g.stroke();
  g.fillStyle='#423828';g.textAlign='center';g.font='bold 17px "Microsoft YaHei",sans-serif';g.fillText('深圳打卡点',384,278);
  g.font='9px Arial';g.fillText('SHENZHEN PHOTO SPOT',384,295);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const mesh=new T.Mesh(new T.PlaneGeometry(3.15,2.05).rotateX(-Math.PI/2),
    new T.MeshStandardMaterial({map:texture,alphaTest:.38,roughness:.74,polygonOffset:true,polygonOffsetFactor:-2}));
  mesh.name='后海大桥西侧人行道 · 深圳打卡点';mesh.receiveShadow=true;
  mesh.position.fromArray(point(p,p.width/2+1.94,.158));
  mesh.rotation.y=Math.atan2(p.nz,-p.nx)+Math.PI/2;root.add(mesh);
}
function limits(p,profile){
  const w=p.width/2,f=profile.family;
  return f?[-w-.09,w+1.35+(f.outer-f.width/2-1.35)*p.blend]:[-w-.22,w+.22];
}

// The paired ways have different vertices and different ramp lengths. Cut both
// inside kerbs at common longitudinal stations before spanning the reservation.
function fillMedian(ways,median,underside,grid){
  if(ways.size!==2)return;
  const [[road,left],[,right]]=[...ways];
  const [a,b]=[road.p[0],road.p.at(-1)],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
  function edge(profiles){
    const pts=profiles.flatMap(p=>p.points.map(v=>{const [x,y,z]=point(v,-v.width*.5-.08,0);
      return {x,y,z,s:(x-a[0])*dx+(z-a[1])*dz};})).sort((u,v)=>u.s-v.s);
    return pts.filter((v,i)=>!i||v.s>pts[i-1].s+.01);
  }
  const L=edge(left),R=edge(right);
  function at(line,s){
    const i=line.findIndex(v=>v.s>=s),b=line[i<0?line.length-1:i],a=line[Math.max(0,(i<0?line.length-1:i)-1)];
    const t=(s-a.s)/(b.s-a.s||1);return [a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t];
  }
  const lo=Math.max(L[0].s,R[0].s,-118),hi=Math.min(L.at(-1).s,R.at(-1).s,len+118);
  const stations=[...new Set([lo,hi,...L.concat(R).map(p=>p.s).filter(s=>s>lo+.03&&s<hi-.03)])].sort((a,b)=>a-b);
  let prev;
  for(const s of stations){
    const l=at(L,s),r=at(R,s),width=Math.hypot(l[0]-r[0],l[2]-r[2]);
    const row={l,r,s,width};
    if(prev&&width<16&&prev.width<16&&s-prev.s>.005){
      const pts=[prev.l,l,r,prev.r],uv=[[0,prev.s/3],[0,s/3],[width/3,s/3],[prev.width/3,prev.s/3]];
      const shifted=h=>pts.map(([x,y,z])=>[x,y+h,z]);
      median.quad(...shifted(.17),uv);underside.quad(...shifted(-.37),uv);
      const center=(l,r)=>[(l[0]+r[0])/2,(l[2]+r[2])/2],A=center(prev.l,prev.r),B=center(l,r),pad=Math.max(width,prev.width)/2+.3;
      grid.roads.add({a:A,b:B,width:pad*2-.6,y:(prev.l[1]+prev.r[1])/2+.17,endY:(l[1]+r[1])/2+.17,rd:road,graded:true,solid:true,foot:true,depth:.55},
        [Math.min(A[0],B[0])-pad,Math.min(A[1],B[1])-pad,Math.max(A[0],B[0])+pad,Math.max(A[1],B[1])+pad]);
    }
    prev=row;
  }
}

export function viaducts(root,m,grid,map,layout=null){
  const deck=new Surface(),underside=new Surface(),parapet=new Surface(),wall=new Surface(),joints=new Surface(),
    asphalt=new Surface(),pavement=new Surface(),median=new Surface(),lines=new Surface(),yellow=new Surface();
  const lanes=[],box=new T.BoxGeometry(1,1,1);
  const corridors=new Map();
  const urbanWalkGrid=new Grid(24),pendingUrbanGuards=[];
  const concrete=bridgeConcrete(0xb6b2a8),shaded=bridgeConcrete(0x9b9a92);
  const metal=new T.MeshStandardMaterial({color:0x9caaaa,metalness:.65,roughness:.4});
  const pillars=new Instances(new T.CylinderGeometry(1,1,1,16),concrete,'高架桥墩柱');
  const caps=new Instances(box,concrete,'桥墩盖梁'),bearings=new Instances(box,m.dark,'桥梁橡胶支座');
  const rail=new Instances(new T.CylinderGeometry(1,1,1,8),metal,'桥边金属栏杆');
  const feet=new Instances(box,metal,'临水栏杆立柱'),studs=new Instances(box,m.paint,'护栏反光标');
  const drains=new Instances(box,m.dark,'桥面集水口'),grates=new Instances(box,metal,'泄水口铸铁箅条');
  const shaft=new Instances(new T.CylinderGeometry(.58,1,1,12),metal,'桥面锥形路灯立杆');
  const lamps=new Instances(box,m.dark,'桥面道路灯头');
  const lightMat=new T.MeshStandardMaterial({color:0xf1ead8,emissive:0xffdfa8});
  m.parkLights.finish(lightMat,2.4);
  const lenses=new Instances(box,lightMat,'桥面灯具透镜');
  grid.bridgePiers=new Grid(48);
  const platforms=grid.platforms=districtDecks(root,map,m,grid);
  function collision(a,b,lo,hi,base,width,rd,solid=false,foot=false,clipEnds=false){
    const d=(lo+hi)*.5,A=point(a,d,0),B=point(b,d,0),pad=width*.5+1;
    grid.roads.add({a:[A[0],A[2]],b:[B[0],B[2]],width,y:a.y+base,endY:b.y+base,rd,graded:true,solid,foot,
      rampStart:clipEnds,rampEnd:clipEnds,depth:solid?Math.min(1.5,width*.117):0},
      [Math.min(A[0],B[0])-pad,Math.min(A[2],B[2])-pad,Math.max(A[0],B[0])+pad,Math.max(A[2],B[2])+pad]);
  }
  function barrier(a,b,x,y,sign,height=1){
    const face=(wa,ha,wb,hb)=>strip(parapet,a,b,x+sign*wa,x+sign*wb,y+sign*wa,y+sign*wb,ha*height,hb*height);
    face(-.24,.02,-.20,.32);face(-.20,.32,-.095,.66);face(-.095,.66,-.095,.82);
    face(-.095,.82,.11,.82);face(.11,.82,.15,.02);
  }
  function guard(profile,start,end,offset,skip=null){
    const at=s=>{const p=atStation(profile,s);return {p,x:offset(p)};};
    for(let s=start;s<end-.01;s+=2.1){
      const sEnd=Math.min(end,s+2.1);
      if(skip&&skip(s,sEnd))continue;
      const a=at(s),b=at(sEnd),v=point(a.p,a.x,.68),yaw=Math.atan2(a.p.nz,-a.p.nx);
      feet.at(v[0],v[1],v[2],.085,1.03,.082,yaw);
      for(const h of [.41,.69,1.17]){
        const A=point(a.p,a.x,h),B=point(b.p,b.x,h);
        rail.between(...A,...B,h>1?.045:.021);
      }
      const mid=at((s+sEnd)/2),vMid=point(mid.p,mid.x,.75);
      feet.at(vMid[0],vMid[1],vMid[2],.045,.74,.035,yaw);
    }
  }
  // Emit a surface strip split at street junctions on low/at-grade segments so
  // sidewalks and edge lines never cut across intersecting side streets.
  function clearSubStrip(profile,rd,a,b,side,emit){
    if(!layout||Math.max(a.y,b.y)>=.85){emit(a,b);return;}
    const len=b.s-a.s;
    if(len<.05)return;
    const steps=Math.max(1,Math.ceil(len/2.0));
    let prev=a;
    for(let k=1;k<=steps;k++){
      const next=k===steps?b:atStation(profile,a.s+len*k/steps);
      if(layout.isClear(rd,(prev.s+next.s)*.5,side))emit(prev,next);
      prev=next;
    }
  }
  function surfaceLift(rd,y){
    if(y>=.85)return 0;
    return surfaceRoadOffset(rd)*(1-clamp((y-.28)/.55,0,1));
  }
  function urbanGuardBlocked(rd,profile,s0,s1,side){
    const sm=(s0+s1)*.5,pm=atStation(profile,sm);
    if(pm.y<=.68)return true;
    const hw=pm.width*.5;
    const edgeOff=side*(hw-.08),outOff=side*(hw+.38);
    const probes=[
      point(pm,edgeOff,0),
      point(pm,outOff,0),
      point(atStation(profile,s0),outOff,0),
      point(atStation(profile,s1),outOff,0)
    ];
    for(const [x,y,z] of probes){
      if(Math.abs(y-skywalkHeight)<1.4&&platforms.areaAt(x,z))return true;
      if(grid.buildings.query(x,z).some(b=>y>(b.minH||0)-.2&&y<(b.h||3)+.2&&inArea(x,z,b)))return true;
      for(const seg of urbanWalkGrid.query(x,z)){
        if(seg.rd===rd)continue;
        if(segmentDistance(x,z,seg.a,seg.b)>=seg.w+.68)continue;
        const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1];
        const u=clamp(((x-seg.a[0])*dx+(z-seg.a[1])*dz)/(dx*dx+dz*dz||1),0,1);
        const otherY=seg.y0+(seg.y1-seg.y0)*u;
        if(Math.abs(y-otherY)<1.45)return true;
      }
    }
    return false;
  }
  function pier(p,width,headDepth=1.72){
    const yaw=Math.atan2(p.nz,-p.nx),bottom=-1.5,capY=p.y-headDepth;
    for(const offset of width>8?[-width*.225,width*.225]:[0]){
      const [x,,z]=point(p,offset,0),r=Math.max(.48,Math.min(.88,width*.062));
      pillars.at(x,(bottom+capY)/2,z,r,capY-bottom,r,yaw);
      grid.bridgePiers.add({x,z,r,top:capY},[x-r-.5,z-r-.5,x+r+.5,z+r+.5]);
      bearings.at(x,capY+.57,z,.82,.22,.94,yaw);
    }
    caps.at(p.x,capY+.19,p.z,width*.79,.67,1.22,yaw);
  }
  function lamp(p,offset){
    const [x,base,z]=point(p,offset,.16),h=8.7,yaw=Math.atan2(p.nz,-p.nx);
    shaft.at(x,base+h/2,z,.13,h,.13,yaw);
    const to=offset>0?-1:1,A=point(p,offset+to*1.05,h+.1),B=point(p,offset+to*2.65,h+.26);
    rail.between(x,base+h-.75,z,...A,.065);rail.between(...A,...B,.048);
    lamps.at(B[0],B[1],B[2],.65,.15,.26,yaw);lenses.at(B[0],B[1]-.083,B[2],.54,.026,.19,yaw);
    if(Math.hypot(x,z)<850)m.parkLights.fixture(B[0],B[1]-.13,B[2],0xffddb2,120,23);
  }
  function add(rd,profile){
    const original=profile.points,extra=profile.urban?platforms.splitAtEdges(profile):[];
    const pts=extra.length?[...original,...extra.map(s=>atStation(profile,s))].sort((a,b)=>a.s-b.s).filter((p,i,v)=>!i||p.s-v[i-1].s>.001):original;
    const flatBridge=!!profile.flatBridge,physical=!!profile.level&&!flatBridge,cityBridge=!!profile.family;
    const isSide=profile.side,laneCount=Math.max(1,Math.min(7,rd.lanes||Math.round(rd.width/3.35)));
    if(cityBridge){
      const {road,deck}=profile.family,ways=corridors.get(deck)??new Map(),list=ways.get(road)??[];
      list.push(profile);ways.set(road,list);corridors.set(deck,ways);
    }
    // The mapped side paths on Houhai Bridge share its structural deck and sidewalks.
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],wa=a.width/2,wb=b.width/2;
      if(profile.foot){
        if(profile.urban){
          const pad=Math.max(wa,wb)+1.2;
          urbanWalkGrid.add({rd,a:[a.x,a.z],b:[b.x,b.z],w:Math.max(wa,wb),y0:a.y,y1:b.y},
            [Math.min(a.x,b.x)-pad,Math.min(a.z,b.z)-pad,Math.max(a.x,b.x)+pad,Math.max(a.z,b.z)+pad]);
        }
        if(profile.urban&&Math.min(a.y,b.y)>6.1&&platforms.areaAt((a.x+b.x)/2,(a.z+b.z)/2))continue;
        collision(a,b,-wa,wa,0,rd.width,rd,profile.urban,true,profile.urban||rd.kind==='steps');
        if(isSide)continue;
        if(rd.kind!=='steps'||Math.abs(b.y-a.y)<.025)
          strip(pavement,a,b,wa,-wa,wb,-wb,.005,.005,.005,.005,2.4);
        for(const side of [-1,1])strip(wall,a,b,wa*side,wa*side,wb*side,wb*side,0,Math.max(-.42,.06-a.y),0,Math.max(-.42,.06-b.y));
        if(profile.urban&&Math.max(a.y,b.y)>.70){
          strip(underside,a,b,wa,-wa,wb,-wb,-.42);
          if(rd.kind!=='steps')for(const side of [-1,1])pendingUrbanGuards.push({rd,profile,s0:a.s,s1:b.s,side,inset:.08});
        }
        continue;
      }
      const [ai,ao]=limits(a,profile),[bi,bo]=limits(b,profile);
      const la=surfaceLift(rd,a.y),lb=surfaceLift(rd,b.y);
      strip(asphalt,a,b,wa,-wa,wb,-wb,la,la,lb,lb,4.7);
      for(const [u,p] of [[a.width,a],[b.width,b],[0,b],[0,a]])lanes.push(u,p.width/laneCount);
      collision(a,b,-wa,wa,0,Math.max(a.width,b.width),rd,physical);
      const raised=Math.max(a.y,b.y)>.38;
      if(raised){
        const da=Math.min(1.36,a.y+.35),db=Math.min(1.36,b.y+.35);
        strip(deck,a,b,ao,ai,bo,bi,-.092);
        for(const [sa,sb,sign] of [[ao,bo,1],[ai,bi,-1]]){
          strip(deck,a,b,sa,sa,sb,sb,-.09,-.38);
          strip(underside,a,b,sa,sa-sign*.96,sb,sb-sign*.96,-.38,-da,-.38,-db);
          if(!physical)strip(wall,a,b,sa-sign*.28,sa-sign*.28,sb-sign*.28,sb-sign*.28,-.31,.025-a.y,-.31,.025-b.y,3);
        }
        strip(underside,a,b,ao-.96,ai+.96,bo-.96,bi+.96,-da,-da,-db,-db);
      }else if(flatBridge){
        // Slim flat bridge slab over narrow urban canals without towering viaduct walls.
        strip(deck,a,b,ao,ai,bo,bi,-.08);
        for(const [sa,sb] of [[ao,bo],[ai,bi]])strip(deck,a,b,sa,sa,sb,sb,-.08,-.42);
        strip(underside,a,b,ao,ai,bo,bi,-.42);
      }
      if(cityBridge&&raised){
        strip(pavement,a,b,ao,wa,bo,wb,.15,.15,.15,.15,2.4);
        strip(deck,a,b,wa,wa,wb,wb,.15,0);
        strip(deck,a,b,-wa,-wa, -wb,-wb,0,.19);
        strip(deck,a,b,-wa,-wa-.17,-wb,-wb-.17,.19);
        const sidewalk=(ao-wa+bo-wb)/2;
        if(sidewalk>.2)collision(a,b,wa,ao,.15,sidewalk,rd,physical,true);
      }else if(physical){
        for(const sign of [-1,1])barrier(a,b,sign*(wa-.04),sign*(wb-.04),sign);
      }else if(!flatBridge&&!/trunk|motorway|_link/.test(rd.kind)&&rd.kind!=='service'){
        for(const sign of [-1,1])clearSubStrip(profile,rd,a,b,sign,(u,v)=>{
          const wu=u.width/2,wv=v.width/2;
          strip(pavement,u,v,sign*(wu+1.35),sign*wu,sign*(wv+1.35),sign*wv,.072);
        });
      }
      if(rd.width>=5&&rd.kind!=='service'){
        if(rd.oneway||rd.width>=10)for(const sign of [-1,1]){
          const off=cityBridge?.39:.24;
          clearSubStrip(profile,rd,a,b,sign,(u,v)=>{
            const wu=u.width/2,wv=v.width/2,lu=surfaceLift(rd,u.y)+.024,lv=surfaceLift(rd,v.y)+.024;
            strip(lines,u,v,sign*(wu-off),sign*(wu-off-.13),sign*(wv-off),sign*(wv-off-.13),lu,lu,lv,lv);
          });
        }
        if(!rd.oneway&&rd.width>7)clearSubStrip(profile,rd,a,b,0,(u,v)=>{
          const lu=surfaceLift(rd,u.y)+.028,lv=surfaceLift(rd,v.y)+.028;
          strip(yellow,u,v,.07,-.07,.07,-.07,lu,lu,lv,lv);
        });
      }
    }
    if(profile.foot){
      if(profile.urban&&rd.kind!=='steps'){
        for(let s=9;s<profile.length;s+=20){
          const p=atStation(profile,s);
          if(!platforms.areaAt(p.x,p.z)&&!platforms.onRoad(p.x,p.z,1)&&p.y>2.7)pier(p,p.width,1.10);
        }
      }
      if(!isSide&&rd.kind==='steps'){
        for(let i=1;i<pts.length;i++){
          const from=pts[i-1],to=pts[i],dy=to.y-from.y;if(Math.abs(dy)<.025)continue;
          if(profile.urban&&platforms.areaAt((from.x+to.x)/2,(from.z+to.z)/2)&&Math.min(from.y,to.y)>6.1)continue;
          const steps=Math.ceil(Math.abs(dy)/.15);
          for(let j=0;j<steps;j++){
            const a=atStation(profile,from.s+(to.s-from.s)*j/steps),b=atStation(profile,from.s+(to.s-from.s)*(j+1)/steps),w=a.width/2;
            const top=Math.max(a.y,b.y)+.006;
            strip(pavement,a,b,w,-w,w,-w,top-a.y,top-a.y,top-b.y,top-b.y,1.8);
            const lower=a.y<b.y?a:b;
            deck.quad(point(lower,w,.005),point(lower,-w,.005),point(lower,-w,top-lower.y),point(lower,w,top-lower.y));
          }
          for(const side of [-1,1])pendingUrbanGuards.push({rd,profile,s0:from.s,s1:to.s,side,inset:.085});
        }
      }
      return;
    }
    if(rd.kind!=='service'&&rd.width>=5){
      for(let s=2;s<profile.length-.7;s+=10){
        const stop=Math.min(profile.length,s+3.7);
        if(layout&&atStation(profile,(s+stop)*.5).y<.85&&!layout.isClear(rd,(s+stop)*.5,0))continue;
        const cuts=[atStation(profile,s),...pts.filter(p=>p.s>s&&p.s<stop),atStation(profile,stop)];
        for(let j=1;j<cuts.length;j++)for(let i=1;i<laneCount;i++){
          if(!rd.oneway&&2*i===laneCount)continue;
          const a=cuts[j-1],b=cuts[j],oa=(i/laneCount-.5)*(a.width-.68),ob=(i/laneCount-.5)*(b.width-.68);
          const la=surfaceLift(rd,a.y)+.028,lb=surfaceLift(rd,b.y)+.028;
          strip(lines,a,b,oa+.075,oa-.075,ob+.075,ob-.075,la,la,lb,lb);
        }
      }
    }
    if(flatBridge&&rd.bridge&&profile.length>6){
      const trim=Math.min(2.2,profile.length*.15);
      for(const side of [-1,1]){
        guard(profile,trim,profile.length-trim,p=>side*(p.width/2+.08),
          (s0,s1)=>layout&&!layout.isClear(rd,(s0+s1)*.5,side));
      }
    }
    if(physical){
      const bay=northernBayWays.has(rd.id),spans=Math.max(1,Math.round(profile.length/(bay?75:cityBridge?30:32)));
      for(let i=0;i<spans;i++){
        const s=(i+.5)*profile.length/spans,p=atStation(profile,s);
        if(p.y>2.6&&(!bay||!navigationSpan(p.z,Math.abs(p.nx))))pier(p,p.width);
      }
      for(let i=0;i<=spans;i+=Math.max(1,Math.round(spans/3))){
        const s=Math.min(profile.length-.13,i*profile.length/spans+.04),a=atStation(profile,s),b=atStation(profile,s+.085);
        strip(joints,a,b,a.width/2,-a.width/2,b.width/2,-b.width/2,.011);
      }
      const lampCount=Math.max(1,Math.round(profile.length/31)),spacing=profile.length/lampCount;
      for(let s=spacing/2;s<profile.length;s+=spacing){
        const p=atStation(profile,s);lamp(p,cityBridge?p.width/2+.42:p.width/2-.08);
      }
      if(cityBridge){
        // The two bank seats close the end of the box girder against the
        // approach fill. The longitudinal walls continue down either side.
        for(const p of [pts[0],pts.at(-1)]){
          const [inner,outer]=limits(p,profile),[x,,z]=point(p,(inner+outer)/2,0);
          const height=p.y-1.29,yaw=Math.atan2(p.nz,-p.nx);
          caps.at(x,height*.5,z,outer-inner-.48,height,1.15,yaw);
          const A=point(p,inner+.28,0),B=point(p,outer-.28,0);
          grid.roads.add({a:[A[0],A[2]],b:[B[0],B[2]],width:1.15,y:p.y,endY:p.y,rd,graded:true,solid:false},
            [Math.min(A[0],B[0])-1,Math.min(A[2],B[2])-1,Math.max(A[0],B[0])+1,Math.max(A[2],B[2])+1]);
        }
        for(let s=7;s<profile.length;s+=15){
          const p=atStation(profile,s),yaw=Math.atan2(p.nz,-p.nx),offset=p.width*.5-.17;
          const [x,y,z]=point(p,offset,.011);drains.at(x,y,z,.23,.022,.60,yaw);
          for(let k=-3;k<=3;k++)grates.at(x+p.nz*k*.074,y+.016,z-p.nx*k*.074,.22,.012,.025,yaw);
        }
        if(rd.id===232498913){
          photoSpot(root,atStation(profile,profile.length*.51));
          for(const d of [18,47,77])for(const shift of [0,.42,.84]){
            const s=profile.length-d+shift,a=atStation(profile,s),b=atStation(profile,s+.14);
            strip(yellow,a,b,a.width/2-.52,-a.width/2+.52,b.width/2-.52,-b.width/2+.52,.026);
          }
        }
      }
      if(cityBridge){
        const first=pts[0],last=pts.at(-1),dx=(last.x-first.x)/profile.length,dz=(last.z-first.z)/profile.length;
        const entries=profile.family.access.map(([x,z])=>(x-first.x)*dx+(z-first.z)*dz).sort((a,b)=>a-b);
        let from=0;
        for(const s of entries){guard(profile,from,s-1.65,p=>limits(p,profile)[1]-.13);from=s+1.65;}
        guard(profile,from,profile.length,p=>limits(p,profile)[1]-.13);
      }
      else for(let s=4;s<profile.length;s+=8){
        const p=atStation(profile,s),yaw=Math.atan2(p.nz,-p.nx);
        for(const side of [-1,1]){
          const [x,y,z]=point(p,side*(p.width/2-.20),.63);
          studs.at(x,y,z,.035,.086,.18,yaw);
        }
      }
    }else if(cityBridge){
      const bridgeStartsHere=pts[0].y>pts.at(-1).y;
      const firstLamp=profile.family.lampSpacing/2;
      for(let d=firstLamp;d<profile.length;d+=31){
        const p=atStation(profile,bridgeStartsHere?d:profile.length-d);
        if(p.y>.48)lamp(p,p.width/2+.42);
      }
      // Continue the outside railing down the actual road, stopping only once it reaches shore level.
      let start=null;
      for(let i=0;i<pts.length;i++){
        if(pts[i].y>1.15&&start===null)start=pts[i].s;
        if(start!==null&&(pts[i].y<=1.15||i===pts.length-1)){guard(profile,start,pts[i].s,p=>limits(p,profile)[1]-.13);start=null;}
      }
    }
  }
  function finish(){
    for(const {rd,profile,s0,s1,side,inset} of pendingUrbanGuards){
      guard(profile,s0,s1,p=>side*(p.width/2-inset),(a,b)=>urbanGuardBlocked(rd,profile,a,b,side));
    }
    for(const ways of corridors.values())fillMedian(ways,median,underside,grid);
    const road=asphalt.mesh(root,m.asphalt,'高架沥青车道与引道');
    road?.geometry.setAttribute('snowLane',new T.Float32BufferAttribute(lanes,2));
    pavement.mesh(root,m.paving,'桥上人行道与引道铺装');
    median.mesh(root,new T.MeshStandardMaterial({map:m.grass.map,color:0x85805c,roughness:1,side:T.DoubleSide}),'中央分隔带园林草地');
    lines.mesh(root,m.paint,'高架道路车道划线');yellow.mesh(root,m.yellow,'高架道路中心线');
    deck.mesh(root,concrete,'高架桥面翼缘与路缘石',true);underside.mesh(root,shaded,'箱梁腹板与桥底',true);
    wall.mesh(root,concrete,'引道混凝土挡墙',true);parapet.mesh(root,concrete,'混凝土防撞护栏',true);
    joints.mesh(root,m.dark,'桥面伸缩缝');
    for(const part of [pillars,caps,bearings,shaft,lamps,lenses,feet,rail,studs,drains,grates])part.flush(root,part===pillars||part===caps||part===shaft,part===studs||part===grates?180:1200);
  }
  return {add,finish};
}

