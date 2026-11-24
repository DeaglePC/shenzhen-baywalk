import {Grid,bounds,inRing} from './city-geometry.js';
import {atStation} from './road-profiles.js';
import {wenxinDivider} from './street-junctions.js';

// Coordinates are in metres. Each grid entry includes a margin for the largest
// car, so a lookup at the body centre also finds walls beside its bumper.
export function streetObstacles(data,stadiumAreas=[]){
  const cells=new Grid(32);
  const water=new Set(data.water);
  const divider=wenxinDivider(data);
  for(const f of [...data.buildings,...data.water,...(data.land??[]).filter(f=>f.kind==='pitch'),...stadiumAreas.map(p=>({p})),...(divider?[divider]:[])]){
    if(f.p?.length<3||!f.p)continue;
    const b=f.bbox??bounds(f.p);
    cells.add({b,rings:[f.p,...(f.holes||[])],bottom:f.minH||0,top:water.has(f)?1:f.h??Infinity},
      [b[0]-4,b[1]-4,b[2]+4,b[3]+4]);
  }
  // Intersect polygon edges with the actual oriented body, including the edge
  // of a courtyard. A car wholly within an open courtyard remains admissible.
  return function blocked(x,z,yaw,length,width,height=2,pad=.1,floor=.28){
    const l=length/2+pad,w=width/2+pad,cs=Math.cos(yaw),sn=Math.sin(yaw);
    const rx=Math.abs(cs)*w+Math.abs(sn)*l,rz=Math.abs(sn)*w+Math.abs(cs)*l;
    for(const {b,rings,bottom,top} of cells.query(x,z)){
      if(bottom>floor+height+.06||top<floor-.06||x+rx<b[0]||x-rx>b[2]||z+rz<b[1]||z-rz>b[3])continue;
      if(inRing(x,z,rings[0])&&!rings.slice(1).some(r=>inRing(x,z,r)))return true;
      for(const ring of rings){
        let a=ring.at(-1);
        for(const v of ring){
          if(Math.min(a[0],v[0])<=x+rx&&Math.max(a[0],v[0])>=x-rx&&Math.min(a[1],v[1])<=z+rz&&Math.max(a[1],v[1])>=z-rz){
            const ax=(a[0]-x)*cs-(a[1]-z)*sn,az=(a[0]-x)*sn+(a[1]-z)*cs;
            const bx=(v[0]-x)*cs-(v[1]-z)*sn,bz=(v[0]-x)*sn+(v[1]-z)*cs;
            // Separating axes of a segment and an axis-aligned rectangle.
            if(Math.min(ax,bx)<=w&&Math.max(ax,bx)>=-w&&Math.min(az,bz)<=l&&Math.max(az,bz)>=-l&&
              Math.abs(ax*bz-az*bx)<=w*Math.abs(bz-az)+l*Math.abs(bx-ax))return true;
          }
          a=v;
        }
      }
    }
    return false;
  };
}

export function bodiesOverlap(a,b,pad=.12){
  if((a.y??.28)>(b.y??.28)+(b.height??2)+.1||(b.y??.28)>(a.y??.28)+(a.height??2)+.1)return false;
  const dx=b.x-a.x,dz=b.z-a.z;
  if(dx*dx+dz*dz>=(a.radius+b.radius+2*pad)**2)return false;
  const ca=Math.cos(a.yaw),sa=Math.sin(a.yaw),cb=Math.cos(b.yaw),sb=Math.sin(b.yaw);
  const c=Math.abs(ca*cb+sa*sb),s=Math.abs(sa*cb-ca*sb);
  return Math.abs(dx*ca-dz*sa)<a.w+b.w*c+b.l*s+pad&&Math.abs(dx*sa+dz*ca)<a.l+b.w*s+b.l*c+pad&&
    Math.abs(dx*cb-dz*sb)<b.w+a.w*c+a.l*s+pad&&Math.abs(dx*sb+dz*cb)<b.l+a.w*s+a.l*c+pad;
}

