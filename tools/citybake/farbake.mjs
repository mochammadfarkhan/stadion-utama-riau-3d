/**
 * Bake "kota jauh" SELURUH Pekanbaru dari CSV hasil farFetch.mjs → public/far/ (lihat src/city/farCity.js, formatnya di sini):
 *  - manifest.json (versi 2): sel 2000 m {key, nb, nr, nt}, batas peta tanah.
 *  - b_{ix}_{iz}.bin: bangunan, 10 byte/bangunan: u16 x, u16 z (desimeter dari sudut sel), u8 lebar, u8 dalam (0,5 m), u8 tinggi (0,5 m),
 *    u8 kelas, u8 rotasi ((θ + π/4)/(π/2) × 255; θ = sudut sumbu-x kotak di bidang x–z), u8 bendera (bit0 = atap pelana).
 *    Orientasi & ukuran dari jejak (arah sisi dominan, ekstrem hasil rotasi, diskalakan ke luas asli). Bangunan di dalam tile terperinci
 *    (public/tiles) dibuang; luas < minArea dibuang.
 *  - r_{ix}_{iz}.bin: jalan: [u8 kelas, u16 n, n × (i16 x, i16 z desimeter dari sudut sel)]… berurutan.
 *  - t_{ix}_{iz}.bin: pohon, 5 byte: u16 x, u16 z (desimeter), u8 tinggi (0,5 m). Dari peta tanah: titik grid berjitter pada piksel hijau.
 *  - ground.webp: peta tanah 2048² (tutupan lahan, air, jalan besar, kerapatan bangunan) — dikompres karena hanya dilihat dari jauh.
 *  - glow.webp: peta pendar malam 512² satu kanal (kerapatan bangunan, diburamkan) — kawasan padat bersinar dari jauh (src/city/nightGlow.js).
 * Pakai: node tools/citybake/farbake.mjs   (butuh data-src/overture-kota/*.csv dari farFetch.mjs; air/lahan/jalan opsional)
 */
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import sharp from 'sharp';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { tileKey, tileOf } from '../../src/geo/tiles.js';
import { KOTA_BBOX } from './farFetch.mjs';

export const FAR = Object.freeze({
  cell: 2000, minArea: 18, groundSize: 2048, treeStep: 44, treeKeep: 0.5, outDir: join('public', 'far'), srcDir: join('data-src', 'overture-kota'),
});
/** Kelas bangunan → indeks palet klien. */
const BUILDING_CLASS = Object.freeze({ commercial: 1, retail: 1, office: 1, industrial: 2, warehouse: 2, religious: 3, mosque: 3, civic: 3, education: 3, school: 3, medical: 3, residential: 4, house: 4, apartments: 4 });
/** Kelas jalan → indeks (klien: lebar & warna). */
export const ROAD_INDEX = Object.freeze({ motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, unclassified: 5, residential: 6 });
const COVER_COLOR = Object.freeze({ forest: '#3f7030', shrub: '#6f9448', grass: '#82ad5a', crop: '#b4c070', wetland: '#6f9a74', mangrove: '#3f7550', barren: '#b8aa88', urban: '#827d6e', snow: '#eeeeee', moss: '#82ad5a' });
const BASE_COLOR = '#7a9a50'; // dasar = vegetasi (kota rimbun); kawasan padat diberi bayangan atap dari peta kerapatan
const WATER_COLOR = '#35688c';
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

/** WKT (LINESTRING/MULTILINESTRING/POLYGON/MULTIPOLYGON) → daftar cincin/garis [[lon, lat], …]. */
export function wktParts(wkt) {
  const parts = [];
  for (const m of wkt.matchAll(/\(([^()]+)\)/g)) {
    const pts = m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite));
    if (pts.length >= 2) parts.push(pts);
  }
  return parts;
}

/**
 * Orientasi & ukuran kotak dari cincin luar (titik meter lokal [x, z]): sudut sisi dominan (rata-rata 4θ tertimbang panjang)
 * dan ekstrem pada sumbu terputar. θ ∈ (−π/4, π/4]; w sepanjang sumbu x terputar, d sepanjang z. null bila cincin runtuh.
 */
