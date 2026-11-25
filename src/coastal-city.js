import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {streetHedges} from './park-shrubs.js';
import {Instances,bounds,inArea,random} from './city-geometry.js';
import {skywalkFootprints,skywalkHeight} from './walk-deck-data.js';
import {applyDetailMaps} from './procedural-textures.js';

// Coastal City (海岸城) & Poly Cultural Plaza commercial district enrichment:
// 1. 2F skywalk promenade life: warm commercial streetlamps, outdoor cafe umbrella seating,
//    granite planter benches, illuminated directory lightboxes & hero commercial LED screens
// 2. Mall rooftop architecture: glass atrium skylights & HVAC cooling tower arrays
// 3. Wenxin 4th Rd underpass height-clearance (限高4.5m) warning signs & mall parking wayfinding

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

function mergeParts(parts) {
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}

function buildCoastalKits() {
  // 1. Modern commercial cafe umbrella + table + 4 chairs
  const cParts = [];
  // Table base & wood tabletop
  addPart(cParts, new T.CylinderGeometry(0.28, 0.32, 0.05, 10), 0x353b3f, 0, 0.025, 0);
  addPart(cParts, new T.CylinderGeometry(0.035, 0.035, 0.74, 8), 0x3a4146, 0, 0.39, 0);
  addPart(cParts, new T.BoxGeometry(0.96, 0.05, 0.96), 0x9b6e49, 0, 0.76, 0);
  // Central aluminum umbrella pole + warm cream square shade canopy
  addPart(cParts, new T.CylinderGeometry(0.028, 0.032, 2.52, 8), 0x4b5358, 0, 1.32, 0);
  addPart(cParts, new T.ConeGeometry(1.75, 0.42, 4), 0xf0e7d6, 0, 2.48, 0, 0, Math.PI / 4, 0);
  addPart(cParts, new T.BoxGeometry(2.44, 0.08, 2.44), 0xdfd3be, 0, 2.24, 0);
  // 4 sleek outdoor chairs around the table
  for (const [cx, cz, ry] of [[0, 0.78, Math.PI], [0, -0.78, 0], [0.78, 0, -Math.PI / 2], [-0.78, 0, Math.PI / 2]]) {
    addPart(cParts, new T.BoxGeometry(0.44, 0.05, 0.44), 0x52463d, cx, 0.45, cz, 0, ry, 0);
    addPart(cParts, new T.BoxGeometry(0.44, 0.42, 0.05), 0x453b34, cx + Math.sin(ry) * -0.20, 0.66, cz + Math.cos(ry) * -0.20, 0, ry, 0);
    addPart(cParts, new T.CylinderGeometry(0.02, 0.02, 0.44, 6), 0x31363a, cx, 0.22, cz);
  }
  const cafeSetGeo = mergeParts(cParts);

  // 2. Modern 2F promenade commercial streetlamp (slender architectural pole + dual bracket arms)
  const lParts = [];
  addPart(lParts, new T.CylinderGeometry(0.14, 0.17, 0.24, 10), 0x3b4348, 0, 0.12, 0);
  addPart(lParts, new T.CylinderGeometry(0.065, 0.095, 4.15, 10), 0x444d53, 0, 2.25, 0);
  addPart(lParts, new T.BoxGeometry(1.15, 0.07, 0.08), 0x444d53, 0, 4.22, 0);
  addPart(lParts, new T.CylinderGeometry(0.19, 0.22, 0.08, 12), 0x2e353a, -0.52, 4.30, 0);
  addPart(lParts, new T.CylinderGeometry(0.19, 0.22, 0.08, 12), 0x2e353a,  0.52, 4.30, 0);
  const lampPoleGeo = mergeParts(lParts);

  const gParts = [];
  addPart(gParts, new T.CylinderGeometry(0.16, 0.16, 0.16, 12), 0xfff2d6, -0.52, 4.18, 0);
  addPart(gParts, new T.CylinderGeometry(0.16, 0.16, 0.16, 12), 0xfff2d6,  0.52, 4.18, 0);
  const lampGlowGeo = mergeParts(gParts);

  // 3. Promenade stone planter bench base
  const pParts = [];
  addPart(pParts, new T.BoxGeometry(3.4, 0.50, 1.85), 0xb9b4aa, 0, 0.25, 0);
  addPart(pParts, new T.BoxGeometry(3.5, 0.06, 1.95), 0xd2cdc3, 0, 0.51, 0);
  addPart(pParts, new T.BoxGeometry(2.9, 0.06, 0.42), 0x936744, 0, 0.56,  0.72);
  addPart(pParts, new T.BoxGeometry(2.9, 0.06, 0.42), 0x936744, 0, 0.56, -0.72);
  addPart(pParts, new T.BoxGeometry(2.92, .02, .96), 0x44372a, 0, .538, 0);
  const deckPlanterGeo = mergeParts(pParts);

  // 4. Illuminated commercial directory / poster lightbox frame (1.25m wide x 2.35m tall)
  const fParts = [];
  addPart(fParts, new T.BoxGeometry(1.36, 0.14, 0.34), 0x31383d, 0, 0.07, 0);
  addPart(fParts, new T.BoxGeometry(0.10, 2.28, 0.20), 0x3b444a, -0.63, 1.22, 0);
  addPart(fParts, new T.BoxGeometry(0.10, 2.28, 0.20), 0x3b444a,  0.63, 1.22, 0);
  addPart(fParts, new T.BoxGeometry(1.36, 0.10, 0.22), 0x3b444a, 0, 2.36, 0);
  const lightboxFrameGeo = mergeParts(fParts);

  // 5. Rooftop HVAC chiller / cooling tower module
  const hParts = [];
  addPart(hParts, new T.BoxGeometry(4.6, 2.4, 3.2), 0xb8bebd, 0, 1.2, 0);
  addPart(hParts, new T.CylinderGeometry(0.95, 1.05, 0.55, 14), 0x7e878b, -1.1, 2.65, 0);
  addPart(hParts, new T.CylinderGeometry(0.95, 1.05, 0.55, 14), 0x7e878b,  1.1, 2.65, 0);
  addPart(hParts, new T.BoxGeometry(4.2, 0.85, 0.08), 0x5c666b, 0, 1.1,  1.62);
  addPart(hParts, new T.BoxGeometry(4.2, 0.85, 0.08), 0x5c666b, 0, 1.1, -1.62);
  const hvacGeo = mergeParts(hParts);

  return { cafeSetGeo, lampPoleGeo, lampGlowGeo, deckPlanterGeo, lightboxFrameGeo, hvacGeo };
}

