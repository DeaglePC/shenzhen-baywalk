// Photo pose in vehicle-local Three.js metres, fitted to the two alloy rims,
// their hub centres and the front number plate in the supplied 1600×1200 image.
export const curbTaxi={x:-126.8,z:-420.7,yaw:Math.atan2(.30,-.954),floor:.28};
export const curbModel3={x:-123.08,z:-434.89,yaw:Math.atan2(5.5,-20.6),floor:.28};
export function model3Street(){
  return {id:'model3',name:'登良路 · Model 3',x:-126.8,z:-441.5,lookX:curbModel3.x,lookZ:curbModel3.z,
    portrait:{height:1.82,target:[curbModel3.x,.90,curbModel3.z],fov:29}};
}
export const referencePose={
  eye:[-2.578866,1.046449,3.599124],direction:[.655855,-.034160,-.754114],
  up:[.034842,.999281,-.014964],fov:43.6445,aspect:4/3
};
export function referenceFov(aspect){
  const t=Math.tan(referencePose.fov*Math.PI/360);
  return Math.atan(t*Math.max(1,referencePose.aspect/aspect))*360/Math.PI;
}
export function photoStreet(){
  const {x,z,yaw,floor}=curbTaxi,s=Math.sin(yaw),c=Math.cos(yaw);
  const turn=([a,b,d])=>[c*a+s*d,b,-s*a+c*d];
  const [dx,height,dz]=turn(referencePose.eye),dir=turn(referencePose.direction);
  return {id:'street',name:'登良路',x:x+dx,z:z+dz,lookX:x+dx+dir[0],lookZ:z+dz+dir[2],
    photo:{height:floor+height,direction:dir,up:turn(referencePose.up)}};
}
