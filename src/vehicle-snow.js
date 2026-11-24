import {surfaceNoise} from './weather-surfaces.js';

// Street meshes at every LOD have been baked into vehicle metres before instancing.
// Local coordinates keep a drift attached to the same panel as a car drives and turns.
export function installVehicleSnow(mat,amount){
  if(!mat.isMeshStandardMaterial)return;
  const before=mat.onBeforeCompile,key=mat.customProgramCacheKey();
  mat.customProgramCacheKey=()=>key+'|vehicle-snow-1';
  mat.onBeforeCompile=function(shader,renderer){
    before.call(this,shader,renderer);
    shader.uniforms.carSnow=amount;
    shader.vertexShader='varying vec3 carMeters;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncarMeters=transformed;');
    if(mat.userData.packedTraffic){
      shader.vertexShader='attribute float snowExposure;varying float panelExposure;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\npanelExposure=snowExposure;');
      shader.fragmentShader='varying float panelExposure;\n'+shader.fragmentShader;
    }
    shader.fragmentShader='uniform float carSnow;varying vec3 carMeters;\n'+surfaceNoise+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`
      float powder=0.;
      if(carSnow>.001){
        vec3 n=cross(dFdx(carMeters),dFdy(carMeters));
        float up=n.y*inversesqrt(max(dot(n,n),1.e-18));
        float settled=.66*wxNoise(carMeters.xz*2.1+2.8)+.34*wxNoise(carMeters.xz*8.9);
        powder=carSnow*smoothstep(.32,.84,up)*smoothstep(.43,.73,carMeters.y)*(.62+.38*smoothstep(.24,.73,settled));
        ${mat.userData.packedTraffic?'powder*=panelExposure;':''}
        float grains=wxNoise(carMeters.xz*90.)*(1.-smoothstep(.003,.026,length(fwidth(carMeters))));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.91,.94)*(.77+.16*settled+.09*grains),powder);
        diffuseColor.a=mix(diffuseColor.a,1.,powder);
        metalnessFactor*=1.-powder;roughnessFactor=mix(roughnessFactor,.92,powder);
      }
      #include <lights_physical_fragment>
      #ifdef USE_CLEARCOAT
        material.clearcoat*=1.-powder;
      #endif`);
  };
  mat.needsUpdate=true;
}