export function orientedBox(pts) {
  if (pts.length < 3) return null;
  let c = 0;
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dz = pts[i + 1][1] - pts[i][1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const a = Math.atan2(dz, dx);
    c += len * Math.cos(4 * a);
    s += len * Math.sin(4 * a);
  }
  if (c === 0 && s === 0) return null;
  const theta = Math.atan2(s, c) / 4;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
  for (const [x, z] of pts) {
    const u = x * ct + z * st;
    const v = -x * st + z * ct;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  const w = maxU - minU;
  const d = maxV - minV;
  if (!(w > 0.1 && d > 0.1)) return null;
  // pusat kotak terputar → balik ke x,z
  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  return { theta, w, d, cx: cu * ct - cv * st, cz: cu * st + cv * ct };
}

/** Hash [0, 1) deterministik dari dua bilangan bulat. */
export function hash2(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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

const cellOf = (cells, ix, iz) => {
  const key = tileKey(ix, iz);
  return cells.get(key) ?? cells.set(key, { ix, iz, b: [], r: [], t: [] }).get(key);
};

async function bakeBuildings(skipTiles, cells, density, gb) {
  const path = join(FAR.srcDir, 'bangunan.csv');
  if (!existsSync(path)) throw new Error('bangunan.csv tidak ada: jalankan farFetch.mjs dulu');
  const gW = gb.maxX - gb.minX;
  const gH = gb.maxZ - gb.minZ;
  let kept = 0;
  let head = null;
  for await (const line of createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })) {
    if (!head) { head = splitCsv(line); continue; }
    if (!line) continue;
    const r = Object.fromEntries(splitCsv(line).map((v, i) => [head[i], v]));
    const lon = Number(r.lon);
    const lat = Number(r.lat);
    const [x0, z0] = toWorld([lon, lat]);
    const mLon = 111320 * Math.cos((lat * Math.PI) / 180);
    const mLat = 110574;
    const area = Number(r.area_deg2) * mLon * mLat;
    if (!(area >= FAR.minArea)) continue;
    const gx = Math.floor(((x0 - gb.minX) / gW) * FAR.groundSize);
    const gz = Math.floor(((z0 - gb.minZ) / gH) * FAR.groundSize);
    if (gx >= 0 && gz >= 0 && gx < FAR.groundSize && gz < FAR.groundSize) density[gz * FAR.groundSize + gx] += 1;
    // kotak terorientasi dari jejak (meter lokal terhadap pusat bbox; utara = −z)
    let w;
    let d;
    let theta = 0;
    let x = x0;
    let z = z0;
    const ring = r.wkt ? wktParts(r.wkt)[0] : null;
    const box = ring ? orientedBox(ring.map(([lo, la]) => [(lo - lon) * mLon, -(la - lat) * mLat])) : null;
    if (box) {
      const k = Math.min(1, Math.sqrt(area / (box.w * box.d))); // L/U-shape: kecilkan agar luas sesuai
      w = box.w * k; d = box.d * k; theta = box.theta; x = x0 + box.cx; z = z0 + box.cz;
    } else {
      const ar = Math.max(0.25, Math.min(4, (Number(r.dlon) * mLon) / Math.max(1e-9, Number(r.dlat) * mLat)));
      w = Math.sqrt(area * ar); d = Math.sqrt(area / ar);
    }
    const t = tileOf(x, z);
    if (skipTiles.has(tileKey(t.ix, t.iz))) continue;
    const ix = Math.floor(x / FAR.cell);
    const iz = Math.floor(z / FAR.cell);
    const h = Number(r.h) > 0 ? Number(r.h) : guessHeight(area);
    const cls = BUILDING_CLASS[r.kelas] ?? 0;
    const aspect = Math.max(w, d) / Math.max(0.1, Math.min(w, d));
    const gable = area < 170 && aspect < 2.8 && (cls === 0 || cls === 4) && h <= 7 ? 1 : 0; // rumah kecil: atap pelana (seperti tile LOD0)
    cellOf(cells, ix, iz).b.push(
      Math.round((x - ix * FAR.cell) * 10), Math.round((z - iz * FAR.cell) * 10),
      clampByte(w * 2), clampByte(d * 2), clampByte(h * 2), cls, clampByte(((theta + Math.PI / 4) / (Math.PI / 2)) * 255), gable,
    );
    kept += 1;
  }
  return kept;
}

