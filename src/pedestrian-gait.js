import {Vector3,Quaternion,MathUtils} from 'three';

const hip=new Vector3(),knee=new Vector3(),ankle=new Vector3(),target=new Vector3(),nextKnee=new Vector3();
const axis=new Vector3(),pole=new Vector3(),a=new Vector3(),b=new Vector3();
const upperTurn=new Quaternion(),lowerTurn=new Quaternion(),parentRotation=new Quaternion(),worldRotation=new Quaternion();
const up=new Vector3(0,1,0),footTurn=new Quaternion();
function rotateWorld(bone,rotation){
  bone.parent.getWorldQuaternion(parentRotation);bone.getWorldQuaternion(worldRotation);
  bone.quaternion.copy(parentRotation.invert()).multiply(rotation).multiply(worldRotation);
  bone.updateWorldMatrix(false,false);
}
// Turn from the neck in world-up coordinates. Both rigs have tilted bind axes.
export function pedestrianGaze(actor,index){
  const neck=actor.getObjectByName('neck_01'),neutral=neck.quaternion.clone();
  const localUp=new Vector3(),turn=new Quaternion();
  let yaw=0,elapsed=index*3.77;
  return function update(route,dt,visible){
    elapsed+=dt;
    const delta=route.headingAhead(.83)-route.heading;
    const ahead=MathUtils.clamp(Math.atan2(Math.sin(delta),Math.cos(delta)),-.52,.52);
    const glance=Math.max(0,Math.sin(elapsed*(.42+index*.011)))**5*Math.sin(elapsed*.28+index)*.19;
    yaw=MathUtils.damp(yaw,ahead+glance,5.5,dt);
    if(!visible)return;
    neck.quaternion.copy(neutral);
    neck.getWorldQuaternion(turn);
    localUp.set(0,1,0).applyQuaternion(turn.invert());
    neck.quaternion.multiply(turn.setFromAxisAngle(localUp,yaw));
  };
}

export function groundedGait(actor){
  const legs=['l','r'].map(side=>({
    thigh:actor.getObjectByName('thigh_'+side),calf:actor.getObjectByName('calf_'+side),
    foot:actor.getObjectByName('foot_'+side),ball:actor.getObjectByName('ball_'+side),
    thighQ:new Quaternion(),calfQ:new Quaternion(),footQ:new Quaternion(),footPos:new Vector3(),
    anchor:new Vector3(),planted:false,heading:0,phaseOffset:side==='l'?0:.5
  })).filter(l=>l.thigh&&l.calf&&l.foot);
  let applied=false;
  return {
    legs,
    release(){for(const leg of legs)leg.planted=false;},
    restore(){
      if(!applied)return;
      for(const l of legs){
        l.thigh.quaternion.copy(l.thighQ);l.calf.quaternion.copy(l.calfQ);
        l.foot.position.copy(l.footPos);l.foot.quaternion.copy(l.footQ);
      }
      applied=false;
    },
    adjust(group,floor,city,strength,phase,walkWeight){
      if(strength<=0){this.release();return;}
      group.updateWorldMatrix(true,true);
      const yaw=group.rotation.y;
      for(const l of legs){
        l.thighQ.copy(l.thigh.quaternion);l.calfQ.copy(l.calf.quaternion);
        l.footQ.copy(l.foot.quaternion);l.footPos.copy(l.foot.position);
        l.thigh.getWorldPosition(hip);l.calf.getWorldPosition(knee);l.foot.getWorldPosition(ankle);
        // All takes start at left heel strike. During flat-foot support the
        // planted shoe stays on the pavement while the hips turn above it.
        const step=(phase+l.phaseOffset)%1;
        const contact=MathUtils.smoothstep(step,.055,.12)*(1-MathUtils.smoothstep(step,.37,.47))*walkWeight*strength;
        target.copy(ankle);
        if(contact>.001){
          if(!l.planted){l.anchor.copy(ankle);l.heading=yaw;l.planted=true;}
          a.subVectors(l.anchor,ankle);a.y=0;
          target.addScaledVector(a.clampLength(0,.12),contact);
          const angle=l.heading-yaw;
          const turn=MathUtils.clamp(Math.atan2(Math.sin(angle),Math.cos(angle)),-.36,.36)*contact;
          if(Math.abs(turn)>.001)rotateWorld(l.foot,footTurn.setFromAxisAngle(up,turn));
        }else l.planted=false;
        target.y+=MathUtils.clamp(city.groundHeight(target.x,target.z,floor+.45)-floor,-.13,.13)*strength;
        if(target.distanceToSquared(ankle)<.000001)continue;
        const upper=hip.distanceTo(knee),lower=knee.distanceTo(ankle);
        const reach=MathUtils.clamp(axis.subVectors(target,hip).length(),Math.abs(upper-lower)+.00001,upper+lower-.00001);
        axis.normalize();target.copy(hip).addScaledVector(axis,reach);
        pole.subVectors(knee,hip);pole.addScaledVector(axis,-pole.dot(axis));
        if(pole.lengthSq()<1e-7){pole.set(Math.sin(yaw),0,Math.cos(yaw));pole.addScaledVector(axis,-pole.dot(axis));}
        const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
        nextKnee.copy(hip).addScaledVector(axis,along).addScaledVector(pole.normalize(),Math.sqrt(Math.max(0,upper*upper-along*along)));
        upperTurn.setFromUnitVectors(a.subVectors(knee,hip).normalize(),b.subVectors(nextKnee,hip).normalize());
        rotateWorld(l.thigh,upperTurn);
        lowerTurn.setFromUnitVectors(a.subVectors(ankle,knee).normalize().applyQuaternion(upperTurn),b.subVectors(target,nextKnee).normalize());
        rotateWorld(l.calf,lowerTurn);
        // In both rigs the animated foot is a sibling of the thigh chain.
        l.foot.position.copy(l.foot.parent.worldToLocal(target));
      }
      applied=true;
    }
  };
}
