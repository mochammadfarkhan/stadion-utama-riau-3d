/**
 * Galeri tekstur PBR (T1): buka /tekstur-gallery.html, tunggu semua set termuat, screenshot + statistik memori.
 *   node tools/shots/teksturGaleri.mjs [--tier 512|256] [--gpu d3d11] [--port 5173]
 * Keluaran: docs/screenshots/m8/tekstur-galeri-<tier>.jpg + statistik JSON.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const { values: v } = parseArgs({ options: { tier: { type: 'string', default: '512' }, gpu: { type: 'string', default: 'd3d11' }, port: { type: 'string', default: '5173' } } });
const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: Number(v.port), strictPort: true }, logLevel: 'error' });
await server.listen();
const require = createRequire(import.meta.url);
let pw;
for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
  try { pw = require(c); break; } catch { /* berikutnya */ }
}
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(`http://localhost:${v.port}/tekstur-gallery.html?tier=${v.tier}`, { waitUntil: 'load' });
  const ok = await page.evaluate(() => window.__texGallery.ready);
  await page.waitForTimeout(800);
  console.log(JSON.stringify({ ok, stats: await page.evaluate(() => window.__texGallery.stats()), errors }));
  await page.screenshot({ path: join(ROOT, 'docs', 'screenshots', 'm8', `tekstur-galeri-${v.tier}.jpg`), type: 'jpeg', quality: 85 });
} finally {
  await browser.close();
  await server.close();
}
