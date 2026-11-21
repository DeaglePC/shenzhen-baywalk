import * as T from 'three';
import {Surface,Instances} from './city-geometry.js';
import {architecturalMetal, bayStone} from './city-curtainwall.js';

const height=392.5,columns=56,turn=Math.PI*2;
const section=[[0,30.8],[.045,34.4],[.12,36.25],[.22,36.65],[.34,36.5],
  [.48,35.4],[.62,32.5],[.74,28.1],[.83,21.8],[.89,15.9],[.95,8.7],[.987,2.75],[.9984,.81],[1,.42]];
function radius(t){
  let j=1;while(j<section.length-1&&t>section[j][0])j++;
  const [a,v]=section[j-1],[b,w]=section[j],l=b-a,s=T.MathUtils.clamp((t-a)/l,0,1);
  const slope=i=>{
    if(i===0)return (section[1][1]-section[0][1])/(section[1][0]-section[0][0]);
    if(i===section.length-1)return (section[i][1]-section[i-1][1])/(section[i][0]-section[i-1][0]);
    const left=(section[i][1]-section[i-1][1])/(section[i][0]-section[i-1][0]);
    const right=(section[i+1][1]-section[i][1])/(section[i+1][0]-section[i][0]);
    return left*right<=0?0:2*left*right/(left+right);
  };
  const s2=s*s,s3=s2*s;
  return (2*s3-3*s2+1)*v+(s3-2*s2+s)*l*slope(j-1)+(-2*s3+3*s2)*w+(s3-s2)*l*slope(j);
}
function polar(a,r,y,tangent=0){
  return [Math.sin(a)*r+Math.cos(a)*tangent,y,Math.cos(a)*r-Math.sin(a)*tangent];
}
function orbitWall(s,r,h0,h1,N,color,offset=0){
  for(let i=0;i<N;i++){
    const a=i*turn/N,b=(i+1)*turn/N;
    s.quad(polar(a,r,h0),polar(b,r,h0),polar(b,r,h1),polar(a,r,h1),
      [[r*a,h0+offset],[r*b,h0+offset],[r*b,h1+offset],[r*a,h1+offset]],color);
  }
}
function annulus(s,inner,outer,y,N){
  for(let i=0;i<N;i++){
    const a=i*turn/N,b=(i+1)*turn/N;
    const p=[polar(a,inner,y),polar(a,outer,y),polar(b,outer,y),polar(b,inner,y)];
    s.quad(...p,p.map(q=>[q[0]/3.2,q[2]/3.2]));
  }
}
function triangle(s,p,uv,color){
  const k=s.vertex(p[0],uv[0],color);s.vertex(p[1],uv[1],color);s.vertex(p[2],uv[2],color);
  s.indices.push(k,k+1,k+2);
}
function crownLites(occupied,sky) {
  // Each sheet spans two column halves. Alternating pleats meet along real
  // meridians; their specular normals come from their four non-coplanar corners.
  const floors=[.805,.827,.849,.866,345/height,.904,.932,.951,.969,.982,.991,.9984];
  const hues=[new T.Color('#f2f5f4'),new T.Color('#e6eded')];
  const fullWidth=28*2*1.37*3;
  function vertex(i,t,j) {
    const width=Math.sin(Math.PI*Math.max(0,(t-.795)/.21));
    const pleat=(i%2===0?.10:-.29-.57*width)*(j%2===0?1:.72);
    const angle=turn*(i+.5)/56;
    return polar(angle,Math.max(.62,radius(t)+pleat),height*t);
  }
  for(let j=0;j<floors.length-1;j++){
    const a=floors[j],b=floors[j+1],shell=a<345/height-.00001?occupied:sky;
    for(let i=0;i<56;i++){
      const panel=[vertex(i,a,j),vertex(i+1,a,j),vertex(i+1,b,j+1),vertex(i,b,j+1)];
      const u=i/56*fullWidth,v=(i+1)/56*fullWidth;
      const uv=[[u,height*a],[v,height*a],[v,height*b],[u,height*b]];
      const folds=(i+j)%2===0?[[0,1,2],[0,2,3]]:[[0,1,3],[1,2,3]];
      for(const f of folds)triangle(shell,f.map(k=>panel[k]),f.map(k=>uv[k]),hues[(i+j)%2]);
    }
  }
}
function cladding(group,m){
  const facade=new Surface(),crown=new Surface(),rails=new Surface(),screen=new Surface();
  const fin=new Surface(),ribs=new Surface(),brass=new Surface();
  const white=new T.Color('#e4edf1'),crownMetal=architecturalMetal(0xc8cdc9,.24);
  crownMetal.vertexColors=true;
  const mainFin=architecturalMetal(0xc4c9c6,.21);mainFin.vertexColors=true;mainFin.metalness=.74;mainFin.roughness=.25;
  mainFin.customProgramCacheKey=()=> 'column-cover-joints';
  mainFin.onBeforeCompile=shader=>{
    shader.vertexShader='varying float vColumnY;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vColumnY=position.y;');
    shader.fragmentShader='varying float vColumnY;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float grid=(vColumnY-38.07)/4.48,aa=max(.0001,fwidth(grid));
      float seam=(1.-smoothstep(.002,.004+aa*.50,abs(fract(grid+.5)-.5)));
      seam*=1.-smoothstep(.05,.29,aa);seam*=smoothstep(37.,39.,vColumnY);
      diffuseColor.rgb*=1.-seam*.67;
    `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor+=.21*seam;');
  };
  const bronze=architecturalMetal(0xb5966c,.24);
  const glass=m.bambooGlass;
  const skyGlass=new T.MeshPhysicalMaterial({color:0x9caeb8,vertexColors:true,metalness:.32,roughness:.103,clearcoat:.93,
    clearcoatRoughness:.08,transparent:true,opacity:.56,side:T.FrontSide,depthWrite:false,envMapIntensity:1.25});
  skyGlass.userData.cityProbe='district';
  const innerFrame=new Instances(new T.CylinderGeometry(.80,1,1,6,1,true),architecturalMetal(0xd3bc9b,.23),'空中大厅内部金属桁架');
  const lightTube=new T.MeshStandardMaterial({color:0xdbccb2,emissive:0xffc181,emissiveIntensity:.18,roughness:.37});
  m.walls.push(lightTube);
  const guides=new Instances(new T.CylinderGeometry(1,1,1,5,1,true),lightTube,'冠部内侧线性照明');
  const edge=new T.MeshStandardMaterial({color:0x536167,metalness:.52,roughness:.32,side:T.DoubleSide});
  const steps=66,N=112;
  for(let j=0;j<steps;j++){
    const t0=.035+j*(.805-.035)/steps,t1=.035+(j+1)*(.805-.035)/steps,y0=t0*height,y1=t1*height,r0=radius(t0),r1=radius(t1);
    for(let i=0;i<N;i++){
      const a=turn*i/N,b=turn*(i+1)/N;
      // 168 glass lites encircle a typical floor. The number of lights and
      // slab spacing remain consistent as the conical shell narrows.
      const u=i/N*168*1.37,v=(i+1)/N*168*1.37;
      const fold=(t,col)=> -.87*Math.max(0,(.125-t)/.09)*Math.pow(Math.sin(col*Math.PI/4),2);
      const A=polar(a,r0+fold(t0,i),y0),B=polar(b,r0+fold(t0,i+1),y0),C=polar(b,r1+fold(t1,i+1),y1),D=polar(a,r1+fold(t1,i),y1);
      facade.quad(A,B,C,D,[[u,y0],[v,y0],[v,y1],[u,y1]],white);
    }
  }
  crownLites(facade,crown);
  function band(s,t,h,depth){
    const y=t*height,r0=radius(t)+depth,r1=radius((y+h)/height)+depth;
    for(let i=0;i<112;i++){
      const a=i*turn/112,b=(i+1)*turn/112;
      s.quad(polar(a,r0,y),polar(b,r0,y),polar(b,r1,y+h),polar(a,r1,y+h));
    }
  }
  // The two full-width belts are visible in KPF's waterfront photograph.
  for(const t of [.327,.646]){
    band(screen,t,1.62,.11);
    for(let k=0;k<5;k++)band(rails,t+k*.00084,.095,.16);
    band(brass,t+.00428,.085,.17);
  }
  // Folded stainless-steel sections have different optical normals across
  // the chamfer and the face, where a cylindrical tube would look flat.
  const tones=[new T.Color('#a3adae'),new T.Color('#e0e5df'),new T.Color('#d1dbd9'),new T.Color('#859298')];
  function sweep(s,at,count){
    let prior;
    for(let j=0;j<=count;j++){
      const v=at(j/count),a=v[0],t=v[1],w=v[2],depth=v[3],r=radius(t)+.095;
      const q=[[-.5,0],[-.45,.32],[-.18,1],[.36,.79],[.50,0]].map(([side,front])=>polar(a,r+depth*front,t*height,w*side));
      if(prior)for(let f=0;f<4;f++)s.quad(prior[f],prior[f+1],q[f+1],q[f],undefined,tones[f]);
      prior=q;
    }
  }
  for(let i=0;i<columns;i++){
    const split=i%2?1:-1,root=2*Math.floor(i/2)+.5;
    sweep(fin,k=>{
      const t=.097+k*(.805-.097),a=i*turn/columns;
      return [a,t,.75-.17*k,.89-.19*k];
    },32);
    sweep(fin,k=>{
      const t=.097*k;
      // From 28 lower portals the structure opens to 56 tower columns.
      const blend=1-Math.pow(1-k,1.65),index=T.MathUtils.lerp(root,i+split,blend);
      return [index*turn/columns,t,1.06-.31*k,1.14-.25*k];
    },14);
    sweep(ribs,k=>{
      const t=.805+k*.133,index=T.MathUtils.lerp(i,root,k);
      return [index*turn/columns,t,.56-.23*k,.69-.27*k];
    },17);
    if(i%2===0)sweep(ribs,k=>[root*turn/columns,.938+.0604*k,.38-.28*k,.45-.32*k],12);
  }
  for(let i=0;i<28;i++)for(const side of [-1,1]){
    sweep(ribs,k=>{
      const t=.805+k*.133,index=2*i+.5+side*(1.5-k);
      return [index*turn/columns,t,.29-.10*k,.40-.14*k];
    },14);
  }
  const hallFloor=new Surface(),spandrel=new Surface(),spire=new Surface(),floor=345;
  const stoneFloor=new T.MeshStandardMaterial({color:0x979a94,metalness:.28,roughness:.28,side:T.DoubleSide});
  const capMetal=architecturalMetal(0xc6c8c5,.27);
  annulus(hallFloor,0,radius(floor/height)-.24,floor,112);
  orbitWall(spandrel,radius(floor/height)-.25,floor-.45,floor,112,new T.Color('#bcc4c1'));
  for(const t of [.900,.930,.956,.976,.986]){
    const r=radius(t)*.90,y=height*t;
    for(let i=0;i<28;i++){
      const p=polar(turn*(i+.25)/28,r,y),q=polar(turn*(i+1.25)/28,r,y);
      innerFrame.between(...p,...q,t>.956?.073:.11);
    }
  }
  for(let i=0;i<28;i++){
    const a=i*turn/28;
    for(const sign of [-1,1]){
      const A=polar(a,.94*radius(floor/height),floor),
        B=polar(a+sign*.087,.90*radius(.933),height*.933),
        C=polar(a+sign*.012,.88*radius(.979),height*.979);
      innerFrame.between(...A,...B,.26);innerFrame.between(...B,...C,.19);
      if(i%2===0){guides.between(...A,...B,.11);guides.between(...B,...C,.12);}
    }
    const p=polar(a,.81,height*.9984),q=polar(a+turn/28,.81,height*.9984);
    const u=polar(a,.42,height),v=polar(a+turn/28,.42,height);
    spire.quad(p,q,v,u);
  }
  annulus(spire,0,.42,height,28);
  hallFloor.mesh(group,stoneFloor,'345米空中大厅楼板');spandrel.mesh(group,m.rail,'空中大厅楼板包边');spire.mesh(group,capMetal,'不锈钢尖顶收口');
  innerFrame.flush(group);guides.flush(group);
  facade.mesh(group,glass,'低辐射弧面双层玻璃',true);crown.mesh(group,skyGlass,'锥形空中大厅玻璃');
  fin.mesh(group,mainFin,'不锈钢折面翼柱 · 基座分叉');
  ribs.mesh(group,crownMetal,'透光冠部斜交格构');
  screen.mesh(group,edge,'设备层暗背板');rails.mesh(group,m.rail,'设备层遮阳百叶');
  brass.mesh(group,bronze,'设备层细金属收边');
}
function lobby(group,m){
  const glassDrum=new Surface(),soffit=new Surface(),paving=new Surface(),channels=new Surface();
  const r=27.65,h=14.15,gaskets=new Instances(new T.CylinderGeometry(1,1,1,6,1,true),architecturalMetal(0x646f70,.28,'street'),'大堂门扇与压条');
  const stainless=architecturalMetal(0xa9ad9f,.25,'street');
  const bands=new Instances(new T.BoxGeometry(1,1,1),stainless,'大堂雨棚收边');
  const warm=new T.MeshStandardMaterial({color:0xe7b98a,emissive:0xffb56d,emissiveIntensity:.78,roughness:.48,side:T.DoubleSide});
  const core=new Surface(),thresholds=new Surface(),ceiling=new Surface(),elevators=new Surface();
  const limestone=bayStone();limestone.color.setHex(0xd5c6ae);limestone.name='大堂浅色石板';
  const portal=architecturalMetal(0x998c79,.35,'street');
  const lobbyLite=new T.MeshPhysicalMaterial({color:0xc0cdcd,metalness:.37,roughness:.096,transparent:true,opacity:.36,
    clearcoat:.85,clearcoatRoughness:.065,depthWrite:false,side:T.FrontSide,envMapIntensity:1.08});
  lobbyLite.userData.cityProbe='street';
  annulus(thresholds,16.4,r+.01,.238,112);
  annulus(ceiling,15.9,r,h-.07,112);
  for(let i=0;i<28;i++){
    const a=i*turn/28,b=(i+1)*turn/28,rad=16.45;
    const p=polar(a,rad,.24),q=polar(b,rad,.24),length=Math.hypot(q[0]-p[0],q[2]-p[2]);
    const door=i%4===1||i%4===2;
    function face(s,h0,h1,r0=rad){
      s.quad(polar(a,r0,h0),polar(b,r0,h0),polar(b,r0,h1),polar(a,r0,h1),
        [[0,h0],[length,h0],[length,h1],[0,h1]]);
    }
    if(door){
      face(elevators,.24,3.25,rad-.14);face(core,3.25,h);
      const mid=polar((a+b)*.5,rad-.09,.25),top=polar((a+b)*.5,rad-.09,3.17);
      gaskets.between(...mid,...top,.019);
      const loc=polar((a+b)*.5,rad+.05,3.43);bands.at(...loc,1.65,.06,.13,(a+b)*.5);
    }else face(core,.24,h);
    const rib=polar(a,rad+.03,.24),head=polar(a,rad+.03,h-.10);
    gaskets.between(...rib,...head,.032);
  }
  for(const radius of [18.4,21.8,25.3])annulus(channels,radius,radius+.052,h-.105,112);
  orbitWall(glassDrum,r,.24,h,112,new T.Color('#f0e6ce'));
  annulus(soffit,r-.12,radius(h/height)+.16,h,112);
  for(let i=0;i<4;i++){
    annulus(channels,r+1.1+i*1.2,r+1.17+i*1.2,h-.04,112);
  }
  annulus(paving,r-.4,49.2,.192,112);
  const box=new T.BoxGeometry(1,1,1),blades=new Instances(box,new T.MeshStandardMaterial({color:0x9d9b8d,roughness:.48,metalness:.53}),'大堂阴影百叶');
  for(let i=0;i<56;i++){
    const a=i/56*turn,P=polar(a,r+.08,.28),Q=polar(a,r+.08,h-.06);
    gaskets.between(...P,...Q,i%2?.058:.11);
    const next=(i+1)*turn/56;
    for(const y of [3.2,7.4,10.91]){
      const p=polar(a,r+.04,y),q=polar(next,r+.04,y);
      gaskets.between(...p,...q,y<4?.055:.037);
    }
    if(i%2===0){
      const at=polar(a,r+.04,2.65);
      bands.at(...at,.11,.54,.09,a);
    }
    if(i%4===0){
      const rot=a;
      const p=polar(a,r+1.0,3.1);
      bands.at(...p,3.65,.12,1.84,rot);
      for(const side of [-1,1]){
        const lo=polar(a,r+.18,.25,side*.89),hi=polar(a,r+.18,3.09,side*.89);
        gaskets.between(...lo,...hi,.055);
        const grip=polar(a,r+.23,1.09,side*.13),gripTop=polar(a,r+.23,1.68,side*.13);gaskets.between(...grip,...gripTop,.026);
      }
      for(let j=0;j<4;j++){
        const l=polar(a,r+.12,9.0+j*.46);
        blades.at(...l,2.7,.12,.17,rot);
      }
    }
  }
  paving.mesh(group,m.paving,'塔前花岗岩铺地');soffit.mesh(group,m.cream,'双层入口室外吊顶');channels.mesh(group,warm,'环形嵌入式照明');
  const polished=bayStone();polished.color.setHex(0xaaa9a1);polished.roughness=.31;
  core.mesh(group,limestone,'通高石材门厅内壁');thresholds.mesh(group,polished,'门厅石材地面');ceiling.mesh(group,m.cream,'门厅天花');elevators.mesh(group,portal,'退入式金属内门');
  glassDrum.mesh(group,lobbyLite,'后退式高透明入口大堂');gaskets.flush(group);bands.flush(group,true);blades.flush(group);
  const board=new T.Group();board.position.set(35.45,0,9.5);board.rotation.y=1.32;group.add(board);
  const c=document.createElement('canvas');c.width=1024;c.height=208;const ctx=c.getContext('2d');
  ctx.fillStyle='#393e40';ctx.fillRect(0,0,c.width,c.height);
  const random=(n)=>Math.abs(Math.sin(n*942.71)*46.21)%1;
  for(let i=0;i<4400;i++){ctx.fillStyle='rgba(175,179,175,'+(random(i)*.12)+')';ctx.fillRect(random(i+5)*1024,random(i+22)*208,2+random(i+12)*10,1);}
  ctx.font='500 68px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#ddd1ad';ctx.fillText('中国华润大厦',512,99);ctx.font='22px Arial';ctx.fillText('CHINA RESOURCES TOWER',512,153);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const stone=new T.MeshStandardMaterial({color:0x404748,roughness:.48});
  const obj=new T.Mesh(new T.BoxGeometry(6.7,1.38,.40),[stone,stone,stone,stone,new T.MeshStandardMaterial({map:tex,roughness:.46}),stone]);
  obj.position.y=.89;obj.castShadow=true;board.add(obj);
}
export function bamboo(root,m){
  const group=new T.Group();group.name='中国华润大厦 · 春笋';group.position.set(-263.3,0,-456.81);
  group.userData.excludeFromDistrictProbe=true;root.add(group);
  cladding(group,m);lobby(group,m);
}
