import { STADIUM, SITE } from '../config/constants.js';
import { GATES } from '../world/stadium/gateLayout.js';
import { framePoint } from '../world/stadium/ovalFrame.js';

const GATE_HALF_WIDTH = 4.6;   // sedikit lebih sempit dari terowongan 10 m
const CORRIDOR_K_START = -0.08;
const CORRIDOR_K_END = 1.25;
const WORLD_LIMIT = SITE.groundSize / 2 - 20;
const LAKE_RADIUS = 70;

/** Koridor gate utama sebagai segmen garis dunia (dari luar cangkang ke apron lintasan). */
const CORRIDORS = GATES.filter((g) => g.main).map((g) => {
  const a = framePoint(g.u, CORRIDOR_K_START, 0);
  const b = framePoint(g.u, CORRIDOR_K_END, 0);
  return { ax: a.x, az: a.z, bx: b.x, bz: b.z };
});

/** Radius ternormalisasi terhadap elips (1 = tepat di tepi). */
const ellipseRadius = (x, z, a, b) => Math.sqrt((x / a) ** 2 + (z / b) ** 2);

/** Jarak titik ke segmen garis (2D). */
function distToSegment(px, pz, s) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / len2));
  return Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t));
}

/** Jarak terdekat titik ke garis tengah koridor gate utama. */
export function distanceToGateCorridor(x, z) {
  return Math.min(...CORRIDORS.map((s) => distToSegment(x, z, s)));
}

export function inGateCorridor(x, z) {
  return distanceToGateCorridor(x, z) < GATE_HALF_WIDTH;
}

/** Posisi valid: di dalam mangkuk, di luar cangkang, atau di koridor gate; tidak di danau; dalam batas dunia. */
export function isWalkable(x, z) {
  if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT) return false;
  const lake = SITE.lakeCenter;
  if (Math.hypot(x - lake.x, z - lake.z) < LAKE_RADIUS) return false;
  if (inGateCorridor(x, z)) return true;
  const inner = ellipseRadius(x, z, STADIUM.innerSemiX - 2, STADIUM.innerSemiZ - 2);
  const outer = ellipseRadius(x, z, STADIUM.outerSemiX + 1.5, STADIUM.outerSemiZ + 1.5);
  return inner < 1 || outer > 1;
}

/**
 * Collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
 * Mencoba meluncur (slide) di sumbu X atau Z agar tidak "lengket".
 */
export function createCollider(start = { x: 0, z: 0 }) {
  let last = { x: start.x, z: start.z };
  return (x, z) => {
    if (isWalkable(x, z)) return (last = { x, z });
    if (isWalkable(x, last.z)) return (last = { x, z: last.z });
    if (isWalkable(last.x, z)) return (last = { x: last.x, z });
    return { ...last };
  };
}
