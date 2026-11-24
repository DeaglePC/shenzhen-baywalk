import * as T from 'three';
import {Instances,Surface,bounds,random,ribbon} from './city-geometry.js';

// Phase I. The playground footprint and the circular path around the sandpit
// are surveyed separately. Colours and play towers follow the opening photos.
export function parkPlayground(group,map,m,{addBoxObstacle,addPavedArea,trackTex}){
  const court=map.land.find(f=>f.id===735037208);
  const walk=map.roads.find(r=>r.id===775214634);
  if(!court||!walk)return [];
  const pixels=new Uint8Array(128*128*4),rand=random(75208);
  for(let i=0;i<pixels.length;i+=4){
    pixels.fill(208+Math.floor(rand()*48),i,i+3);pixels[i+3]=255;
  }
  const tex=trackTex(new T.DataTexture(pixels,128,128));
  tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.needsUpdate=true;
  const mat=new T.MeshStandardMaterial({map:tex,vertexColors:true,roughness:.97});
  const floor=new Surface(),trim=new Surface(),colour=hex=>new T.Color(hex);
  function island(x,z,rx,rz,phase){
    return Array.from({length:48},(_,i)=>{
      const a=i*Math.PI/24,r=1+.16*Math.sin(3*a+phase)+.085*Math.cos(5*a-phase);
      return [x+rx*r*Math.cos(a),z+rz*r*Math.sin(a)];
    });
  }
  const patches=[
    [island(-479,106,9,5.8,.6),0xcb7884],
    [island(-462.4,115.4,6,8.8,1.8),0x245688],
    [island(-444.5,111.2,8.5,5.5,2.4),0xdbad42]
  ];
  const trees=[[-474,116.5,6.5],[-451,104,7],[-455,123.8,6]];
  const wells=trees.map(([x,z],i)=>island(x,z,1.3,1.45,i));
  floor.polygon(court.p,[...patches.map(([p])=>p),...wells],.153,1.2,colour(0x23978d));
  const spots=[
    [island(-483.1,105.8,1.4,.83,1),island(-477.5,108.2,.95,.72,2),island(-474,105.8,1.8,1,0)],
    [island(-463,118.8,1.15,1.5,.3)],
    [island(-448,109.2,1.45,.86,.5)]
  ];
  patches.forEach(([p,c],i)=>{
    floor.polygon(p,spots[i],.153,1.2,colour(c));
    for(const spot of spots[i])floor.polygon(spot,[],.153,1.2,colour(i===0?0x42689b:i===1?0x258a94:0xca817d));
  });
  for(const well of wells)floor.polygon(well,[],.151,1.2,colour(0x665e46));
  addPavedArea(court.p,wells);
  const [x0,z0,x1,z1]=bounds(walk.p),cx=(x0+x1)/2,cz=(z0+z1)/2;
  const sand=walk.p.slice(0,-1).map(([x,z])=>{
    const d=Math.hypot(x-cx,z-cz),inset=walk.width/2;
    return [x-(x-cx)*inset/d,z-(z-cz)*inset/d];
  });
  const beds=[island(cx-6,cz-3,2.3,3.0,.4),island(cx+5,cz+4,3.3,2.1,1.6),island(cx-4,cz+9,1.7,1.1,.7)];
  floor.polygon(sand,beds,.151,1.6,colour(0xe4d7bd));
  for(const ring of [sand,...beds,...wells])ribbon(trim,[...ring,ring[0]],.22,.185,1);
  for(const bed of beds)floor.polygon(bed,[],.152,1.1,colour(0x728457));
  floor.mesh(group,mat,'嬉乐园 · 彩色弹性铺装与白沙池');
  trim.mesh(group,m.curb,'嬉乐园 · 沙池与种植岛压边');
  // Leave holes in the reserved sand surface for the two shade-tree beds.
  addPavedArea(sand,beds);

  const paint=new T.MeshStandardMaterial({roughness:.68});
  const bars=new Instances(new T.CylinderGeometry(1,1,1,10),paint,'嬉乐园 · 滑梯支柱与爬梯');
  const boards=new Instances(new T.BoxGeometry(1,1,1),paint,'嬉乐园 · 滑梯平台与护板');
  const moulded=new Surface(),red=colour(0xcd5140),amber=colour(0xd99a48),blue=colour(0x444e80);
  const steel=colour(0x98a4a4),wood=colour(0xa17a4c),deck=colour(0x65655d);
  const x=-444.5,z=111.2,h=1.56;
  const block=(ax,az,bx,bz)=>addBoxObstacle([[ax,az],[bx,az],[bx,bz],[ax,bz]]);
  for(const offset of [0,3.15]){
    const tx=x+offset;
    boards.at(tx,h,z,1.38,.13,1.38,0,deck);
    for(const dx of [-.60,.60])for(const dz of [-.60,.60]){
      bars.at(tx+dx,1.65,z+dz,.062,3.0,.062,0,wood);
      bars.at(tx+dx,.34,z+dz,.074,.38,.074,0,steel);
    }
    boards.at(tx,h+.38,z-.63,1.13,.68,.055,0,red);
    for(let i=0;i<10;i++){
      const edge=j=>{const a=j*Math.PI/10;return [tx+.85*Math.cos(a),3.11+.38*Math.sin(a)];};
      const [a,y]=edge(i),[b,v]=edge(i+1);
      moulded.quad([a,y,z-.84],[a,y,z+.84],[b,v,z+.84],[b,v,z-.84],undefined,blue);
    }
  }
  boards.at(x+1.575,h-.04,z,1.78,.13,.98,0,deck);
  for(const side of [-1,1]){
    const railZ=z+side*.53;
    bars.between(x+.6,h+.74,railZ,x+2.55,h+.74,railZ,.035,steel);
    for(let i=0;i<9;i++)boards.at(x+.72+i*.217,h+.36,railZ,.158,.78,.054,0,i%3===1?amber:red);
  }
  block(x-.7,z-.7,x+3.85,z+.7);
  // Ladder and shallow, flared run-out are on the open ends of the platforms.
  for(const dz of [-.32,.32]){
    bars.between(x+4.55,.16,z+dz,x+3.77,h+.065,z+dz,.037,steel);
    bars.between(x+3.77,h+.065,z+dz,x+3.77,h+.64,z+dz,.037,steel);
  }
  for(let i=1;i<=6;i++){
    const t=i/6,bx=x+4.55-.78*t,by=.16+1.42*t;
    bars.between(bx,by,z-.32,bx,by,z+.32,.032,steel);
  }
  block(x+3.76,z-.36,x+4.55,z+.36);
  const lip=colour(0xf2a344);
  function chute(t,side){
    const drop=t*t*(3-2*t);
    return [x-.67-3.9*t, h+.065-drop*1.25,z+side*(.34+.08*t)];
  }
  for(let i=0;i<14;i++){
    const a=chute(i/14,-1),b=chute(i/14,1),c=chute((i+1)/14,1),d=chute((i+1)/14,-1);
    moulded.quad(a,b,c,d,undefined,amber);
    for(const [p,q] of [[a,d],[c,b]])moulded.quad(p,q,[q[0],q[1]+.14,q[2]],[p[0],p[1]+.14,p[2]],undefined,lip);
  }
  block(x-4.57,z-.43,x-.67,z+.43);
  const sx=-462,sz=114.4;
  for(const dx of [-2.35,2.35])for(const dz of [-1.2,1.2]){
    bars.between(sx+dx,.153,sz+dz,sx+dx,2.72,sz,.075,blue);
    block(sx+dx-.11,sz+dz-.11,sx+dx+.11,sz+dz+.11);
  }
  bars.between(sx-2.5,2.72,sz,sx+2.5,2.72,sz,.09,blue);
  for(const offset of [-1,1]){
    boards.at(sx+offset,.68,sz,.67,.08,.32,0,deck);
    for(const side of [-1,1])bars.between(sx+offset+side*.33,.72,sz,sx+offset+side*.46,2.64,sz,.016,steel);
    block(sx+offset-.36,sz-.18,sx+offset+.36,sz+.18);
  }
  moulded.mesh(group,new T.MeshStandardMaterial({vertexColors:true,roughness:.55,side:T.DoubleSide}),'嬉乐园 · 弧顶与滑道',true);
  boards.flush(group,true);bars.flush(group,true);
  return [...trees,[cx-6,cz-3,6.8],[cx+5,cz+4,7.5]];
}
