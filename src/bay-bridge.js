import * as T from 'three';
import {Surface,Instances} from './city-geometry.js';
import regional from './bay-crossing.json';
import {bayHeight,bayWidth,navigationSpan,channelTowers} from './bay-alignment.js';

export function bayBridge(root,map,m){
  const asphalt=new Surface(),concrete=new Surface(),mark=new Surface(),tower=new Surface();
  const tube=new T.CylinderGeometry(1,1,1,10),box=new T.BoxGeometry();
  const piers=new Instances(tube,m.curb,'跨海高架墩柱'),caps=new Instances(box,m.curb,'跨海高架盖梁');
  const stays=new Instances(tube,m.cream,'深港航道桥单索面斜拉索');
  const aligned=regional.axes.map((line,i)=>{
    const road=map.roads.find(r=>r.id===(i===0?276506946:568424517));
    const inside=(road?.p??[]).filter(p=>p[1]<3199.99).sort((a,b)=>a[1]-b[1]);
    return [...inside,...line];
  });
  if(!aligned.every(line=>line[0][1]<3150))return;
  function onAxis(i,z){
    const line=aligned[i];let k=1;
    while(k<line.length-1&&line[k][1]<z)k++;
    const a=line[k-1],b=line[k],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
    return {x:a[0]+(z-a[1])*dx/dz,z,dx,dz,y:bayHeight(z)};
  }
  function center(z){
    const a=onAxis(0,z),b=onAxis(1,z);return {...a,x:(a.x+b.x)*.5};
  }
  function point(p,off,h){return [p.x-p.dz*off,p.y+h,p.z+p.dx*off];}
  function span(s,a,b,l,r,ly,ry=ly){s.quad(point(a,l,ly),point(b,l,ly),point(b,r,ry),point(a,r,ry));}
  for(let i=0;i<aligned.length;i++){
    const line=aligned[i],last=line.at(-1)[1],w=bayWidth(3200,9.8)/2,sign=i?1:-1;
    let a=onAxis(i,3200),station=0;
    const sections=[3200,...line.filter(p=>p[1]>3200).map(p=>p[1])];
    for(let k=1;k<sections.length;k++){
      const from=sections[k-1],end=Math.min(last,sections[k]),n=Math.ceil((end-from)/15);
      for(let j=1;j<=n;j++){
        const b=onAxis(i,from+(end-from)*j/n),length=Math.hypot(b.x-a.x,b.z-a.z);
        span(asphalt,a,b,w,-w,0);
        for(const side of [-1,1]){
          span(concrete,a,b,side*w,side*w,.68,-.75);span(concrete,a,b,side*w,side*(w-.24),.68);
          span(concrete,a,b,side*w,side*(w-1.1),-.75,-2.65);
          span(mark,a,b,side*(w-.48),side*(w-.62),.024);
        }
        span(concrete,a,b,w-1.1,-w+1.1,-2.65);
        for(let s=Math.ceil(station/11)*11;s<station+length;s+=11){
          const pa=onAxis(i,a.z+(b.z-a.z)*(s-station)/length),pb=onAxis(i,Math.min(last,pa.z+4*pa.dz));
          for(const off of [-1,1])span(mark,pa,pb,off*w/3+.084,off*w/3-.084,.022);
        }
        station+=length;a=b;
      }
    }
    for(let z=3212;z<last;){
      const p=onAxis(i,z),low=-1.4,cap=p.y-2.65;
      if(!navigationSpan(z,p.dz)){
        const [x,,Z]=point(p,sign*.52,0),yaw=Math.atan2(p.dx,p.dz);
        piers.at(x,(cap+low)/2,Z,1.45,cap-low,1.75,yaw);
        caps.at(x,cap-.43,Z,12.5,.90,2.2,yaw);
      }
      z+=p.dz*75;
    }
  }
  for(const {z,dir,span:main,back,cables,rise} of channelTowers){
    const p=center(z),bottom=bayHeight(z),rings=[];
    const ends=[z-dir*p.dz*back,z+dir*p.dz*main].sort((a,b)=>a-b);
    for(let s=ends[0];s<ends[1];s+=10){
      const a=center(s),b=center(Math.min(s+10,ends[1]));
      span(concrete,a,b,4.5,-4.5,-.14);span(concrete,a,b,-4.5,4.5,-2.56);
    }
    for(const [f,side,long] of [[0,4.5,7],[.17,3.9,6.2],[.68,2.7,5.6],[1,1.75,3.4]]){
      const lean=dir*rise*(.14*f+.13*f*f),y=f===0?-1.5:bottom+rise*f;
      rings.push([[-side,-long],[side,-long],[side,long],[-side,long]].map(([n,l])=>[p.x+(l+lean)*p.dx-n*p.dz,y,p.z+(l+lean)*p.dz+n*p.dx]));
    }
    for(let i=1;i<rings.length;i++)for(let j=0;j<4;j++)tower.quad(rings[i-1][j],rings[i][j],rings[i][(j+1)%4],rings[i-1][(j+1)%4]);
    tower.quad(...rings.at(-1));
    for(let k=1;k<=cables;k++){
      const f=.43+.55*k/cables,lean=dir*rise*(.14*f+.13*f*f);
      for(const [direction,run] of [[dir,main],[-dir,back]]){
        const at=center(z+p.dz*direction*(run-9)*k/cables);
        stays.between(p.x+p.dx*lean,bottom+rise*f,p.z+p.dz*lean,at.x,at.y+.62,at.z,.20);
      }
    }
  }
  const road=new T.MeshStandardMaterial({color:0x55595b,roughness:.94,side:T.DoubleSide});
  asphalt.mesh(root,road,'跨海公路车道路面');mark.mesh(root,m.paint,'跨海桥车道划线');
  concrete.mesh(root,m.curb,'跨海公路桥箱梁与防撞墙',true);tower.mesh(root,m.cream,'深圳湾公路大桥 · 两座相向倾斜的航道塔',true);
  piers.flush(root,true);caps.flush(root,true);stays.flush(root);
}
