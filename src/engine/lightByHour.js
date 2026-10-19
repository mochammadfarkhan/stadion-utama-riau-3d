/**
 * Interpolasi tabel LIGHT_BY_HOUR (murni, tanpa three): cahaya gaya kartun/facet per jam, kontinu di 0/24.
 * Warna diinterpolasi per kanal; hasil selalu terbatas (tanpa NaN) walau jam tak valid.
 */
import { LIGHT_BY_HOUR } from '../config/lowpoly.js';

const HOURS = 24;
const COLOR_KEYS = Object.freeze(['sunColor', 'hemiSky', 'hemiGround', 'fogColor']);
const NUMBER_KEYS = Object.freeze(['sunMul', 'hemiMul', 'expMul', 'split', 'haze']);

const wrap = (h) => (Number.isFinite(h) ? ((h % HOURS) + HOURS) % HOURS : 12);
const lerp = (a, b, t) => a + (b - a) * t;

function lerpHex(a, b, t) {
  const ch = (shift) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Pasangan keyframe (a, b, t) yang mengapit jam; keyframe terakhir menyambung ke pertama + 24. */
function bracket(table, hour) {
  const h = wrap(hour);
  const n = table.length;
  for (let i = 0; i < n; i += 1) {
    const a = table[i];
    const b = table[(i + 1) % n];
    const bHour = b.hour <= a.hour ? b.hour + HOURS : b.hour;
    const aHour = a.hour;
    if (h >= aHour && h < bHour) return { a, b, t: (h - aHour) / (bHour - aHour) };
  }
  // jam sebelum keyframe pertama (bila tabel tidak mulai di 0): mengapit terakhir -> pertama
  const a = table[n - 1];
  const b = table[0];
  const span = b.hour + HOURS - a.hour;
  return { a, b, t: Math.min(1, (h + HOURS - a.hour) / span) };
}

/**
 * Cahaya gaya pada jam tertentu.
 * @param {number} hour jam desimal (wrap 24)
 * @param {ReadonlyArray<object>} [table]
 * @returns {{sunColor:number,hemiSky:number,hemiGround:number,fogColor:number,sunMul:number,hemiMul:number,expMul:number,split:number,haze:number}}
 */
export function lightByHour(hour, table = LIGHT_BY_HOUR) {
  const { a, b, t } = bracket(table, hour);
  const out = {};
  for (const k of NUMBER_KEYS) out[k] = lerp(a[k], b[k], t);
  for (const k of COLOR_KEYS) out[k] = lerpHex(a[k], b[k], t);
  return Object.freeze(out);
}
