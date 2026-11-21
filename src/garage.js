import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {VEHICLE_CATALOG} from './vehicles.js';

const types=['出租车','轿车','SUV','MPV','轿车','微型车'];
export function showGarage(body){
  body.innerHTML='<div class="garage-grid"><div class="garage-stage"><span class="model-status">载入模型…</span><div class="model-caption"></div></div><div class="garage-side"><p class="side-title">城市车辆 · 6 款</p></div></div>';
  const stage=body.querySelector('.garage-stage'),side=body.querySelector('.garage-side'),label=stage.querySelector('.model-caption'),status=stage.querySelector('.model-status');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});stage.prepend(renderer.domElement);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.05,90),controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.enableDamping=true;controls.minDistance=2.8;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.495;controls.minPolarAngle=.18;
  controls.autoRotate=true;controls.autoRotateSpeed=.52;controls.addEventListener('start',()=>controls.autoRotate=false);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();scene.environment=env.texture;
  scene.environmentIntensity=.84;
  const soft=new T.HemisphereLight(0xe4effa,0x594f47,.65),key=new T.DirectionalLight(0xffe7ca,2.15);key.position.set(3,5,4);scene.add(soft,key);
  const matte=document.createElement('canvas');matte.width=matte.height=128;const ctx=matte.getContext('2d'),grad=ctx.createRadialGradient(64,64,5,64,64,64);grad.addColorStop(0,'rgba(0,0,0,.85)');grad.addColorStop(.55,'rgba(0,0,0,.54)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:new T.CanvasTexture(matte),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.015;scene.add(shadow);
  const cache=new Map(),loader=new GLTFLoader();let token=0,active=true,current=null,raf;
  function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/Math.max(stage.clientHeight,1);camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();
  function destroy(model){const materials=new Set(),textures=new Set();model.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});for(const m of materials){for(const val of Object.values(m))if(val?.isTexture)textures.add(val);m.dispose();}for(const t of textures)t.dispose();}
  async function select(v,i){
    const seq=++token;status.textContent='载入模型…';label.textContent=v.name;
    side.querySelectorAll('button').forEach((b,j)=>b.classList.toggle('selected',i===j));
    if(!cache.has(v.id))cache.set(v.id,loader.loadAsync('/models/'+v.id+'.glb').then(g=>{if(!active)destroy(g.scene);return g.scene;}));
    try{
      const model=await cache.get(v.id);if(!active||seq!==token)return;if(current)scene.remove(current);scene.add(model);current=model;
      const [l,w,h]=v.size;shadow.scale.set(w*1.65,l*1.4,1);controls.target.set(0,h*.45,0);camera.position.set(l*.90,h*1.26,l*.85);controls.update();
      status.textContent='拖动旋转 · 滚轮缩放';label.textContent=v.name+'　'+Math.round(l*1000)+' × '+Math.round(w*1000)+' × '+Math.round(h*1000)+' mm';
    }catch(e){status.textContent='模型载入失败，点击车型重试';cache.delete(v.id);}
  }
  VEHICLE_CATALOG.forEach((v,i)=>{const b=document.createElement('button');b.className='model-choice';b.append(v.name);const tag=document.createElement('small');tag.textContent=types[i];b.append(tag);b.onclick=()=>select(v,i);side.append(b);});
  select(VEHICLE_CATALOG[0],0);
  function draw(){if(!active)return;raf=requestAnimationFrame(draw);controls.update();renderer.render(scene,camera);}draw();
  return ()=>{active=false;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();for(const p of cache.values())p.then(m=>{if(m.parent)scene.remove(m);destroy(m);}).catch(()=>{});shadow.geometry.dispose();shadow.material.map.dispose();shadow.material.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();};
}
