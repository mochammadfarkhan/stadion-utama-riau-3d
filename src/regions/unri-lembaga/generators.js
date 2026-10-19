import { createRandom } from '../../world/siteutil/rng.js';

/**
 * Generator parametrik MURNI (tanpa three) untuk konten berulang zona Lembaga: barisan titik, pagar
 * bergerbang, dan undakan/tribun. Data per lokasi cukup berisi parameter (jumlah, jarak, arah, celah);
 * koordinat diturunkan di sini. Semua fungsi mengembalikan nilai baru (tanpa mutasi masukan).
 */

/** Interpolasi linear dua titik 2D. */
export const lerpPoint = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Deret skalar start, start+step, ... sampai ≤ end (+eps); akumulasi seperti loop `for`. */
export function evenSteps(start, end, step, eps = 1e-9) {
  const out = [];
  for (let v = start; v <= end + eps; v += step) out.push(v);
  return out;
}

/**
 * Barisan titik 2D: `count` titik berjarak `step` dari `from` ke arah (dx, dz) (dinormalkan), atau
 * `count` titik rata dari `from` ke `to` (bila `to` diberikan).
 * @returns {Array<[number, number]>}
 */
export function rowPoints({ from, to = null, dir = null, count, step = 1 }) {
  if (to) {
    return Array.from({ length: count }, (_, k) => lerpPoint(from, to, count === 1 ? 0 : k / (count - 1)));
  }
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len;
  const uz = dir[1] / len;
  return Array.from({ length: count }, (_, k) => [from[0] + ux * step * k, from[1] + uz * step * k]);
}

/**
 * Pagar lurus dari `from` ke `to` dengan celah (gerbang/pintu). `gaps` = [{ at, width }] jarak dari `from`
 * ke pusat celah dan lebar celah (m). Tiap potongan memperoleh tiang tiap ≤ `postSpacing` (ujung ikut).
 * @returns {{segments: Array<{a:[number,number], b:[number,number], r:number}>, posts: Array<[number,number]>}}
 */
export function fenceRuns({ from, to, gaps = [], postSpacing = 2.4, r = 0.25 }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const cuts = [...gaps].sort((p, q) => p.at - q.at);
  const spans = [];
  let t0 = 0;
  for (const g of cuts) {
    const g0 = Math.max(0, g.at - g.width / 2);
    if (g0 > t0) spans.push([t0, g0]);
    t0 = Math.min(len, g.at + g.width / 2);
  }
  if (t0 < len) spans.push([t0, len]);
  const at = (t) => lerpPoint(from, to, len === 0 ? 0 : t / len);
  const segments = [];
  const posts = [];
  for (const [s0, s1] of spans) {
    segments.push({ a: at(s0), b: at(s1), r });
    const n = Math.max(1, Math.ceil((s1 - s0) / postSpacing));
    for (let k = 0; k <= n; k += 1) posts.push(at(s0 + ((s1 - s0) * k) / n));
  }
  return { segments, posts };
}

/**
 * Undakan/tribun: profil tangga `rows` anak tangga. Anak tangga k (0 = terbawah) punya tepi depan di
 * x = frontX + dir * (k+1) * tread dan tinggi riser y = base + k * rise.
 * @returns {Array<{x:number, y:number}>} titik tepi bawah-depan tiap anak tangga + tinggi puncak
 */
export function stairSteps({ rows, tread, rise, frontX, base = 0, dir = -1 }) {
  return Array.from({ length: rows }, (_, k) => ({ x: frontX + dir * (k + 1) * tread, y: base + k * rise }));
}

/**
 * Titik di keliling kotak {minX, maxX, minZ, maxZ} yang dimasukkan `inset` m ke dalam, berjarak ≈ `step`
 * (sisi dibagi rata). `sides` memilih sisi ('n' = minZ, 's' = maxZ, 'w' = minX, 'e' = maxX).
 * @returns {Array<[number, number]>}
 */
export function boxPerimeter(box, { step, inset = 0, sides = ['n', 's', 'w', 'e'] }) {
  const x0 = box.minX + inset;
  const x1 = box.maxX - inset;
  const z0 = box.minZ + inset;
  const z1 = box.maxZ - inset;
  const run = (from, to) => rowPoints({ from, to, count: Math.max(2, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / step) + 1) });
  const edges = { n: [[x0, z0], [x1, z0]], s: [[x0, z1], [x1, z1]], w: [[x0, z0], [x0, z1]], e: [[x1, z0], [x1, z1]] };
  const out = [];
  for (const side of sides) out.push(...run(...edges[side]));
  return out;
}

