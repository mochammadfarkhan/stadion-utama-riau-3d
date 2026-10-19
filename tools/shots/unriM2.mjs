/**
 * Verifikasi visual & budget M2 (tanah & jalan kampus UNRI): Vite + Chromium (Playwright, GPU) → screenshot titik
 * ukur ke docs/screenshots/unri/m2-<id>.jpg + draw call/segitiga distrik per titik (= render(semua) −
 * render(objek distrik disembunyikan): terrain bertint, tanah keras, air, vegetasi, props).
 *   node tools/shots/unriM2.mjs [--gpu d3d11|swiftshader] [--out laporan.json] [--only id1,id2]
 * Exit code 1 bila ada galat konsol, titik gagal dimuat, atau budget M2 terlampaui.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5179;
const OUT_DIR = join(ROOT, 'docs', 'screenshots', 'unri');
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
/**
 * Budget M2: distrik total ≤ 180 draw call termasuk klaster gedung M3 (spec §9.1) → M2 ≤ 110 (sisa ≥ 70 untuk M3).
 * Dinilai pada frame biasa (tanpa pass bayangan; bayangan hanya tiap SHADOW_INTERVAL frame). Frame bersama pass
 * bayangan dilaporkan terpisah (calls/triangles) dan hanya diberi peringatan. Segitiga di atas batas = peringatan
 * (terrain M1 ±180 rb dihitung di dalamnya).
 */
const LIMITS = Object.freeze({ calls: 110, triangles: 350000 });
/** Titik ukur: spec §9.2 + tiga titik batas distrik. yaw = atan2(dx, dz) arah pandang sepeda. */
const POINTS = Object.freeze([
  { id: 'batas-sm-amin', x: 410, z: 690, yaw: Math.PI / 2, note: 'batas timur: Jl. Muchtar Lutfi → Gerbang SM Amin (kota)' },
  { id: 'batas-soebrantas', x: -1072, z: 2080, yaw: 0, note: 'batas selatan: Jl. Binawidya → Gerbang Soebrantas (kota)' },
  { id: 'batas-stadion', x: 0, z: 430, yaw: Math.PI, note: 'batas utara: jalan kampus → kawasan stadion' },
  { id: 'jalan-stadion-kampus', x: 0, z: 500, yaw: 0, note: 'titik ukur spec §9.2' },
  { id: 'danau', x: -700, z: 760, yaw: Math.atan2(-70, 77), note: 'Danau Buatan: air, tanggul, parit' },
  { id: 'sekre-luar', x: -219, z: 1130, yaw: Math.PI, note: 'titik ukur spec §9.2' },
  { id: 'rektorat', x: -979, z: 860, yaw: Math.PI / 2, note: 'titik ukur spec §9.2' },
  { id: 'masjid', x: -1009, z: 1383, yaw: 0, note: 'titik ukur spec §9.2' },
]);

const { values: opts } = parseArgs({
  options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string' }, only: { type: 'string' } },
});

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
  prepare() {
    const s = window.__sim;
    s.rig.exitPov?.();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', 12);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    return true;
  },
  async visit(p) {
    const s = window.__sim;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    s.teleport(p.x, p.z, p.yaw);
    await s.city.whenSettled(p.x, p.z, 600, 60000);
    let root = null;
    for (let t = 0; t < 120 && !(root = s.app.scene.getObjectByName('unri:tanah-root')); t += 1) await sleep(250);
    if (!root) return { ok: false, reason: 'unri:tanah-root tidak ada (distrik tidak terpasang?)' };
    for (let i = 0; i < 3; i += 1) {
      await root.userData.whenIdle();
      await sleep(1000);
    }
    return { ok: true, stats: root.userData.stats() };
  },
  measure() {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    /** shadow: true = frame dengan pass bayangan (renderFrame), false = frame biasa (bayangan hanya tiap SHADOW_INTERVAL frame). */
    const frame = (shadow) => {
      s.app.render({ ...s.app.lastCtx, shadowFrame: shadow });
      return { calls: info.calls, triangles: info.triangles };
    };
    const own = [];
    s.app.scene.traverse((o) => {
      if ((o.name.startsWith('unri:') || (o.isMesh && o.material?.name === 'unri:tanahTerrain')) && o.visible) own.push(o);
    });
    const diff = (shadow) => {
      const all = frame(shadow);
      for (const o of own) o.visible = false;
      const rest = frame(shadow);
      for (const o of own) o.visible = true;
      return { calls: all.calls - rest.calls, triangles: all.triangles - rest.triangles, totalCalls: all.calls };
    };
    const withShadow = diff(true);
    const noShadow = diff(false);
    frame(true);
    return { ...withShadow, callsNoShadow: noShadow.calls, trianglesNoShadow: noShadow.triangles };
  },
  async night() {
    const s = window.__sim;
    s.store.set('sky.hour', 20.5);
    s.store.set('weather.raining', true);
    await new Promise((r) => setTimeout(r, 5000));
    return true;
  },
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const only = opts.only ? new Set(opts.only.split(',')) : null;
  const points = POINTS.filter((p) => !only || only.has(p.id));
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, limits: LIMITS, points: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.evaluate(PAGE.prepare);
    for (const p of points) {
      const visit = await page.evaluate(PAGE.visit, p);
      const measure = visit.ok ? await page.evaluate(PAGE.measure) : {};
      await page.screenshot({ path: join(OUT_DIR, `m2-${p.id}.jpg`), type: 'jpeg', quality: 85 });
      report.points[p.id] = { note: p.note, ...visit, ...measure };
      process.stderr.write(`[m2] ${p.id}: ${JSON.stringify(report.points[p.id])}\n`);
    }
    if (!only || only.has('rektorat')) {
      await page.evaluate(PAGE.visit, POINTS.find((p) => p.id === 'rektorat'));
      await page.evaluate(PAGE.night);
      await page.screenshot({ path: join(OUT_DIR, 'm2-malam-hujan-rektorat.jpg'), type: 'jpeg', quality: 85 });
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = [];
  const warnings = [];
  if (report.errors.length) fails.push(`galat konsol: ${report.errors.length}`);
  for (const [id, r] of Object.entries(report.points)) {
    if (!r.ok) fails.push(`${id}: ${r.reason}`);
    if (r.callsNoShadow > LIMITS.calls) fails.push(`${id}: draw call distrik ${r.callsNoShadow} > ${LIMITS.calls}`);
    if (r.trianglesNoShadow > LIMITS.triangles) warnings.push(`${id}: segitiga distrik ${r.trianglesNoShadow} > ${LIMITS.triangles}`);
    if (r.calls > LIMITS.calls) warnings.push(`${id}: draw call frame berbayangan ${r.calls} > ${LIMITS.calls}`);
  }
  report.fails = fails;
  report.warnings = warnings;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = fails.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
