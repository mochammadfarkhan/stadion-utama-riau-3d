/**
 * Batas distrik UNRI (spec §6 bullet terakhir): poligon kampus OSM way 938374562 DIKURANGI mask stadion
 * yang di-buffer `maskMargin` m, lalu disederhanakan (Douglas–Peucker `tolerance` m) menjadi SATU ring.
 *
 * Algoritma (deterministik):
 * 1. buffer(mask, d) = gabungan (polygon-clipping `union`) dari mask + kapsul cembung tiap sisi = hull dua
 *    n-gon (`segments`) yang mengelilingi lingkaran jari-jari d di kedua ujung (jumlah Minkowski mask ⊕ cakram,
 *    didekati dari luar: jarak buffer ≥ d di semua arah).
 * 2. selisih = `difference(kampus, buffer)` → MultiPolygon. Diambil poligon dengan ring luar TERLUAS;
 *    lubang dan potongan lain dibuang (dilaporkan sebagai `droppedArea`) — spec menuntut ring tunggal.
 * 3. Douglas–Peucker tertutup: titik jangkar = verteks dengan x terkecil (seri: z terkecil) dan verteks
 *    terjauh darinya; kedua rantai disederhanakan terpisah.
 * 4. Orientasi luas bertanda positif (orientRing true), koordinat dibulatkan 0,01 m, mulai dari verteks
 *    x terkecil.
 * polygon-clipping hanya dipakai di tools (Node); runtime memakai hasil beku di src/districts/unri/boundary.js.
 */
import polygonClipping from 'polygon-clipping';
import { cleanRing, convexHull, orientRing, polygonArea } from '../../src/geo/polygon.js';

const close = (ring) => [...ring.map((p) => [p[0], p[1]]), [ring[0][0], ring[0][1]]];
const open = (ring) => cleanRing(ring, 1e-9);

/**
 * Titik n-gon yang MENGELILINGI lingkaran berjari-jari d di (x, z) (jari-jari d / cos(π/n): setiap sisi
 * menyinggung lingkaran, jadi buffer ≥ d di semua arah). Sudut digeser setengah langkah: sisi sejajar sumbu.
 */
function circlePoints(x, z, d, segments) {
  const out = [];
  const r = d / Math.cos(Math.PI / segments);
  for (let i = 0; i < segments; i += 1) {
    const t = ((i + 0.5) / segments) * Math.PI * 2;
    out.push([snap(x + r * Math.cos(t)), snap(z + r * Math.sin(t))]);
  }
  return out;
}

/** Bulatkan ke 1 µm: titik lingkaran bersama dua kapsul jadi identik persis (polygon-clipping peka titik hampir-sama). */
const snap = (v) => Math.round(v * 1e6) / 1e6;

/**
 * Buffer luar ring sejauh d (m): gabungan ring + "kapsul" cembung tiap sisi (hull dua lingkaran ujung).
 * Kapsul cembung tidak punya titik dalam yang hampir berimpit — union polygon-clipping stabil.
 * @returns {Array} MultiPolygon polygon-clipping
 */
export function bufferRing(ring, d, segments = 16) {
  const r = open(ring).map(([x, z]) => [snap(x), snap(z)]);
  const parts = [[close(r)]];
  for (let i = 0; i < r.length; i += 1) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    const hull = convexHull([...circlePoints(a[0], a[1], d, segments), ...circlePoints(b[0], b[1], d, segments)]);
    parts.push([close(hull)]);
  }
  return polygonClipping.union(...parts);
}

function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dz) / len;
}

/** Douglas–Peucker polyline terbuka (ujung dipertahankan). */
export function simplifyLine(pts, tol) {
  if (pts.length <= 2) return pts.map((p) => [p[0], p[1]]);
  let best = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const d = perpendicular(pts[i], pts[0], pts[pts.length - 1]);
    if (d > best) { best = d; idx = i; }
  }
  if (best <= tol) return [[pts[0][0], pts[0][1]], [pts[pts.length - 1][0], pts[pts.length - 1][1]]];
  const left = simplifyLine(pts.slice(0, idx + 1), tol);
  const right = simplifyLine(pts.slice(idx), tol);
  return [...left.slice(0, -1), ...right];
}

