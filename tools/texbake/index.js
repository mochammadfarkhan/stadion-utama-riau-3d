#!/usr/bin/env node
/**
 * Bake tekstur PBR: data-src/textures/<ID>/ (hasil download.mjs) -> public/textures/<nama>/{albedo,normal,orm}.<ukuran>.webp
 * + public/textures/manifest.json. ORM: R=AO, G=Roughness, B=0.   npm run bake:tex
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SETS, SOURCE, averageColor, mapPath, packOrm, pickMapFile, resizePlan, validateManifest } from './sets.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SRC = join(ROOT, 'data-src', 'textures');
const OUT = join(ROOT, 'public', 'textures');
const QUALITY = { albedo: 82, normal: 88, orm: 82 };

const gray = async (file, size) => (file ? sharp(file).resize(size, size, { kernel: 'lanczos3' }).greyscale().raw().toBuffer() : null);

async function bakeSet(set) {
  const dir = join(SRC, set.id);
  const files = readdirSync(dir);
  const pick = (k) => { const f = pickMapFile(files, k); return f ? join(dir, f) : null; };
  const color = pick('color');
  const normal = pick('normal');
  if (!color || !normal) throw new Error(`${set.id}: peta Color/NormalGL tidak ada`);
  const rough = pick('rough');
  const ao = pick('ao');
  const sizes = resizePlan(set);
  mkdirSync(join(OUT, set.name), { recursive: true });
  let bytes = 0;
  for (const size of sizes) {
    const write = async (kind, pipeline) => {
      const p = join(OUT, mapPath(set.name, kind, size));
      await pipeline.webp({ quality: QUALITY[kind], effort: 5 }).toFile(p);
      bytes += statSync(p).size;
    };
    await write('albedo', sharp(color).resize(size, size, { kernel: 'lanczos3' }).removeAlpha());
    await write('normal', sharp(normal).resize(size, size, { kernel: 'lanczos3' }).removeAlpha());
    const [a, r] = await Promise.all([gray(ao, size), gray(rough, size)]);
    const orm = packOrm(a, r, size * size);
    await write('orm', sharp(orm, { raw: { width: size, height: size, channels: 3 } }));
  }
  const tiny = await sharp(color).resize(8, 8).removeAlpha().raw().toBuffer();
  const meta = JSON.parse(readFileSync(join(SRC, `${set.id}.meta.json`), 'utf8'));
  return {
    name: set.name, category: set.category, tileM: set.tileM, sizes, avg: averageColor(tiny), hasAo: Boolean(ao),
    sourceId: set.id, sourceName: meta.displayName ?? set.id, sourceUrl: `${SOURCE.url}/view?id=${set.id}`, license: SOURCE.license, bytes,
  };
}

const sets = [];
for (const set of SETS) {
  const entry = await bakeSet(set);
  sets.push(entry);
  console.log(`${entry.name.padEnd(10)} ${entry.sourceId.padEnd(20)} ${entry.sizes.join('/')} ${(entry.bytes / 1024).toFixed(0)} KB avg ${entry.avg}`);
}
const manifest = { v: 1, source: SOURCE, sets };
const errs = validateManifest(manifest);
if (errs.length) throw new Error(`manifest tidak valid:\n${errs.join('\n')}`);
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
const attribution = [
  'Tekstur PBR dalam folder ini berasal dari ambientCG (https://ambientcg.com), lisensi CC0 1.0 (domain publik, tanpa kewajiban atribusi;',
  `dicatat di sini sebagai itikad baik). Lisensi: ${SOURCE.licenseUrl}`,
  'Diubah ukuran ke 1024/512/256 px, dikonversi WebP, peta AO+Roughness dipak ke kanal R+G ("orm"). Tidak ada perubahan isi gambar lain.',
  '',
  ...sets.map((s) => `${s.name.padEnd(10)} ${s.sourceId.padEnd(20)} ${s.sourceUrl}  (${s.category}, tile ${s.tileM} m)`),
  '',
].join('\n');
writeFileSync(join(OUT, 'ATTRIBUTION.txt'), attribution);
const total = sets.reduce((a, s) => a + s.bytes, 0);
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB di public/textures`);
