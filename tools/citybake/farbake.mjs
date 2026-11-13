/**
 * Bake "kota jauh" SELURUH Pekanbaru dari CSV hasil farFetch.mjs → public/far/ (lihat src/city/farCity.js, formatnya di sini):
 *  - manifest.json: sel 2000 m {key, nb, nr}, batas peta tanah.
 *  - b_{ix}_{iz}.bin: bangunan, 8 byte/bangunan: u16 x, u16 z (desimeter dari sudut sel), u8 lebar, u8 dalam (0,5 m), u8 tinggi (0,5 m), u8 kelas.
 *    Bangunan di dalam tile terperinci (public/tiles) dibuang (sudah digambar tile). Luas < MIN_AREA dibuang.
 *  - r_{ix}_{iz}.bin: jalan: [u8 kelas, u16 n, n × (i16 x, i16 z desimeter dari sudut sel)]… berurutan.
 *  - ground.webp: peta tanah 2048² (tutupan lahan, air, jalan besar, kerapatan bangunan) — dikompres karena hanya dilihat dari jauh.
 * Pakai: node tools/citybake/farbake.mjs   (butuh data-src/overture-kota/*.csv dari farFetch.mjs; air/lahan/jalan opsional)
 */
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { tileKey, tileOf } from '../../src/geo/tiles.js';
import { KOTA_BBOX } from './farFetch.mjs';

export const FAR = Object.freeze({ cell: 2000, minArea: 18, groundSize: 2048, outDir: join('public', 'far'), srcDir: join('data-src', 'overture-kota') });
/** Kelas bangunan → indeks palet klien. */
const BUILDING_CLASS = Object.freeze({ commercial: 1, retail: 1, office: 1, industrial: 2, warehouse: 2, religious: 3, mosque: 3, civic: 3, education: 3, school: 3, medical: 3, residential: 4, house: 4, apartments: 4 });
/** Kelas jalan → indeks (klien: lebar & warna). */
export const ROAD_INDEX = Object.freeze({ motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, unclassified: 5, residential: 6 });
const COVER_COLOR = Object.freeze({ forest: '#4f7a3a', shrub: '#7d9a55', grass: '#8fb36a', crop: '#b8c47a', wetland: '#7a9a7a', mangrove: '#4a7a5a', barren: '#cfc4a8', urban: '#b9b2a2', snow: '#eeeeee', moss: '#8fb36a' });
const BASE_COLOR = '#86a05c'; // dasar = vegetasi (kota rimbun); kawasan padat diberi bayangan atap dari peta kerapatan
const WATER_COLOR = '#3f6f8f';
const ROAD_STROKE = Object.freeze({ 0: 3.2, 1: 3, 2: 2.6, 3: 2.2, 4: 1.8, 5: 1.1, 6: 0.9 });

const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });

/** Pisah satu baris CSV sederhana (nilai berkutip ganda boleh mengandung koma). */
export function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i += 1; } else q = !q;
    } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** WKT (POINT-less: LINESTRING/MULTILINESTRING/POLYGON/MULTIPOLYGON) → daftar cincin/garis [[lon, lat], …]. */
export function wktParts(wkt) {
  const parts = [];
  for (const m of wkt.matchAll(/\(([^()]+)\)/g)) {
    const pts = m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite));
    if (pts.length >= 2) parts.push(pts);
  }
  return parts;
}

const toWorld = ([lon, lat]) => { const w = projection.toWorld(lat, lon); return [w.x, w.z]; };
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

async function readCsv(name) {
  const path = join(FAR.srcDir, name);
  if (!existsSync(path)) return null;
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
  const head = splitCsv(lines[0]);
  return { head, rows: lines.slice(1).filter(Boolean).map((l) => Object.fromEntries(splitCsv(l).map((v, i) => [head[i], v]))) };
}

/** Tebakan tinggi (m) bila data kosong: menurut luas jejak. */
const guessHeight = (area) => (area < 90 ? 3.6 : area < 220 ? 4.6 : area < 700 ? 7 : 9);

