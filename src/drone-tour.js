import * as T from 'three';

export const TOUR_ROUTES = [
  {
    id: 'bay-grand',
    nameZh: '深圳湾全景巡航',
    nameEn: 'Shenzhen Bay Grand Tour',
    duration: 72,
    closed: true,
    stops: [
      {
        eye: [248, 22, 200],
        target: [-210, 118, -320],
        fov: 54,
        titleZh: '人才星光桥 · 碧湖启航',
        titleEn: 'Starlight Bridge · Waterfront Takeoff',
      },
      {
        eye: [232, 34, -45],
        target: [-140, 88, -360],
        fov: 54,
        titleZh: '人才湖 · 湖岸花草字与双曲桥',
        titleEn: 'Talent Lake · Floral Emblem & Shuangqu Bridge',
      },
      {
        eye: [375, 115, -430],
        target: [100, 35, -780],
        fov: 50,
        titleZh: '海之门 · 深圳湾体育中心「春茧」',
        titleEn: 'Spring Cocoon · Shenzhen Bay Sports Center',
      },
      {
        eye: [360, 165, -860],
        target: [-145, 130, -550],
        fov: 50,
        titleZh: '春茧上空 · 湾区海天画卷',
        titleEn: 'Spring Cocoon Aerial · Bay Horizon',
      },
      {
        eye: [-20, 235, -830],
        target: [-263, 210, -456],
        fov: 48,
        titleZh: '中国华润大厦 · 春笋云端',
        titleEn: 'China Resources Tower · Chunsun Spire',
      },
      {
        eye: [-40, 145, -240],
        target: [-320, 155, -260],
        fov: 52,
        titleZh: '后海摩天群 · 湖岸天际线',
        titleEn: 'Houhai Towers · Waterfront Skyline',
      },
      {
        eye: [-140, 128, 225],
        target: [-675, 165, 480],
        fov: 50,
        titleZh: '深圳湾一号 · 碧波映华厦',
        titleEn: 'One Shenzhen Bay · Waterfront Towers',
      },
      {
        eye: [78, 52, 465],
        target: [-220, 115, -180],
        fov: 54,
        titleZh: 'π 桥 · 金波回环归航',
        titleEn: 'Pi Bridge · Golden Bay Return',
      },
    ],
  },
  {
    id: 'lake-lightshow',
    nameZh: '人才湖灯光秀环游',
    nameEn: 'Talent Lake Light Show Orbit',
    duration: 56,
    closed: true,
    stops: [
      {
        eye: [248, 20, 185],
        target: [-240, 115, -340],
        fov: 52,
        titleZh: '人才星光桥 · 璀璨启幕',
        titleEn: 'Starlight Bridge · Illuminated Start',
      },
      {
        eye: [340, 26, 65],
        target: [-250, 130, -210],
        fov: 46,
        titleZh: '东岸观景 · 全城联动灯光秀',
        titleEn: 'East Shore · Synchronized Light Show',
      },
      {
        eye: [265, 42, -165],
        target: [-255, 128, -320],
        fov: 50,
        titleZh: '湖岸花草字 · 流光水韵',
        titleEn: 'Floral Emblem · Shimmering Reflections',
      },
      {
        eye: [95, 58, -315],
        target: [-263, 150, -456],
        fov: 52,
        titleZh: '双曲桥 · 仰望金色春笋',
        titleEn: 'Shuangqu Bridge · Golden Chunsun',
      },
      {
        eye: [-130, 56, -245],
        target: [80, 32, 160],
        fov: 54,
        titleZh: '潮汐广场 · 环湖夜色',
        titleEn: 'Tidal Square · Lakeside Nightscape',
      },
      {
        eye: [-225, 48, 120],
        target: [-660, 155, 470],
        fov: 50,
        titleZh: '风帆塔与求贤阁 · 深圳湾一号',
        titleEn: 'Sail Tower · One Shenzhen Bay',
      },
      {
        eye: [-75, 42, 395],
        target: [-235, 120, -210],
        fov: 52,
        titleZh: 'π 桥 · 天际倒影',
        titleEn: 'Pi Bridge · Skyline Mirror',
      },
      {
        eye: [145, 30, 365],
        target: [-220, 118, -280],
        fov: 52,
        titleZh: '未来智汇廊桥 · 归航星光',
        titleEn: 'Future Skybridge · Return to Starlight',
      },
    ],
  },
  {
    id: 'tech-skyline',
    nameZh: '南山科技天际线',
    nameEn: 'Nanshan Tech Skyline',
    duration: 68,
    closed: true,
    stops: [
      {
        eye: [-1715, 140, -1085],
        target: [-1414, 130, -1344],
        fov: 48,
        titleZh: '腾讯滨海大厦 · 双塔三连廊',
        titleEn: 'Tencent Binhai · Dual Towers & Skybridges',
      },
      {
        eye: [-1520, 215, -1620],
        target: [-1410, 135, -1330],
        fov: 48,
        titleZh: '滨海大道 · 科技地标回眸',
        titleEn: 'Binhai Blvd · Tech Landmark Sweep',
      },
      {
        eye: [-1060, 225, -1180],
        target: [-1320, 85, -800],
        fov: 52,
        titleZh: '海岸城街区 · 空中步行连廊',
        titleEn: 'Coastal City · Elevated Skywalks',
      },
      {
        eye: [-760, 250, -860],
        target: [-263, 210, -456],
        fov: 50,
        titleZh: '后海总部基地 · 摩天森林',
        titleEn: 'Houhai HQ District · Skyscraper Forest',
      },
      {
        eye: [80, 255, -720],
        target: [-263, 190, -456],
        fov: 48,
        titleZh: '春笋与春茧 · 双地标同框',
        titleEn: 'Chunsun & Spring Cocoon · Dual Icons',
      },
      {
        eye: [160, 145, 80],
        target: [-460, 145, 140],
        fov: 52,
        titleZh: '人才湖东岸 · 湾区全景天际线',
        titleEn: 'Talent Lake · Full Bay Skyline',
      },
      {
        eye: [-320, 185, 580],
        target: [-685, 180, 520],
        fov: 48,
        titleZh: '深圳湾一号 · 滨海地标群',
        titleEn: 'One Shenzhen Bay · Waterfront Cluster',
      },
      {
        eye: [-1120, 255, -240],
        target: [-1380, 110, -960],
        fov: 52,
        titleZh: '科苑南路 · 飞返滨海科技轴',
        titleEn: 'Keyuan South Rd · Return to Binhai',
      },
    ],
  },
];

