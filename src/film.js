import * as T from 'three';

// Multi-pass HDR film post-processing pipeline:
// 1. MSAA HalfFloat HDR scene render + DepthTexture
// 2. 4-level Dual-Filter (Kawase) Bloom pyramid (soft-knee threshold + tent upsampling)
// 3. Interleaved-gradient jittered dual-radius contact AO
// 4. Period-aware cinematic Color Grading, subtle chromatic edge lens, vignette & refractive droplets
const fullTriVertex = `varying vec2 coord;void main(){coord=position.xy*.5+.5;gl_Position=vec4(position,1.);}`;

function makeQuadGeometry() {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
}

const gradePresets = {
  sunset:   { bloom: 0.24, threshold: 1.05, contrast: 1.045, sat: 1.05, shadowTint: [0.95, 0.97, 1.04], highlightTint: [1.05, 0.99, 0.92] },
  day:      { bloom: 0.16, threshold: 1.25, contrast: 1.03,  sat: 1.03, shadowTint: [0.98, 0.99, 1.02], highlightTint: [1.02, 1.01, 0.98] },
  dusk:     { bloom: 0.30, threshold: 0.92, contrast: 1.05,  sat: 1.06, shadowTint: [0.92, 0.96, 1.06], highlightTint: [1.06, 0.98, 0.94] },
  night:    { bloom: 0.38, threshold: 0.85, contrast: 1.06,  sat: 1.07, shadowTint: [0.93, 0.97, 1.06], highlightTint: [1.04, 1.01, 0.96] },
  aurora:   { bloom: 0.42, threshold: 0.78, contrast: 1.06,  sat: 1.08, shadowTint: [0.92, 0.99, 1.05], highlightTint: [0.98, 1.04, 1.02] },
  overcast: { bloom: 0.12, threshold: 1.35, contrast: 1.02,  sat: 0.98, shadowTint: [0.98, 0.99, 1.01], highlightTint: [1.00, 1.00, 0.99] }
};

