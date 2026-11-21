import * as T from 'three';
import {random} from './city-geometry.js';
import {curtainWall} from './city-curtainwall.js';
export const asset=n=>import.meta.env.BASE_URL+'city/'+n;
const loader=new T.TextureLoader();
function canvasTexture(w,h,paint,repeat=true){
  const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}
export function photo(n){const t=loader.load(asset(n));t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;}
export function label(text,english,width=1024,background='#305d66'){
  return canvasTexture(width,192,(g,w,h)=>{
    g.fillStyle=background;g.fillRect(0,0,w,h);g.fillStyle='#f1e8cf';g.fillRect(35,26,3,139);
    g.font='600 72px "Microsoft YaHei",sans-serif';g.textBaseline='middle';g.fillText(text,65,76,w-112);
    g.font='400 24px Arial';g.fillText(english,68,143,w-100);
  },false);
}
export function materials(){
  const standard=(options)=>new T.MeshStandardMaterial({...options,side:T.DoubleSide});
  const linearPhoto=(name)=>{const t=photo(name);t.colorSpace=T.NoColorSpace;return t;};
  function masonryFacade(prefix){
    const mat=standard({map:photo(prefix+'-Color.webp'),normalMap:linearPhoto(prefix+'-NormalGL.webp'),
      roughnessMap:linearPhoto(prefix+'-Roughness.webp'),normalScale:new T.Vector2(.53,.53),roughness:.94,vertexColors:true});
    mat.emissive.setHex(0xffe8bb);mat.emissiveIntensity=0;mat.userData.cityProbe='district';
    // The window panels have a smooth roughness value, while stone
    // surrounds and mortar are rough. Use the aligned roughness map for both
    // reflection response and a recessed light mask for occupied rooms.
    mat.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float pane=1.-smoothstep(.36,.64,texture2D(roughnessMap,vRoughnessMapUv).g);
        roughnessFactor=mix(max(.70,roughnessFactor),.16,pane);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec2 room=floor((vMapUv+vec2(.045,.065))*6.);
        float lit=fract(sin(dot(mod(room,vec2(149.,73.)),vec2(12.9898,78.233)))*43758.5453);
        totalEmissiveRadiance*=pane*smoothstep(.70,.73,lit)*(.19+.30*lit);`);
    };return mat;
  }
  const masonry=masonryFacade('Facade020A'),residential=masonryFacade('Facade019A');
  const bambooGlass=curtainWall('bamboo'),atriumGlass=curtainWall('atrium',[1,1],'street');
  const walls=[curtainWall('silver',[38,64]),curtainWall('blue',[13,13]),curtainWall('office',[27,24]),
    masonry,residential,curtainWall('fins',[57,62]),bambooGlass,atriumGlass];
  const roof=standard({map:photo('concrete.webp'),color:0xa8aaa7,roughness:.94,vertexColors:true});
  const frontage=photo('retail-fronts.webp');
  // Outside-facing wall rings run right to left in the shop's local view.
  frontage.repeat.x=-1;
  const shop=standard({map:frontage,emissiveMap:frontage,emissive:0xffeee0,emissiveIntensity:.22,roughness:.65});
  return {
    walls,bambooGlass,atriumGlass,roof,shop, grass:standard({map:photo('grass.webp'),roughness:1,vertexColors:true}),
    gutter:standard({map:photo('asphalt.webp'),color:0x646963,roughness:.87}),
    kerb:standard({map:canvasTexture(256,48,(g,w,h)=>{
      const r=random(823);g.fillStyle='#b3b3a9';g.fillRect(0,0,w,h);
      for(let i=0;i<1700;i++){const v=Math.floor(125+r()*62);g.fillStyle='rgb('+v+','+(v+1)+','+(v-2)+')';g.fillRect(r()*w,r()*h,1+r()*1.5,1+r());}
      g.fillStyle='#747873';g.fillRect(0,0,w,2.5);
    }),roughness:.9}),
    asphalt:standard({map:photo('asphalt.webp'),color:0x7f8690,roughness:.9}),paving:standard({map:photo('pavers.webp'),color:0xe2d8c7,roughness:.87}),
    path:standard({map:photo('pavers.webp'),color:0xf7e9d6,roughness:.94}), running:standard({map:photo('asphalt.webp'),color:0xb57766,roughness:1}),
    curb:standard({color:0xb5aba0,roughness:.87}), rail:standard({color:0xb6b3a9,metalness:.58,roughness:.35}),
    cream:standard({color:0xe7ddd1,metalness:.3,roughness:.4}),dark:standard({color:0x3d4949,metalness:.44,roughness:.48}),
    wood:standard({color:0x8c6346,roughness:.79}), paint:standard({color:0xeae6d4,roughness:.83}),yellow:standard({color:0xc8a45c,roughness:.79}),
    lamp:standard({color:0xf5e5c7,emissive:0xebc28c,emissiveIntensity:.5}),glass:standard({color:0x668496,metalness:.57,roughness:.22}),
    trunk:standard({color:0x816e51,roughness:.99}),land:standard({color:0xb4b4a8,roughness:1}), field:standard({color:0x668e64,roughness:1})
  };
}
