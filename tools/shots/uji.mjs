#!/usr/bin/env node
/**
 * Bidikan ruang uji (/ruang-uji.html) — cek cepat satu model/karakter tanpa memuat dunia. TIDAK ikut vitest.
 *   node tools/shots/uji.mjs --q "orang=kasual-pria-g&anim=jalan-p&cam=34" [--q "model=models/sekre-hq/meja.glb"] \
 *     [--out dir] [--nama uji] [--wait 600] [--gpu d3d11|swiftshader]
 * Tiap --q = satu bidikan (<out>/<nama>-<i>.jpg); mencetak window.__uji.info (ukuran, segitiga, klip) + galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5177;
const GPU_ARGS = {
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
};
const { values: o } = parseArgs({ options: {
  q: { type: 'string', multiple: true, default: ['orang=kasual-pria-g'] }, out: { type: 'string', default: join(ROOT, 'docs', 'screenshots', 'uji') },
  nama: { type: 'string', default: 'uji' }, wait: { type: 'string', default: '600' }, gpu: { type: 'string', default: 'd3d11' },
  width: { type: 'string', default: '960' }, height: { type: 'string', default: '720' },
} });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

async function main() {
  mkdirSync(o.out, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[o.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: Number(o.width), height: Number(o.height) }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
    for (const [i, q] of o.q.entries()) {
      await page.goto(`http://localhost:${PORT}/ruang-uji.html?bersih=1&${q}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__uji?.ready, null, { timeout: 120000 });
      await new Promise((r) => setTimeout(r, Number(o.wait)));
      const file = join(o.out, `${o.nama}-${i}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
      console.log('bidik', file, q, JSON.stringify(await page.evaluate(() => window.__uji.info)));
    }
  } finally {
    console.log('errors', JSON.stringify([...new Set(errors)].slice(0, 12), null, 1));
    await browser.close();
    await server.close();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
