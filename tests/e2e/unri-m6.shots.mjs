#!/usr/bin/env node
/**
 * Titik ukur & screenshot tonggak M6 (zona Rektorat + hero building) — TIDAK ikut vitest.
 *   node tests/e2e/unri-m6.shots.mjs [--gpu d3d11|swiftshader] [--out laporan.json]
 * Vite (port 5176) → Chromium headless 1280×720 → per shot: jam & cuaca cerah, kamera orang ketiga,
 * teleport sepeda, tunggu region unri-rektorat siap bila relevan, jeda, lalu JPEG ke docs/screenshots/unri/.
 * Mengukur: draw call region (calls semua − calls dengan grup region disembunyikan, frame sama; ≤ 250),
 * proxy dari stadion (≤ 8 mesh terlihat), ornamen N04 termuat. Exit 1 bila budget dilanggar / galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5176;
const OUT_DIR = join(ROOT, 'docs', 'screenshots', 'unri');
const LIMITS = Object.freeze({ regionCalls: 250, proxyMeshes: 8 });
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
/** Pose sepeda DUNIA (yaw konvensi sepeda: maju = (sin, cos)); `region` = tunggu region siap. */
const SHOTS = Object.freeze([
  { file: 'm6-rektorat-siang.jpg', hour: 10.5, x: -900.0, z: 803.0, yaw: -Math.PI / 2, region: true, measure: true },
  { file: 'm6-masjid-sore.jpg', hour: 17.0, x: -1022.0, z: 1316.0, yaw: 0.2, region: true },
  { file: 'm6-danau-malam.jpg', hour: 20.5, x: -723.8, z: 787.3, yaw: -0.6, region: true },
  { file: 'm6-ggm.jpg', hour: 9.0, x: 133.0, z: 338.0, yaw: 0, region: false },
  { file: 'm6-gerbang-sm-amin.jpg', hour: 15.0, x: 420.0, z: 695.4, yaw: -Math.PI / 2, region: false },
]);

const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string' } } });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* coba kandidat berikutnya */ }
  }
  throw new Error('Paket playwright tidak ditemukan (npm i -g playwright, atau set PLAYWRIGHT_PATH)');
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js). */
const PAGE = {
  async pose({ hour, x, z, yaw, region }) {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    s.rig.exitPov?.();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    s.teleport(x, z, yaw);
    const t0 = performance.now();
    while (region && performance.now() - t0 < 60000) {
      if (s.app.scene.getObjectByName('region:unri-rektorat')?.userData?.ready) break;
      await sleep(250);
    }
    await sleep(6000); // klaster distrik, GLB, bayangan
    return { regionReady: Boolean(s.app.scene.getObjectByName('region:unri-rektorat')?.userData?.ready), waitedMs: Math.round(performance.now() - t0) };
  },
  regionCalls() {
    const s = window.__sim;
    const g = s.app.scene.getObjectByName('region:unri-rektorat');
    if (!g) return { ok: false };
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    g.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    g.visible = true;
    return { ok: true, calls: all - without, total: all };
  },
  async proxyFromStadion() {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    s.teleport(0, -275, 0);
    const t0 = performance.now();
    while (performance.now() - t0 < 60000 && s.app.scene.getObjectByName('region:unri-rektorat')) await sleep(250);
    await sleep(1000);
    const p = s.app.scene.getObjectByName('proxy:unri-rektorat');
    let meshes = 0;
    p?.traverse((o) => { if (o.isMesh && o.visible) meshes += 1; });
    return { unmounted: !s.app.scene.getObjectByName('region:unri-rektorat'), proxy: Boolean(p), meshes };
  },
  ornaments() {
    const g = window.__sim.app.scene.getObjectByName('ornamenHero');
    return { layer: Boolean(g), loaded: g ? g.children.map((c) => c.name) : [] };
  },
};

function verdict(report) {
  const f = [];
  const m = report.measure;
  if (!m?.ok || !(m.calls <= LIMITS.regionCalls)) f.push(`draw call region ${m?.calls} > ${LIMITS.regionCalls}`);
  const p = report.proxy;
  if (!p?.unmounted || !p.proxy || !(p.meshes <= LIMITS.proxyMeshes)) f.push(`proxy: ${JSON.stringify(p)}`);
  if (report.shots.some((s) => s.region && !s.regionReady)) f.push('region tidak siap pada shot bertanda region');
  if (report.errors.length) f.push(`${report.errors.length} galat konsol/HTTP`);
  return f;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, shots: [], errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.addStyleTag({ content: 'body > *:not(#app):not(script):not(style) { display: none !important }' }); // bidikan bersih tanpa HUD/dialog
    for (const shot of SHOTS) {
      process.stderr.write(`[m6] ${shot.file}…\n`);
      const r = await page.evaluate(PAGE.pose, shot);
      if (shot.measure) report.measure = await page.evaluate(PAGE.regionCalls);
      await page.screenshot({ path: join(OUT_DIR, shot.file), type: 'jpeg', quality: 82 });
      report.shots.push({ file: shot.file, region: shot.region, ...r });
    }
    report.ornaments = await page.evaluate(PAGE.ornaments);
    report.proxy = await page.evaluate(PAGE.proxyFromStadion);
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = verdict(report);
  report.pass = fails.length === 0;
  report.failures = fails;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, json);
  process.stdout.write(`${json}\n`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
