import * as T from 'three';
import {Surface,Instances,Grid,area,along,bounds,random,ribbon,sideWall} from './city-geometry.js';
import {specialBuildings} from './city-landmarks.js';
import {streetStops} from './city-transit.js';
import {trafficSignals} from './traffic-signals.js';
import {signalFixtures} from './signal-fixtures.js';
import {districtDetails} from './city-district-details.js';
import {houhaiElevations,surveyHouhai} from './houhai-waterfront.js';
import {isTidalSail} from './tidal-square.js';
import {cultureSquare} from './city-culture-square.js';
import {parkBuilding} from './park-buildings.js';
import {buildStarLandings} from './star-landings.js';
import {roadProfiles,surfaceRoadOffset} from './road-profiles.js';
import {viaducts} from './viaducts.js';
import {tencentFrontage} from './tencent-frontage.js';
import {streetJunctions} from './street-junctions.js';
import {markBuildingFacade,cityFacadeMesh} from './city-lightshow.js';
import {parkBridgeIds} from './park-bridges.js';
import {roofPlantSite,supportsRoofSetback} from './roof-layout.js';

const walking=new Set(['footway','path','pedestrian','steps','cycleway']);
export function roadHeight(r){
  if(r.layer<0)return -.75;
  if(walking.has(r.kind))return r.bridge?2.4:.246;
  if(r.bridge||r.layer>0)return .28+5.3*Math.max(1,r.layer||1);
  return .28;
}
function tint(c,x=.9){return new T.Color(c).multiplyScalar(x);}
function shopfronts(surface,walkway,frames,columns,building,start,height,rand){
  const ring=area(building.p)>0?building.p:building.p.slice().reverse();
  for(let i=0;i<ring.length;i++){
    const [x,z]=ring[i],[ex,ez]=ring[(i+1)%ring.length],dx=ex-x,dz=ez-z,length=Math.hypot(dx,dz);
    if(length<.2)continue;
    const nx=dz/length,nz=-dx/length,angle=Math.atan2(dx,dz),bays=Math.max(1,Math.round(length/(3.7+rand()*1.1)));
    const unit=length/bays,depth=2.6+rand();
    walkway.quad([x,.172,z],[ex,.172,ez],[ex+nx*depth,.172,ez+nz*depth],[x+nx*depth,.172,z+nz*depth],[[0,0],[length/3,0],[length/3,depth/3],[0,depth/3]]);
    const variation=Math.floor(rand()*8);
    for(let j=0;j<bays;j++){
      const ax=x+dx*j/bays,az=z+dz*j/bays,bx=x+dx*(j+1)/bays,bz=z+dz*(j+1)/bays;
      const type=(variation+j*3+Math.floor(j/4))%8,side=j%4===3&&bays>2;
      const lo=-type*.125-.001,hi=-(type+1)*.125+.001,v=side?.705:.995;
      // Recess the display surface between the structural piers. The jambs and
      // soffit stay visible when the player walks obliquely past a shop.
      const pocket=side?.38:.82,rearX=-nx*pocket,rearZ=-nz*pocket;
      // Outside wall faces run A->B left-to-right; with frontage.repeat.x = -1, [hi -> lo] renders forward.
      surface.quad([ax+rearX,start,az+rearZ],[ax+rearX,height,az+rearZ],[bx+rearX,height,bz+rearZ],[bx+rearX,start,bz+rearZ],[[hi,.005],[hi,v],[lo,v],[lo,.005]]);
      columns.at(ax+rearX*.5,(height+start)/2,az+rearZ*.5,pocket+.06,height-start,.20,angle);
      frames.at((ax+bx+rearX)/2,height-.09,(az+bz+rearZ)/2,pocket+.27,.16,unit,angle);
      if(!side){
        const entryX=ax+dx/bays*.62,entryZ=az+dz/bays*.62;
        frames.at(entryX+rearX*.8,1.18,entryZ+rearZ*.8,.09,.47,.028,angle);
      }
      if(unit>2.8){
        columns.at(ax+nx*.08,(height+start)/2,az+nz*.08,.41,height-start,.27,angle);
        const midX=(ax+bx)*.5,midZ=(az+bz)*.5;
        frames.at(midX+nx*.42,height-.08,midZ+nz*.42,1.05,.17,unit+.04,angle);
        if(side)frames.at(midX+nx*.08,height-.28,midZ+nz*.08,.19,.45,unit,angle);
      }
    }
  }
}
export function cityBlocks(root,map,m,grid){
  surveyHouhai(map);
  const waterfront=houhaiElevations(root,m);
  const detail=districtDetails(root,m);
  const galleryUpper=map.buildings.find(f=>f.id===570468706);
  if(galleryUpper){galleryUpper.minH=4.55;galleryUpper.h=8.8;}
  const chunks=new Map(),plant=new Instances(new T.BoxGeometry(1,1,1),m.curb,'屋顶设备'),lids=new Instances(new T.BoxGeometry(1,1,1),m.dark,'通风机顶盖');
  const roofAntennas=new Instances(new T.CylinderGeometry(.54,1,1,5),m.rail,'天线');
  const awnings=new Instances(new T.BoxGeometry(1,1,1),m.rail,'店铺雨棚');
  const storefrontWalk=new Surface(),headers=new Instances(new T.BoxGeometry(1,1,1),m.dark,'商铺檐口'),columns=new Instances(new T.BoxGeometry(1,1,1),m.curb,'街廊立柱');
  const col=new T.Color(),roofCol=new T.Color();
  for(const f of map.buildings){
    const b=f.bbox=bounds(f.p),cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2;
    if(isTidalSail(f.id)){f.minH=3.9;f.h=6.3;continue;}
    if(!f.minH||f.minH<1.85)grid.buildings.add(f,b);
    if(waterfront.detail(f))continue;
    if(specialBuildings.has(Math.abs(Number(f.id)))||f===galleryUpper||parkBuilding(root,f,m,galleryUpper))continue;
    const key=Math.floor(cx/1350)+','+Math.floor(cz/1350);let c=chunks.get(key);
    if(!c)chunks.set(key,c={walls:Array.from({length:6},()=>new Surface()),shop:new Surface(),roof:new Surface(),base:new Surface()});
    const rand=random(Math.abs(f.id)),h=Math.max(2.4,f.h),start=Math.max(0,f.minH||0),dist=Math.hypot(cx,cz);
    if(h<=start+.1)continue;
    const isRes=/house|apartments|dorm|residential/.test(f.kind);
    const inCoastal=cx>-1580&&cx<-1040&&cz>-960&&cz<-550;
    let type=isRes?4:/commercial|office|retail|hotel/.test(f.kind)||h>65?rand()*3|0:3;
    if(!isRes&&h>90&&Math.abs(f.id)%4===0)type=5;
    if(f.material==='glass'||f.material==='mirror')type=[0,1,2,5][Math.abs(f.id)%4];
    if(f.material==='concrete'||f.material==='limestone')type=3;
    // Coastal City Mall & Poly Cultural Plaza are modern champagne-aluminum & glass malls, not dark brick blocks.
    if(inCoastal&&!isRes&&type===3)type=Math.abs(f.id)%2===0?0:2;
    if(Number(f.id)===529272469)type=1;
    // Each masonry material tile covers six window bays and six floors.
    const floors=Math.max(1,Math.round((h-start)/(isRes?3.05:3.65)));
    const scales=[[38,64],[13,13],[27,24],[19.8,6*(h-start)/floors],[21.6,6*(h-start)/floors],[57,62]];
    const [subdiv,repeatY]=scales[type];
    const colors=type<3?[0xd9ebef,0xbccfd5,0xd8e2df,0xe0cfc2,0xc2d3d3,0xb6c9d2]:[0xe5ded1,0xdae0de,0xd4c7ae,0xe4cfc1,0xcad6d3];
    col.setHex(colors[Math.floor(rand()*colors.length)]).multiplyScalar(.88+rand()*.15);
    if(inCoastal&&!isRes&&h<45)col.setHex(Math.abs(f.id)%2===0?0xe8e1d2:0xdce5e7);
    if(f.color&&/^#[a-f\d]{6}$/i.test(f.color))col.lerp(new T.Color(f.color),.28);
    const streetRetail=/retail|commercial/.test(f.kind)||(inCoastal&&!isRes&&h>=12&&h<=36);
    const retailEligible=start<.9 && streetRetail && h>3.3;
    const coastalUpperRetail=inCoastal&&!isRes&&h>=14&&h<=36&&(start>=5.5||start<.9);
    const ruifu=Number(f.id)===529272469;
    const shopH=ruifu?8.8:retailEligible?Math.min(h,Math.max(3.25,Math.min(h*.37,4.7))):start;
    if(shopH>start+.2&&!ruifu){
      if(streetRetail&&dist<2150)shopfronts(c.shop,storefrontWalk,headers,columns,f,start,shopH,rand);
      else sideWall(c.shop,f.p,start,shopH,shopH*6.2,shopH);
      markBuildingFacade(c.shop,f);
    }
    // Add lively 2nd-floor commercial storefronts directly facing the Coastal City skywalk deck (y = 6.25..10.55m)
    let wallStart=shopH;
    if(coastalUpperRetail&&!ruifu&&h>11.2){
      const deckFloor=6.25,deckShopTop=10.55;
      shopfronts(c.shop,storefrontWalk,headers,columns,f,deckFloor,deckShopTop,rand);
      markBuildingFacade(c.shop,f);
      if(start>=5.5)wallStart=deckShopTop;
    }
    detail.add(f,cx,cz,wallStart);
    let cap=f.p;
    const crownHeight=Math.min(8.3,h*.046);
    if(h>85&&h-crownHeight>wallStart&&!f.holes?.length&&f.p.length<55&&supportsRoofSetback(f.p,cx,cz)){
      const inset=1-Math.min(.095,1.6/Math.max(8,Math.min(b[2]-b[0],b[3]-b[1])));
      cap=f.p.map(([x,z])=>[cx+(x-cx)*inset,cz+(z-cz)*inset]);
      sideWall(c.walls[type],f.p,wallStart,h-crownHeight,subdiv,repeatY,col);
      // The set-back louvre screen and parapet articulate the mechanical floor.
      c.roof.polygon(f.p,[],h-crownHeight,9,new T.Color(0xafb7b4));
      sideWall(c.walls[type],cap,h-crownHeight,h,subdiv,repeatY*.36,col);
    }else sideWall(c.walls[type],f.p,wallStart,h,subdiv,repeatY,col);
    for(const ring of f.holes||[])sideWall(c.walls[type],ring,start,h,subdiv,repeatY,col);
    markBuildingFacade(c.walls[type],f);
    roofCol.setHex([0xbdbdb5,0xa1aaa7,0xc9bbad,0xbfc4ba][Math.floor(rand()*4)]);
    c.roof.polygon(cap,f.holes,h,9,roofCol);
    const w=b[2]-b[0],d=b[3]-b[1];
    if(dist<1700&&w>12&&d>12&&h>15&&!(f.holes?.length)){
      const rw=Math.min(w*(.13+rand()*.14),12),rd=Math.min(d*.18,10),rh=1.4+Math.min(3.2,h*.016);
      const site=roofPlantSite(cap,rw,rd);
      if(site){
        const [x,z]=site;
        plant.at(x,h+rh*.5,z,rw,rh,rd,0);lids.at(x,h+rh+.04,z,rw*.82,.12,rd*.75,0);
        if(h>75&&rand()>.50)roofAntennas.at(x+rw*.3,h+rh+1.9,z,.085,4,.085,0);
      }
    }
    if(!ruifu&&retailEligible&&dist<880&&f.p.length<28)for(let i=0;i<f.p.length;i++){
      const A=f.p[i],B=f.p[(i+1)%f.p.length],dx=B[0]-A[0],dz=B[1]-A[1],l=Math.hypot(dx,dz);
      if(l>5&&l<70)awnings.at((A[0]+B[0])/2,shopH-.43,(A[1]+B[1])/2,1.05,.13,l,Math.atan2(dx,dz));
    }
  }
  waterfront.finish();detail.finish();cultureSquare(root,m,map,grid);
  for(const c of chunks.values()){
    c.walls.forEach((s,i)=>cityFacadeMesh(s,root,m.walls[i],'城区立面 '+i));c.roof.mesh(root,m.roof,'建筑屋顶',true);
    cityFacadeMesh(c.shop,root,m.shop,'沿街商铺');
  }
  for(const q of [plant,lids,roofAntennas,awnings])q.flush(root,true);
  storefrontWalk.mesh(root,m.paving,'沿街橱窗前铺装');headers.flush(root,true,210);columns.flush(root,true,210);
}
export function streets(root,map,m,grid){
  const profiles=roadProfiles(map),layout=streetJunctions(map),elevated=viaducts(root,m,grid,map,layout);
  grid.profiles=profiles;grid.junctions=layout;
  const ramps=new Surface(),gutter=new Surface(),kerb=new Surface(),sidewalk=new Surface();
  const snowLanes=[];
  const asphalt=new Surface(),paths=new Surface(),curbs=new Surface(),bridges=new Surface(),runners=new Surface(),white=new Surface(),yellow=new Surface();
  for(const patch of layout.patches)asphalt.polygon(patch.ring,[],.277,5.5);
  for(let i=0;i<asphalt.uv.length;i++)snowLanes.push(0);
  const stripes=new Instances(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),m.paint,'车道划线');
  const poles=new Instances(new T.CylinderGeometry(1,1,1,7),m.curb,'桥墩');
  const rail=new Instances(new T.BoxGeometry(1,1,1),m.curb,'桥侧防撞墙');
  for(const rd of map.roads){
    if(rd.layer<0||rd.p.length<2||parkBridgeIds.has(rd.id))continue;
    const graded=profiles.get(rd);
    if(graded){elevated.add(rd,graded);continue;}
    const p=rd.p,w=rd.width||6,walk=walking.has(rd.kind),bridge=walk?Boolean(rd.bridge):(rd.bridge||rd.layer>0),y=roadHeight(rd),d=Math.hypot(...p[0]);
    const roadY=walk||bridge?y:y+surfaceRoadOffset(rd);
    const runs=walk||bridge?[]:layout.clearRuns(rd);
    const star=rd.id===562534109;
    if(star)grid.starLandings=buildStarLandings(root,map,rd,m,grid.southGround);
    const motor=/motorway|trunk|_link/.test(rd.kind);
    const lakeside=grid.flowerLandscape?.path;
    // All road segments share a spatial index with walking and tree clearance.
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],width=rd===lakeside?.road?(lakeside.widths.get(i)??w):w,pad=width*.5+3;
      grid.roads.add({a,b,width,y,rd,rampStart:bridge&&walk&&i===1,rampEnd:bridge&&walk&&i===p.length-1},[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]);
    }
    if(!walk&&!motor&&!bridge&&rd.kind!=='service'){
      const frontage=rd.id===1436530936||rd.id===1190795443;
      ribbon(curbs,p,w+(frontage?6.7:3),.2,4.8,frontage?1.85:0);
      if(d<3000&&w>=6){
        for(const side of [-1,1])for(const line of layout.clearRuns(rd,side)){
          ribbon(gutter,line,.36,roadY+.013,3.5,side*(w*.5-.21));
          ribbon(kerb,line,.18,y+.075,.82,side*(w*.5+.052));
          if(!frontage&&rd.id!==830807174)ribbon(sidewalk,line,1.32,y+.071,2.8,side*(w*.5+.81));
          for(let i=1;i<line.length;i++){
            const a=line[i-1],b=line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
            const nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len,off=side*(w*.5-.037);
            kerb.quad([a[0]+nx*off,roadY,a[1]+nz*off],[b[0]+nx*off,roadY,b[1]+nz*off],[b[0]+nx*off,y+.075,b[1]+nz*off],[a[0]+nx*off,y+.075,a[1]+nz*off]);
          }
        }
      }
    }
    const firstUV=asphalt.uv.length;
    if(rd===lakeside?.road){
      ribbon(paths,p.slice(0,lakeside.first+1),w,y,3.4);
      ribbon(paths,p.slice(lakeside.last),w,y,3.4);
    }else if(!star&&rd.id!==324949710&&rd.id!==537570364)ribbon(walk?(rd.kind==='cycleway'?runners:paths):asphalt,p,w,roadY,walk?3.4:5.5);
    if(!walk){
      const lanes=Math.max(1,rd.lanes||Math.round(w/3.3));
      for(let i=firstUV;i<asphalt.uv.length;i+=2)snowLanes.push(asphalt.uv[i]*5.5,w/lanes);
    }
    if(bridge){
      if(walk){
        // Grade each pedestrian approach up from the adjoining path. A smooth
        // threshold also lets a walker re-enter raised bridges from the park.
        for(const end of [0,p.length-1]){
          if(star&&grid.starLandings.ends.has(end))continue;
          const A=p[end],B=p[end===0?1:end-1],dx=A[0]-B[0],dz=A[1]-B[1],len=Math.hypot(dx,dz)||1;
          const run=15,nx=-dz/len*w*.5,nz=dx/len*w*.5,low=[A[0]+dx/len*run,A[1]+dz/len*run];
          ramps.quad([A[0]+nx,y,A[1]+nz],[low[0]+nx,.246,low[1]+nz],[low[0]-nx,.246,low[1]-nz],[A[0]-nx,y,A[1]-nz],[[0,0],[0,run/3.4],[w/3.4,run/3.4],[w/3.4,0]]);
          const pad=w*.5+.4;
          grid.roads.add({a:A,b:low,width:w,y,endY:.246,rd},[Math.min(A[0],low[0])-pad,Math.min(A[1],low[1])-pad,Math.max(A[0],low[0])+pad,Math.max(A[1],low[1])+pad]);
        }
      }
      if(star)continue; // The landmark mesh provides its own deck and piers.
      for(let i=1;i<p.length;i++){
        const a=p[i-1],b=p[i],vx=b[0]-a[0],vz=b[1]-a[1],len=Math.hypot(vx,vz);if(len<.1)continue;const nx=-vz/len,nz=vx/len;
        for(const side of [-1,1]){
          const ox=nx*w*.5*side,oz=nz*w*.5*side;
          bridges.quad([a[0]+ox,y-.49,a[1]+oz],[a[0]+ox,y,a[1]+oz],[b[0]+ox,y,b[1]+oz],[b[0]+ox,y-.49,b[1]+oz]);
          if(!walk)rail.at((a[0]+b[0])/2+ox,y+.32,(a[1]+b[1])/2+oz,.29,.67,len,Math.atan2(vx,vz));
        }
      }
      along(p,walk?24:34,13,(x,z)=>poles.at(x,y/2-.18,z,walk?.43:1.15,y-.36,walk?.45:1.15));
    }
    if(walk||w<5||rd.kind==='service')continue;
    const lanes=Math.min(6,Math.max(1,rd.lanes||Math.round(w/3.3)));
    for(const line of runs){
      const length=line.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-line[i][0],b[1]-line[i][1]),0);
      if(!rd.oneway&&w>7)ribbon(yellow,line,.12,roadY+.034,6);
      for(let l=1;l<lanes;l++){
        if(!rd.oneway&&l*2===lanes)continue;const off=-w*.5+w*l/lanes;
        along(line,10.1,2,(x,z,dx,dz,s)=>{if(s+1.7<length)stripes.at(x-dz*off,roadY+.034,z+dx*off,.115,1,3.4,Math.atan2(dx,dz));});
      }
    }
    if(w>=10||motor){
      for(const side of [-1,1])for(const line of layout.clearRuns(rd,side))
        ribbon(white,line,.12,roadY+.028,6,side*(w*.5-.32));
    }
  }
  grid.signals=trafficSignals(map);
  grid.updateSignals=signalFixtures(root,grid.signals,m,grid);
  streetStops(root,map,m,grid,stripes,layout);
  elevated.finish();
  tencentFrontage(root,map,m,grid,layout);
  ramps.mesh(root,m.path,'人行桥缓坡');gutter.mesh(root,m.gutter,'沥青排水沟边');kerb.mesh(root,m.kerb,'路缘花岗石');sidewalk.mesh(root,m.paving,'街角人行道铺装');
  const roadway=asphalt.mesh(root,m.asphalt,'沥青车道');
  roadway?.geometry.setAttribute('snowLane',new T.Float32BufferAttribute(snowLanes,2));
 curbs.mesh(root,m.paving,'城市人行道');paths.mesh(root,m.path,'人行步道');runners.mesh(root,m.running,'红色骑行道');
  bridges.mesh(root,m.curb,'桥板结构',true);white.mesh(root,m.paint,'白色路缘线');yellow.mesh(root,m.yellow,'道路中心线');
  for(const obj of [stripes,poles,rail])obj.flush(root,obj===poles,obj===rail||obj===poles?1100:590);
}
