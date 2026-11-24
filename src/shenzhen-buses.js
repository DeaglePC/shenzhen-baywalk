import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from './city-geometry.js';
import {signalAspect} from './traffic-signals.js';
import {applyDetailMaps} from './procedural-textures.js';

// Authentic Shenzhen Bus Group BYD K8 / B8 electric city buses (10.4m x 2.52m x 3.12m)
// cruising Houhai arterial avenues (Keyuan South, Dengliang, Haide 3rd, Houhai Blvd)
// with live signal-stop obedience, illuminated amber LED destination boards & headlights.

const BUS_ROADS = new Set([
  '科苑南路', '登良路', '海德三道', '中心路', '创业路', '后海大道', '望海路', '海天二路', '东滨路'
]);

function addColored(parts, geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const c = new T.Color(color);
  const count = g.attributes.position.count;
  const rgb = new Float32Array(count * 3);
  for (let i = 0; i < rgb.length; i += 3) c.toArray(rgb, i);
  g.setAttribute('color', new T.BufferAttribute(rgb, 3));
  parts.push(g);
}

function createBusBodyGeometry() {
  // Bus faces local +Z, length 10.2m (z: -5.1 .. +5.1), width 2.50m, height 3.12m
  const parts = [];
  // Lower signature Shenzhen Bus azure-blue skirt
  addColored(parts, new T.BoxGeometry(2.48, 0.92, 10.16), 0x1e86d8, 0, 0.84, 0);
  // Crisp white mid-band livery stripe
  addColored(parts, new T.BoxGeometry(2.50, 0.36, 10.18), 0xf0f4f7, 0, 1.46, 0);
  // Panoramic dark-tinted passenger window belt + black pillar frame
  addColored(parts, new T.BoxGeometry(2.44, 1.06, 9.88), 0x16222c, 0, 2.16, -0.02);
  // Slender white roof crown & slight front bevel fascia
  addColored(parts, new T.BoxGeometry(2.46, 0.34, 10.04), 0xedf2f5, 0, 2.84, -0.02);
  // Rooftop BYD battery pod & AC condenser unit
  addColored(parts, new T.BoxGeometry(1.88, 0.24, 5.4), 0xdce3e8, 0, 3.10, -0.45);
  addColored(parts, new T.BoxGeometry(1.56, 0.20, 1.8), 0xc4cdd4, 0, 3.08, 2.9);
  // Front & rear dark bumpers + grille accents
  addColored(parts, new T.BoxGeometry(2.52, 0.34, 0.18), 0x262e34, 0, 0.50, 5.06);
  addColored(parts, new T.BoxGeometry(2.52, 0.36, 0.18), 0x262e34, 0, 0.52, -5.06);
  // Window pillar dividers along both flanks
  for (let z = -4.2; z <= 3.8; z += 1.6) {
    addColored(parts, new T.BoxGeometry(2.48, 1.04, 0.08), 0x222c34, 0, 2.16, z);
  }
  // Dual side rear-view mirrors on front arms
  for (const s of [-1, 1]) {
    addColored(parts, new T.BoxGeometry(0.18, 0.04, 0.26), 0x20262a, s * 1.32, 2.12, 4.98);
    addColored(parts, new T.BoxGeometry(0.10, 0.34, 0.12), 0x1c2226, s * 1.39, 1.98, 5.08);
  }
  // 4 heavy transit wheels + silver rims
  for (const sx of [-1.14, 1.14]) {
    for (const sz of [3.05, -2.85]) {
      addColored(parts, new T.CylinderGeometry(0.46, 0.46, 0.28, 16), 0x1a1e20, sx, 0.46, sz, 0, 0, Math.PI / 2);
      addColored(parts, new T.CylinderGeometry(0.24, 0.24, 0.30, 12), 0xbfc7cc, sx, 0.46, sz, 0, 0, Math.PI / 2);
    }
  }
  // Headlight bezels & rear brake-light housings
  for (const sx of [-0.94, 0.94]) {
    addColored(parts, new T.BoxGeometry(0.38, 0.18, 0.06), 0xf6f6ec, sx, 0.86, 5.09);
    addColored(parts, new T.BoxGeometry(0.32, 0.22, 0.06), 0xd82222, sx, 0.92, -5.09);
  }
  // High-mounted rear brake light bar
  addColored(parts, new T.BoxGeometry(0.72, 0.07, 0.05), 0xe62924, 0, 2.74, -5.04);
  const geo = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return geo;
}

function makeLedSignTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#0d1012';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffaa1e';
  g.textBaseline = 'middle';
  g.font = 'bold 52px Arial, sans-serif';
  g.fillText('M493', 24, 50);
  g.font = 'bold 42px "Microsoft YaHei", sans-serif';
  g.fillText('深圳湾口岸 · 海岸城', 175, 50, 320);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeSideLiveryTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 40px "Microsoft YaHei", sans-serif';
  g.fillText('深 圳 巴 士 集 团', 256, 36);
  g.font = '600 20px Arial, sans-serif';
  g.fillStyle = '#d7eeff';
  g.fillText('SHENZHEN BUS GROUP · BYD ELECTRIC', 256, 72);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createShenzhenBuses(root, map, grid, low = false) {
  const routes = [];
  for (const rd of map.roads) {
    if (rd.bridge || rd.layer || rd.tunnel || rd.p.length < 2) continue;
    if (!BUS_ROADS.has(rd.name) && !['primary', 'secondary'].includes(rd.kind)) continue;
    if ((rd.width || 0) < 8.5) continue;
    if (!rd.p.some(([x, z]) => Math.hypot(x + 260, z + 350) < 1350)) continue;

    // Build forward (and reverse if two-way) bus route polylines
    for (const rev of rd.oneway ? [false] : [false, true]) {
      const pts = rev ? [...rd.p].reverse() : rd.p;
      const lens = [0];
      const dirs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1];
        const l = Math.hypot(dx, dz);
        if (l < 0.2) continue;
        total += l;
        lens.push(total);
        dirs.push([dx / l, dz / l]);
      }
      if (total < 140 || dirs.length < 1) continue;
      // Right-hand curb lane offset
      const laneOff = rd.oneway ? rd.width * 0.28 : Math.max(2.6, rd.width * 0.30);
      routes.push({ rd, pts, lens, dirs, total, laneOff });
    }
  }
  if (!routes.length) return { update() {}, setNight() {} };

  const rng = random(20260493);
  routes.sort((a, b) => b.total - a.total);
  const targetCount = Math.min(low ? 10 : 20, routes.length * 2);
  const buses = [];
  for (let i = 0; i < targetCount; i++) {
    const route = routes[i % routes.length];
    buses.push({
      route,
      s: (route.total * ((i * 0.37 + rng() * 0.2) % 0.92)),
      speed: 7.5 + rng() * 3.2,
      curSpeed: 7.0
    });
  }

  const bodyMat = applyDetailMaps(
    new T.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.28, metalness: 0.24, clearcoat: 0.65, clearcoatRoughness: 0.14
    }),
    'brushedMetal',
    { normalScale: 0.08 }
  );
  bodyMat.userData.cityProbe = 'street';
  const bodyMesh = new T.InstancedMesh(createBusBodyGeometry(), bodyMat, buses.length);
  bodyMesh.name = '深圳巴士集团 · 比亚迪电动公交车队';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = false;
  root.add(bodyMesh);

  // Illuminated front LED route signboards (1 draw call)
  const ledTex = makeLedSignTexture();
  const ledMat = new T.MeshBasicMaterial({ map: ledTex, toneMapped: false });
  const ledMesh = new T.InstancedMesh(new T.PlaneGeometry(1.75, 0.32), ledMat, buses.length);
  ledMesh.name = '公交车头LED线路牌';
  ledMesh.frustumCulled = false;
  root.add(ledMesh);

  // Side livery badges (both flanks, 1 draw call)
  const liveryMat = new T.MeshStandardMaterial({
    map: makeSideLiveryTexture(), transparent: true, alphaTest: 0.1, depthWrite: false, roughness: 0.4
  });
  const liveryMesh = new T.InstancedMesh(new T.PlaneGeometry(3.6, 0.64), liveryMat, buses.length * 2);
  liveryMesh.name = '公交车身标识';
  liveryMesh.frustumCulled = false;
  root.add(liveryMesh);

  // Glowing headlights & tail lamps (brighter at night)
  const headMat = new T.MeshBasicMaterial({ color: new T.Color(1.4, 1.35, 1.15), toneMapped: false });
  const headMesh = new T.InstancedMesh(new T.PlaneGeometry(0.36, 0.16), headMat, buses.length * 2);
  headMesh.name = '公交前大灯';
  headMesh.frustumCulled = false;
  root.add(headMesh);

  const tailMat = new T.MeshBasicMaterial({ color: new T.Color(1.9, 0.14, 0.12), toneMapped: false });
  const tailMesh = new T.InstancedMesh(new T.PlaneGeometry(0.30, 0.18), tailMat, buses.length * 2);
  tailMesh.name = '公交尾灯';
  tailMesh.frustumCulled = false;
  root.add(tailMesh);

  const M = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), S = new T.Vector3(1, 1, 1), Y = new T.Vector3(0, 1, 0);
  const QSideL = new T.Quaternion(), QSideR = new T.Quaternion(), QBack = new T.Quaternion();

  function sampleRoute(route, s) {
    const { pts, lens, dirs, laneOff } = route;
    let i = 0;
    while (i + 1 < dirs.length && lens[i + 1] < s) i++;
    const segLen = Math.max(0.01, lens[i + 1] - lens[i]);
    const t = Math.max(0, Math.min(1, (s - lens[i]) / segLen));
    const [dx, dz] = dirs[i];
    const rx = -dz, rz = dx; // right-hand lateral vector
    const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t + rx * laneOff;
    const z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t + rz * laneOff;
    return { x, z, dx, dz, rx, rz, yaw: Math.atan2(dx, dz) };
  }

  function mustStopForSignal(x, z, dx, dz, time) {
    if (!grid.signals?.stops) return false;
    for (const arm of grid.signals.stops.query(x, z)) {
      if (arm.stopDir[0] * dx + arm.stopDir[1] * dz < 0.82) continue;
      const toStopX = arm.stop[0] - x, toStopZ = arm.stop[1] - z;
      const ahead = toStopX * dx + toStopZ * dz;
      if (ahead > 4.2 && ahead < 16.5) {
        const aspect = signalAspect(arm, 'through', Math.floor(time));
        if (aspect !== 'green') return true;
      }
    }
    return false;
  }

  let prevTime = -1;
  function update(time) {
    const dt = prevTime < 0 ? 0.016 : Math.min(0.06, Math.max(0, time - prevTime));
    prevTime = time;

    for (let i = 0; i < buses.length; i++) {
      const b = buses[i];
      const cur = sampleRoute(b.route, b.s);
      const redStop = mustStopForSignal(cur.x, cur.z, cur.dx, cur.dz, time);
      const targetV = redStop ? 0 : b.speed;
      b.curSpeed += (targetV - b.curSpeed) * Math.min(1, dt * (redStop ? 3.8 : 1.8));
      b.s += b.curSpeed * dt;
      if (b.s >= b.route.total - 4) b.s = 2;

      const p = sampleRoute(b.route, b.s);
      const y = 0.285;
      Q.setFromAxisAngle(Y, p.yaw);
      P.set(p.x, y, p.z);
      M.compose(P, Q, S);
      bodyMesh.setMatrixAt(i, M);

      // Front amber LED destination board above windshield
      P.set(p.x + p.dx * 5.04, y + 2.74, p.z + p.dz * 5.04);
      M.compose(P, Q, S);
      ledMesh.setMatrixAt(i, M);

      // Flank livery badges
      QSideR.setFromAxisAngle(Y, p.yaw + Math.PI * 0.5);
      P.set(p.x + p.rx * 1.26, y + 0.92, p.z + p.rz * 1.26);
      M.compose(P, QSideR, S);
      liveryMesh.setMatrixAt(i * 2, M);

      QSideL.setFromAxisAngle(Y, p.yaw - Math.PI * 0.5);
      P.set(p.x - p.rx * 1.26, y + 0.92, p.z - p.rz * 1.26);
      M.compose(P, QSideL, S);
      liveryMesh.setMatrixAt(i * 2 + 1, M);

      // Front headlights
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? -0.94 : 0.94;
        P.set(p.x + p.dx * 5.13 + p.rx * side, y + 0.86, p.z + p.dz * 5.13 + p.rz * side);
        M.compose(P, Q, S);
        headMesh.setMatrixAt(i * 2 + k, M);
      }

      // Rear LED tail lamps
      QBack.setFromAxisAngle(Y, p.yaw + Math.PI);
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? -0.94 : 0.94;
        P.set(p.x - p.dx * 5.13 + p.rx * side, y + 0.92, p.z - p.dz * 5.13 + p.rz * side);
        M.compose(P, QBack, S);
        tailMesh.setMatrixAt(i * 2 + k, M);
      }
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    ledMesh.instanceMatrix.needsUpdate = true;
    liveryMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    tailMesh.instanceMatrix.needsUpdate = true;
  }

  function setNight(night) {
    const hGain = 0.65 + night * 2.1;
    headMat.color.setRGB(1.0 * hGain, 0.95 * hGain, 0.82 * hGain);
    const tGain = 0.95 + night * 1.6;
    tailMat.color.setRGB(1.6 * tGain, 0.14 * tGain, 0.12 * tGain);
  }

  update(0);
  return { update, setNight };
}
