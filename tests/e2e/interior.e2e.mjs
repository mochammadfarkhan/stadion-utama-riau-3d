#!/usr/bin/env node
/**
 * E2E interior sekre (M5) — TIDAK ikut `vitest run` (nama bukan *.test.js).
 *   node tests/e2e/interior.e2e.mjs [--gpu d3d11|swiftshader] [--out laporan.json] [--shots]
 * Vite (port 5175) + Chromium headless 1280×720 (paket playwright global / PLAYWRIGHT_PATH), lalu:
 *   1. masuk sekre lewat __sim.portal.enter('sekre') tanpa galat konsol;
 *   2. budget spec §9.1 di 3 skenario (siang rapat, malam begadang, hujan): pass scene utama ≤ 150 draw call dan
 *      ≤ 150.000 segitiga; total semua pass frame ≤ 150 draw call (segitiga total dilaporkan);
 *   3. siklus masuk/keluar 3× → renderer.info.memory (geometri, tekstur) kembali ke baseline (setelah 1 siklus
 *      pemanasan: GTAO lazy dibuat sekali);
 *   4. --shots: docs/screenshots/unri/m5-siang-rapat.jpg, m5-malam-begadang.jpg, m5-hujan.jpg (mode foto).
 * Exit code 0 = lulus. Laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const LIMITS = Object.freeze({ sceneCalls: 150, sceneTriangles: 150000, frameCalls: 150 });
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const SCENARIOS = Object.freeze([
  { id: 'siang-rapat', hour: 10, rain: false, preset: 'lesehan' },
  { id: 'malam-begadang', hour: 21.25, rain: false, preset: 'pojok' },
  { id: 'hujan', hour: 15.5, rain: true, preset: 'lesehan' },
]);

const { values: opts } = parseArgs({
  options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string' }, shots: { type: 'boolean', default: false } },
});

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

/** Fungsi yang dievaluasi di halaman (window.__sim dari devtools.js; `portal` dipasang main.js M4). */
const PAGE = {
  async enter() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('weather.raining', false);
    const ok = await s.portal.enter('sekre');
    await s.portal.current?.built.ready;
    return { ok, state: s.portal.state };
  },
  async scenario({ hour, rain, preset }) {
    const s = window.__sim;
    const frames = (n) => new Promise((resolve) => {
      let k = 0;
      const step = () => { k += 1; if (k >= n) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    await new Promise((r) => setTimeout(r, rain ? 3000 : 600));
    document.body.classList.add('is-photo');
    await frames(3); // sistem interior.keys menyalakan mode foto rig dari kelas body
    const p = s.portal.current.built.photoPresets.find((x) => x.id === preset);
    s.portal.current.rig.applyPreset(p.pose);
    await frames(30);
    const r = s.app.renderer;
    const { scene, camera } = s.app.view;
    r.info.reset();
    scene.updateMatrixWorld();
    r.render(scene, camera); // pass scene utama saja (spec §9.1, keputusan plan M5 #7)
    const scenePass = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    s.app.renderFrame(); // semua pass (bayangan, GTAO, outline, vignette, output)
    const frame = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    const dbg = s.portal.current.built.debug;
    return { scenePass, frame, npcs: dbg.npcs.active, tlOn: dbg.lighting.tlOn };
  },
  endPhoto() {
    document.body.classList.remove('is-photo');
  },
  async memoryCycle() {
    const s = window.__sim;
    const frames = (n) => new Promise((resolve) => {
      let k = 0;
      const step = () => { k += 1; if (k >= n) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    const warmHumanoids = () => { // pola smoke.e2e: semua level LOD humanoid eksterior diunggah sebelum snapshot
      const saved = [];
      const force = (o, key, value) => { saved.push([o, key, o[key]]); o[key] = value; };
      s.app.scene.traverse((o) => {
        const info = o.userData?.humanoidLod;
        if (!info) return;
        for (const part of [info.body, info.mesh]) {
          force(part, 'visible', true);
          part.traverse((m) => { if (m.isMesh) force(m, 'frustumCulled', false); });
        }
      });
      s.app.renderFrame();
      for (let i = saved.length - 1; i >= 0; i -= 1) saved[i][0][saved[i][1]] = saved[i][2];
    };
    const snap = async () => {
      warmHumanoids();
      await frames(5);
      const m = s.app.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    };
    const cycle = async () => {
      await s.portal.enter('sekre');
      await s.portal.current.built.ready;
      await frames(30);
      await s.portal.exit();
      await frames(10);
    };
    if (s.portal.inside) await s.portal.exit();
    await frames(10);
    await cycle(); // pemanasan 2x: unggahan GPU pertama (GTAO lazy, LOD humanoid) selesai sebelum baseline
    await cycle();
    const baseline = await snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) {
      await cycle();
      cycles.push(await snap());
    }
    return { baseline, cycles };
  },
};

function verdict(r) {
  const f = [];
  if (r.errors.length) f.push(`galat konsol: ${r.errors.length}`);
  if (!r.checks.enter?.ok) f.push('gagal masuk sekre');
  for (const sc of r.checks.scenarios ?? []) {
    if (!(sc.scenePass.calls <= LIMITS.sceneCalls)) f.push(`${sc.id}: draw call scene ${sc.scenePass.calls} > ${LIMITS.sceneCalls}`);
    if (!(sc.scenePass.triangles <= LIMITS.sceneTriangles)) f.push(`${sc.id}: segitiga scene ${sc.scenePass.triangles} > ${LIMITS.sceneTriangles}`);
    if (!(sc.frame.calls <= LIMITS.frameCalls)) f.push(`${sc.id}: draw call frame ${sc.frame.calls} > ${LIMITS.frameCalls}`);
    if (!(sc.npcs.length >= 1)) f.push(`${sc.id}: tidak ada NPC`);
  }
  const m = r.checks.memory;
  const back = (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  if (!m || !m.cycles.every(back)) f.push(`memori tidak kembali ke baseline: ${JSON.stringify(m)}`);
  return f;
}

async function main() {
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
    page.on('console', (msg) => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    const step = async (name, fn) => {
      process.stderr.write(`[e2e-interior] ${name}…\n`);
      return fn();
    };
    await step('muat halaman', () => page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 }));
    await step('tunggu __sim.portal', () => page.waitForFunction(() => window.__sim?.portal, null, { timeout: 240000 }));
    await step('tutup menu awal', () => page.getByText('Mulai Petualangan').click().then(() => new Promise((r) => setTimeout(r, 1200))).catch(() => {}));
    report.checks.enter = await step('masuk sekre', () => page.evaluate(PAGE.enter));
    report.checks.scenarios = [];
    for (const sc of SCENARIOS) {
      const res = await step(`skenario ${sc.id}`, () => page.evaluate(PAGE.scenario, sc));
      report.checks.scenarios.push({ id: sc.id, ...res });
      if (opts.shots) {
        const dir = join(ROOT, 'docs', 'screenshots', 'unri');
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: join(dir, `m5-${sc.id}.jpg`), type: 'jpeg', quality: 88 });
      }
      await page.evaluate(PAGE.endPhoto);
    }
    report.checks.memory = await step('siklus memori 3×', () => page.evaluate(PAGE.memoryCycle));
  } finally {
    await browser.close();
    await server.close();
  }
  report.fails = verdict(report);
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = report.fails.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
