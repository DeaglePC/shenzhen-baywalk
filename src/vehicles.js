import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {loadHeroTaxi} from './vehicle-hero.js';

// All meshes face +Z. The body width excludes mirrors, the e6 height excludes its taxi sign.
export const VEHICLE_CATALOG = [
  { id: 'e6', name: '比亚迪 e6 深圳出租车', size: [4.56, 1.822, 1.63], wheelbase: 2.83, radius: .326, colors: ['#247DC9'] },
  { id: 'model3', name: '特斯拉 Model 3', size: [4.72, 1.85, 1.44], wheelbase: 2.875, radius: .337, colors: ['#B9C1CB', '#D4DADA', '#333D49', '#933335'] },
  { id: 'tang', name: '比亚迪 唐', size: [4.87, 1.95, 1.725], wheelbase: 2.82, radius: .373, colors: ['#324C5F', '#D7D8D1', '#48545F', '#53383C'] },
  { id: 'mifa9', name: '上汽大通 大家9', size: [5.27, 2, 1.84], wheelbase: 3.2, radius: .354, colors: ['#70596B', '#505D6A', '#C7C1B2', '#343B42'] },
  { id: 'civic', name: '东风本田 思域', size: [4.685, 1.802, 1.415], wheelbase: 2.735, radius: .324, colors: ['#B73337', '#DFDCDA', '#344558', '#979B9D'] },
  { id: 'mini', name: '五菱 宏光 MINI EV', size: [2.92, 1.493, 1.621], wheelbase: 1.94, radius: .267, colors: ['#92BFAD', '#D8C4BA', '#BAD2D8', '#C6C2D7'] },
];

const UP = new THREE.Vector3(0, 1, 0);
const AXLE = new THREE.Vector3(1, 0, 0);
const ROAD = /^(primary|secondary|tertiary|trunk|residential|unclassified|living_street|service)(_link)?$/;
const modelPath = id => `${import.meta.env.BASE_URL}models/${id}.glb`;
const pointId = p => p.join(',');

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function createNetwork(roads) {
  const usable = roads.filter(r => ROAD.test(r.kind) && !r.bridge && !r.tunnel && !r.layer && r.width >= 3.4);
  const hits = new Map();
  for (const road of usable) {
    for (const key of new Set(road.p.map(pointId))) hits.set(key, (hits.get(key) || 0) + 1);
  }
  const exits = new Map();
  const lanes = [];
  function add(pts, road, reverse) {
    const points = reverse ? [...pts].reverse() : pts;
    const lengths = [0], headings = [];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i - 1][0], dz = points[i][1] - points[i - 1][1];
      const len = Math.hypot(dx, dz);
      lengths.push(lengths[i - 1] + len);
      headings.push([dx / len, dz / len]);
    }
    const length = lengths.at(-1);
    if (length < 1.5) return;
    const lane = { road, points, lengths, headings, length, end: pointId(points.at(-1)), start: pointId(points[0]), id: lanes.length };
    lanes.push(lane);
    if (!exits.has(lane.start)) exits.set(lane.start, []);
    exits.get(lane.start).push(lane);
  }
  for (const road of usable) {
    let pts = [road.p[0]];
    for (let i = 1; i < road.p.length; i++) {
      if (pointId(road.p[i]) === pointId(pts.at(-1))) continue;
      pts.push(road.p[i]);
      if (i !== road.p.length - 1 && hits.get(pointId(road.p[i])) < 2) continue;
      add(pts, road, false);
      if (!road.oneway) add(pts, road, true);
      pts = [road.p[i]];
    }
  }
  return { lanes, exits };
}

