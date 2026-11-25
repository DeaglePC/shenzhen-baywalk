import * as T from 'three';

// Shared atmospheric scattering, exponential height fog, and drifting cloud shadow GLSL.
// Inspired by Crimson Loong's shared 05_glsl.js shader chunk architecture.
export const atmosphereChunk = `
  uniform vec3 uAtmoSunDir, uAtmoSunColor;
  uniform float uAtmoTime, uAtmoCloud, uAtmoHeight, uAtmoMie, uAtmoNight;

  float atmoHash(vec2 p){
    vec3 k = fract(vec3(p.xyx) * .1031);
    k += dot(k, k.yzx + 33.33);
    return fract((k.x + k.y) * k.z);
  }
  float atmoNoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(
      mix(atmoHash(i), atmoHash(i + vec2(1., 0.)), f.x),
      mix(atmoHash(i + vec2(0., 1.)), atmoHash(i + vec2(1., 1.)), f.x),
      f.y
    );
  }
  float atmoCloudMask(vec2 xz, float t){
    vec2 drift = vec2(t * 2.1, t * .85);
    vec2 q = (xz + drift) * .00165;
    float n1 = atmoNoise(q);
    float n2 = atmoNoise(q * 2.13 - vec2(t * .0024, -t * .0016) + n1 * .65);
    float deck = n1 * .64 + n2 * .36;
    return smoothstep(.47, .79, deck);
  }
  float atmoDirectCloudFactor(vec2 xz, float t, float strength){
    if(strength <= .001) return 1.;
    float shadow = atmoCloudMask(xz, t);
    return 1. - shadow * strength;
  }
  vec3 atmoHeightFog(vec3 color, vec3 worldPos, vec3 fogCol, float density){
    vec3 delta = worldPos - cameraPosition;
    float dist = length(delta);
    vec3 ray = delta / max(dist, 1e-4);
    // Exponential height falloff: denser marine mist near bay level, cleaner air at tower heights.
    float hCam = max(cameraPosition.y, 0.);
    float hPos = max(worldPos.y, 0.);
    float k = max(uAtmoHeight, .001);
    float dY = (hPos - hCam) * k;
    float heightIntegral = abs(dY) > .001
      ? (exp(-hCam * k) - exp(-hPos * k)) / dY
      : exp(-hCam * k);
    // Preserve baseline far-horizon fog continuity while giving low altitude richer marine haze.
    float effectiveDist = dist * mix(.58, 1.18, clamp(heightIntegral, 0., 1.25));
    float f = 1. - exp(-density * density * effectiveDist * effectiveDist);
    f = clamp(f, 0., 1.);
    // Directional Mie forward scattering near the sun disk for golden sunset / bright aerial depth.
    float sunAlign = max(dot(ray, normalize(uAtmoSunDir)), 1e-4);
    float mie = pow(sunAlign, 6.) * uAtmoMie * (1. - uAtmoNight * .82);
    float lowBand = exp(-max(ray.y, 0.) * 4.2);
    vec3 scatteredFog = fogCol + uAtmoSunColor * mie * (.32 + .42 * lowBand);
    return mix(color, scatteredFog, f);
  }
`;

function shouldPatch(mat) {
  if (!mat || !mat.fog) return false;
  if (mat.userData?.skipAtmosphere) return false;
  return !!(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial);
}

