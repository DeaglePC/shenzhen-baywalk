import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Instances,Surface,ribbon,segmentDistance,inArea} from './city-geometry.js';
import {footRoad} from './road-profiles.js';
import {signalAspect,signalCountdown} from './traffic-signals.js';
import {applyDetailMaps} from './procedural-textures.js';

// Models face local +Z. Combining the cast parts before instancing keeps each
// multi-part assembly (head + retroreflective border + brackets + visors) to one draw.
function hardware(){
  let parts=[];
  function piece(geometry,color,x,y,z){
    geometry.translate(x,y,z);const g=geometry.index?geometry.toNonIndexed():geometry;
    g.deleteAttribute('uv');const c=new T.Color(color),count=g.attributes.position.count,rgb=new Float32Array(count*3);
    for(let i=0;i<rgb.length;i+=3)c.toArray(rgb,i);
    g.setAttribute('color',new T.BufferAttribute(rgb,3));parts.push(g);
  }
  function box(x,y,z,w,h,d,color){piece(new T.BoxGeometry(w,h,d),color,x,y,z);}
  function disc(x,y,z,r,d,color,axis='z'){
    const g=new T.CylinderGeometry(r,r,d,20);if(axis==='z')g.rotateX(Math.PI/2);piece(g,color,x,y,z);
  }
  function shell(w,h,depth,r,z,color){
    const s=new T.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+r,y);s.lineTo(-x-r,y);s.quadraticCurveTo(-x,y,-x,y+r);
    s.lineTo(-x,-y-r);s.quadraticCurveTo(-x,-y,-x-r,-y);
    s.lineTo(x+r,-y);s.quadraticCurveTo(x,-y,x,-y-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    piece(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:5}),color,0,0,z);
  }
  function visor(x,y,r){
    // Open underneath, longer over the LED face than at either cheek.
    const surf=new Surface(),n=20;
    const edge=(t,front)=>{const a=-.35+3.84*t/n;return [x+r*Math.cos(a),y+r*Math.sin(a),.138+(front?.065+.125*Math.max(0,Math.sin(a)):0)];};
    for(let i=0;i<n;i++)surf.quad(edge(i,false),edge(i+1,false),edge(i+1,true),edge(i,true));
    piece(surf.geometry(),0x182122,0,0,0);
  }
  const finish=()=>{const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());parts=[];return g;};

  function head(ped){
    const w=ped?.31:1.52,h=ped?.70:.50;
    // Outer high-visibility dark backplate with crisp white retroreflective border (GB/Shenzhen standard)
    if(!ped){
      shell(w+.14,h+.14,.024,.10,.02,0xdce2e0);
      shell(w+.09,h+.09,.028,.08,.032,0x1d2326);
    }
    shell(w,h,.21,ped?.06:.224,-.14,0x6e787d);
    shell(w-.036,h-.037,.058,ped?.054:.21,.07,0x1e2627);
    for(const [x,y,r] of ped?[[0,.158,.120],[0,-.158,.120]]:[[-.444,0,.17],[0,0,.17],[.444,0,.17]]){
      disc(x,y,.131,r*1.08,.025,0x434d4f);disc(x,y,.152,r,.026,0x101819);visor(x,y,r*1.025);
    }
    for(const u of [-1,1]){
      const x=u*(ped?.09:.46);
      box(x,0,-.20,.064,ped?.31:.29,.15,0x455056);
      box(x,0,-.287,.094,.165,.06,0x7f888a);
    }
    return finish();
  }
  const vehicle=head(false),pedestrian=head(true);

  // Dual-digit LED countdown enclosure (mounted beside vehicle signal heads)
  shell(.58,.52,.20,.05,-.13,0x2a3235);
  shell(.52,.46,.04,.04,.07,0x111719);
  // Top & cheek hood visor for countdown glare protection
  box(0,.24,.17,.54,.024,.18,0x1a2224);
  box(-.26,.09,.15,.024,.30,.14,0x1a2224);
  box(.26,.09,.15,.024,.30,.14,0x1a2224);
  box(0,0,-.21,.10,.26,.14,0x475258);
  const countdownBox=finish();

  // Traffic enforcement camera + sunshield + mount
  box(0,.13,0,.24,.205,.48,0xb8bebd);box(0,.252,.04,.275,.037,.59,0xe3e5df);
  box(0,.13,.243,.204,.165,.023,0x293538);disc(0,.13,.275,.071,.045,0x111b21);
  disc(0,-.035,-.07,.043,.13,0x56646a,'y');const camera=finish();

  // LED flash illuminator
  box(0,.12,0,.205,.18,.13,0x77868b);box(0,.12,.073,.168,.138,.018,0xe3e9df);box(0,.01,0,.035,.10,.048,0x49565a);
  const illuminator=finish();

  // PTZ speed dome under cantilever
  disc(0,-.04,0,.148,.15,0xc7c9c2,'y');
  piece(new T.SphereGeometry(.133,14,8,0,Math.PI*2,Math.PI/2,Math.PI/2),0x253138,0,-.116,0);
  const dome=finish();

  // Roadside traffic signal controller cabinet (standard Shenzhen grey-white steel enclosure)
  box(0,.14,0,.78,.28,.54,0x7c807c); // concrete plinth
  box(0,.96,0,.70,1.36,.46,0xc9cfcc); // main cabinet body
  box(0,1.67,.01,.76,.07,.54,0xb4bcba); // overhanging rain cap
  box(0,.98,.235,.60,1.18,.016,0xd6dcda); // recessed front door panel
  box(.24,1.02,.25,.035,.16,.024,0x3c4448); // door handle
  box(-.18,1.35,.25,.14,.11,.008,0xe8b824); // high-voltage yellow warning badge
  for(let k=0;k<4;k++)box(0,.48+k*.075,.248,.46,.022,.015,0x646d70); // ventilation louvers
  const cabinet=finish();

  // Pedestrian crossing push-button / audible prompt unit mounted on ped poles
  box(0,0,0,.14,.32,.10,0x2d3a3d);
  box(0,.06,.054,.10,.12,.012,0xe9bd22);
  disc(0,-.06,.056,.032,.018,0xd74137);
  const pedButton=finish();

  // High-visibility black/yellow kerb bollard protecting crossing corners
  disc(0,.04,0,.09,.08,0x3a4044,'y');
  disc(0,.44,0,.062,.80,0x23282b,'y');
  disc(0,.62,0,.064,.14,0xf0bf1a,'y');
  disc(0,.34,0,.064,.12,0xf0bf1a,'y');
  piece(new T.SphereGeometry(.062,12,6,0,Math.PI*2,0,Math.PI/2),0xd8dde0,0,.84,0);
  const bollard=finish();

  return {vehicle,pedestrian,countdownBox,camera,illuminator,dome,cabinet,pedButton,bollard};
}

