/**
 * Grid simpul terrain bake: simpul (r, c) di (minX + c·step, minZ + r·step), data Float64Array baris-mayor
 * (r = utara→selatan). Grid selalu selaras chunk 500 m sehingga chunk = jendela 126 × 126 simpul. Murni.
 */
import { CHUNK_SIZE, STEP } from '../../../src/geo/terrain/format.js';
import { rasterizeRing } from '../../../src/geo/terrain/cellMask.js';
import { ringBounds } from '../../../src/geo/polygon.js';

/**
 * Grid yang menutup bbox ring + margin, dibulatkan keluar ke kelipatan chunk.
 * @returns {{minX:number, minZ:number, step:number, cols:number, rows:number, ix0:number, iz0:number,
 *   chunksX:number, chunksZ:number}}
 */
export function gridForRing(ring, margin, step = STEP, chunk = CHUNK_SIZE) {
  const b = ringBounds(ring);
  const ix0 = Math.floor((b.minX - margin) / chunk);
  const iz0 = Math.floor((b.minZ - margin) / chunk);
  const ix1 = Math.ceil((b.maxX + margin) / chunk);
  const iz1 = Math.ceil((b.maxZ + margin) / chunk);
  const per = chunk / step;
  return {
    minX: ix0 * chunk, minZ: iz0 * chunk, step,
    cols: (ix1 - ix0) * per + 1, rows: (iz1 - iz0) * per + 1,
    ix0, iz0, chunksX: ix1 - ix0, chunksZ: iz1 - iz0,
  };
}

/** Bilinear pada data grid (x, z dunia; di-clamp ke grid). */
export function sampleGrid(grid, data, x, z) {
  const fx = Math.min(grid.cols - 1, Math.max(0, (x - grid.minX) / grid.step));
  const fz = Math.min(grid.rows - 1, Math.max(0, (z - grid.minZ) / grid.step));
  const c0 = Math.min(grid.cols - 2, Math.floor(fx));
  const r0 = Math.min(grid.rows - 2, Math.floor(fz));
  const tx = fx - c0;
  const tz = fz - r0;
  const i = r0 * grid.cols + c0;
  const top = data[i] * (1 - tx) + data[i + 1] * tx;
  const bottom = data[i + grid.cols] * (1 - tx) + data[i + grid.cols + 1] * tx;
  return top * (1 - tz) + bottom * tz;
}

/** Simpul di dalam ring (aturan pointInPolygon pada posisi simpul). @returns {Uint8Array} */
export function nodesInside(grid, ring) {
  return rasterizeRing(ring, {
    minX: grid.minX - grid.step / 2, minZ: grid.minZ - grid.step / 2, cell: grid.step, cols: grid.cols, rows: grid.rows,
  });
}

/** Titik sepanjang ring tertutup tiap ≤ spacing m (termasuk semua verteks). */
export function densifyRing(ring, spacing) {
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let k = 0; k < steps; k += 1) out.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
  }
  return out;
}

/** Median (array disalin & diurutkan; panjang genap → rerata dua tengah). NaN bila kosong. */
export function median(values) {
  if (values.length === 0) return Number.NaN;
  const s = Float64Array.from(values).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Rentang indeks simpul yang menutup bbox {minX..maxX, minZ..maxZ} (di-clamp). */
export function nodeRange(grid, b) {
  return {
    c0: Math.max(0, Math.floor((b.minX - grid.minX) / grid.step)),
    c1: Math.min(grid.cols - 1, Math.ceil((b.maxX - grid.minX) / grid.step)),
    r0: Math.max(0, Math.floor((b.minZ - grid.minZ) / grid.step)),
    r1: Math.min(grid.rows - 1, Math.ceil((b.maxZ - grid.minZ) / grid.step)),
  };
}