async function bakeBuildings(skipTiles, cellBuffers, density, groundBounds) {
  const csv = await readCsv('bangunan.csv');
  if (!csv) throw new Error('bangunan.csv tidak ada: jalankan farFetch.mjs dulu');
  let kept = 0;
  const gW = groundBounds.maxX - groundBounds.minX;
  const gH = groundBounds.maxZ - groundBounds.minZ;
  for (const r of csv.rows) {
    const lon = Number(r.lon);
    const lat = Number(r.lat);
    const [x, z] = toWorld([lon, lat]);
    const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
    const area = Number(r.area_deg2) * mPerDegLon * 110574;
    if (!(area >= FAR.minArea)) continue;
    // kerapatan untuk peta tanah (semua bangunan, juga yang di tile terperinci)
    const gx = Math.floor(((x - groundBounds.minX) / gW) * FAR.groundSize);
    const gz = Math.floor(((z - groundBounds.minZ) / gH) * FAR.groundSize);
    if (gx >= 0 && gz >= 0 && gx < FAR.groundSize && gz < FAR.groundSize) density[gz * FAR.groundSize + gx] += 1;
    const t = tileOf(x, z);
    if (skipTiles.has(tileKey(t.ix, t.iz))) continue;
    const ar = Math.max(0.25, Math.min(4, (Number(r.dlon) * mPerDegLon) / Math.max(1e-9, Number(r.dlat) * 110574)));
    const w = Math.sqrt(area * ar);
    const d = Math.sqrt(area / ar);
    const ix = Math.floor(x / FAR.cell);
    const iz = Math.floor(z / FAR.cell);
    const key = tileKey(ix, iz);
    const h = Number(r.h) > 0 ? Number(r.h) : guessHeight(area);
    const cls = BUILDING_CLASS[r.kelas] ?? 0;
    const buf = (cellBuffers.get(key) ?? cellBuffers.set(key, { ix, iz, b: [], r: [] }).get(key)).b;
    buf.push(Math.round((x - ix * FAR.cell) * 10), Math.round((z - iz * FAR.cell) * 10), clampByte(w * 2), clampByte(d * 2), clampByte(h * 2), cls);
    kept += 1;
  }
  return kept;
}

async function bakeRoads(cellBuffers, svgRoads) {
  const csv = await readCsv('jalan.csv');
  if (!csv) return 0;
  let n = 0;
  for (const r of csv.rows) {
    const cls = ROAD_INDEX[r.kelas];
    if (cls === undefined) continue;
    for (const line of wktParts(r.wkt)) {
      const pts = line.map(toWorld);
      if (pts.length < 2) continue;
      const ix = Math.floor(pts[0][0] / FAR.cell);
      const iz = Math.floor(pts[0][1] / FAR.cell);
      const key = tileKey(ix, iz);
      const buf = (cellBuffers.get(key) ?? cellBuffers.set(key, { ix, iz, b: [], r: [] }).get(key)).r;
      const local = pts.slice(0, 65535).map(([x, z]) => [Math.round((x - ix * FAR.cell) * 10), Math.round((z - iz * FAR.cell) * 10)]);
      if (local.some(([a, b]) => Math.abs(a) > 32767 || Math.abs(b) > 32767)) continue;
      buf.push({ cls, pts: local });
      svgRoads.push({ cls, pts });
      n += 1;
    }
  }
  return n;
}

const bounds = () => {
  const c = [[KOTA_BBOX.south, KOTA_BBOX.west], [KOTA_BBOX.north, KOTA_BBOX.east]].map(([la, lo]) => projection.toWorld(la, lo));
  return { minX: Math.min(c[0].x, c[1].x), maxX: Math.max(c[0].x, c[1].x), minZ: Math.min(c[0].z, c[1].z), maxZ: Math.max(c[0].z, c[1].z) };
};

