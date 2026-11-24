import * as T from 'three';
import outlines from './tencent-wordmark.json';

// The first seven glyphs form the English word. The remaining disconnected
// contours form the two Chinese characters, including their counters.
export function tencentLettering(){
  const shapes=outlines.map(([outer,...holes])=>{
    const points=ring=>ring.map(([x,y])=>new T.Vector2(x,y));
    const shape=new T.Shape(points(outer));
    shape.holes=holes.map(ring=>new T.Path(points(ring)));
    return shape;
  });
  const versions=new Map();
  return function place(root,{english=false,x,y,z,nx,nz,width,depth,face,side,name}){
    if(!versions.has(english)){
      const g=new T.ExtrudeGeometry(english?shapes.slice(0,7):shapes,{
        depth:1,steps:1,bevelEnabled:false,curveSegments:1
      });
      g.computeBoundingBox();
      const box=g.boundingBox;
      g.translate(-(box.min.x+box.max.x)/2,-box.min.y,0);
      versions.set(english,{geometry:g,nativeWidth:box.max.x-box.min.x});
    }
    const {geometry,nativeWidth}=versions.get(english),scale=width/nativeWidth;
    const mesh=new T.Mesh(geometry,[face,side]);
    mesh.name=name;mesh.scale.set(scale,scale,depth);
    mesh.rotation.y=Math.atan2(nx,nz);mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    return mesh;
  };
}

