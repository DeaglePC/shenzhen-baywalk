import {icon} from './icons.js';
import {t,placeLabel} from './i18n.js';
let raster;
const full = 6400, size=2304, origin=size/2, ratio=size/full;
const paths = new Set(['path','footway','cycleway','pedestrian','steps','track']);

function surface(map){
  if (raster) return raster;
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d');ctx.fillStyle='#263035';ctx.fillRect(0,0,size,size);
  ctx.setTransform(ratio,0,0,ratio,origin,origin);
  function line(points, close=false){
    points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));if(close)ctx.closePath();
  }
  function poly(feature,color){
    ctx.fillStyle=color;ctx.beginPath();line(feature.p,true);for(const h of feature.holes || [])line(h,true);ctx.fill('evenodd');
  }
  for(const f of map.land)if(/park|forest|grass|garden|wood|scrub|meadow|recreation|pitch|grassland/.test(f.kind))poly(f,'#33483e');
  for(const f of map.water)poly(f,'#264d58');
  for(const f of map.buildings)poly(f,'#495354');
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const f of map.roads){
    if(f.tunnel)continue;
    const major=/primary|motorway|trunk/.test(f.kind), foot=paths.has(f.kind);
    ctx.strokeStyle=major?'#c19b75':foot?'#58675c':'#727a77';ctx.lineWidth=Math.max(foot?1.7:4,(f.width||5)*.85);
    ctx.beginPath();line(f.p);ctx.stroke();
  }
  raster=c;return c;
}
function drawBase(ctx,map,cx,cz,scale,w,h){
  ctx.fillStyle='#1c292d';ctx.fillRect(0,0,w,h);
  const sw=w*ratio/scale,sh=h*ratio/scale;
  ctx.drawImage(surface(map),origin+cx*ratio-sw/2,origin+cz*ratio-sh/2,sw,sh,0,0,w,h);
}
function arrow(ctx,x,y,heading){
  ctx.save();ctx.translate(x,y);ctx.rotate(heading);
  ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,8);ctx.lineTo(0,5);ctx.lineTo(-7,8);ctx.closePath();
  ctx.strokeStyle='#142429';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#ff8d55';ctx.fill();ctx.restore();
}
export function createMiniMap(panel){
  const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d');
  const arrow=panel.querySelector('.map-heading');
  // Pan the extra margin between repaints. The heading rotates independently.
  const margin=32,scale=.55;
  let width=0,height=0,centerX=NaN,centerZ=NaN,lastX,lastZ,lastHeading;
  new ResizeObserver(([entry])=>{
    width=entry.contentRect.width;
    height=entry.contentRect.height;
    centerX=NaN;
  }).observe(panel);
  return (map,pos)=>{
    if(!width||!height)return;
    const w=width+2*margin,h=height+2*margin,pr=Math.min(devicePixelRatio,2);
    const pixelsW=Math.round(w*pr),pixelsH=Math.round(h*pr);
    if(canvas.width!==pixelsW||canvas.height!==pixelsH){
      canvas.width=pixelsW;canvas.height=pixelsH;
      canvas.style.width=w+'px';canvas.style.height=h+'px';
      ctx.setTransform(pixelsW/w,0,0,pixelsH/h,0,0);
      centerX=NaN;
    }
    let dx=(centerX-pos.x)*scale,dz=(centerZ-pos.z)*scale;
    if(!Number.isFinite(dx)||Math.abs(dx)>margin||Math.abs(dz)>margin){
      drawBase(ctx,map,pos.x,pos.z,scale,w,h);
      centerX=pos.x;centerZ=pos.z;dx=dz=0;
    }
    if(dx!==lastX||dz!==lastZ){
      canvas.style.transform=`translate3d(${dx-margin}px,${dz-margin}px,0)`;
      lastX=dx;lastZ=dz;
    }
    if(pos.heading!==lastHeading){
      arrow.style.transform=`rotate(${pos.heading}rad)`;
      lastHeading=pos.heading;
    }
  };
}
export function showAtlas(body,map,current,player,onChoose){
  body.innerHTML='<div class="map-grid"><div class="map-stage"><canvas aria-label="'+t('atlasCanvasAria')+'"></canvas><div class="zoom"><button class="icon-button" aria-label="'+t('atlasZoomIn')+'">'+icon('plus')+'</button><button class="icon-button" aria-label="'+t('atlasZoomOut')+'">'+icon('minus')+'</button></div><div class="map-credit">© <a target="_blank" rel="noopener" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></div></div><div class="atlas-side"><p class="side-title">'+t('atlasDestinations')+'</p><div class="destinations"></div><p class="map-hint">'+t('atlasHint')+'</p><button class="primary">'+t('atlasStartHere')+'</button></div></div>';
  const canvas=body.querySelector('canvas'),ctx=canvas.getContext('2d');
  let selected=current, cx=player?.x??0,cz=player?.z??-90,zoom=1.1,lut=[],drag=null,paintFrame=0;
  let selectionNamed=false;
  function select(place){selected=place;selectionNamed=true;}
  const places=body.querySelector('.destinations');
  for(const v of map.views){
    const b=document.createElement('button');b.className='place';b.innerHTML=icon('pin');b.append(placeLabel(v));b.onclick=()=>{select(v);cx=v.x;cz=v.z;paint();};places.append(b);
  }
  const scale=()=>Math.min(canvas.clientWidth,canvas.clientHeight)/1750*zoom;
  const updateZoom=amount=>{zoom=Math.max(.24,Math.min(6,zoom*amount));schedulePaint();};
  const zoomButtons=body.querySelectorAll('.zoom button');zoomButtons[0].onclick=()=>updateZoom(1.5);zoomButtons[1].onclick=()=>updateZoom(1/1.5);
  function schedulePaint(){
    if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;paint();});
  }
  function paint(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const compact=w<700||h<450;
    const pr=Math.min(devicePixelRatio,2),pw=Math.round(w*pr),ph=Math.round(h*pr);
    if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
    ctx.setTransform(pr,0,0,pr,0,0);
    const s=scale();drawBase(ctx,map,cx,cz,s,w,h);
    const view=([x,z])=>[w/2+(x-cx)*s,h/2+(z-cz)*s];const [ox,oz]=view([0,0]);
    ctx.strokeStyle='#ffa67a90';ctx.setLineDash([5,7]);ctx.lineWidth=1;ctx.beginPath();ctx.arc(ox,oz,3000*s,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    function drawPlaceName(place,x,y,active){
      const text=placeLabel(place);
      ctx.font=(active?'bold ':'')+'12px "Microsoft YaHei",sans-serif';
      const left=compact?Math.max(4,Math.min(x+10,w-ctx.measureText(text).width-4)):x+10;
      const baseline=compact?Math.max(15,y-6):y-6;
      ctx.lineWidth=3;ctx.strokeStyle='#202728';ctx.strokeText(text,left,baseline,w-8);
      ctx.fillStyle=active?'#ffc6a0':'#f2f1e8';ctx.fillText(text,left,baseline,w-8);
    }
    lut=[];for(const place of [...map.views,...(selected.id==='custom'?[selected]:[])]){
      const [x,y]=view([place.x,place.z]),active=selected.id===place.id;lut.push({x,y,place});
      ctx.beginPath();ctx.arc(x,y,active?6.5:4.5,0,Math.PI*2);ctx.fillStyle=active?'#ff925b':'#f1efda';ctx.fill();ctx.strokeStyle='#202728';ctx.lineWidth=2;ctx.stroke();
      if(!compact)drawPlaceName(place,x,y,active);
    }
    if(player){const [x,y]=view([player.x,player.z]);arrow(ctx,x,y,player.heading);}
    if(compact&&selectionNamed){
      const [x,y]=view([selected.x,selected.z]);
      if(x>=0&&x<w&&y>=0&&y<h)drawPlaceName(selected,x,y,true);
    }
    ctx.fillStyle='#fff';ctx.font='bold 12px monospace';ctx.fillText('N',14,23);ctx.fillText('↑',14,39);
    [...places.children].forEach((el,i)=>el.classList.toggle('selected',selected.id===map.views[i].id));
  }
  canvas.onwheel=e=>{e.preventDefault();updateZoom(Math.exp(-e.deltaY*.0015));};
  canvas.onpointerdown=e=>{if(drag)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx,cz};};
  function pan(e){
    const s=scale();
    cx=Math.max(-3000,Math.min(3000,drag.cx-(e.clientX-drag.x)/s));
    cz=Math.max(-3000,Math.min(3000,drag.cz-(e.clientY-drag.y)/s));
    schedulePaint();
  }
  canvas.onpointermove=e=>{if(drag?.id===e.pointerId)pan(e);};
  canvas.onpointerup=e=>{if(drag?.id!==e.pointerId)return;const clicked=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5;
    if(!clicked)pan(e);
    drag=null;if(!clicked)return;
    if(paintFrame){cancelAnimationFrame(paintFrame);paintFrame=0;paint();}
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    let hit=null,nearest=16;
    for(const point of lut){
      const distance=Math.hypot(point.x-x,point.y-y);
      if(distance<nearest){nearest=distance;hit=point.place;}
    }
    if(hit)select(hit);
    else{
      const px=cx+(x-r.width/2)/scale(),pz=cz+(y-r.height/2)/scale();let best=null,bd=Infinity;
      for(const road of map.roads){if(road.tunnel||/motorway|trunk|construction/.test(road.kind))continue;
        for(let i=1;i<road.p.length;i++){
          const [a,b]=road.p[i-1],[c,d]=road.p[i],dx=c-a,dz=d-b,l2=dx*dx+dz*dz;if(!l2)continue;
          const t=Math.max(0,Math.min(1,((px-a)*dx+(pz-b)*dz)/l2)),rx=a+dx*t,rz=b+dz*t,dist=(rx-px)**2+(rz-pz)**2;
          if(dist<bd&&Math.hypot(rx,rz)<2995){best={id:'custom',name:road.name||'自选街道',x:rx,z:rz,lookX:rx+dx,lookZ:rz+dz};bd=dist;}
        }
      }
      if(best)select(best);
    }paint();
  };canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(drag?.id===e.pointerId)drag=null;};
  body.querySelector('.primary').onclick=()=>onChoose(selected);
  const observer=new ResizeObserver(schedulePaint);observer.observe(canvas);paint();
  return ()=>{observer.disconnect();cancelAnimationFrame(paintFrame);};
}