/**
 * Titik acak berjarak ±rata (kisi `spacing` + jitter) di dalam kotak dengan seed tetap. `accept(x, z, rnd)` memfilter
 * (zona kosong, kerapatan). Deterministik; tanpa mutasi masukan.
 * @returns {Array<[number, number]>}
 */
export function jitteredGrid({ box, spacing, jitter = spacing * 0.4, seed = 1, accept = () => true }) {
  const rnd = createRandom(seed);
  const out = [];
  for (let z = box.minZ; z <= box.maxZ; z += spacing) {
    for (let x = box.minX; x <= box.maxX; x += spacing) {
      const px = x + rnd.range(-jitter, jitter);
      const pz = z + rnd.range(-jitter, jitter);
      if (accept(px, pz, rnd)) out.push([px, pz]);
    }
  }
  return out;
}

/**
 * Tiang dua deret sejajar sumbu Z pada sisi kiri/kanan kotak (gubuk/bangsal terbuka): jarak ≈ `spacing`
 * (dibagi rata, ujung ikut), masuk `inset` m dari tepi. @returns {Array<[number, number]>}
 */
export function postRows(box, { spacing, inset = 0.25 }) {
  const count = Math.max(2, Math.round((box.maxZ - box.minZ - 2 * inset) / spacing) + 1);
  return [box.minX + inset, box.maxX - inset].flatMap((x) => rowPoints({ from: [x, box.minZ + inset], to: [x, box.maxZ - inset], count }));
}

/** Panjang total polyline 2D. */
export function polylineLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i += 1) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return len;
}

/**
 * Polyline sejajar pada jarak `d` dari polyline asal: normal kanan-arah (tz, −tx) (menghadap timur bila arah ke
 * selatan/+Z); d < 0 = sisi sebaliknya. Simpul dalam memakai garis bagi (miter, dibatasi 2,5×).
 * @returns {Array<[number, number]>}
 */
export function polylineOffset(pts, d) {
  const dir = (a, b) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  return pts.map((p, i) => {
    const d1 = i > 0 ? dir(pts[i - 1], p) : null;
    const d2 = i < pts.length - 1 ? dir(p, pts[i + 1]) : null;
    const n1 = d1 ? [d1[1], -d1[0]] : null;
    const n2 = d2 ? [d2[1], -d2[0]] : null;
    if (!n1 || !n2) {
      const n = n1 ?? n2;
      return [p[0] + n[0] * d, p[1] + n[1] * d];
    }
    const sx = n1[0] + n2[0];
    const sz = n1[1] + n2[1];
    const sl = Math.hypot(sx, sz) || 1;
    const m = [sx / sl, sz / sl];
    const k = 1 / Math.max(m[0] * n1[0] + m[1] * n1[1], 0.4);
    return [p[0] + m[0] * d * k, p[1] + m[1] * d * k];
  });
}

/**
 * Stasiun berjarak tetap sepanjang polyline: tiap `step` m dari `start` (default setengah langkah) sampai ≤ `end`
 * (default panjang total). Tiap stasiun {x, z, tx, tz, s} (tx, tz = arah satuan polyline).
 */
export function polylineSteps(pts, step, { start = step / 2, end = polylineLength(pts) } = {}) {
  const out = [];
  let acc = 0;
  let next = start;
  for (let i = 0; i < pts.length - 1 && next <= end + 1e-9; i += 1) {
    const [a, b] = [pts[i], pts[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    while (next <= acc + len + 1e-9 && next <= end + 1e-9) {
      const t = (next - acc) / len;
      out.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len, s: next });
      next += step;
    }
    acc += len;
  }
  return out;
}

/** Potong polyline ke rentang jarak [s0, s1] (titik batas diinterpolasi). */
export function polylineSlice(pts, s0, s1) {
  const out = [];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [a, b] = [pts[i], pts[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lo = Math.max(s0, acc);
    const hi = Math.min(s1, acc + len);
    if (hi > lo && len > 0) {
      const p = (s) => lerpPoint(a, b, (s - acc) / len);
      if (out.length === 0) out.push(p(lo));
      out.push(p(hi));
    }
    acc += len;
  }
  return out;
}
