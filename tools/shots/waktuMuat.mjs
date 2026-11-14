#!/usr/bin/env node
/**
 * Pengukur waktu muat (R22): navigasi → tiap langkah layar muat (performance.mark 'muat:*') → tombol Mulai aktif,
 * lalu klik Mulai (simpanan kosong) → layar perjalanan tertutup (tiba di titik mulai).
 *   node tools/shots/waktuMuat.mjs [--putaran 3] [--dingin] [--build]
 * --build : ukur hasil `vite build` lewat `vite preview` (mendekati GitHub Pages); tanpa ini server dev (lebih lambat).
 * --dingin: konteks browser baru tiap putaran (cache HTTP kosong). Default: satu konteks, cache hangat setelah putaran 1.
 */
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: args } = parseArgs({
  options: { putaran: { type: 'string', default: '3' }, dingin: { type: 'boolean', default: false }, build: { type: 'boolean', default: false }, port: { type: 'string', default: '5179' } },
});
const ROUNDS = Math.max(1, Number(args.putaran) || 3);
const port = Number(args.port);
const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
const configFile = join(ROOT, 'vite.config.js');
let server;
let base = '/';
if (args.build) {
  await vite.build({ root: ROOT, configFile, logLevel: 'error' });
  server = await vite.preview({ root: ROOT, configFile, preview: { port, strictPort: true }, logLevel: 'error' });
  base = server.config.base ?? '/';
} else {
  server = await vite.createServer({ root: ROOT, configFile, server: { port, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
}
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
let ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const runs = [];
for (let r = 0; r < ROUNDS; r += 1) {
  if (args.dingin && r > 0) { await ctx.close(); ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }); }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* */ }
    window.__gaps = []; // jeda frame > 50 ms (rAF): membeku saat menu tampil?
    let last = performance.now();
    const tick = (t) => { if (t - last > 50) window.__gaps.push([last, t - last]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.goto(`http://localhost:${port}${base}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !document.getElementById('start')?.disabled, null, { timeout: 240000 });
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').filter((m) => m.name.startsWith('muat:')).map((m) => [m.name.slice(5), Math.round(m.startTime)]));
  const ready = await page.evaluate(() => Math.round(performance.now()));
  await page.waitForTimeout(4000); // menu terlihat: orbit + sisa streaming di belakangnya
  const menuGap = await page.evaluate((t) => Math.round(Math.max(0, ...window.__gaps.filter(([at]) => at >= t - 500).map(([, d]) => d))), ready);
  // Mulai → tiba (layar perjalanan tertutup)
  const t0 = await page.evaluate(() => { document.getElementById('start').click(); return performance.now(); });
  await page.waitForTimeout(200); // goTo memasang layar perjalanan secara sinkron setelah klik
  await page.waitForFunction(() => document.getElementById('travel-screen')?.classList.contains('hidden'), null, { timeout: 120000, polling: 100 });
  const arrive = await page.evaluate((t) => Math.round(performance.now() - t), t0);
  runs.push({ marks, ready, arrive, menuGap, errors: errors.length });
  console.log(`putaran ${r + 1}: Mulai aktif ${ready} ms, frame terpanjang 4 s setelahnya ${menuGap} ms, Mulai→tiba ${arrive} ms, galat ${errors.length}`);
  await page.close();
}
const last = runs[runs.length - 1].marks;
console.log('\nLangkah (putaran terakhir): label → ms sejak navigasi (+selisih)');
let prev = 0;
for (const [name, ms] of last) { console.log(`  ${String(ms).padStart(6)} (+${String(ms - prev).padStart(5)})  ${name}`); prev = ms; }
console.log(`\nMEDIAN: tombol Mulai aktif ${median(runs.map((x) => x.ready))} ms · frame terpanjang setelah menu ${median(runs.map((x) => x.menuGap))} ms · Mulai→tiba ${median(runs.map((x) => x.arrive))} ms`);
await browser.close();
await (server.close?.() ?? server.httpServer?.close());
process.exit(0);
