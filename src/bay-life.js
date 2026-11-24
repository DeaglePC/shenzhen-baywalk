import * as T from 'three';

// Living atmosphere layer for Shenzhen Bay:
// Soaring coastal egrets/gulls over Talent Lake & Shenzhen Bay (GPU wing-flapping InstancedMesh)

function makeRng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function createBirdGeometry() {
  // Streamlined gull/egret silhouette: slender body + swept wings with inner/outer articulation.
  // Attribute `aWing`: signed lateral span (0 on body, +-1 at wingtips) for GPU flap deformation.
  const pos = [];
  const wing = [];
  const idx = [];
  const addTri = (a, wa, b, wb, c, wc) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c);
    wing.push(wa, wb, wc);
    idx.push(base, base + 1, base + 2);
  };
  // Body fuselage (nose +Z, tail -Z)
  addTri([0, 0.02, 0.42], 0, [-0.07, 0.0, 0.04], 0, [0.07, 0.0, 0.04], 0);
  addTri([-0.07, 0.0, 0.04], 0, [0, -0.01, -0.44], 0, [0.07, 0.0, 0.04], 0);
  // Tail fan
  addTri([0, -0.01, -0.26], 0, [-0.12, 0.01, -0.48], 0, [0.12, 0.01, -0.48], 0);
  // Left & right swept wings (inner + outer segments)
  for (const s of [-1, 1]) {
    const rootF = [s * 0.05, 0.01, 0.14], rootB = [s * 0.05, 0.0, -0.10];
    const midF = [s * 0.46, 0.05, 0.07], midB = [s * 0.42, 0.03, -0.13];
    const tip = [s * 0.94, 0.01, -0.08];
    if (s > 0) {
      addTri(rootF, 0.05, rootB, 0.05, midF, 0.52);
      addTri(midF, 0.52, rootB, 0.05, midB, 0.48);
      addTri(midF, 0.52, midB, 0.48, tip, 1.0);
    } else {
      addTri(rootF, -0.05, midF, -0.52, rootB, -0.05);
      addTri(midF, -0.52, midB, -0.48, rootB, -0.05);
      addTri(midF, -0.52, tip, -1.0, midB, -0.48);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aWing', new T.Float32BufferAttribute(wing, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function createBirds(low) {
  const count = low ? 14 : 28;
  const rng = makeRng(202611);
  const geo = new T.InstancedBufferGeometry();
  const base = createBirdGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.normal = base.attributes.normal;
  geo.attributes.aWing = base.attributes.aWing;
  geo.instanceCount = count;

  // Clusters over Talent Lake, Starlight Bridge, Waterfront & Shenzhen Bay coastal pier
  const centers = [
    [60, 26, -60, 145],
    [220, 32, 170, 180],
    [-190, 28, 120, 160],
    [430, 38, 1650, 340],
    [460, 30, 2600, 260]
  ];
  const orbit = new Float32Array(count * 4); // centerX, centerZ, radius, altitude
  const flight = new Float32Array(count * 4); // speed, phase, flapFreq, scale
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    const r = c[3] * (0.48 + rng() * 0.72);
    const alt = c[1] + (rng() - 0.3) * 24;
    orbit.set([c[0] + (rng() - 0.5) * 90, c[2] + (rng() - 0.5) * 90, r, alt], i * 4);
    const dir = rng() > 0.5 ? 1 : -1;
    flight.set([dir * (0.045 + rng() * 0.04), rng() * Math.PI * 2, 4.4 + rng() * 2.2, 0.78 + rng() * 0.52], i * 4);
  }
  geo.setAttribute('aOrbit', new T.InstancedBufferAttribute(orbit, 4));
  geo.setAttribute('aFlight', new T.InstancedBufferAttribute(flight, 4));

  const mat = new T.ShaderMaterial({
    side: T.DoubleSide,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new T.Vector3(0.1, 0.75, -0.66) },
      uSunColor: { value: new T.Color(0xffeed6) },
      uNight: { value: 0 },
      uAlpha: { value: 1 }
    },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aWing;
      attribute vec4 aOrbit, aFlight;
      uniform float uTime;
      varying float vShade, vTip;
      void main(){
        float ang = aFlight.y + uTime * aFlight.x;
        float ca = cos(ang), sa = sin(ang);
        float rx = aOrbit.z, rz = aOrbit.z * (.72 + .24 * sin(aFlight.y * 3.1));
        vec3 center = vec3(
          aOrbit.x + ca * rx,
          aOrbit.w + sin(ang * 2. + aFlight.y) * 4.5,
          aOrbit.y + sa * rz
        );
        vec3 tangent = normalize(vec3(
          -sa * rx * aFlight.x,
          cos(ang * 2. + aFlight.y) * 9.0 * aFlight.x,
          ca * rz * aFlight.x
        ));
        vec3 worldUp = vec3(0., 1., 0.);
        vec3 right = normalize(cross(worldUp, tangent));
        vec3 up = normalize(cross(tangent, right));
        // Gentle banking roll into turns
        float bank = -sign(aFlight.x) * .26;
        vec3 bRight = right * cos(bank) + up * sin(bank);
        vec3 bUp = up * cos(bank) - right * sin(bank);

        // Alternate active wingbeats with graceful soaring glides
        float glideGate = smoothstep(.15, .55, sin(uTime * .42 + aFlight.y * 5.));
        float flap = sin(uTime * aFlight.z + aFlight.y * 13.) * (.22 + .52 * glideGate);
        float w = abs(aWing);
        vec3 p = position * aFlight.w;
        p.y += sin(flap) * w * w * .36 * aFlight.w;
        p.x *= 1. - (1. - cos(flap)) * .16 * w;

        vec3 world = center + bRight * p.x + bUp * p.y + tangent * p.z;
        vShade = .55 + .45 * bUp.y;
        vTip = w;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uSunColor;
      uniform float uNight, uAlpha;
      varying float vShade, vTip;
      void main(){
        if(uAlpha < .02) discard;
        #include <logdepthbuf_fragment>
        // White egret/gull plumage with slate wingtips
        vec3 bodyCol = mix(vec3(.93, .94, .95), vec3(.34, .38, .44), smoothstep(.62, .98, vTip));
        vec3 col = bodyCol * mix(vec3(.55, .64, .76), uSunColor * 1.05, vShade) * mix(1., .22, uNight);
        gl_FragColor = vec4(col, uAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });

  const mesh = new T.Mesh(geo, mat);
  mesh.name = '深圳湾 · 盘旋海鸥与白鹭';
  mesh.frustumCulled = false;
  mesh.userData.excludeFromProbe = true;
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const hide = scene.userData.reflectingRoad || scene.userData.capturingProbe || camera.isArrayCamera;
    mesh.visible = !hide && mat.uniforms.uAlpha.value > 0.02;
  };
  return mesh;
}

export function createBayLife(scene, { low = false } = {}) {
  const group = new T.Group();
  group.name = '深圳湾 · 飞鸟';
  const birds = createBirds(low);
  group.add(birds);
  scene.add(group);

  return {
    setSky({ sunDir, sunColor, weather = 'clear', night = 0 } = {}) {
      const clear = weather === 'clear' || weather === 'aurora';
      if (sunDir) birds.material.uniforms.uSunDir.value.copy(sunDir).normalize();
      if (sunColor) birds.material.uniforms.uSunColor.value.copy(sunColor);
      birds.material.uniforms.uNight.value = night;
      birds.material.uniforms.uAlpha.value = clear && night < 0.72 ? (1 - night * 0.7) : 0;
      birds.visible = birds.material.uniforms.uAlpha.value > 0.02;
    },
    update(time) {
      if (birds.visible) birds.material.uniforms.uTime.value = time;
    },
    dispose() {
      scene.remove(group);
      birds.geometry.dispose();
      birds.material.dispose();
    }
  };
}
