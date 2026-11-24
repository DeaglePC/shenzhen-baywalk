import {mouseLook} from './mouse-look.js';
import {columnsOnBridge,personView} from './talent-bridge.js';
import {columnReader} from './talent-reading.js';
import {applyIcons,icon} from './icons.js';
import {showAtlas,drawMini} from './atlas.js';
import {createAmbience} from './ambience.js';
import {photoStreet,model3Street,model3RearStreet} from './taxi-framing.js';
import {climateControls,climateFromQuery} from './climate-controls.js';
import {TOUR_ROUTES,DEFAULT_TOUR_ID,getTourRoute} from './drone-tour.js';
import {t,toggleLang,onLangChange,placeLabel,periodLabel,isEnglish} from './i18n.js';
applyIcons();
const $=s=>document.querySelector(s),panel=$('#panel'),body=$('#panelBody'),load=$('#loading'),home=$('#home'),hud=$('#hud');
const lookInput=mouseLook($('#world'),updateLookPrompt);
const speedSlider=$('#lookSpeed');
function showSensitivity(){
  const percent=Math.round(lookInput.sensitivity*100);
  speedSlider.value=percent;
  speedSlider.setAttribute('aria-valuetext',percent+'%');
  $('#lookValue').value=percent+'%';
}
speedSlider.oninput=()=>{lookInput.sensitivity=speedSlider.valueAsNumber/100;showSensitivity();};
$('#resetLook').onclick=()=>{lookInput.sensitivity=1;showSensitivity();};
showSensitivity();
const audio=createAmbience();let map,geoRequest,world,place,loading=false,panelId=0,cleanup=null,toastTimer,hintTimer;
let mode='home',locationName='人才星光桥',currentPanel='';
const fallback={id:'bridge',name:'人才星光桥',x:213.6,z:143.5,lookX:-263.3,lookZ:-456.8};
const route=new URLSearchParams(location.search);
let updateReader;
const climate=climateControls(()=>world,notify,setting=>audio.setWeather(setting.weather));
const stadiumFlight={eye:[486,210,-535],target:[82,20,-790],fov:49};
place=fallback;
function geo(){
  if(!geoRequest)geoRequest=fetch('/data/shenzhen.json').then(r=>{
    if(!r.ok)throw Error(t('errMapFetch'));return r.json();
  }).then(d=>{
    const entrance=d.views.find(v=>v.id==='stadium');
    if(entrance)Object.assign(entrance,{x:79,z:-658,lookX:83,lookZ:-790});
    d.views.push({id:'field',name:'春茧 · 场内',x:271,z:-730,lookX:205,lookZ:-816},
      {id:'tidal',name:'潮汐广场 · 湖岸',x:-115.8,z:-301.5,lookX:-680,lookZ:-112,portrait:{height:1.85,target:[-728,62,-120],fov:60}},
      {id:'signals',name:'科苑南路 · 登良路信号路口',x:-555.8,z:126,lookX:-545,lookZ:39,portrait:{height:2.02,target:[-545.6,6.35,39.6],fov:14}},
      {id:'monuments',name:'人才功勋墙 · 领航者',x:3.65,z:-310.8,lookX:4.3,lookZ:-314.5,portrait:{height:3.62,target:[4.3,3.46,-314.5],fov:54}},
      {id:'flowerbed',name:'人才湖 · 湖岸花草字',period:'overcast',x:166,z:-187,lookX:198,lookZ:-209,
        portrait:{height:10.8,target:[198,2.8,-209],fov:57}},
      {id:'flowerbed-lake',name:'人才湖 · 花坛临湖草坪',period:'overcast',x:171.5,z:-210,lookX:-425,lookZ:90,
        portrait:{height:2.65,target:[-425,21,90],fov:74}},
      {id:'volcengine',name:'景湖大厦 · 火山引擎',x:-705,z:-207,lookX:-810,lookZ:-177,portrait:{height:2.2,target:[-810,90,-177],fov:72},flight:{eye:[-664,137,-169],target:[-810,127,-177],fov:40}},
      {id:'star-south',name:'星光桥 · 南岸花树步道',period:'overcast',x:139.0,z:284.0,lookX:131.0,lookZ:317.0},
      {id:'garden',name:'人才公园 · 林间步道',x:150.9,z:344.1,lookX:164.7,lookZ:341.8},
      {id:'palm-grove',name:'人才公园 · 棕榈林步道',x:-471.05,z:172.75,lookX:-507.6,lookZ:189.0},
      {id:'sw-blossoms',name:'人才公园 · 异木棉大道',x:-282.5,z:393.4,lookX:-293.5,lookZ:395.5,
        portrait:{height:1.88,target:[-293.5,5.4,395.5],fov:58}},
      {id:'north-ramp',name:'人才公园 · 北岸无障碍坡道',x:20.2,z:-320.6,lookX:42.0,lookZ:-305.0},model3Street());
    const talent=personView(d,route.get('person')||undefined,route.get('detail'))||personView(d);
    if(talent)d.views.push(talent);
    const bridge=d.roads.find(r=>Number(r.id)===562534109);
    if(bridge)updateReader=columnReader($('#talentReader'),columnsOnBridge(bridge.p));
    d.views.push({id:'tencent',name:'腾讯滨海大厦',x:-1590,z:-1156,lookX:-1416,lookZ:-1345,
        flight:{eye:[-1710,121,-1110],target:[-1414,122,-1344],fov:49}},
      {id:'tencent-entry',name:'腾讯滨海大厦 · 西广场',x:-1488.6,z:-1300.9,lookX:-1477.7,lookZ:-1306.5,
        portrait:{height:1.95,target:[-1477.7,3.2,-1306.5],fov:60}},
      {id:'haitian-road',name:'腾讯滨海大厦 · 海天二路',x:-1333.9,z:-1362,lookX:-1364,lookZ:-1382,
        portrait:{height:1.95,target:[-1364,4,-1382],fov:67}},
      {id:'houhai-bridge',name:'沙河西路 · 后海大桥',x:304.1,z:171,lookX:351.4,lookZ:-67.9,
        flight:{eye:[253,40,259],target:[349,2,93],fov:51}},
      {id:'wenxin-road',name:'海岸城 · 文心四路桥下',x:-1366.8,z:-725,lookX:-1345,lookZ:-816,floorLimit:1.3},
      {id:'coast-walk',name:'海岸城 · 二层步行街',x:-1299,z:-787,lookX:-1221,lookZ:-779},
      {id:'bay-pier',name:'深圳湾 · 北观海栈桥',x:510,z:2526.5,lookX:405,lookZ:2930,
        flight:{eye:[663,32,2519],target:[428,6,2680],fov:62}},
      {id:'curve',name:'双曲桥',x:75,z:-305,lookX:94,lookZ:-289},
      {id:'bridge-entry',name:'星光桥 · 南桥头',x:226,z:165,lookX:212,lookZ:148,
        portrait:{height:3.05,target:[212,2.5,148],fov:64}},
      {id:'skyline',name:'人才湖 · 隔湖灯光秀',x:210.8,z:158.1,lookX:-263.3,lookZ:-456.8,
        flight:{eye:[364,17,86],target:[-240,128,-178],fov:40}},
      {id:'loop',name:'未来智汇廊桥',x:145,z:480,lookX:147,lookZ:463},
      {id:'onebay',name:'深圳湾一号 · 空中',x:246.66,z:-20,lookX:-680,lookZ:413,flight:{eye:[246.66,38,-20],target:[-680,144,413],fov:24}},
      {id:'t7',name:'深圳湾一号 · T7 临湖面',x:-565,z:525,lookX:-680,lookZ:538,flight:{eye:[-565,312,525],target:[-679,313,538],fov:33}},
      {id:'pavilion',name:'求贤阁',x:-424,z:244,lookX:-451,lookZ:228,portrait:{height:3.3,target:[-451,5.15,228],fov:52}},
      {id:'hall',name:'群英荟',x:-366,z:422,lookX:-330,lookZ:445,portrait:{height:2.36,target:[-330,3.9,445],fov:51}},
      {id:'sail',name:'风帆塔',x:-239,z:8,lookX:-251.3,lookZ:-11.6,portrait:{height:2.6,target:[-251.3,6.9,-11.6],fov:49}});
    map=d;return d;
  }).catch(e=>{geoRequest=null;throw e;});
  return geoRequest;
}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,2800);}
function setSkyTransition({active,label='',progress:pct=0}){
  const el=$('#skyLoader');if(!el)return;
  if(!active){el.hidden=true;return;}
  $('#skyLoaderText').textContent=t('switchingSky',periodLabel(label));
  $('#skyLoaderBar').style.width=Math.max(12,Math.min(100,pct))+'%';
  el.hidden=false;
}
function progress(percent,text){$('#loadFill').style.width=percent+'%';$('#loadText').textContent=text;}
const tourSpeeds=[0.5,1,1.5,2];
let cleanHud=false,selectedTourId=DEFAULT_TOUR_ID;
function tourRouteLabel(r){return isEnglish()?r.nameEn:r.nameZh;}
function setCleanHud(v){
  cleanHud=!!v&&mode==='world';
  document.body.classList.toggle('clean-hud',cleanHud);
  $('#restoreHud').hidden=!cleanHud;
}
function renderTourRoutes(){
  const box=$('#tourRoutes');if(!box)return;
  const activeId=world?.tourState?.routeId??selectedTourId;
  box.innerHTML='';
  for(const r of TOUR_ROUTES){
    const b=document.createElement('button');
    b.type='button';b.className='tour-route-btn';b.textContent=tourRouteLabel(r);
    b.setAttribute('aria-pressed',String(r.id===activeId));
    b.onclick=()=>startAutoTour(r.id);
    box.append(b);
  }
}
function syncTourUi(){
  const st=world?.tourState;
  const active=!!st?.active;
  $('#tourBanner').hidden=!active;
  $('#tourDock').hidden=!active;
  if(!active)return;
  selectedTourId=st.routeId;
  $('#tourChapter').textContent=isEnglish()?st.stopTitleEn:st.stopTitleZh;
  $('#tourAltitude').textContent=Math.round(world.position().height)+' m';
  const pct=Math.round(st.progress*100);
  $('#tourProgressFill').style.width=(st.progress*100).toFixed(2)+'%';
  $('#tourProgress').setAttribute('aria-valuenow',String(pct));
  $('#tourPlayPause [data-icon]').innerHTML=icon(st.paused?'play':'pause');
  $('#tourPlayText').textContent=st.paused?t('tourResume'):t('tourPause');
  $('#tourSpeed').textContent=(Number.isInteger(st.speed)?st.speed.toFixed(1):st.speed)+'×';
  for(const [i,btn] of [...$('#tourRoutes').children].entries()){
    btn.setAttribute('aria-pressed',String(TOUR_ROUTES[i]?.id===st.routeId));
  }
}
function startAutoTour(routeId=selectedTourId){
  if(!world)return;
  const r=getTourRoute(routeId);
  selectedTourId=r.id;
  climate.close();
  world.startTour(r.id);
  renderTourRoutes();
  syncTourUi();
  notify(t('tourToastStart',tourRouteLabel(r)));
}
function toggleAutoTour(){
  if(!world)return;
  if(world.touring){
    world.stopTour();
    setCleanHud(false);
    notify(t('tourToastStop'));
  }else{
    startAutoTour(selectedTourId);
  }
}
function cameraLabel(cameraMode){
  const drone=cameraMode==='drone',orbit=cameraMode==='orbit',tour=cameraMode==='tour';
  document.body.dataset.camera=cameraMode;
  $('#cameraName').textContent=(drone||orbit||tour)?t('walkLand'):t('aerialEnter');
  $('#aerial [data-icon]').innerHTML=icon(drone||orbit||tour?'walk':'bird');
  $('#drone').setAttribute('aria-pressed',drone);$('#droneName').textContent=drone?t('droneExit'):t('droneEnter');
  $('#autoTour').setAttribute('aria-pressed',tour);$('#autoTourName').textContent=tour?t('tourExit'):t('tourEnter');
  $('.touchpad').hidden=orbit||tour;$('#flightInfo').hidden=$('#flightLift').hidden=!drone;
  $('#tourBanner').hidden=$('#tourDock').hidden=!tour;
  if(tour){renderTourRoutes();syncTourUi();}
  if(mode==='world'){showHint();updateHud();}
}
function closePanel(){if(panel.open)panel.close();finishPanel();}
function finishPanel(){panelId++;cleanup?.();cleanup=null;currentPanel='';world?.setBlocked(false);}
panel.addEventListener('close',()=>{if(!panel.open&&currentPanel)finishPanel();});
panel.addEventListener('click',e=>{if(e.target===panel){const b=panel.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closePanel();}});
$('#closePanel').onclick=closePanel;
function showHint(){
  updateLookPrompt();
  clearTimeout(hintTimer);const hint=$('#walkHint'),touch=matchMedia('(pointer:coarse)').matches;
  hint.textContent=world?.touring?t('hintTour'):world?.flying?(touch?t('hintDroneTouch'):t('hintDroneDesktop')):world?.aerial?t('hintAerial'):touch?t('hintWalkTouch'):t('hintWalkDesktop');
  hint.style.opacity=1;hintTimer=setTimeout(()=>hint.style.opacity=0,7500);
}
function updateLookPrompt(){
  const state=lookInput.state,button=$('#lockMouse'),message=$('#lockMessage');
  $('#mouseCapture').hidden=state==='locked'||state==='touch'||!!world?.aerial||!!world?.touring;
  button.hidden=state==='unsupported';button.disabled=state==='pending';
  button.textContent=state==='pending'?t('lockPending'):state==='denied'?t('lockDeniedBtn'):t('lockMouse');
  message.hidden=state!=='unsupported'&&state!=='denied';
  const edge=$('#openEdge');
  edge.hidden=message.hidden||!/Win/i.test(navigator.userAgentData?.platform??navigator.platform);
  $('#sceneAddress').hidden=message.hidden;
  if(!message.hidden)message.textContent=state==='unsupported'?t('lockUnsupported'):t('lockDeniedMsg');
}
$('#openEdge').href='microsoft-edge:'+location.href;
$('#sceneAddress').value=location.href;
$('#sceneAddress').onclick=e=>e.currentTarget.select();
$('#lockMouse').onclick=()=>{
  $('#world canvas')?.focus({preventScroll:true});
  lookInput.engage();
};
async function launch(v=place,fly=false,tourId=null){
  if(loading)return;loading=true;closePanel();if(!tourId)lookInput.engage();place=v;$('#spawnName').textContent=placeLabel(v);locationName=placeLabel(v);
  const autoPeriod=route.get('period')??v.period??(tourId==='lake-lightshow'?'night':v.id==='skyline'?'night':undefined);
  if(!world){load.hidden=false;$('#loadBack').hidden=true;progress(7,t('loadingMap'));
    try{
      const [data,module]=await Promise.all([geo(),import('./world.js')]);
      if(v===fallback){v=data.views.find(view=>view.id==='bridge')||v;place=v;$('#spawnName').textContent=placeLabel(v);}
      world=await module.buildWorld($('#world'),data,{progress,report:notify,step:f=>audio.step(f),onCamera:cameraLabel,onTransition:setSkyTransition,mouseLook:lookInput,period:autoPeriod,daylight:!!(v.photo||v.portrait||v.flight)||fly||tourId==='tech-skyline'||['garden','palm-grove','sw-blossoms','north-ramp'].includes(v.id),initialClimate:climateFromQuery(route)});
      climate.sync();
    }catch(e){lookInput.release();console.error(e);progress(0,t('loadingFail'));$('#loadBack').hidden=false;loading=false;return;}
  }else if(v.id==='skyline'){await world.nightView();climate.sync();}
  if(v.personId){v=personView(map,v.personId,v.personDetail,world.city.talentColumns)||v;place=v;}
  try{
    world.moveTo(v);
    if(tourId){const r=getTourRoute(tourId);selectedTourId=r.id;world.startTour(r.id);}
    else if(v.flight||fly)world.toggleDrone(v.flight??(v.id==='stadium'?stadiumFlight:undefined));
    await world.prepareView();
  }catch(e){lookInput.release();notify(e.message);loading=false;load.hidden=true;return;}
  mode='world';document.body.dataset.mode=mode;world.setPlaying(true);world.setBlocked(false);home.hidden=true;hud.hidden=false;$('#locality').textContent=placeLabel(v);
  if(route.get('clean')==='1')setCleanHud(true);
  updateHud();if(v.readOnArrival)updateReader?.(world.position(),v.personId);
  progress(100,t('loadingReady'));await new Promise(requestAnimationFrame);loading=false;load.hidden=true;showHint();
}
function goHome(){closePanel();setCleanHud(false);world?.stopTour?.();world?.setPlaying(false);mode='home';document.body.dataset.mode='home';hud.hidden=true;home.hidden=false;load.hidden=true;$('#start').innerHTML=icon('play')+(world?t('resumeRoam'):t('startRoam'));}
function resume(){
  if(!world){launch();return;}closePanel();if(!world.aerial&&!world.touring)lookInput.engage();mode='world';document.body.dataset.mode='world';home.hidden=true;hud.hidden=false;world.setPlaying(true);world.setBlocked(false);showHint();
}
$('#loadBack').onclick=()=>{goHome();location.reload();};$('#start').onclick=resume;$('#brand').onclick=()=>mode==='world'?openPanel('pause'):closePanel();
const titles={map:['FIELD MAP','panelMapTitle'],garage:['VEHICLE COLLECTION','panelGarageTitle'],talent:['STARLIGHT BRIDGE','panelTalentTitle'],help:['FIELD GUIDE','panelHelpTitle'],pause:['FREE ROAM','panelPauseTitle']};
async function openPanel(key,entryId){
  if(loading)return;setCleanHud(false);climate.close();cleanup?.();cleanup=null;const version=++panelId;currentPanel=key;world?.setBlocked(true);
  panel.dataset.panel=key;$('#panelKicker').textContent=titles[key][0];$('#panelTitle').textContent=t(titles[key][1]);
  body.innerHTML='<div class="panel-pad note">'+t('panelReading')+'</div>';if(!panel.open)panel.showModal();
  try{
    if(key==='map'){
      const data=await geo();if(version!==panelId)return;
      cleanup=showAtlas(body,data,place,mode==='world'?world.position():null,launch);
    }else if(key==='talent'){
      const [data,{showTalentGuide}]=await Promise.all([geo(),import('./talent-guide.js')]);if(version!==panelId)return;
      showTalentGuide(body,data,launch,mode==='home' && route.get('collection')==='documents',entryId);
    }else if(key==='garage'){
      const {showGarage}=await import('./garage.js');if(version!==panelId)return;
      const focusedCar=entryId??(mode==='world'&&place.id==='model3'?'model3':'e6');
      cleanup=showGarage(body,focusedCar,route.get('view'));
    }else if(key==='help'){
      body.innerHTML=t('helpHtml');
    }else{
      body.innerHTML='<div class="panel-pad menu-stack"></div>';const stack=body.firstElementChild;
      for(const [ico,text,fn] of [['play',t('resumeRoam'),()=>{closePanel();if(!world.aerial&&!world.touring)lookInput.engage();}],['tour',world?.touring?t('tourExit'):t('tourEnter'),()=>{closePanel();toggleAutoTour();}],['map',t('fieldMap'),()=>openPanel('map')],['pin',t('panelTalentTitle'),()=>openPanel('talent')],['car',t('vehicles'),()=>openPanel('garage')],['home',t('backHome'),goHome]]){
        const b=document.createElement('button');b.className='menu-item';b.innerHTML=icon(ico);b.append(text);b.onclick=fn;stack.append(b);
      }
    }
  }catch(err){if(version===panelId){body.innerHTML='<div class="panel-pad note">'+t('panelLoadFail')+'</div>';console.error(err);}}
}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>openPanel(b.dataset.action));$('#pause').onclick=()=>openPanel('pause');
function toggleHeadlights(){
  if(!world)return;
  const on=world.toggleHeadlights();
  climate.sync();
  notify(on?t('toastHeadlightsOn'):t('toastHeadlightsOff'));
}
$('#headlights').onclick=toggleHeadlights;
$('#aerial').onclick=()=>world?.toggleCamera();
$('#drone').onclick=()=>world?.toggleDrone();
$('#autoTour').onclick=toggleAutoTour;
$('#tourPlayPause').onclick=()=>{if(!world?.touring)return;world.setTourPaused(!world.tourState.paused);syncTourUi();};
$('#tourSpeed').onclick=()=>{
  if(!world?.touring)return;
  const cur=world.tourState.speed,idx=tourSpeeds.findIndex(s=>Math.abs(s-cur)<.05);
  world.setTourSpeed(tourSpeeds[(idx+1)%tourSpeeds.length]);syncTourUi();
};
$('#tourTakeover').onclick=()=>{if(!world?.touring)return;setCleanHud(false);world.stopTour({toDrone:true});};
$('#tourClean').onclick=()=>setCleanHud(!cleanHud);
$('#restoreHud').onclick=()=>setCleanHud(false);
$('#tourExit').onclick=toggleAutoTour;
{
  const bar=$('#tourProgress');let scrubbing=false;
  const scrub=e=>{
    if(!world?.touring)return;
    const r=bar.getBoundingClientRect();
    const u=Math.max(0,Math.min(.999,(e.clientX-r.left)/Math.max(1,r.width)));
    world.setTourProgress(u);syncTourUi();
  };
  bar.onpointerdown=e=>{scrubbing=true;bar.setPointerCapture(e.pointerId);scrub(e);};
  bar.onpointermove=e=>{if(scrubbing)scrub(e);};
  bar.onpointerup=bar.onpointercancel=bar.onlostpointercapture=()=>{scrubbing=false;};
}
for(const b of document.querySelectorAll('[data-lift]')){
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);world?.elevate(Number(b.dataset.lift));};
  b.onlostpointercapture=b.onpointerup=b.onpointercancel=()=>world?.elevate(0);
}
$('#sound').onclick=async()=>{try{const yes=await audio.toggle(),b=$('#sound');b.innerHTML=icon(yes?'sound':'mute');b.title=yes?t('soundOffTitle'):t('soundOnTitle');b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',yes);notify(yes?t('toastSoundOn'):t('toastSoundOff'));}catch(e){notify(t('toastSoundErr'));}};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){notify(t('toastFullscreenErr'));}};
document.addEventListener('fullscreenchange',()=>{const b=$('#fullscreen');b.title=document.fullscreenElement?t('exitFullscreenTitle'):t('fullscreenTitle');b.setAttribute('aria-label',b.title);});
window.addEventListener('keydown',e=>{if(loading&&e.code==='Escape'){lookInput.release();return;}if(e.repeat||loading||e.ctrlKey||e.metaKey||e.altKey)return;if(panel.open){if(e.code==='KeyM'&&currentPanel==='map')closePanel();return;}
  if(e.code==='Escape'&&climate.visible){climate.focusTrigger();climate.close();return;}
  if(e.code==='KeyM')openPanel('map');if(mode!=='world')return;
  if(e.code==='KeyV')world.toggleCamera();
  if(e.code==='KeyF')world.toggleDrone();
  if(e.code==='KeyG')toggleAutoTour();
  if(e.code==='KeyH')setCleanHud(!cleanHud);
  if(e.code==='Space'&&world.touring&&!e.target.closest?.('button,input,select')){e.preventDefault();world.setTourPaused(!world.tourState.paused);syncTourUi();}
  if(e.code==='KeyL')toggleHeadlights();
  if(e.code==='Escape'){if(cleanHud)setCleanHud(false);else if(world.aerial||world.touring)openPanel('pause');else lookInput.release();}
});
const pad=$('.touchpad'),puck=pad.querySelector('span');let finger=null;
function steer(e){const r=pad.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/29,z=(e.clientY-r.top-r.height/2)/29,l=Math.max(1,Math.hypot(x,z));puck.style.transform='translate('+x/l*23+'px,'+z/l*23+'px)';world?.joystick(x/l,z/l);}
pad.onpointerdown=e=>{finger=e.pointerId;pad.setPointerCapture(finger);steer(e);};pad.onpointermove=e=>{if(e.pointerId===finger)steer(e);};
pad.onlostpointercapture=pad.onpointercancel=pad.onpointerup=()=>{finger=null;puck.style.transform='';world?.joystick(0,0);};
function updateHud(){
  if(mode!=='world'||panel.open||!world)return;const pos=world.position(),deg=(pos.heading*180/Math.PI+360)%360;
  updateReader?.(world.flying||world.aerial||world.touring?{x:Infinity,z:Infinity}:pos);
  if(audio.enabled)audio.setSheltered(world.sheltered);
  if(world.flying)$('#altitude').textContent=Math.round(pos.height)+' m';
  if(world.touring)syncTourUi();
  $('#heading').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];$('#bearing').textContent=Math.round(deg)+'°';drawMini($('#mini'),map,pos);
  const near=map.views.find(v=>Math.hypot(v.x-pos.x,v.z-pos.z)<110);
  if((place.id==='model3'||place.id==='talent')&&Math.hypot(place.x-pos.x,place.z-pos.z)<(place.id==='talent'?3:30))$('#locality').textContent=placeLabel(place);
  else if(pos.x>-235&&pos.x<385&&pos.z>-1000&&pos.z< -595)$('#locality').textContent=t('localitySports');
  else if(near)$('#locality').textContent=placeLabel(near);else if(place.id==='custom'&&Math.hypot(pos.x-place.x,pos.z-place.z)<120)$('#locality').textContent=placeLabel(place);
  else $('#locality').textContent=Math.hypot(pos.x,pos.z)<610?t('localityTalentPark'):t('localityHouhai');
}
function applyLanguage(){
  document.title=t('pageTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content',t('pageDesc'));
  $('.cover')?.setAttribute('aria-label',t('coverAria'));
  const eyebrow=$('.intro .eyebrow');
  if(eyebrow)eyebrow.innerHTML='<span class="orange-line"></span>'+t('eyebrowLeft')+' <i>/</i> '+t('eyebrowRight');
  const headline=$('#headline');
  if(headline)headline.innerHTML=t('headline')+'<span class="headline-dot"></span>';
  const enTitle=$('.english-title');
  if(enTitle)enTitle.innerHTML=t('subtitleMain')+' <span>'+t('subtitleAccent')+'</span>';
  $('.lead').textContent=t('lead');
  $('#start').innerHTML=icon('play')+(world?t('resumeRoam'):t('startRoam'));
  const mapBtn=$('.actions [data-action="map"]');
  if(mapBtn)mapBtn.innerHTML=icon('map')+t('fieldMap');
  const tourEntry=$('.tour-entry');
  if(tourEntry)tourEntry.textContent=t('autoTourEntry');
  const stadiumEntry=$('.flight-entry:not(.tour-entry)');
  if(stadiumEntry)stadiumEntry.textContent=t('flyStadium');
  $('.compare-entry').textContent=t('compareEntry');
  const facts=document.querySelectorAll('.facts .fact');
  if(facts[0]){facts[0].querySelector('small').textContent=t('factStart');$('#spawnName').textContent=placeLabel(place);}
  if(facts[1]){facts[1].querySelector('small').textContent=t('factRadius');facts[1].querySelector('strong').innerHTML='<em>3.0</em> '+t('factRadiusUnit');}
  if(facts[2]){facts[2].querySelector('small').textContent=t('factScale');}
  $('#brand').setAttribute('aria-label',t('brandAria'));
  $('#brand small').textContent=t('brandSub');
  $('#topbar nav').setAttribute('aria-label',t('navAria'));
  $('.garage-link span:nth-child(2)').textContent=t('vehicles');
  const langBtn=$('#langToggle');
  if(langBtn){langBtn.textContent=t('langSwitchText');langBtn.title=t('langSwitchLabel');langBtn.setAttribute('aria-label',t('langSwitchLabel'));}
  const soundBtn=$('#sound'),soundOn=audio.enabled;
  soundBtn.title=soundOn?t('soundOffTitle'):t('soundOnTitle');soundBtn.setAttribute('aria-label',soundBtn.title);
  const helpBtn=$('#topbar [data-action="help"]');
  helpBtn.title=t('helpTitle');helpBtn.setAttribute('aria-label',t('helpTitle'));
  const fsBtn=$('#fullscreen');
  fsBtn.title=document.fullscreenElement?t('exitFullscreenTitle'):t('fullscreenTitle');fsBtn.setAttribute('aria-label',fsBtn.title);
  $('.compass').setAttribute('aria-label',t('compassAria'));
  $('.mini-panel').setAttribute('aria-label',t('miniMapAria'));
  $('#period').setAttribute('aria-label',t('periodAria'));
  $('#climateButton').setAttribute('aria-label',t('climateAria'));
  const lampBtn=$('#headlights');
  if(lampBtn){lampBtn.setAttribute('aria-label',t('headlightsAria'));lampBtn.title=t('headlightsTitle');}
  $('#drone').title=t('droneTitle');
  $('#autoTour').title=t('tourTitle');
  $('#tourBadge').textContent=t('tourBadge');
  $('#tourTakeoverText').textContent=t('tourTakeover');
  $('#tourCleanText').textContent=t('tourClean');
  $('#tourExitText').textContent=t('tourExit');
  $('#restoreHudText').textContent=t('tourShowHud');
  renderTourRoutes();
  $('#pause span:last-child').textContent=t('menu');
  $('#climatePanel').setAttribute('aria-label',t('climateAria'));
  $('#climatePanel .climate-head strong').textContent=t('climateHead');
  $('#closeClimate').setAttribute('aria-label',t('closeClimateAria'));
  $('#periodPanel').setAttribute('aria-label',t('periodPanelHead'));
  $('#periodPanel .climate-head strong').textContent=t('periodPanelHead');
  $('#closePeriod').setAttribute('aria-label',t('closePeriodAria'));
  const periodLegends=document.querySelectorAll('#periodPanel legend');
  if(periodLegends[0])periodLegends[0].textContent=t('periodLegend');
  if(periodLegends[1])periodLegends[1].textContent=t('nightSkyLegend');
  for(const [k,zh] of [['day','午后'],['sunset','日落'],['dusk','蓝调'],['night','夜晚']]){
    const b=$(`#periodPanel [data-period="${k}"]`);if(b)b.textContent=periodLabel(zh);
  }
  const moonBtn=$('#moonToggle');
  if(moonBtn&&!world)moonBtn.textContent=t('moonShown');
  const legends=document.querySelectorAll('#climatePanel legend');
  if(legends[0])legends[0].textContent=t('weatherLegend');
  if(legends[1])legends[1].textContent=t('seasonLegend');
  for(const [k,key] of [['clear','weatherClear'],['rain','weatherRain'],['snow','weatherSnow'],['aurora','weatherAurora']]){
    const b=$(`#climatePanel [data-weather="${k}"]`);if(b)b.textContent=t(key);
  }
  for(const [k,key] of [['spring','seasonSpring'],['summer','seasonSummer'],['autumn','seasonAutumn'],['winter','seasonWinter']]){
    const b=$(`#climatePanel [data-season="${k}"]`);if(b)b.textContent=t(key);
  }
  $('#flightInfo b').textContent=t('flightBadge');
  const liftUp=$('#flightLift [data-lift="1"]'),liftDown=$('#flightLift [data-lift="-1"]');
  if(liftUp){liftUp.textContent=t('liftUp');liftUp.setAttribute('aria-label',t('liftUpAria'));}
  if(liftDown){liftDown.textContent=t('liftDown');liftDown.setAttribute('aria-label',t('liftDownAria'));}
  $('#openEdge').textContent=t('openEdge');
  $('#sceneAddress').setAttribute('aria-label',t('sceneAddressAria'));
  $('.touchpad').setAttribute('aria-label',t('touchpadAria'));
  $('#loading h2').textContent=t('loadingHeading');
  if(!loading&&load.hidden)$('#loadText').textContent=t('loadingDefault');
  $('#loadBack').textContent=t('backHome');
  $('#closePanel').setAttribute('aria-label',t('closeAria'));
  $('#lookSettings label').textContent=t('mouseSensitivity');
  $('#resetLook').textContent=t('resetDefault');
  $('#world canvas')?.setAttribute('aria-label',t('canvasAria'));
  if(world){
    cameraLabel(world.touring?'tour':world.flying?'drone':world.aerial?'orbit':'walk');
    climate.sync();
  }else{
    $('#periodName').textContent=periodLabel('日落');
    $('#climateName').textContent=t('seasonSummer')+' · '+t('climateShortClear');
    $('#headlightsName').textContent=t('headlightsShortOff');
    $('#droneName').textContent=t('droneEnter');
    $('#autoTourName').textContent=t('tourEnter');
    $('#cameraName').textContent=t('aerialEnter');
    $('#locality').textContent=t('localityTalentPark');
    updateLookPrompt();
  }
  if(panel.open&&currentPanel)openPanel(currentPanel);
}
$('#langToggle').onclick=()=>{toggleLang();};
onLangChange(applyLanguage);
applyLanguage();
setInterval(updateHud,250);
const requestedView=route.get('walk'),vehicleView=route.get('inspect'),requestedTour=route.get('tour');
if(vehicleView==='talent')openPanel('talent',route.get('person'));
else if(['taxi','model3'].includes(vehicleView))openPanel('garage',vehicleView==='model3'?'model3':'e6');
else if(requestedTour){
  const tourId=requestedTour==='1'||requestedTour==='true'?DEFAULT_TOUR_ID:getTourRoute(requestedTour).id;
  geo().then(data=>{
    const startPlace=data.views.find(view=>view.id==='bridge')||fallback;
    return launch(startPlace,false,tourId);
  }).catch(()=>notify(t('toastMapErr')));
}else if(['bridge','bridge-entry','star-south','houhai-bridge','wenxin-road','coast-walk','bay-pier','skyline','pi','curve','loop','tencent','tencent-entry','haitian-road','street','stadium','field','garden','palm-grove','sw-blossoms','north-ramp','flowerbed','flowerbed-lake','model3','talent','pavilion','hall','sail','onebay','t7','tidal','monuments','volcengine','signals'].includes(requestedView)){
  geo().then(data=>{
    const person=route.get('person');
    if(requestedView==='talent'&&person&&!personView(data,person))return openPanel('talent',person);
    let place=data.views.find(view=>view.id===requestedView)||fallback;
    if(requestedView==='street'&&route.get('photo')==='1')place=photoStreet();
    if(requestedView==='model3'&&route.get('view')==='REAR_DETAIL')place=model3RearStreet();
    return launch(place,route.get('camera')==='drone');
  })
    .catch(()=>notify(t('toastMapErr')));
}else if('requestIdleCallback' in window)requestIdleCallback(()=>geo().catch(()=>{}),{timeout:3000});
else setTimeout(()=>geo().catch(()=>{}),1400);

