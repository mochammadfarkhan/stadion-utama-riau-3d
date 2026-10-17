#!/usr/bin/env node
/**
 * Smoke test E2E Plan C (spec Fase 3 butir 5) — TIDAK ikut `vitest run` (nama bukan *.test.js).
 *   node tests/e2e/smoke.e2e.mjs [--gpu swiftshader|d3d11] [--out laporan.json] [--skip-ride]
 * Menjalankan Vite (port 5174) dari root repo, Chromium headless 1280×720 lewat paket `playwright`
 * global (npm i -g playwright; atau PLAYWRIGHT_PATH), lalu memeriksa:
 *   1. muat tanpa galat konsol;  2. draw call tile ≤ 150;  3. mount/unmount region 3× → memori GPU
 *   kembali ke baseline;  4. rute sepeda 1,5 km ke 3 arah, hitch p95 < 50 ms (hanya --gpu d3d11);
 *   5. perjalanan cepat ke Masjid Raya An-Nur lalu kembali (kendaraan mangkal tetap ada, tidak
 *   terduplikasi);  + paritas draw call kawasan stadion (laporan).
 * Exit code 0 = semua lulus. Kemajuan per tahap ditulis ke stderr (SwiftShader: beberapa detik/frame
 * di kawasan stadion, pakai --skip-ride), laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5174;
const LIMITS = Object.freeze({ tileCalls: 150, hitchP95Ms: 50, rideSpeed: 25, rideMeters: 1500 });
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

const { values: opts } = parseArgs({
  options: { gpu: { type: 'string', default: 'swiftshader' }, out: { type: 'string' }, 'skip-ride': { type: 'boolean', default: false } },
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

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  // fs.strict=false: worktree dengan node_modules berupa junction ke checkout utama (path di luar root).
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.swiftshader });
  const report = { gpu: opts.gpu, checks: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    const step = async (name, fn) => {
      const t0 = Date.now();
      process.stderr.write(`[e2e] ${name}…\n`);
      const v = await fn();
      process.stderr.write(`[e2e] ${name} selesai (${Math.round((Date.now() - t0) / 1000)} s)\n`);
      return v;
    };
    await step('muat halaman', () => page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 }));
    await step('tunggu __sim', () => page.waitForFunction(() => window.__sim?.app && window.__sim.city, null, { timeout: 240000 }));
    report.checks.load = await step('prepare', () => page.evaluate(PAGE.prepare));
    report.checks.tileCalls = await step('tileCalls', () => page.evaluate(PAGE.tileCalls));
    report.checks.parity = await step('parity', () => page.evaluate(PAGE.parity));
    report.checks.memory = await step('memoryCycle', () => page.evaluate(PAGE.memoryCycle));
    if (!opts['skip-ride']) report.checks.ride = await step('ride', () => page.evaluate(PAGE.ride, LIMITS));
    report.checks.fastTravel = await step('fastTravel', () => page.evaluate(PAGE.fastTravel));
    report.checks.tileCallsAnNur = await step('tileCallsAnNur', () => page.evaluate(PAGE.tileCalls));
    report.checks.fastTravelBack = await step('fastTravelBack', () => page.evaluate(PAGE.fastTravelBack));
  } finally {
    await browser.close();
    await server.close();
  }
  const fails = verdict(report);
  report.fails = fails;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = fails.length ? 1 : 0;
}

/** Daftar kegagalan dari laporan. */
function verdict(r) {
  const f = [];
  const c = r.checks;
  if (r.errors.length) f.push(`galat konsol: ${r.errors.length}`);
  if (!c.load?.settled) f.push('tile sekitar stadion tidak selesai dimuat');
  if (!(c.tileCalls?.calls <= LIMITS.tileCalls)) f.push(`draw call tile ${c.tileCalls?.calls} > ${LIMITS.tileCalls}`);
  if (!(c.tileCallsAnNur?.calls <= LIMITS.tileCalls)) f.push(`draw call tile An-Nur ${c.tileCallsAnNur?.calls} > ${LIMITS.tileCalls}`);
  const m = c.memory;
  const back = (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  if (!m || !m.cycles.every(back)) f.push(`memori tidak kembali ke baseline: ${JSON.stringify(m)}`);
  if (c.ride && r.gpu === 'd3d11' && !(c.ride.hitchP95 < LIMITS.hitchP95Ms)) f.push(`hitch p95 ${c.ride.hitchP95} ms ≥ ${LIMITS.hitchP95Ms}`);
  if (c.ride && c.ride.failedTiles > 0) f.push(`tile gagal saat rute: ${c.ride.failedTiles}`);
  if (!c.fastTravel?.ok || !(c.fastTravel.distance < 250)) f.push(`perjalanan cepat An-Nur gagal: ${JSON.stringify(c.fastTravel)}`);
  const ret = c.fastTravelBack;
  if (!ret?.ok || !(ret.vehicles > 0) || ret.vehicles !== c.fastTravel?.vehiclesBefore) {
    f.push(`kembali ke stadion / kendaraan mangkal: ${JSON.stringify({ ret, before: c.fastTravel?.vehiclesBefore })}`);
  }
  return f;
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js). */
const PAGE = {
  async prepare() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', 12);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    s.teleport(0, -275, 0);
    const settled = await s.city.whenSettled(0, -275, 1000, 90000);
    await new Promise((r) => setTimeout(r, 2000));
    return { settled, stats: s.city.stats() };
  },
  /** Draw call milik tile = calls(semua) − calls(grup kota disembunyikan), frame yang sama. */
  tileCalls() {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    s.city.group.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    s.city.group.visible = true;
    return { calls: all - without, total: all, triangles: s.city.stats().triangles };
  },
  /** Paritas kawasan stadion (snippet harness Plan A): rerata 60 frame, dengan & tanpa tile kota. */
  async parity() {
    const s = window.__sim;
    const sample = async () => {
      const calls = [];
      for (let i = 0; i < 60; i += 1) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        calls.push(s.app.renderer.info.render.calls);
      }
      return Math.round(calls.reduce((a, b) => a + b, 0) / calls.length);
    };
    const withCity = await sample();
    s.city.group.visible = false;
    const regionOnly = await sample();
    s.city.group.visible = true;
    return { callsMean: withCity, callsMeanRegionOnly: regionOnly, baselinePlanA: 502 };
  },
  /**
   * Siklus pasang/lepas region. Baseline diambil SETELAH satu siklus pemanasan: pada muat pertama model
   * GLB sudah siap sebelum frame pertama, sedangkan saat dipasang ulang versi prosedural cadangan
   * (tugu, serindit) sempat tergambar (terunggah ke GPU) sebelum GLB tiba — selisih tetap, bukan bocor.
   */
  async memoryCycle() {
    const s = window.__sim;
    const snap = async () => {
      for (let i = 0; i < 5; i += 1) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const m = s.app.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    };
    const initial = await snap();
    await s.remountRegion(); // pemanasan
    const baseline = await snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) {
      await s.remountRegion();
      cycles.push(await snap());
    }
    return { initial, baseline, cycles, after: cycles[cycles.length - 1] };
  },
  /** Kendarai sepeda di garis lurus (posisi diset per frame) ke 3 arah; ukur selang frame. */
  async ride({ rideSpeed, rideMeters }) {
    const s = window.__sim;
    const dirs = [[0, -1], [1, 0], [-Math.SQRT1_2, Math.SQRT1_2]];
    const deltas = [];
    const perDir = [];
    for (const [dx, dz] of dirs) {
      const from = deltas.length;
      s.teleport(0, -275, Math.atan2(dx, dz));
      await s.city.whenSettled(0, -275, 600, 60000);
      await new Promise((resolve) => {
        let last = performance.now();
        let dist = 0;
        const step = (now) => {
          const dt = Math.min(0.1, (now - last) / 1000);
          deltas.push(now - last);
          last = now;
          dist += rideSpeed * dt;
          const st = s.ents.bike.state;
          s.ents.bike.state = { ...st, x: dx * dist, z: -275 + dz * dist, yaw: Math.atan2(dx, dz), v: 0 };
          if (dist < rideMeters) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      const d = deltas.slice(from);
      perDir.push({ dir: [dx, dz].map((v) => Math.round(v * 100) / 100), frames: d.length, hitchP95: Math.round(percentile(d, 0.95)), maxMs: Math.round(Math.max(...d)) });
    }
    const st = s.city.stats();
    return {
      frames: deltas.length, hitchP95: Math.round(percentile(deltas, 0.95)), maxMs: Math.round(Math.max(...deltas)), failedTiles: st.failed, perDir,
    };
    function percentile(arr, p) {
      const v = [...arr].sort((a, b) => a - b);
      return v[Math.min(v.length - 1, Math.floor(p * v.length))];
    }
  },
  async fastTravel() {
    const s = window.__sim;
    const area = s.city.manifest.areas.find((a) => a.id === 'pusat');
    const cx = (area.bounds.minX + area.bounds.maxX) / 2;
    const cz = (area.bounds.minZ + area.bounds.maxZ) / 2;
    let vehiclesBefore = 0;
    s.app.scene.traverse((o) => { if (o.name.startsWith('kendaraan:')) vehiclesBefore += 1; });
    const t0 = performance.now();
    const status = await s.fastTravel('annur'); // 'ok' | 'timeout' | 'busy' | 'unknown'
    const travelMs = Math.round(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 1500));
    const b = s.ents.bike.state;
    const loaded = s.city.streamer.keys('loaded');
    return {
      ok: status === 'ok', status, travelMs, distance: Math.round(Math.hypot(b.x - cx, b.z - cz)), walkable: s.city.collider.isWalkable(b.x, b.z),
      pusatTiles: loaded.filter((k) => Number(k.split('_')[0]) >= 12).length, overlayHidden: document.getElementById('travel-screen')?.classList.contains('hidden'),
      vehiclesBefore,
    };
  },
  /** Kembali ke stadion: kendaraan mangkal (amandemen Task 18b) tetap ada & tidak terduplikasi. */
  async fastTravelBack() {
    const s = window.__sim;
    const t0 = performance.now();
    const status = await s.fastTravel('stadion');
    const travelMs = Math.round(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 1500));
    let vehicles = 0;
    s.app.scene.traverse((o) => { if (o.name.startsWith('kendaraan:')) vehicles += 1; });
    return { ok: status === 'ok', status, travelMs, vehicles };
  },
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
