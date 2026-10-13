import { STADIUM, SITE } from '../config/constants.js';

const GATE_HALF_WIDTH = 5;
const WORLD_LIMIT = SITE.groundSize / 2 - 20;
const LAKE_RADIUS = 70;

/** Radius ternormalisasi terhadap elips (1 = tepat di tepi). */
const ellipseRadius = (x, z, a, b) => Math.sqrt((x / a) ** 2 + (z / b) ** 2);

/** Koridor gate: utara (−Z) dan barat (−X), lebar 2×GATE_HALF_WIDTH. */
function inGateCorridor(x, z) {
  const north = Math.abs(x) < GATE_HALF_WIDTH && z < 0;
  const west = Math.abs(z) < GATE_HALF_WIDTH && x < 0;
  return north || west;
}

/** Posisi valid: di dalam mangkuk, di luar cangkang, atau di koridor gate; tidak di danau; dalam batas dunia. */
export function isWalkable(x, z) {
  if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT) return false;
  const lake = SITE.lakeCenter;
  if (Math.hypot(x - lake.x, z - lake.z) < LAKE_RADIUS) return false;
  const inner = ellipseRadius(x, z, STADIUM.innerSemiX - 2, STADIUM.innerSemiZ - 2);
  const outer = ellipseRadius(x, z, STADIUM.outerSemiX + 1, STADIUM.outerSemiZ + 1);
  if (inner < 1 || outer > 1) return true;
  return inGateCorridor(x, z);
}

/**
 * Membuat collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
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
