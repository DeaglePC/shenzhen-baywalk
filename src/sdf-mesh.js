import * as T from 'three';

// Lightweight Signed Distance Field (SDF) modeling kit + Surface Nets mesh extractor.
// Inspired by Crimson Loong's 10_sdf.js: enables smooth organic sculptures & displaced rockwork
// directly from math without blocky primitive seams or heavy external GLB downloads.

export function smin(a, b, k = 0.12) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function smax(a, b, k = 0.12) {
  return -smin(-a, -b, k);
}

export function sdSphere(px, py, pz, cx, cy, cz, r) {
  return Math.hypot(px - cx, py - cy, pz - cz) - r;
}

export function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = Math.hypot(x / rx, y / ry, z / rz);
  if (k0 < 1e-6) return -Math.min(rx, ry, rz);
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k0 * (k0 - 1) / k1;
}

export function sdTaperedCapsule(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const ba2 = bax * bax + bay * bay + baz * baz || 1e-9;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / ba2));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.hypot(dx, dy, dz) - (ra + (rb - ra) * h);
}

export function sdRoundBox(px, py, pz, cx, cy, cz, bx, by, bz, r) {
  const qx = Math.abs(px - cx) - bx;
  const qy = Math.abs(py - cy) - by;
  const qz = Math.abs(pz - cz) - bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

export function sdPolyline(px, py, pz, pts, radii, blend = 0.08) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = sdTaperedCapsule(px, py, pz, a[0], a[1], a[2], b[0], b[1], b[2], radii[i], radii[i + 1]);
    d = i === 0 ? seg : smin(d, seg, blend);
  }
  return d;
}

const CUBE_EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

const CORNER_OFFSETS = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
];

/**
 * Extracts a smooth, watertight BufferGeometry from an analytical SDF using Surface Nets.
 * Vertices receive exact analytical SDF gradient normals and triplanar-friendly UVs.
 */
