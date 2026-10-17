/**
 * Buang fitur kota di dalam mask region handmade. Mask berupa ring dalam koordinat DUNIA
 * (config.REGION_MASKS = mask region klien yang sudah ditransformasi placement).
 *
 * Poligon (bangunan/air/landuse) dibuang bila centroid ring luarnya di dalam mask; polyline dipotong:
 * segmen yang titik tengahnya di dalam mask dibuang, sisa yang bersambung menjadi fitur baru (`<id>~k`).
 */
import { pointInPolygon, polygonCentroid } from '../../src/geo/polygon.js';

const insideAny = (x, z, rings) => rings.some((r) => pointInPolygon(x, z, r));

/** Pecah polyline menjadi bagian di luar semua mask. */
export function splitLineOutside(line, rings) {
  const parts = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    if (insideAny((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, rings)) {
      cur = null;
      continue;
    }
    if (!cur) {
      cur = [a];
      parts.push(cur);
    }
    cur.push(b);
  }
  return parts;
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia
 * @param {Array<Array<[number, number]>>} rings ring mask dunia
 * @returns {import('./features.js').Feature[]} fitur baru (input tidak dimutasi)
 */
export function applyMasks(features, rings) {
  if (rings.length === 0) return features.slice();
  const out = [];
  for (const f of features) {
    if (f.rings) {
      const c = polygonCentroid(f.rings[0]);
      if (!insideAny(c.x, c.z, rings)) out.push(f);
      continue;
    }
    const parts = splitLineOutside(f.line, rings);
    if (parts.length === 1 && parts[0].length === f.line.length) out.push(f);
    else parts.forEach((line, k) => out.push({ ...f, id: `${f.id}~${k}`, line }));
  }
  return out;
}
