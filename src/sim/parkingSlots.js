/**
 * Slot parkir motor (murni): baris rapat di dalam poligon parkir (ring dunia dari data ground M2), sumbu baris
 * sejajar sisi terpanjang poligon, pasangan baris saling membelakangi dengan lorong di antara pasangan.
 * Model motor menghadap −Z lokal (aturan katalog aset): rotY dipilih agar moncong menghadap lorong.
 * Parkir padat = riset §4 [S]; ukuran celah [INFERENSI].
 */
import { pointInPolygon } from '../geo/polygon.js';
import { mulberry32 } from './campusLife.js';

export const MOTOR_SLOT = Object.freeze({
  pitch: 0.85,    // jarak antar-motor sebaris (lebar 0,7 + celah 0,15)
  pairGap: 2.05,  // jarak sumbu dua baris saling membelakangi
  aisle: 3.4,     // jarak sumbu baris ke pasangan berikutnya (lorong ±1,4 m)
  margin: 0.6,    // jarak dari tepi poligon
  halfW: 0.37,
  halfL: 0.98,
  maxSlots: 600,  // budget per area
});

/** Bobot varian A01–A04 [INFERENSI: matic & bebek dominan di parkiran kampus]. */
export const VARIANT_WEIGHTS = Object.freeze([
  Object.freeze(['A01', 0.38]),
  Object.freeze(['A02', 0.42]),
  Object.freeze(['A03', 0.12]),
  Object.freeze(['A04', 0.08]),
]);

const round = (v, d) => Number(v.toFixed(d)) + 0;

function longestEdgeAxis(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len > 1e-6 && (!best || len > best.len)) best = { x: dx / len, z: dz / len, len };
  }
  return best;
}

function footprintInside(ring, x, z, u, v, o) {
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      const cx = x + u.x * o.halfW * su + v.x * o.halfL * sv;
      const cz = z + u.z * o.halfW * su + v.z * o.halfL * sv;
      if (!pointInPolygon(cx, cz, ring)) return false;
    }
  }
  return true;
}

/**
 * @param {Array<[number, number]>} ring poligon parkir (dunia)
 * @param {Partial<typeof MOTOR_SLOT>} [opts]
 * @returns {Array<{x:number, z:number, rotY:number}>}
 */
export function parkingSlots(ring, opts = {}) {
  const o = { ...MOTOR_SLOT, ...opts };
  if (!Array.isArray(ring) || ring.length < 3) return [];
  const u = longestEdgeAxis(ring);
  if (!u) return [];
  const v = { x: -u.z, z: u.x };
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const [x, z] of ring) {
    const a = x * u.x + z * u.z;
    const b = x * v.x + z * v.z;
    minA = Math.min(minA, a);
    maxA = Math.max(maxA, a);
    minB = Math.min(minB, b);
    maxB = Math.max(maxB, b);
  }
  const slots = [];
  let b = minB + o.margin + o.halfL;
  let row = 0;
  while (b <= maxB - o.margin - o.halfL + 1e-9) {
    const face = row % 2 === 0 ? -1 : 1;
    const rotY = round(Math.atan2(-v.x * face, -v.z * face), 4);
    for (let a = minA + o.margin + o.halfW; a <= maxA - o.margin - o.halfW + 1e-9; a += o.pitch) {
      const x = a * u.x + b * v.x;
      const z = a * u.z + b * v.z;
      if (!footprintInside(ring, x, z, u, v, o)) continue;
      slots.push(Object.freeze({ x: round(x, 2), z: round(z, 2), rotY }));
      if (slots.length >= o.maxSlots) return slots;
    }
    b += row % 2 === 0 ? o.pairGap : o.aisle;
    row += 1;
  }
  return slots;
}

/** Permutasi deterministik 0..n−1 (Fisher–Yates): k slot pertama = yang terisi bila isi = k/n. */
export function visibleOrder(n, seed) {
  const order = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  const rng = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Id varian per slot menurut bobot (deterministik). */
export function assignVariants(n, seed, weights = VARIANT_WEIGHTS) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const rng = mulberry32(seed ^ 0xa5a5a5a5);
  return Array.from({ length: Math.max(0, n) }, () => {
    let r = rng() * total;
    for (const [id, w] of weights) {
      r -= w;
      if (r < 0) return id;
    }
    return weights[weights.length - 1][0];
  });
}

/** Benih tak bertanda dari titik (pusat area parkir, presisi 0,1 m). */
export function seedOf(x, z) {
  return (Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663)) >>> 0;
}
