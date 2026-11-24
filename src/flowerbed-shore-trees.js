import * as T from 'three';
import {Instances,along,random} from './city-geometry.js';
import {parkShrubs} from './park-shrubs.js';

export function shorePlanting(root,ground,shootMap,runs){
  const rng=random(21964),tau=Math.PI*2;
  const timber=new Instances(new T.CylinderGeometry(.73,1,1,8),
    new T.MeshStandardMaterial({color:0x584e38,roughness:1}),'花坛水岸 · 真实树干与分叉');
  const spray=new T.PlaneGeometry(1,1,2,3);
  const pos=spray.getAttribute('position');
  for(let i=0;i<pos.count;i++){
    const t=.5-pos.getY(i),x=pos.getX(i);
    pos.setXYZ(i,x+.21*t*t,-t,.22*(1-4*x*x)*Math.sin(Math.PI*t));
  }
  spray.computeVertexNormals();
  const leaves=new Instances(spray,new T.MeshStandardMaterial({map:shootMap,side:T.DoubleSide,
    alphaTest:.30,alphaToCoverage:true,color:0xd9dfc5,envMapIntensity:.6,roughness:1}),'花坛水岸 · 悬垂细枝叶');
  const shrub=parkShrubs(root,'花坛水岸 · 沿岸灌木',ground);
  function tree(x,z,height,width){
    const floor=ground(x,z),scale=height/7.15;
    function pt(angle,r,h){return [x+Math.cos(angle)*r*width,floor+h*scale,z+Math.sin(angle)*r*width];}
    for(let i=0;i<12;i++){
      const dir=i*2.4+rng()*.35,reach=.65+rng()*1.65,high=6.75-reach*.75+rng()*.77;
      const stem=(i%3)*2.12,foot=pt(stem,.14,.02),fork=pt(stem,.62,1.82),crown=pt(dir,reach,high);
      if(i<3)timber.between(...foot,...fork,(.12+i*.016)*scale);
      timber.between(...fork,...crown,.067*scale);
      for(let j=0;j<8;j++){
        const angle=dir+(rng()-.5)*2.3,r=reach+.29+rng()*.99,h=high-2.55+rng()*2.9;
        const tip=pt(angle,r,h),joint=pt(dir,reach*.79,high*.72);
        timber.between(...joint,...tip,.023*scale);
        for(let k=0;k<14;k++){
          const a=rng()*tau,spread=Math.sqrt(rng())*.84;
          const px=tip[0]+Math.cos(a)*spread*width,pz=tip[2]+Math.sin(a)*spread*width;
          const y=tip[1]+(.5+rng()*.68-spread*.9)*scale;
          const size=(.57+rng()*.64)*scale;
          leaves.at(px,y,pz,size*1.22,size*(1.25+rng()*.62),size,a,
            new T.Color().setScalar(.68+rng()*.56));
        }
      }
    }
  }
  // In the reverse view the shorter tuft is to the right of the multi-stem crown.
  tree(159.7,-196.1,6.25,1.02);tree(157.2,-198.6,3.85,.61);
  for(const line of runs)along(line,.44,.1,(x,z,dx,dz)=>{
    const side=(rng()-.5)*1.0,px=x-dz*side,pz=z+dx*side,y=ground(px,pz);
    const r=.37+rng()*.56,h=.3+rng()*.49;
    shrub.at(px,y+.18,pz,r,h,r*(.8+.25*rng()),rng()*tau);
  });
  shrub.flush(root,true);timber.flush(root,true,190);leaves.flush(root,true,190);
}
