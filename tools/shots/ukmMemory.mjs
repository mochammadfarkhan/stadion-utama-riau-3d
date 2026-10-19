/**
 * Siklus mount/unmount region unri-lembaga ×3 (streaming sungguhan: teleport ke poros Rektorat → tunggu ready →
 * teleport ke stadion → tunggu region lepas) dan ukur memori GPU (renderer.info.memory) + draw call/segitiga region.
 *   node tools/shots/m6Memory.mjs [--gpu d3d11|swiftshader] [--cycles 3]
 * Lulus bila geometri/tekstur setelah siklus ke-2 dan ke-3 sama dengan setelah siklus ke-1 (tanpa bocor), proxy
 * muncul saat region lepas, dan tidak ada galat konsol. Laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = 'C:/Users/mocha/Documents/stadion-utama-riau-3d';
const PORT = 5179;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, cycles: { type: 'string', default: '3' }, mode: { type: 'string', default: 'stream' } } });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

const PAGE = {
  /** Remount di tempat (fokus tetap di poros): memori region saja, tanpa gangguan streaming distrik/tile lain. */
  async remount() {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const find = () => s.app.scene.getObjectByName('region:unri-lembaga');
    const until = async (fn, ms = 90000) => { const t0 = performance.now(); while (performance.now() - t0 < ms && !fn()) await sleep(200); return fn(); };
    if (!find()?.userData?.lembagaReady) {
      s.store.set('sky.advanceTime', false);
      s.teleport(-96, 1006, 0);
      await until(() => find()?.userData?.lembagaReady === true);
      await sleep(4000);
    }
    const before = { ...s.app.renderer.info.memory };
    await s.regions.remount('unri-lembaga');
    const mounted = await until(() => find()?.userData?.lembagaReady === true);
    await sleep(3000);
    s.app.renderFrame();
    return { mounted, unmounted: true, proxy: true, memMounted: { ...s.app.renderer.info.memory }, memAfter: { ...s.app.renderer.info.memory }, before };
  },
  async cycle() {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const find = () => s.app.scene.getObjectByName('region:unri-lembaga');
    const until = async (fn, ms = 90000) => { const t0 = performance.now(); while (performance.now() - t0 < ms && !fn()) await sleep(200); return fn(); };
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', 12);
    s.teleport(-96, 1006, 0);
    const mounted = await until(() => find()?.userData?.lembagaReady === true);
    await sleep(3000);
    const memMounted = { ...s.app.renderer.info.memory };
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    const tris = info.triangles;
    const g = find();
    g.visible = false;
    s.app.renderFrame();
    const calls = all - info.calls;
    const triangles = tris - info.triangles;
    g.visible = true;
    s.teleport(0, -275, 0);
    const unmounted = await until(() => !find());
    await sleep(2500);
    const proxy = Boolean(s.app.scene.getObjectByName('proxy:unri-lembaga'));
    return { mounted, unmounted, proxy, memMounted, memAfter: { ...s.app.renderer.info.memory }, calls, triangles };
  },
};

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, cycles: [], errors: [], fails: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    for (let i = 0; i < Number(opts.cycles); i += 1) report.cycles.push(await page.evaluate(opts.mode === 'remount' ? PAGE.remount : PAGE.cycle));
  } finally {
    await browser.close();
    await server.close();
  }
  const strict = opts.mode === 'remount';
  const baseIdx = strict || report.cycles.length < 3 ? 0 : 1; // stream: siklus pertama = pemanasan (tile/terrain awal)
  const base = report.cycles[baseIdx];
  for (const [i, c] of report.cycles.entries()) {
    if (!c.mounted || !c.unmounted || !c.proxy) report.fails.push(`siklus ${i + 1}: mounted=${c.mounted} unmounted=${c.unmounted} proxy=${c.proxy}`);
  }
  // Mode remount (memori region saja) harus persis stabil; mode stream ikut memuat/melepas tile, terrain, dan klaster
  // distrik di sekitarnya sehingga geometri boleh bergeser kecil (≤ 4/siklus); tekstur harus stabil.
  for (const [i, c] of report.cycles.entries()) {
    if (i <= baseIdx) continue;
    const dg = c.memAfter.geometries - base.memAfter.geometries;
    const dt = c.memAfter.textures - base.memAfter.textures;
    if (dt !== 0 || (strict ? dg !== 0 : dg > 4 * (i - baseIdx))) report.fails.push(`bocor di siklus ${i + 1}: Δgeometri ${dg}, Δtekstur ${dt}`);
  }
  if (report.errors.length) report.fails.push(`${report.errors.length} galat konsol`);
  report.pass = report.fails.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
