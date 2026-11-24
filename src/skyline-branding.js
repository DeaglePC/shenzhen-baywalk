import * as T from 'three';
import {area, bounds} from './city-geometry.js';

// Real-world Shenzhen Houhai & High-Tech South CBD skyscraper rooftop branding
// + synchronized red aviation obstruction beacons on 120m+ towers.

function makeLogoTexture(spec) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);

  // Subtle dark mounting backing bar behind signage for crisp daytime legibility
  if (spec.backing) {
    g.fillStyle = spec.backing;
    g.fillRect(24, 26, 976, 204);
  }

  g.textBaseline = 'middle';
  const style = spec.style || 'text';

  if (style === 'baidu') {
    // Iconic Baidu blue wordmark + crimson paw emblem + "百度"
    g.fillStyle = '#2932e1';
    g.font = 'bold 138px Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('Bai', 42, 134);
    // Stylized crimson-red paw print in center-left
    g.fillStyle = '#e10602';
    const px = 315, py = 148;
    // Main pad
    g.beginPath();
    g.ellipse(px, py + 12, 34, 26, 0, 0, Math.PI * 2);
    g.fill();
    // 4 toe pads
    for (const [ox, oy, rx, ry, rot] of [
      [-36, -24, 12, 18, -0.35],
      [-13, -40, 12, 19, -0.12],
      [ 14, -40, 12, 19,  0.12],
      [ 37, -24, 12, 18,  0.35]
    ]) {
      g.save();
      g.translate(px + ox, py + oy);
      g.rotate(rot);
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = '#2932e1';
    g.fillText('du', 378, 134);
    g.font = 'bold 132px "Microsoft YaHei", sans-serif';
    g.fillText('百度', 575, 132);
  } else if (style === 'casc') {
    // China Aerospace Science and Technology Corporation (中国航天)
    g.strokeStyle = '#1b72d6';
    g.lineWidth = 14;
    g.beginPath();
    g.ellipse(126, 128, 72, 42, -0.32, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#f2f6fa';
    g.font = 'bold 58px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('CASC', 126, 132);
    g.textAlign = 'left';
    g.font = 'bold 116px "Microsoft YaHei", sans-serif';
    g.fillText(spec.title, 234, 108, 750);
    g.fillStyle = '#a8cdf5';
    g.font = '600 44px Arial, sans-serif';
    g.fillText(spec.sub || 'CHINA AEROSPACE', 238, 188, 740);
  } else if (style === 'scgc') {
    // Shenzhen Capital Group (深创投广场)
    g.fillStyle = '#d9312a';
    g.fillRect(36, 48, 138, 152);
    g.fillStyle = '#ffffff';
    g.font = 'bold 50px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('SCGC', 105, 128);
    g.textAlign = 'left';
    g.fillStyle = '#f6f7f5';
    g.font = 'bold 124px "Microsoft YaHei", sans-serif';
    g.fillText(spec.title, 205, 114, 780);
    g.fillStyle = '#d4dde3';
    g.font = '600 40px Arial, sans-serif';
    g.fillText(spec.sub || 'SHENZHEN CAPITAL GROUP', 208, 190, 770);
  } else if (style === 'minmetals') {
    // China Minmetals (中国五矿)
    g.fillStyle = '#125fb8';
    g.beginPath();
    g.arc(110, 128, 66, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(72, 154); g.lineTo(94, 96); g.lineTo(110, 136); g.lineTo(126, 96); g.lineTo(148, 154);
    g.stroke();
    g.fillStyle = '#f7f8f6';
    g.textAlign = 'left';
    g.font = 'bold 118px "Microsoft YaHei", sans-serif';
    g.fillText(spec.title, 208, 108, 770);
    g.fillStyle = '#c5dcf5';
    g.font = '600 46px Arial, sans-serif';
    g.fillText(spec.sub || 'CHINA MINMETALS', 210, 188, 760);
  } else if (style === 'cr') {
    // China Resources Vanguard / CR Plaza (华润万家 / 华润)
    g.fillStyle = '#e87a1e';
    g.beginPath();
    g.arc(108, 128, 62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('CR', 108, 132);
    g.textAlign = 'left';
    g.fillStyle = '#fff5ea';
    g.font = 'bold 122px "Microsoft YaHei", sans-serif';
    g.fillText(spec.title, 202, 112, 780);
    g.fillStyle = '#ffd09c';
    g.font = '600 44px Arial, sans-serif';
    g.fillText(spec.sub || 'CR VANGUARD', 206, 188, 760);
  } else if (style === 'sunshine') {
    // Sunshine Insurance Financial Tower (阳光金融)
    g.fillStyle = '#f28b1d';
    g.beginPath();
    g.arc(108, 128, 56, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff4e0';
    g.beginPath();
    g.arc(108, 128, 28, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = '#ffdfb0';
    g.font = 'bold 118px "Microsoft YaHei", sans-serif';
    g.fillText(spec.title, 198, 112, 790);
    g.fillStyle = '#f5b058';
    g.font = '600 44px Arial, sans-serif';
    g.fillText(spec.sub || 'SUNSHINE INSURANCE', 202, 188, 780);
  } else if (style === 'luxury') {
    // Elegant gold/ivory serif wordmark (Raffles / BVLGARI / Rui Fu)
    g.fillStyle = spec.color || '#f4dfaf';
    g.textAlign = 'center';
    g.font = '600 124px Georgia, "Times New Roman", serif';
    g.fillText(spec.title, 512, spec.sub ? 104 : 132, 940);
    if (spec.sub) {
      g.font = '500 52px "Microsoft YaHei", sans-serif';
      g.fillText(spec.sub, 512, 196, 900);
    }
  } else {
    // Crisp modern corporate wordmark with optional red/blue accent
    g.fillStyle = spec.color || '#f4f6f5';
    g.textAlign = 'center';
    g.font = `bold ${spec.sub ? 116 : 136}px "Microsoft YaHei", Arial, sans-serif`;
    g.fillText(spec.title, 512, spec.sub ? 102 : 132, 950);
    if (spec.sub) {
      g.fillStyle = spec.subColor || '#cfdce6';
      g.font = '600 50px Arial, sans-serif';
      g.fillText(spec.sub, 512, 192, 920);
    }
  }

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Verified GIS building ID -> authentic Shenzhen Houhai / High-Tech South corporate headquarters
const TOWER_BRANDS = new Map([
  // Baidu International Building East & West Towers (百度国际大厦)
  [533466842,  { title: 'Baidu 百度', style: 'baidu', width: 34, yFrac: 0.945, faces: 2 }],
  [1302690654, { title: 'Baidu 百度', style: 'baidu', width: 28, yFrac: 0.945, faces: 2 }],
  [533466843,  { title: 'Baidu 百度', style: 'baidu', width: 30, yFrac: 0.942, faces: 2 }],

  // Shenzhen Capital Group Plaza (深创投广场 261m)
  [1190833384, { title: '深创投广场', sub: 'SCGC PLAZA', style: 'scgc', width: 34, yFrac: 0.955, faces: 2 }],

  // China Aerospace Science & Technology Plaza A & B (航天科技广场 232m / 130m)
  [737426464,  { title: '中国航天', sub: 'CASC AEROSPACE PLAZA', style: 'casc', width: 34, yFrac: 0.955, faces: 2 }],
  [737426462,  { title: '中国航天', sub: 'CASC', style: 'casc', width: 24, yFrac: 0.948, faces: 1 }],

  // China Resources Vanguard / Wanjia Tower right next to Chun Sun (万家大厦 145m)
  [529272471,  { title: '华润万家', sub: 'CR VANGUARD', style: 'cr', width: 28, yFrac: 0.948, faces: 2 }],

  // China Resources Rui Fu & BVLGARI Residences flanking Chun Sun (瑞府 246m / 宝格丽 154m)
  [529272469,  { title: 'RUI FU', sub: '深 圳 湾 瑞 府', style: 'luxury', color: '#f3dfb2', width: 26, yFrac: 0.962, faces: 2 }],
  [782988197,  { title: 'BVLGARI', sub: '宝 格 丽', style: 'luxury', color: '#f7e5bc', width: 24, yFrac: 0.952, faces: 2 }],

  // One Shenzhen Bay T7 Raffles (深圳湾一号 · 莱佛士 341m)
  [1274780082, { title: 'RAFFLES', sub: '深圳湾一号 · 莱佛士', style: 'luxury', color: '#f8e6bd', width: 32, yFrac: 0.968, faces: 2 }],

  // Sunshine Insurance Financial Tower (阳光金融大厦 150m)
  [1190833396, { title: '阳光金融', sub: 'SUNSHINE INSURANCE', style: 'sunshine', width: 28, yFrac: 0.948, faces: 2 }],

  // China Minmetals Financial Tower (五矿金融大厦 146m)
  [1190833393, { title: '中国五矿', sub: 'CHINA MINMETALS', style: 'minmetals', width: 28, yFrac: 0.948, faces: 2 }],

  // Yihua Financial Tech Tower (怡化金融科技大厦 147m, north of Tencent)
  [522136906,  { title: '怡化金融科技', sub: 'YIHUA FINTECH', color: '#6ec4ff', subColor: '#e4f1fb', width: 28, yFrac: 0.948, faces: 2 }],

  // Pengrunda Plaza & Hyde Hotel (鹏润达商业广场 & 深圳海德酒店 163m)
  [737426474,  { title: '鹏润达广场', sub: 'PENGRUNDA PLAZA', color: '#f6f3e8', width: 28, yFrac: 0.950, faces: 2 }],
  [737426475,  { title: '海德酒店', sub: 'HYDE HOTEL', style: 'luxury', color: '#f4dfb0', width: 24, yFrac: 0.948, faces: 2 }],

  // China Overseas Building (中国海外大厦 100m, COLI)
  [1280746892, { title: '中国海外', sub: 'CHINA OVERSEAS', color: '#e6f2fa', subColor: '#99c9f0', width: 24, yFrac: 0.935, faces: 2 }],

  // Rainbow Headquarters (天虹总部大厦 97m)
  [736645104,  { title: '天虹总部', sub: 'RAINBOW', color: '#ff944d', subColor: '#fff2e4', width: 26, yFrac: 0.938, faces: 2 }],

  // Shunyuan Financial Tower (舜远金融大厦 119m)
  [737426471,  { title: '舜远金融', sub: 'SHUNYUAN', color: '#f2e4c4', width: 24, yFrac: 0.945, faces: 2 }],

  // Mangocity Tower & Topway Cable (芒果网大厦 100m / 天威视讯 109m)
  [522136905,  { title: '港中旅 · 芒果网', sub: 'MANGOCITY', color: '#ffad33', width: 24, yFrac: 0.938, faces: 2 }],
  [775709498,  { title: '天威视讯', sub: 'TOPWAY', color: '#67b8ff', width: 24, yFrac: 0.940, faces: 2 }],

  // Houhai Super-Tall Commercial Landmarks (中洲控股 314m / 卓越后海 210m / 深圳湾软件基地 / 中国储能大厦 289m)
  [1190750263, { title: '中洲控股', sub: 'CENTRALCON', style: 'luxury', color: '#f5e1b5', width: 34, yFrac: 0.962, faces: 2 }],
  [737426466,  { title: '卓越后海中心', sub: 'EXCELLENCE HOUHAI', color: '#f4f6f5', subColor: '#b7d4ee', width: 30, yFrac: 0.954, faces: 2 }],
  [522136909,  { title: '深圳湾科技生态', sub: 'SHENZHEN BAY TECH', color: '#e8f3fa', subColor: '#8cc7f7', width: 30, yFrac: 0.952, faces: 2 }],
  [533466840,  { title: '高新南总部中心', sub: 'HI-TECH SOUTH HQ', color: '#f2f5f7', subColor: '#9fd0f5', width: 30, yFrac: 0.956, faces: 2 }],
  [489106865,  { title: '中国储能大厦', sub: 'CHINA ENERGY STORAGE', color: '#e6f5ee', subColor: '#7ee0b0', width: 36, yFrac: 0.958, faces: 2 }],

  // Coastal City Complex (海岸城建筑群: 海岸大厦东/西座、天利中央广场、凯宾斯基、保利大厦、海岸城购物中心、保利文化广场)
  [785873826,  { title: '海岸大厦 · 东座', sub: 'COASTAL TOWER EAST', style: 'luxury', color: '#f7e4b4', width: 30, yFrac: 0.948, faces: 2 }],
  [785873827,  { title: '海岸大厦 · 西座', sub: 'COASTAL TOWER WEST', style: 'luxury', color: '#f7e4b4', width: 30, yFrac: 0.948, faces: 2 }],
  [785873830,  { title: '天利中央广场', sub: 'TIANLI CENTRAL PLAZA', color: '#f3f6f8', subColor: '#9fd0f5', width: 30, yFrac: 0.948, faces: 2 }],
  [249520146,  { title: 'KEMPINSKI', sub: '深圳凯宾斯基酒店', style: 'luxury', color: '#f8e6bd', width: 30, yFrac: 0.952, faces: 2 }],
  [376393437,  { title: '保利大厦', sub: 'POLY PLAZA', color: '#f6f2e4', subColor: '#f2b866', width: 28, yFrac: 0.948, faces: 2 }],
  [785873831,  { title: '海岸城广场', sub: 'COASTAL CITY', color: '#fff3d6', subColor: '#f5b856', width: 24, yFrac: 0.935, faces: 2 }],
  [-10744156,  { title: '海岸城购物中心', sub: 'COASTAL CITY MALL', backing: 'rgba(22,30,38,0.82)', color: '#fff2d2', subColor: '#f5b856', width: 26, yFrac: 0.87, faces: 3 }],
  [235150406,  { title: '保利文化广场', sub: 'POLY CULTURAL PLAZA', backing: 'rgba(20,30,44,0.82)', color: '#f6f4ec', subColor: '#f2be5c', width: 28, yFrac: 0.86, faces: 3 }]
]);

function selectTowerFaces(f, maxFaces = 2) {
  const ring = area(f.p) > 0 ? f.p : f.p.slice().reverse();
  const candidates = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 12) continue;
    const nx = (bz - az) / len, nz = (ax - bx) / len;
    const x = (ax + bx) * 0.5, z = (az + bz) * 0.5;
    // Prefer faces looking toward Talent Park lakefront & main Houhai avenues
    const toPark = (nx * (-60 - x) + nz * (-200 - z)) / Math.max(1, Math.hypot(-60 - x, -200 - z));
    candidates.push({ x, z, nx, nz, len, yaw: Math.atan2(nx, nz), score: len * 0.04 + toPark });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen = [];
  for (const c of candidates) {
    // Pick distinct opposing / perpendicular elevations so opposite viewing angles show signage
    if (chosen.every(o => (o.nx * c.nx + o.nz * c.nz) < 0.35)) {
      chosen.push(c);
      if (chosen.length >= maxFaces) break;
    }
  }
  return chosen;
}

export function buildSkylineBranding(root, map, m) {
  const group = new T.Group();
  group.name = '后海CBD · 摩天楼企业字标与航空障碍灯';
  root.add(group);

  const texCache = new Map();
  const bracketMat = new T.MeshStandardMaterial({ color: 0x3a4348, roughness: 0.45, metalness: 0.65 });
  const bracketGeo = new T.BoxGeometry(1, 0.22, 0.46);
  const brackets = [];

  // 1. Mount multi-sided illuminated corporate rooftop logos
  for (const f of map.buildings) {
    const spec = TOWER_BRANDS.get(Number(f.id));
    if (!spec || f.h < 20) continue;
    const key = `${spec.style || 'text'}|${spec.title}|${spec.sub || ''}|${spec.color || ''}`;
    let tex = texCache.get(key);
    if (!tex) {
      tex = makeLogoTexture(spec);
      texCache.set(key, tex);
    }
    const mat = new T.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.14,
      transparent: true,
      alphaTest: 0.12,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -3,
      roughness: 0.42,
      metalness: 0.14
    });
    // Glow brightly at dusk & night while staying legible in bright daylight
    m.parkLights.finish(mat, 1.45, 0.22);

    const faces = selectTowerFaces(f, spec.faces || 2);
    for (const face of faces) {
      const w = Math.min(face.len * 0.88, spec.width || 28);
      const h = w * 0.25;
      const y = f.h * (spec.yFrac || 0.95);
      const off = 0.62;
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
      mesh.name = `企业楼顶字标 · ${spec.title}`;
      mesh.position.set(face.x + face.nx * off, y, face.z + face.nz * off);
      mesh.rotation.y = face.yaw;
      group.add(mesh);

      // Subtle steel mounting rail behind each sign
      brackets.push({ x: face.x + face.nx * 0.34, y: y - h * 0.28, z: face.z + face.nz * 0.34, w: w * 0.82, yaw: face.yaw });
    }
  }

  if (brackets.length) {
    const inst = new T.InstancedMesh(bracketGeo, bracketMat, brackets.length);
    inst.name = '楼顶字标钢结构支架';
    const M = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), S = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
    brackets.forEach((b, i) => {
      P.set(b.x, b.y, b.z);
      Q.setFromAxisAngle(Y, b.yaw);
      S.set(b.w, 1, 1);
      M.compose(P, Q, S);
      inst.setMatrixAt(i, M);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  // 2. Pulsing red aviation obstruction beacons atop all 115m+ towers in the city
  const beaconPositions = [];
  const beaconPhases = [];
  for (const f of map.buildings) {
    if (f.h < 115 || !f.p?.length) continue;
    const b = bounds(f.p);
    const cx = (b[0] + b[2]) * 0.5, cz = (b[1] + b[3]) * 0.5;
    if (Math.hypot(cx, cz) > 3200) continue;
    // Place beacons on up to 2 opposite rooftop corners for high-rise authenticity
    const corners = [f.p[0], f.p[Math.floor(f.p.length * 0.5)]];
    const phase = (Math.abs(Number(f.id)) % 97) * 0.065;
    for (const [px, pz] of corners) {
      const ix = cx + (px - cx) * 0.86;
      const iz = cz + (pz - cz) * 0.86;
      beaconPositions.push(ix, f.h + 1.4, iz);
      beaconPhases.push(phase);
    }
  }

  let beaconMat = null;
  if (beaconPositions.length) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(beaconPositions, 3));
    geo.setAttribute('aPhase', new T.Float32BufferAttribute(beaconPhases, 1));
    beaconMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uNight: { value: 0 }
      },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aPhase;
        uniform float uTime, uNight;
        varying float vGlow;
        void main(){
          float pulse = pow(.5 + .5 * sin(uTime * 2.1 + aPhase * 6.283), 2.4);
          vGlow = (.28 + .72 * pulse) * smoothstep(.18, .75, uNight);
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          gl_Position = projectionMatrix * mv;
          float dist = max(12., -mv.z);
          gl_PointSize = clamp(2400. / dist, 4.5, 16.) * (.75 + .25 * pulse);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying float vGlow;
        void main(){
          if(vGlow < .02) discard;
          #include <logdepthbuf_fragment>
          float d = length(gl_PointCoord - .5) * 2.;
          if(d > 1.) discard;
          float core = exp(-7. * d * d);
          float halo = exp(-2.4 * d * d) * .55;
          vec3 col = mix(vec3(1.8, .12, .08), vec3(2.8, .55, .35), core);
          gl_FragColor = vec4(col * vGlow, clamp((core + halo) * vGlow, 0., 1.));
        }`
    });
    const pts = new T.Points(geo, beaconMat);
    pts.name = '超高层楼顶 · 红色航空障碍闪光灯';
    pts.frustumCulled = false;
    group.add(pts);
  }

  return {
    update(time) {
      if (beaconMat) beaconMat.uniforms.uTime.value = time;
    },
    setNight(night) {
      if (beaconMat) beaconMat.uniforms.uNight.value = night;
    }
  };
}
