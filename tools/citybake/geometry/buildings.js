/**
 * Bangunan extrude: dinding vertikal (normal luar, dasar sedikit lebih gelap sebagai AO murah) +
 * atap datar, atau atap pelana untuk footprint ~persegi panjang kecil. Koordinat tile-lokal.
 */
import { cleanRing, orientRing } from '../../../src/geo/polygon.js';
import { addFace } from './meshBuilder.js';
import { addFlatPolygon } from './areas.js';
import { shade } from './colors.js';

const GABLE_PITCH = Math.tan((30 * Math.PI) / 180);
const RIGHT_ANGLE_TOLERANCE = 0.2; // |cos sudut sudut| maksimum (≈ 90° ± 11,5°)
const COLLINEAR_EPS = 1e-3;
const BASE_SHADE = 0.82;

/** Buang titik yang segaris dengan tetangganya. */
function dropCollinear(ring) {
  const out = ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const crossV = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return Math.abs(crossV) > COLLINEAR_EPS * Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  return out.length >= 3 ? out : ring;
}

/**
 * Bila ring ~persegi panjang, kembalikan 4 sudut (ring positif) diputar agar sisi p0→p1 adalah sisi
 * panjang; selain itu null.
 * @returns {Array<[number, number]>|null}
 */
export function rectangleFrame(ring) {
  const r = orientRing(dropCollinear(cleanRing(ring)), true);
  if (r.length !== 4) return null;
  for (let i = 0; i < 4; i += 1) {
    const a = r[(i + 3) % 4];
    const p = r[i];
    const b = r[(i + 1) % 4];
    const u = [a[0] - p[0], a[1] - p[1]];
    const v = [b[0] - p[0], b[1] - p[1]];
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
    if (!(Math.abs(cos) <= RIGHT_ANGLE_TOLERANCE)) return null;
  }
  const len = (i) => Math.hypot(r[(i + 1) % 4][0] - r[i][0], r[(i + 1) % 4][1] - r[i][1]);
  return len(0) >= len(1) ? r : [r[1], r[2], r[3], r[0]];
}

/** Dinding untuk satu ring (sudah berorientasi: luar positif, lubang negatif). */
function addWalls(walls, ring, height, rgb) {
  const bottom = shade(rgb, BASE_SHADE);
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    if (Math.hypot(dx, dz) < 1e-6) continue;
    addFace(
      walls,
      [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], height, b[1]], [a[0], height, a[1]]],
      [bottom, bottom, rgb, rgb],
      [dz, 0, -dx],
    );
  }
}

/** Atap pelana pada frame persegi panjang (p0→p1 sisi panjang); ujung segitiga masuk ke dinding. */
function addGable(walls, roofs, frame, eave, wallRgb, roofRgb) {
  const [p0, p1, p2, p3] = frame;
  const shortLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const ridgeY = eave + (shortLen / 2) * GABLE_PITCH;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const rA = mid(p3, p0);
  const rB = mid(p1, p2);
  const v3 = (p, y) => [p[0], y, p[1]];
  const outward = (a, b) => [b[1] - a[1], 0, -(b[0] - a[0])];
  const slopeDir = (a, b) => {
    const o = outward(a, b);
    return [o[0], Math.hypot(o[0], o[2]), o[2]];
  };
  addFace(roofs, [v3(p0, eave), v3(p1, eave), v3(rB, ridgeY), v3(rA, ridgeY)], roofRgb, slopeDir(p0, p1));
  addFace(roofs, [v3(p2, eave), v3(p3, eave), v3(rA, ridgeY), v3(rB, ridgeY)], roofRgb, slopeDir(p2, p3));
  addFace(walls, [v3(p1, eave), v3(p2, eave), v3(rB, ridgeY)], wallRgb, outward(p1, p2));
  addFace(walls, [v3(p3, eave), v3(p0, eave), v3(rA, ridgeY)], wallRgb, outward(p3, p0));
}

/**
 * Tambah satu bangunan.
 * @param {{walls: object, roofs: object}} builders
 * @param {{rings: Array<Array<[number, number]>>, height: number, wallRgb: number[], roofRgb: number[],
 *   gableRoofRgb?: number[], gable?: boolean}} b  gable=true hanya dihormati bila footprint persegi
 *   panjang tanpa lubang; gableRoofRgb (default roofRgb) dipakai untuk atap pelana
 * @returns {'gable'|'flat'}
 */
export function addBuilding({ walls, roofs }, { rings, height, wallRgb, roofRgb, gableRoofRgb = roofRgb, gable = false }) {
  const outer = orientRing(cleanRing(rings[0]), true);
  const holes = rings.slice(1).map((h) => orientRing(cleanRing(h), false)).filter((h) => h.length >= 3);
  const frame = gable && holes.length === 0 ? rectangleFrame(outer) : null;
  if (frame) {
    addWalls(walls, frame, height, wallRgb);
    addGable(walls, roofs, frame, height, wallRgb, gableRoofRgb);
    return 'gable';
  }
  addWalls(walls, outer, height, wallRgb);
  for (const h of holes) addWalls(walls, h, height, wallRgb);
  addFlatPolygon(roofs, [outer, ...holes], height, roofRgb);
  return 'flat';
}
