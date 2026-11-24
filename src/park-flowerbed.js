import * as T from 'three';
import {Grid,Instances,Surface,bounds,inRing,random,segmentDistance} from './city-geometry.js';
import {photo} from './city-materials.js';
import strokes from './flowerbed-strokes.json';

function plantTips(root,surface,flowers){
  const rng=random(flowers?4219:619),petals=new Surface(),count=flowers?6:4;
  for(let i=0;i<count;i++){
    const a=i*Math.PI*2/count,c=Math.cos(a),s=Math.sin(a),w=flowers?.014:.012,l=flowers?.033:.043;
    petals.quad([0,.01,0],[c*l*.6-s*w,.024,s*l*.6+c*w],[c*l,.037,s*l],
      [c*l*.6+s*w,.022,s*l*.6-c*w]);
  }
  const mat=new T.MeshStandardMaterial({roughness:.89,side:T.DoubleSide});
  const tips=new Instances(petals.geometry(),mat,flowers?'花坛 · 金黄小花花瓣':'花坛 · 酒红嫩叶枝叶');
  const shade=new T.Color(flowers?0xdb9217:0x6d153a),light=new T.Color(flowers?0xffcb31:0xab3552);
  const vertex=i=>new T.Vector3().fromArray(surface.p,3*surface.indices[i]);
  for(let i=0;i<surface.indices.length;i+=3){
    const a=vertex(i),b=vertex(i+1),c=vertex(i+2),area=new T.Triangle(a,b,c).getArea();
    const n=Math.floor(area*(flowers?63:37)+rng());
    for(let j=0;j<n;j++){
      const u=Math.sqrt(rng()),v=rng(),p=a.clone().multiplyScalar(1-u).addScaledVector(b,u*(1-v)).addScaledVector(c,u*v);
      const scale=.68+rng()*.93;
      tips.at(p.x,p.y+.002,p.z,scale,scale,scale,rng()*Math.PI*2,shade.clone().lerp(light,rng()));
    }
  }
  tips.flush(root,false,58);
}