function sampleLane(car) {
  const { lane, s } = car;
  let i = car.segment;
  while (i + 1 < lane.headings.length && lane.lengths[i + 1] < s) i++;
  while (i > 0 && lane.lengths[i] > s) i--;
  car.segment = i;
  const [dx, dz] = lane.headings[i];
  const d = s - lane.lengths[i];
  let hx = dx, hz = dz;
  // Ease the visual steering before and after a mapped bend.
  const previous = lane.headings[i - 1], next = lane.headings[i + 1];
  const remaining = lane.lengths[i + 1] - s;
  if (d < 3 && previous) {
    const a = .5 * (1 - d / 3);
    hx += (previous[0] - dx) * a; hz += (previous[1] - dz) * a;
  } else if (remaining < 3 && next) {
    const a = .5 * (1 - remaining / 3);
    hx += (next[0] - dx) * a; hz += (next[1] - dz) * a;
  }
  const offset = car.kerb ?? (lane.road.oneway ? (lane.road.lanes > 1 ? .75 : 0) : Math.min(3.1, lane.road.width * .23));
  car.x = lane.points[i][0] + dx * d - hz * offset;
  car.z = lane.points[i][1] + dz * d + hx * offset;
  car.yaw = Math.atan2(hx, hz);
}

function nextLane(lane, exits, random) {
  const choices = exits.get(lane.end) || [];
  let result, score = -Infinity;
  const incoming = lane.headings.at(-1);
  for (const candidate of choices) {
    const dir = candidate.headings[0];
    const continuity = dir[0] * incoming[0] + dir[1] * incoming[1];
    const rank = continuity + random() * 1.2 - (candidate.end === lane.start ? 2.3 : 0);
    if (rank > score) { result = candidate; score = rank; }
  }
  return result;
}

function makeTraffic(data, options) {
  const random = randomGenerator(20261121);
  const network = createNetwork(data.roads);
  const cars = [], distribution = [0, 0, 0, 1, 1, 2, 2, 3, 4, 4, 5];
  function vehicle(lane, s, parked, model, fixedColor = false) {
    const def = VEHICLE_CATALOG[model];
    return {
      model, lane, s, parked, segment: 0, wheel: random() * Math.PI,
      color: new THREE.Color(def.colors[fixedColor ? 0 : Math.floor(random() * def.colors.length)]),
      cruise: (lane?.road.kind === 'service' ? 3 : lane?.road.kind === 'residential' ? 6 : 8) + random() * 3.6,
      speed: 4, x: 0, z: 0, yaw: 0,
    };
  }
  for (const lane of network.lanes) {
    const rd = lane.road;
    const spacing = rd.kind === 'service' ? 205 : rd.kind === 'residential' ? 134 : 91;
    for (let s = 4 + random() * spacing; s < lane.length - 4; s += spacing * (.75 + random() * .55)) {
      const model = distribution[Math.floor(random() * distribution.length)];
      const car = vehicle(lane, s, false, model);
      sampleLane(car); cars.push(car);
    }
    if (!['residential', 'tertiary', 'unclassified', 'service'].includes(rd.kind) || rd.width < 6 || lane.length < 36 || random() > .47) continue;
    for (let s = 12 + random() * 22; s < lane.length - 11; s += 16 + random() * 42) {
      const car = vehicle(lane, s, true, Math.floor(random() * 6));
      car.kerb = Math.max(1.5, rd.width / 2 - 1.06);
      sampleLane(car); cars.push(car);
    }
  }
  const hero = { x: -126.8, z: -420.7, yaw: Math.atan2(.30, -.954), model: 'e6' };
  const spots = options.parkedSpots?.length ? options.parkedSpots : [hero];
  let heroCar;
  for (const spot of spots) {
    const index = VEHICLE_CATALOG.findIndex(m => m.id === spot.model);
    const car = vehicle(null, 0, true, Math.max(0, index), true);
    Object.assign(car, { x: spot.x, z: spot.z, yaw: spot.yaw || 0, y: spot.y });
    cars.push(car);
    if (!heroCar && spot.model === 'e6') heroCar=car;
  }
  const occupancy = new Map();
  let queueAge=1;
  let moving=[];
  return {
    cars,heroCar,
    step(dt,eye,horizon) {
      queueAge+=dt;
      if (queueAge>=.22) {
        queueAge=0; occupancy.clear(); moving=[];
        const limit=(horizon+96)**2;
        for (const c of cars) {
          if (c.parked || (c.x-eye.x)**2+(c.z-eye.z)**2>limit) continue;
          moving.push(c);
          if (!occupancy.has(c.lane.id)) occupancy.set(c.lane.id, []);
          occupancy.get(c.lane.id).push(c);
        }
        for (const group of occupancy.values()) {
          group.sort((a, b) => b.s - a.s);
          for (let i=0;i<group.length;i++) group[i].leader=group[i-1];
        }
      }
      for (const c of moving) {
          if(c.parked) continue;
          const leader=c.leader;
          const free = leader?.lane === c.lane ? Math.max(0, leader.s - c.s - 5.7) : Infinity;
          const desired = Math.min(c.cruise, free * .62);
          c.speed += THREE.MathUtils.clamp(desired - c.speed, -4.8 * dt, 2 * dt);
          const travel = Math.max(0, Math.min(c.speed * dt, free));
          c.s += travel;
          if (c.s >= c.lane.length) {
            const next = nextLane(c.lane, network.exits, random);
            if (!next) { c.parked = true; c.s = c.lane.length - .2; }
            else { c.s = Math.min(c.s - c.lane.length, next.length); c.lane = next; c.segment = 0; }
          }
          c.wheel = (c.wheel + travel / VEHICLE_CATALOG[c.model].radius) % (Math.PI * 2);
          sampleLane(c);
      }
    },
  };
}

