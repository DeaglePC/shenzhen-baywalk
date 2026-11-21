import {talentRecords,talentSources,talentBridgePhotos} from './talent-records.js';
import {personView} from './talent-bridge.js';

export function showTalentGuide(body,map,launch){
  body.innerHTML='<div class="panel-pad talent-guide"><p class="note"></p><label>查找人物 <input type="search" placeholder="姓名或英文名" autocomplete="off"></label><div class="talent-results"></div></div>';
  const wrap=body.firstElementChild,list=wrap.querySelector('.talent-results'),search=wrap.querySelector('input');
  wrap.querySelector('p').textContent='已查证 '+talentRecords.length+' 位登桥人物。可查看每位的资料和对应实景。桥上展位依公开照片推定。';
  const references=document.createElement('p');references.className='talent-references';
  for(const [i,photo] of talentBridgePhotos.entries()){
    const a=document.createElement('a');a.textContent=i===0?'桥面实拍':'桥侧实拍';a.href=photo.image;
    a.title=photo.description;a.target='_blank';a.rel='noopener';references.append(a);
  }
  wrap.querySelector('p').after(references);
  function render(){
    const term=search.value.trim().toLowerCase();list.replaceChildren();
    for(const record of talentRecords){
      if(!(record.name+' '+record.english).toLowerCase().includes(term))continue;
      const row=document.createElement('article'),title=document.createElement('h3'),description=document.createElement('p'),links=document.createElement('div');
      title.textContent=record.name;
      const evidence=record.image?'有实物照片':record.portraitKind==='site-study'?'依据现场影像绘制刻像':record.portrait?'参考人物公开肖像重绘':record.inscription?'有可辨铭文':'已查证上桥记录';
      description.textContent=record.role+'　·　'+evidence;
      const go=document.createElement('button');go.textContent='前往铭牌';go.className='place';go.onclick=()=>{const view=personView(map,record.id);if(view)launch(view);};links.append(go);
      if(record.image){const a=document.createElement('a');a.href=record.image;a.textContent='查看实物照片';a.target='_blank';a.rel='noopener';links.append(a);}
      for(const id of record.sourceIds){
        const source=talentSources[id];if(!source)continue;
        const a=document.createElement('a');a.textContent=source.title.split(' · ')[0];a.title=source.title;a.href=source.url+(id==='video2022'&&record.sourceTime?'&t='+record.sourceTime+'s':'');
        a.target='_blank';a.rel='noopener';links.append(a);
      }
      row.append(title,description,links);list.append(row);
    }
    if(!list.childElementCount)list.textContent='已查证的记录里没有找到这个姓名。';
  }
  search.oninput=render;render();
}