export function parkFlowerbed(root,map){
  const garden=map.land.find(f=>f.id===775214603);
  if(!garden)return;
  const p=garden.p;
  const curve=points=>new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));
  const middle=curve([p[12],[184.8,-224.8],[192,-216.0],[197.6,-207.1],p[4],p[5]]);
  const back=curve([11,10,9,8,7,6].map(i=>p[i]));
  const group=new T.Group();group.name='深圳人才公园 · 湖岸花草字';root.add(group);
  const sections=64,ground=new Grid(8),green=new Surface(),red=new Surface(),gold=new Surface(),rim=new Surface();
  const upper=new T.Color(0xffffff),lower=new T.Color(0xafbd9e),bank=new T.Color(0x89987c);
  const uv=([x,y,z])=>[x/2.1,(z+y*.42)/2.1];
  function quad(surface,points,tone){
    surface.quad(...points,points.map(uv),tone);
  }
  // Retain the same triangles for height and flight queries as for rendering.
  function floor(a,b,c){
    const ring=[a,b,c].map(v=>[v[0],v[2]]),box=bounds(ring);
    const abx=b[0]-a[0],abz=b[2]-a[2],acx=c[0]-a[0],acz=c[2]-a[2],det=abx*acz-abz*acx;
    if(Math.abs(det)<.00001)return;
    const dy1=b[1]-a[1],dy2=c[1]-a[1];
    ground.add({ring,a,dx:(dy1*acz-dy2*abz)/det,dz:(abx*dy2-acx*dy1)/det},box);
  }
  function top(points,tone){
    quad(green,points,tone);
    floor(points[0],points[1],points[2]);floor(points[0],points[2],points[3]);
  }
  const toe=v=>[v[0],.067,v[2]];
  function skirt(a,b,tone){
    const span=Math.hypot(a[0]-b[0],a[2]-b[2])/2.1,station=(a[0]+a[2])/2.1;
    green.quad(toe(a),a,b,toe(b),[[station,0],[station,a[1]/2.1],[station+span,b[1]/2.1],[station+span,0]],tone);
  }
  // Each station crosses both tiers, from the lakeside toe to the back of the bank.
  const front=[],seam=[],crest=[],tail=[];
  for(let i=0;i<=sections;i++){
    const t=i/sections,a=middle.getPointAt(t),b=back.getPointAt(t),inland=b.clone().sub(a).normalize();
    front.push([a.x-5.4*inland.x,.54,a.z-5.4*inland.z]);
    seam.push([a.x,2.15,a.z]);crest.push([b.x,5.15,b.z]);
    tail.push([b.x+5.3*inland.x,.067,b.z+5.3*inland.z]);
    if(!i)continue;
    const j=i-1;
    top([front[j],front[i],seam[i],seam[j]],lower);
    top([seam[j],seam[i],crest[i],crest[j]],upper);
    top([crest[j],crest[i],tail[i],tail[j]],bank);
    skirt(front[j],front[i],lower);
  }
  for(const i of [0,sections]){
    skirt(front[i],seam[i],lower);skirt(seam[i],crest[i],lower);skirt(crest[i],tail[i],bank);
  }
  function row(isChinese){
    const near=isChinese?seam:front,far=isChinese?crest:seam;
    const width=near.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q[0]-near[i][0],q[2]-near[i][2]),0);
    // The lower row is closer to the path. These optical margins align the
    // visible ends of S and K with 深 and 园 from the lakeside viewing point.
    const left=isChinese?.026:.111,right=isChinese?.974:.921;
    function point(u,v,h){
      const station=T.MathUtils.clamp(u,0,1)*sections,i=Math.min(sections-1,Math.floor(station)),t=station-i;
      const at=k=>T.MathUtils.lerp(T.MathUtils.lerp(near[i][k],near[i+1][k],t),
        T.MathUtils.lerp(far[i][k],far[i+1][k],t),v);
      return [at(0),T.MathUtils.lerp(near[0][1],far[0][1],v)+h,at(2)];
    }
    const fill=isChinese?red:gold;
    function plantTriangle(a,b,c){
      // A long straight stroke must follow the bend even between its traced corners.
      const sorted=[a,b,c].sort((left,right)=>left.x-right.x);
      if(sorted[2].x-sorted[0].x>.029){
        const [lo,mid,hi]=sorted,split=lo.clone().lerp(hi,.5);
        plantTriangle(lo,mid,split);plantTriangle(split,mid,hi);return;
      }
      const pts=[a,b,c].map(v=>point(v.x,v.y,.025));
      const indices=pts.map(q=>fill.vertex(q,uv(q)));
      if(new T.Triangle(...pts.map(q=>new T.Vector3(...q))).getNormal(new T.Vector3()).y<0)indices.reverse();
      fill.indices.push(...indices);
    }
    function edging(ring){
      // Offset in metres, so skinny horizontal strokes get the same metal lip as vertical ones.
      const depth=isChinese?10.8:5.4;
      const metric=ring.map(v=>new T.Vector2(v.x*width,v.y*depth));
      const edges=metric.map((v,i)=>metric[(i+1)%metric.length].clone().sub(v).normalize());
      const offset=metric.map((_,i)=>{
        const prev=edges[(i+edges.length-1)%edges.length],next=edges[i];
        const normal=new T.Vector2(-prev.y-next.y,prev.x+next.x).normalize();
        return normal.multiplyScalar(.035/Math.max(.5,normal.dot(new T.Vector2(-next.y,next.x))));
      });
      function profile(i,t){
        const j=(i+1)%ring.length,v=ring[i].clone().lerp(ring[j],t),n=offset[i].clone().lerp(offset[j],t);
        const lip=(side,h)=>point(v.x+side*n.x/width,v.y+side*n.y/depth,h);
        return [lip(-1,.006),lip(-1,.078),lip(1,.078),lip(1,.006)];
      }
      for(let i=0;i<ring.length;i++){
        const n=Math.max(1,Math.ceil(Math.abs(ring[(i+1)%ring.length].x-ring[i].x)*sections));
        let a=profile(i,0);
        for(let j=1;j<=n;j++){
          const b=profile(i,j/n);
          for(let k=0;k<3;k++)quad(rim,[a[k],b[k],b[k+1],a[k+1]]);
          a=b;
        }
      }
    }
    for(const polygon of strokes[isChinese?'chinese':'english']){
      const rings=polygon.map(r=>r.map(([u,v])=>new T.Vector2(T.MathUtils.lerp(left,right,u),.085+.83*v)));
      const vertices=rings.flat();
      for(const tri of T.ShapeUtils.triangulateShape(rings[0],rings.slice(1)))plantTriangle(...tri.map(i=>vertices[i]));
      rings.forEach(edging);
    }
  }
  row(false);row(true);
  const textures=[];
  function planting(surface,file,label,vertexColors=false){
    const tex=photo('flowerbed-'+file+'.webp');
    const mat=new T.MeshStandardMaterial({map:tex,bumpMap:tex,bumpScale:.032,roughness:.96,vertexColors,side:T.DoubleSide});
    surface.mesh(group,mat,label,true);textures.push(tex);
  }
  planting(green,'hedge','花坛 · 修剪绿篱与岸线植被',true);
  planting(red,'burgundy','花坛 · 深圳人才公园红叶枝叶');
  planting(gold,'gold','花坛 · SHENZHEN TALENT PARK 黄花枝叶');
  plantTips(root,red,false);plantTips(root,gold,true);
  rim.mesh(group,new T.MeshStandardMaterial({color:0x3e403c,metalness:.38,roughness:.7,side:T.DoubleSide}),'花坛 · 深色种植槽收边',true);
  const footprint=[...front,...tail.slice().reverse()].map(([x,,z])=>[x,z]);
  const box=bounds(footprint);
  function heightAt(x,z){
    for(const f of ground.query(x,z)){
      if(inRing(x,z,f.ring))return f.a[1]+f.dx*(x-f.a[0])+f.dz*(z-f.a[2]);
    }
    return null;
  }
  function reservesPlant(x,z,radius){
    const margin=Math.min(4,.4+radius*.27);
    if(x<box[0]-margin||x>box[2]+margin||z<box[1]-margin||z>box[3]+margin)return false;
    return inRing(x,z,footprint)||footprint.some((a,i)=>segmentDistance(x,z,a,footprint[(i+1)%footprint.length])<margin);
  }
  return {heightAt,reservesPlant,dispose(){textures.forEach(t=>t.dispose());}};
}
