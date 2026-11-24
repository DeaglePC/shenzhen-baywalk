import * as T from 'three';
import {Instances,Surface} from './city-geometry.js';

const roadNames={
  '海天一路':'Haitian 1st Rd','海天二路':'Haitian 2nd Rd','海学路':'Haixue Rd','勤学路':'Qinxue Rd','后海大道':'Houhai Blvd','滨海大道辅路':'Binhai Blvd Service Rd',
  '登良路':'Dengliang Rd','创业路':'Chuangye Rd','望海路':'Wanghai Rd','沙河西路':'Shahe West Rd','科苑南路':'Keyuan South Rd',
  '海德三道':'Haide 3rd Ave','海德一道':'Haide 1st Ave','中心路':'Zhongxin Rd','东滨路':'Dongbin Rd','后海二桥':'Houhai 2nd Bridge',
  '后海大桥':'Houhai Bridge','金湾东三路':'Jinwan East 3rd Rd','金湾东四路':'Jinwan East 4th Rd','金湾西一路':'Jinwan West 1st Rd',
  '金湾西二路':'Jinwan West 2nd Rd','逸湖三街':'Yihu 3rd St','逸湖一街':'Yihu 1st St','逸湖五街':'Yihu 5th St','逸湖六街':'Yihu 6th St',
  '兰月一街':'Lanyue 1st St','兰月二街':'Lanyue 2nd St','兰月三街':'Lanyue 3rd St','兰月四街':'Lanyue 4th St','消防一道':'Xiaofang 1st Ave',
  '消防二道':'Xiaofang 2nd Ave','汀泽一路':'Tingze 1st Rd','逸景四路':'Yijing 4th Rd'
};
function signFaces(root,panels){
  if(!panels.length)return;
  const glyphs=new Map(),skin=new Surface(),faces=[];
  for(const {x,z,dx,dz,name} of panels){
    for(const k of [-1,1]){
      const vx=k*dx,vz=k*dz,nx=-vz,nz=vx;
      const east=Math.abs(vx)>Math.abs(vz),positive=east?vx>0:vz>0;
      const dir=east?(positive?'WE':'EW'):(positive?'NS':'SN'),key=name+dir;
      if(!glyphs.has(key))glyphs.set(key,{id:glyphs.size,name,dir});
      faces.push({x:x+nx*.038,z:z+nz*.038,vx,vz,id:glyphs.get(key).id});
    }
  }
  const canvas=document.createElement('canvas'),cols=4,rows=Math.ceil(glyphs.size/cols),w=512,h=144;
  canvas.width=w*cols;canvas.height=h*rows;
  const g=canvas.getContext('2d'),cardinal={E:'东',W:'西',N:'北',S:'南'};
  for(const {id,name,dir} of glyphs.values()){
    g.save();g.translate(id%cols*w,Math.floor(id/cols)*h);g.fillStyle='#e0e3df';g.fillRect(0,0,w,h);
    g.strokeStyle='#555c5c';g.lineWidth=3;g.strokeRect(7,7,w-14,h-14);
    g.fillStyle='#202b30';g.textAlign='center';g.textBaseline='middle';g.font='600 55px "Microsoft YaHei", sans-serif';g.fillText(name,256,51,325);
    g.fillRect(72,87,368,2);g.font='24px Arial';g.fillText(roadNames[name],256,112,337);
    for(const [i,col] of [[0,42],[1,470]]){g.font='bold 30px "Microsoft YaHei",sans-serif';g.fillText(cardinal[dir[i]],col,56);g.font='19px Arial';g.fillText(dir[i],col,101);}
    g.restore();
  }
  for(const {x,z,vx,vz,id} of faces){
    const a=[x-vx*1.04,2.48,z-vz*1.04],b=[x+vx*1.04,2.48,z+vz*1.04];
    const left=(id%cols+.003)/cols,right=(id%cols+.997)/cols,top=1-(Math.floor(id/cols)+.01)/rows,bottom=top-.98/rows;
    skin.quad(a,b,[b[0],3.065,b[2]],[a[0],3.065,a[2]],[[left,bottom],[right,bottom],[right,top],[left,top]]);
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  skin.mesh(root,new T.MeshStandardMaterial({map,roughness:.48,metalness:.13}),'双面路名牌 · 路名与方位');
}

export function streetFurniture(root,m){
  const box=new T.BoxGeometry(),round=new T.CylinderGeometry(1,1,1,10);
  const zinc=new T.MeshStandardMaterial({color:0xa9b0ad,metalness:.65,roughness:.35});
  const body=new T.MeshStandardMaterial({color:0x475051,metalness:.5,roughness:.46});
  const warm=m.parkLights.finish(new T.MeshStandardMaterial({color:0xe1ddd1,emissive:0xffdc9f,roughness:.41}),3.2);
  const shaft=new Instances(new T.CylinderGeometry(.60,1,1,10),zinc,'道路照明 · 锥形钢杆');
  const park=new Instances(new T.CylinderGeometry(.76,1,1,10),m.dark,'步道庭院灯杆');
  const fittings=new Instances(round,zinc,'灯杆底座与接头'),hatch=new Instances(box,body,'灯杆检修盖');
  const shade=new Instances(new T.CylinderGeometry(.76,1,1,16),body,'灯具压铸外壳'),lens=new Instances(round,warm,'道路灯配光透镜');
  const arm=new Instances(round,zinc,'路灯挑臂'),plate=new Instances(box,zinc,'地名牌铝板');
  const panels=[];
  return {
    lamp(x,z,dx,dz,side,major,near){
      const vx=dz*side,vz=-dx*side,yaw=Math.atan2(vx,vz),h=major?8.35:4.12,base=major?.143:.094;
      (major?shaft:park).at(x,(h+.17)/2,z,base,h-.17,base,yaw);
      if(near){
        fittings.at(x,.234,z,base*1.65,.14,base*1.65);fittings.at(x,.49,z,base*1.18,.41,base*1.18);
        hatch.at(x+vx*base*.94,.90,z+vz*base*.94,base*1.16,.39,.024,yaw);
      }
      if(major){
        arm.between(x,h-.72,z,x+vx*.88,h-.12,z+vz*.88,.065);
        arm.between(x+vx*.88,h-.12,z+vz*.88,x+vx*1.91,h+.04,z+vz*1.91,.048);
        x+=vx*2.08;z+=vz*2.08;
        shade.at(x,h+.035,z,.205,.127,.49,yaw);lens.at(x,h-.035,z,.15,.035,.354,yaw);
        m.parkLights.fixture(x,h-.11,z,0xffdcaf,135,28,.335);
      }else{
        fittings.at(x,h-.15,z,.17,.11,.17);lens.at(x,h+.01,z,.155,.26,.155);
        shade.at(x,h+.18,z,.26,.105,.26);m.parkLights.fixture(x,h,z,0xffdbab,64,18,.31);
      }
    },
    sign(name,x,z,dx,dz){
      if(!roadNames[name]||panels.some(p=>p.name===name&&Math.hypot(x-p.x,z-p.z)<62))return;
      x+=dx*1.85;z+=dz*1.85;const yaw=Math.atan2(-dz,dx);
      fittings.at(x,1.315,z,.061,2.31,.061);fittings.at(x,.24,z,.118,.13,.118);
      plate.at(x,2.774,z,2.105,.604,.071,yaw);panels.push({name,x,z,dx,dz});
    },
    finish(){
      for(const part of [shaft,park,fittings,hatch,shade,lens,arm,plate])part.flush(root,part===shaft||part===park,part===hatch?90:750);
      signFaces(root,panels);
    }
  };
}
