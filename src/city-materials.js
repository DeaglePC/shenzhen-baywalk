import * as T from 'three';
import {random} from './city-geometry.js';
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
function facade(kind,seed){
  const rand=random(seed), glass=kind<3;
  return canvasTexture(512,512,(g,w,h)=>{
    const bw=glass?32:64,bh=glass?32:64,rows=h/bh,cols=w/bw;
    g.fillStyle=['#536978','#636e76','#427583','#a99e8e','#a6a6a1'][kind];g.fillRect(0,0,w,h);
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const x=i*bw,y=j*bh,r=rand(),shift=Math.round(rand()*12),lit=r>.94;
      if(glass){
        const grad=g.createLinearGradient(x,y,x+bw*.5,y+bh);
        grad.addColorStop(0,lit?'#9cafa9':`rgb(${104+shift},${133+shift},${148+shift})`);
        grad.addColorStop(.6,lit?'#819696':`rgb(${94+shift},${117+shift},${130+shift})`);
        grad.addColorStop(1,lit?'#708085':`rgb(${72+shift},${94+shift},${107+shift})`);
        g.fillStyle=grad;g.fillRect(x+1,y+1,bw-2,bh-3);
        if(r<.16){g.fillStyle='rgba(212,209,192,.22)';g.fillRect(x+2,y+2,bw-4,(4+rand()*14)|0);}
        if(r>.90){g.fillStyle='rgba(253,232,189,.46)';g.fillRect(x+3,y+3,bw*(.45+rand()*.4),1);}
        g.fillStyle=kind===2?'#82918e':'#87959b';g.fillRect(x,y+bh-2,bw,1);g.fillRect(x,y,1,bh);
        if(kind===1&&i%4===0){g.fillStyle='#acb5b6';g.fillRect(x,y,4,bh);}
      }else{
        g.fillStyle=r>.45?'#a4a198':'#aba79a';g.fillRect(x+1,y+1,bw-2,bh-2);
        g.fillStyle='#636e6b';g.fillRect(x+6,y+7,47,36);
        g.fillStyle=lit?'#c5b391':`rgb(${54+shift},${74+shift},${83+shift})`;g.fillRect(x+8,y+9,43,32);
        g.fillStyle='#c0bab0';g.fillRect(x+29,y+8,2,34);
        if(r<.55){g.fillStyle='#d6ccba';g.fillRect(x+8,y+9,8+rand()*8,27);}
        g.fillStyle='#737776';g.fillRect(x+3,y+45,52,4);g.fillStyle='#d1c8b5';g.fillRect(x+3,y+43,52,3);
        if(kind===4){g.fillStyle='#818a87';g.fillRect(x+4,y+39,52,2);for(let k=0;k<6;k++)g.fillRect(x+5+8*k,y+40,1,6);}
        if(r>.5){g.fillStyle='#888a86';g.fillRect(x+43,y+50,15,8);g.fillStyle='#bdb9af';g.fillRect(x+43,y+49,15,6);g.fillStyle='#858988';g.fillRect(x+46,y+50,8,3);}
      }
    }
  });
}
export function materials(){
  const standard=(options)=>new T.MeshStandardMaterial({...options,side:T.DoubleSide});
  const assets=['Facade005','Facade019A','Facade017','Facade020A',null,'Facade015'];
  const linearPhoto=(name)=>{const t=photo(name);t.colorSpace=T.NoColorSpace;return t;};
  const walls=assets.map((id,type)=>{
    if(!id)return standard({map:facade(4,476),roughness:.73,vertexColors:true});
    return standard({map:photo(id+'-Color.webp'),normalMap:linearPhoto(id+'-NormalGL.webp'),
      normalScale:new T.Vector2(.72,.72),roughnessMap:linearPhoto(id+'-Roughness.webp'),
      roughness:type===3?.92:.77,metalness:type===3?.09:.32,vertexColors:true});
  });
  walls.forEach((mat,index)=>{
    mat.emissive.setHex(0xffeac6);mat.emissiveIntensity=0;
    mat.emissiveMap=canvasTexture(512,512,(g)=>{
      g.fillStyle='#000';g.fillRect(0,0,512,512);
      const window=index<3?32:64,rand=random(42429+index);
      for(let x=0;x<512;x+=window)for(let y=0;y<512;y+=window){
        if(rand()>.28)continue;
        g.fillStyle=['#987c52','#c7bba2','#b1bdc0','#736a4d','#f0d2a4'][rand()*5|0];
        if(index<3)g.fillRect(x+3,y+4,window-6,window-10);
        else g.fillRect(x+8,y+9,rand()<.6?20:42,29);
      }
    });
  });
  const roof=standard({map:photo('concrete.webp'),color:0xa8aaa7,roughness:.94,vertexColors:true});
  const frontage=photo('retail-fronts.webp');
  // Outside-facing wall rings run right to left in the shop's local view.
  frontage.repeat.x=-1;
  const shop=standard({map:frontage,emissiveMap:frontage,emissive:0xffeee0,emissiveIntensity:.22,roughness:.65});
  return {
    walls,roof,shop, grass:standard({map:photo('grass.webp'),roughness:1,vertexColors:true}),
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
