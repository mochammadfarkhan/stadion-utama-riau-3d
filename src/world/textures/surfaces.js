/**
 * Tekstur permukaan prosedural bergaya stylized bersih (noise halus, kontras rendah).
 * Setiap fungsi mengembalikan {map, normalMap?, roughnessMap?} yang di-cache per nama.
 * Semua tekstur periodik (satu tile = TILE_M[nama] meter; repeat diatur pemanggil).
 * Tekstur netral (beton, paving, kayu) dibuat terang agar `material.color` yang mewarnai.
 */
import { Color } from 'three';
import { COLORS, TRACK } from '../../config/constants.js';
import { fillCanvas, normalFromHeight, hash2, MAP_SIZE, NORMAL_SIZE } from './noise.js';

/** Ukuran satu tile tekstur dalam meter (acuan repeat = 1 / TILE_M). */
export const TILE_M = Object.freeze({
  asphalt: 6, paving: 2.4, concrete: 2, grass: 4, tartan: 2, metalSeam: 1.6, wood: 1,
});

const PAVING_BLOCKS = 8;      // 8 × 0.3 m = 2.4 m
const PAVING_GROUT = 0.06;    // lebar nat relatif terhadap satu blok
const PAVING_BROKEN = 0.07;   // peluang blok lebih gelap (rusak)
const SEAMS_PER_TILE = 4;     // 4 × 0.4 m = 1.6 m
const SEAM_WIDTH = 0.035;
const CRACK_THRESHOLD = 0.012;
const NORMAL_STRENGTH = 0.35;

const cache = new Map();

function cached(name, make) {
  if (!cache.has(name)) cache.set(name, Object.freeze(make()));
  return cache.get(name);
}

function rgb(hex) {
  const c = new Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function scale(c, k) {
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Retakan tipis jarang: ridge noise di sekitar nilai tengah. */
function crackMask(u, v, noise) {
  const n = noise(u, v, { freq: 3, octaves: 3, seed: 11 });
  const d = Math.abs(n - 0.5);
  return d < CRACK_THRESHOLD ? 1 - d / CRACK_THRESHOLD : 0;
}

/** Aspal: abu kebiruan + butiran halus + retakan tipis jarang. */
export function asphaltTexture() {
  return cached('asphalt', () => {
    const base = rgb(COLORS.asphalt);
    const grain = (u, v, n) => n(u, v, { freq: 64, octaves: 3, seed: 1 });
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const g = 0.9 + grain(u, v, n) * 0.2;
      const patch = 0.95 + n(u, v, { freq: 4, octaves: 2, seed: 2 }) * 0.1;
      return scale(base, g * patch * (1 - crackMask(u, v, n) * 0.35));
    });
    const normalMap = normalFromHeight((u, v, n) => grain(u, v, n) * 0.3 - crackMask(u, v, n) * 0.6, NORMAL_SIZE, NORMAL_STRENGTH);
    const roughnessMap = fillCanvas(NORMAL_SIZE, NORMAL_SIZE, (u, v, n) => {
      const r = 215 + grain(u, v, n) * 40;
      return [r, r, r];
    }, { srgb: false });
    return { map, normalMap, roughnessMap };
  });
}

/** Indeks blok paving & jarak ke nat (0 = di nat, 1 = pusat blok). */
function pavingCell(u, v) {
  const bx = u * PAVING_BLOCKS;
  const by = v * PAVING_BLOCKS;
  const fx = bx - Math.floor(bx);
  const fy = by - Math.floor(by);
  const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
  return { ix: Math.floor(bx), iy: Math.floor(by), edge };
}

/** Paving plaza: blok 0,3 m dengan nat lebih gelap, variasi warna per blok, beberapa blok rusak. */
export function pavingTexture() {
  return cached('paving', () => {
    const light = [242, 240, 236];
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const { ix, iy, edge } = pavingCell(u, v);
      const broken = hash2(ix * 3 + 1, iy * 5 + 2, 7) < PAVING_BROKEN;
      const tone = (broken ? 0.78 : 0.92) + hash2(ix, iy, 3) * 0.1 + n(u, v, { freq: 32, octaves: 2, seed: 4 }) * 0.06;
      const grout = edge < PAVING_GROUT ? 0.72 + (edge / PAVING_GROUT) * 0.2 : 1;
      return scale(light, tone * grout);
    });
    const normalMap = normalFromHeight((u, v, n) => {
      const { edge } = pavingCell(u, v);
      const h = edge < PAVING_GROUT ? edge / PAVING_GROUT : 1;
      return h * 0.6 + n(u, v, { freq: 32, octaves: 2, seed: 4 }) * 0.08;
    }, NORMAL_SIZE, NORMAL_STRENGTH);
    const roughnessMap = fillCanvas(NORMAL_SIZE, NORMAL_SIZE, (u, v) => {
      const r = pavingCell(u, v).edge < PAVING_GROUT ? 250 : 225;
      return [r, r, r];
    }, { srgb: false });
    return { map, normalMap, roughnessMap };
  });
}

