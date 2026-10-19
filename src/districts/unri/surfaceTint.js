/**
 * Warna vertex terrain distrik dari bobot permukaan (spec §5.3). Material terrain memakai tekstur rumput
 * (surfaceMaps('grass'), basis COLORS.grass) × warna vertex; tint = warna sasaran / warna basis (linear) sehingga
 * rumput tampil apa adanya, tanah merah laterit dan tanah basah tampil sesuai sasaran. Sampel berbobot nol (di
 * luar distrik) memakai warna tanah kota (CITY_GROUND_COLOR) agar tidak ada belang di tepi chunk terrain.
 * Murni kecuali konversi warna (three Color).
 */
import { Color } from 'three';
import { COLORS } from '../../config/constants.js';

/** Warna sasaran sRGB. soil/wet [INFERENSI visual tanah laterit Pekanbaru]; kota = CITY_GROUND_COLOR (src/city). */
export const SURFACE_COLORS = Object.freeze({ soil: 0xa8613f, wet: 0x6b6446, kota: 0xb9b59a });

/** Pengali warna vertex (linear) per kanal. */
export function surfaceTints(base = COLORS.grass, colors = SURFACE_COLORS) {
  const b = new Color(base);
  const ratio = (hex) => {
    const c = new Color(hex);
    return [c.r / b.r, c.g / b.g, c.b / b.b];
  };
  return Object.freeze({ grass: [1, 1, 1], soil: ratio(colors.soil), wet: ratio(colors.wet), kota: ratio(colors.kota) });
}

/** Warna (linear) satu sampel bobot byte; semua nol → tint kota. */
export function sampleColor(g, s, w, tints, out = [0, 0, 0]) {
  const t = g + s + w;
  for (let k = 0; k < 3; k += 1) {
    out[k] = t === 0 ? tints.kota[k] : (g * tints.grass[k] + s * tints.soil[k] + w * tints.wet[k]) / t;
  }
  return out;
}

/**
 * Warna vertex untuk titik dunia xz (Float32Array [x0, z0, x1, z1, …]): interpolasi bilinear warna sampel grid
 * bobot (sampel (i, j) di origin + (i·step, j·step), baris-mayor j lalu i); di luar grid di-clamp.
 * @returns {Float32Array} rgb per titik
 */
export function surfaceColors(xz, weights, origin, tints, step = 4) {
  const { n } = weights;
  const cache = new Float32Array(n * n * 3);
  const tmp = [0, 0, 0];
  for (let i = 0; i < n * n; i += 1) {
    sampleColor(weights.grass[i], weights.soil[i], weights.wet[i], tints, tmp);
    cache[i * 3] = tmp[0];
    cache[i * 3 + 1] = tmp[1];
    cache[i * 3 + 2] = tmp[2];
  }
  const count = xz.length / 2;
  const out = new Float32Array(count * 3);
  for (let v = 0; v < count; v += 1) {
    const fx = Math.min(Math.max((xz[2 * v] - origin.x) / step, 0), n - 1);
    const fz = Math.min(Math.max((xz[2 * v + 1] - origin.z) / step, 0), n - 1);
    const i0 = Math.min(Math.floor(fx), n - 2);
    const j0 = Math.min(Math.floor(fz), n - 2);
    const u = fx - i0;
    const t = fz - j0;
    for (let k = 0; k < 3; k += 1) {
      const c00 = cache[(j0 * n + i0) * 3 + k];
      const c10 = cache[(j0 * n + i0 + 1) * 3 + k];
      const c01 = cache[((j0 + 1) * n + i0) * 3 + k];
      const c11 = cache[((j0 + 1) * n + i0 + 1) * 3 + k];
      out[v * 3 + k] = (c00 * (1 - u) + c10 * u) * (1 - t) + (c01 * (1 - u) + c11 * u) * t;
    }
  }
  return out;
}
