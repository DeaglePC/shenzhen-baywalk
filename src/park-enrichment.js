import * as T from 'three';
import {parkShrubs,shrubTurf} from './park-shrubs.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Grid,Instances,along,random,inArea,segmentDistance} from './city-geometry.js';
import {applyDetailMaps} from './procedural-textures.js';
import {buildSdfGeometry, smin, sdEllipsoid} from './sdf-mesh.js';

// Shenzhen Talent Park & Cultural Plaza landscape enrichment:
// 1. SDF-sculpted natural garden boulders along lake banks & lawn clusters
// 2. Multi-tiered ornamental shrub beds (bougainvillea, loropetalum, golden privet) & lakeside reeds
// 3. Modern timber-and-steel shade pergolas with built-in benches & warm night lighting
// 4. Park wayfinding signboards, drinking water fountains & lakeside low bollard lights

function mergeColored(parts) {
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}

function addPart(parts, geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
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

let cachedBoulderA = null;
let cachedBoulderB = null;
function gardenBoulderGeometries() {
  if (!cachedBoulderA) {
    const sdfA = (x, y, z) => {
      const a = sdEllipsoid(x, y, z, -0.18, 0.24, 0.05, 0.72, 0.44, 0.56);
      const b = sdEllipsoid(x, y, z,  0.34, 0.18, -0.14, 0.52, 0.36, 0.44);
      const c = sdEllipsoid(x, y, z,  0.05, 0.42, 0.12, 0.44, 0.32, 0.38);
      const bump = 0.045 * Math.sin(x * 6.2 + z * 4.7) * Math.cos(y * 7.1 - x * 3.5);
      return smin(smin(a, b, 0.28), c, 0.25) + bump;
    };
    cachedBoulderA = buildSdfGeometry(sdfA, [-1.02, -0.12, -0.72], [0.98, 0.86, 0.74], 24, 1.4);
  }
  if (!cachedBoulderB) {
    const sdfB = (x, y, z) => {
      const a = sdEllipsoid(x, y, z, 0, 0.38, 0, 0.56, 0.62, 0.46);
      const b = sdEllipsoid(x, y, z, 0.26, 0.22, 0.18, 0.42, 0.34, 0.38);
      const bump = 0.05 * Math.sin(x * 5.8 - y * 6.4) * Math.sin(z * 6.1 + y * 3.1);
      return smin(a, b, 0.26) + bump;
    };
    cachedBoulderB = buildSdfGeometry(sdfB, [-0.74, -0.12, -0.62], [0.78, 1.08, 0.68], 24, 1.4);
  }
  return [cachedBoulderA, cachedBoulderB];
}

function buildParkKits() {
  // 1. Modern Talent Park timber-slat shade pergola (6.4m x 3.6m, height 3.2m) with built-in seating
  const pParts = [];
  // Stone plinth floor
  addPart(pParts, new T.BoxGeometry(6.8, 0.14, 4.0), 0xb7b2a6, 0, 0.07, 0);
  // 4 slender dark-steel columns
  for (const sx of [-2.9, 2.9]) {
    for (const sz of [-1.55, 1.55]) {
      addPart(pParts, new T.BoxGeometry(0.18, 3.10, 0.18), 0x3a4347, sx, 1.66, sz);
    }
  }
  // Perimeter steel roof frame
  addPart(pParts, new T.BoxGeometry(6.4, 0.22, 0.18), 0x3a4347, 0, 3.18, -1.55);
  addPart(pParts, new T.BoxGeometry(6.4, 0.22, 0.18), 0x3a4347, 0, 3.18,  1.55);
  addPart(pParts, new T.BoxGeometry(0.18, 0.22, 3.3), 0x3a4347, -2.9, 3.18, 0);
  addPart(pParts, new T.BoxGeometry(0.18, 0.22, 3.3), 0x3a4347,  2.9, 3.18, 0);
  // Warm cedar timber roof louvers (17 slats)
  for (let i = -8; i <= 8; i++) {
    addPart(pParts, new T.BoxGeometry(0.10, 0.15, 3.45), 0x9c6e49, i * 0.36, 3.20, 0);
  }
  // Built-in side timber benches with backrests
  for (const sz of [-1.22, 1.22]) {
    addPart(pParts, new T.BoxGeometry(4.4, 0.40, 0.48), 0x8e8b84, 0, 0.34, sz);
    addPart(pParts, new T.BoxGeometry(4.5, 0.07, 0.56), 0x9c6d48, 0, 0.57, sz);
  }
  const pergolaGeo = mergeColored(pParts);

  // 2. Public stainless drinking water fountain (iconic Shenzhen park amenity)
  const fParts = [];
  addPart(fParts, new T.CylinderGeometry(0.32, 0.36, 0.08, 14), 0x8c8a84, 0, 0.04, 0);
  addPart(fParts, new T.CylinderGeometry(0.11, 0.13, 0.96, 12), 0x4b565c, 0, 0.54, 0);
  addPart(fParts, new T.CylinderGeometry(0.24, 0.18, 0.11, 14), 0xcbd2d4, 0, 1.02, 0.05);
  addPart(fParts, new T.CylinderGeometry(0.19, 0.14, 0.09, 14), 0xcbd2d4, -0.24, 0.72, 0.05); // child-height basin
  addPart(fParts, new T.BoxGeometry(0.22, 0.07, 0.07), 0x4b565c, -0.12, 0.68, 0.03);
  const fountainGeo = mergeColored(fParts);

  // 3. Curved stone-and-timber park bench (standalone lawn seating)
  const bParts = [];
  addPart(bParts, new T.BoxGeometry(2.15, 0.38, 0.52), 0xa8a399, 0, 0.19, 0);
  for (let j = -1; j <= 1; j++) {
    addPart(bParts, new T.BoxGeometry(2.22, 0.06, 0.15), 0x936642, 0, 0.41, j * 0.17);
  }
  const stoneBenchGeo = mergeColored(bParts);

  // 4. Ornamental lakeside reed / fountain-grass tuft (natural shoreline softener)
  const reedParts = [];
  const rRng = random(4109);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rRng() * 0.3;
    const tilt = 0.22 + rRng() * 0.38;
    const h = 0.65 + rRng() * 0.55;
    const col = rRng() < 0.28 ? 0xb5a676 : (rRng() < 0.65 ? 0x466d34 : 0x5c823e);
    addPart(
      reedParts,
      new T.ConeGeometry(0.035, h, 4),
      col,
      Math.cos(a) * 0.14,
      h * 0.45,
      Math.sin(a) * 0.14,
      Math.sin(a) * tilt,
      a,
      -Math.cos(a) * tilt
    );
  }
  const reedGeo = mergeColored(reedParts);

  // 5. Park wayfinding map signboard frame
  const sParts = [];
  addPart(sParts, new T.BoxGeometry(0.10, 2.05, 0.10), 0x2b454b, -0.62, 1.02, 0);
  addPart(sParts, new T.BoxGeometry(0.10, 2.05, 0.10), 0x2b454b,  0.62, 1.02, 0);
  addPart(sParts, new T.BoxGeometry(1.36, 0.09, 0.14), 0x2b454b, 0, 2.06, 0);
  addPart(sParts, new T.BoxGeometry(1.32, 1.18, 0.06), 0x263f45, 0, 1.38, 0);
  const signFrameGeo = mergeColored(sParts);

  return { pergolaGeo, fountainGeo, stoneBenchGeo, reedGeo, signFrameGeo };
}

function makeParkMapSignTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 448;
  const g = c.getContext('2d');
  g.fillStyle = '#234c54';
  g.fillRect(0, 0, 512, 448);
  g.fillStyle = '#e7d5a8';
  g.fillRect(20, 22, 472, 4);
  g.fillStyle = '#f6f3e8';
  g.font = '600 34px "Microsoft YaHei", sans-serif';
  g.fillText('深圳人才公园导览', 32, 66);
  g.fillStyle = '#c5d7d6';
  g.font = '400 18px Arial, sans-serif';
  g.fillText('SHENZHEN TALENT PARK DIRECTORY', 32, 94);
  // Stylized lake map diagram
  g.fillStyle = '#1b383f';
  g.fillRect(28, 114, 456, 206);
  g.fillStyle = '#2d7c86';
  g.beginPath();
  g.ellipse(250, 218, 138, 68, -0.14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e8d7aa';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(250, 218, 152, 80, -0.14, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#e84a3c';
  g.beginPath(); g.arc(285, 250, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4efe1';
  g.font = '500 21px "Microsoft YaHei", sans-serif';
  g.fillText('★ 您在这里   · 星光桥   · 求贤阁   · 群英荟', 32, 362);
  g.fillStyle = '#b9cfcf';
  g.font = '400 19px "Microsoft YaHei", sans-serif';
  g.fillText('← 潮汐广场 / 深圳湾文化广场     → 人才功勋墙 / π桥', 32, 404);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildParkEnrichment(root, map, m, grid) {
  const group = new T.Group();
  group.name = '人才公园 · 景石花境与休憩廊架';
  root.add(group);

  const kits = buildParkKits();
  const [boulderA, boulderB] = gardenBoulderGeometries();

  const kitMat = applyDetailMaps(
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0.16 }),
    'stucco',
    { normalScale: 0.22 }
  );
  const boulderMat = applyDetailMaps(
    new T.MeshStandardMaterial({ color: 0x9c9586, roughness: 0.86, metalness: 0.04 }),
    'granite',
    { normalScale: 0.56, repeat: 2 }
  );
  const darkMetal = applyDetailMaps(
    new T.MeshStandardMaterial({ color: 0x354045, roughness: 0.38, metalness: 0.58 }),
    'brushedMetal',
    { normalScale: 0.24 }
  );
  const bollardGlow = m.parkLights.finish(
    new T.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd188, roughness: 0.35 }),
    2.6
  );

  const rocksA = new Instances(boulderA, boulderMat, '园林自然置石 · 卧石');
  const rocksB = new Instances(boulderB, boulderMat, '园林自然置石 · 立石');
  const turf=(x,z)=>grid.southGround?.heightAt(x,z)??grid.parkDetails?.heightAt(x,z)??shrubTurf(map,x,z);
  const greenShrubs=parkShrubs(root,'滨水与草坪常绿灌木丛',turf);
  const flowerShrubs=parkShrubs(root,'滨水与草坪三角梅花境',turf,true);
  const reeds = new Instances(kits.reedGeo, kitMat, '人才湖亲水岸线芒草带');
  const pergolas = new Instances(kits.pergolaGeo, kitMat, '人才公园现代木钢遮阳廊架');
  const fountains = new Instances(kits.fountainGeo, kitMat, '公园直饮水台');
  const benches = new Instances(kits.stoneBenchGeo, kitMat, '草坪石木休憩凳');
  const signFrames = new Instances(kits.signFrameGeo, kitMat, '公园导览立牌框架');
  const signFaces = new Instances(
    new T.PlaneGeometry(1.18, 1.02),
    new T.MeshStandardMaterial({ map: makeParkMapSignTexture(), roughness: 0.45, side: T.DoubleSide }),
    '公园导览地图面板'
  );
  const bollardPosts = new Instances(new T.CylinderGeometry(0.055, 0.068, 1, 10), darkMetal, '公园草坪矮柱灯杆');
  const bollardLamps = new Instances(new T.CylinderGeometry(0.058, 0.058, 0.14, 10), bollardGlow, '公园草坪矮柱灯罩');

  const park = map.land.find(f => f.kind === 'park' && inArea(0, 0, f));
  const lake = map.water.find(f => Number(f.id) === -10175109);
  const rng = random(20260918);
  const hardscape=new Grid(64);
  for(const f of map.land){
    if(['parking','plaza','pitch','track'].includes(f.kind))hardscape.add(f,f.bbox);
  }

  const inBuilding = (x, z) => grid.buildings.query(x, z).some(b => inArea(x, z, b));
  const inWater = (x, z) => grid.water.query(x, z).some(w => inArea(x, z, w));
  const onRoad = (x, z, pad = 1.0) =>
    grid.roads.query(x, z).some(s => s.y < 1 && segmentDistance(x, z, s.a, s.b) < s.width * 0.5 + pad);
  const onSpecialDeck = (x, z) =>
    grid.platforms.areaAt(x, z) ||
    grid.starLandings?.heightAt(x, z) != null ||
    grid.tidal?.heightAt(x, z) != null ||
    grid.parkBridges?.heightAt(x, z) != null ||
    grid.flowerbed?.heightAt(x, z) != null ||
    grid.parkDetails?.onPromenade?.(x, z, 0.8);
  // Keep foreground of calibrated flowerbed emblem clear
  const inReservedForeground = (x, z) => x > 125 && x < 230 && z > -245 && z < -155;

  const isFreeLawn = (x, z, roadPad = 1.6) =>
    !inWater(x, z) && !inBuilding(x, z) && !onRoad(x, z, roadPad) && !onSpecialDeck(x, z) && !inReservedForeground(x, z)
    && !hardscape.query(x,z).some(f=>inArea(x,z,f));

  function addShrubCluster(cx, cz, count, spread, withBoulder = false) {
    if (withBoulder) {
      const sA = 0.72 + rng() * 0.65;
      rocksA.at(cx, 0.14, cz, sA, sA * (0.75 + rng() * 0.35), sA, rng() * Math.PI * 2);
      if (rng() < 0.68) {
        const a2 = rng() * Math.PI * 2;
        const sB = 0.45 + rng() * 0.42;
        rocksB.at(cx + Math.cos(a2) * 0.95, 0.14, cz + Math.sin(a2) * 0.95, sB, sB, sB, rng() * Math.PI * 2);
      }
    }
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * spread;
      const sx = cx + Math.cos(a) * r;
      const sz = cz + Math.sin(a) * r;
      if (inWater(sx, sz) || onRoad(sx, sz, 0.5) || inBuilding(sx, sz)) continue;
      const rad = 0.68 + rng() * 0.68;
      const h = rad * (0.72 + rng() * 0.42);
      const batch = rng() < 0.28 ? flowerShrubs : greenShrubs;
      const depth=rad*(.85+rng()*.3),yaw=rng()*6.28;
      if(!isFreeLawn(sx,sz,Math.max(rad,depth)*.90))continue;
      batch.at(sx,turf(sx,sz)+h*.38,sz,rad,h*.67,depth,yaw);
    }
  }

  // =========================================================================
  // 1. Soften Talent Lake Shoreline: Natural SDF Boulders, Reeds & Flower Borders
  // =========================================================================
  if (lake?.p?.length > 3) {
    const ring = [...lake.p, lake.p[0]];
    along(ring, 14.5, 4.0, (x, z, dx, dz, s) => {
      if (inReservedForeground(x, z)) return;
      // Find landward normal by probing both sides of shoreline edge
      let lx = -dz, lz = dx;
      if (inWater(x + lx * 2.5, z + lz * 2.5)) { lx = dz; lz = -dx; }
      const shoreX = x + lx * 1.4, shoreZ = z + lz * 1.4;
      if (!isFreeLawn(shoreX, shoreZ, 1.0)) return;

      const idx = Math.floor(s / 14.5);
      // Place natural lakeside reed tufts & occasional SDF boulders right along the bank
      if (idx % 2 === 0) {
        for (let k = -1; k <= 1; k++) {
          const rx = x + lx * (0.8 + rng() * 0.7) + dx * k * 1.1;
          const rz = z + lz * (0.8 + rng() * 0.7) + dz * k * 1.1;
          if (!inWater(rx, rz) && !onRoad(rx, rz, 0.6)) {
            reeds.at(rx, 0.15, rz, 0.85 + rng() * 0.4, 0.8 + rng() * 0.5, 0.85 + rng() * 0.4, rng() * 6.28);
          }
        }
      }
      if (idx % 3 === 1) {
        const bx = x + lx * (2.6 + rng() * 2.2), bz = z + lz * (2.6 + rng() * 2.2);
        if (isFreeLawn(bx, bz, 1.2)) {
          addShrubCluster(bx, bz, 6 + Math.floor(rng() * 5), 2.8, rng() < 0.72);
        }
      }
    });
  }

  // =========================================================================
  // 2. Enrich Open Lawns Inside Talent Park & Around Cultural Plaza (West/North/East)
  // =========================================================================
  const lawnZones = [
    // West lawn near Cultural Plaza & Qiuxian Pavilion
    { x0: -480, z0: 60, x1: -280, z1: 420, step: 22 },
    // North-west / Tidal Square to Cultural Plaza open slopes
    { x0: -420, z0: -320, x1: -110, z1: -110, step: 24 },
    // East & South-east Talent Park lawns
    { x0: 85, z0: -120, x1: 310, z1: 340, step: 24 }
  ];
  for (const zDef of lawnZones) {
    for (let gx = zDef.x0; gx <= zDef.x1; gx += zDef.step) {
      for (let gz = zDef.z0; gz <= zDef.z1; gz += zDef.step) {
        const x = gx + (rng() - 0.5) * zDef.step * 0.65;
        const z = gz + (rng() - 0.5) * zDef.step * 0.65;
        if (park && !inArea(x, z, park) && Math.hypot(x + 330, z + 180) > 220) continue;
        if (!isFreeLawn(x, z, 2.6)) continue;
        if (rng() < 0.58) {
          addShrubCluster(x, z, 5 + Math.floor(rng() * 6), 3.4, rng() < 0.45);
        }
      }
    }
  }

  // =========================================================================
  // 3. Modern Timber-Steel Shade Pergolas Placed in Open Park Clearing Spots
  // =========================================================================
  const pergolaCandidates = [
    [-368, 295, 0.35],
    [-315, 388, -0.42],
    [-255, -245, 0.25],
    [225, 245, -0.58],
    [168, 355, 0.15]
  ];
  for (const [px, pz, yaw] of pergolaCandidates) {
    // Nudge slightly if a candidate touches a path or tree zone
    let spot = null;
    for (const [ox, oz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [8, 6], [-8, -6]]) {
      const tx = px + ox, tz = pz + oz;
      if (isFreeLawn(tx, tz, 4.2)) { spot = [tx, tz]; break; }
    }
    if (!spot) continue;
    pergolas.at(spot[0], 0.14, spot[1], 1, 1, 1, yaw);
    m.parkLights.fixture(spot[0], 2.95, spot[1], 0xffd79e, 52, 16, 0.28);
    // Surround pergola corners with ornamental flower shrubs & a drinking fountain nearby
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    addShrubCluster(spot[0] + cs * 4.4, spot[1] + sn * 4.4, 6, 2.2, true);
    const fx = spot[0] - cs * 4.5, fz = spot[1] - sn * 4.5;
    if (isFreeLawn(fx, fz, 1.5)) fountains.at(fx, 0.15, fz, 1, 1, 1, yaw);
  }

  // =========================================================================
  // 4. Park Promenade Details: Low Bollard Lights, Wayfinding Signs, Benches & Fountains
  // =========================================================================
  const placedSigns = [];
  const placedBollards = [];
  for (const rd of map.roads) {
    if (rd.bridge || rd.layer || rd.p.length < 2) continue;
    if (!['footway', 'path', 'cycleway'].includes(rd.kind)) continue;
    if (!rd.p.some(([x, z]) => Math.hypot(x, z) < 640)) continue;

    const w = rd.width || 2.8;
    along(rd.p, 16, 5.0, (x, z, dx, dz, s) => {
      if (Math.hypot(x, z) > 610 || inReservedForeground(x, z)) return;
      if (park && !inArea(x, z, park)) return;
      const idx = Math.floor(s / 16);
      const side = idx % 2 === 0 ? 1 : -1;
      const nx = -dz * side, nz = dx * side;
      const px = x + nx * (w * 0.5 + 0.85), pz = z + nz * (w * 0.5 + 0.85);
      if (!isFreeLawn(px, pz, 0.65)) return;

      // Low warm lakeside bollard light every ~16m
      if (!placedBollards.some(p => Math.hypot(p[0] - px, p[1] - pz) < 11)) {
        bollardPosts.at(px, 0.54, pz, 1, 0.78, 1, 0);
        bollardLamps.at(px, 0.86, pz, 1, 1, 1, 0);
        m.parkLights.fixture(px, 0.90, pz, 0xffd596, 22, 11, 0.28);
        placedBollards.push([px, pz]);
      }

      // Park directory signboard every ~95m along walkways
      if (idx % 6 === 2 && !placedSigns.some(p => Math.hypot(p[0] - px, p[1] - pz) < 92)) {
        const sx = x + nx * (w * 0.5 + 1.45), sz = z + nz * (w * 0.5 + 1.45);
        if (isFreeLawn(sx, sz, 0.9)) {
          const syaw = Math.atan2(-nx, -nz);
          signFrames.at(sx, 0.16, sz, 1, 1, 1, syaw);
          signFaces.at(sx - nx * 0.036, 1.54, sz - nz * 0.036, 1, 1, 1, syaw);
          signFaces.at(sx + nx * 0.036, 1.54, sz + nz * 0.036, 1, 1, 1, syaw + Math.PI);
          placedSigns.push([sx, sz]);
        }
      } else if (idx % 5 === 4) {
        // Standalone stone-and-timber resting bench
        const bx = x + nx * (w * 0.5 + 1.35), bz = z + nz * (w * 0.5 + 1.35);
        if (isFreeLawn(bx, bz, 0.9)) {
          benches.at(bx, 0.16, bz, 1, 1, 1, Math.atan2(-nx, -nz));
        }
      }
    });
  }

  greenShrubs.flush(group,false);flowerShrubs.flush(group,false);
  for (const batch of [rocksA, rocksB, reeds, pergolas, fountains, benches, signFrames, signFaces, bollardPosts, bollardLamps]) {
    const cast = batch === rocksA || batch === rocksB || batch === pergolas || batch === benches || batch === signFrames;
    const range = (batch === pergolas || batch === rocksA || batch === rocksB) ? 540 : 280;
    batch.flush(group, cast, range);
  }
}
