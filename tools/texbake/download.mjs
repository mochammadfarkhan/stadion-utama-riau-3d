#!/usr/bin/env node
/**
 * Unduh paket 1K-JPG ambientCG (CC0) ke data-src/textures/<ID>/ (gitignore), SEKUENSIAL dengan jeda >= 1 dtk.
 *   node tools/texbake/download.mjs [--only Grass004,Moss002]
 * Juga menyimpan metadata API (dimensionX/Y cm, tag, lisensi) ke data-src/textures/<ID>.meta.json.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SETS } from './sets.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data-src', 'textures');
const { values } = parseArgs({ options: { only: { type: 'string', default: '' } } });
const only = values.only ? values.only.split(',') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
for (const set of SETS) {
  if (only && !only.includes(set.id)) continue;
  const dir = join(OUT, set.id);
  if (existsSync(join(dir, '.done'))) { console.log(`lewati ${set.id} (sudah ada)`); continue; }
  const res = await fetch(`https://ambientcg.com/api/v2/full_json?id=${set.id}&include=downloadData`);
  if (!res.ok) throw new Error(`API ${set.id}: HTTP ${res.status}`);
  const asset = (await res.json()).foundAssets?.[0];
  if (!asset) throw new Error(`Aset ${set.id} tidak ditemukan`);
  const dl = asset.downloadFolders.default.downloadFiletypeCategories.zip.downloads.find((d) => d.attribute === '1K-JPG');
  if (!dl || new URL(dl.fullDownloadPath).hostname !== 'ambientcg.com') throw new Error(`Unduhan 1K-JPG ${set.id} tidak valid`);
  writeFileSync(join(OUT, `${set.id}.meta.json`), JSON.stringify({
    id: set.id, displayName: asset.displayName, dimensionX: asset.dimensionX, dimensionY: asset.dimensionY, tags: asset.tags, shortLink: asset.shortLink, size: dl.size,
  }, null, 1));
  console.log(`unduh ${dl.fileName} (${(dl.size / 1e6).toFixed(1)} MB) dim=${asset.dimensionX}x${asset.dimensionY}`);
  const zip = join(OUT, dl.fileName);
  const file = await fetch(dl.fullDownloadPath);
  if (!file.ok) throw new Error(`Unduh ${set.id}: HTTP ${file.status}`);
  writeFileSync(zip, Buffer.from(await file.arrayBuffer()));
  mkdirSync(dir, { recursive: true });
  execFileSync('C:/Windows/System32/tar.exe', ['-xf', dl.fileName, '-C', set.id], { cwd: OUT });
  writeFileSync(join(dir, '.done'), '');
  await sleep(1200);
}
console.log('selesai');
