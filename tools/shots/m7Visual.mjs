/**
 * Gerbang visual M7 (kehidupan kampus): kamera bebas (sistem cameraRig dilepas) → screenshot dari atas, level mata,
 * depan, + ukur draw call/segitiga. Tampilan bisa tetap (`eye`/`look`) atau mengikuti objek (`auto`):
 *   auto:'mahasiswa' | 'duduk' → mahasiswa terdekat (yang duduk) dari titik `near`, kamera `dist` m dari sosoknya.
 *   node tools/shots/m7Visual.mjs [--gpu d3d11|swiftshader] [--only id1,id2 | --area mahasiswa|motor|sekre|...]
 *     [--hour 12] [--rain] [--tag -siang] [--prefix m7-] [--wait 3000] [--out docs/screenshots/unri]
 * Keluaran: <out>/<prefix><id><tag>.jpg, laporan JSON ke stdout. Daftar tampilan: --list.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { VIEWS } from './m7Views.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5179;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({
  options: {
    gpu: { type: 'string', default: 'd3d11' }, only: { type: 'string' }, area: { type: 'string' }, hour: { type: 'string' },
    rain: { type: 'boolean', default: false }, tag: { type: 'string', default: '' }, prefix: { type: 'string', default: 'm7-' },
    wait: { type: 'string', default: '6000' }, list: { type: 'boolean', default: false },
    out: { type: 'string', default: join('docs', 'screenshots', 'unri') },
  },
});
const OUT_DIR = resolve(ROOT, opts.out);

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

/** Fungsi yang berjalan DI DALAM halaman (serialisasi Playwright): tidak boleh merujuk variabel modul. */
const PAGE = {
  async prep({ rain }) {
    const s = window.__sim;
    s.rig.exitPov?.();
    s.store.set('sky.advanceTime', false);
    s.store.set('weather.raining', rain);
    s.store.set('camera.mode', 'third');
    s.app.systems.remove('cameraRig'); // kamera bebas
    const st = document.createElement('style'); // sembunyikan HUD/dialog agar bidikan bersih
    st.textContent = 'body > *:not(#app):not(script):not(style) { display: none !important }';
    document.head.appendChild(st);
    return true;
  },
  async shot({ view, hour, waitMs }) {
    const s = window.__sim;
    const cam = s.app.camera;
    s.store.set('sky.hour', hour);
    const h = (x, z) => s.terrain.heightAt(x, z);
    const focusAt = view.eye ? view.eye : [view.near[0], 0, view.near[1]];
    s.teleport(focusAt[0], focusAt[2], 0);
    s.rig.focus.set(focusAt[0], h(focusAt[0], focusAt[2]), focusAt[2]);
    cam.position.set(focusAt[0], h(focusAt[0], focusAt[2]) + 3, focusAt[2]); // kamera bebas: jarak LOD/pemuatan memakai posisi kamera
    await new Promise((r) => requestAnimationFrame(r));
    if (s.city) await s.city.whenSettled(focusAt[0], focusAt[2], 1000, 90000);
    if (s.district?.whenSettled) await s.district.whenSettled(focusAt[0], focusAt[2], 400);
    const id = s.regionIdAt?.(focusAt[0], focusAt[2]) ?? null;
    for (let t = 0; id && t < 300 && !s.regions.active().some((a) => a.def.id === id); t += 1) await new Promise((r) => setTimeout(r, 100));
    if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
    await new Promise((r) => setTimeout(r, waitMs));
    let eye;
    let look;
    const info = {};
    if (view.auto) {
      const life = s.district.district.life;
      const list = life.students.positions.filter((p) => (view.auto === 'duduk' ? p.sitting : true));
      list.sort((a, b) => Math.hypot(a.x - view.near[0], a.z - view.near[1]) - Math.hypot(b.x - view.near[0], b.z - view.near[1]));
      const target = list[0];
      info.students = life.students.stats;
      if (!target) return { ...info, error: 'tidak ada mahasiswa untuk disorot' };
      look = [target.x, 1.0, target.z];
      eye = [target.x + Math.sin(view.dir) * view.dist, view.eyeH, target.z + Math.cos(view.dir) * view.dist];
      info.target = { x: +target.x.toFixed(1), z: +target.z.toFixed(1), sitting: target.sitting };
    } else {
      eye = view.eye;
      look = view.look;
    }
    s.teleport(eye[0] - 9, eye[2], 0);
    s.rig.focus.set(eye[0], h(eye[0], eye[2]), eye[2]);
    const ey = h(eye[0], eye[2]) + eye[1];
    const ly = h(look[0], look[2]) + look[1];
    cam.fov = view.fov;
    cam.updateProjectionMatrix();
    cam.position.set(eye[0], ey, eye[2]);
    cam.lookAt(look[0], ly, look[2]);
    cam.updateMatrixWorld(true);
    await new Promise((r) => setTimeout(r, 400));
    cam.position.set(eye[0], ey, eye[2]);
    cam.lookAt(look[0], ly, look[2]);
    cam.updateMatrixWorld(true);
    const ri = s.app.renderer.info.render;
    s.app.renderFrame();
    const out = { ...info, totalCalls: ri.calls, totalTriangles: ri.triangles, eyeY: +ey.toFixed(2) };
    const life = s.district?.district?.life;
    const benches = [];
    life?.students?.group.traverse((o) => { if (o.name?.startsWith('bangkuDiskusi:')) benches.push(o); });
    const humanoids = [];
    life?.students?.group.children.forEach((o) => { if (o.name?.startsWith('mahasiswa-')) humanoids.push(o); });
    const render2 = () => { s.app.renderFrame(); s.app.renderFrame(); };
    render2();
    out.totalCalls = ri.calls;
    out.totalTriangles = ri.triangles;
    // Selisih draw call/segitiga bila bagian kehidupan kampus disembunyikan (pass bayangan ikut terhitung).
    for (const [label, nodes] of [['motor', [life?.motors?.group]], ['mahasiswa', humanoids], ['bangku', benches], ['satpam', [life?.guards?.group]], ['kehidupan', [life?.group]]]) {
      const list = nodes.filter(Boolean);
      if (!list.length) continue;
      const prev = list.map((n) => n.visible);
      list.forEach((n) => { n.visible = false; });
      render2();
      out[`${label}Calls`] = out.totalCalls - ri.calls;
      out[`${label}Triangles`] = out.totalTriangles - ri.triangles;
      list.forEach((n, i) => { n.visible = prev[i]; });
    }
    if (life?.motors) out.motorStats = life.motors.stats;
    s.app.renderFrame();
    return out;
  },
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const only = opts.only ? new Set(opts.only.split(',')) : null;
  const views = VIEWS.filter((v) => (only ? only.has(v.id) : opts.area ? v.area === opts.area : true));
  if (opts.list) { console.log(views.map((v) => v.id).join('\n')); return; }
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, rain: opts.rain, points: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(`error: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push(`${m.type()}: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.fastTravel && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.evaluate(PAGE.prep, { rain: opts.rain });
    for (const v of views) {
      const hour = Number(opts.hour ?? v.hour ?? 11);
      await page.evaluate((r) => window.__sim.store.set('weather.raining', r), Boolean(v.rain ?? opts.rain));
      report.points[v.id] = await page.evaluate(PAGE.shot, { view: v, hour, waitMs: Number(opts.wait) });
      await page.screenshot({ path: join(OUT_DIR, `${opts.prefix}${v.id}${opts.tag}.jpg`), type: 'jpeg', quality: 85 });
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.errors.some((e) => e.startsWith('error')) ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
