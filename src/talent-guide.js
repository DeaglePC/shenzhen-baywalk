import {talentRecords,talentSources,talentBridgePhotos} from './talent-records.js';
import {bridgeSurvey} from './talent-survey.js';
import {personView} from './talent-bridge.js';

function link(label,url,title=label){
  const a=document.createElement('a');a.textContent=label;a.href=url;a.title=title;a.target='_blank';a.rel='noopener';return a;
}
function evidenceLabel(r){
  if(r.portraitKind==='site-study-partial')return '实柱肖像仅核到局部';
  if(r.image)return '有现场原照';
  if(r.portraitKind==='site-study')return '肖像据实柱重绘';
  if(r.portrait)return '肖像据公开人物照重绘';
  if(r.inscription?.length)return '已核到部分刻字';
  return '柱面肖像与铭文待核';
}
export function showTalentGuide(body,map,launch){
  body.innerHTML='<div class="panel-pad talent-guide"><p class="note"></p><p class="talent-references"></p><label>查找人物或柱号 <input type="search" placeholder="方滨兴、A-29…" autocomplete="off"></label><div class="talent-results"></div></div>';
  const wrap=body.firstElementChild,list=wrap.querySelector('.talent-results'),search=wrap.querySelector('input');
  wrap.querySelector('.note').textContent='已收录 '+talentRecords.length+' 位。2021 年桥头蓝牌列出 A-1 至 A-55，绿牌上的 55 个圆点已按走桥顺序对位，同排左右仍有推定。其余人物的实地柱号仍待核对。';
  const refs=wrap.querySelector('.talent-references');
  refs.append(link('桥头名录与点位图',bridgeSurvey.source.url));
  refs.append(link('桥头到桥尾实拍',bridgeSurvey.crossings[0].url),link('反向过桥实拍',bridgeSurvey.crossings[1].url));
  for(const [i,photo] of talentBridgePhotos.entries())refs.append(link(i===0?'桥面照片':'桥侧照片',photo.image,photo.description));
  const diagram=document.createElement('details');diagram.className='talent-diagram';
  const summary=document.createElement('summary');summary.textContent='在桥头图上选一根柱';diagram.append(summary);
  const diagramNote=document.createElement('p');diagramNote.textContent='上方为北端。选中编号可查看人物；示意位置按 2021 年桥头绿牌和步行顺序配对。';diagram.append(diagramNote);
  const plot=document.createElement('div');plot.className='talent-plot';
  for(const mark of bridgeSurvey.columns){
    const b=document.createElement('button');b.type='button';b.textContent=mark.number;b.title=mark.code+' '+mark.name;
    b.setAttribute('aria-label',b.title);b.style.left=(14+mark.across*72)+'%';b.style.top=(2.5+mark.station*95)+'%';
    b.onclick=()=>{search.value=mark.code;diagram.open=false;render();search.scrollIntoView({block:'nearest'});};
    plot.append(b);
  }
  diagram.append(plot);refs.after(diagram);
  function goButton(label,id,detail){
    const b=document.createElement('button');b.textContent=label;b.className='place';b.onclick=()=>{const v=personView(map,id,detail);if(v)launch(v);};return b;
  }
  function render(){
    const term=search.value.trim().toLowerCase().replace(/^a\s*[-－]?\s*(\d+)$/,'a-$1');list.replaceChildren();
    for(const r of talentRecords){
      const mark=r.survey;
      if(/^a-\d+$/.test(term)&&mark?.code.toLowerCase()!==term)continue;
      if(![r.name,r.english,...(r.aliases||[]),mark?.code,mark?.printedName].filter(Boolean).join(' ').toLowerCase().includes(term))continue;
      const row=document.createElement('article'),title=document.createElement('h3'),cue=document.createElement('p'),links=document.createElement('div');
      title.textContent=(mark?mark.code+'　':'')+r.name;
      cue.textContent=[r.role,mark?'2021 年名录有号，点位按示意图配对':'实地柱号待核，漫游中暂用展示位',evidenceLabel(r)].filter(Boolean).join(' · ');
      row.append(title,cue);
      const lines=r.inscription||[];
      if(lines.length||r.inscriptionFragments?.length){
        const transcript=document.createElement('p');transcript.className='talent-transcript';
        transcript.textContent='柱面读文　'+[...lines,...(r.inscriptionFragments||[]).map(f=>(f.leftMissing?'…':'')+f.text+(f.rightMissing?'…':''))].join(' / ');
        row.append(transcript);
      }
      if(r.readingNote||r.evidenceNote){const note=document.createElement('p');note.textContent=r.readingNote||r.evidenceNote;row.append(note);}
      if(mark && mark.printedName!==r.name){const alias=document.createElement('p');alias.textContent='蓝牌写作　'+mark.printedName;row.append(alias);}
      links.append(goButton('前往铭牌',r.id));
      if(r.portrait)links.append(goButton('近看肖像',r.id,'portrait'));
      if(r.id==='fang-binxing')links.append(link('原照与实机对照','/comparison/plaques.html'));
      if(lines.length||r.inscriptionFragments?.length)links.append(goButton('近看铭文',r.id,'inscription'));
      if(r.id==='fang-binxing')links.append(goButton('看左端',r.id,'left'),goButton('看右端',r.id,'right'));
      if(r.image)links.append(link('现场原照',r.image));
      else if(r.physicalImage)links.append(link('现场原照',r.physicalImage.endsWith('.heic')?talentSources[r.sourceIds.find(id=>talentSources[id]?.url.includes('meipian'))]?.url||r.physicalImage:r.physicalImage));
      for(const id of r.sourceIds){
        if(id==='board2021')continue;
        const ref=talentSources[id];if(!ref)continue;
        links.append(link(ref.title.split(' · ')[0],ref.url+(id==='video2022'&&r.sourceTime?'&t='+r.sourceTime+'s':''),ref.title));
      }
      row.append(links);list.append(row);
    }
    if(!list.childElementCount)list.textContent='没有找到匹配的人物或柱号。';
  }
  search.oninput=render;render();
}
