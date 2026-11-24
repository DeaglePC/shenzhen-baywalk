// Upper pedestrian routes around the mapped Shenzhen Bay Street platform.
export const skywalkHeight=6.25;
export const skywalkFootprints=new Set([-10744153,-19690684,1436391644,775735690]);
export const coastalUpper=r=>r.p.some(([x,z])=>x>=-1745&&x<=-665&&z>=-974&&z<=-588)&&(r.bridge||r.layer>0);
export const viewingPiers=new Map([
  [473291441,{entry:[374.1,2478.4],axis:[.576,.817],shoreToDeck:50}],
  [428905877,{entry:[-70.2,2793.5],axis:[.519,.855],shoreToDeck:50}]
]);
