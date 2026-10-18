/**
 * Filter grid 2D (baris-mayor, cols × rows): median k×k dan Gaussian terpisah. Tepi di-clamp
 * (sampel di luar grid = sampel tepi terdekat). Mengembalikan array baru. Murni.
 */

/** Median jendela size×size (size ganjil). */
export function median2d(src, cols, rows, size = 5) {
  if (size % 2 !== 1) throw new RangeError('median2d: size harus ganjil');
  const h = (size - 1) / 2;
  const out = new Float64Array(src.length);
  const win = new Float64Array(size * size);
  const mid = (size * size - 1) / 2;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let k = 0;
      for (let dr = -h; dr <= h; dr += 1) {
        const rr = Math.min(rows - 1, Math.max(0, r + dr)) * cols;
        for (let dc = -h; dc <= h; dc += 1) {
          // sisip berurutan (insertion sort) — jendela kecil, deterministik
          const v = src[rr + Math.min(cols - 1, Math.max(0, c + dc))];
          let i = k;
          while (i > 0 && win[i - 1] > v) { win[i] = win[i - 1]; i -= 1; }
          win[i] = v;
          k += 1;
        }
      }
      out[r * cols + c] = win[mid];
    }
  }
  return out;
}

/** Kernel Gaussian ternormalisasi, radius ceil(3σ). */
export function gaussianKernel(sigma) {
  if (!(sigma > 0)) throw new RangeError('gaussianKernel: sigma harus > 0');
  const radius = Math.ceil(3 * sigma);
  const k = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    k[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += k[i + radius];
  }
  for (let i = 0; i < k.length; i += 1) k[i] /= sum;
  return k;
}

/** Gaussian terpisah (horizontal lalu vertikal), σ dalam satuan sampel. */
export function gaussian2d(src, cols, rows, sigma) {
  const k = gaussianKernel(sigma);
  const radius = (k.length - 1) / 2;
  const tmp = new Float64Array(src.length);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let s = 0;
      for (let i = -radius; i <= radius; i += 1) s += k[i + radius] * src[r * cols + Math.min(cols - 1, Math.max(0, c + i))];
      tmp[r * cols + c] = s;
    }
  }
  const out = new Float64Array(src.length);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let s = 0;
      for (let i = -radius; i <= radius; i += 1) s += k[i + radius] * tmp[Math.min(rows - 1, Math.max(0, r + i)) * cols + c];
      out[r * cols + c] = s;
    }
  }
  return out;
}
