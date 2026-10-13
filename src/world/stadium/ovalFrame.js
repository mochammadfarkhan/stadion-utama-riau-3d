/**
 * Kerangka oval stadion: parametrisasi elips merata (tabel panjang busur)
 * dan sistem koordinat (u, k, y) untuk menempatkan elemen keliling.
 *  u : fraksi keliling [0,1); u=0 di utara (−Z), bertambah ke arah timur (+X)
 *  k : 0 = tepi elips luar, 1 = tepi bukaan atap dalam, k<0 = keluar bangunan
 *  y : tinggi (m)
 */
import { Vector3 } from 'three';
import { STADIUM } from '../../config/constants.js';

const TABLE_SAMPLES = 1024;
const TWO_PI = Math.PI * 2;

/** Titik elips pada sudut t: x = a·sin t, z = −b·cos t (t=0 → utara). */
function frameAtAngle(a, b, t) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const nLen = Math.hypot(s / a, c / b);
  const tLen = Math.hypot(a * c, b * s);
  return {
    t,
    x: a * s,
    z: -b * c,
    nx: (s / a) / nLen,   // normal keluar
    nz: (-c / b) / nLen,
    tx: (a * c) / tLen,   // tangen searah u naik
    tz: (b * s) / tLen,
  };
}

/** Tabel kumulatif panjang busur untuk inversi u → t. */
function buildArcTable(a, b, samples) {
  const cum = new Float64Array(samples + 1);
  let prev = frameAtAngle(a, b, 0);
  for (let i = 1; i <= samples; i++) {
    const p = frameAtAngle(a, b, (i / samples) * TWO_PI);
    cum[i] = cum[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
  }
  return cum;
}

function angleFromTable(cum, samples, u) {
  const w = u - Math.floor(u);
  const target = w * cum[samples];
  let lo = 0;
  let hi = samples;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid; else hi = mid;
  }
  const seg = cum[lo + 1] - cum[lo];
  const frac = seg > 0 ? (target - cum[lo]) / seg : 0;
  return ((lo + frac) / samples) * TWO_PI;
}

/** Aproksimasi Ramanujan keliling elips. */
export function ellipsePerimeter(a, b) {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** Elips generik dengan penempatan merata berdasarkan panjang busur. */
export function createEllipse(a, b, samples = TABLE_SAMPLES) {
  const cum = buildArcTable(a, b, samples);
  return Object.freeze({
    a,
    b,
    perimeter: cum[samples],
    angleAt: (u) => angleFromTable(cum, samples, u),
    frameAt: (u) => frameAtAngle(a, b, angleFromTable(cum, samples, u)),
  });
}

const OUTER = createEllipse(STADIUM.outerSemiX, STADIUM.outerSemiZ);

export const ROOF_OPENING = Object.freeze({
  a: STADIUM.innerSemiX + STADIUM.roofOpeningPad,
  b: STADIUM.innerSemiZ + STADIUM.roofOpeningPad,
});

export function outerEllipse() { return OUTER; }

/** Konversi panjang meter di tepi luar → selisih u. */
export function uSpan(meters) { return meters / OUTER.perimeter; }

/** Selisih u terpendek (wrap) dalam rentang (−0.5, 0.5]. */
export function uDelta(u1, u2) {
  let d = (u1 - u2) % 1;
  if (d > 0.5) d -= 1;
  if (d <= -0.5) d += 1;
  return d;
}

/** Frame lengkap pada u: titik luar, titik bukaan dalam, normal, tangen, yaw (+Z lokal = keluar). */
export function frameAt(u) {
  const f = OUTER.frameAt(u);
  return {
    ...f,
    ix: ROOF_OPENING.a * Math.sin(f.t),
    iz: -ROOF_OPENING.b * Math.cos(f.t),
    yaw: Math.atan2(f.nx, f.nz),
  };
}

/** Posisi dunia dari koordinat (u, k, y). */
export function framePoint(u, k, y, target = new Vector3()) {
  const f = frameAt(u);
  return target.set(f.x + (f.ix - f.x) * k, y, f.z + (f.iz - f.z) * k);
}

/** Perkiraan keliling cincin pada offset k. */
export function perimeterAtK(k) {
  const a = STADIUM.outerSemiX - k * (STADIUM.outerSemiX - ROOF_OPENING.a);
  const b = STADIUM.outerSemiZ - k * (STADIUM.outerSemiZ - ROOF_OPENING.b);
  return ellipsePerimeter(a, b);
}
