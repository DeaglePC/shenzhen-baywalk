import {applyIcons,icon} from './icons.js';
import {showAtlas,drawMini} from './atlas.js';
import {createAmbience} from './ambience.js';
import {photoStreet} from './taxi-framing.js';
applyIcons();
const $=s=>document.querySelector(s),panel=$('#panel'),body=$('#panelBody'),load=$('#loading'),home=$('#home'),hud=$('#hud');
const audio=createAmbience();let map,geoRequest,world,place,loading=false,panelId=0,cleanup=null,toastTimer,hintTimer;
let mode='home',locationName='人才星光桥',currentPanel='';
const fallback={id:'bridge',name:'人才星光桥',x:213.6,z:143.5,lookX:-263.3,lookZ:-456.8};
place=fallback;
function geo(){if(!geoRequest)geoRequest=fetch('/data/shenzhen.json').then(r=>{if(!r.ok)throw Error('地图数据读取失败');return r.json();}).then(d=>{map=d;return d;}).catch(e=>{geoRequest=null;throw e;});return geoRequest;}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,2800);}
function progress(percent,text){$('#loadFill').style.width=percent+'%';$('#loadText').textContent=text;}
function cameraLabel(isAerial){$('#cameraName').textContent=isAerial?'落地步行':'鸟瞰';$('#aerial [data-icon]').innerHTML=icon(isAerial?'walk':'bird');$('.touchpad').hidden=isAerial;}
function closePanel(){if(panel.open)panel.close();finishPanel();}
function finishPanel(){panelId++;cleanup?.();cleanup=null;currentPanel='';world?.setBlocked(false);}
panel.addEventListener('close',()=>{if(!panel.open&&currentPanel)finishPanel();});
panel.addEventListener('click',e=>{if(e.target===panel){const b=panel.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closePanel();}});
$('#closePanel').onclick=closePanel;
function showHint(){clearTimeout(hintTimer);const hint=$('#walkHint');hint.textContent=matchMedia('(pointer:coarse)').matches?'左侧摇杆移动 · 拖动屏幕环顾':'W A S D 移动　·　拖动环顾　·　Shift 快步';hint.style.opacity=1;hintTimer=setTimeout(()=>hint.style.opacity=0,8700);}
async function launch(v=place){
  if(loading)return;closePanel();place=v;$('#spawnName').textContent=v.name;locationName=v.name;
  if(!world){loading=true;load.hidden=false;$('#loadBack').hidden=true;progress(7,'读取人才公园与后海地理数据…');
    try{
      const [data,module]=await Promise.all([geo(),import('./world.js')]);
      if(v===fallback){v=data.views.find(view=>view.id==='bridge')||v;place=v;}
      world=await module.buildWorld($('#world'),data,{progress,report:notify,step:f=>audio.step(f),onCamera:cameraLabel,daylight:!!v.photo});
      $('#periodName').textContent=world.period;
    }catch(e){console.error(e);progress(0,'场景载入失败。请使用开启硬件加速的 Chrome 或 Edge，或刷新后重试。');$('#loadBack').hidden=false;loading=false;return;}
  }
  try{world.moveTo(v);}catch(e){notify(e.message);loading=false;load.hidden=true;return;}
  mode='world';document.body.dataset.mode=mode;world.setPlaying(true);world.setBlocked(false);home.hidden=true;hud.hidden=false;$('#locality').textContent=v.name;
  updateHud();progress(100,'进入漫游');await new Promise(requestAnimationFrame);loading=false;load.hidden=true;showHint();
}
function goHome(){closePanel();world?.setPlaying(false);mode='home';document.body.dataset.mode='home';hud.hidden=true;home.hidden=false;load.hidden=true;$('#start').innerHTML=icon('play')+(world?'继续漫游':'开始漫游');}
function resume(){
  if(!world){launch();return;}closePanel();mode='world';document.body.dataset.mode='world';home.hidden=true;hud.hidden=false;world.setPlaying(true);world.setBlocked(false);showHint();
}
$('#loadBack').onclick=()=>{goHome();location.reload();};$('#start').onclick=resume;$('#brand').onclick=()=>mode==='world'?openPanel('pause'):closePanel();
const titles={map:['FIELD MAP','区域地图'],garage:['VEHICLE COLLECTION','车辆图鉴'],help:['FIELD GUIDE','操作指南'],pause:['FREE ROAM','漫游菜单']};
async function openPanel(key){
  if(loading)return;cleanup?.();cleanup=null;const version=++panelId;currentPanel=key;world?.setBlocked(true);
  panel.dataset.panel=key;$('#panelKicker').textContent=titles[key][0];$('#panelTitle').textContent=titles[key][1];
  body.innerHTML='<div class="panel-pad note">正在读取…</div>';if(!panel.open)panel.showModal();
  try{
    if(key==='map'){
      const data=await geo();if(version!==panelId)return;
      cleanup=showAtlas(body,data,place,mode==='world'?world.position():null,launch);
    }else if(key==='garage'){
      const {showGarage}=await import('./garage.js');if(version!==panelId)return;cleanup=showGarage(body);
    }else if(key==='help'){
      body.innerHTML='<div class="panel-pad"><div class="help-row"><span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / 方向键</span><span>步行移动</span></div><div class="help-row"><span><kbd>Shift</kbd> + 移动</span><span>快步</span></div><div class="help-row"><span>拖动鼠标 / 触屏</span><span>环顾四周</span></div><div class="help-row"><span>双击街景 / <kbd>Esc</kbd></span><span>锁定 / 释放鼠标</span></div><div class="help-row"><span><kbd>M</kbd> / <kbd>V</kbd></span><span>区域地图 / 鸟瞰</span></div><div class="help-row"><span>鸟瞰时拖动 / 滚轮</span><span>环绕 / 缩放</span></div><div class="help-row"><span>鸟瞰时右键拖动</span><span>平移落地点</span></div><p class="note">手机使用左侧摇杆移动。通过区域地图可以前往其他街区。日照按钮可切换午后、日落和蓝调时刻。</p><div class="credits">地理数据 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap 贡献者</a>。卫星影像来自 Copernicus Sentinel。建筑高度部分按楼层及用途估算，车辆为按公开尺寸重建的外观模型。启动画面为生成式概念美术。<br><a href="/credits.html" target="_blank" rel="noopener">查看数据与素材来源</a></div></div>';
    }else{
      body.innerHTML='<div class="panel-pad menu-stack"></div>';const stack=body.firstElementChild;
      for(const [ico,text,fn] of [['play','继续漫游',closePanel],['map','区域地图',()=>openPanel('map')],['car','车辆图鉴',()=>openPanel('garage')],['home','返回首页',goHome]]){
        const b=document.createElement('button');b.className='menu-item';b.innerHTML=icon(ico);b.append(text);b.onclick=fn;stack.append(b);
      }
    }
  }catch(err){if(version===panelId){body.innerHTML='<div class="panel-pad note">资源载入失败，请关闭后重试。车辆图鉴需要浏览器支持 WebGL 2。</div>';console.error(err);}}
}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>openPanel(b.dataset.action));$('#pause').onclick=()=>openPanel('pause');
$('#period').onclick=async()=>{const b=$('#period');b.disabled=true;try{$('#periodName').textContent=await world.nextPeriod();}catch(e){notify('天空资源读取失败，请重试');}finally{b.disabled=false;}};
$('#aerial').onclick=()=>world?.toggleCamera();
$('#sound').onclick=async()=>{try{const yes=await audio.toggle(),b=$('#sound');b.innerHTML=icon(yes?'sound':'mute');b.title=yes?'关闭环境音':'开启环境音';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',yes);notify(yes?'环境音已开启':'环境音已关闭');}catch(e){notify('浏览器未能播放音频');}};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){notify('当前窗口不支持全屏');}};
document.addEventListener('fullscreenchange',()=>{const b=$('#fullscreen');b.title=document.fullscreenElement?'退出全屏':'全屏';b.setAttribute('aria-label',b.title);});
window.addEventListener('keydown',e=>{if(e.repeat||loading||e.ctrlKey||e.metaKey||e.altKey)return;if(panel.open){if(e.code==='KeyM'&&currentPanel==='map')closePanel();return;}
  if(e.code==='KeyM')openPanel('map');if(mode!=='world')return;if(e.code==='KeyV')world.toggleCamera();if(e.code==='Escape'&&!document.pointerLockElement)openPanel('pause');
});
const pad=$('.touchpad'),puck=pad.querySelector('span');let finger=null;
function steer(e){const r=pad.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/29,z=(e.clientY-r.top-r.height/2)/29,l=Math.max(1,Math.hypot(x,z));puck.style.transform='translate('+x/l*23+'px,'+z/l*23+'px)';world?.joystick(x/l,z/l);}
pad.onpointerdown=e=>{finger=e.pointerId;pad.setPointerCapture(finger);steer(e);};pad.onpointermove=e=>{if(e.pointerId===finger)steer(e);};
pad.onlostpointercapture=pad.onpointercancel=pad.onpointerup=()=>{finger=null;puck.style.transform='';world?.joystick(0,0);};
function updateHud(){
  if(mode!=='world'||panel.open||!world)return;const pos=world.position(),deg=(pos.heading*180/Math.PI+360)%360;
  $('#heading').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];$('#bearing').textContent=Math.round(deg)+'°';drawMini($('#mini'),map,pos);
  const near=map.views.find(v=>Math.hypot(v.x-pos.x,v.z-pos.z)<110);
  if(near)$('#locality').textContent=near.name;else if(place.id==='custom'&&Math.hypot(pos.x-place.x,pos.z-place.z)<120)$('#locality').textContent=place.name;
  else $('#locality').textContent=Math.hypot(pos.x,pos.z)<610?'人才公园':'南山后海';
}
setInterval(updateHud,250);
const route=new URLSearchParams(location.search),requestedView=route.get('walk');
if(route.get('inspect')==='taxi')openPanel('garage');
else if(['bridge','street'].includes(requestedView)){
  geo().then(data=>launch(requestedView==='street'&&route.get('photo')==='1'?photoStreet():data.views.find(view=>view.id===requestedView)||fallback))
    .catch(()=>notify('地图读取失败，请点击开始漫游重试。'));
}else if('requestIdleCallback' in window)requestIdleCallback(()=>geo().catch(()=>{}),{timeout:3000});
else setTimeout(()=>geo().catch(()=>{}),1400);
