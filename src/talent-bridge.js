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
  // The printed diagram gives order and transverse position. Register its
  // length against the ends of the deck and the 2022 photo-located A-29.
  const length=path.slice(1).reduce((total,p,i)=>total+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0);
  const surveyed=talentRecords.filter(r=>r.survey);
  const pivot=surveyed.find(r=>r.id==='fang-binxing').survey.station;
  const anchor=length*(143/Math.hypot(45.5,226)); // previously photo-located centre, not a surveyed station
  const begin=5, end=length-5;
  const columns=surveyed.map(record=>{
    const {station,across}=record.survey;
    const distance=station<=pivot?begin+(anchor-begin)*station/pivot:anchor+(end-anchor)*(station-pivot)/(1-pivot);
    const column=point(path,distance,-1.45+(6.97/.99)*across);
    column.faces[0]=record;return column;
  });
  // Preserve the later field count. Only the A-series dots were localised.
  // Place additional columns in the space between them, away from the lane.
  const candidates=[];
  for(const offset of [-1.45,1.95,5.52]){
    for(let s=4;s<length-2;s+=2.25)candidates.push(point(path,s,offset));
  }
  const otherColumns=[];
  while(columns.length<80 && candidates.length){
    let best=0,score=-1;
    for(let i=0;i<candidates.length;i++){
      const p=candidates[i];let gap=Infinity;
      for(const c of columns)gap=Math.min(gap,(c.x-p.x)**2+(c.z-p.z)**2);
      if(gap>score){score=gap;best=i;}
    }
    const [next]=candidates.splice(best,1);columns.push(next);otherColumns.push(next);
  }
  otherColumns.sort((a,b)=>a.station-b.station);
  const unlocated=talentRecords.filter(r=>!r.survey);
  for(const [i,record] of unlocated.entries()){
    const column=otherColumns[i%otherColumns.length];
    column.faces[Math.floor(i/otherColumns.length)]=record;
  }
  return columns;
}
export function personView(map,id='fang-binxing',detail=null){
  const bridge=map.roads.find(r=>Number(r.id)===562534109);if(!bridge)return null;
  for(const col of columnsOnBridge(bridge.p)){
    const face=col.faces.findIndex(r=>r?.id===id);if(face<0)continue;
    const lower=detail==='seal'&&id==='zhu-shiping';
    const close=lower||['inscription','left','right'].includes(detail);
    const angle=Math.atan2(col.dz,-col.dx)+face*Math.PI+(detail==='left'?-.82:detail==='right'?.82:0);
    const portrait=detail==='portrait';
    const radius=close?.89:portrait?1.7:2.06,h=lower?3.635:close?4.028:portrait?4.44:4.17;
    return {id:'talent',personId:id,readOnArrival:detail==='record',name:'星光桥 · '+col.faces[face].name,x:col.x+Math.sin(angle)*radius,z:col.z+Math.cos(angle)*radius,
      lookX:col.x,lookZ:col.z,portrait:{height:h,target:[col.x,h,col.z],fov:close?30:portrait?43:54}};
  }
  return null;
}