function makeLightboxTexture() {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 640;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 640);
  grad.addColorStop(0, '#13263d');
  grad.addColorStop(0.55, '#1d4468');
  grad.addColorStop(1, '#263445');
  g.fillStyle = grad;
  g.fillRect(0, 0, 384, 640);
  g.fillStyle = '#f0c674';
  g.fillRect(28, 34, 328, 5);
  g.fillRect(28, 594, 328, 4);
  g.textAlign = 'center';
  g.fillStyle = '#fff5e0';
  g.font = 'bold 48px "Microsoft YaHei", sans-serif';
  g.fillText('海 岸 城', 192, 118);
  g.fillStyle = '#f2c879';
  g.font = '600 22px Arial, sans-serif';
  g.fillText('COASTAL CITY', 192, 158);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(36, 200, 312, 224);
  g.fillStyle = '#ffffff';
  g.font = '600 28px "Microsoft YaHei", sans-serif';
  g.fillText('二层步行街 · 潮流生活', 192, 260);
  g.fillStyle = '#d2e5f5';
  g.font = '400 22px "Microsoft YaHei", sans-serif';
  g.fillText('精品咖啡 · 环球美食', 192, 316);
  g.fillText('海岸影城 · 时尚旗舰', 192, 358);
  g.fillText('← 保利文化广场   天利名城 →', 192, 488);
  g.fillStyle = '#f0c674';
  g.font = '500 20px Arial, sans-serif';
  g.fillText('2F SKYWALK PROMENADE', 192, 542);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeHeroLedTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1024, 512);
  grad.addColorStop(0, '#0f2347');
  grad.addColorStop(0.45, '#19508a');
  grad.addColorStop(0.8, '#8a2b62');
  grad.addColorStop(1, '#d97634');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // Abstract luminous architectural wave arcs
  g.strokeStyle = 'rgba(255,220,140,0.45)';
  g.lineWidth = 10;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(820, 420, 140 + i * 75, Math.PI, Math.PI * 1.65);
    g.stroke();
  }
  g.fillStyle = '#fff9ec';
  g.textAlign = 'left';
  g.font = 'bold 92px "Microsoft YaHei", sans-serif';
  g.fillText('深圳 · 海岸城', 68, 195);
  g.fillStyle = '#ffd584';
  g.font = 'bold 46px Arial, sans-serif';
  g.fillText('COASTAL CITY  ·  SHENZHEN BAY', 72, 276);
  g.fillStyle = '#e5f2ff';
  g.font = '500 34px "Microsoft YaHei", sans-serif';
  g.fillText('南山滨海商业中心  |  潮流 · 美食 · 艺术 · 漫游', 72, 368);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeClearanceSignTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  // Alternating yellow/black hazard diagonal stripes
  g.fillStyle = '#f2c21a';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#1b1f22';
  for (let x = -128; x < 640; x += 64) {
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x - 32, 128); g.lineTo(x - 64, 128);
    g.closePath(); g.fill();
  }
  // Center white circular/rect clearance badge: 限高 4.5m
  g.fillStyle = '#ffffff';
  g.fillRect(146, 14, 220, 100);
  g.strokeStyle = '#d62828';
  g.lineWidth = 8;
  g.strokeRect(150, 18, 212, 92);
  g.fillStyle = '#1b1f22';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 54px Arial, "Microsoft YaHei", sans-serif';
  g.fillText('限高 4.5m', 256, 66);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildCoastalCity(root, map, m, grid) {
  const group = new T.Group();
  group.name = '海岸城 · 二层商业街与屋顶天窗';
  root.add(group);

  const kits = buildCoastalKits();
  const kitMat = applyDetailMaps(
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.22 }),
    'stucco',
    { normalScale: 0.18 }
  );
  const glowMat = m.parkLights.finish(
    new T.MeshStandardMaterial({ color: 0xfff2d4, emissive: 0xffd592, roughness: 0.3 }),
    3.4,
    0.35
  );
  const lightboxTex = makeLightboxTexture();
  const lightboxPosterMat = m.parkLights.finish(
    new T.MeshStandardMaterial({
      map: lightboxTex,
      emissiveMap: lightboxTex,
      emissive: 0xffffff,
      roughness: 0.32,
      side: T.DoubleSide
    }),
    1.15,
    0.32
  );

  const cafeSets = new Instances(kits.cafeSetGeo, kitMat, '海岸城二层 · 外摆咖啡伞座');
  const lampPoles = new Instances(kits.lampPoleGeo, kitMat, '海岸城二层 · 商业街灯柱');
  const lampGlows = new Instances(kits.lampGlowGeo, glowMat, '海岸城二层 · 暖光灯罩');
  const deckPlanters = new Instances(kits.deckPlanterGeo, kitMat, '海岸城二层 · 花岗岩树箱坐凳');
  const deckHedges = streetHedges(root, '海岸城二层 · 树箱修剪绿篱');
  const lightboxFrames = new Instances(kits.lightboxFrameGeo, kitMat, '海岸城二层 · 商业灯箱框架');
  const lightboxFaces = new Instances(new T.PlaneGeometry(1.16, 2.08), lightboxPosterMat, '海岸城二层 · 发光导视海报');
  const hvacUnits = new Instances(kits.hvacGeo, kitMat, '海岸城商场 · 屋顶冷却塔与空调机组');

  const inBuilding = (x, z) => grid.buildings.query(x, z).some(b => inArea(x, z, b));

  // =========================================================================
  // 1. Populate Coastal City 2F Skywalk Promenade (y = skywalkHeight = 6.25m)
  // =========================================================================
  const coastalDecks = (map.decks || [])
    .filter(d => skywalkFootprints.has(d.id))
    .map(d => ({ ...d, bbox: d.bbox || bounds(d.p) }));
  const rng = random(20260785);
  const placedItems = [];
  const tooNear = (x, z, r) => placedItems.some(p => Math.hypot(p[0] - x, p[1] - z) < r);

  // Helper verifying a point is comfortably inside a 2F deck (away from edges & buildings)
  const insideDeckSafe = (d, x, z, margin = 2.6) => {
    if (!inArea(x, z, d) || inBuilding(x, z)) return false;
    for (const [ox, oz] of [[margin, 0], [-margin, 0], [0, margin], [0, -margin]]) {
      if (!inArea(x + ox, z + oz, d) || inBuilding(x + ox, z + oz)) return false;
    }
    return true;
  };

  for (const deck of coastalDecks) {
    const [x0, z0, x1, z1] = bounds(deck.p);
    // Align commercial streetlamps, planter benches, cafe umbrella sets & lightboxes on a tidy grid
    for (let gx = Math.ceil(x0 / 10) * 10; gx <= x1; gx += 10) {
      for (let gz = Math.ceil(z0 / 10) * 10; gz <= z1; gz += 10) {
        const x = gx + (rng() - 0.5) * 1.6;
        const z = gz + (rng() - 0.5) * 1.6;
        // Narrow walkways around sunken atriums still receive warm streetlamps (margin 1.25m)
        const wideSafe = insideDeckSafe(deck, x, z, 2.6);
        const narrowSafe = !wideSafe && insideDeckSafe(deck, x, z, 1.25);
        if ((!wideSafe && !narrowSafe) || tooNear(x, z, 7.2)) continue;
        // Keep central walking spine clear around spawn camera [-1299, -787]
        if (Math.hypot(x + 1299, z + 787) < 8.5) continue;

        const yaw = 0.08 + (Math.floor((gx + gz) / 10) % 2) * (Math.PI * 0.5);
        const mod = Math.abs(Math.round(gx / 10) * 3 + Math.round(gz / 10) * 5) % 6;

        if (narrowSafe || mod === 0 || mod === 3) {
          // Warm commercial promenade streetlamp (+ paired planter bench when deck is wide)
          lampPoles.at(x, skywalkHeight, z, 1, 1, 1, yaw);
          lampGlows.at(x, skywalkHeight, z, 1, 1, 1, yaw);
          m.parkLights.fixture(x, skywalkHeight + 4.05, z, 0xffdba4, 76, 19, skywalkHeight + 0.04);
          if (wideSafe) {
            const bx = x + Math.cos(yaw) * 2.4, bz = z + Math.sin(yaw) * 2.4;
            if (insideDeckSafe(deck, bx, bz, 2.2)) {
              deckPlanters.at(bx, skywalkHeight, bz, 1, 1, 1, yaw);
              deckHedges.at(bx, skywalkHeight + .548, bz, 1.16, 1.07, 1.22, yaw + Math.PI / 2);
            }
          }
          placedItems.push([x, z]);
        } else if (mod === 1 || mod === 4) {
          // Outdoor cafe umbrella seating cluster (1-2 sets)
          cafeSets.at(x, skywalkHeight, z, 1, 1, 1, yaw + 0.2);
          const x2 = x + Math.cos(yaw) * 3.6, z2 = z + Math.sin(yaw) * 3.6;
          if (insideDeckSafe(deck, x2, z2, 2.4)) {
            cafeSets.at(x2, skywalkHeight, z2, 1, 1, 1, yaw - 0.15);
          }
          placedItems.push([x, z]);
        } else if (mod === 2) {
          // Illuminated commercial directory lightbox + soft night light
          lightboxFrames.at(x, skywalkHeight, z, 1, 1, 1, yaw);
          const nx = Math.sin(yaw), nz = Math.cos(yaw);
          lightboxFaces.at(x + nx * 0.09, skywalkHeight + 1.24, z + nz * 0.09, 1, 1, 1, yaw);
          lightboxFaces.at(x - nx * 0.09, skywalkHeight + 1.24, z - nz * 0.09, 1, 1, 1, yaw + Math.PI);
          m.parkLights.fixture(x, skywalkHeight + 2.4, z, 0xffe4bc, 26, 9);
          placedItems.push([x, z]);
        } else {
          // Standalone stone planter bench
          deckPlanters.at(x, skywalkHeight, z, 1, 1, 1, yaw);
          deckHedges.at(x, skywalkHeight + .548, z, 1.16, 1.07, 1.22, yaw + Math.PI / 2);
          placedItems.push([x, z]);
        }
      }
    }
  }

  // =========================================================================
  // 2. Hero Commercial LED Screens on Coastal City Mall & Poly Cultural Plaza
  // =========================================================================
  const ledTex = makeHeroLedTexture();
  const ledMat = m.parkLights.finish(
    new T.MeshStandardMaterial({
      map: ledTex,
      emissiveMap: ledTex,
      emissive: 0xffffff,
      roughness: 0.25,
      metalness: 0.1
    }),
    1.55,
    0.52
  );
  const frameDark = new T.MeshStandardMaterial({ color: 0x22282d, roughness: 0.45, metalness: 0.5 });

  function mountHeroLed(x, y, z, w, h, yaw) {
    const casing = new T.Mesh(new T.BoxGeometry(w + 0.6, h + 0.6, 0.45), frameDark);
    casing.position.set(x, y, z);
    casing.rotation.y = yaw;
    casing.name = '海岸城 · 户外巨型商业LED屏框架';
    group.add(casing);

    const screen = new T.Mesh(new T.PlaneGeometry(w, h), ledMat);
    screen.position.set(x + Math.sin(yaw) * 0.25, y, z + Math.cos(yaw) * 0.25);
    screen.rotation.y = yaw;
    screen.name = '海岸城 · 户外巨型商业LED屏';
    group.add(screen);
  }

  // Mount hero screens on Coastal City Mall (-10744156) & Poly Cultural Plaza (235150406)
  for (const id of [-10744156, 235150406]) {
    const b = map.buildings.find(f => Number(f.id) === id);
    if (!b) continue;
    const bb = bounds(b.p);
    const cx = (bb[0] + bb[2]) * 0.5, cz = (bb[1] + bb[3]) * 0.5;
    // Find longest outward wall facing toward the central skywalk promenade (-1290, -780)
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < b.p.length; i++) {
      const A = b.p[i], B = b.p[(i + 1) % b.p.length];
      const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz);
      if (len < 24) continue;
      const mx = (A[0] + B[0]) * 0.5, mz = (A[1] + B[1]) * 0.5;
      let nx = dz / len, nz = -dx / len;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
      const toWalk = (nx * (-1290 - mx) + nz * (-780 - mz)) / Math.max(1, Math.hypot(-1290 - mx, -780 - mz));
      const score = toWalk + len * 0.015;
      if (score > bestScore) { bestScore = score; best = { mx, mz, nx, nz, len, yaw: Math.atan2(nx, nz) }; }
    }
    if (best) {
      const w = Math.min(22, best.len * 0.42);
      const h = w * 0.50;
      const y = Math.min(b.h - h * 0.55 - 1.5, 18.5);
      mountHeroLed(best.mx + best.nx * 0.55, y, best.mz + best.nz * 0.55, w, h, best.yaw);
    }

    // 3. Rooftop Architectural Glass Atrium Skylights & HVAC Arrays (fixes barren grey flat roofs!)
    const rw = bb[2] - bb[0], rd = bb[3] - bb[1];
    const skyGlassMat = m.parkLights.finish(
      new T.MeshPhysicalMaterial({
        color: 0x7ba9bc,
        emissive: 0xffd59c,
        roughness: 0.14,
        metalness: 0.35,
        clearcoat: 0.9,
        envMapIntensity: 1.25
      }),
      0.75,
      0.04
    );
    const frameSteel = applyDetailMaps(
      new T.MeshStandardMaterial({ color: 0xcfd4d2, roughness: 0.36, metalness: 0.6 }),
      'brushedMetal',
      { normalScale: 0.25 }
    );
    // Two large architectural skylight domes / pitched glass lanterns across the mall roof
    const offsets = rw > rd ? [[-rw * 0.18, 0], [rw * 0.18, 0]] : [[0, -rd * 0.18], [0, rd * 0.18]];
    for (const [ox, oz] of offsets) {
      const sx = cx + ox, sz = cz + oz;
      if (!inArea(sx, sz, b)) continue;
      const sw = Math.min(24, rw * 0.26), sd = Math.min(18, rd * 0.24);
      const baseCurb = new T.Mesh(new T.BoxGeometry(sw + 1.2, 1.4, sd + 1.2), frameSteel);
      baseCurb.position.set(sx, b.h + 0.7, sz);
      group.add(baseCurb);
      // Glazed pyramid-ridge atrium skylight lantern
      const dome = new T.Mesh(new T.CylinderGeometry(0.15, Math.hypot(sw, sd) * 0.48, 3.8, 4), skyGlassMat);
      dome.rotation.y = Math.PI * 0.25;
      dome.scale.set(sw / Math.max(sw, sd), 1, sd / Math.max(sw, sd));
      dome.position.set(sx, b.h + 3.2, sz);
      dome.name = '海岸城商场 · 屋顶采光玻璃天窗';
      group.add(dome);
    }
    // Mechanical HVAC cooling tower banks along roof perimeter
    for (let k = -2; k <= 2; k++) {
      const hx = cx + k * 9.5, hz = cz - rd * 0.30;
      if (inArea(hx, hz, b)) hvacUnits.at(hx, b.h, hz, 1, 1, 1, 0);
    }
  }

  // =========================================================================
  // 4. Wenxin 4th Rd Underpass Height-Clearance (限高 4.5m) Gantry Signs
  // =========================================================================
  const clearMat = new T.MeshStandardMaterial({
    map: makeClearanceSignTexture(),
    roughness: 0.42,
    metalness: 0.15,
    side: T.DoubleSide
  });
  const signGeo = new T.PlaneGeometry(4.8, 0.68);
  // Placed cleanly below the skywalk soffit across Wenxin 4th Road (unobstructed by longitudinal girders)
  for (const [sx, sz, syaw] of [[-1356.2, -746.5, 0.16], [-1341.0, -834.0, Math.PI + 0.16]]) {
    const sm = new T.Mesh(signGeo, clearMat);
    sm.position.set(sx, skywalkHeight - 0.96, sz);
    sm.rotation.y = syaw;
    sm.name = '文心四路桥下 · 限高4.5m警示牌';
    group.add(sm);
  }

  deckHedges.flush(root,420);
  for (const batch of [cafeSets, lampPoles, lampGlows, deckPlanters, lightboxFrames, lightboxFaces, hvacUnits]) {
    const cast = batch === cafeSets || batch === lampPoles || batch === deckPlanters || batch === hvacUnits;
    batch.flush(root, cast, 420);
  }
}
