const periodFiles={sunset:'sunset',day:'day',dusk:'dusk',night:'dusk',overcast:'flowerbed-overcast'};
const downloads=new Map();

export function skyFileFor(period,daylight=false){
  return Object.hasOwn(periodFiles,period)?periodFiles[period]:daylight?'day':'sunset';
}

// Share the compressed file even when a click lands halfway through a download.
// The landing page never needs to import Three or hold decoded HDR pixels.
function loadSkyFile(key,priority,signal){
  const existing=downloads.get(key);
  if(existing&&!existing.signal?.aborted)return existing.promise;
  const promise=fetch('/media/'+key+'.hdr',{priority,signal}).then(response=>{
    if(!response.ok)throw new Error(`Sky HDR: HTTP ${response.status}`);
    return response.blob();
  }).catch(error=>{
    if(downloads.get(key)?.promise===promise)downloads.delete(key);
    throw error;
  });
  downloads.set(key,{promise,signal});
  return promise;
}

export async function takeSkyFile(key,priority){
  const pending=loadSkyFile(key,priority);
  const file=await pending;
  // The renderer now owns the decode and caches the resulting texture.
  if(downloads.get(key)?.promise===pending)downloads.delete(key);
  return file;
}

const isMobileDevice=typeof navigator!=='undefined'&&(/iPad|iPhone|iPod|Android|Mobile|Mobi/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));

export function homeSkyPreloader(firstPeriod){
  const order=new Set([skyFileFor(firstPeriod),...Object.values(periodFiles)]);
  const idle=()=>new Promise(resolve=>{
    if(window.requestIdleCallback)window.requestIdleCallback(resolve);
    else setTimeout(resolve,120);
  });
  let enabled=false,generation=0,transfer;
  async function refresh(keepFile){
    const token=++generation;
    if(transfer&&transfer.key!==keepFile)transfer.controller.abort();
    transfer=null;
    if(isMobileDevice||!enabled||document.readyState!=='complete'||document.hidden||navigator.connection?.saveData)return;
    await new Promise(requestAnimationFrame);
    for(const key of order){
      if(token!==generation)return;
      if(downloads.has(key)&&!downloads.get(key).signal?.aborted)continue;
      await idle();
      if(token!==generation)return;
      const controller=new AbortController();
      transfer={key,controller};
      try{await loadSkyFile(key,'low',controller.signal);}
      catch{/* Roaming can retry a speculative request. */}
      finally{if(transfer?.controller===controller)transfer=null;}
    }
  }
  window.addEventListener('load',()=>refresh(),{once:true});
  document.addEventListener('visibilitychange',()=>refresh());
  let saveData=navigator.connection?.saveData;
  navigator.connection?.addEventListener('change',()=>{
    if(saveData===navigator.connection.saveData)return;
    saveData=navigator.connection.saveData;refresh();
  });
  return {
    setActive(value){
      if(enabled===value)return;
      enabled=value;refresh();
    },
    enterWorld(key){
      enabled=false;refresh(key);
      // A direct link or an immediate Start can fetch the chosen sky while
      // the map and world module load. The renderer awaits this same file.
      loadSkyFile(key,'auto').catch(()=>{});
    }
  };
}
