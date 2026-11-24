import * as T from 'three';
import {Grid,Instances,Surface,bounds,inArea,inRing,segmentDistance,clamp,random} from './city-geometry.js';
import {skywalkFootprints,skywalkHeight,viewingPiers,coastalUpper} from './walk-deck-data.js';
import {footRoad} from './road-profiles.js';
import {photo} from './city-materials.js';

function harbourBrick(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d'),rand=random(7342);g.fillStyle='#847d71';g.fillRect(0,0,512,512);
  // Paired stretcher and header, stepped on a 2:1 herringbone bond.
  for(let i=-1;i<17;i++)for(let j=-2;j<18;j++){
    const k=((i+j)%4+4)%4;if(k!==0&&k!==2)continue;
    const horizontal=k===0,x=i*32,y=j*32;
    const shades=['#a58170','#ac8978','#b2917f','#9a7669','#ad8c7f','#a28c7d'];
    g.fillStyle=shades[Math.floor(rand()*shades.length)];
    g.fillRect(x+1,y+1,horizontal?62:30,horizontal?30:62);
  }
  for(let i=0;i<19000;i++){g.fillStyle=rand()<.5?'#503b3220':'#dfd3c122';g.fillRect(rand()*512,rand()*512,1.5,1.5);}
  const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  return new T.MeshStandardMaterial({map,roughness:.93,side:T.DoubleSide});
}
function clipAt(vertices,line,keepPositive){
  const result=[];
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],da=line(a),db=line(b);
    if(keepPositive?da>=0:da<=0)result.push(a);
    if(da*db<0){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return result;
}
function slabFaces(deck,top,bottom){
  const shape=new Surface();shape.polygon(deck.p,deck.holes);
  for(let i=0;i<shape.indices.length;i+=3){
    const tri=shape.indices.slice(i,i+3).map(n=>[shape.p[n*3],shape.p[n*3+2]]);
    const cut=p=>deck.station(p[0],p[1])-deck.pier.shoreToDeck;
    const faces=deck.pier&&tri.some(p=>cut(p)>0)&&tri.some(p=>cut(p)<0)?[clipAt(tri,cut,false),clipAt(tri,cut,true)]:[tri];
    for(const face of faces){
      const base=top.p.length/3,low=bottom.p.length/3;
      for(const [x,z] of face){
        const y=deck.height(x,z);top.vertex([x,y,z],[x/(deck.pier?2.8:4),z/(deck.pier?2.8:4)]);
        bottom.vertex([x,y-deck.depth,z],[x/5,z/5]);
      }
      for(let k=1;k<face.length-1;k++){top.indices.push(base,base+k,base+k+1);bottom.indices.push(low,low+k+1,low+k);}
    }
  }
}
function segmentBox(a,b,r){return [Math.min(a[0],b[0])-r,Math.min(a[1],b[1])-r,Math.max(a[0],b[0])+r,Math.max(a[1],b[1])+r];}

