/**
 * Profil penampang (k, y) cangkang stadion — satu sumber untuk rib, atap, dan fasad.
 * k = 0 tepi elips luar, k = 1 tepi bukaan atap dalam, k < 0 keluar bangunan.
 */
import { STADIUM } from '../../config/constants.js';

const ROOF = STADIUM.roofHeight;
const FACADE = STADIUM.facadeHeight;
const LEAN = STADIUM.ribLean;

/** Profil atap: naik dari tepi luar ke punggung lalu turun ke tepi dalam. */
export const ROOF_PROFILE = Object.freeze([
  { k: 0.0, y: ROOF - 6 },
  { k: 0.12, y: ROOF - 2 },
  { k: 0.3, y: ROOF },
  { k: 0.5, y: ROOF - 1 },
  { k: 0.75, y: ROOF - 4 },
  { k: 1.0, y: ROOF - 8 },
]);

/** Rib biasa: kaki di plaza, miring keluar, melengkung masuk menuju tepi atap dalam. */
export const RIB_PROFILE = Object.freeze([
  { k: -0.02, y: 0 },
  { k: -LEAN * 0.64, y: FACADE * 0.53 },
  { k: -LEAN, y: FACADE },
  { k: -LEAN * 0.77, y: ROOF - 2 },
  { k: -0.04, y: ROOF + 2.5 },
  { k: 0.3, y: ROOF + 1.5 },
  { k: 0.65, y: ROOF - 2 },
  { k: 1.0, y: ROOF - 6.5 },
]);

/** Selembayung (ujung ±Z): dua rusuk menyilang; s = offset tangensial (m), dicerminkan untuk pasangannya. */
export const SELEMBAYUNG_PROFILE = Object.freeze([
  { k: -0.02, y: 0, s: 9 },
  { k: -LEAN * 0.64, y: FACADE * 0.53, s: 7 },
  { k: -LEAN, y: FACADE, s: 4.5 },
  { k: -LEAN * 0.73, y: ROOF - 1, s: 1.5 },
  { k: -0.06, y: ROOF + 7, s: 0 },
  { k: 0.0, y: ROOF + 13, s: -3 },
  { k: 0.04, y: ROOF + 18, s: -5.5 },
]);

/** Tinggi atap pada k (interpolasi linear profil). */
export function roofYAt(k) {
  const p = ROOF_PROFILE;
  if (k <= p[0].k) return p[0].y;
  for (let i = 1; i < p.length; i++) {
    if (k <= p[i].k) {
      const f = (k - p[i - 1].k) / (p[i].k - p[i - 1].k);
      return p[i - 1].y + (p[i].y - p[i - 1].y) * f;
    }
  }
  return p[p.length - 1].y;
}

/** Bidang louvre: miring keluar mengikuti rib, ~2 m di dalam permukaan rib. */
export function louvreKAt(y) {
  const f = Math.min(Math.max(y / FACADE, 0), 1);
  return -0.01 - (LEAN - 0.05) * f;
}