function patchMaterial(mat, uniforms) {
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  const baseKey = prevKey ? prevKey.call(mat) : '';
  mat.customProgramCacheKey = () => baseKey + '|sz-atmo-v1';
  mat.onBeforeCompile = function (shader, renderer) {
    if (prevCompile) prevCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const isBillboard = shader.vertexShader.includes('vec3 plantWorld');
    if (!shader.vertexShader.includes('varying vec3 atmoWorld;')) {
      shader.vertexShader = 'varying vec3 atmoWorld;\n' + shader.vertexShader;
      const worldExpr = isBillboard
        ? 'atmoWorld = (modelMatrix * vec4(plantWorld, 1.)).xyz;'
        : `
          vec4 atmoLoc = vec4(transformed, 1.);
          #ifdef USE_BATCHING
            atmoLoc = batchingMatrix * atmoLoc;
          #endif
          #ifdef USE_INSTANCING
            atmoLoc = instanceMatrix * atmoLoc;
          #endif
          atmoWorld = (modelMatrix * atmoLoc).xyz;
        `;
      if (shader.vertexShader.includes('#include <fog_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', worldExpr + '\n#include <fog_vertex>');
      } else if (shader.vertexShader.includes('#include <project_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', worldExpr + '\n#include <project_vertex>');
      }
    }
    if (!shader.fragmentShader.includes('varying vec3 atmoWorld;')) {
      shader.fragmentShader = 'varying vec3 atmoWorld;\n' + atmosphereChunk + shader.fragmentShader;
      if (shader.fragmentShader.includes('#include <lights_fragment_end>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
           if (uAtmoCloud > .001) {
             float cloudLight = atmoDirectCloudFactor(atmoWorld.xz, uAtmoTime, uAtmoCloud);
             reflectedLight.directDiffuse *= cloudLight;
             reflectedLight.directSpecular *= cloudLight;
           }`
        );
      }
      if (shader.fragmentShader.includes('#include <fog_fragment>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <fog_fragment>',
          `#ifdef USE_FOG
            #ifdef FOG_EXP2
              gl_FragColor.rgb = atmoHeightFog(gl_FragColor.rgb, atmoWorld, fogColor, fogDensity);
            #else
              float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
              gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
            #endif
          #endif`
        );
      }
    }
  };
  mat.needsUpdate = true;
  return () => {
    mat.onBeforeCompile = prevCompile;
    mat.customProgramCacheKey = prevKey;
    mat.needsUpdate = true;
  };
}

export function createAtmosphereSystem(scene, city) {
  const uniforms = {
    uAtmoSunDir: { value: new T.Vector3(0.1, 0.75, -0.66).normalize() },
    uAtmoSunColor: { value: new T.Color(0xffeed6) },
    uAtmoTime: { value: 0 },
    uAtmoCloud: { value: 0.24 },
    uAtmoHeight: { value: 0.0085 },
    uAtmoMie: { value: 0.35 },
    uAtmoNight: { value: 0 }
  };

  const patched = new Map();
  let disposed = false;

  function scanRoot(target = scene) {
    if (disposed || !target) return;
    target.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!patched.has(m) && shouldPatch(m)) {
          patched.set(m, patchMaterial(m, uniforms));
        }
      }
    });
  }

  // Bind shared atmosphere uniforms directly to lake water if present.
  if (city?.water?.material?.uniforms) {
    Object.assign(city.water.material.uniforms, uniforms);
  }

  scanRoot(scene);
  city?.ready?.then(() => scanRoot(scene));
  city?.root?.addEventListener('foliageadded', () => scanRoot(city.root));

  return {
    uniforms,
    scan: () => scanRoot(scene),
    setSky({ sunDir, sunColor, period = 'day', weather = 'clear', night = 0 } = {}) {
      if (sunDir) uniforms.uAtmoSunDir.value.copy(sunDir).normalize();
      if (sunColor) uniforms.uAtmoSunColor.value.copy(sunColor);
      uniforms.uAtmoNight.value = night;
      const clear = weather === 'clear';
      if (!clear || period === 'overcast') {
        uniforms.uAtmoCloud.value = 0;
        uniforms.uAtmoMie.value = weather === 'snow' ? 0.14 : 0.08;
        uniforms.uAtmoHeight.value = weather === 'rain' ? 0.011 : 0.009;
      } else if (period === 'sunset') {
        uniforms.uAtmoCloud.value = 0.14;
        uniforms.uAtmoMie.value = 0.30;
        uniforms.uAtmoHeight.value = 0.0110;
      } else if (period === 'dusk') {
        uniforms.uAtmoCloud.value = 0.08;
        uniforms.uAtmoMie.value = 0.34;
        uniforms.uAtmoHeight.value = 0.0095;
      } else if (period === 'night') {
        uniforms.uAtmoCloud.value = 0;
        uniforms.uAtmoMie.value = 0.05;
        uniforms.uAtmoHeight.value = 0.0085;
      } else {
        // Bright afternoon daylight: crisp light cloud modulation without darkening streets.
        uniforms.uAtmoCloud.value = 0.12;
        uniforms.uAtmoMie.value = 0.26;
        uniforms.uAtmoHeight.value = 0.0080;
      }
    },
    update(time) {
      uniforms.uAtmoTime.value = time;
    },
    dispose() {
      disposed = true;
      for (const restore of patched.values()) restore();
      patched.clear();
    }
  };
}
