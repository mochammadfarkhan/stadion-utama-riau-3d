/**
 * Gerbang visual M6 (zona Rektorat + hero distrik): kamera bebas (sistem cameraRig dilepas) → screenshot dari
 * atas, level mata, depan fasad utama, dll. + ukur draw call/segitiga (region atau distrik) di tiap titik.
 *   node tools/shots/m6Visual.mjs [--gpu d3d11|swiftshader] [--only id1,id2 | --area rektorat|danau|masjid|gerbang|ggm]
 *     [--hour 12] [--rain] [--tag -siang] [--prefix m6-]
 * Keluaran: docs/screenshots/unri/<prefix><id><tag>.jpg, laporan JSON ke stdout.
 * Koordinat tampilan: rg(lx, tinggiDiAtasTanah, lz) = region unri-rektorat (lokal → dunia); w(x, tinggi, z) = dunia.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5178;
const OUT_DIR = join(ROOT, 'docs', 'screenshots', 'unri');
const P = { x: -985.8, z: 800.0 };
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({
  options: {
    gpu: { type: 'string', default: 'd3d11' }, only: { type: 'string' }, area: { type: 'string' }, hour: { type: 'string', default: '12' },
    rain: { type: 'boolean', default: false }, tag: { type: 'string', default: '' }, prefix: { type: 'string', default: 'm6-' },
  },
});

const rg = (lx, h, lz) => [lx + P.x, h, lz + P.z];
const w = (x, h, z) => [x, h, z];
/** id, area, eye, look (tinggi = di atas tanah di titik itu), fov. */
const VIEWS = [
  { id: 'rektorat-atas', area: 'rektorat', eye: rg(75, 62, 52), look: rg(5, 6, 0), fov: 55 },
  { id: 'rektorat-atas-dekat', area: 'rektorat', eye: rg(48, 34, -26), look: rg(12, 9, 0), fov: 55 },
  { id: 'rektorat-mata-poros', area: 'rektorat', eye: rg(105, 1.7, 4.2), look: rg(12, 10, 0), fov: 60 },
  { id: 'rektorat-depan-fasad', area: 'rektorat', eye: rg(40, 1.7, 0), look: rg(14, 6, 0), fov: 62 },
  { id: 'rektorat-kanopi', area: 'rektorat', eye: rg(34, 1.7, -10), look: rg(21, 3.2, 0), fov: 65 },
  { id: 'rektorat-sayap-miring', area: 'rektorat', eye: rg(30, 2, -44), look: rg(0, 9, 8), fov: 62 },
  { id: 'rektorat-belakang', area: 'rektorat', eye: rg(-34, 3, 18), look: rg(-11, 9, 0), fov: 62 },
  { id: 'rektorat-pulau-bendera', area: 'rektorat', eye: rg(74, 2, 22), look: rg(52.8, 6, 0), fov: 62 },
  { id: 'perpus-atas', area: 'rektorat', eye: rg(-60, 45, -22), look: rg(-113, 3, -62), fov: 55 },
  { id: 'perpus-mata', area: 'rektorat', eye: rg(-98, 1.7, -30), look: rg(-113, 3.5, -55), fov: 65 },
  { id: 'perpus-timur', area: 'rektorat', eye: rg(-60, 1.7, -62), look: rg(-88, 3.5, -62), fov: 65 },
  { id: 'danau-atas', area: 'danau', eye: rg(305, 95, -50), look: rg(215, 0, 35), fov: 55 },
  { id: 'danau-batu-pijakan', area: 'danau', eye: rg(222, 1.7, 8), look: rg(240, 0.3, 44), fov: 60 },
  { id: 'danau-batu-dekat', area: 'danau', eye: rg(224, 2.6, 12), look: rg(233, 0, 30), fov: 60 },
  { id: 'danau-trotoar', area: 'danau', eye: rg(200, 1.7, 64), look: rg(242, 1, 40), fov: 62 },
  { id: 'danau-papan-batu', area: 'danau', eye: rg(296, 1.7, 10), look: rg(285.5, 1.1, 10), fov: 55 },
  { id: 'danau-papan-batu-jauh', area: 'danau', eye: rg(316, 2.2, 16), look: rg(285.5, 1.2, 10), fov: 55 },
  { id: 'bundaran-atas', area: 'danau', eye: rg(268, 42, -12), look: rg(285, 0, 12), fov: 55 },
  { id: 'danau-titian', area: 'danau', eye: rg(258, 2.5, -18), look: rg(275, 0.5, -26), fov: 62 },
  { id: 'danau-poros-ke-danau', area: 'danau', eye: rg(190, 1.7, 4.2), look: rg(240, 0.5, 22), fov: 65 },
  { id: 'masjid-atas', area: 'masjid', eye: w(-975, 58, 1327), look: w(-1010, 6, 1372), fov: 55 },
  { id: 'masjid-mata-utara', area: 'masjid', eye: w(-1010, 1.7, 1334), look: w(-1010, 7, 1374), fov: 65 },
  { id: 'masjid-tangga', area: 'masjid', eye: w(-1010, 1.7, 1346), look: w(-1010, 5.5, 1362), fov: 70 },
  { id: 'masjid-samping', area: 'masjid', eye: w(-962, 3, 1385), look: w(-1008, 7, 1374), fov: 62 },
  { id: 'masjid-kubah', area: 'masjid', eye: w(-1040, 14, 1330), look: w(-1010, 13, 1374), fov: 55 },
  { id: 'gerbang-luar', area: 'gerbang', eye: w(414, 1.7, 695.4), look: w(382, 4, 695.4), fov: 62 },
  { id: 'gerbang-atas', area: 'gerbang', eye: w(410, 30, 727), look: w(383, 3, 695), fov: 55 },
  { id: 'gerbang-dalam', area: 'gerbang', eye: w(352, 2, 690), look: w(386, 4, 695), fov: 62 },
  { id: 'gerbang-pos-spanduk', area: 'gerbang', eye: w(397, 1.7, 676), look: w(381, 1.8, 681), fov: 65 },
  { id: 'ggm-atas', area: 'ggm', eye: w(196, 85, 478), look: w(133, 8, 407), fov: 55 },
  { id: 'ggm-selatan', area: 'ggm', eye: w(133, 3, 482), look: w(133, 9, 407), fov: 62 },
  { id: 'ggm-samping', area: 'ggm', eye: w(60, 3, 407), look: w(133, 11, 407), fov: 62 },
  { id: 'ggm-dekat-jalan-masuk', area: 'ggm', eye: w(133, 1.7, 462), look: w(133, 6, 410), fov: 70 },
];

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

