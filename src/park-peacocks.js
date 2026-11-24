import * as T from 'three';
import {Instances} from './city-geometry.js';
import {applyDetailMaps} from './procedural-textures.js';
import {buildSdfGeometry, smin, sdEllipsoid, sdTaperedCapsule, sdPolyline} from './sdf-mesh.js';

const post = new T.CylinderGeometry(1, 1, 1, 14);

function sampleCurve(controlPts, radii, samples = 14) {
  const curve = new T.CatmullRomCurve3(controlPts.map(p => new T.Vector3(...p)));
  const pts = [];
  const rads = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const v = curve.getPoint(t);
    pts.push([v.x, v.y, v.z]);
    const f = t * (radii.length - 1);
    const i0 = Math.floor(f), i1 = Math.min(radii.length - 1, i0 + 1);
    rads.push(radii[i0] + (radii[i1] - radii[i0]) * (f - i0));
  }
  return { pts, rads };
}

let cachedBodyGeo = null;
function peacockBodyGeometry() {
  if (cachedBodyGeo) return cachedBodyGeo;
  // Tightly bounded high-resolution SDF focused on the organic torso, graceful spline S-neck,
  // sculpted head and tapered beak (legs use crisp solid steel rods anchored cleanly to the deck).
  const h = 1.05;
  const { pts: neckPts, rads: neckRadii } = sampleCurve(
    [
      [0, h + 0.14, 0.72],
      [-0.06, h + 0.44, 0.95],
      [-0.11, h + 0.78, 0.87],
      [-0.085, h + 1.12, 0.77],
      [-0.04, h + 1.40, 0.84]
    ],
    [0.145, 0.088, 0.072, 0.066, 0.082],
    14
  );

  const sdf = (x, y, z) => {
    const torso = sdEllipsoid(x, y, z, 0, h + 0.12, 0.56, 0.23, 0.27, 0.52);
    const breast = sdEllipsoid(x, y, z, 0, h + 0.18, 0.74, 0.20, 0.23, 0.26);
    const rump = sdTaperedCapsule(x, y, z, 0, h + 0.08, 0.34, 0, h + 0.03, 0.14, 0.15, 0.075);
    const wingL = sdEllipsoid(x, y, z, -0.15, h + 0.13, 0.50, 0.105, 0.185, 0.40);
    const wingR = sdEllipsoid(x, y, z,  0.15, h + 0.13, 0.50, 0.105, 0.185, 0.40);
    const neck = sdPolyline(x, y, z, neckPts, neckRadii, 0.11);
    const head = sdEllipsoid(x, y, z, -0.04, h + 1.43, 0.86, 0.105, 0.098, 0.145);
    const beak = sdTaperedCapsule(x, y, z, -0.04, h + 1.43, 0.95, -0.04, h + 1.39, 1.15, 0.042, 0.014);
    let d = smin(torso, breast, 0.14);
    d = smin(d, rump, 0.13);
    d = smin(d, wingL, 0.085);
    d = smin(d, wingR, 0.085);
    d = smin(d, neck, 0.13);
    d = smin(d, head, 0.075);
    d = smin(d, beak, 0.04);
    return d;
  };
  // Compact vertical bounds (y: h-0.25 .. h+1.62) yields ~0.036m voxel step at res=48 -> silky smooth steel.
  cachedBodyGeo = buildSdfGeometry(sdf, [-0.32, h - 0.24, 0.05], [0.32, h + 1.60, 1.22], 48, 2.2);
  return cachedBodyGeo;
}

export function peacocks(group) {
  const steel = applyDetailMaps(
    new T.MeshStandardMaterial({ color: 0xe2e4da, roughness: 0.38, metalness: 0.58 }),
    'brushedMetal',
    { normalScale: 0.24, repeat: 2 }
  );
  const wire = new Instances(post, steel, '孔雀亭 · 双侧开屏钢羽');
  const bodyGeo = peacockBodyGeometry();

  for (const side of [-1, 1]) {
    const root = side * 1.26, h = 1.05;
    const pt = (w, y, z) => [root + side * w, y, z];
    const seg = (a, b, r) => wire.between(...a, ...b, r);

    const body = new T.Mesh(bodyGeo, steel);
    body.name = '孔雀亭 · SDF流线雕塑躯干';
    body.position.set(root, 0, 0);
    if (side < 0) {
      const mirrored = bodyGeo.clone();
      const pos = mirrored.attributes.position, norm = mirrored.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, -pos.getX(i));
        norm.setX(i, -norm.getX(i));
      }
      const idx = mirrored.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp;
      }
      mirrored.computeBoundingBox();
      mirrored.computeBoundingSphere();
      body.geometry = mirrored;
    }
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Solid stainless legs embedded cleanly from timber deck into the SDF torso
    for (const k of [-1, 1]) seg(pt(k * 0.09, 0.0, 0.45), pt(k * 0.09, h + 0.06, 0.54), 0.042);

    // Delicate crest plumes atop the sculpted head
    for (let k = -1; k <= 1; k++) seg(pt(-0.04, h + 1.50, 0.79), pt(-0.04 + k * 0.07, h + 1.74, 0.76), 0.012);

    // 21 radiating steel tail feathers with fine barbs
    for (let k = 0; k < 21; k++) {
      const t = k / 20, a = 0.17 + t * 1.58;
      const tip = pt(2.05 * Math.cos(a), h + 0.62 + 2.38 * Math.sin(a), -1.22 + 0.47 * t);
      const joint = pt(0.20 + 0.91 * Math.cos(a), h + 0.25 + 0.84 * Math.sin(a), -0.63);
      seg(pt(0, h, 0.22), joint, 0.019);
      seg(joint, tip, 0.017);
      for (let j = 1; j < 9; j++) {
        const u = j / 10, mid = joint.map((v, c) => T.MathUtils.lerp(v, tip[c], u)), reach = 0.16 * Math.sin(Math.PI * u);
        for (const s of [-1, 1]) {
          seg(mid, [mid[0] + side * s * reach * Math.sin(a), mid[1] - 0.16 - s * reach * Math.cos(a), mid[2] + 0.012], 0.007);
        }
      }
    }
  }
  wire.flush(group, true);
}
