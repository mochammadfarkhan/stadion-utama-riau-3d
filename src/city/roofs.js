/**
 * Atap miring tambahan per tile kota (geometri, bukan tekstur): limasan untuk jejak persegi panjang, "rok" miring +
 * tutup datar untuk jejak bentuk lain (L/U), dan kotak kepala tangga/tandon di atap gedung tinggi. Dipasang DI ATAS
 * atap datar hasil bake (yang tetap ada di bawahnya). Rumah kecil persegi sudah berpelana dari bake → dilewati.
 * Bagian hitung murni (kecuali ShapeUtils untuk triangulasi tutup); perakit THREE di bawah.
 * Ring = Array<[x, z]> dunia (meter). "CCW" di sini = luas bertanda positif menurut polygon.js.
 * Segitiga = [[x,y,z],[x,y,z],[x,y,z]], urutan putar sehingga normal menghadap atas/keluar.
 */
import * as THREE from 'three';
import { cleanRing, orientRing, pointInPolygon, signedArea } from '../geo/polygon.js';
import { hexToLinear } from './tilePalette.js';

export const ROOFS = Object.freeze({
  skipArea: 150, eave: 0.5, pitch: Math.tan((28 * Math.PI) / 180), maxRise: 4.5, flatAbove: 16, inset: 6.0, minInsetRatio: 0.3,
});
const BAKE_GABLE_TOL = 0.2; // |cos| sudut maksimum yang dipakai bake untuk pelana (tools/citybake/geometry/buildings.js)
const MIN_AREA = 20;
const TERRACOTTA = ['#cf6d3f', '#bb5232', '#d98a4a', '#c0633b', '#a54d36'].map(hexToLinear);
const CONCRETE = { stair: hexToLinear('#b9b6ae'), tank: hexToLinear('#8f8d88') };
const BOXES = { stair: [3, 4, 2.6], tank: [2, 2, 2] }; // lebar (u), panjang (v), tinggi

export { signedArea };

/** Salinan ring berluas bertanda positif ("CCW" konvensi proyek). */
export const ensureCCW = (ring) => orientRing(ring, true);

/** Hash deterministik [0, 1) dari tiga bilangan bulat (salinan kecil hash01 di tileDetail.js). */
function rnd(a, b, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const keyHash = (key) => [...String(key)].reduce((s, ch) => (Math.imul(s, 31) + ch.charCodeAt(0)) | 0, 7);

/** Normal (tak dinormalkan) segitiga = (b−a)×(c−a). */
export function triNormal([a, b, c]) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
}

/** Tambah segitiga berorientasi searah `hint`; segitiga berluas ≈ 0 dibuang. */
function face(out, a, b, c, hint = [0, 1, 0]) {
  const n = triNormal([a, b, c]);
  if (Math.hypot(n[0], n[1], n[2]) < 1e-6) return;
  out.push(n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? [a, c, b] : [a, b, c]);
}

/** Buang titik yang segaris dengan tetangganya (sama dengan bake). */
function dropCollinear(ring) {
  const out = ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const cr = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return Math.abs(cr) > 1e-3 * Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  return out.length >= 3 ? out : ring;
}

/**
 * Bingkai persegi panjang: ring 4 titik (setelah titik segaris dibuang) bersudut ≈ 90° (|cos| ≤ tol) dan sisi
 * berhadapan hampir sama (selisih ≤ tol × sisi) → { c, u (arah sisi panjang), v, hu ≥ hv }; selain itu null.
 */
export function rectFrame(ring, tol = 0.12) {
  const r = dropCollinear(cleanRing(ring));
  if (r.length !== 4) return null;
  const len = [];
  for (let i = 0; i < 4; i += 1) {
    const a = r[(i + 3) % 4];
    const p = r[i];
    const b = r[(i + 1) % 4];
    const u = [a[0] - p[0], a[1] - p[1]];
    const v = [b[0] - p[0], b[1] - p[1]];
    const lu = Math.hypot(...u);
    const lv = Math.hypot(...v);
    if (lu < 1e-6 || lv < 1e-6 || !(Math.abs((u[0] * v[0] + u[1] * v[1]) / (lu * lv)) <= tol)) return null;
    len.push(lv); // panjang sisi i → i+1
  }
  if (Math.abs(len[0] - len[2]) > tol * Math.max(len[0], len[2]) || Math.abs(len[1] - len[3]) > tol * Math.max(len[1], len[3])) return null;
  const k = len[0] + len[2] >= len[1] + len[3] ? 0 : 1; // sisi panjang
  const d0 = [r[k + 1][0] - r[k][0], r[k + 1][1] - r[k][1]];
  const d2 = [r[k + 2][0] - r[(k + 3) % 4][0], r[k + 2][1] - r[(k + 3) % 4][1]]; // sisi berhadapan, searah d0
  const dx = d0[0] + d2[0];
  const dz = d0[1] + d2[1];
  const l = Math.hypot(dx, dz);
  const c = [r.reduce((s, p) => s + p[0], 0) / 4, r.reduce((s, p) => s + p[1], 0) / 4];
  return { c, u: [dx / l, dz / l], v: [-dz / l, dx / l], hu: (len[k] + len[k + 2]) / 4, hv: (len[k + 1] + len[(k + 3) % 4]) / 4 };
}

