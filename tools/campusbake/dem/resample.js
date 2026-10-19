/**
 * Resample DEM (lat/lon) → grid dunia 4 m dengan konvolusi kubik Keys (a = −0,5): reproduksi tepat
 * polinom derajat ≤ 2, kontinu C1. Indeks di luar ubin di-clamp ke tepi. Murni.
 */
import { hgtPosition, HGT_VOID } from './readHgt.js';

const A = -0.5;

/** Bobot kernel kubik Keys untuk jarak t (|t| < 2). */
export function cubicWeight(t) {
  const x = Math.abs(t);
  if (x <= 1) return ((A + 2) * x - (A + 3)) * x * x + 1;
  if (x < 2) return ((A * x - 5 * A) * x + 8 * A) * x - 4 * A;
  return 0;
}

/**
 * Nilai bikubik pada posisi pecahan (row, col) dari array baris-mayor `size × size`.
 * @param {{size:number, data:ArrayLike<number>}} dem
 */
export function bicubicAt(dem, row, col) {
  const last = dem.size - 1;
  const r0 = Math.floor(row);
  const c0 = Math.floor(col);
  const wr = [cubicWeight(row - (r0 - 1)), cubicWeight(row - r0), cubicWeight(row - (r0 + 1)), cubicWeight(row - (r0 + 2))];
  const wc = [cubicWeight(col - (c0 - 1)), cubicWeight(col - c0), cubicWeight(col - (c0 + 1)), cubicWeight(col - (c0 + 2))];
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const r = Math.min(last, Math.max(0, r0 - 1 + i));
    let line = 0;
    for (let j = 0; j < 4; j += 1) {
      const c = Math.min(last, Math.max(0, c0 - 1 + j));
      const v = dem.data[r * dem.size + c];
      if (v === HGT_VOID) throw new Error(`void SRTM di baris ${r}, kolom ${c}`);
      line += wc[j] * v;
    }
    sum += wr[i] * line;
  }
  return sum;
}

/**
 * Tinggi DEM (m) di setiap simpul grid dunia.
 * @param {{lat0:number, lon0:number, size:number, data:Int16Array}} dem
 * @param {{minX:number, minZ:number, step:number, cols:number, rows:number}} grid simpul (r, c) di
 *   (minX + c·step, minZ + r·step)
 * @param {{toLatLon(x:number, z:number):{lat:number, lon:number}}} projection
 * @returns {Float64Array} rows × cols
 */
export function resampleToGrid(dem, grid, projection) {
  const out = new Float64Array(grid.cols * grid.rows);
  for (let r = 0; r < grid.rows; r += 1) {
    const z = grid.minZ + r * grid.step;
    for (let c = 0; c < grid.cols; c += 1) {
      const { lat, lon } = projection.toLatLon(grid.minX + c * grid.step, z);
      const p = hgtPosition(dem, lat, lon);
      out[r * grid.cols + c] = bicubicAt(dem, p.row, p.col);
    }
  }
  return out;
}