export function createFilm(renderer, camera) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    return {
      render: (scene, view) => renderer.render(scene, view),
      setGrade() {},
      dispose() {}
    };
  }

  const target = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthBuffer: true,
    samples: Math.min(4, renderer.capabilities.maxSamples)
  });
  target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);

  const levels = 4;
  const mipOpts = {
    type: T.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
    wrapS: T.ClampToEdgeWrapping,
    wrapT: T.ClampToEdgeWrapping
  };
  const downTargets = Array.from({ length: levels }, () => new T.WebGLRenderTarget(1, 1, mipOpts));
  const upTargets = Array.from({ length: levels - 1 }, () => new T.WebGLRenderTarget(1, 1, mipOpts));

  const size = new T.Vector2();
  const view = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = makeQuadGeometry();

  // Pass 1: Soft-knee bright prefilter + Karis-weighted 5-tap downsample to prevent firefly flicker
  const prefilterMat = new T.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tSrc: { value: target.texture },
      uTexel: { value: new T.Vector2() },
      uThreshold: { value: 1.1 }
    },
    vertexShader: fullTriVertex,
    fragmentShader: `
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uThreshold;
      varying vec2 coord;
      vec3 sanitizeHDR(vec3 c){
        return vec3(
          (c.r >= 0. && c.r <= 64.) ? c.r : (c.r > 64. && c.r < 65000. ? 64. : 0.),
          (c.g >= 0. && c.g <= 64.) ? c.g : (c.g > 64. && c.g < 65000. ? 64. : 0.),
          (c.b >= 0. && c.b <= 64.) ? c.b : (c.b > 64. && c.b < 65000. ? 64. : 0.)
        );
      }
      vec3 bright(vec3 raw){
        vec3 c = sanitizeHDR(raw);
        float br = max(max(c.r, c.g), c.b);
        if(br <= 1e-4) return vec3(0.);
        float knee = uThreshold * .45;
        float soft = clamp(br - uThreshold + knee, 0., 2. * knee);
        soft = (soft * soft) / max(4. * knee, 1e-4);
        float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
        return clamp(c * contrib, vec3(0.), vec3(6.));
      }
      float karis(vec3 c){ return 1. / (1. + max(dot(c, vec3(.2126, .7152, .0722)), 0.)); }
      void main(){
        vec2 o = uTexel;
        vec3 c0 = bright(texture2D(tSrc, coord).rgb);
        vec3 c1 = bright(texture2D(tSrc, coord + vec2(-o.x, -o.y)).rgb);
        vec3 c2 = bright(texture2D(tSrc, coord + vec2( o.x, -o.y)).rgb);
        vec3 c3 = bright(texture2D(tSrc, coord + vec2(-o.x,  o.y)).rgb);
        vec3 c4 = bright(texture2D(tSrc, coord + vec2( o.x,  o.y)).rgb);
        float w0 = karis(c0) * 2., w1 = karis(c1), w2 = karis(c2), w3 = karis(c3), w4 = karis(c4);
        vec3 sum = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4) / max(w0 + w1 + w2 + w3 + w4, 1e-4);
        gl_FragColor = vec4(sum, 1.);
      }`
  });

  // Pass 2..N: Dual-filter Kawase downsample
  const downMat = new T.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() } },
    vertexShader: fullTriVertex,
    fragmentShader: `
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      varying vec2 coord;
      void main(){
        vec2 o = uTexel * 1.25;
        vec3 sum = texture2D(tSrc, coord).rgb * .5;
        sum += texture2D(tSrc, coord + vec2(-o.x, -o.y)).rgb * .125;
        sum += texture2D(tSrc, coord + vec2( o.x, -o.y)).rgb * .125;
        sum += texture2D(tSrc, coord + vec2(-o.x,  o.y)).rgb * .125;
        sum += texture2D(tSrc, coord + vec2( o.x,  o.y)).rgb * .125;
        sum = clamp(sum, vec3(0.), vec3(6.));
        gl_FragColor = vec4(sum, 1.);
      }`
  });

  // Upsample pass: 9-tap tent filter accumulated with lower-level detail
  const upMat = new T.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tLow: { value: null },
      tHigh: { value: null },
      uTexel: { value: new T.Vector2() },
      uRadius: { value: 1.35 }
    },
    vertexShader: fullTriVertex,
    fragmentShader: `
      uniform sampler2D tLow, tHigh;
      uniform vec2 uTexel;
      uniform float uRadius;
      varying vec2 coord;
      void main(){
        vec2 o = uTexel * uRadius;
        vec3 s = texture2D(tLow, coord).rgb * 4.;
        s += (texture2D(tLow, coord + vec2(-o.x, 0.)).rgb +
              texture2D(tLow, coord + vec2( o.x, 0.)).rgb +
              texture2D(tLow, coord + vec2(0., -o.y)).rgb +
              texture2D(tLow, coord + vec2(0.,  o.y)).rgb) * 2.;
        s += texture2D(tLow, coord + vec2(-o.x, -o.y)).rgb +
             texture2D(tLow, coord + vec2( o.x, -o.y)).rgb +
             texture2D(tLow, coord + vec2(-o.x,  o.y)).rgb +
             texture2D(tLow, coord + vec2( o.x,  o.y)).rgb;
        vec3 high = texture2D(tHigh, coord).rgb;
        gl_FragColor = vec4(clamp(high + s * (1. / 16.), vec3(0.), vec3(6.)), 1.);
      }`
  });

  // Final composite pass: jittered dual-radius contact AO + multi-scale bloom + lens droplets + color grading
  const compositeMat = new T.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      colorBuffer: { value: target.texture },
      depthBuffer: { value: target.depthTexture },
      bloomBuffer: { value: upTargets[0].texture },
      size: { value: size },
      logFar: { value: Math.log2(camera.far + 1) },
      uTime: { value: 0 },
      uSpray: { value: 0 },
      uBloomStrength: { value: 0.22 },
      uContrast: { value: 1.04 },
      uSaturation: { value: 1.04 },
      uShadowTint: { value: new T.Vector3(0.96, 0.98, 1.03) },
      uHighlightTint: { value: new T.Vector3(1.03, 1.00, 0.96) }
    },
    vertexShader: fullTriVertex,
    fragmentShader: `
      uniform sampler2D colorBuffer, depthBuffer, bloomBuffer;
      uniform vec2 size;
      uniform float logFar, uTime, uSpray, uBloomStrength, uContrast, uSaturation;
      uniform vec3 uShadowTint, uHighlightTint;
      varying vec2 coord;

      vec3 sanitizeHDR(vec3 c){
        return vec3(
          (c.r >= 0. && c.r <= 64.) ? c.r : (c.r > 64. && c.r < 65000. ? 64. : 0.),
          (c.g >= 0. && c.g <= 64.) ? c.g : (c.g > 64. && c.g < 65000. ? 64. : 0.),
          (c.b >= 0. && c.b <= 64.) ? c.b : (c.b > 64. && c.b < 65000. ? 64. : 0.)
        );
      }

      float distanceAt(vec2 p){
        return exp2(texture2D(depthBuffer, clamp(p, vec2(.001), vec2(.999))).r * logFar) - 1.;
      }
      float ign(vec2 p){
        return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715))));
      }
      vec2 dropHash(vec2 p){
        vec3 a = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        a += dot(a, a.yzx + 33.33);
        return fract((a.xx + a.yz) * a.zy);
      }
      vec3 lensDroplets(vec2 uv, float aspect, float t){
        vec2 offset = vec2(0.); float mask = 0.;
        for(int layer = 0; layer < 2; layer++){
          float scale = layer == 0 ? 11.5 : 19.0;
          vec2 g = vec2(uv.x * aspect, uv.y) * scale;
          g.y += t * (layer == 0 ? .18 : .11);
          vec2 id = floor(g), f = fract(g) - .5;
          vec2 rnd = dropHash(id + float(layer) * 41.7);
          float life = fract(rnd.x + t * (.06 + rnd.y * .05));
          float appear = smoothstep(0., .15, life) * (1. - smoothstep(.78, 1., life));
          if(rnd.x < .42) continue;
          vec2 center = (rnd - .5) * .48;
          vec2 d = f - center;
          float rad = (.12 + .14 * rnd.y) * appear;
          float dist = length(d);
          if(dist < rad){
            float r = dist / max(rad, .0001);
            float dome = sqrt(max(0., 1. - r * r));
            float edge = smoothstep(1., .74, r);
            offset -= d / max(rad, .0001) * (dome * .032) * edge;
            mask = max(mask, edge * appear);
          }
        }
        return vec3(offset, mask);
      }

      void main(){
        vec2 sampleUV = coord;
        float dropSpec = 0.;
        if(uSpray > .005){
          float aspect = size.x / max(size.y, 1.);
          vec3 dr = lensDroplets(coord, aspect, uTime);
          sampleUV = clamp(coord + dr.xy * uSpray, vec2(.002), vec2(.998));
          dropSpec = dr.z * uSpray;
        }

        // Subtle optical lateral chromatic aberration near corners only.
        vec2 fromCenter = sampleUV - vec2(.5);
        float edgeDist = dot(fromCenter, fromCenter);
        vec2 caShift = fromCenter * edgeDist * .0022;
        vec3 rgb;
        rgb.r = texture2D(colorBuffer, clamp(sampleUV + caShift, vec2(.001), vec2(.999))).r;
        rgb.g = texture2D(colorBuffer, sampleUV).g;
        rgb.b = texture2D(colorBuffer, clamp(sampleUV - caShift, vec2(.001), vec2(.999))).b;
        rgb = sanitizeHDR(rgb);

        if(dropSpec > .01){
          rgb += vec3(.18, .22, .25) * dropSpec * .38;
        }

        // Jittered dual-radius screen-space contact AO (reduces banding, grounds cars/trees/buildings).
        float z = distanceAt(coord);
        if(z < 260.){
          float rot = ign(gl_FragCoord.xy) * 6.2831853;
          float rNear = clamp(size.y * .34 / max(z, .5), 1.8, 12.);
          float rWide = clamp(size.y * .86 / max(z, .5), 4.5, 26.);
          float occNear = 0., occWide = 0.;
          for(int i = 0; i < 8; i++){
            float a = rot + float(i) * .78539816;
            vec2 dir = vec2(cos(a), sin(a));
            float d1 = z - distanceAt(coord + dir * rNear / size);
            occNear += smoothstep(.045, .20, d1) * (1. - smoothstep(.42, 1.55, d1));
            float d2 = z - distanceAt(coord + dir * rWide / size);
            occWide += smoothstep(.18, .85, d2) * (1. - smoothstep(1.8, 5.2, d2));
          }
          float ao = (occNear * .62 + occWide * .38) * .125;
          float fade = 1. - smoothstep(80., 250., z);
          rgb *= 1. - clamp(ao * .24 * fade, 0., .24);
        }

        // Add multi-scale HDR bloom before ACES tone mapping.
        vec3 bloom = min(sanitizeHDR(texture2D(bloomBuffer, sampleUV).rgb), vec3(6.));
        rgb += bloom * uBloomStrength * .32;

        // Subtle optical vignette
        float lens = 1. - .055 * smoothstep(.34, .82, distance(coord, vec2(.5)));
        gl_FragColor = vec4(rgb * lens, 1.);

        #include <tonemapping_fragment>

        // Gentle filmic split-tone color grading in post-tonemapped linear space
        float lum = dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722));
        vec3 grade = mix(uShadowTint, uHighlightTint, smoothstep(.08, .82, lum));
        gl_FragColor.rgb *= grade;
        gl_FragColor.rgb = mix(vec3(lum), gl_FragColor.rgb, uSaturation);
        gl_FragColor.rgb = clamp((gl_FragColor.rgb - .5) * uContrast + .5, 0., 1.);

        #include <colorspace_fragment>
      }`
  });

  const prefilterScene = new T.Scene(); prefilterScene.add(new T.Mesh(geometry, prefilterMat));
  const downScene = new T.Scene(); downScene.add(new T.Mesh(geometry, downMat));
  const upScene = new T.Scene(); upScene.add(new T.Mesh(geometry, upMat));
  const screenScene = new T.Scene(); screenScene.add(new T.Mesh(geometry, compositeMat));

  function ensureSizes(w, h) {
    if (target.width === w && target.height === h) return;
    target.setSize(w, h);
    let mw = w, mh = h;
    for (let i = 0; i < levels; i++) {
      mw = Math.max(2, mw >> 1);
      mh = Math.max(2, mh >> 1);
      downTargets[i].setSize(mw, mh);
      if (i < levels - 1) upTargets[i].setSize(mw, mh);
    }
  }

  function setGrade(period = 'day', weather = 'clear') {
    const key = weather === 'aurora' ? 'aurora' : (gradePresets[period] ? period : 'day');
    const p = gradePresets[key];
    const wetBoost = weather === 'rain' ? 1.15 : 1.0;
    prefilterMat.uniforms.uThreshold.value = p.threshold;
    compositeMat.uniforms.uBloomStrength.value = p.bloom * wetBoost;
    compositeMat.uniforms.uContrast.value = p.contrast;
    compositeMat.uniforms.uSaturation.value = weather === 'rain' ? p.sat * 0.96 : p.sat;
    compositeMat.uniforms.uShadowTint.value.fromArray(p.shadowTint);
    compositeMat.uniforms.uHighlightTint.value.fromArray(p.highlightTint);
  }

  const lastStats = { calls: 0, triangles: 0 };

  return {
    lastStats,
    setGrade,
    render(scene, cam, time = 0, spray = 0) {
      compositeMat.uniforms.uTime.value = time;
      compositeMat.uniforms.uSpray.value = spray;
      renderer.getDrawingBufferSize(size);
      const w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);
      ensureSizes(w, h);

      // 1. Render full HDR scene & capture true main-pass geometry stats before post passes reset renderer.info
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
      lastStats.calls = renderer.info.render.calls;
      lastStats.triangles = renderer.info.render.triangles;

      // 2. Bloom prefilter -> mip 0 (1/2 res)
      prefilterMat.uniforms.tSrc.value = target.texture;
      prefilterMat.uniforms.uTexel.value.set(1 / w, 1 / h);
      renderer.setRenderTarget(downTargets[0]);
      renderer.render(prefilterScene, view);

      // 3. Downsample pyramid 1/2 -> 1/4 -> 1/8 -> 1/16
      for (let i = 1; i < levels; i++) {
        const prev = downTargets[i - 1];
        downMat.uniforms.tSrc.value = prev.texture;
        downMat.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
        renderer.setRenderTarget(downTargets[i]);
        renderer.render(downScene, view);
      }

      // 4. Tent upsample pyramid 1/16 -> 1/8 -> 1/4 -> 1/2
      for (let i = levels - 2; i >= 0; i--) {
        const lowTex = i === levels - 2 ? downTargets[i + 1] : upTargets[i + 1];
        const highTex = downTargets[i];
        upMat.uniforms.tLow.value = lowTex.texture;
        upMat.uniforms.tHigh.value = highTex.texture;
        upMat.uniforms.uTexel.value.set(1 / lowTex.width, 1 / lowTex.height);
        renderer.setRenderTarget(upTargets[i]);
        renderer.render(upScene, view);
      }

      // 5. Final composite to screen
      compositeMat.uniforms.bloomBuffer.value = upTargets[0].texture;
      renderer.setRenderTarget(null);
      renderer.render(screenScene, view);
    },
    dispose() {
      target.depthTexture?.dispose();
      target.dispose();
      for (const rt of downTargets) rt.dispose();
      for (const rt of upTargets) rt.dispose();
      geometry.dispose();
      prefilterMat.dispose();
      downMat.dispose();
      upMat.dispose();
      compositeMat.dispose();
    }
  };
}
