/**
 * Collider region "unri-lembaga" (region-lokal). Di dalam mask region collider komposit memakai collider
 * ini, bukan collider distrik, jadi SEMUA penghalang zona harus ada di sini: gedung (tribun, Student Center,
 * Rusunawa, FH — dua terakhir dirender distrik), blok ruang sekretariat (selasar bebas), baris motor parkir,
 * pagar, tiang PJU, pos satpam, jemuran, gundukan material. Kamera hanya terhalang gedung (benda rendah tidak).
 */
import { pointInPolygon, distanceToRing, distanceToSegment } from '../../geo/polygon.js';
import { FOOTPRINTS, toSekre } from './placement.js';
import { SEKRE_DIM, LEMBAGA_LAYOUT } from './layout.js';

const BIKE_PAD = 0.55;     // jarak bebas sepeda dari dinding (m)
const CAMERA_PAD = 0.3;
const SEGMENT_PAD = 0.3;
const SOLID_BUILDINGS = Object.freeze(['tribun', 'studentCenter', 'rusunawa', 'fhPanam']);

/** Kedalaman masuk ke ring + pad (0 = di luar zona terhalang). */
function ringDepth(x, z, ring, pad) {
  const d = distanceToRing(x, z, ring);
  if (pointInPolygon(x, z, ring)) return d + pad;
  return d < pad ? pad - d : 0;
}

/** Kedalaman masuk ke blok ruang sekretariat (dua baris; selasar |bx| < corridorHalf bebas). */
function sekreDepth(lx, lz, pad, dim = SEKRE_DIM) {
  const b = toSekre(lx, lz);
  const ax = Math.abs(b.x);
  const inside = ax > dim.corridorHalf - pad && ax < dim.hx + pad && Math.abs(b.z) < dim.hz + pad;
  if (!inside) return 0;
  return Math.min(ax - (dim.corridorHalf - pad), dim.hx + pad - ax, dim.hz + pad - Math.abs(b.z));
}

const segDepth = (x, z, s) => Math.max(0, s.r + SEGMENT_PAD - distanceToSegment(x, z, s.a, s.b));
const circleDepth = (x, z, c) => Math.max(0, c.r - Math.hypot(x - c.x, z - c.z));

/** Bentuk penghalang default dari footprint & layout zona. */
export function defaultShapes(layout = LEMBAGA_LAYOUT) {
  const rows = [...layout.lots.stadionMini.rows, ...layout.lots.rusunawa.rows];
  const sekreMotors = layout.teras.motors.map((m) => ({ x: m.x, z: m.z, r: 1.0 }));
  return {
    rings: SOLID_BUILDINGS.map((k) => FOOTPRINTS[k]),
    segments: [...rows, ...layout.teras.fenceSegments, ...layout.fh.fences],
    circles: [
      ...sekreMotors,
      ...layout.pju.map((p) => ({ x: p.x, z: p.z, r: 0.45 })),
      { x: layout.teras.board.x, z: layout.teras.board.z, r: 0.85 },
      { x: layout.teras.jemuran.x, z: layout.teras.jemuran.z, r: 1.1 },
      { x: layout.rusun.guardPost.x, z: layout.rusun.guardPost.z, r: 1.7 },
      ...layout.rusun.jemuran.map((p) => ({ x: p.x, z: p.z, r: 1.1 })),
      ...layout.fh.mounds.map((m) => ({ x: m.x, z: m.z, r: m.r })),
    ],
  };
}

/**
 * @param {{rings: Array<ReadonlyArray<readonly [number, number]>>, segments: Array<{a:number[], b:number[], r:number}>,
 *   circles: Array<{x:number, z:number, r:number}>}} [shapes]
 */
export function createLembagaColliders(shapes = defaultShapes()) {
  const { rings, segments, circles } = shapes;
  const depthAt = (x, z) => {
    let best = sekreDepth(x, z, BIKE_PAD);
    for (const r of rings) best = Math.max(best, ringDepth(x, z, r, BIKE_PAD));
    for (const s of segments) best = Math.max(best, segDepth(x, z, s));
    for (const c of circles) best = Math.max(best, circleDepth(x, z, c));
    return best;
  };
  const finite = (x, z) => Number.isFinite(x) && Number.isFinite(z);
  return Object.freeze({
    isWalkable: (x, z) => finite(x, z) && depthAt(x, z) === 0,
    isCameraClear: (x, z) => finite(x, z) && sekreDepth(x, z, CAMERA_PAD) === 0
      && rings.every((r) => ringDepth(x, z, r, CAMERA_PAD) === 0),
    penetration: (x, z) => (finite(x, z) ? depthAt(x, z) : Infinity),
  });
}

export const lembagaColliders = createLembagaColliders();
