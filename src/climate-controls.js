import {t,periodLabel} from './i18n.js';

const seasonKeys={spring:'seasonSpring',summer:'seasonSummer',autumn:'seasonAutumn',winter:'seasonWinter'};
const skyKeys={clear:'climateShortClear',rain:'climateShortRain',snow:'climateShortSnow',aurora:'climateShortAurora'};

export function climateFromQuery(params){
  const weather=params.get('weather'),season=params.get('season');
  return {weather:Object.hasOwn(skyKeys,weather)?weather:'clear',season:Object.hasOwn(seasonKeys,season)?season:'summer'};
}

export function climateControls(getWorld,report,onChange){
  const panel=document.querySelector('#climatePanel'),toggle=document.querySelector('#climateButton');
  const periodPanel=document.querySelector('#periodPanel'),periodToggle=document.querySelector('#period');
  const weatherButtons=[...panel.querySelectorAll('[data-weather]')],seasonButtons=[...panel.querySelectorAll('[data-season]')];
  const periodButtons=[...periodPanel.querySelectorAll('[data-period]')];
  const moonToggle=document.querySelector('#moonToggle');
  let request=0;
  function openClimate(value){
    if(value)openPeriod(false);
    panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));
    if(value)getWorld()?.releaseLook();
  }
  function openPeriod(value){
    if(value)openClimate(false);
    periodPanel.hidden=!value;periodToggle.setAttribute('aria-expanded',String(value));
    if(value)getWorld()?.releaseLook();
  }
  function closeAll(){openClimate(false);openPeriod(false);}
  function sync(){
    const world=getWorld();if(!world)return;
    const {weather,season}=world.climate;
    const pKey=world.periodKey;
    for(const b of weatherButtons)b.setAttribute('aria-pressed',String(b.dataset.weather===weather));
    for(const b of seasonButtons)b.setAttribute('aria-pressed',String(b.dataset.season===season));
    for(const b of periodButtons)b.setAttribute('aria-pressed',String(b.dataset.period===pKey));
    document.querySelector('#climateName').textContent=t(seasonKeys[season])+' · '+t(skyKeys[weather]);
    document.querySelector('#periodName').textContent=periodLabel(world.period);
    const lampBtn=document.querySelector('#headlights');
    if(lampBtn){
      const on=!!world.headlightsOn;
      lampBtn.setAttribute('aria-pressed',String(on));
      const label=document.querySelector('#headlightsName');
      if(label)label.textContent=on?t('headlightsShortOn'):t('headlightsShortOff');
    }
    if(moonToggle){
      const shown=world.moonVisible!==false;
      moonToggle.setAttribute('aria-pressed',String(shown));
      moonToggle.textContent=shown?t('moonShown'):t('moonHidden');
    }
    onChange(world.climate);
  }
  toggle.onclick=()=>openClimate(panel.hidden);
  periodToggle.onclick=()=>openPeriod(periodPanel.hidden);
  document.querySelector('#closeClimate').onclick=()=>{openClimate(false);toggle.focus();};
  document.querySelector('#closePeriod').onclick=()=>{openPeriod(false);periodToggle.focus();};
  document.addEventListener('pointerdown',e=>{
    if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))openClimate(false);
    if(!periodPanel.hidden&&!periodPanel.contains(e.target)&&!periodToggle.contains(e.target))openPeriod(false);
  });
  panel.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-season],button[data-weather]');if(!b)return;
    const world=getWorld(),patch=b.dataset.season?{season:b.dataset.season}:{weather:b.dataset.weather};
    const token=++request;
    panel.setAttribute('aria-busy','true');
    toggle.classList.add('is-loading');
    try{await world.setClimate(patch,b.textContent?.trim()||'');}
    catch{report(t('toastWeatherErr'));}
    finally{if(token===request){toggle.classList.remove('is-loading');sync();panel.setAttribute('aria-busy','false');}}
  });
  periodPanel.addEventListener('click',async e=>{
    if(e.target.closest('#moonToggle')){
      const world=getWorld();if(!world)return;
      const shown=world.toggleMoon();
      sync();
      report(shown?t('toastMoonOn'):t('toastMoonOff'));
      return;
    }
    const b=e.target.closest('button[data-period]');if(!b)return;
    const world=getWorld();if(!world)return;
    const token=++request;
    periodPanel.setAttribute('aria-busy','true');
    periodToggle.classList.add('is-loading');
    try{await world.setPeriod(b.dataset.period,b.textContent?.trim()||'');}
    catch{report(t('toastSkyErr'));}
    finally{if(token===request){periodToggle.classList.remove('is-loading');sync();periodPanel.setAttribute('aria-busy','false');}}
  });
  return {
    sync,
    close:closeAll,
    get visible(){return !panel.hidden||!periodPanel.hidden;},
    focusTrigger(){(!panel.hidden?toggle:periodToggle).focus();}
  };
}