export const DEFAULT_TOUR_ID = TOUR_ROUTES[0].id;

export function getTourRoute(routeId) {
  return TOUR_ROUTES.find(r => r.id === routeId) || TOUR_ROUTES[0];
}

function buildSpline(route) {
  const eyePoints = route.stops.map(s => new T.Vector3(...s.eye));
  const targetPoints = route.stops.map(s => new T.Vector3(...s.target));
  const eyeCurve = new T.CatmullRomCurve3(eyePoints, route.closed !== false, 'centripetal');
  const targetCurve = new T.CatmullRomCurve3(targetPoints, route.closed !== false, 'centripetal');
  // Precompute arc-length fraction for each stop so chapter captions align with physical landmarks.
  const n = route.stops.length;
  const totalLen = eyeCurve.getLength();
  const cumLen = [0];
  const samples = n * 24;
  let prev = eyeCurve.getPoint(0);
  let acc = 0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = eyeCurve.getPoint(t);
    acc += cur.distanceTo(prev);
    prev = cur;
    if (i % 24 === 0) cumLen.push(acc / Math.max(1e-6, totalLen));
  }
  const stopU = cumLen.slice(0, n);
  return { route, eyeCurve, targetCurve, stopU };
}

function smoothFov(route, stopU, u) {
  const n = route.stops.length;
  let idx = n - 1;
  for (let i = 0; i < n; i++) {
    if (u >= stopU[i]) idx = i;
  }
  const nextIdx = (idx + 1) % n;
  const u0 = stopU[idx];
  const u1 = nextIdx === 0 ? 1 : stopU[nextIdx];
  const span = Math.max(1e-5, u1 - u0);
  const f = T.MathUtils.clamp((u - u0) / span, 0, 1);
  const s = f * f * (3 - 2 * f);
  return T.MathUtils.lerp(route.stops[idx].fov ?? 52, route.stops[nextIdx].fov ?? 52, s);
}

function activeStopIndex(stopU, u) {
  const n = stopU.length;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (u >= stopU[i]) idx = i;
  }
  return idx;
}

