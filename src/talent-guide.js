import {talentRecords,talentSources,talentBridgePhotos} from './talent-records.js';
import {bridgeSurvey} from './talent-survey.js';
import {columnsOnBridge,personView} from './talent-bridge.js';
import {readingContent} from './talent-reading.js';
import {t,isEnglish} from './i18n.js';

function link(label,url,title=label){
  const a=document.createElement('a');a.textContent=label;a.href=url;a.title=title;a.target='_blank';a.rel='noopener';return a;
}
function evidenceLabel(r){
  if(r.portraitKind==='site-study-partial')return t('evSitePartial');
  if(r.image)return t('evOrigPhoto');
  if(r.portraitKind==='site-study')return t('evSiteStudy');
  if(r.portrait)return t('evPublicPortrait');
  if(r.physicalImage&&r.inscription?.length)return t('evInscVerified');
  if(r.inscription?.length)return t('evPartialInsc');
  return t('evPending');
}
export function showTalentGuide(body,map,launch,documentsOnly=false,initialPerson=null){
  body.innerHTML='<div class="panel-pad talent-guide"><p class="note"></p><p class="talent-references"></p><label>'+t('talentSearchLabel')+' <input type="search" placeholder="'+t('talentSearchPlaceholder')+'" autocomplete="off"></label><div class="talent-scope" role="group" aria-label="'+t('talentScopeAria')+'"><button type="button">'+t('talentScopeAll')+'</button><button type="button"></button></div><div class="talent-results"></div></div>';
  const wrap=body.firstElementChild,list=wrap.querySelector('.talent-results'),search=wrap.querySelector('input');
  if(initialPerson){
    const rec=talentRecords.find(r=>r.id===initialPerson);
    search.value=(isEnglish()&&rec?.english)?rec.english:rec?.name||initialPerson;
  }
  const [all,docs]=wrap.querySelectorAll('.talent-scope button');
  docs.textContent=t('talentScopeDocs',talentRecords.filter(r=>r.literature).length);
  all.onclick=()=>{documentsOnly=false;render();};
  docs.onclick=()=>{documentsOnly=true;render();};
  const bridge=map.roads.find(r=>r.id===562534109),columns=bridge?columnsOnBridge(bridge.p):[];
  const deckCount=columns.filter(c=>c.onDeck).length;
  wrap.querySelector('.note').textContent=t('talentSurveyNote',deckCount,columns.length-deckCount);
  const refs=wrap.querySelector('.talent-references');
  refs.append(link(t('talentRef2021'),bridgeSurvey.source.url));
  for(const [i,photo] of talentBridgePhotos.entries())refs.append(link(i===0?t('talentRefDeck'):t('talentRefSide'),photo.image,photo.description));
  for(const onDeck of [true,false]){
    const group=columns.filter(c=>c.onDeck===onDeck);
    if(!group.length)continue;
    const diagram=document.createElement('details');diagram.className='talent-diagram';
    const summary=document.createElement('summary');summary.textContent=onDeck?t('talentDiagramDeck'):t('talentDiagramShore');
    const note=document.createElement('p');note.textContent=t('talentDiagramNote');
    const plot=document.createElement('div');plot.className='talent-plot';
    const first=group[0].station,span=group.at(-1).station-first;
    plot.style.height=(group.length*30)+'px';
    for(const c of group){
      const r=c.record,b=document.createElement('button');b.type='button';b.textContent=r.field.order;
      const personName=isEnglish()&&r.english?`${r.english} (${r.name})`:r.name;
      b.title=personName+' · '+r.field.location;
      b.setAttribute('aria-label',b.title);b.style.left=(38+c.offset*8)+'%';b.style.top=(1+(c.station-first)/span*98)+'%';
      b.onclick=()=>{search.value=isEnglish()&&r.english?r.english:r.name;documentsOnly=false;diagram.open=false;render();search.scrollIntoView({block:'nearest'});};
      plot.append(b);
    }
    diagram.append(summary,note,plot);search.closest('label').before(diagram);
  }
  function goButton(label,id,detail){
    const b=document.createElement('button');b.textContent=label;b.className='place';b.onclick=()=>{const v=personView(map,id,detail);if(v)launch(v);};return b;
  }
  function render(){
    all.setAttribute('aria-pressed',String(!documentsOnly));
    docs.setAttribute('aria-pressed',String(documentsOnly));
    const term=search.value.trim().toLowerCase().replace(/^a\s*[-－]?\s*(\d+)$/,'a-$1');list.replaceChildren();
    for(const r of talentRecords){
      if(documentsOnly&&!r.literature)continue;
      const mark=r.survey;
      if(/^a-\d+$/.test(term)&&mark?.code.toLowerCase()!==term)continue;
      if(![r.name,r.english,...(r.aliases||[]),r.field?.file,r.field?.location,mark?.code,mark?.printedName].filter(Boolean).join(' ').toLowerCase().includes(term))continue;
      const row=document.createElement('article'),title=document.createElement('h3'),cue=document.createElement('p'),links=document.createElement('div');
      const personName=isEnglish()&&r.english?`${r.english} (${r.name})`:r.name;
      title.textContent=(r.field?r.field.location+'　':t('talentHistorical')+'　')+personName;
      cue.textContent=r.field?[r.field.file,mark?t('talentOldCode',mark.code):null].filter(Boolean).join(' · '):[r.role,evidenceLabel(r),t('talentUnlocated')].filter(Boolean).join(' · ');
      row.append(title,cue);
      if(r.field){const p=document.createElement('p');p.textContent=t('talentExcerptPrefix')+r.field.excerpt;row.append(p);}
      if(r.literature)row.append(readingContent(r));
      const lines=r.inscription||[];
      if(lines.length||r.inscriptionFragments?.length){
        const transcript=document.createElement('p');transcript.className='talent-transcript';
        transcript.textContent=t('talentTranscriptPrefix')+[...lines,...(r.inscriptionFragments||[]).map(f=>(f.leftMissing?'…':'')+f.text+(f.rightMissing?'…':''))].join(' / ');
        row.append(transcript);
      }
      if(!r.field&&(r.readingNote||r.evidenceNote)&&!(r.literature&&r.physicalImage)){const note=document.createElement('p');note.textContent=r.readingNote||r.evidenceNote;row.append(note);}
      if(mark && mark.printedName!==r.name){const alias=document.createElement('p');alias.textContent=t('talentAliasPrefix')+mark.printedName;row.append(alias);}
      if(r.field){
        links.append(goButton(t('talentBtnVisit'),r.id),goButton(t('talentBtnReverse'),r.id,'reverse'),
          goButton(t('talentBtnPortrait'),r.id,'portrait'),goButton(t('talentBtnInscription'),r.id,'inscription'),link(t('talentBtnZoomPhoto'),r.field.image));
        if(r.literature)links.append(goButton(t('talentBtnRead'),r.id,'record'));
      }
      if(r.image)links.append(link(t('talentBtnOrigPhoto'),r.image));
      else if(r.physicalImage)links.append(link(t('talentBtnOrigPhoto'),r.physicalImage.endsWith('.heic')?talentSources[r.sourceIds.find(id=>talentSources[id]?.url.includes('meipian'))]?.url||r.physicalImage:r.physicalImage));
      for(const id of r.sourceIds){
        if(id==='board2021')continue;
        const ref=talentSources[id];if(!ref)continue;
        if(ref.url===r.literature?.membership.url||ref.url===r.literature?.profile[1])continue;
        links.append(link(ref.title.split(' · ')[0],ref.url+(id==='video2022'&&r.sourceTime?'&t='+r.sourceTime+'s':''),ref.title));
      }
      row.append(links);list.append(row);
    }
    if(!list.childElementCount)list.textContent=t('talentNoMatch');
  }
  search.oninput=render;render();
}