/** Beton berpori halus (netral terang; diwarnai material.color). */
export function concreteTexture() {
  return cached('concrete', () => {
    const pores = (u, v, n) => n(u, v, { freq: 48, octaves: 3, seed: 21 });
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const p = pores(u, v, n);
      const pit = p < 0.36 ? (0.36 - p) * 1.2 : 0;
      const cloud = 0.95 + n(u, v, { freq: 3, octaves: 2, seed: 22 }) * 0.07;
      const k = (1 - pit) * cloud;
      return [250 * k, 249 * k, 246 * k];
    });
    const normalMap = normalFromHeight((u, v, n) => {
      const p = pores(u, v, n);
      return p < 0.36 ? p : 0.36;
    }, NORMAL_SIZE, NORMAL_STRENGTH);
    return { map, normalMap };
  });
}

/** Rumput: dua tingkat hijau pastel bernoise + bercak kuning samar. */
export function grassTexture() {
  return cached('grass', () => {
    const dark = rgb(COLORS.grass);
    const light = rgb(COLORS.grassStripe);
    const dry = [196, 190, 110];
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const blades = n(u, v, { freq: 48, octaves: 3, seed: 31 });
      const clumps = n(u, v, { freq: 6, octaves: 2, seed: 32 });
      let c = mix(dark, light, blades * 0.6 + clumps * 0.4);
      const dryK = Math.max(0, n(u, v, { freq: 2, octaves: 2, seed: 33 }) - 0.6) * 0.9;
      c = mix(c, dry, dryK);
      return scale(c, 0.96 + blades * 0.08);
    });
    const normalMap = normalFromHeight((u, v, n) => n(u, v, { freq: 48, octaves: 2, seed: 31 }), NORMAL_SIZE, NORMAL_STRENGTH * 0.6);
    return { map, normalMap };
  });
}

/** Tartan lintasan: salmon berbintik halus. */
export function tartanTexture() {
  return cached('tartan', () => {
    const base = rgb(TRACK.color);
    const speck = (u, v, n) => n(u, v, { freq: 96, octaves: 2, seed: 41 });
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const s = speck(u, v, n);
      const dots = s > 0.68 ? 0.9 : s < 0.3 ? 1.06 : 1;
      const cloud = 0.97 + n(u, v, { freq: 3, octaves: 2, seed: 42 }) * 0.06;
      return scale(base, dots * cloud);
    });
    const normalMap = normalFromHeight((u, v, n) => speck(u, v, n) * 0.5, NORMAL_SIZE, NORMAL_STRENGTH * 0.7);
    return { map, normalMap };
  });
}

/** Jarak ke seam vertikal terdekat (0 di seam, 1 di tengah panel). */
function seamDistance(u) {
  const f = (u * SEAMS_PER_TILE) % 1;
  return Math.min(f, 1 - f);
}

/** Atap metal standing seam: garis vertikal tipis tiap 0,4 m + noise lembut. */
export function metalSeamTexture() {
  return cached('metalSeam', () => {
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const seam = seamDistance(u) < SEAM_WIDTH ? 0.86 : 1;
      const panel = 0.97 + n(u, v, { freq: 4, octaves: 2, seed: 51 }) * 0.05;
      const k = seam * panel;
      return [252 * k, 251 * k, 248 * k];
    });
    const normalMap = normalFromHeight((u, v, n) => {
      const d = seamDistance(u);
      const ridge = d < SEAM_WIDTH ? 1 - d / SEAM_WIDTH : 0;
      return ridge * 0.8 + Math.sin(u * SEAMS_PER_TILE * Math.PI * 2) * 0.08 + n(u, v, { freq: 8, octaves: 2, seed: 52 }) * 0.05;
    }, NORMAL_SIZE, NORMAL_STRENGTH);
    return { map, normalMap };
  });
}

/** Kayu/ACP louvre: serat garis lembut sepanjang sumbu U (netral terang). */
export function woodTexture() {
  return cached('wood', () => {
    const grain = (u, v, n) => {
      const warp = n(u, v, { freq: 2, octaves: 2, seed: 61 }) * 0.15;
      return n(u, v + warp, { freq: 4, freqV: 24, octaves: 2, seed: 62 });
    };
    const map = fillCanvas(MAP_SIZE, MAP_SIZE, (u, v, n) => {
      const g = grain(u, v, n);
      const k = 0.9 + g * 0.14;
      return [250 * k, 244 * k, 236 * k];
    });
    const normalMap = normalFromHeight((u, v, n) => grain(u, v, n) * 0.4, NORMAL_SIZE, NORMAL_STRENGTH * 0.6);
    return { map, normalMap };
  });
}

const TEXTURE_FNS = Object.freeze({
  asphalt: asphaltTexture, paving: pavingTexture, concrete: concreteTexture, grass: grassTexture,
  tartan: tartanTexture, metalSeam: metalSeamTexture, wood: woodTexture,
});

/**
 * Salinan peta tekstur `name` (berbagi image/GPU dengan aslinya) dengan
 * repeat = 1 / tileM agar satu tile = tileM meter pada UV bersatuan meter.
 * @returns {{map:import('three').Texture, normalMap?:import('three').Texture, roughnessMap?:import('three').Texture}}
 */
export function surfaceMaps(name, tileM = TILE_M[name]) {
  const src = TEXTURE_FNS[name]();
  const out = {};
  for (const key of ['map', 'normalMap', 'roughnessMap']) {
    if (!src[key]) continue;
    const t = src[key].clone();
    t.repeat.set(1 / tileM, 1 / tileM);
    t.needsUpdate = true;
    out[key] = t;
  }
  return out;
}