// Preserve each material's physical response with one instanced body draw per type.
function packMeshes(parts) {
  const chunks = [];
  for (const { mesh, matrix } of parts) {
    const original = mesh.geometry;
    const g = original.clone();
    g.applyMatrix4(matrix);
    const mat = mesh.material, count = g.attributes.position.count;
    const paint = mat.name === 'Body paint';
    const col = paint ? new THREE.Color(1, 1, 1) : mat.color;
    const colors = new Float32Array(count * 3), surface = new Float32Array(count * 4);
    const glow = mat.emissive ? Math.max(mat.emissive.r, mat.emissive.g, mat.emissive.b) * mat.emissiveIntensity : 0;
    for (let i = 0; i < count; i++) {
      col.toArray(colors, i * 3);
      surface.set([mat.metalness ?? 0, mat.roughness ?? .5, glow, +paint], i * 4);
    }
    for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    if (!g.index) g.setIndex(Array.from({ length: count }, (_, i) => i));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('vehicleSurface', new THREE.BufferAttribute(surface, 4));
    chunks.push(g);
  }
  const joined = mergeGeometries(chunks);
  for (const g of chunks) g.dispose();
  return joined;
}

function fleetMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .3 });
  const night = { value: .5 };
  mat.onBeforeCompile = shader => {
    shader.uniforms.vehicleNight = night;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute vec4 vehicleSurface; varying vec4 vVehicleSurface;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        vVehicleSurface = vehicleSurface;
        vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, vehicleSurface.w);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec4 vVehicleSurface; uniform float vehicleNight;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vVehicleSurface.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vVehicleSurface.x;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += diffuseColor.rgb * vVehicleSurface.z * vehicleNight;');
  };
  return { mat, night };
}

