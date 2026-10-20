/**
 * Noise deterministik + pembuat tekstur prosedural (tanpa unduhan).
 * - value noise 2D bilinear & fbm (seed tetap → hasil bisa diulang)
 * - fillCanvas: isi piksel via fn(x, y, noise) → [r, g, b]; di browser jadi
 *   CanvasTexture, di Node (tanpa document) jadi DataTexture kecil (fallback)
 * - normalFromHeight: normal map tangent-space dari fungsi tinggi
 */
import {
  CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping,
  RGBAFormat, SRGBColorSpace, NoColorSpace,
} from 'three';

export const MAP_SIZE = 512;
export const NORMAL_SIZE = 256;
const FALLBACK_SIZE = 32;
const ANISOTROPY = 4;
const DEFAULT_OCTAVES = 4;

export function hasDocument() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/** Hash 2D deterministik (0..1) dengan seed. */
export function hash2(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Value noise 2D bilinear-smoothstep (0..1). Koordinat dalam satuan sel. */
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Kisi hash per (periodX, periodY, seed): hash2 (Math.sin) dihitung sekali per titik kisi, bukan 4x per piksel
// per oktaf. Nilai identik dengan hash2 langsung (dites); kisi besar/periode pecahan memakai rumus langsung.
// Cincin kecil tanpa kunci string: fbm memakai ≤ 8 oktaf berselang-seling, jadi pencarian linear numerik cukup.
const LATTICE_MAX_CELLS = 1 << 16;
const LATTICE_SLOTS = 16;
const slotPx = new Float64Array(LATTICE_SLOTS).fill(NaN);
const slotPy = new Float64Array(LATTICE_SLOTS);
const slotSeed = new Float64Array(LATTICE_SLOTS);
const slotTable = new Array(LATTICE_SLOTS).fill(null);
let slotNext = 0;

function latticeOf(px, py, seed) {
  for (let i = 0; i < LATTICE_SLOTS; i += 1) {
    if (slotPx[i] === px && slotPy[i] === py && slotSeed[i] === seed) return slotTable[i];
  }
  const table = new Float64Array(px * py);
  for (let y = 0; y < py; y += 1) {
    for (let x = 0; x < px; x += 1) table[y * px + x] = hash2(x, y, seed);
  }
  const i = slotNext;
  slotNext = (slotNext + 1) % LATTICE_SLOTS;
  slotPx[i] = px;
  slotPy[i] = py;
  slotSeed[i] = seed;
  slotTable[i] = table;
  return table;
}

/**
 * Value noise periodik (mulus di tepi tile): sel dibungkus modulo `period`
 * sehingga tekstur bisa diulang tanpa sambungan terlihat.
 */
export function periodicNoise(x, y, periodX, periodY = periodX, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  if (Number.isInteger(periodX) && Number.isInteger(periodY) && periodX > 0 && periodY > 0
    && periodX * periodY <= LATTICE_MAX_CELLS) {
    const t = latticeOf(periodX, periodY, seed);
    const x0 = ((xi % periodX) + periodX) % periodX;
    const y0 = ((yi % periodY) + periodY) % periodY;
    const x1 = x0 + 1 === periodX ? 0 : x0 + 1;
    const r0 = y0 * periodX;
    const r1 = (y0 + 1 === periodY ? 0 : y0 + 1) * periodX;
    const a = t[r0 + x0];
    const b = t[r0 + x1];
    const c = t[r1 + x0];
    const d = t[r1 + x1];
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  const wx = (v) => ((v % periodX) + periodX) % periodX;
  const wy = (v) => ((v % periodY) + periodY) % periodY;
  const a = hash2(wx(xi), wy(yi), seed);
  const b = hash2(wx(xi + 1), wy(yi), seed);
  const c = hash2(wx(xi), wy(yi + 1), seed);
  const d = hash2(wx(xi + 1), wy(yi + 1), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * fbm periodik: u, v dalam 0..1 (satu tile); `freq` (dan `freqV` opsional) =
 * jumlah sel oktaf pertama per tile (bilangan bulat agar tetap periodik).
 * Hasil dinormalisasi ke 0..1.
 */
export function fbm(u, v, { freq = 8, freqV = freq, octaves = DEFAULT_OCTAVES, gain = 0.5, seed = 0 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fu = freq;
  let fv = freqV;
  for (let o = 0; o < octaves; o += 1) {
    sum += periodicNoise(u * fu, v * fv, fu, fv, seed + o * 17) * amp;
    norm += amp;
    amp *= gain;
    fu *= 2;
    fv *= 2;
  }
  return sum / norm;
}

/** Batasi ke 0..255 dan bulatkan. */
export function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Isi buffer RGBA ukuran w×h dengan fn(x, y, noise) → [r, g, b]. */
export function fillPixels(w, h, fn) {
  const data = new Uint8Array(w * h * 4);
  const noise = (u, v, opts) => fbm(u, v, opts);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = fn(x / w, y / h, noise);
      const i = (y * w + x) * 4;
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Atur wrap/filter/colorSpace standar untuk tekstur yang diulang. */
function finalize(tex, srgb) {
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = ANISOTROPY;
  tex.needsUpdate = true;
  return tex;
}

/** DataTexture dari buffer RGBA (fallback Node & normal map). */
function dataTexture(data, w, h, srgb) {
  return finalize(new DataTexture(data, w, h, RGBAFormat), srgb);
}

/**
 * Tekstur w×h dari fn(u, v, noise) → [r, g, b] (u, v ∈ 0..1).
 * Browser: CanvasTexture via ImageData; Node: DataTexture FALLBACK_SIZE².
 * @param {{srgb?:boolean}} opts srgb=true untuk peta warna (default), false untuk data
 */
export function fillCanvas(w, h, fn, { srgb = true } = {}) {
  if (!hasDocument()) {
    const s = FALLBACK_SIZE;
    return dataTexture(fillPixels(s, s, fn), s, s, srgb);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataTexture(fillPixels(w, h, fn), w, h, srgb);
  const img = ctx.createImageData(w, h);
  img.data.set(fillPixels(w, h, fn));
  ctx.putImageData(img, 0, 0);
  return finalize(new CanvasTexture(canvas), srgb);
}

/**
 * Normal map tangent-space dari fungsi tinggi heightFn(u, v, noise) → 0..1.
 * Turunan dihitung dengan beda hingga periodik; `strength` = skala kemiringan.
 */
export function normalFromHeight(heightFn, size = NORMAL_SIZE, strength = 1) {
  const eps = 1 / size;
  const noise = (u, v, opts) => fbm(u, v, opts);
  const wrap = (t) => t - Math.floor(t);
  return fillCanvas(size, size, (u, v) => {
    const hx = heightFn(wrap(u + eps), v, noise) - heightFn(wrap(u - eps), v, noise);
    const hy = heightFn(u, wrap(v + eps), noise) - heightFn(u, wrap(v - eps), noise);
    const nx = -hx * strength * size * 0.5;
    const ny = hy * strength * size * 0.5; // +Y tekstur ke bawah pada canvas → dibalik
    const len = Math.hypot(nx, ny, 1);
    return [((nx / len) * 0.5 + 0.5) * 255, ((ny / len) * 0.5 + 0.5) * 255, ((1 / len) * 0.5 + 0.5) * 255];
  }, { srgb: false });
}
