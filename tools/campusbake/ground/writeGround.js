/**
 * Perakitan ground/<key>.json (format v1, lihat plan M2) dan penulisan berkas + manifest.ground.
 * Koordinat: bilangan bulat 0,1 m relatif sudut barat-laut chunk. Jalan/trotoar/parit dipotong ke chunk +
 * margin (diklip eksak di runtime); area dipotong tepat ke chunk; titik (veg/props) milik chunk [min, max).
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clipPolylineToRect, polygonArea } from '../../../src/geo/polygon.js';
import { parseTileKey, tileBounds } from '../../../src/geo/tiles.js';
import { CHUNK_SIZE } from '../../../src/geo/terrain/format.js';
import { clipToRing } from './extract.js';
import { GROUND_FORMAT, VEG_SPECIES } from './constants.js';

const q = (v, o) => Math.round((v - o) / GROUND_FORMAT.unit);

/** Polyline dunia → array datar bulat relatif origin [ox, oz]; titik berurutan yang sama dibuang. */
export function quantizeLine(line, origin) {
  const out = [];
  for (const [x, z] of line) {
    const qx = q(x, origin[0]);
    const qz = q(z, origin[1]);
    if (out.length >= 2 && out[out.length - 2] === qx && out[out.length - 1] === qz) continue;
    out.push(qx, qz);
  }
  return out;
}

/** Ring dunia → array datar bulat terbuka (titik penutup yang sama dengan awal dibuang). */
export function quantizeRing(ring, origin) {
  const out = quantizeLine(ring, origin);
  while (out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1]) out.splice(-2, 2);
  return out;
}

const flatArea = (flat) => {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  return polygonArea(pts);
};

/**
 * Objek ground satu chunk.
 * @param {string} key
 * @param {{roads:object[], walks:object[], areas:object[], ditches:object[], veg:object[],
 *   props:{lamps:object[], benches:object[], bins:object[]}, weights:{n:number, grass:string, soil:string, wet:string}}} L
 */
export function assembleChunk(key, L) {
  const t = parseTileKey(key);
  const rect = tileBounds(t.ix, t.iz, CHUNK_SIZE);
  const origin = [rect.minX, rect.minZ];
  const m = GROUND_FORMAT.roadClipMargin;
  const wide = { minX: rect.minX - m, minZ: rect.minZ - m, maxX: rect.maxX + m, maxZ: rect.maxZ + m };
  const width = (v) => Math.round(v / GROUND_FORMAT.unit);
  const lines = (list, head) => list
    .flatMap((r) => clipPolylineToRect(r.line, wide).map((line) => ({ ...head(r), w: width(r.w), pts: quantizeLine(line, origin) })))
    .filter((r) => r.pts.length >= 4);
  const rectRing = [[rect.minX, rect.minZ], [rect.maxX, rect.minZ], [rect.maxX, rect.maxZ], [rect.minX, rect.maxZ]];
  const areas = L.areas.flatMap((a) => clipToRing(a.rings, rectRing).map((rings) => {
    const qr = rings.map((r) => quantizeRing(r, origin)).filter((r) => r.length >= 6);
    if (qr.length === 0 || flatArea(qr[0]) < 1) return null;
    return a.kind === 'water' ? { kind: a.kind, rings: qr, level: a.level } : { kind: a.kind, rings: qr };
  }).filter(Boolean));
  const inRect = (p) => p.x >= rect.minX && p.x < rect.maxX && p.z >= rect.minZ && p.z < rect.maxZ;
  const flat = (list, withYaw) => list.filter(inRect)
    .flatMap((p) => (withYaw ? [q(p.x, origin[0]), q(p.z, origin[1]), p.yaw] : [q(p.x, origin[0]), q(p.z, origin[1])]));
  return {
    v: GROUND_FORMAT.v,
    key,
    roads: lines(L.roads, (r) => ({ cls: r.cls })),
    walks: lines(L.walks, () => ({})),
    areas,
    ditches: lines(L.ditches, () => ({})),
    veg: VEG_SPECIES.map((sp) => ({ sp, pts: flat(L.veg.filter((v) => v.sp === sp), false) })).filter((v) => v.pts.length > 0),
    props: { lamps: flat(L.props.lamps, true), benches: flat(L.props.benches, true), bins: flat(L.props.bins, false) },
    weights: L.weights,
  };
}

/**
 * Tulis ground/<key>.json (direktori dikosongkan dulu: berkas basi hilang) dan set manifest.ground.chunks.
 * Format manifest mengikuti M1: JSON 2 spasi + newline; urutan kunci lain dipertahankan.
 */
export async function writeGround({ dir, manifestPath, chunks }) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let bytes = 0;
  for (const c of chunks) {
    await writeFile(join(dir, `${c.key}.json`), c.json);
    bytes += Buffer.byteLength(c.json);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const next = { ...manifest, ground: { chunks: chunks.map((c) => c.key) } };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  return { bytes, files: chunks.length };
}
