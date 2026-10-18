/**
 * Datum terrain (spec §5.2 langkah 4): h_ref = median elevasi sepanjang batas distrik (sampel tiap
 * `spacing` m, bilinear pada grid), y = h − h_ref. Murni.
 */
import { densifyRing, median, sampleGrid } from './grid.js';

/** @returns {number} h_ref (m) */
export function boundaryReference(grid, heights, ring, spacing) {
  const values = densifyRing(ring, spacing).map(([x, z]) => sampleGrid(grid, heights, x, z));
  const ref = median(values);
  if (!Number.isFinite(ref)) throw new Error('datum: batas distrik kosong');
  return ref;
}

/** y = h − ref (array baru). */
export function applyDatum(heights, ref) {
  const out = new Float64Array(heights.length);
  for (let i = 0; i < heights.length; i += 1) out[i] = heights[i] - ref;
  return out;
}
