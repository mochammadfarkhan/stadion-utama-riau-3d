#!/usr/bin/env node
/**
 * Screenshot galeri kit gedung (review visual M3) — TIDAK ikut `vitest run`.
 *   node tests/e2e/kitGallery.shot.mjs [--gpu d3d11|swiftshader] [--out docs/screenshots/unri]
 * Menjalankan Vite (port 5175) dari root repo, Chromium headless 1600×900 (paket `playwright` global seperti
 * smoke.e2e.mjs), membuka /kit-gallery.html dengan beberapa query, menyimpan JPG, dan mencetak statistik
 * (segitiga per spesimen, draw call) sebagai JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const SHOTS = Object.freeze([
  ['m3-galeri.jpg', 'kit=all'],
  ['m3-galeri-variasi.jpg', 'kit=variasi&cam=atas'],
  ['m3-galeri-malam.jpg', 'kit=all&malam=1'],
  ['m3-galeri-lod1.jpg', 'kit=all&lod=1'],
  ['m3-atlas.jpg', 'atlas=1'],
  ...['K01', 'K02', 'K03', 'K04', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'hero'].map((k) => [`m3-${k.toLowerCase()}.jpg`, `kit=${k}`]),
]);

const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: 'docs/screenshots/unri' } } });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* kandidat berikutnya */ }
  }
  throw new Error('Paket playwright tidak ditemukan (npm i -g playwright, atau set PLAYWRIGHT_PATH)');
}

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const outDir = join(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  const report = { gpu: opts.gpu, shots: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push(`${m.type()}: ${m.text()}`); });
    for (const [file, query] of SHOTS) {
      await page.goto(`http://localhost:${PORT}/kit-gallery.html?${query}`);
      await page.waitForFunction(() => window.__kitGallery?.ready === true, null, { timeout: 120000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 88 });
      report.shots[file] = await page.evaluate(() => window.__kitGallery.stats);
      process.stderr.write(`ok ${file}\n`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.errors.length) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
