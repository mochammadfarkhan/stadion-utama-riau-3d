#!/usr/bin/env node
/**
 * Harness Playwright GPU kecil untuk kampus UNRI (dev/E2E, TIDAK ikut vitest): menyalakan Vite + Chromium headless,
 * menunggu window.__sim, menyembunyikan menu, `settleAt` (teleport + tunggu kota/distrik/region/scheduler), dan
 * skenario cek cepat per task. Dipakai juga oleh tests/e2e/shots.unri.mjs.
 *   node tests/e2e/harness.unri.mjs <skenario> [--gpu d3d11|swiftshader] [--shot berkas.jpg]
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
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

/** Vite (port) + Chromium headless; kembalikan { page, errors, close() }. */
export async function openSim({ port = Number(process.env.SIM_PORT) || 5176, gpu = 'd3d11', width = 1600, height = 900, beforeGoto = null, query = '' } = {}) {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[gpu] ?? GPU_ARGS.d3d11 });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (res) => { if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`); });
  if (beforeGoto) await beforeGoto(page); // mis. addInitScript untuk menyuntik localStorage
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__sim?.app && window.__sim.district, null, { timeout: 240000 });
  await page.evaluate(() => {
    document.getElementById('overlay')?.classList.add('hidden');
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
  });
  return {
    page,
    errors,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}

/** Teleport + jam game, lalu tunggu tile kota, distrik, region hero yang menaungi titik, dan antrean scheduler. */
export async function settleAt(page, { x, z, yaw = 0, hour = 12, waitMs = 2500 }) {
  return page.evaluate(async (p) => {
    const s = window.__sim;
    s.store.set('sky.hour', p.hour);
    s.teleport(p.x, p.z, p.yaw);
    await new Promise((r) => requestAnimationFrame(r));
    if (s.city) await s.city.whenSettled(p.x, p.z, 1000, 90000);
    if (s.district?.whenSettled) await s.district.whenSettled(p.x, p.z);
    const id = s.regionIdAt?.(p.x, p.z) ?? null;
    for (let t = 0; id && t < 300 && !s.regions.active().some((a) => a.def.id === id); t += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
    await new Promise((r) => setTimeout(r, p.waitMs));
    return { region: id };
  }, { x, z, yaw, hour, waitMs });
}

/** Skenario cek cepat (posisi dunia; yaw konvensi maju = (sin, cos)). */
export const SCENARIOS = Object.freeze({
  mahasiswa: { x: -206, z: 1118, yaw: -2.52, hour: 10, read: () => window.__sim.district.district.life.students.stats },
  'mahasiswa-malam': { x: -206, z: 1118, yaw: -2.52, hour: 23, read: () => window.__sim.district.district.life.students.stats },
  satpam: { x: -1074.7, z: 1316, yaw: Math.PI, hour: 9, read: () => window.__sim.district.district.life.guards.stats },
  motor: { x: -922, z: 992, yaw: -2.06, hour: 11, read: () => window.__sim.district.district.life.motors.stats },
  'motor-malam': { x: -922, z: 992, yaw: -2.06, hour: 23, read: () => window.__sim.district.district.life.motors.stats },
  props: {
    x: -1074, z: 2088, yaw: Math.PI, hour: 9.5,
    read: () => ({
      plang: Boolean(window.__sim.app.scene.getObjectByName('plangLambangUnri')),
      halte: window.__sim.district.district.life.props.halteCount,
    }),
  },
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true, options: { gpu: { type: 'string', default: 'd3d11' }, shot: { type: 'string' } },
  });
  const name = positionals[0];
  const sc = SCENARIOS[name];
  if (!sc) {
    console.error(`Skenario tidak dikenal. Pilih: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exitCode = 2;
  } else {
    const sim = await openSim({ gpu: values.gpu });
    try {
      await settleAt(sim.page, sc);
      const data = await sim.page.evaluate(sc.read);
      if (values.shot) {
        await sim.page.evaluate(() => document.body.classList.add('is-photo'));
        await sim.page.screenshot({ path: values.shot, type: 'jpeg', quality: 85 });
      }
      console.log(JSON.stringify({ scenario: name, data, errors: sim.errors }, null, 2));
    } finally {
      await sim.close();
    }
  }
}