function distantShape(spec) {
  const [l,w,h] = spec.size, short = ['mini','mifa9','e6','tang'].includes(spec.id);
  const p = [], c = [], surf = [];
  const glass = new THREE.Color('#334A59'), rubber = new THREE.Color('#292B2C');
  const blue = new THREE.Color('#247DC9'), white = new THREE.Color('#E9EBE9');
  const led=new THREE.Color('#E6EFF6'), tail=new THREE.Color('#D8252E');
  function face(a,b,d,e,kind='paint') {
    const color = kind==='lamp'?led:kind==='tail'?tail:kind === 'paint' || kind === 'white' ? white : kind === 'glass' ? glass : kind === 'blue' ? blue : rubber;
    for (const v of [a,b,d,a,d,e]) { p.push(...v); c.push(color.r,color.g,color.b); surf.push(.3,.35,kind==='lamp'||kind==='tail'?.85:0,kind === 'paint' ? 1 : 0); }
  }
  const taxi = spec.id === 'e6';
  const stations = [[-.5,.83,.53],[-.43,.97,.63],[-.30,1,.64],[.22,1,.63],[.41,.97,.57],[.5,.81,.47]];
  function side(k,i,z) { const [t,ww,hh] = stations[i]; return [k*w*ww/2,z ?? h*hh,t*l]; }
  for (let i=0; i<stations.length-1; i++) {
    for (const k of [-1,1]) face(side(k,i,.18),side(k,i+1,.18),side(k,i+1),side(k,i),taxi ? 'white':'paint');
    face(side(-1,i),side(1,i),side(1,i+1),side(-1,i+1));
  }
  for (const i of [0,stations.length-1]) face(side(-1,i,.18),side(1,i,.18),side(1,i),side(-1,i),taxi?'white':'paint');
  for (const k of [-1,1]) for (const direction of [-1,1]) {
    const z=direction*(l*.5+.005), y=h*(direction>0?.415:.463);
    face([k*w*.238,y,z],[k*w*.385,y+.007,z],[k*w*.395,y+.045,z],[k*w*.235,y+.028,z],direction>0?'lamp':'tail');
  }
  const cabin = [[short?-.46:-.38,.45,.61],[short?-.37:-.17,.38,.96],[.08,.38,1],[.29,.45,.61]];
  function roof(k,i) { const [t,x,y]=cabin[i]; return [k*x*w,h*y,t*l]; }
  for (let i=0;i<3;i++) {
    face(roof(-1,i),roof(1,i),roof(1,i+1),roof(-1,i+1),i===1?'paint':'glass');
    for (const k of [-1,1]) {
      face([k*w*.461,h*.615,cabin[i][0]*l],[k*w*.461,h*.615,cabin[i+1][0]*l],roof(k,i+1),roof(k,i),'glass');
    }
  }
  for (const k of [-1,1]) for (const axle of [-1,1]) {
    const z = axle*spec.wheelbase/2, r=spec.radius;
    for (let n=0;n<8;n++) {
      const a = n*Math.PI/4, b=(n+1)*Math.PI/4;
      const x=k*w*.497;
      face([x,r,z],[x,r+r*Math.sin(a),z+r*Math.cos(a)],[x,r+r*Math.sin(b),z+r*Math.cos(b)],[x,r,z],'rubber');
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  g.setAttribute('vehicleSurface',new THREE.Float32BufferAttribute(surf,4));
  g.computeVertexNormals();
  return g;
}

function instance(geometry, material, capacity, group) {
  const m = new THREE.InstancedMesh(geometry, material, capacity);
  m.count = 0; m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.setColorAt(0, new THREE.Color(1,1,1));
  group.add(m);
  return m;
}

function setupType(scene, spec, material, group) {
  scene.updateMatrixWorld(true);
  const body = [], wheel = [], glazings = [], marks = [], offsets = [];
  scene.traverse(node => {
    if (node.name.startsWith('wheel_') && node.userData.rolling_radius) offsets.push(node.position.clone());
    if (!node.isMesh) return;
    let root=node;
    while (root.parent && !root.userData.rolling_radius && !root.userData.design_reference) root=root.parent;
    if (root.userData.rolling_radius) {
      if (root.name !== 'wheel_LF') return;
      const local = root.matrixWorld.clone().invert().multiply(node.matrixWorld);
      wheel.push({ mesh:node, matrix:local }); return;
    }
    if (node.material.map) marks.push(node);
    else if (node.material.transparent) glazings.push(node);
    else body.push({ mesh:node, matrix:node.matrixWorld });
  });
  const capacity = 45;
  const near = instance(packMeshes(body), material, capacity, group);
  const wheels = instance(packMeshes(wheel), material, capacity*4, group);
  const extra = [...marks,...glazings].map(node => {
    const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const m = node.material.clone();
    if (m.map) { m.map.anisotropy=8; m.transparent=false; m.alphaTest=.35; m.depthWrite=true; }
    else { m.depthWrite=false; m.side=THREE.FrontSide; }
    const obj = instance(g,m,capacity,group);
    // Standard materials multiply the instance colour; decals and glass retain their original tint.
    for (let i=0;i<capacity;i++) obj.setColorAt(i,new THREE.Color(1,1,1));
    return obj;
  });
  const farMat = material.clone(); farMat.onBeforeCompile=material.onBeforeCompile; farMat.side=THREE.DoubleSide;
  const far = instance(distantShape(spec),farMat,440,group);
  return {near, wheels, extra, far, offsets};
}

function contactShadows(group) {
  const size=48,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=Math.abs(2*(x+.5)/size-1),v=Math.abs(2*(y+.5)/size-1);
    const edge=Math.hypot(Math.max(0,(u-.47)/.53), Math.max(0,(v-.60)/.40));
    const alpha=1-THREE.MathUtils.smoothstep(edge,0,1);
    pixels.set([255,255,255,Math.round(255*alpha)],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearFilter; texture.needsUpdate=true;
  const geo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const mat=new THREE.MeshBasicMaterial({map:texture,color:0x141822,transparent:true,opacity:.61,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const mesh=instance(geo,mat,1000,group);mesh.renderOrder=1;
  return mesh;
}

export async function createVehicles(scene, data, options = {}) {
  const group = new THREE.Group(); group.name = 'Shenzhen road traffic';
  group.userData.excludeFromProbe=true;
  const loader = new GLTFLoader();
  const traffic = makeTraffic(data, options);
  const [assets,hero] = await Promise.all([
    Promise.all(VEHICLE_CATALOG.map(s => loader.loadAsync(modelPath(s.id)))),
    traffic.heroCar ? loadHeroTaxi() : null
  ]);
  const { mat,night } = fleetMaterial();
  const types = assets.map((asset,i) => setupType(asset.scene,VEHICLE_CATALOG[i],mat,group));
  const shadow=contactShadows(group);
  scene.add(group);
  if(hero){
    const car=traffic.heroCar;
    hero.model.position.set(car.x,car.y??options.roadSurfaceY??.30,car.z);
    hero.model.rotation.y=car.yaw;hero.model.visible=false;scene.add(hero.model);
  }
  const pos=new THREE.Vector3(), rot=new THREE.Quaternion(), scale=new THREE.Vector3(1,1,1);
  const transform=new THREE.Matrix4(), wheelLocal=new THREE.Matrix4(), wheelWorld=new THREE.Matrix4();
  const wheelRot=new THREE.Quaternion(), flip=new THREE.Quaternion().setFromAxisAngle(UP,Math.PI);
  const buckets = types.map(() => []);
  const nearCars = [];
  let collisionX = Infinity, collisionZ = Infinity;
  function isBlocked(x, z, bodyRadius = .23) {
    // The 8 m margin covers the largest body diagonal and a pedestrian radius.
    // A fresh teleport can query the full list once, before its first rendered frame.
    const withinCache = bodyRadius <= 1 && (x-collisionX)**2 + (z-collisionZ)**2 <= 24**2;
    const candidates = withinCache ? nearCars : traffic.cars;
    for (const car of candidates) {
      const dx = x-car.x, dz = z-car.z;
      const [length, width] = VEHICLE_CATALOG[car.model].size;
      const reach = length*.5 + width*.5 + bodyRadius;
      if (Math.abs(dx)>reach || Math.abs(dz)>reach) continue;
      const sin = Math.sin(car.yaw), cos = Math.cos(car.yaw);
      const sideGap = Math.max(0, Math.abs(dx*cos - dz*sin) - width*.5);
      const endGap = Math.max(0, Math.abs(dx*sin + dz*cos) - length*.5);
      if (sideGap*sideGap + endGap*endGap <= bodyRadius*bodyRadius) return true;
    }
    return false;
  }
  function update(dt, eye) {
    if (!eye) return;
    dt = Math.max(0, Math.min(.15, dt || 0));
    for (const list of buckets) list.length=0;
    const horizon = Math.min(2050, Math.max(560, eye.y * 2.8));
    traffic.step(dt,eye,horizon);
    const floor = options.roadSurfaceY ?? .30;
    if(hero){
      const c=traffic.heroCar;
      hero.model.visible=(eye.x-c.x)**2+(eye.y-floor)**2+(eye.z-c.z)**2<53**2;
      if(hero.model.visible)hero.setEnvironment(scene.userData.streetProbe);
    }
    shadow.count=0;
    collisionX=eye.x; collisionZ=eye.z; nearCars.length=0;
    for (const car of traffic.cars) {
      const dx=car.x-eye.x, dz=car.z-eye.z;
      car.distance=dx*dx+dz*dz;
      if (car.distance<=32**2) nearCars.push(car);
      if (car.distance<horizon*horizon) buckets[car.model].push(car);
    }
    for (let m=0;m<types.length;m++) {
      const t=types[m], list=buckets[m];
      list.sort((a,b)=>a.distance-b.distance);
      let close=0, far=0;
      for (const car of list) {
        pos.set(car.x,car.y??floor,car.z); rot.setFromAxisAngle(UP,car.yaw);
        transform.compose(pos,rot,scale);
        if(car === traffic.heroCar && hero?.model.visible) {
          // The parked close-up uses the clear-coated hero mesh and this same contact shadow.
        } else if (car.distance+eye.y*eye.y < 65*65 && close<45) {
          t.near.setMatrixAt(close,transform); t.near.setColorAt(close,car.color);
          for (const item of t.extra) item.setMatrixAt(close,transform);
          t.offsets.forEach((off,k) => {
            wheelRot.setFromAxisAngle(AXLE,car.wheel);
            if (off.x>0) wheelRot.multiply(flip);
            wheelLocal.compose(off,wheelRot,scale); wheelWorld.multiplyMatrices(transform,wheelLocal);
            t.wheels.setMatrixAt(close*4+k,wheelWorld); t.wheels.setColorAt(close*4+k,car.color);
          });
          close++;
        } else if (far<440) {
          t.far.setMatrixAt(far,transform); t.far.setColorAt(far,car.color); far++;
        }
        if (car.distance+eye.y*eye.y<250*250 && shadow.count<1000) {
          const [len,w]=VEHICLE_CATALOG[m].size;
          pos.y-=.009;
          scale.set(w*1.24,1,len*1.1);
          wheelWorld.compose(pos,rot,scale);
          shadow.setMatrixAt(shadow.count++,wheelWorld);
          scale.set(1,1,1);
        }
      }
      t.near.count=close; t.wheels.count=close*4; t.far.count=far;
      for (const extra of t.extra) extra.count=close;
      for (const mesh of [t.near,t.wheels,t.far,...t.extra]) {
        if (mesh.count) { mesh.instanceMatrix.needsUpdate=true; mesh.instanceColor.needsUpdate=true; }
      }
    }
    if(shadow.count) shadow.instanceMatrix.needsUpdate=true;
  }
  function dispose() {
    scene.remove(group);
    if(hero){scene.remove(hero.model);hero.dispose();}
    const materials=new Set(), geometries=new Set(), textures=new Set();
    for (const source of [group,...assets.map(a=>a.scene)]) {
      source.traverse(n=>{
        if (n.geometry) geometries.add(n.geometry);
        if (n.material) materials.add(n.material);
        if (n.isInstancedMesh) n.dispose();
      });
    }
    for (const geom of geometries) geom.dispose();
    for (const m of materials) { if (m.map) textures.add(m.map); m.dispose(); }
    for (const texture of textures) texture.dispose();
  }
  return { update, isBlocked, dispose, setNight(value) { night.value = .50 + Number(value)*3; }, models: VEHICLE_CATALOG, count:traffic.cars.length };
}
