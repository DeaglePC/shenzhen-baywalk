const seasons={spring:'春',summer:'夏',autumn:'秋',winter:'冬'};
const skies={clear:'晴',rain:'雨',snow:'雪',aurora:'极光'};

export function climateFromQuery(params){
  const weather=params.get('weather'),season=params.get('season');
  return {weather:Object.hasOwn(skies,weather)?weather:'clear',season:Object.hasOwn(seasons,season)?season:'summer'};
}

export function climateControls(getWorld,report,onChange){
  const panel=document.querySelector('#climatePanel'),toggle=document.querySelector('#climateButton');
  const weatherButtons=[...panel.querySelectorAll('[data-weather]')],seasonButtons=[...panel.querySelectorAll('[data-season]')];
  let request=0;
  function open(value){
    panel.hidden=!value;toggle.setAttribute('aria-expanded',value);
    if(value&&document.pointerLockElement)document.exitPointerLock();
  }
  function sync(){
    const world=getWorld();if(!world)return;
    const {weather,season}=world.climate;
    for(const b of weatherButtons)b.setAttribute('aria-pressed',b.dataset.weather===weather);
    for(const b of seasonButtons)b.setAttribute('aria-pressed',b.dataset.season===season);
    document.querySelector('#climateName').textContent=seasons[season]+' · '+skies[weather];
    document.querySelector('#periodName').textContent=world.period;
    document.querySelector('#period').disabled=weather==='aurora';
    onChange(world.climate);
  }
  toggle.onclick=()=>open(panel.hidden);
  document.querySelector('#closeClimate').onclick=()=>{open(false);toggle.focus();};
  document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))open(false);});
  panel.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-season],button[data-weather]');if(!b)return;
    const world=getWorld(),patch=b.dataset.season?{season:b.dataset.season}:{weather:b.dataset.weather};
    const token=++request;
    panel.setAttribute('aria-busy','true');
    try{await world.setClimate(patch);}
    catch{report('天气资源读取失败，请重试');}
    finally{if(token===request){sync();panel.setAttribute('aria-busy','false');}}
  });
  return {sync,close:()=>open(false),get visible(){return !panel.hidden;}};
}
