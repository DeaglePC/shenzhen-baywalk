import * as T from 'three';
import {mountSculpture} from './park-sculpture.js';
import {Surface,sideWall,random} from './city-geometry.js';

export function parkMonuments(tidal,map){
  const patina=new T.TextureLoader().load(import.meta.env.BASE_URL+'city/bronze-plinth.webp');
  patina.colorSpace=T.SRGBColorSpace;patina.wrapS=patina.wrapT=T.RepeatWrapping;
  const plinth=new T.MeshStandardMaterial({map:patina,roughness:.81,metalness:.27,side:T.DoubleSide});
  return Promise.all([['领航者','navigators-h31'],['弄潮儿','enterprise-full-h31'],['拓荒者','pioneers-h31']].map(async([name,file],i)=>{
    const landmark=map.pois.find(p=>p.kind==='artwork'&&p.name===name);if(!landmark)return;
    const [x,z]=landmark.p,y=tidal.heightAt(x,z)??.246;
    const grp=new T.Group();grp.name='人才功勋墙 · '+name;grp.position.set(x,y,z);grp.rotation.y=-.23;tidal.group.add(grp);
    const rock=new Surface(),rng=random(5211+i),roughRing=[[-1.14,-.57],[-.69,-.81],[.37,-.76],[1.12,-.54],[1.21,.23],[.83,.57],[-.66,.61],[-1.12,.32]];
    // Keep the visible soles of every person over the stone. The archival
    // enterprise group stands on a rectangular plinth with clipped corners.
    const ring=name==='弄潮儿'?[[-1.35,-1.12],[1.10,-1.12],[1.25,-.97],[1.25,.68],[1.10,.79],[-1.33,.79],[-1.43,.66],[-1.43,-1.0]]:
      name==='拓荒者'?roughRing.map(([a,b])=>[a*1.14,b*1.28]):roughRing;
    const base=ring.map(([a,b])=>[a*.94,b*.95]);sideWall(rock,base,0,.12,.8,.68);
    for(let j=0;j<ring.length;j++){
      const a=base[j],b=base[(j+1)%ring.length],c=ring[(j+1)%ring.length],d=ring[j];
      const rows=4,cols=9,prev=[];
      for(let r=0;r<=rows;r++){
        const line=[],t=r/rows;
        for(let k=0;k<=cols;k++){
          const u=k/cols,rough=k>0&&k<cols&&r>0&&r<rows?(rng()-.5)*(j<3?.12:.025):0;
          const px=T.MathUtils.lerp(T.MathUtils.lerp(a[0],b[0],u),T.MathUtils.lerp(d[0],c[0],u),t);
          const pz=T.MathUtils.lerp(T.MathUtils.lerp(a[1],b[1],u),T.MathUtils.lerp(d[1],c[1],u),t);
          line.push([px*(1+rough),.12+t*.47,pz*(1+rough)]);
          if(k&&r)rock.quad(prev[k-1],line[k-1],line[k],prev[k],[[u-1/cols,t-.25],[u-1/cols,t],[u,t],[u,t-.25]]);
        }
        prev.splice(0,prev.length,...line);
      }
    }
    rock.polygon(ring,[],.59,1);rock.mesh(grp,plinth,'铜像基座 · 后缘凿面',true);
    tidal.obstacle(x,z,.9);
    await mountSculpture(grp,file,.59);
  }));
}