export function districtDecks(root,map,m,grid){
  const areas=new Grid(48),edges=new Grid(18),roads=new Grid(32),approaches=new Grid(24),decks=[];
  const sky=new Surface(),brick=new Surface(),soffit=new Surface(),fascia=new Surface(),band=new Surface(),glazing=new Surface();
  const box=new T.BoxGeometry(),tube=new T.CylinderGeometry(1,1,1,8),metal=m.rail;
  const rail=new Instances(tube,metal,'海岸连廊不锈钢扶手'),rod=new Instances(tube,m.dark,'观海栈桥水平栏杆');
  const fin=new Instances(box,m.dark,'观海栈桥弯折栏柱'),cap=new Surface();
  const shoe=new Instances(box,m.curb,'观海栈桥挡水坎'),base=new Instances(box,m.dark,'栏板地脚槽');
  const posts=new Instances(box,metal,'商业连廊栏板夹柱'),column=new Instances(box,m.curb,'步行平台方形墩柱');
  const piles=new Instances(new T.CylinderGeometry(1,1,1,16),m.curb,'海上栈桥桩柱'),beam=new Instances(box,m.curb,'平台板下横梁');
  const lampMat=m.parkLights.finish(new T.MeshStandardMaterial({color:0xffefd4,emissive:0xffdfaf}),2.7);
  const spots=new Instances(new T.CylinderGeometry(1,1,1,12),lampMat,'步行街桥底嵌灯');
  const rims=new Instances(new T.CylinderGeometry(1,1,1,12),m.dark,'桥底嵌灯装饰圈');
  const noticeCanvas=document.createElement('canvas');noticeCanvas.width=384;noticeCanvas.height=224;
  const text=noticeCanvas.getContext('2d');text.fillStyle='#a23c29';text.fillRect(0,0,384,224);
  text.textAlign='center';text.fillStyle='#fff0df';text.font='bold 36px "Microsoft YaHei",sans-serif';
  ['保护生态','爱护自然','请勿在此垂钓'].forEach((line,i)=>text.fillText(line,192,62+i*56));
  const noticeMap=new T.CanvasTexture(noticeCanvas);noticeMap.colorSpace=T.SRGBColorSpace;noticeMap.anisotropy=8;
  const signs=new Instances(new T.PlaneGeometry(),new T.MeshStandardMaterial({map:noticeMap,roughness:.76,side:T.DoubleSide}),'观海栈桥护栏提示牌');
  const glass=new T.MeshStandardMaterial({color:0xa4cbc6,metalness:.19,roughness:.26,transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide});
  const upperNodes=new Set(map.roads.filter(r=>footRoad(r)&&coastalUpper(r)&&r.kind!=='steps').flatMap(r=>r.p.map(p=>p[0]+','+p[1])));
  for(const rd of map.roads){
    const foot=footRoad(rd),stair=rd.kind==='steps'&&rd.p.some(p=>upperNodes.has(p[0]+','+p[1])),upper=foot&&(coastalUpper(rd)||stair);
    if(!upper&&(foot||rd.layer>0||rd.bridge))continue;
    for(let i=1;i<rd.p.length;i++){
      const a=rd.p[i-1],b=rd.p[i],w=rd.width/2;
      (upper?approaches:roads).add({rd,a,b,w},segmentBox(a,b,w+1.3));
    }
  }
  const areaAt=(x,z)=>areas.query(x,z).find(d=>inArea(x,z,d));
  const highAt=(x,z)=>areas.query(x,z).some(d=>!d.pier&&inRing(x,z,d.p));
  const onRoad=(x,z,r)=>roads.query(x,z).some(s=>segmentDistance(x,z,s.a,s.b)<s.w+r);
  const building=(x,z)=>grid.buildings.query(x,z).some(b=>inArea(x,z,b));
  for(const shape of map.decks){
    const pier=viewingPiers.get(shape.id);if(!pier&&!skywalkFootprints.has(shape.id))continue;
    const station=(x,z)=>pier?(x-pier.entry[0])*pier.axis[0]+(z-pier.entry[1])*pier.axis[1]:0;
    const height=pier?(x,z)=>.246+1.85*clamp(station(x,z)/pier.shoreToDeck,0,1):()=>skywalkHeight;
    const d={...shape,pier,station,height,bbox:bounds(shape.p),depth:pier ? .68 : .88};
    decks.push(d);areas.add(d,d.bbox);
  }
  function railSection(d,a,b,opening){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const n=Math.ceil(len/(d.pier?1.65:1.85)),ux=dx/len,uz=dz/len,yaw=Math.atan2(ux,uz);
    const A=i=>[a[0]+dx*i/n,a[1]+dz*i/n];
    for(let i=0;i<n;i++){
      const p=A(i),q=A(i+1),x=(p[0]+q[0])/2,z=(p[1]+q[1])/2,y=d.height(x,z),h=d.height(...p),j=d.height(...q);
      if(opening(x,z))continue;
      const outward=inArea(x-uz*.45,z+ux*.45,d)?1:-1,nx=uz*outward,nz=-ux*outward;
      const ra=d.pier?.12:.06,pa=[p[0]-nx*ra,p[1]-nz*ra],pb=[q[0]-nx*ra,q[1]-nz*ra];
      edges.add({a:pa,b:pb,d},segmentBox(pa,pb,.35));
      if(d.pier){
        shoe.at(x,y+.094,z,.41,.19,len/n+.012,yaw);
        for(const v of [.39,.63,.87,1.08])rod.between(pa[0],h+v,pa[1],pb[0],j+v,pb[1],.023);
        // A broad top rail and bent stanchions follow the photographed seaward edge.
        const r=pa[0],s=pa[1];
        fin.at(r,h+.37,s,.087,.43,.082,yaw);
        rod.between(r,h+.56,s,r+nx*.095,h+.96,s+nz*.095,.052);
        rod.between(r+nx*.095,h+.96,s+nz*.095,r+nx*.16,h+1.28,s+nz*.16,.05);
        const corner=(p,y,off)=>[p[0]+nx*off,y,p[1]+nz*off];
        for(const [l,lh,r,rh] of [[-.115,1.356,.115,1.356],[.115,1.356,.115,1.264],[-.115,1.264,-.115,1.356],[.115,1.264,-.115,1.264]])
          cap.quad(corner(p,h+lh,l),corner(q,j+lh,l),corner(q,j+rh,r),corner(p,h+rh,r));
        if(d.pier===viewingPiers.get(473291441)&&i===Math.floor(n/2)&&len>15&&Math.floor(d.station(x,z)/17)%4===0){
          signs.at(x-nx*.21,y+.76,z-nz*.21,.59,.35,1,Math.atan2(-nx,-nz));
          for(const off of [-.21,.21]){
            const px=x+ux*off,pz=z+uz*off;rod.between(px-nx*.195,y+.64,pz-nz*.195,px,y+.64,pz,.014);
          }
        }
      }else{
        posts.at(pa[0],h+.62,pa[1],.054,1.19,.075,yaw);
        base.at(x,y+.11,z,.11,.19,len/n,yaw);
        glazing.quad([pa[0],h+.18,pa[1]],[pb[0],j+.18,pb[1]],[pb[0],j+1.09,pb[1]],[pa[0],h+1.09,pa[1]]);
        rail.between(pa[0],h+1.15,pa[1],pb[0],j+1.15,pb[1],.045);
      }
    }
  }
  // Slice the whole deck (and its openings) into pier rows. On the commercial
  // street supports are placed outside carriageways, including below side arms.
  function supports(d){
    const yaw=d.pier?Math.atan2(d.pier.axis[0],d.pier.axis[1]):1.45;
    const dx=Math.sin(yaw),dz=Math.cos(yaw),nx=-dz,nz=dx,project=p=>p[0]*dx+p[1]*dz;
    const ext=d.p.map(project),spacing=d.pier?17:19;
    for(let s=Math.min(...ext)+spacing/2;s<Math.max(...ext);s+=spacing){
      const hits=[];
      for(const ring of [d.p,...(d.holes??[])]){
        for(let i=0;i<ring.length;i++){
          const a=ring[i],b=ring[(i+1)%ring.length],u=project(a),v=project(b);
          if((u>s)===(v>s))continue;
          const t=(s-u)/(v-u);
          hits.push((a[0]+(b[0]-a[0])*t)*nx+(a[1]+(b[1]-a[1])*t)*nz);
        }
      }
      hits.sort((a,b)=>a-b);
      for(let j=1;j<hits.length;j+=2){
        const l=hits[j-1],r=hits[j],width=r-l;if(width<1.8)continue;
        const count=Math.max(1,Math.ceil(width/(d.pier?6.8:8)));
        for(let k=0;k<count;k++){
          const ideal=l+width*(k+.5)/count;
          for(const offset of [0,-1.25,1.25,-2.5,2.5]){
            const u=ideal+offset,x=dx*s+nx*u,z=dz*s+nz*u,top=d.height(x,z)-d.depth;
            if(u<l+.75||u>r-.75||!d.pier&&(onRoad(x,z,1.1)||building(x,z)))continue;
            const floor=d.pier?-1.4:.1,rad=d.pier?.40:.65;
            if(top<=floor)continue;
            (d.pier?piles:column).at(x,(floor+top)/2,z,d.pier?rad:1.22,top-floor,d.pier?rad:1.32,yaw);
            grid.bridgePiers.add({x,z,r:rad,top},[x-rad-.5,z-rad-.5,x+rad+.5,z+rad+.5]);break;
          }
        }
        const u=(l+r)/2,x=dx*s+nx*u,z=dz*s+nz*u,y=d.height(x,z)-d.depth;
        beam.at(x,y-.14,z,width-.65,.31,.65,yaw);
        if(!d.pier)for(let t=l+1.2;t<r;t+=5.8){
          const X=dx*(s+1.05)+nx*t,Z=dz*(s+1.05)+nz*t;
          if(!inArea(X,Z,d))continue;
          rims.at(X,y-.015,Z,.155,.035,.155);spots.at(X,y-.041,Z,.105,.016,.105);
          m.parkLights.fixture(X,y-.1,Z,0xffe0b8,46,13,.33);
        }
      }
    }
  }
  for(const d of decks){
    slabFaces(d,d.pier?brick:sky,soffit);
    for(const ring of [d.p,...(d.holes??[])])for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],h=d.height(...a),j=d.height(...b);
      const cut=d.pier?(d.pier.shoreToDeck-d.station(...a))/(d.station(...b)-d.station(...a)):-1;
      const points=cut>0&&cut<1?[a,[a[0]+(b[0]-a[0])*cut,a[1]+(b[1]-a[1])*cut],b]:[a,b];
      for(let k=1;k<points.length;k++){
        const [x,z]=points[k-1],[X,Z]=points[k],y=d.height(x,z),Y=d.height(X,Z);
        fascia.quad([x,y,z],[X,Y,Z],[X,Y-d.depth,Z],[x,y-d.depth,z]);
      }
      if(!d.pier)band.quad([a[0],h-.63,a[1]],[b[0],j-.63,b[1]],[b[0],j-.73,b[1]],[a[0],h-.73,a[1]]);
      railSection(d,a,b,(x,z)=>{
        if(d.pier)return Math.hypot(x-d.pier.entry[0],z-d.pier.entry[1])<5.9;
        if(building(x,z)||areas.query(x,z).some(v=>v!==d&&inRing(x,z,v.p)))return true;
        return approaches.query(x,z).some(s=>segmentDistance(x,z,s.a,s.b)<s.w+.35);
      });
    }
    supports(d);
  }
  const lining=new T.MeshStandardMaterial({color:0xddd9cc,roughness:.81,side:T.DoubleSide});
  const granite=new T.MeshStandardMaterial({map:photo('stone-color.webp'),color:0xb6b9b4,roughness:.87,side:T.DoubleSide});
  sky.mesh(root,granite,'深圳湾大街二层步行街铺装',true);brick.mesh(root,harbourBrick(),'观海栈桥人字砖桥面',true);
  soffit.mesh(root,lining,'连廊与栈桥实体梁底',true);fascia.mesh(root,lining,'桥板侧缘石',true);
  const trim=m.dark.clone();trim.side=T.DoubleSide;trim.polygonOffset=true;trim.polygonOffsetFactor=-2;
  band.mesh(root,trim,'二层平台侧缘金属分缝');glazing.mesh(root,glass,'步行街玻璃栏板');
  cap.mesh(root,m.wood,'观海栈桥宽面扶手');
  for(const part of [posts,rail,rod,fin,shoe,base,column,piles,beam,spots,rims,signs])part.flush(root,[column,piles,beam].includes(part),part===rims?200:900);
  const railAt=(x,z,y)=>edges.query(x,z).some(s=>{const h=s.d.height(x,z);
    return y>=h-.25&&y<h+1.5&&segmentDistance(x,z,s.a,s.b)<.27;});
  function splitAtEdges(profile){
    const stations=[];
    for(let i=1;i<profile.points.length;i++){
      const a=profile.points[i-1],b=profile.points[i],dx=b.x-a.x,dz=b.z-a.z;
      const xmin=Math.min(a.x,b.x),xmax=Math.max(a.x,b.x),zmin=Math.min(a.z,b.z),zmax=Math.max(a.z,b.z);
      for(const d of decks){
        if(d.pier||xmax<d.bbox[0]||xmin>d.bbox[2]||zmax<d.bbox[1]||zmin>d.bbox[3])continue;
        for(let j=0;j<d.p.length;j++){
          const p=d.p[j],q=d.p[(j+1)%d.p.length],vx=q[0]-p[0],vz=q[1]-p[1],det=dx*vz-dz*vx;
          if(Math.abs(det)<.00001)continue;
          const u=p[0]-a.x,v=p[1]-a.z,t=(u*vz-v*vx)/det,f=(u*dz-v*dx)/det;
          if(t>.0001&&t<.9999&&f>=0&&f<=1)stations.push(a.s+t*(b.s-a.s));
        }
      }
    }
    return stations;
  }
  return {areaAt,highAt,onRoad,railAt,splitAtEdges,roofs:decks.filter(d=>!d.pier).map(d=>({...d,h:skywalkHeight}))};
}

