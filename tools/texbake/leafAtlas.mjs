#!/usr/bin/env node
/**
 * Lukis atlas daun prosedural: public/textures/daun/atlas.webp (1024², alpha bersih) + entri `atlases` di manifest.json.
 *   node tools/texbake/leafAtlas.mjs
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ATLAS_SIZE, CELL, PALETTE, VARIANTS, atlasManifestEntry, variantSvg } from './leafAtlasCore.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'textures');
const FILE = 'daun/atlas.webp';
const UNDER = [0x3e, 0x6b, 0x2c];

const cells = await Promise.all(VARIANTS.map(async (v) => ({
  input: await sharp(Buffer.from(variantSvg(v)), { density: 72 }).png().toBuffer(),
  left: v.col * CELL,
  top: v.row * CELL,
})));
const { data } = await sharp({ create: { width: ATLAS_SIZE, height: ATLAS_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells).raw().toBuffer({ resolveWithObject: true });

// Piksel hampir transparan: warna dasar hijau (bukan hitam/putih) agar tidak ada halo saat filter bilinear/mip.
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 10) { data[i] = UNDER[0]; data[i + 1] = UNDER[1]; data[i + 2] = UNDER[2]; data[i + 3] = 0; }
}
mkdirSync(join(OUT, 'daun'), { recursive: true });
const path = join(OUT, FILE);
await sharp(data, { raw: { width: ATLAS_SIZE, height: ATLAS_SIZE, channels: 4 } })
  .webp({ quality: 88, alphaQuality: 100, effort: 5, smartSubsample: false }).toFile(path);
const bytes = statSync(path).size;

const manifestPath = join(OUT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.atlases = [atlasManifestEntry(FILE, bytes)];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`atlas daun ${(bytes / 1024).toFixed(0)} KB, palet ${Object.values(PALETTE).join(' ')}`);
