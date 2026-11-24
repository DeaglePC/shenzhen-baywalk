// Use the persistent host so a click on Start can lock before WebGL finishes loading.
export function mouseLook(host,onChange){
  const mouse=matchMedia('(any-pointer:fine)');
  const setting='baywalk.mouseSensitivity';
  let sensitivity=1;
  try{
    const saved=Number(localStorage.getItem(setting));
    if(Number.isFinite(saved)&&saved>=.25&&saved<=3)sensitivity=saved;
  }catch{}
  let turn=()=>{},wanted=false,request=null,failed=false;
  const ownsLock=()=>document.pointerLockElement===host;
  function state(){
    if(!mouse.matches)return 'touch';
    if(!host.requestPointerLock)return 'unsupported';
    if(wanted&&ownsLock())return 'locked';
    if(request&&wanted)return 'pending';
    return failed?'denied':'unlocked';
  }
  function release(){
    wanted=false;failed=false;
    if(ownsLock())document.exitPointerLock();
    onChange();
  }
  function reject(attempt){
    if(!attempt||request!==attempt)return;
    request=null;failed=wanted&&!ownsLock();
    if(!ownsLock())wanted=false;
    onChange();
  }
  function engage(){
    if(!mouse.matches||!host.requestPointerLock||request||ownsLock())return;
    // Direct links load without a user gesture. Leave the capture button available.
    if(navigator.userActivation?.isActive===false)return;
    const attempt={};request=attempt;wanted=true;failed=false;onChange();
    try{
      host.requestPointerLock()?.catch(()=>reject(attempt));
    }catch{reject(attempt);}
  }
  document.addEventListener('pointerlockerror',()=>reject(request));
  document.addEventListener('pointerlockchange',()=>{
    request=null;
    if(ownsLock()&&!wanted){document.exitPointerLock();return;}
    if(!ownsLock())wanted=false;
    failed=false;onChange();
  });
  document.addEventListener('mousemove',e=>{
    if(wanted&&ownsLock())turn(e.movementX*sensitivity,e.movementY*sensitivity);
  });
  mouse.addEventListener('change',()=>{if(!mouse.matches)release();else onChange();});
  window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  return {engage,release,get state(){return state();},bind(fn){turn=fn;},
    get sensitivity(){return sensitivity;},
    set sensitivity(value){
      if(!Number.isFinite(value))return;
      sensitivity=Math.min(3,Math.max(.25,value));
      try{localStorage.setItem(setting,String(sensitivity));}catch{}
    }};
}
