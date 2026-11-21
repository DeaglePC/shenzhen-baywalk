import * as T from 'three';
import {Surface,Instances,area,sideWall} from './city-geometry.js';
import {architecturalMetal} from './city-curtainwall.js';

export function districtDetails(root,m){
  const cube=new T.BoxGeometry(1,1,1),silk=architecturalMetal(0xc2c7c4,.26);
  const charcoal=new T.MeshStandardMaterial({color:0x404c52,metalness:.49,roughness:.42});
  const accent=new Instances(cube,silk,'幕墙竖向翼板'),band=new Instances(cube,charcoal,'设备层阴影凹槽');
  const reveal=new Instances(cube,silk,'楼板外侧压条');
  const glass=new Surface(),roof=new Surface(),soffit=new Surface(),plaza=new Surface();
  const doorMat=new T.MeshPhysicalMaterial({color:0xcad9d8,metalness:.20,roughness:.09,clearcoat:.89,
    transparent:true,opacity:.39,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.0});
  doorMat.userData.cityProbe='street';
  const doors=new Instances(cube,doorMat,'瑞府入口夹胶玻璃'),hardware=new Instances(cube,architecturalMetal(0x96856e,.27,'street'),'瑞府入口门框与拉手');
  const lamp=new Instances(cube,m.lamp,'门廊廊下照明');
  const plaque=document.createElement('canvas');plaque.width=512;plaque.height=192;const pg=plaque.getContext('2d');
  pg.fillStyle='#4d5352';pg.fillRect(0,0,512,192);pg.textAlign='center';pg.fillStyle='#eee0bc';
  pg.font='500 61px "Microsoft YaHei",sans-serif';pg.fillText('瑞  府',256,103);pg.font='16px Arial';pg.fillText('R U I   F U',256,146);
  const tex=new T.CanvasTexture(plaque);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const plaqueBatch=new Instances(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({map:tex,roughness:.46,side:T.DoubleSide}),'瑞府入口铭牌');
  const facadeColor=new T.Color('#f4f1dc');
  function add(f,cx,cz,base){
    const ruifu=Number(f.id)===529272469;
    if(!ruifu&&(f.h<96||Math.hypot(cx+240,cz+440)>1050||f.p.length>48))return;
    const ring=area(f.p)>0?f.p:f.p.slice().reverse();
    if(ruifu){
      const inner=ring.map(([x,z])=>[cx+(x-cx)*.935,cz+(z-cz)*.935]);
      sideWall(glass,inner,.19,base,1,1,facadeColor);
      roof.polygon(ring,[],base-.015,3,new T.Color('#d0c2ae'));
    }
    for(let i=0;i<ring.length;i++){
      const A=ring[i],B=ring[(i+1)%ring.length],dx=B[0]-A[0],dz=B[1]-A[1];
      const len=Math.hypot(dx,dz);if(len<(ruifu?4:13))continue;
      const nx=dz/len,nz=-dx/len,rot=Math.atan2(dx,dz);
      const x=(A[0]+B[0])*.5,z=(A[1]+B[1])*.5,style=Math.abs(f.id)%3;
      if(ruifu){
        const threshold=[A,[A[0]+nx*3.2,A[1]+nz*3.2],[B[0]+nx*3.2,B[1]+nz*3.2],B];
        plaza.polygon(threshold,[],.181,3.2);
        if(len>23&&(nz>.45||nx>.70)){
          const rz=z+nz*.16,rx=x+nx*.16,ex=dx/len,ez=dz/len;
          for(let j=0;j<4;j++){
            const u=(j-1.5)*1.11,px=rx+ex*u,pz=rz+ez*u;
            doors.at(px,1.65,pz,.048,2.90,1.095,rot);
            hardware.at(px+ex*.544,1.65,pz+ez*.544,.087,2.94,.054,rot);
            hardware.at(px+ex*(j%2?.33:-.33)+nx*.069,1.42,pz+ez*(j%2?.33:-.33)+nz*.069,.045,.63,.032,rot);
          }
          hardware.at(rx,3.14,rz,.17,.18,4.68,rot);
          lamp.at(rx+nx*.65,3.16,rz+nz*.65,.08,.045,4.37,rot);
          hardware.at(rx,3.26,rz,1.65,.18,5.36,rot);
          const sx=rx+ex*3.35,sz=rz+ez*3.35;
          hardware.at(sx,1.53,sz,.11,.64,1.43,rot);
          plaqueBatch.at(sx+nx*.067,1.53,sz+nz*.067,1.39,.59,1,Math.atan2(nx,nz));
        }
        const n=Math.max(2,Math.round(len/3.05));
        for(let j=0;j<n;j++){
          const u=(j+.12)/n,px=A[0]+dx*u,pz=A[1]+dz*u,stretch=f.h-base-4.2;
          const major=j%5===0;
          accent.at(px+nx*.19,base+stretch*.5,pz+nz*.19,major?.56:.28,stretch,major?.23:.105,rot);
          band.at(px+nx*.045,base+stretch*.5,pz+nz*.045,.18,stretch,major?.42:.15,rot);
        }
        for(let y=base+3.84;y<f.h-4;y+=3.84){
          reveal.at(x+nx*.085,y,z+nz*.085,.22,.12,len,rot);
        }
        // Tall portico at the residential entrance rather than shop signs
        // repeated across every side of the same lobby.
        for(let j=0;j<Math.ceil(len/7);j++){
          const u=(j+.45)/Math.ceil(len/7),px=A[0]+dx*u,pz=A[1]+dz*u;
          accent.at(px,.5*base,pz,.67,base,.39,rot);
        }
        const outside=1.75;
        soffit.quad([A[0],base,A[1]],[B[0],base,B[1]],[B[0]+nx*outside,base-.18,B[1]+nz*outside],[A[0]+nx*outside,base-.18,A[1]+nz*outside]);
        reveal.at(x+nx*outside,base-.18,z+nz*outside,.22,.36,len,rot);
      }else{
        if((style===0||style===2)&&len>18){
          const positions=style===0?[.08,.92]:[.27,.73],span=f.h-base-Math.min(10,f.h*.05);
          positions.forEach(u=>accent.at(A[0]+dx*u+nx*.15,base+span*.5,A[1]+dz*u+nz*.15,.36,span,style===0?.31:.49,rot));
        }
      }
      const levels=ruifu?[.27,.57,.78,.97]:style===0?[.55,.94]:style===1?[.29,.66,.945]:[.88];
      for(const t of levels){
        const y=f.h*t,strip=ruifu?1.3:1.02;
        band.at(x+nx*.10,y,z+nz*.10,.23,strip,len,rot);
        reveal.at(x+nx*.22,y+strip*.55,z+nz*.22,.43,.15,len,rot);
        if(ruifu)reveal.at(x+nx*.15,y-strip*.18,z+nz*.15,.31,.11,len,rot);
      }
    }
  }
  function finish(){
    glass.mesh(root,m.atriumGlass,'瑞府 · 双层退进门厅',true);soffit.mesh(root,m.cream,'瑞府 · 银色挑檐',true);
    plaza.mesh(root,m.paving,'瑞府门厅石材地坪');roof.mesh(root,m.roof,'门厅上盖');
    for(const obj of [accent,band,reveal,doors,hardware,lamp,plaqueBatch])obj.flush(root,false);
  }
  return {add,finish};
}