/** Limasan di atas persegi yang diperlebar `eave`; bubungan sepanjang u (panjang 0 → piramida). */
export function hipRoof({ c, u, v, hu, hv }, eaveY, o = ROOFS) {
  const H = hu + o.eave;
  const V = hv + o.eave;
  const top = eaveY + Math.min(V * o.pitch, o.maxRise);
  const r = Math.max(0, H - V);
  const P = (s, t, y) => [c[0] + u[0] * s + v[0] * t, y, c[1] + u[1] * s + v[1] * t];
  const A = P(-H, -V, eaveY);
  const B = P(H, -V, eaveY);
  const C = P(H, V, eaveY);
  const D = P(-H, V, eaveY);
  const R1 = P(-r, 0, top);
  const R2 = P(r, 0, top);
  const out = [];
  face(out, A, B, R2); face(out, A, R2, R1);
  face(out, D, C, R2); face(out, D, R2, R1);
  face(out, B, C, R2);
  face(out, A, D, R1);
  return out;
}

const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segCross = (a, b, c, d) => cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0;

/** Offset ke dalam sejauh d (miter ≤ 3d), jumlah titik sama; null bila menyusut berlebihan, terbalik, atau berpotongan sendiri. */
export function insetRing(ring, d, o = ROOFS) {
  const n = ring.length;
  if (n < 3) return null;
  const inward = (i) => {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  const out = ring.map((p, i) => {
    const n0 = inward((i + n - 1) % n);
    const n1 = inward(i);
    const mx = n0[0] + n1[0];
    const mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-9) return [p[0] + n1[0] * d, p[1] + n1[1] * d];
    const cosHalf = (mx * n0[0] + mz * n0[1]) / ml;
    const dist = Math.min(d / Math.max(cosHalf, 1e-9), 3 * d);
    return [p[0] + (mx / ml) * dist, p[1] + (mz / ml) * dist];
  });
  const a0 = signedArea(ring);
  const a1 = signedArea(out);
  if (!(a1 > 0) || a1 <= o.minInsetRatio * a0) return null;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (segCross(out[i], out[(i + 1) % n], out[j], out[(j + 1) % n])) return null;
    }
  }
  return out;
}

/** Bentuk bukan persegi: pita miring dari tepi ke cincin dalam + tutup datar. Tak sah → []. */
export function skirtRoof(ring, eaveY, o = ROOFS) {
  const r = ensureCCW(cleanRing(ring));
  let d = o.inset;
  let inner = insetRing(r, d, o);
  if (!inner) { d /= 2; inner = insetRing(r, d, o); }
  if (!inner) return [];
  const top = eaveY + Math.min(d * o.pitch, o.maxRise);
  const out = [];
  for (let i = 0; i < r.length; i += 1) {
    const j = (i + 1) % r.length;
    const a = [r[i][0], eaveY, r[i][1]];
    const b = [r[j][0], eaveY, r[j][1]];
    const ai = [inner[i][0], top, inner[i][1]];
    const bi = [inner[j][0], top, inner[j][1]];
    face(out, a, b, bi); face(out, a, bi, ai);
  }
  const tri = THREE.ShapeUtils.triangulateShape(inner.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (const [i, j, k] of tri) face(out, [inner[i][0], top, inner[i][1]], [inner[j][0], top, inner[j][1]], [inner[k][0], top, inner[k][1]]);
  return out;
}

/** Kotak tanpa alas (4 sisi + tutup) berpusat (x, z), sisi searah u/v. */
function box(x, z, u, v, [w, l, h], y0) {
  const P = (s, t, y) => [x + u[0] * s + v[0] * t, y, z + u[1] * s + v[1] * t];
  const out = [];
  const cs = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]];
  for (let i = 0; i < 4; i += 1) {
    const [s0, t0] = cs[i];
    const [s1, t1] = cs[(i + 1) % 4];
    const ms = (s0 + s1) / 2;
    const mt = (t0 + t1) / 2;
    const hint = [u[0] * ms + v[0] * mt, 0, u[1] * ms + v[1] * mt];
    face(out, P(s0, t0, y0), P(s1, t1, y0), P(s1, t1, y0 + h), hint);
    face(out, P(s0, t0, y0), P(s1, t1, y0 + h), P(s0, t0, y0 + h), hint);
  }
  const T = cs.map(([s, t]) => P(s, t, y0 + h));
  face(out, T[0], T[1], T[2]); face(out, T[0], T[2], T[3]);
  return out;
}

