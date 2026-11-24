import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Instances,Surface,along,random,inArea,segmentDistance} from './city-geometry.js';
import {footRoad,atStation} from './road-profiles.js';
import {applyDetailMaps} from './procedural-textures.js';
import {photo} from './city-materials.js';

// Real-world Shenzhen Houhai / Chun Sun (China Resources Tower) urban micro-layer:
// 1. Chun Sun forecourt plaza: granite tree-planter benches, mirror water features, stone bollards, wayfinding totems
// 2. Keyuan South / Dengliang / Haide 3rd Ave: central median guardrails + bougainvillea planters, sidewalk fences
// 3. Street micro-furniture: fire hydrants, dual-bin trash cans, utility boxes, shared bike parking bays
// 4. Houhai green-turf construction hoarding along undeveloped bare-earth lots facing main intersections

const CHUNSUN = [-263.3, -456.81];
const MAJOR_STREETS = new Set([
  '科苑南路', '登良路', '海德三道', '中心路', '创业路', '后海大道', '海德一道', '海天二路', '望海路'
]);

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

function buildUrbanKits() {
  // 1. Standard Shenzhen white/blue municipal guardrail segment (length 2.4m along local Z)
  const fenceParts = [];
  addPart(fenceParts, new T.BoxGeometry(0.18, 0.14, 0.24), 0x4b6277, 0, 0.07, -1.16);
  addPart(fenceParts, new T.CylinderGeometry(0.032, 0.036, 0.92, 8), 0xe6eae8, 0, 0.56, -1.16);
  addPart(fenceParts, new T.CylinderGeometry(0.036, 0.036, 0.08, 8), 0x1664a8, 0, 1.04, -1.16); // Shenzhen blue cap
  addPart(fenceParts, new T.BoxGeometry(0.045, 0.055, 2.38), 0xe8ecea, 0, 0.94, 0);
  addPart(fenceParts, new T.BoxGeometry(0.045, 0.055, 2.38), 0xe8ecea, 0, 0.34, 0);
  addPart(fenceParts, new T.BoxGeometry(0.050, 0.035, 2.38), 0x1767ad, 0, 0.87, 0); // subtle blue stripe
  for (let k = -5; k <= 5; k++) {
    addPart(fenceParts, new T.BoxGeometry(0.022, 0.56, 0.022), 0xe2e6e4, 0, 0.64, k * 0.205);
  }
  const guardrailGeo = mergeColored(fenceParts);

  // 2. Median bougainvillea (三角梅) planter trough with lush foliage & magenta blooms
  const boxParts = [];
  addPart(boxParts, new T.BoxGeometry(0.68, 0.56, 2.20), 0x8e8c84, 0, 0.28, 0);
  addPart(boxParts, new T.BoxGeometry(0.74, 0.07, 2.26), 0xb8b5ac, 0, 0.57, 0);
  addPart(boxParts, new T.BoxGeometry(0.60, 0.06, 2.10), 0x3b332b, 0, 0.54, 0);
  const rng = random(7721);
  for (let i = 0; i < 24; i++) {
    const z = -0.95 + (i / 23) * 1.90 + (rng() - 0.5) * 0.08;
    const x = (rng() - 0.5) * 0.44;
    const y = 0.66 + rng() * 0.28;
    const r = 0.16 + rng() * 0.10;
    const isFlower = rng() < 0.44;
    const col = isFlower
      ? (rng() < 0.65 ? 0xc2226e : 0xe03d85) // iconic Shenzhen crimson-magenta bougainvillea
      : (rng() < 0.5 ? 0x2f5a2d : 0x3d6e35);
    addPart(boxParts, new T.IcosahedronGeometry(r, 1), col, x, y, z);
  }
  const planterGeo = mergeColored(boxParts);

  // 3. Outdoor municipal fire hydrant (red cast iron)
  const hydParts = [];
  addPart(hydParts, new T.CylinderGeometry(0.11, 0.14, 0.10, 10), 0x6f7476, 0, 0.05, 0);
  addPart(hydParts, new T.CylinderGeometry(0.085, 0.095, 0.68, 12), 0xc72924, 0, 0.42, 0);
  addPart(hydParts, new T.CylinderGeometry(0.11, 0.11, 0.06, 12), 0xaa201c, 0, 0.72, 0);
  addPart(hydParts, new T.SphereGeometry(0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc72924, 0, 0.75, 0);
  addPart(hydParts, new T.CylinderGeometry(0.042, 0.042, 0.28, 8), 0xd43831, 0, 0.55, 0, 0, 0, Math.PI / 2);
  addPart(hydParts, new T.CylinderGeometry(0.048, 0.048, 0.14, 8), 0x999d9e, 0, 0.55, 0.08, Math.PI / 2, 0, 0);
  const hydrantGeo = mergeColored(hydParts);

  // 4. Shenzhen dual-stream stainless waste bin (recyclable blue / other grey)
  const binParts = [];
  addPart(binParts, new T.BoxGeometry(0.86, 0.08, 0.44), 0x464d52, 0, 0.04, 0);
  addPart(binParts, new T.BoxGeometry(0.40, 0.88, 0.40), 0xbec5c8, -0.21, 0.50, 0);
  addPart(binParts, new T.BoxGeometry(0.40, 0.88, 0.40), 0xbec5c8,  0.21, 0.50, 0);
  addPart(binParts, new T.BoxGeometry(0.38, 0.16, 0.03), 0x1b6bc2, -0.21, 0.82, 0.205);
  addPart(binParts, new T.BoxGeometry(0.38, 0.16, 0.03), 0x4b5458,  0.21, 0.82, 0.205);
  addPart(binParts, new T.BoxGeometry(0.90, 0.06, 0.46), 0x5c6468, 0, 0.97, 0);
  const binGeo = mergeColored(binParts);

  // 5. Roadside utility / power distribution cabinet (light green-grey)
  const boxUtilParts = [];
  addPart(boxUtilParts, new T.BoxGeometry(1.18, 0.20, 0.72), 0x868a86, 0, 0.10, 0);
  addPart(boxUtilParts, new T.BoxGeometry(1.10, 1.46, 0.64), 0x8fa396, 0, 0.92, 0);
  addPart(boxUtilParts, new T.BoxGeometry(1.22, 0.10, 0.76), 0x6f8075, 0, 1.68, 0);
  addPart(boxUtilParts, new T.BoxGeometry(0.46, 1.24, 0.02), 0x9cb0a3, -0.26, 0.92, 0.325);
  addPart(boxUtilParts, new T.BoxGeometry(0.46, 1.24, 0.02), 0x9cb0a3,  0.26, 0.92, 0.325);
  addPart(boxUtilParts, new T.BoxGeometry(0.16, 0.12, 0.02), 0xebb820, 0.28, 1.28, 0.34);
  const utilBoxGeo = mergeColored(boxUtilParts);

  // 6. Lightweight shared bicycle silhouette (blue/yellow Shenzhen street staple)
  function bikeGeo(frameHex) {
    const bp = [];
    // Front & rear wheels
    addPart(bp, new T.TorusGeometry(0.30, 0.028, 6, 14), 0x1e2224, 0, 0.31,  0.54, 0, Math.PI / 2, 0);
    addPart(bp, new T.TorusGeometry(0.30, 0.028, 6, 14), 0x1e2224, 0, 0.31, -0.54, 0, Math.PI / 2, 0);
    // Frame tubes
    addPart(bp, new T.CylinderGeometry(0.022, 0.022, 0.76, 6), frameHex, 0, 0.52,  0.04, 1.02, 0, 0);
    addPart(bp, new T.CylinderGeometry(0.020, 0.020, 0.68, 6), frameHex, 0, 0.56, -0.18, -0.25, 0, 0);
    addPart(bp, new T.CylinderGeometry(0.020, 0.020, 0.70, 6), frameHex, 0, 0.68,  0.44, -0.28, 0, 0);
    // Handlebar, basket & saddle
    addPart(bp, new T.CylinderGeometry(0.016, 0.016, 0.52, 6), 0x2c3235, 0, 0.98, 0.35, 0, 0, Math.PI / 2);
    addPart(bp, new T.BoxGeometry(0.28, 0.20, 0.22), 0x353b3f, 0, 0.84, 0.52);
    addPart(bp, new T.BoxGeometry(0.14, 0.06, 0.24), 0x23272a, 0, 0.88, -0.24);
    return mergeColored(bp);
  }
  const blueBikeGeo = bikeGeo(0x1e8ae6);
  const yellowBikeGeo = bikeGeo(0xf2be1a);

  // 7. Chun Sun plaza granite planter bench (4.2m x 2.2m modern stone + timber seat + organic leafy shrubs)
  const pbParts = [];
  addPart(pbParts, new T.BoxGeometry(4.2, 0.50, 2.2), 0xb2aea6, 0, 0.25, 0);
  addPart(pbParts, new T.BoxGeometry(4.32, 0.07, 2.32), 0xcbc7be, 0, 0.51, 0);
  // Timber slatted bench tops on front & back edges
  for (const s of [-1, 1]) {
    addPart(pbParts, new T.BoxGeometry(3.6, 0.065, 0.44), 0x8e6140, 0, 0.57, s * 0.88);
  }
  addPart(pbParts, new T.BoxGeometry(3.4, 0.06, 1.32), 0x3b332a, 0, 0.51, 0);
  const prng = random(9901);
  for (let i = 0; i < 64; i++) {
    const x = (prng() - 0.5) * 3.1;
    const z = (prng() - 0.5) * 1.08;
    const y = 0.56 + prng() * 0.42;
    const sx = 0.10 + prng() * 0.14, sy = 0.14 + prng() * 0.16, sz = 0.04 + prng() * 0.06;
    const col = prng() < 0.14 ? 0x9c2c52 : (prng() < 0.55 ? 0x264824 : 0x385e2c);
    addPart(pbParts, new T.DodecahedronGeometry(0.14, 0), col, x, y, z, prng() * 3, prng() * 3, prng() * 3);
    void sx; void sy; void sz;
  }
  const plazaBenchGeo = mergeColored(pbParts);

  // 8. Smoothly sculpted manicured roadside hedge blocks (textured with real Shenzhen hedge photography)
  const hedgeBlockGeo = new RoundedBoxGeometry(0.82, 0.56, 2.28, 3, 0.16);
  hedgeBlockGeo.translate(0, 0.36, 0);
  const hedgeKerbGeo = new T.BoxGeometry(0.94, 0.14, 2.32);
  hedgeKerbGeo.translate(0, 0.07, 0);

  return { guardrailGeo, planterGeo, hydrantGeo, binGeo, utilBoxGeo, blueBikeGeo, yellowBikeGeo, plazaBenchGeo, hedgeBlockGeo, hedgeKerbGeo };
}

function makeTotemTexture(title, subtitle) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 768;
  const g = c.getContext('2d');
  g.fillStyle = '#2d363c';
  g.fillRect(0, 0, 256, 768);
  g.fillStyle = '#c8a66a';
  g.fillRect(18, 24, 220, 6);
  g.fillRect(18, 720, 220, 4);
  g.fillStyle = '#f3eee2';
  g.textAlign = 'center';
  g.font = '600 32px "Microsoft YaHei", sans-serif';
  title.split('\n').forEach((line, idx) => g.fillText(line, 128, 128 + idx * 46, 220));
  g.fillStyle = '#c8a66a';
  g.font = '500 18px Arial, sans-serif';
  g.fillText(subtitle, 128, 248, 215);
  // Minimal wayfinding arrows
  g.fillStyle = '#d4dad8';
  g.font = '400 22px "Microsoft YaHei", sans-serif';
  g.fillText('↑ 深圳湾万象城', 128, 360);
  g.fillText('→ 深圳人才公园', 128, 412);
  g.fillText('← 后海地铁站', 128, 464);
  g.fillText('↓ 科苑南路', 128, 516);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeHoardingTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 384;
  const g = c.getContext('2d');
  const rng = random(6041);
  // Lush artificial grass wall backdrop (signature Shenzhen construction hoarding)
  g.fillStyle = '#2e5c2d';
  g.fillRect(0, 0, 1024, 384);
  for (let i = 0; i < 16000; i++) {
    const shade = 0.72 + rng() * 0.56;
    g.fillStyle = `rgb(${Math.round(38 * shade)},${Math.round(92 * shade)},${Math.round(36 * shade)})`;
    g.fillRect(rng() * 1024, rng() * 320, 3 + rng() * 4, 4 + rng() * 6);
  }
  // Base concrete kerb strip & dark steel cap rail
  g.fillStyle = '#b4b7b3';
  g.fillRect(0, 326, 1024, 58);
  g.fillStyle = '#3d484d';
  g.fillRect(0, 0, 1024, 18);
  // Vertical module seams
  g.fillStyle = 'rgba(26,38,28,0.45)';
  for (let x = 0; x < 1024; x += 256) g.fillRect(x, 18, 4, 308);
  // Centered civic signage plaque
  g.fillStyle = '#154b84';
  g.fillRect(286, 98, 452, 134);
  g.strokeStyle = '#e5edf4';
  g.lineWidth = 4;
  g.strokeRect(294, 106, 436, 118);
  g.fillStyle = '#f5f8fa';
  g.textAlign = 'center';
  g.font = '600 34px "Microsoft YaHei", sans-serif';
  g.fillText('深圳湾后海中心区 · 品质城区', 512, 158);
  g.font = '400 18px Arial, sans-serif';
  g.fillStyle = '#cce2f5';
  g.fillText('SHENZHEN BAY HOUHAI CENTRAL DISTRICT', 512, 198);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = T.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function buildUrbanLife(root, map, m, grid) {
  const group = new T.Group();
  group.name = '春笋广场与后海主干道街具';
  group.userData.localDetails = root.userData.localDetails ??= [];
  root.add(group);

  const kits = buildUrbanKits();
  const kitMat = applyDetailMaps(
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.24 }),
    'stucco',
    { normalScale: 0.20 }
  );
  const stoneMat = applyDetailMaps(
    new T.MeshStandardMaterial({ color: 0xbbb7ae, roughness: 0.44, metalness: 0.10 }),
    'granite',
    { normalScale: 0.34 }
  );
  const darkMetal = applyDetailMaps(
    new T.MeshStandardMaterial({ color: 0x384248, roughness: 0.36, metalness: 0.62 }),
    'brushedMetal',
    { normalScale: 0.26 }
  );

  const guardrails = new Instances(kits.guardrailGeo, kitMat, '主干道中央与机非隔离护栏');
  const planters = new Instances(kits.planterGeo, kitMat, '主干道三角梅绿化花箱');
  const hydrants = new Instances(kits.hydrantGeo, kitMat, '市政室外消防栓');
  const bins = new Instances(kits.binGeo, kitMat, '人行道双分类垃圾桶');
  const utilBoxes = new Instances(kits.utilBoxGeo, kitMat, '路侧电力环网柜与通信箱');
  const blueBikes = new Instances(kits.blueBikeGeo, kitMat, '共享单车 · 蓝');
  const yellowBikes = new Instances(kits.yellowBikeGeo, kitMat, '共享单车 · 黄');
  const plazaBenches = new Instances(kits.plazaBenchGeo, kitMat, '春笋广场花岗岩树池坐凳');
  const makeRealHedgeMat = (file) => {
    const tex = photo(file);
    tex.repeat.set(2.2, 1.0);
    return applyDetailMaps(
      new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0 }),
      'granite',
      { normalScale: 0.55, repeat: 2 }
    );
  };
  const hedgesGreen = new Instances(kits.hedgeBlockGeo, makeRealHedgeMat('flowerbed-hedge.webp'), '绿道与路侧实拍常绿绿篱带');
  const hedgesGold = new Instances(kits.hedgeBlockGeo, makeRealHedgeMat('flowerbed-gold.webp'), '绿道与路侧实拍金叶绿篱带');
  const hedgesBurgundy = new Instances(kits.hedgeBlockGeo, makeRealHedgeMat('flowerbed-burgundy.webp'), '绿道与路侧实拍红继木绿篱带');
  const hedgeKerbs = new Instances(kits.hedgeKerbGeo, stoneMat, '路侧绿篱花岗岩镶边');
  const stoneSpheres = new Instances(new T.SphereGeometry(0.28, 14, 10), stoneMat, '春笋广场花岗岩防撞石球');
  const plazaPosts = new Instances(new T.CylinderGeometry(0.065, 0.08, 1, 10), darkMetal, '春笋广场低矮景观灯柱');
  const lampHeads = new Instances(
    new T.CylinderGeometry(0.068, 0.068, 0.16, 10),
    m.parkLights.finish(new T.MeshStandardMaterial({ color: 0xfff0d4, emissive: 0xffd28c, roughness: 0.35 }), 2.8),
    '春笋广场景观灯发光罩'
  );
  const bikeBayPaint = new Surface();

  const onRoad = (x, z, pad = 0.6) =>
    grid.roads.query(x, z).some(s => !footRoad(s.rd) && s.y < 1 && segmentDistance(x, z, s.a, s.b) < s.width * 0.5 + pad);
  const onOtherMotor = (x, z, selfRd, pad = 1.6) =>
    grid.roads.query(x, z).some(s => s.rd !== selfRd && !footRoad(s.rd) && s.y < 1 && segmentDistance(x, z, s.a, s.b) < s.width * 0.5 + pad);
  const elevatedOn = (rd, s) => {
    const prof = grid.profiles?.get(rd);
    return prof ? atStation(prof, Math.min(prof.length, Math.max(0, s))).y > 0.62 : false;
  };
  const onAnyPath = (x, z, pad = 0.4) =>
    grid.roads.query(x, z).some(s => s.y < 1 && segmentDistance(x, z, s.a, s.b) < s.width * 0.5 + pad);
  const inBuilding = (x, z) => grid.buildings.query(x, z).some(b => inArea(x, z, b));
  const inWater = (x, z) => grid.water.query(x, z).some(w => inArea(x, z, w));
  const nearSignal = (x, z, dist = 16) =>
    grid.signals?.sites?.some(s => Math.hypot(s.center[0] - x, s.center[1] - z) < Math.max(dist, s.radius + 5));

  // =========================================================================
  // 1. Chun Sun (China Resources Tower) Forecourt Plaza Enrichment
  // =========================================================================
  const [cx, cz] = CHUNSUN;
  // Granite plaza paving ring around Chun Sun base (radius 30..66m, skipping carriageways)
  const plazaTiles = new Surface();
  const segN = 48;
  for (let i = 0; i < segN; i++) {
    const a0 = (i / segN) * Math.PI * 2, a1 = ((i + 1) / segN) * Math.PI * 2;
    for (const [r0, r1] of [[31, 48], [48, 65]]) {
      const am = (a0 + a1) * 0.5, rm = (r0 + r1) * 0.5;
      const mx = cx + Math.cos(am) * rm, mz = cz + Math.sin(am) * rm;
      if (onRoad(mx, mz, 3.2) || inBuilding(mx, mz) || inWater(mx, mz)) continue;
      const p00 = [cx + Math.cos(a0) * r0, 0.225, cz + Math.sin(a0) * r0];
      const p10 = [cx + Math.cos(a1) * r0, 0.225, cz + Math.sin(a1) * r0];
      const p11 = [cx + Math.cos(a1) * r1, 0.225, cz + Math.sin(a1) * r1];
      const p01 = [cx + Math.cos(a0) * r1, 0.225, cz + Math.sin(a0) * r1];
      plazaTiles.quad(p00, p10, p11, p01, [[0, 0], [4, 0], [4, 4], [0, 4]]);
    }
  }
  const plazaMat = applyDetailMaps(
    new T.MeshStandardMaterial({ color: 0xc9c4b9, roughness: 0.82, metalness: 0.04 }),
    'granite',
    { normalScale: 0.36, repeat: 4 }
  );
  plazaTiles.mesh(group, plazaMat, '春笋前广场花岗岩地坪');

  const waterPools = new Surface();
  const poolRims = new Instances(new T.BoxGeometry(1, 1, 1), stoneMat, '春笋镜面水池石沿');

  // Symmetrical granite plaza benches, mirror reflection pools, bollards & bollard lights around Chun Sun
  const benchAngles = [0.22, 0.68, 1.15, 1.62, 2.15, 2.68, -0.35, -0.95, -1.65, -2.35];
  for (const ang of benchAngles) {
    for (const rad of [45.5, 59.5]) {
      const x = cx + Math.cos(ang) * rad;
      const z = cz + Math.sin(ang) * rad;
      if (onRoad(x, z, 2.8) || inBuilding(x, z) || inWater(x, z)) continue;
      const yaw = Math.atan2(-Math.sin(ang), Math.cos(ang));
      plazaBenches.at(x, 0.225, z, 1, 1, 1, yaw);
      // Pair each planter bench with warm low architectural bollard lamps
      for (const s of [-2.85, 2.85]) {
        const lx = x - Math.sin(ang) * s;
        const lz = z + Math.cos(ang) * s;
        if (!onRoad(lx, lz, 1.4) && !inBuilding(lx, lz)) {
          plazaPosts.at(lx, 0.62, lz, 1, 0.80, 1, 0);
          lampHeads.at(lx, 0.96, lz, 1, 1, 1, 0);
          m.parkLights.fixture(lx, 1.00, lz, 0xffd79e, 14, 7.5);
        }
      }
    }
  }

  // Two signature shallow granite mirror water basins flanking Chun Sun's south-east forecourt
  const pools = [
    { x: cx + 52, z: cz + 22, w: 14, d: 6.5, yaw: 0.42 },
    { x: cx + 22, z: cz + 56, w: 14, d: 6.5, yaw: 0.42 },
    { x: cx - 44, z: cz + 38, w: 12, d: 5.5, yaw: -0.25 }
  ];
  for (const pl of pools) {
    if (onRoad(pl.x, pl.z, 5.5) || inBuilding(pl.x, pl.z) || inWater(pl.x, pl.z)) continue;
    const cs = Math.cos(pl.yaw), sn = Math.sin(pl.yaw);
    const pt = (lx, lz) => [pl.x + lx * cs - lz * sn, 0.46, pl.z + lx * sn + lz * cs];
    const hw = pl.w * 0.5 - 0.35, hd = pl.d * 0.5 - 0.35;
    waterPools.quad(pt(-hw, -hd), pt(hw, -hd), pt(hw, hd), pt(-hw, hd));
    // Raised stone basin rim (4 sides)
    poolRims.at(pl.x - sn * (pl.d * 0.5), 0.38, pl.z + cs * (pl.d * 0.5), pl.w + 0.4, 0.30, 0.42, pl.yaw);
    poolRims.at(pl.x + sn * (pl.d * 0.5), 0.38, pl.z - cs * (pl.d * 0.5), pl.w + 0.4, 0.30, 0.42, pl.yaw);
    poolRims.at(pl.x + cs * (pl.w * 0.5), 0.38, pl.z + sn * (pl.w * 0.5), 0.42, 0.30, pl.d, pl.yaw);
    poolRims.at(pl.x - cs * (pl.w * 0.5), 0.38, pl.z - sn * (pl.w * 0.5), 0.42, 0.30, pl.d, pl.yaw);
  }
  const poolWaterMat = new T.MeshPhysicalMaterial({
    color: 0x1d4f5c, roughness: 0.05, metalness: 0.20, clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.55
  });
  poolWaterMat.userData.cityProbe = 'district';
  waterPools.mesh(group, poolWaterMat, '春笋广场镜面水景池');

  // Ring of granite security bollard spheres framing Chun Sun's forecourt perimeter
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = cx + Math.cos(a) * 67.5;
    const z = cz + Math.sin(a) * 67.5;
    if (onRoad(x, z, 1.8) || inBuilding(x, z) || inWater(x, z)) continue;
    stoneSpheres.at(x, 0.42, z, 1, 1, 1, 0);
  }

  // Two sleek architectural wayfinding totems at Chun Sun forecourt entrances
  const totemFaceMat = new T.MeshStandardMaterial({
    map: makeTotemTexture('中国华润大厦\n春 笋', 'CHINA RESOURCES TOWER'),
    roughness: 0.36, metalness: 0.25
  });
  const totemGeo = new T.BoxGeometry(0.92, 3.10, 0.22);
  const totemMats = [darkMetal, darkMetal, darkMetal, darkMetal, totemFaceMat, totemFaceMat];
  for (const [tx, tz, tyaw] of [[cx + 58, cz + 42, 0.72], [cx - 26, cz + 64, 0.12]]) {
    if (onRoad(tx, tz, 2.0) || inBuilding(tx, tz)) continue;
    const mesh = new T.Mesh(totemGeo, totemMats);
    mesh.name = '春笋广场导视精神堡垒';
    mesh.position.set(tx, 1.72, tz);
    mesh.rotation.y = tyaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // =========================================================================
  // 2. Main Houhai Avenues: Median Guardrails, Bougainvillea Planters & Street Micro-Furniture
  // =========================================================================
  const rng = random(20261123);
  const placedFurniture = [];
  const tooClose = (x, z, r) => placedFurniture.some(p => Math.hypot(p[0] - x, p[1] - z) < r);

  for (const rd of map.roads) {
    if (rd.bridge || rd.layer || rd.tunnel || rd.p.length < 2 || footRoad(rd)) continue;
    const isMajor = MAJOR_STREETS.has(rd.name) || ['primary', 'secondary'].includes(rd.kind);
    if (!isMajor) continue;
    // Focus rich street micro-detail within 1.15 km of Chun Sun & Talent Park perimeter
    const inCore = rd.p.some(([x, z]) => Math.hypot(x - cx, z - cz) < 1150 || Math.hypot(x, z) < 950);
    if (!inCore) continue;

    const w = rd.width || 8;
    const yBase = 0.28;

    // 2A. Central median guardrail + bougainvillea planters on wide two-way avenues
    if (!rd.oneway && w >= 9.2) {
      along(rd.p, 2.4, 3.0, (x, z, dx, dz, s) => {
        if (Math.hypot(x - cx, z - cz) > 1050 && Math.hypot(x, z) > 900) return;
        if (elevatedOn(rd, s) || nearSignal(x, z, 22) || onOtherMotor(x, z, rd, 2.8)) return;
        const yaw = Math.atan2(dx, dz);
        const idx = Math.floor(s / 2.4);
        if (idx % 3 === 1) {
          planters.at(x, yBase + 0.04, z, 1, 1, 1, yaw);
        } else {
          guardrails.at(x, yBase + 0.04, z, 1, 1, 1, yaw);
        }
      });
    }

    // 2B. Sidewalk safety guardrails, hydrants, dual bins, utility cabinets & shared bike bays
    along(rd.p, 2.4, 4.0, (x, z, dx, dz, s) => {
      if (Math.hypot(x - cx, z - cz) > 980 && Math.hypot(x, z) > 850) return;
      if (elevatedOn(rd, s)) return;
      const idx = Math.floor(s / 2.4);
      const yaw = Math.atan2(dx, dz);
      for (const side of [-1, 1]) {
        const nx = -dz * side, nz = dx * side;
        const gx = x + nx * (w * 0.5 + 0.34), gz = z + nz * (w * 0.5 + 0.34);

        // Intermittent sidewalk curb guardrails (leave openings every ~22m & near intersections/side-streets)
        if (!nearSignal(gx, gz, 20) && (idx % 11) < 8 && !inWater(gx, gz) && !inBuilding(gx, gz) && !onRoad(gx, gz, 0.15) && !onOtherMotor(gx, gz, rd, 2.2)) {
          guardrails.at(gx, yBase + 0.07, gz, 1, 0.88, 1, yaw);
        }

        // Outer sidewalk municipal furniture (1.6m behind kerb)
        if (idx % 15 === (side > 0 ? 3 : 10)) {
          const fx = x + nx * (w * 0.5 + 1.65), fz = z + nz * (w * 0.5 + 1.65);
          if (onRoad(fx, fz, 0.7) || onOtherMotor(fx, fz, rd, 2.6) || inBuilding(fx, fz) || inWater(fx, fz) || tooClose(fx, fz, 9)) continue;
          const faceYaw = Math.atan2(-nx, -nz);
          const r = rng();
          if (r < 0.36) {
            bins.at(fx, yBase + 0.07, fz, 1, 1, 1, faceYaw);
          } else if (r < 0.60) {
            hydrants.at(fx, yBase + 0.07, fz, 1, 1, 1, faceYaw);
          } else if (r < 0.78) {
            utilBoxes.at(fx, yBase + 0.07, fz, 1, 1, 1, faceYaw);
          } else {
            // Shared bicycle marked bay with 3-5 neatly parked blue/yellow bikes
            const bx0 = fx - dx * 2.1, bz0 = fz - dz * 2.1;
            const bx1 = fx + dx * 2.1, bz1 = fz + dz * 2.1;
            bikeBayPaint.quad(
              [bx0 - nx * 0.75, yBase + 0.085, bz0 - nz * 0.75],
              [bx1 - nx * 0.75, yBase + 0.085, bz1 - nz * 0.75],
              [bx1 + nx * 0.75, yBase + 0.085, bz1 + nz * 0.75],
              [bx0 + nx * 0.75, yBase + 0.085, bz0 + nz * 0.75]
            );
            const count = 3 + Math.floor(rng() * 3);
            for (let b = 0; b < count; b++) {
              const alongOff = (b - (count - 1) * 0.5) * 0.78;
              const px = fx + dx * alongOff, pz = fz + dz * alongOff;
              const bikeYaw = faceYaw + (rng() - 0.5) * 0.24;
              (rng() < 0.55 ? blueBikes : yellowBikes).at(px, yBase + 0.075, pz, 1, 1, 1, bikeYaw);
            }
          }
          placedFurniture.push([fx, fz]);
        }
      }
    });
  }

  // =========================================================================
  // 3. Green-Turf Urban Hoarding Around Bare Undeveloped Lot West of Keyuan S. / Dengliang Junction
  // =========================================================================
  const hoardTex = makeHoardingTexture();
  const hoardMat = new T.MeshStandardMaterial({ map: hoardTex, roughness: 0.78, side: T.DoubleSide });
  const hoardSurf = new Surface();
  // Perimeter segments along the bare-earth construction plot visible at (-585..-720, -110..+25)
  const hoardingRuns = [
    [[-566, 20], [-566, -125]],
    [[-566, 20], [-715, 20]],
    [[-566, -125], [-715, -125]]
  ];
  for (const [A, B] of hoardingRuns) {
    const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.floor(len / 8));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const p0 = [A[0] + dx * t0, A[1] + dz * t0];
      const p1 = [A[0] + dx * t1, A[1] + dz * t1];
      const mid = [(p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5];
      if (onAnyPath(mid[0], mid[1], 1.2) || inBuilding(mid[0], mid[1]) || inWater(mid[0], mid[1])) continue;
      const uLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 8.0;
      hoardSurf.quad([p0[0], 0.22, p0[1]], [p1[0], 0.22, p1[1]], [p1[0], 2.75, p1[1]], [p0[0], 2.75, p0[1]], [[0, 0], [uLen, 0], [uLen, 1], [0, 1]]);
    }
  }
  hoardSurf.mesh(group, hoardMat, '后海中心区绿植施工围挡', true);

  // =========================================================================
  // 4. Roadside & Cycleway Verge Landscaping (Real-textured hedges + native volumetric trees)
  // =========================================================================
  const placedVergeTrees = [];
  grid.vergeTrees = grid.vergeTrees || [];
  const nearVergeTree = (x, z, r) => placedVergeTrees.some(p => Math.hypot(p[0] - x, p[1] - z) < r);
  const onDeck = (x, z) =>
    grid.platforms?.areaAt?.(x, z) ||
    grid.starLandings?.heightAt?.(x, z) != null ||
    grid.tidal?.heightAt?.(x, z) != null ||
    grid.parkBridges?.heightAt?.(x, z) != null ||
    grid.flowerbed?.heightAt?.(x, z) != null;

  for (const rd of map.roads) {
    if (rd.bridge || rd.layer || rd.tunnel || rd.p.length < 2) continue;
    const isCycle = rd.kind === 'cycleway';
    const isArterial = MAJOR_STREETS.has(rd.name) || ['primary', 'secondary', 'tertiary'].includes(rd.kind);
    if (!isCycle && !isArterial) continue;
    if (!rd.p.some(([x, z]) => Math.hypot(x + 260, z + 200) < 1150)) continue;

    const w = rd.width || (isCycle ? 3 : 8);
    along(rd.p, 2.3, 2.0, (x, z, dx, dz, s) => {
      if (Math.hypot(x + 260, z + 200) > 1080) return;
      if (elevatedOn(rd, s)) return;
      if (x > 125 && x < 230 && z > -245 && z < -155) return;
      const yaw = Math.atan2(dx, dz);
      const idx = Math.floor(s / 2.3);
      for (const side of [-1, 1]) {
        const nx = -dz * side, nz = dx * side;
        const off = isCycle ? (w * 0.5 + 1.05) : (w * 0.5 + 2.75);
        const hx = x + nx * off, hz = z + nz * off;
        if (onAnyPath(hx, hz, 0.55) || onOtherMotor(hx, hz, rd, 2.0) || inBuilding(hx, hz) || inWater(hx, hz) || onDeck(hx, hz)) continue;
        if (nearSignal(hx, hz, 16)) continue;

        // Real-photo landscaped ribbons: alternating evergreen, golden privet & burgundy loropetalum
        const band = ((idx >> 2) + (side > 0 ? 1 : 0)) % 4;
        const batch = band === 1 ? hedgesGold : band === 3 ? hedgesBurgundy : hedgesGreen;
        batch.at(hx, 0.12, hz, 1, 0.88 + rng() * 0.24, 1, yaw);
        hedgeKerbs.at(hx, 0.12, hz, 1, 1, 1, yaw);

        // Feed native volumetric / real-photo trees & shrubs into city-nature.js (zero low-poly look!)
        if (idx % 6 === (side > 0 ? 1 : 4)) {
          const tx = x + nx * (off + 2.6), tz = z + nz * (off + 2.6);
          if (!onAnyPath(tx, tz, 1.5) && !inBuilding(tx, tz) && !inWater(tx, tz) && !onDeck(tx, tz) && !nearVergeTree(tx, tz, 11.5)) {
            const type = rng() < 0.35 ? 2 : (rng() < 0.55 ? 0 : 1); // jacaranda or broadleaf real 3D trees
            grid.vergeTrees.push([tx, tz, 5.8 + rng() * 2.8, type]);
            placedVergeTrees.push([tx, tz]);
          }
        }
      }
    });
  }

  // Flush all instanced urban batches with generous draw distances
  const bayMat = new T.MeshStandardMaterial({
    color: 0xe8e4d8, roughness: 0.9, transparent: true, opacity: 0.42,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  bikeBayPaint.mesh(group, bayMat, '共享单车停放框线');
  // The distant segments meet end to end along the surveyed road. Reuse their
  // instance transforms and leaf materials when swapping the rounded profile.
  const distantHedge = new T.BoxGeometry(.82,.56,2.31).translate(0,.36,0);
  const hedgeLod = {near:kits.hedgeBlockGeo, far:distantHedge, distance:95, tileSize:128};
  for (const hedge of [hedgesGreen, hedgesGold, hedgesBurgundy]) hedge.flush(group,true,780,hedgeLod);
  for (const part of [guardrails, planters, hydrants, bins, utilBoxes, blueBikes, yellowBikes, plazaBenches, hedgeKerbs, stoneSpheres, plazaPosts, lampHeads, poolRims]) {
    const cast = part === plazaBenches || part === planters || part === utilBoxes || part === stoneSpheres;
    const range = (part === guardrails || part === planters || part === plazaBenches) ? 520 : 280;
    part.flush(group, cast, range);
  }
}