export function createDroneTour(city) {
  const cache = new Map();
  let active = false;
  let paused = false;
  let speed = 1;
  let progress = 0;
  let current = buildSpline(TOUR_ROUTES[0]);
  let currentStopIdx = 0;

  const pos = new T.Vector3();
  const target = new T.Vector3();
  const aheadPos = new T.Vector3();
  const behindPos = new T.Vector3();
  const tangent1 = new T.Vector3();
  const tangent2 = new T.Vector3();
  const lookMatrix = new T.Matrix4();
  const upVec = new T.Vector3(0, 1, 0);
  const bankQuat = new T.Quaternion();
  const rollAxis = new T.Vector3(0, 0, 1);
  let smoothedBank = 0;

  function loadSpline(routeId) {
    const route = getTourRoute(routeId);
    if (!cache.has(route.id)) cache.set(route.id, buildSpline(route));
    return cache.get(route.id);
  }

  function applyPose(camera, u, dt = 0) {
    const wrapped = ((u % 1) + 1) % 1;
    current.eyeCurve.getPointAt(wrapped, pos);
    current.targetCurve.getPointAt(wrapped, target);

    // Subtle ground-clearance safety floor so the drone never clips terrain/bridges.
    if (city?.groundHeight) {
      const floor = city.groundHeight(pos.x, pos.z, pos.y + 4) + 4.5;
      if (pos.y < floor) pos.y = floor;
    }

    // Compute gentle cinematic banking angle from horizontal turn curvature.
    const du = 0.004;
    current.eyeCurve.getPointAt(((wrapped - du) % 1 + 1) % 1, behindPos);
    current.eyeCurve.getPointAt(((wrapped + du) % 1 + 1) % 1, aheadPos);
    tangent1.subVectors(pos, behindPos).setY(0);
    tangent2.subVectors(aheadPos, pos).setY(0);
    let desiredBank = 0;
    if (tangent1.lengthSq() > 1e-6 && tangent2.lengthSq() > 1e-6) {
      tangent1.normalize();
      tangent2.normalize();
      const crossY = tangent1.x * tangent2.z - tangent1.z * tangent2.x;
      desiredBank = T.MathUtils.clamp(crossY * 0.85, -0.055, 0.055);
    }
    if (dt > 0) {
      smoothedBank = T.MathUtils.lerp(smoothedBank, desiredBank, 1 - Math.exp(-dt * 3.2));
    } else {
      smoothedBank = desiredBank;
    }

    camera.position.copy(pos);
    lookMatrix.lookAt(pos, target, upVec);
    camera.quaternion.setFromRotationMatrix(lookMatrix);
    if (Math.abs(smoothedBank) > 1e-5) {
      bankQuat.setFromAxisAngle(rollAxis, smoothedBank);
      camera.quaternion.multiply(bankQuat);
    }

    const fov = smoothFov(current.route, current.stopU, wrapped);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    currentStopIdx = activeStopIndex(current.stopU, wrapped);
  }

  function start(camera, routeId = DEFAULT_TOUR_ID, startProgress = 0) {
    current = loadSpline(routeId);
    active = true;
    paused = false;
    progress = ((startProgress % 1) + 1) % 1;
    smoothedBank = 0;
    applyPose(camera, progress, 0);
  }

  function stop() {
    active = false;
    paused = false;
  }

  function update(dt, camera) {
    if (!active) return;
    if (!paused) {
      progress = (progress + (dt * speed) / current.route.duration) % 1;
    }
    applyPose(camera, progress, paused ? 0 : dt);
  }

  function setProgress(u, camera) {
    progress = ((u % 1) + 1) % 1;
    if (active && camera) applyPose(camera, progress, 0);
  }

  function state() {
    const stopInfo = current.route.stops[currentStopIdx] || current.route.stops[0];
    return {
      active,
      paused,
      speed,
      progress,
      routeId: current.route.id,
      routeNameZh: current.route.nameZh,
      routeNameEn: current.route.nameEn,
      duration: current.route.duration,
      stopIndex: currentStopIdx,
      stopCount: current.route.stops.length,
      stopTitleZh: stopInfo.titleZh,
      stopTitleEn: stopInfo.titleEn,
    };
  }

  return {
    start,
    stop,
    update,
    setProgress,
    setPaused(v) { paused = !!v; },
    setSpeed(v) { speed = T.MathUtils.clamp(Number(v) || 1, 0.25, 3); },
    get active() { return active; },
    get paused() { return paused; },
    get speed() { return speed; },
    get progress() { return progress; },
    get routeId() { return current.route.id; },
    state,
  };
}
