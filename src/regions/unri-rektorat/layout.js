// src/regions/unri-rektorat/layout.js
/**
 * Tata letak region unri-rektorat (data murni, region-lokal; +X timur, +Z selatan). Posisi dipilih
 * terhadap geometri OSM beku (site.data.js) dengan jarak bebas jalan/air yang dites
 * (tests/unri/rektoratLayout.test.js). [INFERENSI] dari foto drone 2016 (Commons Taman_Unri.jpg): poros
 * diapit barisan pohon tinggi ramping + palem, rumput luas, jalan setapak beton; batu pijakan beton di
 * danau (arah lintasan = inferensi); posisi PJU, bangku, papan nama = inferensi.
 */
import { pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { createRng } from '../../world/util/random.js';
import { DANAU_RING } from './site.data.js';

const r2 = (v) => Math.round(v * 100) / 100;
const freezeAll = (list) => Object.freeze(list.map((p) => Object.freeze(p)));
const freezeRing = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));
const rect = (x0, z0, x1, z1) => freezeRing([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);

/**
 * Batu pijakan di sepanjang segmen from→to tiap `spacing` m; hanya yang di dalam `ring` (air) dan
 * ≥ `minEdge` dari tepi. Murni.
 * @returns {ReadonlyArray<{x:number, z:number}>}
 */
export function steppingStones(ring, from, to, spacing = 1.1, minEdge = 0.6) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const out = [];
  for (let s = 0; s <= len + 1e-9; s += spacing) {
    const x = from[0] + (dx * s) / len;
    const z = from[1] + (dz * s) / len;
    if (pointInPolygon(x, z, ring) && distanceToRing(x, z, ring) >= minEdge) out.push({ x: r2(x), z: r2(z) });
  }
  return freezeAll(out);
}

/**
 * Satu baris pohon dengan jitter, rotasi, dan skala (deterministik dari rnd); ±7% pohon tidak ada (celah alami,
 * rng tetap dimajukan agar deretan lain tidak bergeser) supaya barisan tidak seperti kebun bibit.
 */
function treeRow(rnd, x0, x1, step, z) {
  const out = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    const p = {
      x: r2(x + (rnd() - 0.5) * 1.4),
      z: r2(z + (rnd() - 0.5) * 0.6),
      rotY: r2(rnd() * Math.PI * 2),
      scale: r2(0.78 + rnd() * 0.44),
    };
    if (rnd() >= 0.07) out.push(p);
  }
  return out;
}

const rnd = createRng(1962);

/** V04 akasia ramping: 2 baris di tepi median poros + 2 baris di luar jalan loop (12 per baris). */
const AKASIA = freezeAll([
  ...treeRow(rnd, 92, 202, 10, 0.4),
  ...treeRow(rnd, 92, 202, 10, 8.0),
  ...treeRow(rnd, 92, 202, 10, -9.5),
  ...treeRow(rnd, 92, 202, 10, 17.8),
]);

/** V05 palem: taman depan Rektorat, pulau parkir, poros (berselang-seling), bundaran (mengapit N01). */
const PALEM = freezeAll([
  ...[-30, -22, -14, 14, 22, 30].map((z, i) => ({ x: 18.5, z, rotY: r2(i * 1.3), scale: 1 })),
  { x: 45.5, z: -13, rotY: 0.4, scale: 0.95 },
  { x: 60, z: -13, rotY: 1.7, scale: 1.05 },
  { x: 45.5, z: 17, rotY: 2.9, scale: 1.05 },
  { x: 60, z: 17, rotY: 4.1, scale: 0.95 },
  ...[97, 117, 137, 157, 177, 197].map((x, i) => ({ x, z: i % 2 ? 6.5 : 1.9, rotY: r2(i * 2.1), scale: r2(0.9 + (i % 3) * 0.08) })),
  { x: 287.5, z: 4.5, rotY: 0.8, scale: 1 },
  { x: 286.5, z: 16.0, rotY: 2.2, scale: 1 },
  { x: 272.0, z: 27.5, rotY: 3.6, scale: 0.9 },
]);