async function bakeRoads(cells, svgRoads) {
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
      const local = pts.slice(0, 65535).map(([x, z]) => [Math.round((x - ix * FAR.cell) * 10), Math.round((z - iz * FAR.cell) * 10)]);
      if (local.some(([a, b]) => Math.abs(a) > 32767 || Math.abs(b) > 32767)) continue;
      cellOf(cells, ix, iz).r.push({ cls, pts: local });
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

/** Peta tanah: SVG (tutupan, air, jalan) + bayangan kerapatan → piksel RGBA mentah (untuk pohon) dan WebP. */
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
    layers.push(`<path fill="none" stroke="${cls <= 2 ? '#7d8087' : '#9a9ca2'}" stroke-width="${ROAD_STROKE[cls]}" stroke-linecap="round" stroke-linejoin="round" d="${paths.join('')}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${layers.join('')}</svg>`;
  // kerapatan bangunan → tanah gelap (bayangan antar-bangunan; bangunan 3D menggambar atapnya sendiri), supaya kawasan padat terbaca tanpa kerudung pucat
  const overlay = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i += 1) {
    const a = Math.min(0.55, density[i] * 0.12);
    overlay[i * 4] = 88; overlay[i * 4 + 1] = 82; overlay[i * 4 + 2] = 74; overlay[i * 4 + 3] = Math.round(a * 255);
  }
  const base = await sharp(Buffer.from(svg), { limitInputPixels: false })
    .composite([{ input: overlay, raw: { width: S, height: S, channels: 4 }, blend: 'over' }])
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = join(FAR.outDir, 'ground.webp');
  await sharp(base.data, { raw: base.info }).modulate({ saturation: 1.2, brightness: 0.94 }).webp({ quality: 74, effort: 5 }).toFile(out);
  // peta pendar: kerapatan → satu kanal, diperkecil 512² lalu diburamkan (pendar lembut, bukan titik); kecil (±40 KB)
  const lum = Buffer.alloc(S * S);
  for (let i = 0; i < S * S; i += 1) lum[i] = Math.min(255, density[i] * 34);
  await sharp(lum, { raw: { width: S, height: S, channels: 1 } }).resize(512, 512, { kernel: 'lanczos3' }).blur(1.6).webp({ quality: 80 }).toFile(join(FAR.outDir, 'glow.webp'));
  return { file: out, rgba: base.data };
}

/** Pohon dari peta tanah: titik grid berjitter (44 m) pada piksel hijau, peluang menurut kehijauan; di luar tile terperinci. */
function bakeTrees(cells, rgba, gb, skipTiles) {
  const S = FAR.groundSize;
  let n = 0;
  const step = FAR.treeStep;
  for (let gx = 0, ix = 0; gb.minX + gx < gb.maxX; gx += step, ix += 1) {
    for (let gz = 0, iz = 0; gb.minZ + gz < gb.maxZ; gz += step, iz += 1) {
      const x = gb.minX + gx + hash2(ix, iz) * step;
      const z = gb.minZ + gz + hash2(iz + 7, ix) * step;
      const t = tileOf(x, z);
      if (skipTiles.has(tileKey(t.ix, t.iz))) continue;
      const pxx = Math.floor(((x - gb.minX) / (gb.maxX - gb.minX)) * S);
      const pzz = Math.floor(((z - gb.minZ) / (gb.maxZ - gb.minZ)) * S);
      if (pxx < 0 || pzz < 0 || pxx >= S || pzz >= S) continue;
      const o = (pzz * S + pxx) * 4;
      const [r, g, b] = [rgba[o], rgba[o + 1], rgba[o + 2]];
      const score = Math.max(0, Math.min(1, (g - 0.5 * (r + b)) / 38)); // hijau = vegetasi; abu-abu (jalan/padat) & biru (air) ≈ 0
      if (hash2(ix * 31 + 5, iz * 17 + 3) > FAR.treeKeep * score) continue;
      const cx = Math.floor(x / FAR.cell);
      const cz = Math.floor(z / FAR.cell);
      const h = 6 + hash2(ix + 99, iz + 13) * 7;
      cellOf(cells, cx, cz).t.push(Math.round((x - cx * FAR.cell) * 10), Math.round((z - cz * FAR.cell) * 10), clampByte(h * 2));
      n += 1;
    }
  }
  return n;
}

