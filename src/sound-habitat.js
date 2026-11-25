import {Grid, clamp, inArea, segmentDistance} from './city-geometry.js';

// Index the mapped crowns and both the outer bank and island shores once.
// A moving listener only needs sources within earshot of the current cell.
export function soundHabitat(map, canopy) {
  const crowns = new Grid(64), banks = new Grid(64), greenery = new Grid(64);
  for (const tree of canopy) {
    const [x, z] = tree;
    crowns.add(tree, [x - 55, z - 55, x + 55, z + 55]);
  }
  const plants = new Set(['wood', 'forest', 'grass', 'garden', 'scrub', 'wetland', 'flowerbed']);
  for (const area of map.land) {
    if (plants.has(area.kind)) greenery.add(area, area.bbox);
  }
  const lake = map.water.find(area => Number(area.id) === map.landmarks.lake.id);
  for (const ring of lake ? [lake.p, ...(lake.holes || [])] : []) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      banks.add([a, b], [Math.min(a[0], b[0]) - 32, Math.min(a[1], b[1]) - 32,
        Math.max(a[0], b[0]) + 32, Math.max(a[1], b[1]) + 32]);
    }
  }
  return ({x, y, z}) => {
    const ground = clamp((75 - y) / 60, 0, 1);
    let trees = 0, grass = 0, shore = 0;
    if (ground > 0) {
      for (const [tx, tz] of crowns.query(x, z)) {
        trees = Math.max(trees, 1 - Math.hypot(x - tx, z - tz) / 55);
      }
      for (const area of greenery.query(x, z)) {
        if (!inArea(x, z, area)) continue;
        grass = 1;
        if (area.kind === 'wood' || area.kind === 'forest') trees = 1;
      }
      for (const [a, b] of banks.query(x, z)) {
        shore = Math.max(shore, 1 - Math.hypot(segmentDistance(x, z, a, b), y) / 32);
      }
    }
    return {ground, trees: trees * ground, grass: grass * ground, shore};
  };
}
