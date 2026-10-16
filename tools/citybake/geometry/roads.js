/**
 * Pita (ribbon) datar dari polyline: jalan dan sungai garis. Sambungan miter dengan batas panjang
 * (MITER_LIMIT × setengah lebar) agar tikungan tajam tidak meruncing jauh. Koordinat tile-lokal.
 * Polyline tertutup (titik pertama == terakhir, mis. bundaran) mendapat miter juga di sambungan penutup.
 */
import { addUpTriangle } from './meshBuilder.js';

export const MITER_LIMIT = 2;
const EPS = 1e-6;

const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPS;

/** Buang titik berurutan yang berimpit. */
function dedupe(line) {
  return line.filter((p, i) => i === 0 || !samePoint(p, line[i - 1]));
}

/** Normal kiri satuan dari segmen a→b. */
function leftNormal(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz);
  return [-dz / l, dx / l];
}

/** Offset (arah × panjang) di titik p dengan tetangga prev/next (null = ujung terbuka). */
function offsetAt(prev, p, next, half) {
  const n1 = prev ? leftNormal(prev, p) : null;
  const n2 = next ? leftNormal(p, next) : null;
  if (!n1 || !n2) {
    const n = n1 ?? n2;
    return [n[0] * half, n[1] * half];
  }
  const sx = n1[0] + n2[0];
  const sz = n1[1] + n2[1];
  const sl = Math.hypot(sx, sz);
  if (sl < EPS) return [n1[0] * half, n1[1] * half]; // balik arah 180°
  const m = [sx / sl, sz / sl];
  const cos = m[0] * n1[0] + m[1] * n1[1];
  const len = Math.min(half / Math.max(cos, EPS), half * MITER_LIMIT);
  return [m[0] * len, m[1] * len];
}

/**
 * Offset untuk setiap titik `pts`. Bila tertutup, titik terakhir (== pertama) dibungkus ke tetangga
 * sisi lain sehingga pangkal dan ujung berbagi offset miter yang sama (cincin rapat, tanpa celah).
 */
function offsets(pts, half) {
  const n = pts.length;
  const closed = n >= 4 && samePoint(pts[0], pts[n - 1]);
  return pts.map((p, i) => {
    if (closed && (i === 0 || i === n - 1)) return offsetAt(pts[n - 2], p, pts[1], half);
    return offsetAt(i > 0 ? pts[i - 1] : null, p, i < n - 1 ? pts[i + 1] : null, half);
  });
}

/**
 * Tambah pita selebar `width` pada ketinggian y.
 * @returns {number} jumlah segitiga yang ditambahkan
 */
export function addRibbon(builder, line, width, y, rgb) {
  const pts = dedupe(line);
  if (pts.length < 2) return 0;
  const base = builder.vertexCount;
  const xz = [];
  offsets(pts, width / 2).forEach(([ox, oz], i) => {
    const l = [pts[i][0] + ox, pts[i][1] + oz];
    const r = [pts[i][0] - ox, pts[i][1] - oz];
    builder.addVertex(l[0], y, l[1], 0, 1, 0, rgb);
    builder.addVertex(r[0], y, r[1], 0, 1, 0, rgb);
    xz.push(l, r);
  });
  const at = (idx) => xz[idx - base];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const l0 = base + 2 * i;
    const r0 = l0 + 1;
    const l1 = l0 + 2;
    const r1 = l0 + 3;
    addUpTriangle(builder, l0, r0, r1, at);
    addUpTriangle(builder, l0, r1, l1, at);
  }
  return 2 * (pts.length - 1);
}