// Nearby OSM nodes can describe different arms of one physical junction.
export function trafficJunctions(lanes){
  const nodes=new Map(),grid=new Grid(32);
  for(const lane of lanes){
    if(!lane.through)continue;
    for(const [point,dir,s] of [[lane.points[0],lane.headings[0],0],[lane.points.at(-1),lane.headings.at(-1),lane.length]]){
      const y=lane.profile?atStation(lane.profile,lane.startDistance+lane.direction*s).y:.28;
      const key=point.join(',')+','+Math.round(y*10);
      const node=nodes.get(key)??{point,dir,y,width:0,crossing:false};
      if(Math.abs(dir[0]*node.dir[0]+dir[1]*node.dir[1])<.91)node.crossing=true;
      node.width=Math.max(node.width,lane.road.width);nodes.set(key,node);
    }
  }
  function at(x,z,y){
    for(const j of grid.query(x,z))if(Math.abs(j.y-y)<2.5&&(j.x-x)**2+(j.z-z)**2<j.r*j.r)return j.group;
  }
  for(const node of nodes.values()){
    if(!node.crossing)continue;
    const [x,z]=node.point,r=Math.min(14,Math.max(7,node.width*.5+4));
    const group=grid.query(x,z).find(j=>Math.abs(j.y-node.y)<2.5&&Math.hypot(j.x-x,j.z-z)<17)?.group??{};
    grid.add({x,z,y:node.y,r,group},[x-18,z-18,x+18,z+18]);
  }
  return at;
}

export class TrafficOccupancy{
  constructor(){this.cells=new Map();}
  key(i,j){return i*65536+j;}
  place(car){
    const key=this.key(Math.floor(car.x/12),Math.floor(car.z/12));
    if(car.cell===key)return;
    if(car.cell!==undefined)this.cells.get(car.cell).delete(car);
    if(!this.cells.has(key))this.cells.set(key,new Set());
    this.cells.get(key).add(car);car.cell=key;
  }
  blocksWalker(x,z,y,radius){
    const i=Math.floor(x/12),j=Math.floor(z/12),n=Math.ceil((radius+3)/12);
    for(let a=i-n;a<=i+n;a++)for(let b=j-n;b<=j+n;b++){
      const list=this.cells.get(this.key(a,b));if(!list)continue;
      for(const c of list){
        if(y>(c.y??.28)+c.height+.04||y+1.7<(c.y??.28)-.05)continue;
        const dx=x-c.x,dz=z-c.z,cs=Math.cos(c.yaw),sn=Math.sin(c.yaw);
        const side=Math.max(0,Math.abs(dx*cs-dz*sn)-c.w),end=Math.max(0,Math.abs(dx*sn+dz*cs)-c.l);
        if(side*side+end*end<=radius*radius)return true;
      }
    }
    return false;
  }
  blocked(pose,owner,walkers){
    for(const person of walkers??[]){
      if(person.y>(pose.y??.28)+pose.height+.12||person.y+1.7<(pose.y??.28)-.05)continue;
      const dx=person.x-pose.x,dz=person.z-pose.z;
      if(Math.abs(dx)>pose.radius+.5||Math.abs(dz)>pose.radius+.5)continue;
      const cs=Math.cos(pose.yaw),sn=Math.sin(pose.yaw);
      if(Math.abs(dx*cs-dz*sn)<pose.w+.38&&Math.abs(dx*sn+dz*cs)<pose.l+.38)return true;
    }
    const i=Math.floor(pose.x/12),j=Math.floor(pose.z/12);
    for(let a=i-1;a<=i+1;a++)for(let b=j-1;b<=j+1;b++){
      const list=this.cells.get(this.key(a,b));if(!list)continue;
      for(const car of list)if(car!==owner&&car.owner!==owner&&bodiesOverlap(pose,car))return true;
    }
    return false;
  }
}
