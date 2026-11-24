import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const choices=[
  [0x385253,0x304554,1.07,'pack'],[0xc2a984,0x54645a,.93,'sunhat'],
  [0xebe5d3,0x3f4448,.97,'messenger'],[0x4d7479,0x394e59,1.04,'cap'],
  [0x697d92,0x4c4f50,1.12,'cap'],[0xb46049,0x3f3939,1.00,'pack'],
  [0x917d62,0x3c535e,.96,'sunhat'],[0xa5b489,0x586963,1.09,'messenger'],
  [0x424c61,0x545047,1.02,'pack'],[0x896d81,0x444657,.96,'cap']
];

export function fitWalker(actor,index){
  const [shirt,trousers,width,kit]=choices[index%choices.length];
  actor.traverse(o=>{
    if(!o.isMesh)return;
    const recolor=mat=>{
      const name=mat.name.toLowerCase();
      const color=/original top|full-length top/.test(name)?shirt:/original bottom|tailored trousers/.test(name)?trousers:null;
      if(color===null)return mat;
      const finish=mat.clone();finish.color.setHex(color);
      if(finish.map){
        // The Maya source has a plum dye painted into the image. Recover its
        // cloth relief before applying the colour selected for this walker.
        finish.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
            #ifdef USE_MAP
              vec4 clothSample=texture2D(map,vMapUv);
              float weave=clamp(dot(clothSample.rgb,vec3(.213,.715,.072))*4.2+.22,.22,1.18);
              diffuseColor.rgb*=weave;diffuseColor.a*=clothSample.a;
            #endif
          `);
        };
        finish.customProgramCacheKey=()=>'walker-cloth-dye';
      }
      return finish;
    };
    o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);
  });
  actor.updateMatrixWorld(true);
  const cloth=new T.MeshStandardMaterial({color:index%2?0x9b825e:0x394647,roughness:.91});
  const strap=new T.MeshStandardMaterial({color:0x414443,roughness:.86});
  const ellipsoid=new T.SphereGeometry(1,16,10);
  function piece(parent,geo,mat,x,y,z,sx,sy,sz){
    const obj=new T.Mesh(geo,mat);obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.castShadow=true;parent.add(obj);return obj;
  }
  const bone=actor.getObjectByName(kit==='cap'||kit==='sunhat'?'head':'spine_03');
  if(bone){
    const anchor=bone.getWorldPosition(new T.Vector3());
    const g=new T.Group();actor.add(g);g.position.copy(actor.worldToLocal(anchor));
    if(kit==='cap'||kit==='sunhat'){
      const hat=kit==='sunhat';
      piece(g,ellipsoid,cloth,0,.171,-.014,.101,.079,.105);
      piece(g,ellipsoid,cloth,0,.148,hat?-.01:.069,hat?.159:.094,.012,hat?.153:.105);
    }else{
      const pack=kit==='pack',x=pack?0:.17;
      piece(g,new RoundedBoxGeometry(1,1,1,3,.13),cloth,x,pack?-.085:-.24,-.156,pack?.27:.21,pack?.33:.20,.11);
      for(const side of (pack?[-1,1]:[1])){
        const band=piece(g,new T.TorusGeometry(.11,.014,6,24),strap,side*.11,-.05,-.003,1,1.6,1);
        band.rotation.y=Math.PI/2;band.rotation.z=pack?0:.46;
      }
    }
    bone.attach(g);
  }
  actor.scale.x*=width;actor.scale.z*=.88+.12*width;
}
