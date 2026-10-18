/**
 * Bobot permukaan terrain (spec §5.3): per sampel grid 4 m (sama dengan heightfield) tiga kanal byte
 * grass/soil/wet (jumlah 255). Aturan (maks per kanal): landcover (SURFACE_RULES.landcover), bahu jalan tanah
 * merah, jalan tanah (path/track), tepi air basah, parit basah, lereng curam tanah. Di luar distrik = 0,0,0.
 */
import { Buffer } from 'node:buffer';
import { CHUNK_SIZE, N, STEP } from '../../../src/geo/terrain/format.js';
import { parseTileKey } from '../../../src/geo/tiles.js';
import { SURFACE_RULES } from './constants.js';

/** Bobot satu titik {g, s, w} (jumlah 1; semua 0 di luar distrik). */
export function sampleSurface(x, z, ctx, ditchIndex, rules = SURFACE_RULES) {
  if (!ctx.inside(x, z)) return { g: 0, s: 0, w: 0 };
  let s = 0;
  let w = 0;
  const cover = ctx.cover(x, z);
  if (cover) {
    s = rules.landcover[cover.kind]?.soil ?? 0;
    w = rules.landcover[cover.kind]?.wet ?? 0;
  }
  if (ctx.area(x, z)?.kind === 'water') {
    w = 1;
  } else {
    const we = ctx.waterEdge(x, z);
    if (we < rules.waterBank.width) w = Math.max(w, 1 - we / rules.waterBank.width);
  }
  const road = ctx.roadEdge(x, z);
  if (road.item && rules.shoulder.classes.includes(road.item.cls) && road.d >= 0 && road.d <= rules.shoulder.width) {
    s = Math.max(s, rules.shoulder.soil);
  }
  const path = ctx.soilPathEdge(x, z).d;
  if (path <= rules.soilPath.feather) s = Math.max(s, path <= 0 ? 1 : 1 - path / rules.soilPath.feather);
  const dd = ditchIndex.nearest(x, z).d;
  if (dd <= rules.ditch.width) w = Math.max(w, rules.ditch.wet * (1 - Math.max(0, dd) / rules.ditch.width));
  if (ctx.grade(x, z) > rules.steep.grade) s = Math.max(s, rules.steep.soil);
  const total = s + w;
  if (total > 1) {
    s /= total;
    w /= total;
  }
  return { g: Math.max(0, 1 - s - w), s, w };
}

/** {g, s, w} → [grass, soil, wet] byte berjumlah 255 (atau 0,0,0). */
export function toBytes({ g, s, w }) {
  if (g + s + w === 0) return [0, 0, 0];
  const sb = Math.round(255 * s);
  const wb = Math.min(255 - sb, Math.round(255 * w));
  return [255 - sb - wb, sb, wb];
}

/** Grid bobot chunk `key`: sampel (i, j) di (ix·size + i·step, iz·size + j·step), baris-mayor j lalu i. */
export function surfaceWeights(key, ctx, ditchIndex, { n = N, step = STEP, size = CHUNK_SIZE } = {}) {
  const t = parseTileKey(key);
  const ox = t.ix * size;
  const oz = t.iz * size;
  const grass = new Uint8Array(n * n);
  const soil = new Uint8Array(n * n);
  const wet = new Uint8Array(n * n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const [gb, sb, wb] = toBytes(sampleSurface(ox + i * step, oz + j * step, ctx, ditchIndex));
      const k = j * n + i;
      grass[k] = gb;
      soil[k] = sb;
      wet[k] = wb;
    }
  }
  return { n, grass, soil, wet };
}

const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');

/** Bentuk JSON `weights` (spec/indeks): {n, grass, soil, wet} base64. */
export function encodeWeights(w) {
  return { n: w.n, grass: b64(w.grass), soil: b64(w.soil), wet: b64(w.wet) };
}