const PAGE = {
  async prep({ hour, rain }) {
    const s = window.__sim;
    s.rig.exitPov?.();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    s.store.set('camera.mode', 'third');
    s.app.systems.remove('cameraRig'); // kamera bebas
    const st = document.createElement('style'); // sembunyikan HUD/dialog agar bidikan bersih
    st.textContent = '#hud, .attribution, [class*="toast"], [class*="minimap"] { display: none !important }';
    document.head.appendChild(st);
    return true;
  },
  async shot({ eye, look, fov, area }) {
    const s = window.__sim;
    const cam = s.app.camera;
    const h = (p) => s.terrain.heightAt(p[0], p[2]);
    const dx = look[0] - eye[0];
    const dz = look[2] - eye[2];
    const dl = Math.hypot(dx, dz) || 1;
    s.teleport(eye[0] - (dx / dl) * 9, eye[2] - (dz / dl) * 9, 0); // sepeda 9 m di belakang kamera (tidak masuk bidikan)
    s.rig.focus.set(eye[0], h(eye), eye[2]); // sistem cameraRig dilepas: fokus (region/terrain/klaster) diatur manual
    const t0 = performance.now();
    if (area === 'rektorat' || area === 'danau') {
      while (performance.now() - t0 < 90000 && !s.app.scene.getObjectByName('region:unri-rektorat')?.userData?.ready) await new Promise((r) => setTimeout(r, 250));
    }
    if (s.district?.whenSettled) await s.district.whenSettled(eye[0], eye[2], 400);
    await new Promise((r) => setTimeout(r, 2500));
    const ey = h(eye) + eye[1];
    const ly = h(look) + look[1];
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.position.set(eye[0], ey, eye[2]);
    cam.lookAt(look[0], ly, look[2]);
    cam.updateMatrixWorld(true);
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    const tris = info.triangles;
    const out = { totalCalls: all, totalTriangles: tris, eyeY: +ey.toFixed(2) };
    const g = s.app.scene.getObjectByName('region:unri-rektorat');
    if (g && (area === 'rektorat' || area === 'danau')) {
      g.visible = false;
      s.app.renderFrame();
      out.regionCalls = all - info.calls;
      out.regionTriangles = tris - info.triangles;
      g.visible = true;
    }
    const dist = s.app.scene.getObjectByName('unri:gedung');
    if (dist && area !== 'rektorat') {
      dist.visible = false;
      s.app.renderFrame();
      out.gedungCalls = all - info.calls;
      out.gedungTriangles = tris - info.triangles;
      dist.visible = true;
    }
    s.app.renderFrame();
    return out;
  },
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const only = opts.only ? new Set(opts.only.split(',')) : null;
  const views = VIEWS.filter((v) => (only ? only.has(v.id) : opts.area ? v.area === opts.area : true));
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, hour: opts.hour, rain: opts.rain, points: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(`error: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push(`${m.type()}: ${m.text()}`); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.fastTravel && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.evaluate(PAGE.prep, { hour: Number(opts.hour), rain: opts.rain });
    for (const v of views) {
      report.points[v.id] = await page.evaluate(PAGE.shot, v);
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