async function main() {
  await mkdir(FAR.outDir, { recursive: true });
  for (const f of await readdir(FAR.outDir)) if (/^[brt]_.*\.bin$/.test(f)) await unlink(join(FAR.outDir, f)); // buang sel basi dari bake sebelumnya
  const detailed = JSON.parse(await readFile(join('public', 'tiles', 'manifest.json'), 'utf8'));
  const skipTiles = new Set(detailed.tiles.map((t) => t.key));
  const gb = bounds();
  const density = new Uint16Array(FAR.groundSize * FAR.groundSize);
  const cells = new Map();
  const svgRoads = [];
  const nb = await bakeBuildings(skipTiles, cells, density, gb);
  const nr = await bakeRoads(cells, svgRoads);
  const ground = await bakeGround(gb, density, svgRoads);
  const nt = bakeTrees(cells, ground.rgba, gb, skipTiles);
  const manifest = { version: 2, cell: FAR.cell, bounds: gb, ground: { file: 'ground.webp', size: FAR.groundSize }, glow: 'glow.webp', cells: [] };
  for (const [key, c] of cells) {
    const entry = { key, ix: c.ix, iz: c.iz, nb: c.b.length / 8, nr: c.r.length, nt: c.t.length / 3 };
    if (entry.nb) {
      const buf = Buffer.alloc(entry.nb * 10);
      for (let i = 0; i < entry.nb; i += 1) {
        buf.writeUInt16LE(c.b[i * 8], i * 10); buf.writeUInt16LE(c.b[i * 8 + 1], i * 10 + 2);
        for (let k = 0; k < 6; k += 1) buf.writeUInt8(c.b[i * 8 + 2 + k], i * 10 + 4 + k);
      }
      await writeFile(join(FAR.outDir, `b_${key}.bin`), buf);
    }
    if (entry.nr) {
      const parts = c.r.map((l) => { const b = Buffer.alloc(3 + l.pts.length * 4); b.writeUInt8(l.cls, 0); b.writeUInt16LE(l.pts.length, 1); l.pts.forEach(([x, z], i) => { b.writeInt16LE(x, 3 + i * 4); b.writeInt16LE(z, 5 + i * 4); }); return b; });
      await writeFile(join(FAR.outDir, `r_${key}.bin`), Buffer.concat(parts));
    }
    if (entry.nt) {
      const buf = Buffer.alloc(entry.nt * 5);
      for (let i = 0; i < entry.nt; i += 1) { buf.writeUInt16LE(c.t[i * 3], i * 5); buf.writeUInt16LE(c.t[i * 3 + 1], i * 5 + 2); buf.writeUInt8(c.t[i * 3 + 2], i * 5 + 4); }
      await writeFile(join(FAR.outDir, `t_${key}.bin`), buf);
    }
    manifest.cells.push(entry);
  }
  await writeFile(join(FAR.outDir, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  console.log(`far: ${nb} bangunan, ${nr} jalan, ${nt} pohon, ${manifest.cells.length} sel, peta tanah ${ground.file}`);
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) main().catch((err) => { console.error(err); process.exit(1); });
