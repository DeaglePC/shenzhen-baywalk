import * as T from 'three';

// Procedural PBR micro-detail texture baker (inspired by Crimson Loong's 15_tex.js).
// Generates lightweight tileable normal & roughness maps at boot with zero external assets.
function hash2(ix, iy, seed) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function tileNoise(u, v, periodX, periodY, seed) {
  const x = u * periodX, y = v * periodY;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const ax = ((x0 % periodX) + periodX) % periodX;
  const bx = (ax + 1) % periodX;
  const ay = ((y0 % periodY) + periodY) % periodY;
  const by = (ay + 1) % periodY;
  const n00 = hash2(ax, ay, seed), n10 = hash2(bx, ay, seed);
  const n01 = hash2(ax, by, seed), n11 = hash2(bx, by, seed);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function fbmTile(u, v, px, py, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(u, v, px << o, py << o, seed + o * 31);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

function bakeFromHeight(size, heightFn, { normalStrength = 1.6, roughMin = 0.35, roughMax = 0.85, invertRough = false } = {}) {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      height[y * size + x] = heightFn(x / size, v);
    }
  }
  const normData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const at = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const hL = at(x - 1, y), hR = at(x + 1, y);
      const hD = at(x, y - 1), hU = at(x, y + 1);
      const dx = (hL - hR) * normalStrength;
      const dy = (hD - hU) * normalStrength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      normData[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      normData[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      normData[idx + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;

      const h = height[y * size + x];
      const t = invertRough ? 1 - h : h;
      const r = Math.round(Math.min(1, Math.max(0, roughMin + (roughMax - roughMin) * t)) * 255);
      roughData[idx] = roughData[idx + 1] = roughData[idx + 2] = r;
      roughData[idx + 3] = 255;
    }
  }

  const makeTex = (data) => {
    const tex = new T.DataTexture(data, size, size, T.RGBAFormat);
    tex.colorSpace = T.NoColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };

  return { normalMap: makeTex(normData), roughnessMap: makeTex(roughData) };
}

let cache = null;

export function proceduralDetails() {
  if (cache) return cache;
  const size = 192;

  // 1. Brushed stainless / architectural metal (fine directional striations + subtle wear)
  const brushedMetal = bakeFromHeight(size, (u, v) => {
    const streak = fbmTile(u, v, 4, 48, 3, 101);
    const fine = tileNoise(u, v, 12, 96, 137);
    const blotch = fbmTile(u, v, 4, 4, 2, 179);
    return streak * 0.55 + fine * 0.25 + blotch * 0.20;
  }, { normalStrength: 1.35, roughMin: 0.26, roughMax: 0.58, invertRough: true });

  // 2. Fine speckled granite & carved stonework (curbs, monuments, pedestals)
  const granite = bakeFromHeight(size, (u, v) => {
    const coarse = fbmTile(u, v, 8, 8, 3, 211);
    const grains = fbmTile(u, v, 32, 32, 2, 257);
    const pores = tileNoise(u, v, 64, 64, 293);
    return coarse * 0.42 + grains * 0.36 + pores * 0.22;
  }, { normalStrength: 2.35, roughMin: 0.68, roughMax: 0.98, invertRough: true });

  // 3. Architectural stucco / painted plaster / cast concrete
  const stucco = bakeFromHeight(size, (u, v) => {
    const broad = fbmTile(u, v, 6, 6, 3, 331);
    const trowel = fbmTile(u, v, 18, 18, 2, 389);
    return broad * 0.62 + trowel * 0.38;
  }, { normalStrength: 1.55, roughMin: 0.64, roughMax: 0.94, invertRough: true });

  // 4. Timber wood grain (benches, boardwalk decking)
  const woodGrain = bakeFromHeight(size, (u, v) => {
    const warp = fbmTile(u, v, 4, 12, 3, 419);
    const rings = Math.sin((u * 14 + warp * 2.4) * Math.PI * 2) * 0.5 + 0.5;
    const fibers = tileNoise(u, v, 48, 6, 463);
    return rings * 0.64 + fibers * 0.36;
  }, { normalStrength: 1.95, roughMin: 0.58, roughMax: 0.92, invertRough: true });

  cache = { brushedMetal, granite, stucco, woodGrain };
  return cache;
}

export function applyDetailMaps(material, presetKey, { normalScale = 0.38, repeat = 1 } = {}) {
  const bank = proceduralDetails();
  const maps = bank[presetKey];
  if (!maps || !material) return material;
  if (!material.normalMap) {
    const nTex = repeat === 1 ? maps.normalMap : maps.normalMap.clone();
    if (repeat !== 1) { nTex.repeat.set(repeat, repeat); nTex.needsUpdate = true; }
    material.normalMap = nTex;
    material.normalScale = new T.Vector2(normalScale, normalScale);
  }
  if (!material.roughnessMap) {
    const rTex = repeat === 1 ? maps.roughnessMap : maps.roughnessMap.clone();
    if (repeat !== 1) { rTex.repeat.set(repeat, repeat); rTex.needsUpdate = true; }
    material.roughnessMap = rTex;
  }
  material.needsUpdate = true;
  return material;
}
