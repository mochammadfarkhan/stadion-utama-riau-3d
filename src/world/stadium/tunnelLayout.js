/**
 * Tata letak terowongan kendaraan di gate utama (underpass bus tim).
 * Koridor lurus mengikuti garis framePoint(gate.u, k, 0) untuk k ∈ [kStart, kEnd].
 * Modul ini dipakai bersama oleh Tribune.concrete.js, Tribune.seats.js,
 * Tribune.extras.js (memotong undakan/kursi/railing) dan Tunnels.js (membangun lorong).
 * Sudut θ di sini memakai konvensi tribun: x = a·cosθ, z = b·sinθ (ruang dunia).
 */
import { GATES } from './gateLayout.js';
import { framePoint } from './ovalFrame.js';
import { ellipseArcAtAngle } from './ovalMath.js';

const TWO_PI = Math.PI * 2;

export const TUNNEL = Object.freeze({
  halfWidth: 5,      // setengah lebar bebas (m)
  wallT: 0.3,        // tebal dinding samping (m)
  clearance: 4.5,    // tinggi bebas (m)
  slabT: 0.3,        // tebal pelat langit-langit (m)
  kStart: -0.05,     // ujung luar (di depan cangkang)
  kEnd: 1.2,         // ujung dalam (apron lintasan)
  gapPad: 0.05,      // kelonggaran celah beton agar tidak z-fighting dengan dinding
  floorLift: 0.02,   // angkat lantai dari apron
});

/** Setengah lebar celah pada beton/kursi/railing (dinding ikut masuk ke celah). */
export const GAP_HALF = TUNNEL.halfWidth + TUNNEL.wallT + TUNNEL.gapPad;

/** Tinggi maksimum dasar baris yang masih terpotong oleh volume terowongan. */
export const CUT_BELOW_Y = TUNNEL.clearance + TUNNEL.slabT;

/** Garis pusat koridor: titik di k=0 dan vektor arah per satuan k (bidang XZ). */
export function corridorLine(gate) {
  const p0 = framePoint(gate.u, 0, 0);
  const p1 = framePoint(gate.u, 1, 0);
  const dx = p1.x - p0.x;
  const dz = p1.z - p0.z;
  const len = Math.hypot(dx, dz);
  return Object.freeze({
    gate, ox: p0.x, oz: p0.z, dx, dz, len,
    nx: -dz / len, nz: dx / len, // normal satuan ke kanan koridor
  });
}

/** Semua koridor gate utama (dibekukan, dihitung sekali). */
export const CORRIDORS = Object.freeze(GATES.filter((g) => g.main).map(corridorLine));

/** Apakah baris dengan dasar y ini terpotong terowongan. */
export function isRowCut(rowBaseY) {
  return rowBaseY < CUT_BELOW_Y;
}

/** Parameter k masuk (akar terkecil ≥ kStart) garis O + D·k ke elips (a,b); null bila tak memotong. */
function lineEllipseEntryK(ox, oz, dx, dz, a, b) {
  const qa = (dx / a) ** 2 + (dz / b) ** 2;
  const qb = 2 * ((ox * dx) / (a * a) + (oz * dz) / (b * b));
  const qc = (ox / a) ** 2 + (oz / b) ** 2 - 1;
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0 || qa === 0) return null;
  const root = Math.sqrt(disc);
  const k1 = (-qb - root) / (2 * qa);
  return k1 >= TUNNEL.kStart ? k1 : (-qb + root) / (2 * qa);
}

function wrapAngle(t) {
  return ((t % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * Celah sudut satu koridor pada elips (a,b): θ tepi kiri & kanan koridor (±half).
 * Hasil: {thetaStart, thetaEnd} dengan thetaStart ∈ [0,2π), thetaEnd > thetaStart.
 */
export function corridorGapOnRing(corr, a, b, half = GAP_HALF) {
  const thetas = [-1, 1].map((s) => {
    const ox = corr.ox + s * half * corr.nx;
    const oz = corr.oz + s * half * corr.nz;
    const k = lineEllipseEntryK(ox, oz, corr.dx, corr.dz, a, b);
    if (k === null) return null;
    return wrapAngle(Math.atan2((oz + corr.dz * k) / b, (ox + corr.dx * k) / a));
  });
  if (thetas.some((t) => t === null)) return null;
  let [t1, t2] = thetas[0] <= thetas[1] ? thetas : [thetas[1], thetas[0]];
  if (t2 - t1 > Math.PI) [t1, t2] = [t2, t1 + TWO_PI]; // celah melewati θ=0
  return Object.freeze({ thetaStart: t1, thetaEnd: t2, gate: corr.gate });
}

/** Semua celah koridor pada elips (a,b), terurut menurut thetaStart. */
export function corridorGapsOnRing(a, b, half = GAP_HALF) {
  return CORRIDORS.map((c) => corridorGapOnRing(c, a, b, half))
    .filter(Boolean)
    .sort((p, q) => p.thetaStart - q.thetaStart);
}

/** Apakah θ (dunia) berada di dalam salah satu celah. */
export function thetaInGaps(gaps, theta) {
  const t = wrapAngle(theta);
  return gaps.some((g) => {
    const rel = wrapAngle(t - g.thetaStart);
    return rel < g.thetaEnd - g.thetaStart;
  });
}

/** Rentang jarak busur celah pada tabel busur (untuk kursi/tiang): [{sStart, sEnd}]. */
export function corridorArcRanges(table, half = GAP_HALF) {
  return corridorGapsOnRing(table.a, table.b, half).map((g) => Object.freeze({
    sStart: ellipseArcAtAngle(table, g.thetaStart),
    sEnd: ellipseArcAtAngle(table, g.thetaEnd),
  }));
}

/** Apakah jarak busur s jatuh di salah satu rentang (menangani wrap di total). */
export function arcInRanges(ranges, s, total) {
  return ranges.some((r) => {
    const sw = ((s - r.sStart) % total + total) % total;
    const len = ((r.sEnd - r.sStart) % total + total) % total;
    return sw < len;
  });
}