/** 1–3 kotak (kepala tangga + tandon) acak-deterministik di dalam ring yang di-inset 2 m. */
export function rooftopBoxes(ring, eaveY, seed) {
  const r = ensureCCW(cleanRing(ring));
  const inner = insetRing(r, 2);
  if (!inner) return [];
  let best = 0; // sisi terpanjang → arah u
  let u = [1, 0];
  for (let i = 0; i < r.length; i += 1) {
    const b = r[(i + 1) % r.length];
    const l = Math.hypot(b[0] - r[i][0], b[1] - r[i][1]);
    if (l > best) { best = l; u = [(b[0] - r[i][0]) / l, (b[1] - r[i][1]) / l]; }
  }
  const v = [-u[1], u[0]];
  const xs = inner.map((p) => p[0]);
  const zs = inner.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const count = 1 + Math.floor(rnd(seed, 1, 2) * 3);
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const kind = k === 0 ? 'stair' : 'tank';
    const [w, l] = BOXES[kind];
    for (let t = 0; t < 8; t += 1) {
      const x = x0 + rnd(seed, k * 17 + t, 3) * (x1 - x0);
      const z = z0 + rnd(seed, k * 17 + t, 4) * (z1 - z0);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + (u[0] * a * w + v[0] * b * l) / 2, z + (u[1] * a * w + v[1] * b * l) / 2]);
      if (!pointInPolygon(x, z, inner) || !corners.every(([px, pz]) => pointInPolygon(px, pz, inner))) continue;
      out.push({ tris: box(x, z, u, v, BOXES[kind], eaveY), rgb: CONCRETE[kind] });
      break;
    }
  }
  return out;
}

/**
 * Atap tambahan satu gedung → { tris, colors (linear per segitiga), kind }.
 * kind: 'none' (terlalu kecil / pelana bake / tak sah), 'boxes', 'hip', 'skirt'.
 */
export function buildingRoof(building, seed, o = ROOFS) {
  const empty = (kind = 'none') => ({ tris: [], colors: [], kind });
  const ring = ensureCCW(cleanRing(building.ring ?? []));
  if (ring.length < 3) return empty();
  const area = signedArea(ring);
  if (area < MIN_AREA) return empty();
  if (area <= o.skipArea && rectFrame(ring, BAKE_GABLE_TOL)) return empty('gable');
  const h = building.height;
  if (h > o.flatAbove) {
    const tris = [];
    const colors = [];
    for (const b of rooftopBoxes(ring, h, seed)) for (const t of b.tris) { tris.push(t); colors.push(b.rgb); }
    return { tris, colors, kind: 'boxes' };
  }
  const frame = rectFrame(ring);
  const tris = frame ? hipRoof(frame, h, o) : skirtRoof(ring, h, o);
  if (!tris.length) return empty('invalid');
  const base = TERRACOTTA[Math.floor(rnd(seed, 7, 1) * TERRACOTTA.length)];
  const k = 0.92 + rnd(seed, 7, 2) * 0.16;
  const colors = tris.map((t) => {
    const n = triNormal(t);
    const dark = n[0] + n[2] < -1e-6 ? 0.94 : 1; // sisi menghadap −x/−z sedikit lebih gelap: bubungan terbaca
    return base.map((ch) => ch * k * dark);
  });
  return { tris, colors, kind: frame ? 'hip' : 'skirt' };
}

/** Satu Mesh `atap` (non-indexed, warna & normal datar per segitiga) untuk semua gedung tile; null bila kosong. */
export function createRoofMesh(tile, material) {
  const { x: cx, z: cz } = tile.center;
  const kh = keyHash(tile.key);
  const pos = [];
  const col = [];
  const nor = [];
  tile.buildings.forEach((b, i) => {
    const { tris, colors } = buildingRoof(b, (kh ^ Math.imul(i + 1, 2654435761)) | 0);
    tris.forEach((t, j) => {
      const n = triNormal(t);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      for (const p of t) {
        pos.push(p[0] - cx, p[1], p[2] - cz);
        col.push(...colors[j]);
        nor.push(n[0] / l, n[1] / l, n[2] / l);
      }
    });
  });
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'atap';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
