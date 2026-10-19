#!/usr/bin/env node
/**
 * E2E zona Lembaga (M4) — TIDAK ikut `vitest run`.
 *   node tests/e2e/lembaga.e2e.mjs [--gpu d3d11|swiftshader] [--out laporan.json]
 * Vite (port 5175) + Chromium headless 1280×720 (paket playwright global / PLAYWRIGHT_PATH), lalu:
 *   1. perjalanan cepat dev ke Sekretariat, tunggu region `unri-lembaga` siap;
 *   2. draw call region = calls(semua) − calls(grup region disembunyikan), frame yang sama (≤ 250, spec §9.1);
 *   3. screenshot siang, malam, hujan, selasar, stadion mini → docs/screenshots/unri/m4-*.jpg;
 *   4. masuk/keluar interior stub 3× → renderer.info.memory kembali ke baseline; screenshot interior.
 * Exit code 0 = lulus; laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const SHOTS = join(ROOT, 'docs', 'screenshots', 'unri');
const LIMITS = Object.freeze({ regionCalls: 250 });
/** Titik kamera (dunia): depan mulut selasar barat, di dalam selasar dekat pintu BEM, sisi timur stadion mini. */
const SPOTS = Object.freeze({
  mulut: { x: -232.12, z: 1094.84, yaw: 1.2383 },
  selasar: { x: -226.56, z: 1096.76, yaw: 1.2383 },
  stadion: { x: -150, z: 950, yaw: -Math.PI / 2 },
});
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

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

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, checks: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    const shot = (name) => page.screenshot({ path: join(SHOTS, `m4-${name}.jpg`), type: 'jpeg', quality: 85 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.fastTravel && window.__sim.portal, null, { timeout: 240000 });
    report.checks.travel = await page.evaluate(PAGE.travel);
    await page.waitForFunction(() => window.__sim.app.scene.getObjectByName('region:unri-lembaga')?.userData.lembagaReady === true, null, { timeout: 120000 });
    await page.evaluate(PAGE.view, { spot: SPOTS.mulut, hour: 12, rain: false });
    report.checks.budget = await page.evaluate(PAGE.budget);
    await shot('siang');
    await page.evaluate(PAGE.view, { spot: SPOTS.mulut, hour: 20, rain: false });
    await shot('malam');
    await page.evaluate(PAGE.view, { spot: SPOTS.mulut, hour: 16, rain: true });
    await shot('hujan');
    await page.evaluate(PAGE.view, { spot: SPOTS.selasar, hour: 12, rain: false });
    await shot('selasar');
    await page.evaluate(PAGE.view, { spot: SPOTS.stadion, hour: 9, rain: false });
    await shot('stadion-mini');
    report.checks.portal = await page.evaluate(PAGE.portalCycle);
    await page.evaluate(() => window.__sim.portal.enter('sekre'));
    await page.waitForFunction(() => window.__sim.portal.state === 'inside', null, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 800));
    await shot('interior-stub');
    await page.evaluate(() => window.__sim.portal.exit());
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = [];
  if (report.errors.length) fails.push(`galat konsol: ${report.errors.length}`);
  if (!(report.checks.budget?.regionCalls <= LIMITS.regionCalls)) fails.push(`draw call region ${report.checks.budget?.regionCalls} > ${LIMITS.regionCalls}`);
  const p = report.checks.portal;
  if (!p || !p.cycles.every((c) => c.state === 'outside' && c.geometries === p.baseline.geometries && c.textures === p.baseline.textures)) fails.push(`siklus portal/memori: ${JSON.stringify(p)}`);
  report.fails = fails;
  console.log(JSON.stringify(report, null, 2));
  if (opts.out) writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = fails.length ? 1 : 0;
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js + main.js). */
const PAGE = {
  async travel() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('camera.mode', 'third');
    const status = await s.fastTravel('unri-sekre');
    return { status, bike: { x: s.ents.bike.state.x, z: s.ents.bike.state.z } };
  },
  async view({ spot, hour, rain }) {
    const s = window.__sim;
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    s.teleport(spot.x, spot.z, spot.yaw);
    await new Promise((r) => setTimeout(r, rain ? 5000 : 3500));
    s.app.renderFrame();
  },
  budget() {
    const s = window.__sim;
    const region = s.app.scene.getObjectByName('region:unri-lembaga');
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    const tris = info.triangles;
    region.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    const trisWithout = info.triangles;
    region.visible = true;
    s.app.renderFrame();
    return { regionCalls: all - without, totalCalls: all, regionTriangles: tris - trisWithout };
  },
  async portalCycle() {
    const s = window.__sim;
    const wait = (state) => new Promise((resolve, reject) => {
      const t0 = performance.now();
      const tick = () => {
        if (s.portal.state === state) return resolve();
        if (performance.now() - t0 > 15000) return reject(new Error(`portal tidak mencapai ${state}`));
        return setTimeout(tick, 50);
      };
      tick();
    });
    const frames = async (n) => {
      for (let i = 0; i < n; i += 1) await new Promise((r) => requestAnimationFrame(() => r()));
    };
    const once = async () => {
      await s.portal.enter('sekre');
      await wait('inside');
      await frames(10);
      await s.portal.exit();
      await wait('outside');
      await frames(10);
      const m = s.app.renderer.info.memory;
      return { state: s.portal.state, geometries: m.geometries, textures: m.textures };
    };
    await once(); // pemanasan: unggahan GPU pertama
    const baseline = { ...s.app.renderer.info.memory };
    const cycles = [];
    for (let i = 0; i < 3; i += 1) cycles.push(await once());
    return { baseline, cycles };
  },
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
