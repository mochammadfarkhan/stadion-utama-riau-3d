#!/usr/bin/env node
/**
 * Bake tekstur prosedural (noise.fillCanvas) yang dibuat saat muat DAN di titik-titik kampus (region & distrik yang
 * dipasang belakangan) -> public/textures/proc/<kunci>.webp (lossless) + manifest.json. Kunci = sidik jari isi generator (noise.procKey): ubah warna/generator lalu lupa bake ulang
 * TIDAK merusak tampilan — kunci tidak cocok dan tekstur dibuat prosedural seperti dulu (hanya lebih lambat).
 *   npm run bake:proc        (Playwright GPU; port SIM_PORT, default harness)
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const OUT = join(ROOT, 'public', 'textures', 'proc');
const SETTLE_MS = 3000; // tekstur yang dibuat sesudah "Siap!" (streaming awal) ikut terekam
/** Titik dunia yang dikunjungi agar tekstur region/distrik kampus ikut terekam (dipakai fillCanvas sesudah muat). */
const VISIT = Object.freeze([
  [-150, 973], [-152, 853], [-232, 1095], [-905, 805], [-1040, 760], [-1010, 1334], [133, 440], [-500, 900],
]);

const sim = await openSim({
  query: '?procbake',
  beforeGoto: (page) => page.addInitScript(() => { globalThis.__procBake = []; }),
});
try {
  await sim.page.waitForTimeout(SETTLE_MS);
  for (const [x, z] of VISIT) await settleAt(sim.page, { x, z, waitMs: SETTLE_MS });
  const entries = await sim.page.evaluate(() => globalThis.__procBake.map(({ key, w, h, srgb, data }) => {
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { key, w, h, srgb, b64: btoa(bin) };
  }));
  if (sim.errors.length) console.warn('Galat halaman saat bake:', sim.errors);
  const unique = new Map(entries.map((e) => [e.key, e]));
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
  let bytes = 0;
  const manifest = [];
  for (const e of [...unique.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const file = `${e.key}.webp`;
    const raw = Buffer.from(e.b64, 'base64');
    const out = await sharp(raw, { raw: { width: e.w, height: e.h, channels: 4 } })
      .removeAlpha().webp({ lossless: true, effort: 6 }).toBuffer();
    writeFileSync(join(OUT, file), out);
    bytes += out.length;
    manifest.push({ key: e.key, file, srgb: e.srgb });
  }
  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify({ generatedBy: 'npm run bake:proc', entries: manifest }, null, 2)}\n`);
  console.log(`${manifest.length} tekstur (${entries.length} panggilan) -> ${OUT} | ${(bytes / 1024).toFixed(0)} KB`);
} finally {
  await sim.close();
}
