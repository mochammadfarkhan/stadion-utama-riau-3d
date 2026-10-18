#!/usr/bin/env node
/**
 * Pengambil screenshot interior sekre (M5) untuk tinjauan visual — TIDAK ikut vitest.
 *   node tools/shots/m5Interior.mjs --spec shots.json [--gpu d3d11|swiftshader] [--prefix m5-] [--out dir]
 * shots.json: [{ name, hour, rain, pose: { position:[x,y,z], target:[x,y,z], fov }, walk?: {x,z,yaw}, wait? }]
 * Pose = koordinat ruang-lokal sekre; kamera foto bebas dipakai (body.is-photo) sehingga UI tersembunyi.
 * Selain gambar: mencetak galat konsol + renderer.info pass utama & total.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5176;
const GPU_ARGS = {
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
};
const { values: o } = parseArgs({ options: {
  spec: { type: 'string' }, gpu: { type: 'string', default: 'd3d11' }, prefix: { type: 'string', default: 'm5-' },
  out: { type: 'string', default: join(ROOT, 'docs', 'screenshots', 'unri') }, width: { type: 'string', default: '1280' }, height: { type: 'string', default: '720' },
} });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

const PAGE = {
  async enter() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    await s.fastTravel('unri-lembaga');
    const t0 = performance.now();
    while (!s.app.scene.getObjectByName('region:unri-lembaga')?.userData.lembagaReady && performance.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 200));
    const d = s.portal.doors().find((x) => x.interiorId === 'sekre');
    s.teleport(d.world.x, d.world.z, d.worldYaw + Math.PI);
    await new Promise((r) => setTimeout(r, 1500));
    await s.portal.enter('sekre', { door: d });
    return s.portal.state;
  },
  async shot({ hour, rain, pose, walk, wait, play }) {
    const s = window.__sim;
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    const cur = s.portal.current;
    if (play) {
      document.body.classList.remove('is-photo');
      cur.rig.setPhoto(false);
      if ((cur.rig.mode === 'third') !== Boolean(play.third)) cur.rig.toggleMode();
      cur.walker.state = { ...cur.walker.state, x: play.x, z: play.z, vx: 0, vz: 0 };
      cur.rig.yaw = play.yaw;
      cur.rig.pitch = play.pitch ?? 0;
      await new Promise((r) => setTimeout(r, wait ?? 2500));
      return true;
    }
    document.body.classList.add('is-photo');
    if (walk) cur.walker.state = { ...cur.walker.state, ...walk, vx: 0, vz: 0 };
    await new Promise((r) => setTimeout(r, wait ?? (rain ? 4000 : 2500)));
    if (pose) { cur.rig.setPhoto(true); cur.rig.applyPreset(pose); }
    await new Promise((r) => setTimeout(r, 700));
    return true;
  },
  stats() {
    const s = window.__sim;
    const r = s.app.renderer;
    const cur = s.portal.current;
    r.info.reset();
    r.autoClear = true;
    r.render(cur.built.scene, cur.built.camera);
    const main = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    r.info.reset();
    s.app.renderFrame();
    return { main, total: { calls: r.info.render.calls, triangles: r.info.render.triangles }, memory: { ...r.info.memory } };
  },
};

async function main() {
  mkdirSync(o.out, { recursive: true });
  const shots = JSON.parse(readFileSync(o.spec, 'utf8'));
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[o.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: Number(o.width), height: Number(o.height) }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.fastTravel && window.__sim.portal, null, { timeout: 240000 });
    await page.getByText('Mulai Petualangan').click().catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    console.log('state', await page.evaluate(PAGE.enter));
    await page.waitForFunction(() => window.__sim.portal.state === 'inside', null, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    for (const sh of shots) {
      await page.evaluate(PAGE.shot, sh);
      await page.screenshot({ path: join(o.out, `${o.prefix}${sh.name}.jpg`), type: 'jpeg', quality: 88 });
      console.log('shot', sh.name);
    }
    console.log('stats', JSON.stringify(await page.evaluate(PAGE.stats)));
  } finally {
    console.log('errors', JSON.stringify([...new Set(errors)].slice(0, 20), null, 1));
    await browser.close();
    await server.close();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
