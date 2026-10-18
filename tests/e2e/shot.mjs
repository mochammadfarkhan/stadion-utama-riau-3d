#!/usr/bin/env node
/**
 * Screenshot titik ukur (Playwright, GPU nyata) untuk dokumentasi per tonggak UNRI — TIDAK ikut vitest
 * (nama bukan *.test.js).
 *   node tests/e2e/shot.mjs --out docs/screenshots/unri/m0-stadion-pusat.jpg --at 0,-275,0
 *     [--hour 12] [--gpu d3d11|swiftshader] [--query dummyRegion=1] [--pov Digit8] [--wait 3000] [--stats]
 * Vite di port 5175 (root repo), Chromium headless 1280×720, tombol Mulai diklik (pointer lock ditolak
 * headless: sudah ditangani CameraRig), lalu teleport ke --at (x,z[,yaw] dunia), jam diset, cuaca cerah,
 * tile kota & region ditunggu tenang. --pov menekan tombol POV (mis. Digit8 = POV region). --stats
 * mencetak JSON: rerata 60 frame draw call & segitiga, memori GPU, region aktif, proxy yang tampak, label POV.
 * Exit 1 bila ada galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const POV_SETTLE_MS = 4000;
const SAMPLE_FRAMES = 60;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

const { values: opts } = parseArgs({
  options: {
    out: { type: 'string' },
    at: { type: 'string', default: '0,-275,0' },
    hour: { type: 'string', default: '12' },
    gpu: { type: 'string', default: 'd3d11' },
    query: { type: 'string', default: '' },
    pov: { type: 'string' },
    wait: { type: 'string', default: '3000' },
    stats: { type: 'boolean', default: false },
  },
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

/** "x,z[,yaw]" → {x, z, yaw}; galat jelas bila bukan angka. */
function parseAt(text) {
  const [x, z, yaw = 0] = text.split(',').map(Number);
  if (![x, z, yaw].every(Number.isFinite)) throw new Error(`--at harus "x,z[,yaw]" angka (dapat: "${text}")`);
  return { x, z, yaw };
}

/** Dievaluasi di halaman: siapkan adegan dan kembalikan statistik render. */
async function stage({ at, hour, pov, wait, povSettle, sampleFrames }) {
  const s = window.__sim;
  s.store.set('sky.advanceTime', false);
  s.store.set('sky.hour', hour);
  s.store.set('weather.raining', false);
  s.store.set('camera.mode', 'third');
  s.teleport(at.x, at.z, at.yaw);
  if (s.city) await s.city.whenSettled(at.x, at.z, 1000, 90000);
  await new Promise((r) => setTimeout(r, wait));
  await s.regions?.flush?.();
  if (pov) s.rig.handlePovKey(pov);
  await new Promise((r) => setTimeout(r, pov ? povSettle : 500));
  // Rerata SAMPLE_FRAMES frame (renderer.info di-reset tiap frame oleh App.render; baca antar frame).
  const info = s.app.renderer.info;
  let calls = 0;
  let triangles = 0;
  for (let i = 0; i < sampleFrames; i += 1) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    calls += info.render.calls;
    triangles += info.render.triangles;
  }
  const visibleProxies = [];
  s.app.scene.traverse((o) => { if (o.name.startsWith('proxy:') && o.visible) visibleProxies.push(o.name); });
  return {
    visibleProxies,
    callsMean: Math.round(calls / sampleFrames), trianglesMean: Math.round(triangles / sampleFrames),
    geometries: info.memory.geometries, textures: info.memory.textures,
    regions: s.regions ? s.regions.active().map((a) => a.def.id) : ['stadion'],
    povLabel: s.rig.povLabel,
  };
}

async function main() {
  if (!opts.out) throw new Error('--out <berkas.jpg> wajib');
  const at = parseAt(opts.at);
  const hour = Number(opts.hour);
  const wait = Number(opts.wait);
  if (!Number.isFinite(hour) || !Number.isFinite(wait)) throw new Error('--hour dan --wait harus angka');
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const query = opts.query ? `?${opts.query}` : '';
    await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    const stats = await page.evaluate(stage, { at, hour, pov: opts.pov ?? null, wait, povSettle: POV_SETTLE_MS, sampleFrames: SAMPLE_FRAMES });
    const out = join(ROOT, opts.out);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
    if (opts.stats) console.log(JSON.stringify({ out: opts.out, at, hour, ...stats, errors }, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
  if (errors.length) {
    console.error(`galat konsol: ${errors.length}\n${errors.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
