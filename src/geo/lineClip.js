/**
 * Potong polyline terhadap ring poligon secara EKSAK (titik potong tepat di tepi ring). Murni.
 * Dipakai citybake (bagian jalan kota di luar distrik) dan campusbake ground (bagian di dalam distrik +
 * tumpang `overlap` m agar sambungan dengan jalan kota tertutup). Tiap sub-segmen diklasifikasi memakai
 * titik tengahnya (pointInPolygon), sehingga simpul yang tepat di tepi ring tidak bermasalah.
 */
import { pointInPolygon } from './polygon.js';

const EPS = 1e-9;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Jarak kumulatif tiap simpul dari awal polyline. */
function cumulative(line) {
  const cum = [0];
  for (let i = 1; i < line.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  }
  return cum;
}

/** Panjang polyline (m). */
export const polylineLength = (line) => (line.length < 2 ? 0 : cumulative(line)[line.length - 1]);

/** Parameter t ∈ (0, 1) tempat segmen a→b memotong tepi-tepi ring; urut naik, unik. */
function crossings(a, b, ring) {
  const ts = [];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < EPS) continue; // sejajar/kolinear: tidak menambah titik potong
    const wx = p[0] - a[0];
    const wz = p[1] - a[1];
    const t = (wx * ez - wz * ex) / den;
    const u = (wx * dz - wz * dx) / den;
    if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  return ts.filter((t, i) => i === 0 || t - ts[i - 1] > EPS);
}

/** Titik pada jarak s (memakai cum); tepat sama dengan simpul bila s jatuh di simpul. */
function pointAt(line, cum, s) {
  const last = line.length - 1;
  if (s <= 0) return [line[0][0], line[0][1]];
  if (s >= cum[last]) return [line[last][0], line[last][1]];
  let i = 0;
  while (i < last - 1 && cum[i + 1] < s) i += 1;
  const len = cum[i + 1] - cum[i];
  const t = len > 0 ? (s - cum[i]) / len : 0;
  if (t <= 0) return [line[i][0], line[i][1]];
  if (t >= 1) return [line[i + 1][0], line[i + 1][1]];
  return lerp(line[i], line[i + 1], t);
}

/** Sub-polyline antara jarak s0..s1 (di-clamp); [] bila panjangnya ≈ 0. */
function sliceByCum(line, cum, s0, s1) {
  const total = cum[cum.length - 1];
  const a = Math.max(0, Math.min(total, s0));
  const b = Math.max(0, Math.min(total, s1));
  if (b - a < EPS) return [];
  const pts = [pointAt(line, cum, a)];
  for (let i = 1; i < line.length - 1; i += 1) {
    if (cum[i] > a + EPS && cum[i] < b - EPS) pts.push([line[i][0], line[i][1]]);
  }
  pts.push(pointAt(line, cum, b));
  return pts;
}

/** Sub-polyline menurut jarak sepanjang polyline (meter dari awal). */
export function slicePolyline(line, s0, s1) {
  return line.length < 2 ? [] : sliceByCum(line, cumulative(line), s0, s1);
}

/** Interval jarak [s0, s1] berurutan dengan status di dalam/di luar ring (interval sejenis digabung). */
function intervals(line, ring) {
  const cum = cumulative(line);
  const list = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = cum[i + 1] - cum[i];
    if (len < EPS) continue;
    const ts = [0, ...crossings(a, b, ring), 1];
    for (let k = 0; k < ts.length - 1; k += 1) {
      const m = lerp(a, b, (ts[k] + ts[k + 1]) / 2);
      const inside = pointInPolygon(m[0], m[1], ring);
      const s0 = cum[i] + ts[k] * len;
      const s1 = cum[i] + ts[k + 1] * len;
      const last = list[list.length - 1];
      if (last && last.inside === inside) last.s1 = s1;
      else list.push({ s0, s1, inside });
    }
  }
  return { cum, list };
}

/**
 * Bagi polyline menjadi potongan di dalam dan di luar ring.
 * @param {Array<[number, number]>} line @param {Array<[number, number]>} ring ring terbuka
 * @returns {{inside: Array<Array<[number, number]>>, outside: Array<Array<[number, number]>>}}
 */
export function splitPolylineByRing(line, ring) {
  const inside = [];
  const outside = [];
  if (line.length < 2) return { inside, outside };
  const { cum, list } = intervals(line, ring);
  for (const iv of list) {
    const part = sliceByCum(line, cum, iv.s0, iv.s1);
    if (part.length >= 2) (iv.inside ? inside : outside).push(part);
  }
  return { inside, outside };
}

/**
 * Potongan di dalam ring; tiap ujung yang memotong tepi diperpanjang `overlap` m menyusuri polyline asli
 * (berhenti di ujung polyline). Potongan yang perpanjangannya bertumpuk digabung.
 */
export function insideWithOverlap(line, ring, overlap) {
  if (line.length < 2) return [];
  const { cum, list } = intervals(line, ring);
  const total = cum[cum.length - 1];
  const merged = [];
  for (const iv of list.filter((v) => v.inside)) {
    const s0 = Math.max(0, iv.s0 - overlap);
    const s1 = Math.min(total, iv.s1 + overlap);
    const last = merged[merged.length - 1];
    if (last && s0 <= last.s1) last.s1 = Math.max(last.s1, s1);
    else merged.push({ s0, s1 });
  }
  return merged.map((iv) => sliceByCum(line, cum, iv.s0, iv.s1)).filter((p) => p.length >= 2);
}
