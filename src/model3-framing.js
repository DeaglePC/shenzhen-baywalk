// Perspective cameras fitted to the 1920 × 1080 MT382 / PN01 / W38A / IPB11
// configurator renders. Coordinates are metres in the GLB's +Z-forward frame.
// The look targets sit on the centreline, leaving OrbitControls free to rotate
// and dolly from the source composition.
const views={
  front:{eye:[4.56025,.81477,3.83031],target:[0,.63647,.37393],fov:44.1552},
  side:{eye:[6.75354,.66443,.29197],target:[0,.62083,-.01878],fov:40.8587},
  rear:{eye:[5.83666,.88628,-5.64709],target:[0,.67465,-.38154],fov:33.2234}
};
const sourceAspect=1920/1080;

export function model3Framing(id,aspect=sourceAspect){
  if(!Object.hasOwn(views,id))return null;
  const pose=views[id];
  const screen=Number.isFinite(aspect)&&aspect>0?aspect:sourceAspect;
  const fov=360/Math.PI*Math.atan(Math.tan(pose.fov*Math.PI/360)*Math.max(1,sourceAspect/screen));
  return {eye:pose.eye,target:pose.target,fov};
}