/** Douglas–Peucker ring tertutup (ring terbuka masuk & keluar). */
export function simplifyRing(ring, tol) {
  const r = open(ring);
  if (r.length <= 4) return r;
  let a = 0;
  r.forEach((p, i) => { if (p[0] < r[a][0] || (p[0] === r[a][0] && p[1] < r[a][1])) a = i; });
  let b = a;
  let far = -1;
  r.forEach((p, i) => {
    const d = Math.hypot(p[0] - r[a][0], p[1] - r[a][1]);
    if (d > far) { far = d; b = i; }
  });
  const rot = [...r.slice(a), ...r.slice(0, a)];
  const k = (b - a + r.length) % r.length;
  const first = simplifyLine(rot.slice(0, k + 1), tol);
  const second = simplifyLine([...rot.slice(k), rot[0]], tol);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

const round2 = (v) => Math.round(v * 100) / 100;

/** Mulai dari verteks x terkecil (seri: z terkecil) agar keluaran stabil. */
function startAtWest(ring) {
  let a = 0;
  ring.forEach((p, i) => { if (p[0] < ring[a][0] || (p[0] === ring[a][0] && p[1] < ring[a][1])) a = i; });
  return [...ring.slice(a), ...ring.slice(0, a)];
}

/**
 * @param {{campusRing:Array<[number,number]>, maskRing:Array<[number,number]>, maskMargin:number,
 *   tolerance:number, segments?:number}} opts koordinat dunia
 * @returns {{ring:Array<[number,number]>, area:number, campusArea:number, pieces:number, droppedArea:number}}
 */
export function computeBoundary({ campusRing, maskRing, maskMargin, tolerance, segments = 16 }) {
  const campus = [[close(open(campusRing))]];
  const diff = polygonClipping.difference(campus, bufferRing(maskRing, maskMargin, segments));
  if (diff.length === 0) throw new Error('batas distrik kosong setelah dikurangi mask stadion');
  const areaOf = (poly) => polygonArea(open(poly[0])) - poly.slice(1).reduce((s, h) => s + polygonArea(open(h)), 0);
  const sorted = [...diff].sort((p, q) => polygonArea(open(q[0])) - polygonArea(open(p[0])));
  const main = sorted[0];
  const totalArea = diff.reduce((s, p) => s + areaOf(p), 0);
  const simplified = simplifyRing(open(main[0]), tolerance);
  const ring = startAtWest(orientRing(simplified, true).map(([x, z]) => [round2(x), round2(z)]));
  const area = polygonArea(ring);
  return {
    ring, area, campusArea: polygonArea(open(campusRing)), pieces: diff.length, droppedArea: Math.max(0, totalArea - areaOf(main)),
  };
}

/**
 * Sumber modul `src/districts/unri/boundary.js` (data beku; runtime tanpa pustaka clipping).
 * @param {{ring:Array<[number,number]>, area:number}} result
 * @param {{osmTimestamp:string|null, wayId:number, maskMargin:number, tolerance:number}} meta
 */
export function boundaryModuleSource(result, meta) {
  const rows = [];
  for (let i = 0; i < result.ring.length; i += 4) {
    rows.push(`  ${result.ring.slice(i, i + 4).map(([x, z]) => `[${x}, ${z}]`).join(', ')},`);
  }
  return [
    '/**',
    ' * Batas distrik UNRI (dunia, +X timur, +Z selatan, meter). DIHASILKAN oleh',
    ' * `npm run bake:campus -- boundary` (tools/campusbake/boundary.js) — jangan disunting tangan.',
    ` * Sumber: OSM way ${meta.wayId} (© kontributor OpenStreetMap, ODbL), data ${meta.osmTimestamp ?? 'waktu tidak diketahui'};`,
    ` * dikurangi mask stadion + ${meta.maskMargin} m, Douglas–Peucker ${meta.tolerance} m, ring tunggal luas bertanda positif.`,
    ' */',
    'const RING = [',
    ...rows,
    '];',
    '',
    `/** Ring terbuka ${result.ring.length} titik, luas ${Math.round(result.area)} m². */`,
    'export const UNRI_BOUNDARY = Object.freeze(RING.map((p) => Object.freeze(p)));',
    '',
    'export const UNRI_BOUNDARY_META = Object.freeze({',
    `  wayId: ${meta.wayId},`,
    `  osmTimestamp: ${JSON.stringify(meta.osmTimestamp ?? null)},`,
    `  maskMargin: ${meta.maskMargin},`,
    `  tolerance: ${meta.tolerance},`,
    `  area: ${Math.round(result.area)},`,
    '});',
    '',
  ].join('\n');
}
