// Z increases towards Hong Kong. The two in-map northern approaches meet
// the regional axes at the southern crop of the street map (z = 3200 m).
export const northernBayWays=new Set([276506946,568424517]);
const ease=(z,a,b)=>{const t=Math.max(0,Math.min(1,(z-a)/(b-a)));return t*t*(3-2*t);};
export function bayHeight(z){
  return 10.88+6.35*ease(z,3000,3156)-3.6*ease(z,3300,3610)+8.8*ease(z,3680,4100)-17.2*ease(z,5250,6750);
}
export const bayWidth=(z,base)=>base+(17.4-base)*ease(z,3000,3108);
export const channelTowers=[{z:3109,dir:1,span:180,back:90,cables:12,rise:95},{z:4172,dir:-1,span:210,back:99,cables:13,rise:109}];
export function navigationSpan(z,alongZ){
  return channelTowers.some(t=>{const d=(z-t.z)*t.dir/alongZ;return d>-t.back+1&&d<t.span-1;});
}