export function buildSdfGeometry(sdf, boundsMin, boundsMax, resolution = 36, uvScale = 1.6) {
  const [minX, minY, minZ] = boundsMin;
  const [maxX, maxY, maxZ] = boundsMax;
  const spanX = maxX - minX, spanY = maxY - minY, spanZ = maxZ - minZ;
  const maxSpan = Math.max(spanX, spanY, spanZ, 1e-4);
  const step = maxSpan / resolution;

  const nx = Math.max(4, Math.ceil(spanX / step) + 2);
  const ny = Math.max(4, Math.ceil(spanY / step) + 2);
  const nz = Math.max(4, Math.ceil(spanZ / step) + 2);

  const ox = minX - step, oy = minY - step, oz = minZ - step;
  const strideY = nx + 1, strideZ = (nx + 1) * (ny + 1);
  const field = new Float32Array((nx + 1) * (ny + 1) * (nz + 1));

  for (let z = 0; z <= nz; z++) {
    const wz = oz + z * step;
    for (let y = 0; y <= ny; y++) {
      const wy = oy + y * step;
      const base = z * strideZ + y * strideY;
      for (let x = 0; x <= nx; x++) {
        field[base + x] = sdf(ox + x * step, wy, wz);
      }
    }
  }

  const cellStrideY = nx, cellStrideZ = nx * ny;
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const positions = [];
  const normals = [];
  const uvs = [];
  const eps = step * 0.35;

  const cornerVals = new Float32Array(8);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = CORNER_OFFSETS[c];
          const v = field[(z + dz) * strideZ + (y + dy) * strideY + (x + dx)];
          cornerVals[c] = v;
          if (v < 0) mask |= (1 << c);
        }
        if (mask === 0 || mask === 255) continue;

        let sx = 0, sy = 0, sz = 0, count = 0;
        for (let e = 0; e < 12; e++) {
          const [c0, c1] = CUBE_EDGES[e];
          const v0 = cornerVals[c0], v1 = cornerVals[c1];
          if ((v0 < 0) === (v1 < 0)) continue;
          const t = v0 / (v0 - v1);
          const p0 = CORNER_OFFSETS[c0], p1 = CORNER_OFFSETS[c1];
          sx += p0[0] + (p1[0] - p0[0]) * t;
          sy += p0[1] + (p1[1] - p0[1]) * t;
          sz += p0[2] + (p1[2] - p0[2]) * t;
          count++;
        }
        if (!count) continue;

        let vx = ox + (x + sx / count) * step;
        let vy = oy + (y + sy / count) * step;
        let vz = oz + (z + sz / count) * step;

        // One Newton projection step snaps vertex tightly onto the exact zero isosurface.
        const d0 = sdf(vx, vy, vz);
        const gx = sdf(vx + eps, vy, vz) - sdf(vx - eps, vy, vz);
        const gy = sdf(vx, vy + eps, vz) - sdf(vx, vy - eps, vz);
        const gz = sdf(vx, vy, vz + eps) - sdf(vx, vy, vz - eps);
        const gLen = Math.hypot(gx, gy, gz) || 1e-6;
        const nxn = gx / gLen, nyn = gy / gLen, nzn = gz / gLen;
        const shift = Math.max(-step * 0.45, Math.min(step * 0.45, d0));
        vx -= nxn * shift;
        vy -= nyn * shift;
        vz -= nzn * shift;

        const vid = positions.length / 3;
        cellVert[z * cellStrideZ + y * cellStrideY + x] = vid;
        positions.push(vx, vy, vz);
        normals.push(nxn, nyn, nzn);

        // Dominant-axis triplanar UV projection for seamless procedural normal maps.
        const ax = Math.abs(nxn), ay = Math.abs(nyn), az = Math.abs(nzn);
        if (ay >= ax && ay >= az) uvs.push(vx * uvScale, vz * uvScale);
        else if (ax >= az) uvs.push(vz * uvScale, vy * uvScale);
        else uvs.push(vx * uvScale, vy * uvScale);
      }
    }
  }

  const indices = [];
  const pushQuad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) {
      indices.push(a, d, c, a, c, b);
    } else {
      indices.push(a, b, c, a, c, d);
    }
  };

  for (let z = 1; z < nz; z++) {
    for (let y = 1; y < ny; y++) {
      for (let x = 1; x < nx; x++) {
        const f0 = field[z * strideZ + y * strideY + x] < 0;
        const c000 = cellVert[z * cellStrideZ + y * cellStrideY + x];

        // X-aligned edge between (x, y, z) and (x + 1, y, z)
        if (x < nx) {
          const fx = field[z * strideZ + y * strideY + (x + 1)] < 0;
          if (f0 !== fx) {
            const c010 = cellVert[z * cellStrideZ + (y - 1) * cellStrideY + x];
            const c011 = cellVert[(z - 1) * cellStrideZ + (y - 1) * cellStrideY + x];
            const c001 = cellVert[(z - 1) * cellStrideZ + y * cellStrideY + x];
            pushQuad(c000, c010, c011, c001, !f0);
          }
        }
        // Y-aligned edge between (x, y, z) and (x, y + 1, z)
        if (y < ny) {
          const fy = field[z * strideZ + (y + 1) * strideY + x] < 0;
          if (f0 !== fy) {
            const c100 = cellVert[z * cellStrideZ + y * cellStrideY + (x - 1)];
            const c101 = cellVert[(z - 1) * cellStrideZ + y * cellStrideY + (x - 1)];
            const c001 = cellVert[(z - 1) * cellStrideZ + y * cellStrideY + x];
            pushQuad(c000, c001, c101, c100, !f0);
          }
        }
        // Z-aligned edge between (x, y, z) and (x, y, z + 1)
        if (z < nz) {
          const fz = field[(z + 1) * strideZ + y * strideY + x] < 0;
          if (f0 !== fz) {
            const c100 = cellVert[z * cellStrideZ + y * cellStrideY + (x - 1)];
            const c110 = cellVert[z * cellStrideZ + (y - 1) * cellStrideY + (x - 1)];
            const c010 = cellVert[z * cellStrideZ + (y - 1) * cellStrideY + x];
            pushQuad(c000, c100, c110, c010, !f0);
          }
        }
      }
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
