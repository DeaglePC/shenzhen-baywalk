import {deckPlates,shorePlates,filmedPlates,southWalk} from './talent-field.js';
import {talentRecords} from './talent-records.js';

const records=new Map(talentRecords.map(person=>[person.id,person]));
const sites=new WeakMap();
export const sleeve={radius:.139,bottom:1.20,top:2.51,height:4.20};

export function routePoint(path,distance,offset=0){
  let left=distance;
  for(let i=1;i<path.length;i++){
    const [ax,az]=path[i-1],[bx,bz]=path[i],length=Math.hypot(bx-ax,bz-az);
    if(length<.001)continue;
    if(left>length&&i<path.length-1){left-=length;continue;}
    const dx=(bx-ax)/length,dz=(bz-az)/length,t=Math.min(length,Math.max(0,left));
    return {x:ax+dx*t-dz*offset,z:az+dz*t+dx*offset,dx,dz};
  }
}
export function columnsOnBridge(path){
  if(sites.has(path))return sites.get(path);
  const deck=path[0][1]<path.at(-1)[1]?path:[...path].reverse();
  const columns=[];
  for(const [rows,route,onDeck] of [[deckPlates,deck,true],[shorePlates,southWalk,false],[filmedPlates,southWalk,false]]){
    for(const [,id,,station,offset] of rows){
      const column=routePoint(route,station,offset);
      // Each sleeve faces across its local walk. Both views read left to right.
      column.yaw=Math.atan2(column.dz,-column.dx);
      Object.assign(column,{record:records.get(id),station,offset,onDeck,base:onDeck?2.412:.16});
      columns.push(column);
    }
  }
  sites.set(path,columns);return columns;
}
export function personView(map,id='fang-binxing',detail=null,sitesInScene=null){
  const bridge=map.roads.find(r=>Number(r.id)===562534109);
  const col=(sitesInScene??(bridge?columnsOnBridge(bridge.p):[])).find(c=>c.record.id===id);
  if(!col)return null;
  const seal=detail==='seal',text=['inscription','left','right'].includes(detail),portrait=detail==='portrait';
  const radius=(seal||text) ? .72 : portrait ? .84 : 1.63;
  const h=col.base+(seal?1.43:text?1.73:portrait?2.18:1.86);
  // Approach shore columns from the brick path, avoiding the hedge on the lake side.
  const reverse=detail==='reverse',lakeFace=!col.onDeck&&col.offset<0;
  const yaw=col.yaw+((lakeFace!==reverse)?Math.PI:0)+(detail==='left'?-.64:detail==='right'?.64:0);
  return {id:'talent',personId:id,personDetail:detail,readOnArrival:detail==='record',
    onDeck:col.onDeck,personEnglish:col.record.english||col.record.name,
    name:(col.onDeck?'星光桥 · ':'星光桥南岸 · ')+col.record.name,
    x:col.x+Math.sin(yaw)*radius,z:col.z+Math.cos(yaw)*radius,lookX:col.x,lookZ:col.z,
    portrait:{height:h,target:[col.x,h,col.z],fov:text||seal?29:portrait?36:51}};
}
