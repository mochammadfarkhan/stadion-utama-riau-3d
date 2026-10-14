/**
 * Tata letak tribun: definisi tier, sektor, dan konstanta bersama
 * untuk Tribune.concrete.js, Tribune.seats.js, Tribune.extras.js.
 * Offset = jarak radial dari elips dasar (innerSemiX/Z) ke arah luar.
 */
import { STADIUM } from '../../config/constants.js';
import { createEllipseArcTable, ellipseArcAtAngle, ellipsePoint } from './ovalMath.js';

export const BASE_A = STADIUM.innerSemiX;
export const BASE_B = STADIUM.innerSemiZ;
export const ROW_DEPTH = STADIUM.rowDepth;
export const LOWER_RISE = STADIUM.rowRise;
export const UPPER_RISE = 0.55;          // tier atas lebih curam
export const CONCOURSE_W = 4;            // balkon/concourse antar tier
export const UPPER_LIFT = 2.0;           // tinggi parapet balkon sebelum baris pertama tier atas
export const SECTOR_COUNT = 16;
export const VOMITORY_W = 1.6;
export const CURVE_SEG = 96;
export const NORTH_THETA = Math.PI * 1.5; // z = b·sin θ → utara (−Z) di θ = 3π/2
export const WEST_THETA = Math.PI;        // x = a·cos θ → barat (−X) di θ = π
export const NORTH_SPAN = Math.PI / 5;    // lebar sudut sektor "utara" (kursi hilang)

const TWO_PI = Math.PI * 2;

/** Dua tier: offset awal, jumlah baris, rise, dan y dasar. */
export function createTierLayout() {
  const lowerTop = STADIUM.lowerRows * LOWER_RISE;
  const lowerEnd = STADIUM.lowerRows * ROW_DEPTH;
  const lower = Object.freeze({
    name: 'lower', rows: STADIUM.lowerRows, offset0: 0, rise: LOWER_RISE, y0: 0,
    topY: lowerTop, endOffset: lowerEnd,
  });
  const upperOffset0 = lowerEnd + CONCOURSE_W;
  const upper = Object.freeze({
    name: 'upper', rows: STADIUM.upperRows, offset0: upperOffset0, rise: UPPER_RISE,
    y0: lowerTop + UPPER_LIFT, topY: lowerTop + UPPER_LIFT + STADIUM.upperRows * UPPER_RISE,
    endOffset: upperOffset0 + STADIUM.upperRows * ROW_DEPTH,
  });
  return Object.freeze({ lower, upper, concourseY: lowerTop, tiers: [lower, upper] });
}

/** Info sektor (sudut parametrik) untuk crowd & seat bucketing. */
export function createSectorInfo() {
  const table = createEllipseArcTable(BASE_A, BASE_B);
  const step = TWO_PI / SECTOR_COUNT;
  return Array.from({ length: SECTOR_COUNT }, (_, i) => {
    const thetaStart = i * step;
    const thetaEnd = (i + 1) * step;
    const mid = (thetaStart + thetaEnd) / 2;
    return Object.freeze({
      index: i, thetaStart, thetaEnd,
      tStart: ellipseArcAtAngle(table, thetaStart) / table.total,
      tEnd: i === SECTOR_COUNT - 1 ? 1 : ellipseArcAtAngle(table, thetaEnd) / table.total,
      center: ellipsePoint(BASE_A, BASE_B, mid),
      isNorth: angleDistance(mid, NORTH_THETA) < NORTH_SPAN,
      isWest: angleDistance(mid, WEST_THETA) < NORTH_SPAN,
    });
  });
}

export function sectorIndexOf(theta) {
  const t = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.min(SECTOR_COUNT - 1, Math.floor(t / (TWO_PI / SECTOR_COUNT)));
}

/** Selisih sudut terkecil (0..π). */
export function angleDistance(a, b) {
  const d = Math.abs(((a - b) % TWO_PI + TWO_PI) % TWO_PI);
  return Math.min(d, TWO_PI - d);
}
