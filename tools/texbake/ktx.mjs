#!/usr/bin/env node
/**
 * Konversi tekstur PBR WebP (public/textures) -> KTX2 (Basis Universal) untuk memangkas VRAM ~3-4x di GPU.
 *   TOKTX=<jalur toktx.exe> npm run bake:ktx
 * toktx = KTX-Software (Khronos, Apache-2.0): https://github.com/KhronosGroup/KTX-Software/releases (tidak ikut repo).
 * Membaca public/textures/manifest.json, menulis <nama>/<jenis>.<ukuran>.ktx2 dan field `ktx2: [ukuran]` per set.
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ktxPath, ktxSizesFor, toktxArgs } from './ktxCore.mjs';
import { MAP_KINDS } from './sets.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'textures');
const TMP = join(ROOT, 'data-src', 'textures', '_ktx_tmp');
const toktx = process.env.TOKTX;
if (!toktx || !existsSync(toktx)) {
  console.error('Set env TOKTX ke toktx.exe (unduh KTX-Software dari rilis resmi Khronos).');
  process.exit(2);
}
mkdirSync(TMP, { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let total = 0;
for (const set of manifest.sets) {
  const sizes = ktxSizesFor(set.sizes);
  for (const size of sizes) {
    for (const kind of MAP_KINDS) {
      const png = join(TMP, `${set.name}.${kind}.${size}.png`);
      await sharp(join(OUT, `${set.name}/${kind}.${size}.webp`)).removeAlpha().png().toFile(png);
      const out = join(OUT, ktxPath(set.name, kind, size));
      execFileSync(toktx, toktxArgs(kind, { input: png, output: out }), { stdio: ['ignore', 'ignore', 'inherit'] });
      total += statSync(out).size;
      rmSync(png, { force: true });
    }
  }
  set.ktx2 = sizes;
  console.log(`${set.name.padEnd(10)} ktx2 ${sizes.join('/')}`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
rmSync(TMP, { recursive: true, force: true });
console.log(`total KTX2 ${(total / 1024 / 1024).toFixed(2)} MB`);