/** PJU (lengan menghadap jalan terdekat; rotY konvensi Object3D). Juga sumber nightLights region. */
const PJU = freezeAll([
  ...[-30, -10, 10, 30].map((z) => ({ x: 31.0, z, rotY: Math.PI })),
  ...[97, 127, 157, 187].map((x) => ({ x, z: -0.6, rotY: Math.PI / 2 })),
  ...[112, 142, 172].map((x) => ({ x, z: 8.8, rotY: -Math.PI / 2 })),
  { x: 283.5, z: 2.5, rotY: 0 },
  { x: 279.5, z: 22.0, rotY: 0 },
  ...[[239.3, 47.4], [209.3, 65.2], [179.3, 83.1]].map(([x, z]) => ({ x, z, rotY: -1.033 })),
]);

/** P04 bangku beton taman: tepi jalan setapak poros + tepi trotoar danau. */
const BANGKU = freezeAll([
  ...[107, 147, 187].map((x) => ({ x, z: 2.45, rotY: 0 })),
  ...[127, 167].map((x) => ({ x, z: 5.95, rotY: 0 })),
  { x: 224.2, z: 56.0, rotY: -2.604 },
  { x: 194.2, z: 73.9, rotY: -2.604 },
]);

export const LAYOUT = Object.freeze({
  akasia: AKASIA,
  palem: PALEM,
  pju: PJU,
  bangku: BANGKU,
  /** P06 tiang bendera Merah Putih di tengah pulau taman parkir, pada sumbu Rektorat. */
  tiangBendera: Object.freeze({ x: 52.8, z: 0, tinggi: 12 }),
  /** Tiang kanopi biru N03 (4 sudut tonjolan depan OSM). */
  kanopiTiang: freezeAll([{ x: 17.9, z: -3.7 }, { x: 17.9, z: 3.7 }, { x: 25.6, z: -3.7 }, { x: 25.6, z: 3.7 }]),
  /** Lampu taman hitam berlentera ganda di tepi plaza depan [T Street View 2025; posisi INFERENSI]. */
  lampuTaman: freezeAll([{ x: 23.4, z: -9.2 }, { x: 23.4, z: 9.2 }, { x: 19.6, z: -9.2 }, { x: 19.6, z: 9.2 }, { x: 15.4, z: -9.2 }, { x: 15.4, z: 9.2 }]),
  /** Teras lobi 0,9 m + 4 anak tangga (tidak dapat dilalui sepeda). */
  teras: Object.freeze({ x0: 17.1, x1: 22.4, z0: -6.5, z1: 6.5 }),
  /** Papan nama gedung granit hitam di taman depan (N05 gaya; INFERENSI posisi). */
  papanNama: Object.freeze({ x: 21.0, z: -12.0, w: 4.0, h: 0.8 }),
  /** N01 papan batu lengkung "UNIVERSITAS RIAU" di taman bundaran, menghadap timur (lalu lintas datang). */
  papanBatu: Object.freeze({ x: 285.5, z: 10.0, yaw: -Math.PI / 2, w: 6, d: 1.2, h: 1.6 }),
  /** P11 batu pijakan beton menyeberangi danau dari ujung poros ke trotoar selatan. */
  batuPijakan: steppingStones(DANAU_RING, [226, 16], [240, 44.5], 1.1, 0.6),
  /** Taman tengah putaran (bulan sabit antara putaran & ujung timur danau). */
  tamanBundaran: freezeRing([
    [281.0, 0.0], [285.0, 0.5], [289.5, 4.5], [291.0, 10.5], [290.0, 15.5], [286.5, 19.5], [279.0, 24.5],
    [268.0, 31.0], [261.5, 34.5], [259.0, 34.0], [264.5, 29.0], [272.0, 22.5], [278.0, 16.0], [280.0, 7.0],
  ]),
  /** Trotoar beton tinggi sisi danau (foto 2016), as 6 m dari as Jl. Muchtar Lutfi selatan. */
  trotoarDanau: freezeRing([[249.0, 43.1], [160.0, 96.1]]),
  /** Jalan setapak beton di tengah median poros. */
  jalurPoros: freezeRing([[89.5, 4.2], [206, 4.2]]),
  plazaDepan: rect(13.7, -10, 24.2, 10),
  jalurFasad: rect(11.8, -32.2, 13.7, 32.2),
  rumputDepan: Object.freeze([rect(13.7, -32.2, 24.2, -10), rect(13.7, 10, 24.2, 32.2)]),
  pulauParkir: rect(43.3, -15.4, 62.2, 19.5),
});
