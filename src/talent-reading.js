
import {t, isEnglish} from './i18n.js';

function reference(title, url) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = title;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

export function readingContent(record) {
  const {membership, bio, profile} = record.literature;
  const fragment = document.createDocumentFragment();
  const bioText = document.createElement('p');
  bioText.textContent = bio;
  const sourceText = document.createElement('p');
  sourceText.className = 'reading-evidence';
  sourceText.append(membership.date + ' · ' + membership.account);
  const refs = document.createElement('p');
  refs.className = 'reading-links';
  refs.append(reference(membership.title, membership.url), reference(...profile));
  if (record.survey) refs.append(reference(t('talentVideoRef'), 'https://www.youtube.com/watch?v=YaOHuAAV-lQ&t=2886s'));
  fragment.append(bioText, sourceText);
  if (record.physicalImage) {
    const observation = document.createElement('p');
    observation.className = 'reading-evidence';
    observation.textContent = record.evidenceNote;
    fragment.append(observation);
    refs.append(reference(t('talentCompareRef'), '/comparison/plaques.html#' + record.id));
  }
  if (record.id === 'wang-jian') {
    const caption = document.createElement('p');
    caption.className = 'reading-evidence';
    caption.textContent = t('talentWangJianNote');
    fragment.append(caption);
    refs.append(reference(t('talentWangJianRef'), 'https://commons.wikimedia.org/wiki/File:Wang_Jian_showing_Sydney_Brenner_around_BGI.jpg'));
  }
  fragment.append(refs);
  return fragment;
}

export function columnReader(details, columns) {
  const summary=details.querySelector('summary'),content=details.querySelector('div');
  let current=null,lastLang=null;
  return (position,requestedId=null)=>{
    let nearest=null,distance=3.1;
    for(const col of columns){
      const gap=Math.hypot(col.x-position.x,col.z-position.z);
      if(col.record.id===requestedId&&gap<3.1){nearest=col.record;break;}
      if(gap<distance){nearest=col.record;distance=gap;}
    }
    const lang=isEnglish();
    if(nearest!==current||lang!==lastLang){
      const changed=nearest!==current;
      current=nearest;lastLang=lang;details.hidden=!current;if(changed)details.open=false;content.replaceChildren();
      if(current){
        const displayName=lang&&current.english?`${current.english} (${current.name})`:current.name;
        summary.textContent=displayName+t('talentPlaqueSuffix');
        const location=document.createElement('p');location.className='reading-location';
        location.textContent=current.field.location+' · '+current.field.file;
        const text=document.createElement('p');text.textContent=current.field.excerpt;
        content.append(location,text,reference(t('talentBtnZoomPhoto'),current.field.image));
        if(current.literature)content.append(readingContent(current));
      }
    }
    if(requestedId&&current?.id===requestedId)details.open=true;
  };
}
