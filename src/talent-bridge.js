import {talentRecords} from './talent-records.js';

const point=(path,distance,offset)=>{
  let left=distance;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;
    if(left>length&&i<path.length-1){left-=length;continue;}
    const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    return {x:a[0]+dx*left-dz*offset,z:a[1]+dz*left+dx*offset,dx,dz,station:distance,faces:[]};
  }
};
export function columnsOnBridge(path){
  const columns=[];
  // The three staggered tracks stay in the timber portion of the deck.
  // The May 2024 Hong Kong Commercial Daily field report counts 80
  // columns. Individual track spacings are reconstructed from photographs.
  for(const [count,start,step,offset] of [[25,5,9.2,5.52],[28,3.8,8.12,2.02],[27,7.4,8.35,-1.5]]){
    for(let i=0;i<count;i++)columns.push(point(path,start+step*i,offset));
  }
  const west=columns.slice(0,25),rest=columns.slice(25);
  const fang=talentRecords.find(r=>r.id==='fang-binxing');west[15].faces[0]=fang;
  // Preserve only documented facts about neighbourhood and side. These
  // locations are illustrative unless the record supplies a camera fix.
  const lakeside=talentRecords.filter(r=>r!==fang&&r.position?.side==='west');
  const openWest=west.filter(c=>!c.faces[0]);
  const assign=(slots,people,face)=>people.slice(0,slots.length).forEach((r,i)=>{slots[Math.floor(i*slots.length/Math.min(slots.length,people.length))].faces[face]=r;});
  assign(openWest,lakeside,0);
  const others=talentRecords.filter(r=>r!==fang&&!lakeside.includes(r));
  const available=[...rest,...openWest.filter(c=>!c.faces[0])].sort((a,b)=>a.station-b.station);
  const pairCount=Math.min(Math.ceil(others.length/2),available.length);
  for(let i=0;i<pairCount;i++){
    const c=available[Math.floor(i*available.length/pairCount)];
    c.faces[0]=others[2*i];if(others[2*i+1])c.faces[1]=others[2*i+1];
  }
  if(others.length>pairCount*2)assign(west.filter(c=>c.faces[0]),others.slice(pairCount*2),1);
  return columns;
}
export function personView(map,id='fang-binxing'){
  const bridge=map.roads.find(r=>Number(r.id)===562534109);if(!bridge)return null;
  for(const col of columnsOnBridge(bridge.p)){
    const face=col.faces.findIndex(r=>r?.id===id);if(face<0)continue;
    const sign=face===0?1:-1;
    return {id:'talent',name:'星光桥 · '+col.faces[face].name,x:col.x+sign*col.dz*2.06,z:col.z-sign*col.dx*2.06,
      lookX:col.x,lookZ:col.z,portrait:{height:4.17,target:[col.x,4.17,col.z],fov:54}};
  }
  return null;
}
