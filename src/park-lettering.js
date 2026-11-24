import * as T from 'three';
import outlines from './park-lettering.json';

const geometryCache=new Map();

export function parkLetters(parent,line,width,depth,front,edge,x,y,z,yaw=0){
  if(!geometryCache.has(line)){
    const shapes=outlines[line].map(([outer,...holes])=>{
      const points=ring=>ring.map(([u,v])=>new T.Vector2(u,v));
      const shape=new T.Shape(points(outer));
      shape.holes=holes.map(ring=>new T.Path(points(ring)));
      return shape;
    });
    const geometry=new T.ExtrudeGeometry(shapes,{depth:1,bevelEnabled:false,steps:1});
    geometry.computeBoundingBox();
    const {min,max}=geometry.boundingBox;
    const span=max.x-min.x;
    geometry.translate(-(max.x+min.x)*.5,-min.y,0);
    geometryCache.set(line,{geometry,span});
  }
  const {geometry,span}=geometryCache.get(line);
  const letters=new T.Mesh(geometry,[front,edge]);
  letters.name=line;letters.scale.set(width/span,width/span,depth);
  letters.position.set(x,y,z);letters.rotation.y=yaw;letters.castShadow=true;
  parent.add(letters);
  return letters;
}