async function bakeGround(gb, density, svgRoads) {
  const S = FAR.groundSize;
  const px = (x, z) => `${(((x - gb.minX) / (gb.maxX - gb.minX)) * S).toFixed(1)},${(((z - gb.minZ) / (gb.maxZ - gb.minZ)) * S).toFixed(1)}`;
  const ringPath = (ring) => `M${ring.map(toWorld).map(([x, z]) => px(x, z)).join('L')}Z`;
  const layers = [`<rect width="${S}" height="${S}" fill="${BASE_COLOR}"/>`];
  const cover = await readCsv('lahan.csv');
  if (cover) {
    const byClass = new Map();
    for (const r of cover.rows) (byClass.get(r.kelas) ?? byClass.set(r.kelas, []).get(r.kelas)).push(...wktParts(r.wkt).map(ringPath));
    for (const [cls, paths] of byClass) layers.push(`<path fill="${COVER_COLOR[cls] ?? BASE_COLOR}" fill-rule="evenodd" d="${paths.join('')}"/>`);
  }
  const water = await readCsv('air.csv');
  if (water) {
    const isLine = (r) => /^\s*(MULTI)?LINESTRING/i.test(r.wkt); // kanal/anak sungai = garis, bukan poligon
    const lineStrokes = { river: 3, canal: 1.1, stream: 0.9, drain: 0.7 };
    layers.push(`<path fill="${WATER_COLOR}" fill-rule="evenodd" d="${water.rows.filter((r) => !isLine(r)).flatMap((r) => wktParts(r.wkt).map(ringPath)).join('')}"/>`);
    for (const [sub, w] of Object.entries(lineStrokes)) {
      const d = water.rows.filter((r) => isLine(r) && r.subtype === sub).flatMap((r) => wktParts(r.wkt).map((l) => `M${l.map(toWorld).map(([x, z]) => px(x, z)).join('L')}`)).join('');
      if (d) layers.push(`<path fill="none" stroke="${WATER_COLOR}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`);
    }
  }
  const byStroke = new Map();
  for (const r of svgRoads) (byStroke.get(r.cls) ?? byStroke.set(r.cls, []).get(r.cls)).push(`M${r.pts.map(([x, z]) => px(x, z)).join('L')}`);
  for (const [cls, paths] of [...byStroke].sort((a, b) => b[0] - a[0])) {
    layers.push(`<path fill="none" stroke="${cls <= 2 ? '#8a8d94' : '#a4a6ab'}" stroke-width="${ROAD_STROKE[cls]}" stroke-linecap="round" stroke-linejoin="round" d="${paths.join('')}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${layers.join('')}</svg>`;
  // kerapatan bangunan → bayangan atap abu-cokelat (alfa), supaya kawasan padat terbaca dari jauh
  const overlay = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i += 1) {
    const a = Math.min(0.78, density[i] * 0.16);
    overlay[i * 4] = 158; overlay[i * 4 + 1] = 146; overlay[i * 4 + 2] = 132; overlay[i * 4 + 3] = Math.round(a * 255);
  }
  const out = join(FAR.outDir, 'ground.webp');
  await sharp(Buffer.from(svg), { limitInputPixels: false })
    .composite([{ input: overlay, raw: { width: S, height: S, channels: 4 }, blend: 'over' }])
    .webp({ quality: 72, effort: 5 })
    .toFile(out);
  return out;
}

async function main() {
  await mkdir(FAR.outDir, { recursive: true });
  const detailed = JSON.parse(await readFile(join('public', 'tiles', 'manifest.json'), 'utf8'));
  const skipTiles = new Set(detailed.tiles.map((t) => t.key));
  const gb = bounds();
  const density = new Uint16Array(FAR.groundSize * FAR.groundSize);
  const cells = new Map();
  const svgRoads = [];
  const nb = await bakeBuildings(skipTiles, cells, density, gb);
  const nr = await bakeRoads(cells, svgRoads);
  const manifest = { version: 1, cell: FAR.cell, bounds: gb, ground: { file: 'ground.webp', size: FAR.groundSize }, cells: [] };
  for (const [key, c] of cells) {
    const entry = { key, ix: c.ix, iz: c.iz, nb: c.b.length / 6, nr: c.r.length };
    if (entry.nb) {
      const buf = Buffer.alloc(entry.nb * 8);
      for (let i = 0; i < entry.nb; i += 1) {
        buf.writeUInt16LE(c.b[i * 6], i * 8); buf.writeUInt16LE(c.b[i * 6 + 1], i * 8 + 2);
        for (let k = 0; k < 4; k += 1) buf.writeUInt8(c.b[i * 6 + 2 + k], i * 8 + 4 + k);
      }
      await writeFile(join(FAR.outDir, `b_${key}.bin`), buf);
    }
    if (entry.nr) {
      const parts = c.r.map((l) => { const b = Buffer.alloc(3 + l.pts.length * 4); b.writeUInt8(l.cls, 0); b.writeUInt16LE(l.pts.length, 1); l.pts.forEach(([x, z], i) => { b.writeInt16LE(x, 3 + i * 4); b.writeInt16LE(z, 5 + i * 4); }); return b; });
      await writeFile(join(FAR.outDir, `r_${key}.bin`), Buffer.concat(parts));
    }
    manifest.cells.push(entry);
  }
  await writeFile(join(FAR.outDir, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  const ground = await bakeGround(gb, density, svgRoads);
  console.log(`far: ${nb} bangunan, ${nr} jalan, ${manifest.cells.length} sel, peta tanah ${ground}`);
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) main().catch((err) => { console.error(err); process.exit(1); });
