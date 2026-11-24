import * as T from 'three';
import {Surface, Instances, ribbon, inRing, bounds} from './city-geometry.js';

const TAU=Math.PI*2, lerp=T.MathUtils.lerp, clamp=T.MathUtils.clamp;
const ease=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);
const white=new T.Color('#f1f0e7');
const bowlID=-9244350, connectorID=-9244351;
const CX=235.7,CZ=-769.8, ang=-.011;
const funnelCut=27.0;

// Transverse stations follow the mapped outline of the two halls and the east
// stadium, including the inclined west wall and the straight cut of the Sea Gate.
// North x,z; south x,z; ridge, north/south springing above the plaza (metres).
const sections=[
  [-185.5,-879,-146,-761,29.3,14,12],[-173,-883.4,-136,-753,33.3,7.1,6.5],
  [-139,-883.8,-112,-746.7,36.0,6.0,6.0],[-98,-883.1,-78,-738.7,37.0,6.1,6.0],
  [-58,-881.7,-41,-728.6,37.6,6.2,6.0],[-17,-881.6,-4,-718.8,38.5,6.0,6.2],
  [26,-881.2,34,-710,35.6,7.2,6.2],[52,-880,50,-710.5,31.5,10.6,7.8],
  [79,-869,81,-706.4,29.2,18.5,18.0],[96,-866,105,-693.2,31.3,21.3,20.6],
  [125,-873,134,-680,36.6,15.6,16.0],[157,-880.4,162,-668,40.9,7.9,10],
  [187,-884.7,189,-655.9,43.2,6.2,6.1],[216,-888,218,-648.3,45.5,6,6],
  [241,-889.4,246,-648.2,46.6,6,6],[265,-885.3,271,-653.9,46.8,6,6.1],
  [288,-877.2,292,-663,47.2,6,6],[309,-864.7,309,-673,47.5,6,6.5],
  [326.9,-848.3,329.1,-693.3,46.1,6.6,6.8],
];
const pathX=sections.map(s=>(s[0]+s[2])/2);
function station(x,k) {
  let i=0;
  while(i<pathX.length-2&&pathX[i+1]<x)i++;
  const ax=pathX[i],bx=pathX[i+1],w=bx-ax,t=clamp((x-ax)/w,0,1);
  const prev=Math.max(0,i-1),next=Math.min(sections.length-1,i+2);
  const y0=sections[i][k],y1=sections[i+1][k];
  const m0=(y1-sections[prev][k])/(bx-pathX[prev]);
  const m1=(sections[next][k]-y0)/(pathX[next]-ax);
  return y0*(1-t)**2*(1+2*t)+y1*t*t*(3-2*t)+w*t*(1-t)*(m0*(1-t)-m1*t);
}
const ranges={swimming:[-95,-823,39.0,49.5],gym:[9,-811,52.2,58.45]};
const roofMap=(ring)=>{
  // Angular lookup keeps the actual football oculus asymmetry and orientation.
  const center=[234.0,-768.0];
  const nodes=ring.map(p=>{const x=p[0]-center[0],z=p[1]-center[1];return [Math.atan2(z,x),Math.hypot(x,z)];}).sort((a,b)=>a[0]-b[0]);
  nodes.unshift([nodes.at(-1)[0]-TAU,nodes.at(-1)[1]]);
  nodes.push([nodes[1][0]+TAU,nodes[1][1]]);
  function radius(a){
    let lo=0,hi=nodes.length-1;
    while(hi-lo>1){const k=(lo+hi)>>1;if(nodes[k][0]<a)lo=k;else hi=k;}
    return lerp(nodes[lo][1],nodes[hi][1],(a-nodes[lo][0])/(nodes[hi][0]-nodes[lo][0]));
  }
  return (x,z)=>Math.hypot(x-center[0],z-center[1])-radius(Math.atan2(z-center[1],x-center[0]));
};
const rounded=(n,r=.24)=>{
  const v=[[0,-1],[1,0],[0,1],[-1,0]],out=[];
  for(let i=0;i<4;i++){
    const a=v[(i+3)%4],b=v[i],c=v[(i+1)%4];
    for(let j=0;j<=n;j++){
      const t=j/n,A=1-t;
      out.push([b[0]+r*(A*A*(a[0]-b[0])+t*t*(c[0]-b[0])),b[1]+r*(A*A*(a[1]-b[1])+t*t*(c[1]-b[1]))]);
    }
  }
  return out;
};
class Faces{
  constructor(){this.p=[];this.c=[];this.uv=[];this.ix=[];this.n=[];}
  vertex(p,col,uv,n){const k=this.p.length/3;this.p.push(...p);this.c.push(col.r,col.g,col.b);this.uv.push(uv?.[0]||0,uv?.[1]||0);if(n)this.n.push(...n);return k;}
  fan(ids,reverse=false){for(let i=1;i<ids.length-1;i++)this.ix.push(ids[0],reverse?ids[i]:ids[i+1],reverse?ids[i+1]:ids[i]);}
  mesh(mat,name){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));
    g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.setIndex(this.ix);
    if(this.n.length===this.p.length)g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));else g.computeVertexNormals();
    g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }
}
function trim(poly,measure){
  if(!poly.length)return poly;
  const ret=[];
  for(let j=0;j<poly.length;j++){
    const a=poly[(j+poly.length-1)%poly.length],b=poly[j],A=measure(a),B=measure(b);
    if((A<0)!==(B<0)){const f=A/(A-B);ret.push([lerp(a[0],b[0],f),lerp(a[1],b[1],f)]);}
    if(B>=0)ret.push(b);
  }
  return ret;
}
const ellipseDistance=(x,z,e)=>Math.hypot((x-e[0])/e[2],(z-e[1])/e[3]);
// Expansion joints follow the diamond axes. Their footprint fades below one
// pixel, so an aerial view shows a silver skin rather than a shimmering grid.
function coatedPanels(mat,cx,cz){
  mat.customProgramCacheKey=()=> 'cocoon-cassette-v2';
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 cocoonCell;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      vec2 grid=vec2(uv.x*${cx.toFixed(1)},(1.-uv.y)*${cz.toFixed(1)});
      cocoonCell=vec2(grid.x+grid.y,grid.x-grid.y);`);
    shader.fragmentShader='varying vec2 cocoonCell;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cell=cocoonCell+0.5, fw=max(fwidth(cell),vec2(.0001));
      vec2 d=abs(fract(cell+.5)-.5);
      vec2 weld=(1.-smoothstep(vec2(.003)-fw*.45,vec2(.011)+fw*.45,d))
                   * min(vec2(1.),vec2(.017)/fw);
      float plate=fract(sin(dot(floor(cell),vec2(17.37,73.13)))*4391.);
      diffuseColor.rgb*=(.974+.048*plate)*(1.-.31*max(weld.x,weld.y));`);
  };
}
function roof(root,hole){
  const gap=roofMap(hole),funnel=[83.6,-791.9],cache=new Map();
  function pos(u,v){
    u=clamp(u,0,1);v=clamp(v,0,1);
    // Most points reuse transverse frames; avoid re-evaluating six splines.
    const key=Math.round(u*100000);let s=cache.get(key);
    if(!s){const x=lerp(pathX[0],pathX.at(-1),u);s=sections[0].map((_,k)=>station(x,k));cache.set(key,s);}
    const phi=v*Math.PI,ac=(1-Math.cos(phi))*.5;
    const x=lerp(s[0],s[2],ac),z=lerp(s[1],s[3],ac);
    const eave=lerp(s[5],s[6],ac);
    let y=eave+(s[4]-eave)*Math.sin(phi)**.77;
    // A saddle around the football oculus rises to the ridge at the two
    // ends of the field. Its long sides dip towards a spectator's sightline.
    const head=ease(119,183,x)*(1-ease(274,328,x));
    y+=head*(3.2*Math.sin(phi*2)**2-4.8*Math.sin(phi)**8);
    const r=Math.hypot(x-funnel[0],z-funnel[1]);
    if(r<37)y-=2.4*(1-ease(20,37,r));
    return [x,y,z];
  }
  const normalCache=new Map();
  function roofNormal(p){
    const [u,v]=p,k=Math.round(u*50000)*50001+Math.round(v*50000);
    let normal=normalCache.get(k);if(normal)return normal;
    const w=pos(u-.0004,v),e=pos(u+.0004,v),n=pos(u,v-.0005),s=pos(u,v+.0005);
    const along=new T.Vector3(e[0]-w[0],e[1]-w[1],e[2]-w[2]);
    normal=new T.Vector3(s[0]-n[0],s[1]-n[1],s[2]-n[2]).cross(along).normalize().toArray();
    normalCache.set(k,normal);return normal;
  }
  const cx=64,cz=28,hi=new Faces(),lo=new Faces(),returns=new Faces(),soffit=new Faces();
  const c=document.createElement('canvas');c.width=2048;c.height=1024;
  const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
  ctx.globalCompositeOperation='destination-out';
  const edge=[[0,-1],[1,0],[0,1],[-1,0]],round=rounded(2,.30);
  const toUV=p=>[p[0],1-p[1]];
  const outside=p=>{const v=pos(...p);return Math.min(gap(v[0],v[2]),Math.hypot(v[0]-funnel[0],v[2]-funnel[1])-funnelCut);};
  const facadeSilver=new T.Color('#cfceca'),edgeCol=new T.Color('#dcd9d1');
  const rimCol=new T.Color('#969996'),shadowCol=new T.Color('#737b7c'),backCol=new T.Color('#a6a8a0'),vColor=new T.Color();
  const offset=(p,n,d)=>[p[0]-n[0]*d,p[1]-n[1]*d,p[2]-n[2]*d];
  // Two staggered rows per diamond. All sections share the same reticulated
  // layout across the pool, gym, plaza tree and stadium roof.
  for(let j=0;j<=cz*2;j++){
    const v=j/(2*cz),shift=j%2===1?.5:0;
    for(let i=0;i<=cx;i++){
      const u=(i+shift)/cx;if(u>1)continue;
      const unit=(p,amount=1)=>[u+p[0]*amount/(2*cx),v+p[1]*amount/(2*cz)];
      let diamond=edge.map(p=>unit(p));
      for(const fn of [p=>p[0],p=>1-p[0],p=>p[1],p=>1-p[1]])diamond=trim(diamond,fn);
      if(diamond.length<3)continue;
      const center=pos(u,v),[x,y,z]=center,oc=gap(x,z),fc=Math.hypot(x-funnel[0],z-funnel[1]);
      if(oc < -8||fc<funnelCut-8)continue;
      const cut=(oc<9||fc<funnelCut+9)&&diamond.some(p=>outside(p)<0);
      if(cut)diamond=trim(diamond,outside);
      if(diamond.length<3)continue;
      const across=Math.sin(Math.PI*v);
      const east=ease(129,173,x);
      const halls=Math.min(ellipseDistance(x,z,ranges.swimming),ellipseDistance(x,z,ranges.gym));
      const westHole=Math.max((1-ease(.26,.76,across))*.88,
                              ease(.97,1.69,halls)*(.12+.74*ease(28,65,x)));
      // In the Sea Gate photograph the center of the raised arch is clad.
      // The openwork spreads out from its two sides in scalloped rows.
      const fieldHole=ease(8,40,oc)*(.04+.93*(1-ease(.06,.99,across))**.66);
      let open=lerp(westHole,fieldHole,east);
      if(fc<51)open=Math.max(open,.77*(1-ease(28,51,fc)));
      // Closed elliptical double-layer hall roofs read as quieter oval caps.
      const cap=halls<.77&&!east;
      if(cap)open=0;
      const lum=1+.005*Math.sin(i*15.1+j*1.7)+.005*Math.cos(i*.7-j);
      const metallic=P=>{
        const d=Math.min(ellipseDistance(P[0],P[2],ranges.gym),ellipseDistance(P[0],P[2],ranges.swimming));
        return vColor.copy(facadeSilver).lerp(white,.73*(1-ease(.746,.776,d))).multiplyScalar(lum);
      };
      const flat=diamond.map(p=>{const P=pos(...p);return lo.vertex(P,metallic(P),toUV(p),roofNormal(p));});
      lo.fan(flat);
      if(open<.095||cut||diamond.length!==4||u<.0001||u>.9999||v<.0001||v>.9999){
        const ring=diamond.map(p=>{const P=pos(...p);return hi.vertex(P,metallic(P),toUV(p),roofNormal(p));});
        hi.fan(ring);continue;
      }
      // Rounded rectangular waterjet cuts in diamond-shaped steel islands.
      // Outer support points are ray intersections with the exact shared cell.
      const shell=[],holeUV=[],walls=[],back=[];
      // The steel members are welded closed boxes with a folded perimeter.
      // The inside aperture is slightly narrower than the opening in the face.
      const thick=.46+.42*open;
      for(const r of round){
        const scale=1/(Math.abs(r[0])+Math.abs(r[1]));
        const out=unit(r,scale),inside=unit(r,open);
        if(out[0]<-.000001||out[0]>1.000001||out[1]<-.000001||out[1]>1.000001)continue;
        const P=pos(...out),Q=pos(...inside),N=roofNormal(out),M=roofNormal(inside);
        const fold=unit(r,Math.max(.055,open-.036)),foot=pos(...fold);
        const lead=offset(foot,M,.085),base=offset(foot,M,thick);
        shell.push([hi.vertex(P,metallic(P),toUV(out),N),hi.vertex(Q,metallic(Q),toUV(inside),M)]);
        walls.push([returns.vertex(Q,edgeCol),returns.vertex(lead,rimCol),returns.vertex(base,shadowCol)]);
        back.push([soffit.vertex(offset(P,N,thick),backCol,null,N.map(v=>-v)),
                   soffit.vertex(base,backCol,null,M.map(v=>-v))]);
        holeUV.push(inside);
      }
      if(shell.length<4)continue;
      ctx.beginPath();
      for(let k=0;k<shell.length;k++){
        const h=(k+1)%shell.length,[a,b]=shell[k],[d,e]=shell[h];
        hi.ix.push(a,b,e,a,e,d);
        const A=walls[k],B=walls[h],K=back[k],H=back[h];
        for(let l=0;l<2;l++)returns.ix.push(A[l],A[l+1],B[l+1],A[l],B[l+1],B[l]);
        soffit.ix.push(K[0],H[1],K[1],K[0],H[0],H[1]);
        const [U,V]=holeUV[k];if(k===0)ctx.moveTo(U*c.width,V*c.height);else ctx.lineTo(U*c.width,V*c.height);
      }
      ctx.closePath();ctx.fill();
    }
  }
  const steel=new T.MeshStandardMaterial({vertexColors:true,metalness:.43,roughness:.35,side:T.DoubleSide});
  const boxed=new T.MeshStandardMaterial({vertexColors:true,metalness:.39,roughness:.41,side:T.DoubleSide});
  coatedPanels(steel,cx,cz);
  steel.userData.showFacade=[1,.63,46];
  const high=new T.Group(),low=new T.Group();
  high.add(hi.mesh(steel,'银色冲孔钢板与封闭场馆屋面'));
  high.add(returns.mesh(boxed,'扭曲箱形钢网 · 折边和腹板'),soffit.mesh(boxed,'箱形钢网 · 内侧封板'));
  // At district distances the same varying holes survive in mipmapped alpha.
  const alpha=new T.CanvasTexture(c);alpha.colorSpace=T.SRGBColorSpace;alpha.anisotropy=6;
  const far=steel.clone();far.map=alpha;far.alphaTest=.4;far.alphaToCoverage=true;coatedPanels(far,cx,cz);
  low.add(lo.mesh(far,'远景 · 连续网壳'));
  const lod=new T.LOD();lod.name='春茧连续网壳';lod.position.set(70,0,-790);
  for(const g of [high,low])g.position.set(-70,0,790);
  lod.addLevel(high,0);lod.addLevel(low,1050,.11);root.add(lod);
  // The solid inner face of the roof opening is several metres deep, with a
  // continuous floodlight rail carried on open trusses around the bowl.
  const edgeSkin=new Surface();
  function ceiling(x,z) {
    let u=clamp((x-pathX[0])/(pathX.at(-1)-pathX[0]),.0001,.9999),v=.5;
    for(let i=0;i<7;i++){
      const W=pos(u,v),N=pos(u+.00012,v),S=pos(u,v+.00012);
      const ax=(N[0]-W[0])/.00012,az=(N[2]-W[2])/.00012,bx=(S[0]-W[0])/.00012,bz=(S[2]-W[2])/.00012;
      const det=ax*bz-az*bx;if(Math.abs(det)<.01)break;
      const dx=x-W[0],dz=z-W[2];
      u=clamp(u+(dx*bz-dz*bx)/det,.0001,.9998);v=clamp(v+(ax*dz-az*dx)/det,.0001,.9998);
    }
    return pos(u,v)[1];
  }
  for(let i=0;i<hole.length;i++){
    const a=hole[i],b=hole[(i+1)%hole.length],h=ceiling(...a),k=ceiling(...b);
    edgeSkin.quad([a[0],h-.26,a[1]],[a[0],h-1.9,a[1]],[b[0],k-1.9,b[1]],[b[0],k-.26,b[1]]);
  }
  edgeSkin.mesh(root,new T.MeshStandardMaterial({color:0xb6bdba,roughness:.45,metalness:.63,side:T.DoubleSide}),'体育场天窗金属封边');
  // The lifted north/south eaves and the cut eastern end expose a continuous
  // boxed edge. The dark soffit is visible when standing at the entrance.
  const edgeSteel=new Surface(),lip=new T.Color('#d9d6cb'),web=new T.Color('#969998'),belly=new T.Color('#616867');
  for(const [along,end] of [['long',0],['long',1],['short',0],['short',1]]){
    const long=along==='long',n=long?160:100;
    let last=null;
    for(let k=0;k<=n;k++){
      const t=k/n,u=long?t:end,v=long?end:t,outer=pos(u,v);
      const next=long?pos(u,end===0?.006:.994):pos(end===0?.003:.997,v);
      const inward=new T.Vector3(...next).sub(new T.Vector3(...outer)).normalize();
      const depth=long?.56:1.18,reach=long?1.18:1.65;
      const lower=[outer[0],outer[1]-depth,outer[2]];
      const back=lower.map((v,i)=>v+inward.getComponent(i)*reach);
      const row=[outer,[outer[0],outer[1]-.13,outer[2]],lower,back,next];
      if(last)for(let j=0;j<4;j++)edgeSteel.quad(last[j],last[j+1],row[j+1],row[j],undefined,[lip,web,belly,web][j]);
      last=row;
    }
  }
  edgeSteel.mesh(root,boxed,'海之门与抬升檐口 · 成型封边及底翼缘');
  return {ceiling,pos,gap,porosity:alpha};
}

