/**
 * Blend ke nol (spec §5.2 langkah 5): w = smoothstep(0, D, jarak ke tepi batas) × bobot mask stadion,
 * bobot mask = 0 di dalam mask dan sampai `maskMargin` m di luarnya, lalu smoothstep(0, D, d − maskMargin).
 * Di luar batas w = 0 tepat (tile kota & stadion tetap y = 0). Murni.
 */
import { distanceToRing, pointInPolygon } from '../../../src/geo/polygon.js';
import { nodesInside } from './grid.js';

/** smoothstep Hermite klasik; e1 > e0. */
export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Bobot satu titik (dipakai tes & laporan). */
export function blendWeightAt(x, z, { boundary, mask, distance, maskMargin }) {
  if (!pointInPolygon(x, z, boundary)) return 0;
  const wb = smoothstep(0, distance, distanceToRing(x, z, boundary));
  if (!mask || mask.length < 3) return wb;
  if (pointInPolygon(x, z, mask)) return 0;
  return wb * smoothstep(0, distance, distanceToRing(x, z, mask) - maskMargin);
}

/**
 * Bobot w per simpul grid.
 * @param {{minX:number,minZ:number,step:number,cols:number,rows:number}} grid
 * @param {{boundary:Array<[number,number]>, mask?:Array<[number,number]>|null, distance:number, maskMargin:number}} opts
 * @returns {Float32Array}
 */
export function blendWeights(grid, { boundary, mask = null, distance, maskMargin }) {
  const inside = nodesInside(grid, boundary);
  const w = new Float32Array(grid.cols * grid.rows);
  for (let r = 0; r < grid.rows; r += 1) {
    const z = grid.minZ + r * grid.step;
    for (let c = 0; c < grid.cols; c += 1) {
      const i = r * grid.cols + c;
      if (!inside[i]) continue;
      const x = grid.minX + c * grid.step;
      w[i] = blendWeightAt(x, z, { boundary, mask, distance, maskMargin });
    }
  }
  return w;
}

/** y × w (array baru); w = 0 → 0 tepat. */
export function applyBlend(heights, w) {
  const out = new Float64Array(heights.length);
  for (let i = 0; i < heights.length; i += 1) out[i] = w[i] > 0 ? heights[i] * w[i] : 0;
  return out;
}
