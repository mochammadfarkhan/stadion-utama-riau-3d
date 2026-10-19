/**
 * Gerbang visual M4 (zona Lembaga): kamera bebas (sistem cameraRig dilepas) → screenshot dari atas, level mata,
 * dan depan pintu sekre + ukur draw call/segitiga region di titik ukur.
 *   node tools/shots/lembagaVisual.mjs [--gpu d3d11|swiftshader] [--only id1,id2] [--hour 12] [--rain]
 * Keluaran: docs/screenshots/unri/m4-<id>.jpg, laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5177;
const OUT_DIR = join(ROOT, 'docs', 'screenshots', 'unri');
const src = (f) => pathToFileURL(join(ROOT, 'src', 'regions', 'unri-lembaga', f)).href;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, only: { type: 'string' }, hour: { type: 'string', default: '12' }, rain: { type: 'boolean', default: false }, tag: { type: 'string', default: '' } } });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

/** Kamera dalam koordinat lokal-gedung sekretariat (bx, by, bz) / region-lokal / dunia → dunia. */
async function buildViews() {
  const P = await import(src('placement.js'));
  const D = (await import(src('layout.js'))).SEKRE_DIM;
  const door = (await import(src('portalDoors.js'))).PORTAL_DOORS[0];
  const sk = (bx, by, bz) => { const p = P.regionToWorld(...Object.values(P.fromSekre(bx, bz))); return [p.x, by, p.z]; };
  const rg = (lx, ly, lz) => { const p = P.regionToWorld(lx, lz); return [p.x, ly, p.z]; };
  const hz = D.hz;
  const hx = D.hx;
  return [
    { id: 'atas-sekre', eye: sk(-6, 34, -22), look: sk(0, 0, 0), fov: 50 },
    { id: 'atas-sekre-dekat', eye: sk(14, 20, -16), look: sk(0, 2, 0), fov: 50 },
    { id: 'mata-utara', eye: sk(-1, 1.7, -(hz + 11)), look: sk(0, 1.5, -(hz - 3)), fov: 65 },
    { id: 'mata-jogging', eye: sk(hx + 9, 1.7, -2), look: sk(0, 1.8, 0), fov: 65 },
    { id: 'depan-pintu', eye: sk(door.roomIndex === 1 ? -0.1 : 0, 1.6, -3.24 + 0.1 - 2.2), look: sk(1.85, 1.5, -3.24), fov: 70, name: 'pintu' },
    { id: 'selasar-barat', eye: sk(0, 1.6, -(hz + 3)), look: sk(0, 1.7, 2), fov: 70 },
    { id: 'selasar-timur', eye: sk(0.2, 1.6, hz + 3), look: sk(0, 1.7, -2), fov: 70 },
    { id: 'atas-stadion-mini', eye: rg(-13, 190, -145), look: rg(-13, 0, -150), fov: 60 },
    { id: 'mata-stadion-mini', eye: rg(-60, 1.7, -200), look: rg(-13, 2, -145), fov: 70 },
    { id: 'tribun', eye: rg(-30, 8, -145), look: rg(-82, 6, -145), fov: 70 },
    { id: 'student-center', eye: rg(150, 6, -170), look: rg(150, 6, -250), fov: 70 },
    { id: 'rusun', eye: rg(250, 4, -250), look: rg(285, 8, -272), fov: 70 },
    { id: 'fh', eye: rg(150, 5, -470), look: rg(150, 6, -500), fov: 70 },
    { id: 'parkir', eye: rg(-130, 3, -60), look: rg(-120, 0.8, -100), fov: 70 },
  ];
}

const PAGE = {
  async prep({ hour, rain }) {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', hour);
    s.store.set('weather.raining', rain);
    s.store.set('camera.mode', 'third');
    await s.fastTravel('unri-sekre');
    await new Promise((r) => { const t = () => (s.app.scene.getObjectByName('region:unri-lembaga')?.userData.lembagaReady ? r() : setTimeout(t, 200)); t(); });
    s.app.systems.remove('cameraRig'); // kamera bebas
    return true;
  },
  async shot({ eye, look, fov }) {
    const s = window.__sim;
    const cam = s.app.camera;
    s.teleport(eye[0], eye[2], 0); // fokus region/terrain di dekat kamera
    await new Promise((r) => setTimeout(r, 1800));
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.position.set(eye[0], eye[1], eye[2]);
    cam.lookAt(look[0], look[1], look[2]);
    cam.updateMatrixWorld(true);
    const region = s.app.scene.getObjectByName('region:unri-lembaga');
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    const tris = info.triangles;
    region.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    const trisW = info.triangles;
    region.visible = true;
    s.app.renderFrame();
    return { regionCalls: all - without, totalCalls: all, regionTriangles: tris - trisW, totalTriangles: tris };
  },
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const views = await buildViews();
  const only = opts.only ? new Set(opts.only.split(',')) : null;
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const report = { gpu: opts.gpu, points: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && window.__sim.fastTravel && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.evaluate(PAGE.prep, { hour: Number(opts.hour), rain: opts.rain });
    for (const v of views) {
      if (only && !only.has(v.id)) continue;
      report.points[v.id] = await page.evaluate(PAGE.shot, v);
      await page.screenshot({ path: join(OUT_DIR, `m4-${v.id}${opts.tag}.jpg`), type: 'jpeg', quality: 85 });
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.errors.length ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
