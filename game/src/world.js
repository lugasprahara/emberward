// The world: the winding road the horde walks, the Ember Crystal it hunts,
// and the seeded decoration scatter (pines, rocks, tufts) that dresses the
// field. Path geometry is precomputed as a polyline with cumulative lengths
// so an enemy's position is a pure function of distance travelled.

import { TILE, COLS, ROWS } from './config.js';
import { mulberry32, randRange } from './random.js';

// Waypoints in tile coordinates (col, row); the road enters from the left
// edge and snakes to the crystal tile at the right.
const WAYPOINT_TILES = [
  [-1, 2], [12, 2], [12, 5], [3, 5], [3, 8], [13, 8], [13, 10], [16, 10],
];
export const CRYSTAL_TILE = { c: 16, r: 10 };
export const GATE_TILE = { c: 0, r: 2 };

export function tileCenter(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

export function cellKey(c, r) {
  return `${c},${r}`;
}

export function buildWorld(seed) {
  const pts = WAYPOINT_TILES.map(([c, r]) => tileCenter(c, r));
  // Clamp the off-screen entry point to just outside the field edge.
  pts[0] = { x: -TILE / 2, y: pts[0].y };

  const segments = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: total });
    total += len;
  }

  // Every tile the road passes through is unbuildable.
  const pathCells = new Set();
  for (let i = 0; i < WAYPOINT_TILES.length - 1; i++) {
    let [c0, r0] = WAYPOINT_TILES[i];
    const [c1, r1] = WAYPOINT_TILES[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    for (let guard = 0; guard < 64; guard++) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) pathCells.add(cellKey(c, r));
      if (c === c1 && r === r1) break;
      c += dc;
      r += dr;
    }
  }
  pathCells.add(cellKey(CRYSTAL_TILE.c, CRYSTAL_TILE.r));

  // Decorations: scattered with the seeded RNG on free tiles, kept off the
  // road and a small margin around the crystal and gate.
  const rng = mulberry32(seed * 7919 + 13);
  const decorations = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (pathCells.has(cellKey(c, r))) continue;
      const roll = rng();
      const { x, y } = tileCenter(c, r);
      const jx = randRange(rng, -16, 16);
      const jy = randRange(rng, -14, 14);
      if (roll < 0.16) decorations.push({ kind: 'pine', x: x + jx, y: y + jy, s: randRange(rng, 0.8, 1.25) });
      else if (roll < 0.24) decorations.push({ kind: 'rock', x: x + jx, y: y + jy, s: randRange(rng, 0.7, 1.2) });
      else if (roll < 0.40) decorations.push({ kind: 'tuft', x: x + jx, y: y + jy, s: randRange(rng, 0.7, 1.3) });
      else if (roll < 0.46) decorations.push({ kind: 'bloom', x: x + jx, y: y + jy, s: randRange(rng, 0.8, 1.1) });
    }
  }

  return { pts, segments, totalLength: total, pathCells, decorations };
}

// Position + heading at a distance along the road.
export function posAt(world, dist) {
  const segs = world.segments;
  if (dist <= 0) {
    const s = segs[0];
    return { x: s.a.x, y: s.a.y, ang: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) };
  }
  for (const s of segs) {
    if (dist <= s.start + s.len) {
      const t = s.len === 0 ? 0 : (dist - s.start) / s.len;
      return {
        x: s.a.x + (s.b.x - s.a.x) * t,
        y: s.a.y + (s.b.y - s.a.y) * t,
        ang: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x),
      };
    }
  }
  const last = segs[segs.length - 1];
  return { x: last.b.x, y: last.b.y, ang: Math.atan2(last.b.y - last.a.y, last.b.x - last.a.x) };
}