// A reflection on the curved arena glass sees the nearby canopy, many metres
// closer than the skyline cubemap. Trace the actual transverse roof stations,
// then sample the very same aperture mask used by the distant roof mesh. The
// method also provides a daylight mask on the covered pedestrian deck.
function reflectCanopy(material,porosity,glass){
  const frameCount=128,profile=new Float32Array(frameCount*4);
  for(let i=0;i<frameCount;i++){
    const x=lerp(pathX[0],pathX.at(-1),i/(frameCount-1));
    profile.set([station(x,1),station(x,3),station(x,4),.5*(station(x,5)+station(x,6))],4*i);
  }
  const frames=new T.DataTexture(profile,frameCount,1,T.RGBAFormat,T.FloatType);
  frames.magFilter=frames.minFilter=T.NearestFilter;frames.needsUpdate=true;
  material.customProgramCacheKey=()=>glass?'arena-cocoon-reflection-v3':'cocoon-terrace-v3';
  material.onBeforeCompile=s=>{
    s.uniforms.cocoonStations={value:frames};s.uniforms.cocoonCutouts={value:porosity};
    s.vertexShader='varying vec3 cocoonWorld;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncocoonWorld=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader=`
      varying vec3 cocoonWorld;
      uniform sampler2D cocoonStations, cocoonCutouts;
      vec3 cocoonSection(vec3 p){
        float u=(p.x+${(-pathX[0]).toFixed(2)})/${(pathX.at(-1)-pathX[0]).toFixed(2)};
        float at=clamp(u,0.,1.)*127., key=floor(at);
        vec4 a=texture2D(cocoonStations,vec2((key+.5)/128.,.5));
        vec4 b=texture2D(cocoonStations,vec2((key+1.5)/128.,.5));
        vec4 span=mix(a,b,fract(at));
        float t=(p.z-span.x)/(span.y-span.x);
        float v=acos(clamp(1.-2.*t,-1.,1.))/3.14159265;
        float h=mix(span.w,span.z,pow(max(sin(3.14159265*v),0.),.77));
        float edge=max(max(-t,t-1.)*(span.y-span.x),max(-u,u-1.)*495.);
        return vec3(u,v,max(p.y-h,edge));
      }
      float cocoonHit(vec3 o,vec3 ray){
        float lo=.09,hi=132.;
        if(cocoonSection(o).z>0.||cocoonSection(o+ray*hi).z<0.)return 0.;
        for(int k=0;k<10;k++){
          float t=.5*(lo+hi);
          if(cocoonSection(o+ray*t).z>0.)hi=t;else lo=t;
        }
        vec3 hit=o+ray*(.5*(lo+hi)), section=cocoonSection(hit);
        float sill=texture2D(cocoonStations,vec2(section.x,.5)).w;
        if(hit.y<6.2||(min(section.y,1.-section.y)<.006&&hit.y<sill)||
           length((hit.xz-vec2(234.,-768.))/vec2(69.,94.))<1.)return 0.;
        float crown=length(hit.xz-vec2(83.6,-791.9));
        float shellMask=texture2D(cocoonCutouts,vec2(section.x,1.-section.y)).a;
        if(crown<28.5){
          float f, bottom=0.,top=hi;
          for(int k=0;k<12;k++){
            vec3 q=o+ray*((bottom+top)*.5);
            f=clamp((q.y-5.90)/max(13.,hit.y-5.90),0.,1.);
            float radius=10.4-.68*sin(3.14159265*f)+17.9*pow(f,3.15);
            if(length(q.xz-vec2(83.6,-791.9))>radius)bottom=.5*(bottom+top);else top=.5*(bottom+top);
          }
          vec3 q=o+ray*(.5*(bottom+top));
          vec2 polar=q.xz-vec2(83.6,-791.9);
          vec2 lattice=vec2(atan(polar.y,polar.x)*3.97887,f*6.);
          vec2 cell=abs(fract(vec2(lattice.x+lattice.y,lattice.x-lattice.y)+.5)-.5);
          float opening=.67+.19*smoothstep(.05,1.,f);
          float wire=smoothstep(opening-.10,opening+.10,2.*max(cell.x,cell.y));
          return mix(wire,shellMask,smoothstep(24.,28.5,crown));
        }
        return shellMask;
      }
    `+s.fragmentShader;
    if(glass){
      s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 eyeRay=normalize(cocoonWorld-cameraPosition);
        vec3 paneN=inverseTransformDirection(normal,viewMatrix);
        vec3 ray=reflect(eyeRay,paneN);
        float cover=cocoonHit(cocoonWorld+paneN*.12,ray)*smoothstep(-.12,.15,ray.y);
        vec3 shellLight=vec3(.135,.158,.165);
        #if NUM_DIR_LIGHTS > 0
          shellLight*=clamp(dot(directionalLights[0].color,vec3(.21,.72,.07))*.46,.08,1.25);
        #endif
        outgoingLight=mix(outgoingLight,shellLight,.57*cover);
        #include <opaque_fragment>`);
    }else{
      s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
        #if NUM_DIR_LIGHTS > 0
          vec3 skyDir=inverseTransformDirection(directionalLights[0].direction,viewMatrix);
          float strength=clamp(dot(directionalLights[0].color,vec3(.21,.72,.07))*.56,0.,1.);
          float shade=cocoonHit(cocoonWorld+vec3(0.,.08,0.),skyDir);
          outgoingLight*=mix(vec3(1.),vec3(.50,.55,.59),shade*strength);
        #endif
        #include <opaque_fragment>`);
    }
  };
}
function capsule(r,half=42.195,n=48){
  const a=[];
  for(let i=0;i<n;i++){const q=Math.PI*(1+i/n);a.push([r*Math.cos(q),-half+r*Math.sin(q)]);}
  for(let i=0;i<24;i++)a.push([r,lerp(-half,half,i/24)]);
  for(let i=0;i<n;i++){const q=Math.PI*i/n;a.push([r*Math.cos(q),half+r*Math.sin(q)]);}
  for(let i=0;i<24;i++)a.push([-r,lerp(half,-half,i/24)]);
  return a;
}
const fieldPos=(x,z,y=0)=>[CX+x*Math.cos(ang)+z*Math.sin(ang),y,CZ-x*Math.sin(ang)+z*Math.cos(ang)];
function band(surface,A,B,y,h,col){
  for(let k=0;k<A.length;k++){
    const j=(k+1)%A.length;
    surface.quad(fieldPos(...A[k],y),fieldPos(...B[k],h),fieldPos(...B[j],h),fieldPos(...A[j],y),undefined,col);
  }
}
function seatForm(){
  const g=new T.BufferGeometry(),p=[],ix=[];
  // Three bent faces give each stand a perforation-free, recognisable seat
  // silhouette and a backrest without sending 20,000 boxes to the renderer.
  for(const [z,y,w] of [[.20,.02,.189],[-.075,.035,.222],[-.155,.077,.225],[-.215,.318,.20]]){
    p.push(-w,y,z,w,y,z);
  }
  for(let i=0;i<3;i++){const a=i*2;ix.push(a,a+2,a+1,a+2,a+3,a+1);}
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
function trackAndSeating(group,near){
  const surf=new Surface(),mark=new Surface(),stand=new Surface(),seatFallback=new Surface();
  const blades=new T.Color(),pitchCol=new T.Color('#426c3c'),fieldBlue=new T.Color('#235c89');
  const vert=new T.Color('#556665'),step=new T.Color('#728781'),aisle=new T.Color('#b0b1a7');
  const rails=new Instances(new T.CylinderGeometry(1,1,1,6,1,true),new T.MeshStandardMaterial({color:0x9fa9a5,roughness:.4,metalness:.58}),'看台护栏与球门');
  const hor=(u,v,h,col)=>surf.quad(fieldPos(u[0],u[1],h),fieldPos(u[0],v[1],h),fieldPos(v[0],v[1],h),fieldPos(v[0],u[1],h),undefined,col);
  const line=(x,z,X,Z,w=.125,h=.377)=>{
    const p=fieldPos(x,z),q=fieldPos(X,Z);
    ribbon(mark,[[p[0],p[2]],[q[0],q[2]]],w,h);
  };
  const arc=(x,z,r,a,b,w=.125,h=.377)=>{
    const pp=[];const n=Math.max(4,Math.ceil(Math.abs(b-a)*r/1.65));
    for(let i=0;i<=n;i++){const q=lerp(a,b,i/n),p=fieldPos(x+r*Math.cos(q),z+r*Math.sin(q));pp.push([p[0],p[2]]);}
    ribbon(mark,pp,w,h);
  };
  const trackOuter=capsule(48.8),trackInner=capsule(36.5);
  const footprint=trackOuter.map(([x,z])=>{const P=fieldPos(x,z);return [P[0],P[2]];});
  surf.polygon(footprint,[],.30,1,fieldBlue);
  const grass=trackInner.map(([x,z])=>{const P=fieldPos(x,z);return [P[0],P[2]];});
  surf.polygon(grass,[],.321,1,pitchCol);
  // Mowing alternates in the longitudinal direction seen in current match photos.
  for(let i=0;i<14;i++){
    blades.set(i%2?'#478041':'#3c743b');
    hor([-34+i*68/14,-52.5],[-34+(i+1)*68/14,52.5],.351,blades);
  }
  for(let l=0;l<9;l++){
    const r=36.50+1.22*l;
    if(l<8)band(surf,capsule(r+.02),capsule(r+1.22-.02),.335,.335,new T.Color(l%2?'#256b9f':'#25699f'));
    band(mark,capsule(r-.025),capsule(r+.025),.359,.359);
  }
  for(let j=0;j<9;j++){
    line(-36.5-j*1.22,-38.4,-37.68-j*1.22,-38.4,.075,.365);
    line(36.5+j*1.22,27.5+j*.36,37.65+j*1.22,27.5+j*.36,.075,.365);
  }
  for(const side of [-1,1]){
    line(side*34,-52.5,side*34,52.5);
    line(-34,side*52.5,34,side*52.5);
    for(const [half,depth] of [[20.16,16.5],[9.16,5.5]]){
      const z=side*(52.5-depth);
      line(-half,z,half,z);line(-half,z,-half,side*52.5);line(half,z,half,side*52.5);
    }
    const z=side*41.5,alpha=Math.acos(5.5/9.15);
    arc(0,z,9.15,side<0?Math.PI/2-alpha:-Math.PI/2-alpha,side<0?Math.PI/2+alpha:-Math.PI/2+alpha);
    arc(0,z,.115,0,TAU,.14);
    for(const x of [-3.66,3.66]){
      const a=fieldPos(x,side*52.5,.36),b=fieldPos(x,side*52.5,2.84),c=fieldPos(x,side*54.5,.36);
      rails.between(...a,...b,.057);rails.between(...b,...c,.028);
    }
    rails.between(...fieldPos(-3.66,side*52.5,2.84),...fieldPos(3.66,side*52.5,2.84),.057);
    for(let i=0;i<=24;i++){
      const x=lerp(-3.66,3.66,i/24);rails.between(...fieldPos(x,side*52.5,2.82),...fieldPos(x,side*54.4,.36),.009);
    }
    for(let i=1;i<9;i++){const t=i/9;rails.between(...fieldPos(-3.66,side*(52.5+1.9*t),lerp(2.82,.36,t)),...fieldPos(3.66,side*(52.5+1.9*t),lerp(2.82,.36,t)),.009);}
  }
  arc(0,0,9.15,0,TAU);arc(0,0,.12,0,TAU,.15);line(-34,0,34,0);
  const fibers=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/stadium-turf.webp');
  fibers.wrapS=fibers.wrapT=T.RepeatWrapping;fibers.colorSpace=T.SRGBColorSpace;fibers.anisotropy=8;
  const playing=surf.mesh(group,new T.MeshStandardMaterial({map:fibers,vertexColors:true,roughness:.96,side:T.DoubleSide}),'足球草坪、八道蓝色田径场');
  finishRubberAndTurf(playing.material);
  const pA=playing.geometry.attributes.position,tA=playing.geometry.attributes.uv;
  for(let i=0;i<pA.count;i++)tA.setXY(i,pA.getX(i)/6.1,pA.getZ(i)/6.1);
  tA.needsUpdate=true;
  mark.mesh(group,new T.MeshStandardMaterial({color:0xf4f3e6,roughness:.92,side:T.DoubleSide}),'足球及田径场地标线');
  // Two seating decks with radial aisles, vomitories and the low, open bay
  // facing the sea. Outer rows stop below the sloping steel roof.
  const seatM=new T.MeshStandardMaterial({color:0xffffff,roughness:.63,metalness:.06,side:T.DoubleSide});
  const matrices=[],colors=[],tmp=new T.Object3D();
  const green=['#084c46','#095a4c','#125f51','#1b695a','#145448'];
  for(let row=0;row<32;row++){
    const upper=row>=17;
    const h=1.85+row*.575+(upper?1.18:0), r=50+row*.855+(upper?1.45:0);
    const A=capsule(r),B=capsule(r+.855),seat=capsule(r+.46),C=capsule(r+.69),D=capsule(r+.25);
    for(let i=0;i<A.length;i++){
      const j=(i+1)%A.length,x=seat[i][0],z=seat[i][1];
      const endRamp=ease(46,65,x)*(1-ease(37,59,Math.abs(z)));
      const maxRow=Math.round(lerp(32,12,endRamp));
      if(row>=maxRow||(i===59||i===60))continue;
      if(Math.abs(z)>109&&row>27)continue;
      const portal=upper&&row<21&&(i%24===10||i%24===11);
      if(portal)continue;
      const stair=i%12===0;
      stand.quad(fieldPos(...A[i],h),fieldPos(...A[j],h),fieldPos(...A[j],h-.56),fieldPos(...A[i],h-.56),undefined,vert);
      stand.quad(fieldPos(...A[i],h),fieldPos(...B[i],h),fieldPos(...B[j],h),fieldPos(...A[j],h),undefined,stair?aisle:step);
      if(stair)continue;
      const p=fieldPos(...seat[i],h+.05),q=fieldPos(...seat[j],h+.05);
      const tangent=new T.Vector3(q[0]-p[0],0,q[2]-p[2]);
      const len=tangent.length(),n=Math.max(1,Math.floor(len/.50));
      const facing=Math.atan2(-tangent.z,tangent.x);
      const c=new T.Color(green[(Math.floor(i/8)+Math.floor(row/4))%green.length]);
      seatFallback.quad(fieldPos(...C[i],h+.24),fieldPos(...D[i],h+.13),fieldPos(...D[j],h+.13),fieldPos(...C[j],h+.24),undefined,c);
      for(let k=0;k<n;k++){
        const t=(k+.5)/n;tmp.position.set(lerp(p[0],q[0],t),h+.135,lerp(p[2],q[2],t));
        tmp.rotation.y=facing;tmp.updateMatrix();matrices.push(tmp.matrix.clone());
        colors.push(new T.Color(green[(i*13+k*3+row+Math.floor(row/5))%green.length]));
      }
      if((row===16||row===maxRow-1)&&i%2===0){
        const p=fieldPos(...C[i],h),q=fieldPos(...C[j],h);
        rails.between(p[0],h+.03,p[2],p[0],h+.95,p[2],.029);
        rails.between(p[0],h+.95,p[2],q[0],h+.95,q[2],.029);
      }
    }
  }
  stand.mesh(group,new T.MeshStandardMaterial({vertexColors:true,roughness:.78,side:T.DoubleSide}),'海景看台台阶及疏散通道');
  const seats=new T.InstancedMesh(seatForm(),seatM,matrices.length);seats.name='分区注塑绿色座椅';
  for(let i=0;i<matrices.length;i++){seats.setMatrixAt(i,matrices[i]);seats.setColorAt(i,colors[i]);}
  seats.computeBoundingSphere();
  const seatLOD=new T.LOD();seatLOD.name='看台座椅细节';seatLOD.position.set(CX,0,CZ);
  seats.position.set(-CX,0,-CZ);const farSeats=seatFallback.mesh(new T.Group(),new T.MeshStandardMaterial({vertexColors:true,roughness:.72,side:T.DoubleSide}),'远景座席排');
  farSeats.position.set(-CX,0,-CZ);seatLOD.addLevel(seats,0);seatLOD.addLevel(farSeats,450,.1);group.add(seatLOD);
  rails.flush(near);
}
const groundY=.30, terraceY=5.90;
const southStair=[[57,-715],[106,-696],[96,-664],[49,-682]];
const northRamp=[[85,-864],[104,-865],[106,-935],[96,-935]];
const gateDeck=[[307,-829],[328,-829],[332,-713],[310,-713]];
const gateAccess=[[312,-718],[320,-718],[317,-681],[309,-681]];
const stadiumTunnel=[[326,-774],[326,-765.6],[282,-765.6],[282,-774]];
const venueOutline=[...sections.map(s=>[s[0],s[1]]),...sections.map(s=>[s[2],s[3]]).reverse()];
export const stadiumMotorAreas=[venueOutline,southStair,northRamp,gateAccess,stadiumTunnel];
const gateCenter=-770.8,gateHalf=58.5,portalHalf=44.2;
const gatePlane=dz=>326.8+dz*.014;
function pierVolume(x,z){
  const t=z-gateCenter,s=Math.abs(t),face=gatePlane(t);
  return s>=portalHalf&&s<=gateHalf&&x<face+.15&&x>face-10.4;
}
function rampLevel(x,z,ring,inside){
  if(!inRing(x,z,ring))return null;
  const ax=(ring[0][0]+ring[1][0])*.5,az=(ring[0][1]+ring[1][1])*.5;
  const bx=(ring[2][0]+ring[3][0])*.5,bz=(ring[2][1]+ring[3][1])*.5,dx=bx-ax,dz=bz-az;
  return lerp(inside,groundY,clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1));
}
function buildingBase(root,m,shape,hole,roofData,near){
  const {ceiling,porosity}=roofData;
  const plaza=new Surface(),stair=new Surface(),undercroft=new Surface(),facades=new Surface(),cap=new Surface(),stile=new Surface();
  const chalk=new T.Color('#e7e2d8'),shade=new T.Color('#a9aaa4'),gl=new T.Color();
  const metal=new T.MeshStandardMaterial({color:0xa3b2b5,roughness:.375,metalness:.58});
  const rails=new Instances(new T.CylinderGeometry(1,1,1,6,1,true),metal,'网壳下枝形立柱');
  const reveals=new Surface(),darkJamb=new T.Color('#5a6060'),soffit=new T.Color('#767871'),piers=new T.Color('#b9b9ae');
  const shopGlass=new T.Color('#535f5e'),vent=new T.Color('#414948');
  plaza.polygon(shape,[hole],terraceY,4,chalk);
  for(let i=0;i<shape.length;i++){
    const a=shape[i],b=shape[(i+1)%shape.length],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    if(inRing(...mid,southStair)||inRing(...mid,northRamp)||inRing(...mid,stadiumTunnel))continue;
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
    const inward=(-dz*(75-mid[0])+dx*(-778-mid[1]))>=0?1:-1;
    const P=(t,y,depth=0)=>[lerp(a[0],b[0],t)-depth*dz*inward,y,lerp(a[1],b[1],t)+depth*dx*inward];
    const n=Math.max(1,Math.round(len/8.8));
    // A recessed concrete plinth, floor beam and individually framed bays
    // replace a blank retaining wall. The central field tunnel remains open.
    for(let k=0;k<n;k++){
      const u=k/n,v=(k+1)/n,U=u+.33/len,V=v-.33/len;
      if(inRing(lerp(a[0],b[0],(u+v)/2),lerp(a[1],b[1],(u+v)/2),stadiumTunnel))continue;
      undercroft.quad(P(u,5.24),P(u,terraceY),P(v,terraceY),P(v,5.24),undefined,chalk);
      undercroft.quad(P(u,5.24),P(v,5.24),P(v,5.24,2),P(u,5.24,2),undefined,soffit);
      undercroft.quad(P(u,.28),P(u,5.24),P(U,5.24),P(U,.28),undefined,piers);
      undercroft.quad(P(V,.28),P(V,5.24),P(v,5.24),P(v,.28),undefined,piers);
      for(const t of [U,V])undercroft.quad(P(t,.28),P(t,5.24),P(t,5.24,2),P(t,.28,2),undefined,darkJamb);
      undercroft.quad(P(U,.28),P(V,.28),P(V,.28,2),P(U,.28,2),undefined,shade);
      const glazed=k%4!==2;
      reveals.quad(P(U,.28,2),P(U,5.24,2),P(V,5.24,2),P(V,.28,2),undefined,glazed?shopGlass:vent);
      if(glazed){
        for(let pane=1;pane<4;pane++){
          const t=lerp(U,V,pane/4);
          reveals.quad(P(t,.28,1.94),P(t,5.24,1.94),P(t+.055/len,5.24,1.94),P(t+.055/len,.28,1.94),undefined,soffit);
        }
      }else for(let y=.55;y<5.1;y+=.32)reveals.quad(P(U,y,1.96),P(U,y+.07,1.9),P(V,y+.07,1.9),P(V,y,1.96),undefined,darkJamb);
    }
  }
  for(const [r,stairs] of [[southStair,true],[northRamp,false],[gateAccess,false],[stadiumTunnel,false]]){
    const n=stairs?34:1;
    for(let i=0;i<n;i++){
      const v=i/n,w=(i+1)/n,h=lerp(terraceY+.008,groundY+.012,v),k=lerp(terraceY+.008,groundY+.012,w);
      const P=(u,t,y)=>[lerp(lerp(r[0][0],r[3][0],t),lerp(r[1][0],r[2][0],t),u),y,lerp(lerp(r[0][1],r[3][1],t),lerp(r[1][1],r[2][1],t),u)];
      stair.quad(P(0,v,h),P(0,w,stairs?h:k),P(1,w,stairs?h:k),P(1,v,h),undefined,chalk);
      if(stairs)stair.quad(P(0,w,h),P(0,w,k),P(1,w,k),P(1,w,h),undefined,shade);
    }
    for(const u of stairs?[.0,.32,.66,1]:[0,1]){
      let previous=null;
      for(let i=0;i<=12;i++){
        const v=i/12,y=lerp(terraceY+.96,groundY+1.0,v);
        const x=lerp(lerp(r[0][0],r[3][0],v),lerp(r[1][0],r[2][0],v),u),z=lerp(lerp(r[0][1],r[3][1],v),lerp(r[1][1],r[2][1],v),u);
        rails.between(x,y-.97,z,x,y,z,.043);
        if(previous)rails.between(...previous,x,y,z,.043);
        previous=[x,y,z];
      }
    }
  }
  // The indoor arena and natatorium stand behind the porous steel veil. Their
  // glazed elliptical exteriors remain visible from the entrance undercroft.
  for(const e of [ranges.gym,ranges.swimming]){
    const [cx,cz,rx,rz]=e,top=cx<0?25.5:28.7,N=116;
    const topAt=(a,push=0)=>Math.max(terraceY+4,Math.min(top,ceiling(cx+(rx+push)*Math.cos(a),cz+(rz+push)*Math.sin(a))-1.75));
    const world=(a,h,push=0)=>[cx+(rx+push)*Math.cos(a),h,cz+(rz+push)*Math.sin(a)];
    const oval=[];
    for(let i=0;i<N;i++){
      const a=TAU*i/N,b=TAU*(i+1)/N;oval.push([cx+rx*Math.cos(a),cz+rz*Math.sin(a)]);
      for(let j=0;j<7;j++){
        const low=lerp(terraceY,topAt(a),j/7),high=lerp(terraceY,topAt(a),(j+1)/7),L=lerp(terraceY,topAt(b),j/7),H=lerp(terraceY,topAt(b),(j+1)/7);
        gl.set(i%13<3&&j<2?'#65878c':j<2?'#3e5a5f':'#45636d');
        gl.multiplyScalar(.92+.09*(Math.sin(i*3.57+j*6.8)*.5+.5));
        facades.quad(world(a,low),world(a,high),world(b,H),world(b,L),undefined,gl);
        stile.quad(world(a,high-.076,.11),world(a,high,.11),world(b,H,.11),world(b,H-.076,.11),undefined,white);
      }
      stile.quad(world(a,terraceY,.09),world(a,topAt(a),.09),world(a+.0019,topAt(a+.0019),.09),world(a+.0019,terraceY,.09),undefined,white);
      if(i%9===0){
        const h=topAt(a,6),p=world(a,terraceY+.10,6),q=world(a,h-1,6);rails.between(...p,...q,.23);
        for(const side of [-1,1])rails.between(...world(a,h-3,6),...world(a+side*.067,topAt(a+side*.067,8),8),.16);
      }
    }
    for(let j=0;j<N;j++){
      const a=TAU*j/N,b=TAU*(j+1)/N,p=world(a,topAt(a)),q=world(b,topAt(b));
      const k=cap.vertex([cx,top,cz],[0,0],chalk),n=cap.vertex(q,[1,0],chalk),l=cap.vertex(p,[0,1],chalk);
      cap.indices.push(k,n,l);
    }
  }
  const fc=[83.6,-791.9];
  const plant=new Faces(),reveal=new Faces(),liner=new Faces(),col=new T.Color('#d3d3c9'),inside=new T.Color('#969c97'),innerTree=new T.Color('#a5a8a0');
  const nAngle=25,nRows=6,roundedCut=rounded(4,.29);
  function tree(a,f){
    const r=10.4-.68*Math.sin(Math.PI*f)+17.9*f**3.15;
    const x=fc[0]+r*Math.cos(a),z=fc[1]+r*Math.sin(a);
    const top=ceiling(fc[0]+28.3*Math.cos(a),fc[1]+28.3*Math.sin(a));
    return [x,lerp(terraceY+.02,top+.16,f),z];
  }
  for(let j=0;j<=nRows*2;j++){
    const v=j/(2*nRows);
    for(let i=0;i<nAngle;i++){
      const a=(i+(j%2)*.5)*TAU/nAngle;
      const uv=(r,ratio)=>[a+r[0]*Math.PI/nAngle*ratio,v+r[1]*ratio/(2*nRows)];
      if(j===0||j===nRows*2){
        let poly=[[0,-1],[1,0],[0,1],[-1,0]].map(p=>uv(p,1));
        poly=trim(poly,p=>p[1]);poly=trim(poly,p=>1-p[1]);
        plant.fan(poly.map(p=>plant.vertex(tree(...p),col)));continue;
      }
      const ids=[],edge=[],innerR=[],back=[];
      const opening=.67+.19*ease(.05,1,v);
      const treeBack=(p,angle)=>[p[0]-.60*Math.cos(angle),p[1]+.20*v,p[2]-.60*Math.sin(angle)];
      for(const ra of roundedCut){
        const outer=uv(ra,1/(Math.abs(ra[0])+Math.abs(ra[1]))),inner=uv(ra,opening);
        const q=tree(...inner),p=tree(...outer),qBack=treeBack(q,inner[0]);
        ids.push([plant.vertex(p,col),plant.vertex(q,col)]);
        edge.push(reveal.vertex(q,col));innerR.push(reveal.vertex(qBack,inside));
        back.push([liner.vertex(treeBack(p,outer[0]),innerTree),liner.vertex(qBack,innerTree)]);
      }
      for(let k=0;k<ids.length;k++){
        const w=(k+1)%ids.length,[a,b]=ids[k],[d,e]=ids[w];
        plant.ix.push(a,b,e,a,e,d);
        reveal.ix.push(edge[k],innerR[k],innerR[w],edge[k],innerR[w],edge[w]);
        const K=back[k],W=back[w];liner.ix.push(K[0],W[1],K[1],K[0],W[0],W[1]);
      }
    }
  }
  const treeSteel=new T.MeshStandardMaterial({vertexColors:true,metalness:.49,roughness:.34,side:T.DoubleSide});
  root.add(plant.mesh(treeSteel,'大树广场 · 漏斗形钢网壳柱'),reveal.mesh(treeSteel,'倒伞柱镂空截面'),liner.mesh(treeSteel,'倒伞柱内侧翼缘'));
  const well=Array.from({length:54},(_,i)=>[fc[0]+10.6*Math.cos(TAU*i/54),fc[1]+10.6*Math.sin(TAU*i/54)]);
  const mold=new Surface();mold.polygon(well,[],terraceY+.03,2);mold.mesh(root,new T.MeshStandardMaterial({color:0x788481,roughness:.79}),'大树广场柱脚');
  // Bright roof panels above both double-layer halls. Sparse meridian seams,
  // fixed on the actual surface, distinguish them from the open central plaza.
  for(const e of [ranges.gym,ranges.swimming]){
    let prev=null;
    for(let j=0;j<=136;j++){
      const a=TAU*j/136,x=e[0]+e[2]*.76*Math.cos(a),z=e[1]+e[3]*.76*Math.sin(a),p=[x,ceiling(x,z)+.11,z];
      if(prev)rails.between(...prev,...p,.11);prev=p;
    }
    for(let i=0;i<16;i++){
      const a=TAU*i/16;
      let prev=null;
      for(let j=1;j<=12;j++){
        const r=j/12*.75,x=e[0]+e[2]*r*Math.cos(a),z=e[1]+e[3]*r*Math.sin(a),pt=[x,ceiling(x,z)+.12,z];
        if(prev)rails.between(...prev,...pt,.055);prev=pt;
      }
    }
  }
  // Sea Gate: a raised public gallery traverses the east cut. Its glazed
  // balustrade and slender piers deliberately keep sightlines through to the bay.
  const deck=new Surface();deck.polygon(gateDeck,[],8.28,3,chalk);
  for(let k=0;k<4;k++){
    const a=gateDeck[k],b=gateDeck[(k+1)%4],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    undercroft.quad([a[0],7.34,a[1]],[a[0],8.27,a[1]],[b[0],8.27,b[1]],[b[0],7.34,b[1]],undefined,shade);
    const n=Math.ceil(length/3);
    for(let j=0;j<n;j++){
      const x=lerp(a[0],b[0],j/n),z=lerp(a[1],b[1],j/n),X=lerp(a[0],b[0],(j+1)/n),Z=lerp(a[1],b[1],(j+1)/n);
      rails.between(x,8.32,z,x,9.4,z,.044);rails.between(x,9.4,z,X,9.4,Z,.047);
      if(k%2===1&&j%8===0)rails.between(x,groundY,z,x,7.4,z,.41);
    }
  }
  const pavement=new T.MeshStandardMaterial({vertexColors:true,roughness:.82,side:T.DoubleSide});
  const stone=(url,srgb=false)=>{
    const t=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/'+url+'.webp');
    t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;
  };
  const paving=pavement.clone();paving.map=stone('stadium-granite',true);paving.normalMap=stone('stone-normal');
  paving.normalScale.set(.15,.15);paving.roughness=.80;
  const coveredPaving=paving.clone();reflectCanopy(coveredPaving,porosity,false);
  const fore=new Surface(),baseX=72,baseZ=-775;
  const margin=shape.map(([x,z])=>[baseX+(x-baseX)*1.071,baseZ+(z-baseZ)*1.145]);
  // The gate fronts the existing water court (OSM 587965805); its landing
  // terminates at the shore, while the accessible approach turns south.
  const shore=z=>327.1+.013*(z+848.9)+Math.max(-848.9-z,z+697.1,0)*.70;
  const surround=trim(margin,p=>shore(p[1])-p[0]);
  fore.polygon(surround,[shape],.345,4,chalk);
  for(const [sur,label] of [[deck,'东端海之门平台'],[plaza,'二层公共平台'],[stair,'大树广场南入口台阶与北坡道'],[fore,'环馆集散广场']]){
    const mesh=sur.mesh(root,sur===plaza?coveredPaving:paving,label),a=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
    for(let i=0;i<a.count;i++)uv.setXY(i,a.getX(i)/4.5,(a.getZ(i)+a.getY(i)*.38)/4.5);
    uv.needsUpdate=true;
  }
  undercroft.mesh(root,pavement,'平台结构边缘');
  reveals.mesh(root,new T.MeshStandardMaterial({vertexColors:true,roughness:.49,metalness:.42,side:T.DoubleSide}),'平台退进玻璃及格栅');
  const glassMat=new T.MeshPhysicalMaterial({vertexColors:true,metalness:.54,roughness:.145,clearcoat:.85,side:T.DoubleSide});
  reflectCanopy(glassMat,porosity,true);glassMat.userData.cityProbe='district';glassMat.userData.showFacade=[0,.75,32];facades.mesh(root,glassMat,'体育馆与游泳馆的反射玻璃幕墙');
  stile.mesh(root,new T.MeshStandardMaterial({color:0xa9b7b9,metalness:.7,roughness:.34,side:T.DoubleSide}),'玻璃横梁与窗框');
  cap.mesh(root,pavement,'馆体围护顶');
  rails.flush(near);
}
function courtMarkings(root,map){
  const site=map.land.find(f=>f.id===542049855);
  if(site){
    const base=new Surface();base.polygon(site.p,site.holes,-.03,12);
    const tex=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/grass.webp');
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=6;
    base.mesh(root,new T.MeshStandardMaterial({map:tex,color:0xadba8f,roughness:1}),'体育中心用地内草地基底');
  }
  // Training fields north of the cocoon lie outside its roof, aligned to their
  // mapped outlines. Use the observed pitch size for each touchline.
  const field=new Surface(),paint=new Surface(),goal=new Instances(new T.CylinderGeometry(1,1,1,5,1,true),
    new T.MeshStandardMaterial({color:0xe5e4d9,roughness:.5,metalness:.3}),'训练场球门');
  for(const id of [533466851,533466852,533466858]){
    const f=map.land.find(f=>f.id===id);if(!f)continue;
    const b=bounds(f.p),cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2;
    const w=Math.min(68,b[2]-b[0]-6),l=Math.min(105,b[3]-b[1]-6);
    const y=.281;
    for(let j=0;j<12;j++){
      const z=cz-l/2+j*l/12,Z=z+l/12;
      field.quad([cx-w/2,y,z],[cx-w/2,y,Z],[cx+w/2,y,Z],[cx+w/2,y,z],undefined,new T.Color(j%2?'#3e713e':'#477a42'));
    }
    const X=w/2,Z=l/2,mark=p=>ribbon(paint,p.map(([x,z])=>[x+cx,z+cz]),.13,y+.04);
    mark([[-X,-Z],[X,-Z],[X,Z],[-X,Z],[-X,-Z]]);mark([[-X,0],[X,0]]);
    mark(Array.from({length:69},(_,k)=>[9.15*Math.cos(k*TAU/68),9.15*Math.sin(k*TAU/68)]));
    for(const s of [-1,1]){
      for(const [rx,rz] of [[w*.289,16.5],[9.16,5.5]])mark([[-rx,Z*s],[-rx,(Z-rz)*s],[rx,(Z-rz)*s],[rx,Z*s]]);
      for(const dx of [-3.66,3.66])goal.between(cx+dx,y,cz+s*Z,cx+dx,y+2.44,cz+s*Z,.066);
      goal.between(cx-3.66,y+2.44,cz+s*Z,cx+3.66,y+2.44,cz+s*Z,.066);
    }
  }
  field.mesh(root,new T.MeshStandardMaterial({vertexColors:true,roughness:.95}),'北侧训练场');
  paint.mesh(root,new T.MeshStandardMaterial({color:0xeff0de,roughness:.92,side:T.DoubleSide}),'训练场划线');
  goal.flush(root);
}
function controls(footprint,shape){
  const bb=bounds(footprint);
  const passage=(x,z)=>x>263&&Math.abs(z-CZ)<4.30;
  function terrace(x,z){
    const south=rampLevel(x,z,southStair,terraceY);if(south!==null)return south;
    const north=rampLevel(x,z,northRamp,terraceY);if(north!==null)return north;
    const eastRamp=rampLevel(x,z,gateAccess,terraceY);if(eastRamp!==null)return eastRamp;
    const tunnel=rampLevel(x,z,stadiumTunnel,terraceY);if(tunnel!==null)return tunnel;
    if(x<bb[0]-.1||z<bb[1]-.1||x>bb[2]+.1||z>bb[3]+.1||!inRing(x,z,footprint))return null;
    if(inRing(x,z,gateDeck))return 8.28;
    if(x<145)return terraceY;
    const dx=x-CX,dz=z-CZ,r=Math.hypot(dx,Math.max(0,Math.abs(dz)-42.195));
    if(r<49.8)return .361;
    if(passage(x,z))return lerp(.361,terraceY,ease(284,324,x));
    const east=ease(46,65,dx)*(1-ease(37,59,Math.abs(dz)));
    const n=Math.round(lerp(32,12,east)),row=Math.floor((r-50)/.855);
    if(row>=0&&row<n)return 1.85+row*.575+(row>=17?1.18:0);
    return terraceY;
  }
  const wall=(x,z)=>ellipseDistance(x,z,ranges.swimming)<1||ellipseDistance(x,z,ranges.gym)<1||Math.hypot(x-83.6,z+791.9)<9.7||pierVolume(x,z);
  return {
    motorExclusions:stadiumMotorAreas,
    ownsFootprint:f=>[665408865,665408866,9244350,9244351].includes(Math.abs(Number(f.id))),
    groundHeight:terrace,
    coverHeight(x,z){
      if(x<bb[0]||z<bb[1]||x>bb[2]||z>bb[3]||!inRing(x,z,footprint))return null;
      if(shape.gap(x,z)<0)return 0;
      const r=Math.hypot(x-83.6,z+791.9);
      if(r<9.8)return 0;
      if(r<28.3){
        const angle=Math.atan2(z+791.9,x-83.6);
        const top=shape.ceiling(83.6+28.3*Math.cos(angle),-791.9+28.3*Math.sin(angle));
        let lo=.18,hi=1;
        for(let i=0;i<13;i++){const t=(lo+hi)*.5,at=10.4-.68*Math.sin(Math.PI*t)+17.9*t**3.15;if(at<r)lo=t;else hi=t;}
        return lerp(terraceY,top,(lo+hi)*.5);
      }
      return shape.ceiling(x,z);
    },
    walkable(x,z){return terrace(x,z)===null?null:!wall(x,z);},
    flightBlocked(x,y,z){
      const h=terrace(x,z);if(h===null)return null;
      const solid=ellipseDistance(x,z,ranges.gym)<1&&y<29||ellipseDistance(x,z,ranges.swimming)<1&&y<25.6;
      if(solid||y<h+.5)return true;
      const dz=z-gateCenter;
      if(Math.abs(dz)<=gateHalf&&x>gatePlane(dz)-10.4&&x<gatePlane(dz)+.15){
        const roofY=shape.ceiling(gatePlane(dz),z);
        if(y<roofY&&(y>roofY-9.3||(pierVolume(x,z)&&y>8.1)))return true;
      }
      if(shape.gap(x,z)<0||!inRing(x,z,footprint))return false;
      const r=Math.hypot(x-83.6,z+791.9);
      if(r<28.3){
        const angle=Math.atan2(z+791.9,x-83.6),top=shape.ceiling(83.6+28.3*Math.cos(angle),-791.9+28.3*Math.sin(angle));
        const f=clamp((y-terraceY)/(top-terraceY),0,1),radius=10.4-.68*Math.sin(Math.PI*f)+17.9*f**3.15;
        return y<=top+.4&&y>terraceY&&Math.abs(r-radius)<.90;
      }
      return Math.abs(y-shape.ceiling(x,z))<1.35;
    }
  };
}
export function buildStadium(root,m,map){
  const bowl=map.buildings.find(f=>f.id===bowlID),central=map.buildings.find(f=>f.id===connectorID);
  if(!bowl?.holes?.[0]||!central)return {ownsFootprint:()=>false,groundHeight:()=>null,walkable:()=>null,flightBlocked:()=>null,coverHeight:()=>null};
  const group=new T.Group();group.name='深圳湾体育中心 · 春茧';root.add(group);
  const inner=bowl.holes[0],footprint=venueOutline,shape=roof(group,inner);
  const near=new T.Group();near.name='近景球网、扶手、网壳细部';
  trackAndSeating(group,near);buildingBase(group,m,footprint,inner,shape,near);
  courtMarkings(group,map);fittings(group,near,inner,shape.ceiling,m);
  const details=new T.LOD();details.position.set(63,0,-787);near.position.set(-63,0,787);
  details.addLevel(near,0);details.addLevel(new T.Group(),820,.10);group.add(details);
  return controls(footprint,shape);
}
function finishRubberAndTurf(mat){
  mat.onBeforeCompile=s=>{
    s.vertexShader='varying vec2 stadiumXZ;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstadiumXZ=position.xz;');
    s.fragmentShader='varying vec2 stadiumXZ;\nfloat stHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float turfed=smoothstep(.0,.025,vColor.g-vColor.b);
      vec2 footprint=fwidth(stadiumXZ);
      vec2 leaf=stadiumXZ*vec2(63.,27.);
      float row=floor(leaf.y), h=stHash(vec2(floor(leaf.x)+floor(row*.5),row));
      vec2 local=fract(leaf)-.5;
      float rib=(1.-smoothstep(.025,.18,abs(local.x-local.y*(h-.5)*1.4)))*(1.-smoothstep(.17,.5,abs(local.y)));
      float bladeAA=1.-smoothstep(.12,.92,max(footprint.x*63.,footprint.y*27.));
      float sod=mix(.8,1.12,h)+rib*.22;
      vec2 crumb=stadiumXZ*139.;
      float grain=stHash(floor(crumb)),grainAA=1.-smoothstep(.23,1.25,max(footprint.x,footprint.y)*139.);
      float dotShape=1.-smoothstep(.12,.44,length(fract(crumb)-vec2(.3+grain*.37,.56)));
      float epdm=(grain-.44)*.38+dotShape*(grain>.74?.16:-.2);
      diffuseColor.rgb*=mix(1.+epdm*grainAA,1.+(sod-1.)*bladeAA,turfed);
    `);
  };
  mat.customProgramCacheKey=()=> 'stadium-rubber-grass-v1';
}
function signSurface(cn,en,orange=false,dark=false){
  const c=document.createElement('canvas');c.width=1024;c.height=256;
  const g=c.getContext('2d');g.fillStyle=orange?'#b95b24':dark?'#15282d':'#384b4f';g.fillRect(0,0,1024,256);
  if(dark){
    const bg=g.createLinearGradient(0,0,1024,256);bg.addColorStop(0,'#163b4a');bg.addColorStop(1,'#07222d');
    g.fillStyle=bg;g.fillRect(0,0,1024,256);g.fillStyle='#43a4a1';g.fillRect(44,43,8,170);
  }
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f2f2e8';g.font='600 83px "Microsoft YaHei", sans-serif';
  g.fillText(cn,512,101,935);g.fillStyle=dark?'#8fcbc4':'#e5e8df';g.font='500 38px Arial, sans-serif';g.fillText(en,512,184,920);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  return new T.MeshStandardMaterial({map:tex,color:0xffffff,emissiveMap:dark?tex:null,emissive:dark?0x719b92:0x000000,emissiveIntensity:.29,roughness:dark?.47:.64,side:T.DoubleSide});
}
function seaGate(root,frame,darkRails,ceiling,lights){
  // Geometric elevation traced against the supplier's completed Sea Gate
  // photographs, including its exposed central opening and deep return faces.
  // The off-state display remains transparent in daylight.
  const frameSkin=new Surface(),film=new Surface(),posts=new Surface();
  const outer=new T.Color('#9caaa8'),shadow=new T.Color('#525b5d'),under=new T.Color('#686e6d');
  const P=(t,y,d=0)=>[gatePlane(t)-d,y,gateCenter+t];
  const top=t=>ceiling(gatePlane(t),gateCenter+t)-1.20;
  const lip=t=>top(t)-(7.55+.61*(1-(t/gateHalf)**2));
  const count=34,depth=10.35;
  for(let i=0;i<count;i++){
    const u=-gateHalf+2*gateHalf*i/count,v=-gateHalf+2*gateHalf*(i+1)/count;
    const a=top(u),b=top(v),c=lip(u),d=lip(v);
    frameSkin.quad(P(u,c),P(u,c-.37),P(v,d-.37),P(v,d),undefined,outer);
    frameSkin.quad(P(u,c-.37),P(u,c-.62,depth),P(v,d-.62,depth),P(v,d-.37),undefined,under);
    frameSkin.quad(P(u,a,.1),P(v,b,.1),P(v,b,depth),P(u,a,depth),undefined,shadow);
    for(const back of [.13,depth-.1]){
      darkRails.between(...P(u,c,back),...P(v,d,back),.15);
      darkRails.between(...P(u,a,back),...P(v,b,back),.13);
      darkRails.between(...P(u,c,back),...P(u,a,back),.095);
    }
    darkRails.between(...P(u,c,depth-.65),...P(v,b,depth-.65),.12);
    for(let h=1;h<4;h++)darkRails.between(...P(u,lerp(a,c,h/4),.2),...P(v,lerp(b,d,h/4),.2),.045);
    const U=1-i/count,V=1-(i+1)/count;
    film.quad(P(u,c,-.025),P(u,a,-.025),P(v,b,-.025),P(v,d,-.025),[[U,0],[U,1],[V,1],[V,0]]);
  }
  for(const side of [-1,1]){
    const a=side*portalHalf,b=side*gateHalf,A=lip(a),B=lip(b),bottom=8.32;
    for(const t of [a,b]){
      const h=lip(t);
      posts.quad(P(t,bottom,.26),P(t,h,.26),P(t,h,depth),P(t,bottom,depth),undefined,under);
    }
    posts.quad(P(a,bottom,depth),P(a,A,depth),P(b,B,depth),P(b,bottom,depth),undefined,shadow);
    posts.quad(P(a,bottom,.22),P(b,bottom,.22),P(b,bottom,depth),P(a,bottom,depth),undefined,shadow);
    film.quad(P(a,bottom,-.025),P(a,A,-.025),P(b,B,-.025),P(b,bottom,-.025),[[0,0],[0,1],[.08,1],[.08,0]]);
    for(let k=0;k<=5;k++){
      const t=lerp(a,b,k/5),h=lip(t);
      frame.at(...P(t,(bottom+h)*.5,.8),1.2,h-bottom,.11);
    }
    for(let j=0;j<6;j++){
      const t=j/6,h=lerp(bottom,A,t),H=lerp(bottom,B,t);
      darkRails.between(...P(a,h,1.),...P(b,H,1.),.085);
    }
  }
  const enamel=new T.MeshStandardMaterial({vertexColors:true,metalness:.56,roughness:.38,side:T.DoubleSide});
  frameSkin.mesh(root,enamel,'海之门 · 桥形门楣、厚底板与滴水边',true);
  posts.mesh(root,enamel,'海之门 · 两端屏柱及侧廊',true);
  const c=document.createElement('canvas');c.width=1536;c.height=128;
  const g=c.getContext('2d'),r=g.createLinearGradient(0,0,c.width,c.height);
  r.addColorStop(0,'#205a78');r.addColorStop(.5,'#298ba8');r.addColorStop(1,'#195472');
  g.fillStyle=r;g.fillRect(0,0,c.width,c.height);
  for(let i=0;i<9;i++){
    g.strokeStyle='rgba(108,225,223,.23)';g.lineWidth=1.5;g.beginPath();
    for(let x=0;x<=c.width;x+=8){const y=68+25*Math.sin(x*.008+i*.13)+i*4;if(!x)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
  }
  g.font='500 70px "Microsoft YaHei", sans-serif';g.textBaseline='middle';g.textAlign='center';g.fillStyle='#d6f2ee';
  g.fillText('深 圳 湾 体 育 中 心',c.width/2,64);
  const title=new T.CanvasTexture(c);title.colorSpace=T.SRGBColorSpace;title.anisotropy=8;
  const screen=new T.MeshBasicMaterial({map:title,transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false});
  screen.onBeforeRender=()=>{screen.opacity=.09+.65*clamp((lights.lamp.emissiveIntensity-.36)/2.6,0,1);};
  film.mesh(root,screen,'海之门 · 透光媒体屏');
  const trace=new Surface(),night=()=>clamp((lights.lamp.emissiveIntensity-.36)/2.6,0,1);
  for(let k=0;k<96;k++){
    const a=lerp(-68,68,k/96),b=lerp(-68,68,(k+1)/96),A=top(a)+.70,B=top(b)+.70;
    trace.quad(P(a,A,-.07),P(a,A+.21,-.07),P(b,B+.21,-.07),P(b,B,-.07));
  }
  const strip=new T.MeshStandardMaterial({color:0x9ba8a9,emissive:0x168bdf,roughness:.39,side:T.DoubleSide});
  strip.onBeforeRender=()=>{strip.emissiveIntensity=night()*2.8;};
  trace.mesh(root,strip,'海之门 · 拱沿轮廓灯');
  const lamps=new T.MeshStandardMaterial({color:0xcfbc95,emissive:0xffab4d,roughness:.40});
  lamps.onBeforeRender=()=>{lamps.emissiveIntensity=.08+night()*2.5;};
  const lenses=new Instances(new T.BoxGeometry(1,1,1),lamps,'两侧入口 · 檐下转角洗墙灯');
  for(let x=37;x<162;x+=7.7){
    for(const [k,side] of [[0,-1],[2,1]]){
      const at=station(x,k),z=station(x,k+1),y=station(x,side<0?5:6);
      if(y<9.5)continue;
      frame.at(at,y-.41,z-side*.23,.68,.33,.42);
      lenses.at(at,y-.42,z-side*.025,.52,.19,.07);
    }
  }
  lenses.flush(root);
}
function fittings(root,near,hole,ceiling,m){
  const steel=new T.MeshStandardMaterial({color:0x74838a,roughness:.42,metalness:.70}), ivory=new T.MeshStandardMaterial({color:0xe2e5de,roughness:.39,metalness:.48});
  const bronze=new T.MeshStandardMaterial({color:0x374348,roughness:.56,metalness:.38});
  const darkRails=new Instances(new T.CylinderGeometry(1,1,1,6,1,true),steel,'天窗三角环桁架及支承');
  const structure=new Instances(new T.CylinderGeometry(1,1,1,8,1,true),ivory,'海之门枝形支柱');
  const frame=new Instances(new T.BoxGeometry(1,1,1),bronze,'门框及球场设备外壳');
  const light=new Instances(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xe4e8dc,emissive:0xbaa67b,emissiveIntensity:.14,roughness:.28,metalness:.25}),'体育场环形投光灯阵');
  const tv=signSurface('深圳湾体育中心','SHENZHEN BAY SPORTS CENTER',false,true);
  const bv=new T.Vector3(),up=new T.Vector3(0,1,0);
  function sign(mat,name,p,width,height,dx,dz){
    const mesh=new T.Mesh(new T.PlaneGeometry(width,height),mat);mesh.name=name;mesh.position.set(...p);
    bv.set(dx,0,dz).normalize();mesh.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(bv,new T.Vector3(),up));
    root.add(mesh);
  }
  // A deep open girder and floods line the football oculus. Four chords and
  // triangulated webs remain visible from the pitch and from above its rim.
  const highRing=[],lowRing=[];
  for(let i=0;i<hole.length;i++){
    const p=hole[i],q=hole[(i+1)%hole.length];
    for(let j=0;j<3;j++){
      const x=lerp(p[0],q[0],j/3),z=lerp(p[1],q[1],j/3),y=ceiling(x,z);
      const dx=(x-CX)/75,dz=(z-CZ)/97;
      highRing.push([x+1.2*dx,y-.84,z+1.2*dz]);lowRing.push([x+2.1*dx,y-3.32,z+2.1*dz]);
    }
  }
  for(let i=0;i<highRing.length;i++){
    const j=(i+1)%highRing.length,A=highRing[i],B=highRing[j],C=lowRing[i],D=lowRing[j];
    darkRails.between(...A,...B,.155);darkRails.between(...C,...D,.16);darkRails.between(...A,...D,.11);
    if(i%4===0){darkRails.between(...A,...C,.105);
      const rot=Math.atan2(CX-C[0],CZ-C[2]),h=C[1]-.42;
      frame.at(C[0],h,C[2],1.26,.43,.35,rot);light.at(C[0]+.215*Math.sin(rot),h,C[2]+.215*Math.cos(rot),1.17,.36,.05,rot);
    }
  }
  for(const signX of [-86,84]){
    const pos=[CX+signX,18.3,CZ+(signX>0?-53:54)];
    const dir=new T.Vector2(CX-pos[0],CZ-pos[2]).normalize(),rot=Math.atan2(dir.x,dir.y);
    frame.at(...pos,13.3,5.1,.7,rot);
    sign(tv,'田径场电子信息大屏',[pos[0]+dir.x*.40,pos[1],pos[2]+dir.y*.40],12.85,4.68,dir.x,dir.y);
    for(const off of [-4.9,4.9])structure.between(pos[0]+dir.y*off,5.95,pos[2]-dir.x*off,
      pos[0]+dir.y*off,16,pos[2]-dir.x*off,.25);
  }
  // A trussed observation gallery crosses the opening facing Shenzhen Bay.
  // The open ground level is intentional; maintain sightlines to the coast.
  const eastFloor=new Surface(),glass=new Surface(),post=new Surface();
  for(const dx of [309,330]){
    for(let i=0;i<13;i++){
      const z=-830+i*9.82,Z=z+9.82;
      darkRails.between(dx,7.98,z,dx,7.98,Z,.157);darkRails.between(dx,6.75,z,dx,6.75,Z,.15);
      darkRails.between(dx,6.75,z,dx,7.98,Z,.112);
      glass.quad([dx,8.37,z],[dx,9.53,z],[dx,9.53,Z-.055],[dx,8.37,Z-.055]);
    }
  }
  for(const z of [-839,-832,-709,-702]){
    structure.between(322,.36,z,322,14,z,.43);
    for(const dz of [-1,1]){
      const Z=z+dz*7;
      structure.between(322,12.8,z,324,ceiling(324,Z)-.77,Z,.35);
    }
  }
  seaGate(root,frame,darkRails,ceiling,m);
  const glassRail=new T.MeshPhysicalMaterial({color:0x749b9c,metalness:.18,roughness:.15,transparent:true,opacity:.37,depthWrite:false,side:T.DoubleSide});
  glass.mesh(root,glassRail,'看海廊玻璃栏板');
  // Undercroft shop windows, aluminium entry piers, individual double doors.
  for(const [cx,cz,rad,cn,en] of [[9,-811,58.45,'体育馆入口','ARENA ENTRANCE'],[-95,-823,49.5,'游泳馆入口','NATATORIUM']]){
    const z=cz+rad+.72,Y=terraceY;
    const pl=signSurface(cn,en,true);
    sign(pl,cn,[cx,Y+3.32,z+1.12],5.1,1.03,0,1);
    frame.at(cx,Y+3.3,z+.90,5.6,1.3,.43);
    for(let j=0;j<4;j++){
      const x=cx-3.3+j*2.2;
      frame.at(x,Y+1.34,z,.073,2.68,.10);frame.at(x+1.06,Y+1.34,z,.045,2.65,.10);
      frame.at(x+.53,Y+2.68,z,1.07,.11,.12);
      for(const off of [.44,.61])structure.between(x+off,Y+1.06,z+.09,x+off,Y+1.49,z+.09,.024);
      post.quad([x,Y+.03,z],[x,Y+2.62,z],[x+1.04,Y+2.62,z],[x+1.04,Y+.03,z]);
    }
  }
  const clearDoor=new T.MeshPhysicalMaterial({color:0x75969a,roughness:.145,metalness:.45,clearcoat:.78,side:T.DoubleSide});clearDoor.userData.cityProbe='district';post.mesh(root,clearDoor,'体育馆入口门扇');
  // Granite expansion joints, drainage, and a lower paved landing in front
  // of the eastern opening. All occupy positions within the mapped complex.
  const joints=new Surface(),drain=new T.MeshStandardMaterial({color:0x69716f,roughness:.73,side:T.DoubleSide});
  for(let z=-827;z<-710;z+=3.6)
    ribbon(joints,[[309,z],[329,z]],.047,8.31,1);
  for(let x=309;x<=329;x+=4.4)ribbon(joints,[[x,-826],[x,-715]],.038,8.31,1);
  for(const X of [316,326])ribbon(joints,[[X,-827],[X,-715]],.16,8.315,1);
  joints.mesh(root,drain,'海之门花岗岩分缝及排水格栅');
  eastFloor.polygon([[296,-834],[326.9,-840],[328.2,-749],[328.8,-707],[299,-707]],[],.345,5,white);
  const groundTex=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/stadium-granite.webp');groundTex.colorSpace=T.SRGBColorSpace;groundTex.wrapS=groundTex.wrapT=T.RepeatWrapping;
  eastFloor.mesh(root,new T.MeshStandardMaterial({map:groundTex,color:0xbec5be,roughness:.85,side:T.DoubleSide}),'海之门下平整集散庭院');
  // Recessed kiosks flank the central passage. They are glazed boxes behind
  // the bridge, leaving the central opening free of infill.
  for(const z of [-808,-732]){
    frame.at(317,1.97,z,4.6,3.22,13.8);
    frame.at(320.0,3.69,z,3.75,.27,15.7);
    for(let k=0;k<8;k++)frame.at(319.48,2.0,z-6.4+k*1.8,.08,3.25,.08);
  }
  const es=signSurface('海 之 门','SEA GATE',false);
  sign(es,'东侧海之门标识',[329.76,7.52,-794],7.3,1.10,1,0);
  frame.at(329.55,7.52,-794,.27,1.3,7.65);
  structure.flush(near);darkRails.flush(near);frame.flush(near);light.flush(near);
}