function symbol(shape){
  const size=192,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
  g.fillStyle='#fff';g.strokeStyle='#fff';g.lineWidth=17;g.lineCap='round';g.lineJoin='round';
  const line=(...points)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
  if(shape==='circle'){g.beginPath();g.arc(96,96,80,0,2*Math.PI);g.fill();}
  else if(shape==='left'||shape==='straight'){
    g.save();g.translate(96,96);if(shape==='left')g.rotate(-Math.PI/2);
    g.beginPath();for(const [i,[x,y]] of [[0,-77],[67,-10],[47,10],[14,-23],[14,72],[-14,72],[-14,-23],[-47,10],[-67,-10]].entries())i?g.lineTo(x,y):g.moveTo(x,y);
    g.closePath();g.fill();g.restore();
  }else{
    const walk=shape==='walk',x=walk?108:96;g.beginPath();g.arc(x,37,15,0,Math.PI*2);g.fill();
    line([x-3,62],[walk?90:96,108]);
    if(walk){line([102,70],[83,88],[62,93]);line([102,71],[116,89],[134,84]);line([90,110],[79,134],[60,155]);line([91,110],[108,132],[122,153]);}
    else{line([91,67],[76,76],[74,109]);line([101,67],[116,75],[118,109]);line([91,109],[88,156]);line([101,109],[104,156]);}
  }
  // Subtle LED matrix grid visible at close range
  g.globalCompositeOperation='source-atop';g.fillStyle='rgba(15,15,15,.62)';g.fillRect(0,0,size,size);
  g.fillStyle='white';for(let y=3;y<size;y+=6)for(let x=3;x<size;x+=6){g.beginPath();g.arc(x,y,2.40,0,Math.PI*2);g.fill();}
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

// GPU 7-segment dual-digit LED countdown shader (1 draw call for every signal countdown in the city)
function createCountdownMaterial(){
  return new T.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    toneMapped:false,
    uniforms:{},
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aDigits;
      attribute vec3 aTint;
      varying vec2 vUv;
      varying float vDigits;
      varying vec3 vTint;
      void main(){
        vUv = uv;
        vDigits = aDigits;
        vTint = aTint;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec2 vUv;
      varying float vDigits;
      varying vec3 vTint;

      float segH(vec2 p, float y, float w){
        vec2 d = abs(p - vec2(0., y)) - vec2(w, .055);
        return 1. - smoothstep(.0, .022, max(d.x, d.y));
      }
      float segV(vec2 p, float x, float y, float h){
        vec2 d = abs(p - vec2(x, y)) - vec2(.055, h);
        return 1. - smoothstep(.0, .022, max(d.x, d.y));
      }
      // Standard 7-segment bitmask for digits 0..9: bits [a,b,c,d,e,f,g]
      float digitMask(int n, vec2 p){
        if(n < 0 || n > 9) return 0.;
        int bits = 0;
        if(n == 0) bits = 63;
        else if(n == 1) bits = 6;
        else if(n == 2) bits = 91;
        else if(n == 3) bits = 79;
        else if(n == 4) bits = 102;
        else if(n == 5) bits = 109;
        else if(n == 6) bits = 125;
        else if(n == 7) bits = 7;
        else if(n == 8) bits = 127;
        else if(n == 9) bits = 111;
        float m = 0.;
        if((bits & 1) != 0)  m = max(m, segH(p,  .40, .20));
        if((bits & 2) != 0)  m = max(m, segV(p,  .22,  .20, .16));
        if((bits & 4) != 0)  m = max(m, segV(p,  .22, -.20, .16));
        if((bits & 8) != 0)  m = max(m, segH(p, -.40, .20));
        if((bits & 16) != 0) m = max(m, segV(p, -.22, -.20, .16));
        if((bits & 32) != 0) m = max(m, segV(p, -.22,  .20, .16));
        if((bits & 64) != 0) m = max(m, segH(p,  .00, .20));
        return m;
      }
      void main(){
        #include <logdepthbuf_fragment>
        int val = int(vDigits + .5);
        int tens = val / 10;
        int ones = val - tens * 10;
        vec2 pL = vec2((vUv.x - .28) * 1.95, (vUv.y - .5) * 1.25);
        vec2 pR = vec2((vUv.x - .72) * 1.95, (vUv.y - .5) * 1.25);
        float m = 0.;
        if(tens > 0) m = max(m, digitMask(tens, pL));
        m = max(m, digitMask(ones, pR));
        // Subtle dotted LED emitter feel
        vec2 cell = fract(vUv * vec2(26., 22.)) - .5;
        float dotLed = .62 + .38 * (1. - smoothstep(.18, .45, length(cell)));
        float alpha = clamp(m * dotLed, 0., 1.);
        if(alpha < .04) discard;
        gl_FragColor = vec4(vTint * (1.25 + .35 * dotLed), alpha);
      }`
  });
}

// GB5768 blue retroreflective overhead lane-guidance gantry signboards
function createLaneSignTexture(kind){
  const c=document.createElement('canvas');c.width=384;c.height=192;const g=c.getContext('2d');
  g.fillStyle='#0c529a';g.fillRect(0,0,384,192);
  g.strokeStyle='#f2f5f7';g.lineWidth=8;g.strokeRect(10,10,364,172);
  g.fillStyle='#f6f8fa';g.strokeStyle='#f6f8fa';g.lineWidth=14;g.lineCap='round';g.lineJoin='round';
  const cols=kind==='3lane'?['left','straight','sr']:['straight','sr'];
  const step=364/cols.length;
  for(let i=0;i<cols.length;i++){
    if(i>0){
      g.save();g.setLineDash([12,10]);g.lineWidth=4;g.beginPath();
      g.moveTo(10+i*step,22);g.lineTo(10+i*step,170);g.stroke();g.restore();
    }
    const cx=10+(i+.5)*step,type=cols[i];
    // Stem
    g.beginPath();g.moveTo(cx,152);g.lineTo(cx,58);g.stroke();
    if(type==='straight'||type==='sr'){
      g.beginPath();g.moveTo(cx-22,76);g.lineTo(cx,42);g.lineTo(cx+22,76);g.stroke();
    }
    if(type==='left'){
      g.beginPath();g.moveTo(cx,102);g.lineTo(cx-34,102);g.stroke();
      g.beginPath();g.moveTo(cx-18,82);g.lineTo(cx-40,102);g.lineTo(cx-18,122);g.stroke();
    }
    if(type==='sr'){
      g.beginPath();g.moveTo(cx,106);g.lineTo(cx+32,106);g.stroke();
      g.beginPath();g.moveTo(cx+18,88);g.lineTo(cx+38,106);g.lineTo(cx+18,124);g.stroke();
    }
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}

// High-resolution crisp road-surface directional lane arrow & diamond advance warning markings
function createYellowGridTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
  g.clearRect(0,0,256,256);
  g.strokeStyle='rgba(232,184,36,0.86)';
  g.lineWidth=11;
  g.strokeRect(8,8,240,240);
  g.lineWidth=6;
  g.beginPath();
  for(let k=-256;k<=512;k+=42){
    g.moveTo(k,8);g.lineTo(k+240,248);
    g.moveTo(k,248);g.lineTo(k+240,8);
  }
  g.save();g.beginPath();g.rect(12,12,232,232);g.clip();
  g.beginPath();
  for(let k=-256;k<=512;k+=46){
    g.moveTo(k,0);g.lineTo(k+256,256);
    g.moveTo(k,256);g.lineTo(k+256,0);
  }
  g.stroke();g.restore();
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}

function createRoadArrowTexture(kind){
  const c=document.createElement('canvas');c.width=128;c.height=384;const g=c.getContext('2d');
  g.clearRect(0,0,128,384);
  g.fillStyle='rgba(244,242,235,0.92)';
  if(kind==='diamond'){
    g.beginPath();g.moveTo(64,18);g.lineTo(110,192);g.lineTo(64,366);g.lineTo(18,192);g.closePath();
    g.lineWidth=18;g.strokeStyle='rgba(244,242,235,0.90)';g.stroke();
  }else if(kind==='straight'){
    g.beginPath();g.moveTo(64,14);g.lineTo(106,126);g.lineTo(78,126);g.lineTo(78,368);g.lineTo(50,368);g.lineTo(50,126);g.lineTo(22,126);g.closePath();g.fill();
  }else if(kind==='left'){
    g.beginPath();
    g.moveTo(76,368);g.lineTo(76,120);g.lineTo(44,120);g.lineTo(44,86);g.lineTo(8,144);g.lineTo(44,202);g.lineTo(44,168);g.lineTo(54,168);g.lineTo(54,368);
    g.closePath();g.fill();
  }else if(kind==='sr'){
    // Straight + right turn composite arrow
    g.beginPath();g.moveTo(52,14);g.lineTo(88,118);g.lineTo(64,118);g.lineTo(64,368);g.lineTo(40,368);g.lineTo(40,118);g.lineTo(16,118);g.closePath();g.fill();
    g.beginPath();g.moveTo(62,172);g.lineTo(92,172);g.lineTo(92,142);g.lineTo(122,190);g.lineTo(92,238);g.lineTo(92,208);g.lineTo(62,208);g.closePath();g.fill();
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}

export function signalFixtures(root,plan,m,grid){
  const kit=hardware();
  const metal=applyDetailMaps(new T.MeshStandardMaterial({vertexColors:true,roughness:.50,metalness:.32,side:T.DoubleSide}),'brushedMetal',{normalScale:.22});
  const steel=applyDetailMaps(new T.MeshStandardMaterial({color:0x828b8f,roughness:.44,metalness:.52}),'brushedMetal',{normalScale:.26});
  const hazardMat=new T.MeshStandardMaterial({color:0xf0bf1a,roughness:.42,metalness:.18});
  const tube=new T.CylinderGeometry(.88,1,1,12);
  const poles=new Instances(tube,steel,'路口镀锌立柱与悬臂');
  const base=new Instances(new T.BoxGeometry(),m.curb,'信号杆基础');
  const clamps=new Instances(new T.BoxGeometry(),steel,'灯组夹具与加劲肋');
  const hazardBands=new Instances(new T.CylinderGeometry(1.03,1.03,1,12),hazardMat,'信号杆黄黑警示反光带');
  const heads=new Instances(kit.vehicle,metal,'机动车横排三灯位');
  const pedHeads=new Instances(kit.pedestrian,metal,'行人双灯位及遮檐');
  const countdownBoxes=new Instances(kit.countdownBox,metal,'路口LED倒计时箱体');
  const cameras=new Instances(kit.camera,metal,'路口枪机及遮阳罩');
  const flashes=new Instances(kit.illuminator,metal,'路口方形补光器');
  const domes=new Instances(kit.dome,metal,'横杆下方球机');
  const cabinets=new Instances(kit.cabinet,metal,'路口交通信号控制机柜');
  const pedButtons=new Instances(kit.pedButton,metal,'行人过街语音提示按钮箱');
  const bollards=new Instances(kit.bollard,metal,'斑马线转角反光防撞柱');

  // Overhead blue GB5768 lane guidance signboards
  const signGeo=new T.BoxGeometry(1.55,.78,.04);
  const signBackMat=new T.MeshStandardMaterial({color:0x768085,roughness:.52,metalness:.46});
  const laneSigns3=new Instances(signGeo,[signBackMat,signBackMat,signBackMat,signBackMat,
    new T.MeshStandardMaterial({map:createLaneSignTexture('3lane'),roughness:.38,metalness:.18}),signBackMat],'悬臂三车道导向标志牌');
  const laneSigns2=new Instances(signGeo,[signBackMat,signBackMat,signBackMat,signBackMat,
    new T.MeshStandardMaterial({map:createLaneSignTexture('2lane'),roughness:.38,metalness:.18}),signBackMat],'悬臂双车道导向标志牌');

  // Road-surface directional lane arrows & pedestrian crossing diamond markings
  const flatQuad=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const arrowBatches={};
  for(const k of ['straight','left','sr','diamond']){
    const mat=new T.MeshStandardMaterial({
      map:createRoadArrowTexture(k),transparent:true,depthWrite:false,roughness:.88,
      polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
    });
    arrowBatches[k]=new Instances(flatQuad,mat,'路口路面导向标线 · '+k);
  }
  const yellowBoxBatch=new Instances(flatQuad,new T.MeshStandardMaterial({
    map:createYellowGridTexture(),transparent:true,depthWrite:false,roughness:.88,
    polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
  }),'十字路口黄色网格禁停区');
  for(const site of plan.sites){
    if(site.midblock||site.arms.length<3)continue;
    const primary=site.arms[0];
    const span=Math.max(8,Math.min(18,site.radius*.78));
    const crossing=grid.junctions.junctionAt(...site.center);
    if(crossing){
      const [a,b,c,d]=crossing.corners;
      // The two streets can meet obliquely. Carry both measured directions
      // into the painted grid, centred between the four carriageways.
      const axis=(p,q,r,s)=>new T.Vector3((q[0]-p[0]+s[0]-r[0])/2,0,(q[1]-p[1]+s[1]-r[1])/2);
      const x=axis(a,b,d,c),z=axis(a,d,b,c);
      if(x.x*z.z-x.z*z.x<0)z.negate();
      for(const dir of [x,z])dir.multiplyScalar(1+Math.min(.4,4/dir.length()));
      const center=crossing.corners.reduce((v,p)=>v.add(new T.Vector3(p[0]/4,0,p[1]/4)),new T.Vector3());
      center.y=.347;
      yellowBoxBatch.matrices.push(new T.Matrix4().makeBasis(x,new T.Vector3(0,1,0),z).setPosition(center));
      continue;
    }
    const syaw=Math.atan2(primary.dir[0],primary.dir[1]);
    yellowBoxBatch.at(site.center[0],.347,site.center[1],span,1,span,syaw);
  }

  const stopPaint=new Surface(),laneLines=new Surface(),icons=new Map(),diode=new T.PlaneGeometry(1,1);
  const colors={
    red:new T.Color('#ff333b').multiplyScalar(1.55),
    amber:new T.Color('#ffbc19').multiplyScalar(1.68),
    green:new T.Color('#35ffc0').multiplyScalar(1.45)
  };
  const unlit=new T.Color(.008,.013,.013);

  // Dynamic countdown displays (collected then built into one GPU InstancedMesh)
  const countdownItems=[];
  const placedCabinets=[];

  function lens(shape,x,y,z,yaw,size,arm,movement,color){
    let table=icons.get(shape);
    if(!table){
      const mat=new T.MeshBasicMaterial({map:symbol(shape),transparent:true,depthWrite:false,toneMapped:false});
      table={batch:new Instances(diode,mat,'LED · '+shape),items:[]};icons.set(shape,table);
    }
    table.batch.at(x,y,z,size,size,1,yaw,unlit);table.items.push({arm,movement,color});
  }

  function pole(p,h,r,yaw,major=true){
    const [x,z]=p;
    base.at(x,.382,z,r*3.3,.24,r*3.3,yaw);
    clamps.at(x,.53,z,r*2.95,.058,r*2.95,yaw); // bolted steel flange plate
    poles.between(x,.50,z,x,h,z,r);
    // Rain cap on top + inspection hatch near bottom
    clamps.at(x,h+.04,z,r*2.1,.06,r*2.1,yaw);
    clamps.at(x,1.12,z+r*.72,r*1.1,.41,r*.7,yaw);
    if(major){
      // Yellow/black high-visibility retroreflective warning collars at driver eye height
      hazardBands.at(x,1.42,z,r,.16,r,yaw);
      hazardBands.at(x,1.72,z,r,.16,r,yaw);
    }
    grid.bridgePiers.add({x,z,r:r*1.7,top:h},[x-.7,z-.7,x+.7,z+.7]);
  }

  function footing(anchor,right,dir,side){
    for(const move of [0,2.2,-2.2,4.8,-4.8,8.5,-8.5]){
      for(const extra of [0,.5,1.15,2.15,3.2,4.6]){
        const x=anchor[0]+right[0]*side*extra+dir[0]*move,z=anchor[1]+right[1]*side*extra+dir[1]*move;
        if(grid.roads.query(x,z).some(s=>!footRoad(s.rd)&&s.y<1&&segmentDistance(x,z,s.a,s.b)<s.width*.5+.46))continue;
        if(grid.buildings.query(x,z).some(b=>inArea(x,z,b))||grid.water.query(x,z).some(b=>inArea(x,z,b)))continue;
        return {p:[x,z],move};
      }
    }
    return null;
  }

  for(const arm of plan.approaches){
    const {dir:[dx,dz],right:[rx,rz],road}=arm,w=road.width;
    const yaw=Math.atan2(-dx,-dz);
    const roadYaw=Math.atan2(dx,dz);
    const at=(p,side,along=0)=>[p[0]+rx*side+dx*along,p[1]+rz*side+dz*along];
    const lo=road.oneway?-w*.5+.22:.11,hi=w*.5-.22,span=hi-lo;
    const bar=s=>[arm.stop[0]-arm.stopDir[1]*s,arm.stop[1]+arm.stopDir[0]*s];
    ribbon(stopPaint,[bar(lo),bar(hi)],.38,.346,1);

    // Physical lane arrows, solid approach lane dividers & advance pedestrian warning diamonds
    const laneCount=Math.max(1,Math.min(4,Math.round(span/3.35)));
    if(span>=3.0){
      const stopBack=(s,back)=>[
        arm.stop[0]-arm.stopDir[1]*s-arm.stopDir[0]*back,
        arm.stop[1]+arm.stopDir[0]*s-arm.stopDir[1]*back
      ];
      // Solid white approach lane dividers (20m back from stop bar)
      for(let l=1;l<laneCount;l++){
        const s=lo+span*l/laneCount;
        ribbon(laneLines,[stopBack(s,.5),stopBack(s,21)],.12,.344,1);
      }
      // Directional white lane arrows at 5.2m and 17.0m behind stop bar
      for(let l=0;l<laneCount;l++){
        const s=lo+span*(l+.5)/laneCount;
        let arrowKind='straight';
        if(laneCount===1)arrowKind='straight';
        else if(l===0&&arm.protectedLeft)arrowKind='left';
        else if(l===laneCount-1)arrowKind='sr';
        for(const back of [5.4,17.5]){
          const [ax,az]=stopBack(s,back);
          arrowBatches[arrowKind].at(ax,.349,az,1.35,1,4.6,yaw);
        }
        if(arm.mappedCrossing||arm.site.midblock){
          const [dxp,dzp]=stopBack(s,27.5);
          arrowBatches.diamond.at(dxp,.349,dzp,1.25,1,3.6,yaw);
        }
      }
    }

    const edge=w*.5+1.04;
    const outer=footing(at(arm.head,edge),arm.right,arm.dir,1);
    const foot=outer??footing(at(arm.head,-edge),arm.right,arm.dir,-1);
    const p=foot?.p??at(arm.head,edge),move=foot?.move??0,end=at(arm.head,foot&&!outer?hi-.21:lo+.21,move);
    // Check whether this signal mast or cantilever runs underneath or beside an elevated skywalk deck/stair (e.g. Coastal City)
    const underDeck=(px,pz)=>{
      if(!grid.platforms?.areaAt)return false;
      for(const [ox,oz] of [[0,0],[4.8,0],[-4.8,0],[0,4.8],[0,-4.8],[3.4,3.4],[-3.4,-3.4],[3.4,-3.4],[-3.4,3.4]]){
        if(grid.platforms.areaAt(px+ox,pz+oz))return true;
      }
      return false;
    };
    const midPt=[(p[0]+end[0])*.5,(p[1]+end[1])*.5];
    const deckClear=underDeck(p[0],p[1])||underDeck(midPt[0],midPt[1])||underDeck(end[0],end[1]);
    // Keep cantilever strictly below the 5.37m deck soffit so masts & overhead signs never poke through the 2F floor
    const y=deckClear?4.68:5.85;
    pole(p,deckClear?5.32:y+.28,.146,yaw,true);
    poles.between(p[0],y,p[1],end[0],y-.055,end[1],.089);
    // Triangular gusset stiffener brace connecting vertical mast & cantilever arm
    const braceTo=at(p,foot&&!outer?.95:-.95,0);
    poles.between(p[0],y-.72,p[1],braceTo[0],y-.03,braceTo[1],.042);

    // One roadside traffic signal controller cabinet per intersection (placed near first primary pole)
    if(!placedCabinets.some(c=>Math.hypot(c[0]-p[0],c[1]-p[1])<42)){
      const cabSpot=footing([p[0]+rx*1.35-dx*1.1,p[1]+rz*1.35-dz*1.1],arm.right,arm.dir,1);
      if(cabSpot){
        cabinets.at(cabSpot.p[0],.26,cabSpot.p[1],1,1,1,yaw);
        placedCabinets.push(cabSpot.p);
      }
    }

    const kinds=arm.protectedLeft?['left','straight']:['through'];
    for(const kind of kinds){
      const side=lo+span*(kind==='left'?.24:kind==='straight'?.75:.5);
      const [x,z]=at(arm.head,side,move-.36);
      heads.at(x,y-.06,z,1,1,1,yaw);
      for(let i=0;i<3;i++){
        const [lx,lz]=at([x,z],(i-1)*.444,-.171);
        lens(kind==='through'?'circle':kind,lx,y-.06,lz,yaw,.326,arm,kind,['red','amber','green'][i]);
      }
      // Attach real-time dual-digit LED countdown unit beside primary through/straight signal head
      if(kind==='straight'||kind==='through'){
        const [cx,cz]=at([x,z],1.16,0);
        countdownBoxes.at(cx,y-.06,cz,1,1,1,yaw);
        const [dx0,dz0]=at([cx,cz],0,-.125);
        countdownItems.push({x:dx0,y:y-.06,z:dz0,yaw,w:.42,h:.36,arm,movement:kind});
      }
    }

    // Overhead blue GB5768 lane guidance signboard mounted cleanly above the cantilever mast (skip when under skywalk deck)
    if(span>=5.2&&!deckClear){
      const signSide=arm.protectedLeft?lo+span*.50:lo+span*.22;
      const [sx,sz]=at(arm.head,signSide,move-.24);
      if(!underDeck(sx,sz))(arm.protectedLeft?laneSigns3:laneSigns2).at(sx,y+.54,sz,.92,.92,1,yaw);
    }

    if(arm.mappedCrossing||arm.site.midblock){
      // Each face looks back at a pedestrian entering from the opposite kerb.
      for(const side of [-1,1]){
        const pf=footing(at(arm.cross,side*(w/2+.62),1.35),arm.right,arm.dir,side);
        if(!pf)continue;
        const [x,z]=pf.p,px=-rx*side,pz=-rz*side,pyaw=Math.atan2(px,pz);
        pole([x,z],2.92,.068,pyaw,false);
        pedHeads.at(x+px*.19,2.44,z+pz*.19,1,1,1,pyaw);
        lens('stand',x+px*.36,2.598,z+pz*.36,pyaw,.224,arm,'walk','red');
        lens('walk',x+px*.36,2.282,z+pz*.36,pyaw,.224,arm,'walk','green');
        // Compact synchronized pedestrian LED countdown mounted cleanly atop ped signal head
        countdownBoxes.at(x+px*.19,2.94,z+pz*.19,.52,.52,.65,pyaw);
        countdownItems.push({x:x+px*.28,y:2.94,z:z+pz*.28,yaw:pyaw,w:.22,h:.20,arm,movement:'walk'});
        // Audible pedestrian crossing button box at 1.15m height
        pedButtons.at(x+px*.09,1.18,z+pz*.09,1,1,1,pyaw);
        // Reflective kerb safety bollards flanking crossing approach
        for(const bShift of [-2.4,2.4]){
          const bx=x+dx*bShift,bz=z+dz*bShift;
          if(!grid.roads.query(bx,bz).some(s=>!footRoad(s.rd)&&s.y<1&&segmentDistance(bx,bz,s.a,s.b)<s.width*.5+.32)){
            bollards.at(bx,.28,bz,1,1,1,pyaw);
          }
        }
      }
    }

    if(!arm.protectedLeft||span<6.1||!['primary','secondary','tertiary'].includes(road.kind))continue;
    const cf=footing(at(arm.stop,edge,-16),arm.right,arm.dir,1);if(!cf)continue;
    const origin=cf.p,station=-16+cf.move,tip=at(arm.stop,lo+.30,station);
    if(underDeck(origin[0],origin[1])||underDeck(tip[0],tip[1]))continue;
    pole(origin,6.76,.152,yaw,true);poles.between(origin[0],6.55,origin[1],tip[0],6.52,tip[1],.103);
    const lanes=Math.max(2,Math.min(5,Math.round(span/3.4)));
    for(let j=0;j<lanes;j++){
      const s=lo+span*(j+.49)/lanes,[x,z]=at(arm.stop,s,station),[bx,bz]=at(arm.stop,s+.35,station);
      cameras.at(x,6.66,z,1,1,1,yaw+.045);flashes.at(bx,6.62,bz,1,1,1,yaw);
    }
    domes.at(tip[0],6.38,tip[1],1,1,1,yaw);
  }

  stopPaint.mesh(root,m.paint,'信号路口停止线');
  laneLines.mesh(root,m.paint,'路口导向分道实线');
  yellowBoxBatch.flush(root,false,420);
  for(const b of Object.values(arrowBatches))b.flush(root,false,380);
  for(const part of [heads,pedHeads,countdownBoxes,poles,base,clamps,hazardBands,cameras,flashes,domes,cabinets,pedButtons,bollards,laneSigns3,laneSigns2]){
    part.flush(root,part===poles||part===cabinets,part===poles||part===heads||part===countdownBoxes||part===laneSigns3||part===laneSigns2?460:260);
  }
  for(const t of icons.values())t.mesh=t.batch.flush(root);

  // Build single GPU InstancedMesh for all live LED countdown digits
  let countdownMesh=null,digitAttr=null,tintAttr=null;
  if(countdownItems.length){
    const count=countdownItems.length;
    const cGeo=new T.PlaneGeometry(1,1);
    const digitBuf=new Float32Array(count);
    const tintBuf=new Float32Array(count*3);
    digitAttr=new T.InstancedBufferAttribute(digitBuf,1);
    tintAttr=new T.InstancedBufferAttribute(tintBuf,3);
    digitAttr.setUsage(T.DynamicDrawUsage);
    tintAttr.setUsage(T.DynamicDrawUsage);
    cGeo.setAttribute('aDigits',digitAttr);
    cGeo.setAttribute('aTint',tintAttr);
    countdownMesh=new T.InstancedMesh(cGeo,createCountdownMaterial(),count);
    countdownMesh.name='路口LED实时倒计时数显';
    const M=new T.Matrix4(),Q=new T.Quaternion(),P=new T.Vector3(),S=new T.Vector3(),Y=new T.Vector3(0,1,0);
    countdownItems.forEach((it,i)=>{
      P.set(it.x,it.y,it.z);Q.setFromAxisAngle(Y,it.yaw);S.set(it.w,it.h,1);
      M.compose(P,Q,S);countdownMesh.setMatrixAt(i,M);
    });
    countdownMesh.instanceMatrix.needsUpdate=true;
    countdownMesh.computeBoundingSphere();
    root.add(countdownMesh);
  }

  let last=-1;
  function update(seconds){
    plan.time=seconds;const tick=Math.floor(seconds);if(tick===last)return;last=tick;
    for(const {mesh,items} of icons.values()){
      let dirty=false;
      items.forEach((item,i)=>{
        const a=signalAspect(item.arm,item.movement,tick),on=a===item.color;
        if(on===item.on)return;item.on=on;dirty=true;mesh.setColorAt(i,on?colors[a]:unlit);
      });
      if(dirty)mesh.instanceColor.needsUpdate=true;
    }
    if(countdownMesh){
      for(let i=0;i<countdownItems.length;i++){
        const it=countdownItems[i];
        const info=signalCountdown(it.arm,it.movement,tick);
        const rem=Math.max(0,Math.min(99,Math.ceil(info.remaining)));
        digitAttr.setX(i,rem);
        const c=colors[info.aspect]||colors.red;
        tintAttr.setXYZ(i,c.r,c.g,c.b);
      }
      digitAttr.needsUpdate=true;
      tintAttr.needsUpdate=true;
    }
  }
  update(0);return update;
}
