#!/usr/bin/env node
/**
 * Ukur budget kit gedung M3 di dalam game — TIDAK ikut `vitest run`.
 *   node tests/e2e/kitBudget.e2e.mjs [--gpu d3d11|swiftshader] [--out docs/screenshots/unri]
 * Vite (port 5176) + Chromium headless 1280×720 (playwright global, seperti smoke.e2e.mjs). Per titik ukur:
 * teleport, tunggu klaster tenang (`__unriGedung.whenSettled`, hook DEV dari src/districts/unri/buildings.js),
 * hitung draw call gedung = calls(semua) − calls(grup `unri:gedung` disembunyikan) pada frame yang sama,
 * segitiga & mesh dari stats klaster, hitch p95 selama perakitan, lalu screenshot m3-<titik>.jpg.
 * Exit 0 bila: mesh ≤ 3 per klaster tampil, draw call gedung ≤ 70, segitiga gedung ≤ 350k, hitch p95 < 50 ms
 * (hanya d3d11), tanpa galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5176;
const LIMITS = Object.freeze({ meshesPerCluster: 3, calls: 70, triangles: 350000, hitchP95Ms: 50 });
const POINTS = Object.freeze([
  ['jalan-stadion-kampus', 0, 500, Math.PI], ['sekre-luar', -219, 1130, 0], ['rektorat', -979, 860, 0],
  ['masjid', -1009, 1383, 0], ['fkip', -900, 1100, 0], ['ft', -1420, 300, 0],
]);
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
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

/** Dievaluasi di halaman: teleport, ukur hitch selama menunggu klaster, lalu draw call gedung. */
async function measureAt([name, x, z, yaw]) {
  const s = window.__sim;
  const g = window.__unriGedung;
  if (!s || !g) return { name, error: '__sim / __unriGedung tidak ada (mode DEV?)' };
  s.store.set('sky.advanceTime', false);
  s.store.set('sky.hour', 12);
  s.store.set('weather.raining', false);
  s.teleport(x, z, yaw);
  const deltas = [];
  let last = performance.now();
  let run = true;
  const loop = () => {
    const now = performance.now();
    deltas.push(now - last);
    last = now;
    if (run) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const settled = await g.whenSettled(x, z, 900, 45000);
  await new Promise((r) => setTimeout(r, 1500));
  run = false;
  deltas.sort((a, b) => a - b);
  const p95 = deltas[Math.floor(deltas.length * 0.95)] ?? 0;
  const info = s.app.renderer.info.render;
  s.app.renderFrame();
  const all = info.calls;
  const allTris = info.triangles;
  g.group.visible = false;
  s.app.renderFrame();
  const without = info.calls;
  const withoutTris = info.triangles;
  g.group.visible = true;
  const st = g.stats();
  return {
    name, settled, hitchP95Ms: Math.round(p95), maxFrameMs: Math.round(deltas[deltas.length - 1] ?? 0),
    calls: all - without, trianglesRendered: allTris - withoutTris, totalCalls: all, ...st,
    meshesPerCluster: st.lod0 + st.lod1 ? st.meshes / (st.lod0 + st.lod1) : 0,
  };
}

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const outDir = join(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  const report = { gpu: opts.gpu, limits: LIMITS, points: [], errors: [], fail: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__sim?.app && window.__unriGedung && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start'); // headless: tanpa Mulai, fokus kamera/sepeda tidak berpindah ke titik ukur
    for (const p of POINTS) {
      const r = await page.evaluate(measureAt, p);
      await page.screenshot({ path: join(outDir, `m3-${p[0]}.jpg`), type: 'jpeg', quality: 85 });
      report.points.push(r);
      process.stderr.write(`${p[0]}: ${JSON.stringify(r)}\n`);
      if (r.error) report.fail.push(`${p[0]}: ${r.error}`);
      if (r.meshesPerCluster > LIMITS.meshesPerCluster) report.fail.push(`${p[0]}: mesh/klaster ${r.meshesPerCluster}`);
      if (r.calls > LIMITS.calls) report.fail.push(`${p[0]}: draw call gedung ${r.calls}`);
      if (r.triangles > LIMITS.triangles) report.fail.push(`${p[0]}: segitiga gedung ${r.triangles}`);
      if (opts.gpu === 'd3d11' && r.hitchP95Ms >= LIMITS.hitchP95Ms) report.fail.push(`${p[0]}: hitch p95 ${r.hitchP95Ms} ms`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (report.errors.length) report.fail.push(`${report.errors.length} galat konsol`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.fail.length ? 1 : 0;
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
