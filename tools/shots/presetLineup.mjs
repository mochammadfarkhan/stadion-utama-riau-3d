/**
 * Barisan karakter jadi (Humanoid.preset.js, model dari assets-src/blender/karakter/karakter_preset.py) di plaza:
 * baris depan diam (depan & 3/4), baris belakang jalan / duduk bersila / minum, lalu screenshot dekat.
 *   node tools/shots/presetLineup.mjs [--gpu d3d11|swiftshader] [--out docs/screenshots] [--hour 10] [--wait 4000]
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5182;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({
  options: {
    gpu: { type: 'string', default: 'd3d11' }, hour: { type: 'string', default: '10' },
    wait: { type: 'string', default: '4000' }, out: { type: 'string', default: join('docs', 'screenshots') },
  },
});

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

/** Berjalan DI DALAM halaman. */
async function stage({ hour, view }) {
  const s = window.__sim;
  const H = await import('/src/entities/Humanoid.js');
  const { applyPose } = await import('/src/entities/Humanoid.poses.js');
  const P = await import('/src/entities/Humanoid.preset.js');
  s.rig.exitPov?.();
  s.store.set('sky.advanceTime', false);
  s.store.set('sky.hour', hour);
  s.app.systems.remove('cameraRig');
  if (!document.getElementById('lineupCss')) {
    const st = document.createElement('style');
    st.id = 'lineupCss';
    st.textContent = 'body > *:not(#app):not(script):not(style) { display: none !important }';
    document.head.appendChild(st);
  }
  if (s.ents.bike.group) s.ents.bike.group.visible = false;
  const base = { x: s.ents.bike.state.x, z: s.ents.bike.state.z - 6 };
  const y0 = s.terrain.heightAt(base.x, base.z);
  window.__presetLineup?.removeFromParent();
  let group = null;
  const add = (opts, x, z, yaw, pose) => {
    const h = H.createHumanoid(opts);
    h.group.position.set(base.x + x, y0, base.z + z);
    h.group.rotation.y = yaw;
    if (pose === 'walk') H.animateWalk(h, 0.35);
    else if (pose) applyPose(h, pose, 0.4);
    else H.animateIdle(h, 0.3);
    group ??= new h.group.constructor();
    group.add(h.group);
  };
  const yaw = view === 'tiga-perempat' ? 0.6 : 0;
  add({ preset: 'tactical_blonde' }, -0.85, 0, yaw);
  add({ preset: 'cardigan_hijab' }, 0, 0, yaw);
  add({ preset: 'tactical_hijab' }, 0.85, 0, yaw);
  add({ preset: 'cardigan_hijab' }, -1.0, -2.2, 0.3, 'walk');
  add({ preset: 'tactical_blonde' }, 0.1, -2.2, 0, 'sitCrossLegged');
  add({ preset: 'tactical_hijab' }, 1.1, -2.2, -0.3, 'drinkCup');
  s.app.scene.add(group);
  window.__presetLineup = group;
  const cam = s.app.camera;
  cam.fov = 38;
  cam.updateProjectionMatrix();
  cam.position.set(base.x, y0 + 1.3, base.z + 3.6);
  cam.lookAt(base.x, y0 + 0.85, base.z - 0.6);
  cam.updateMatrixWorld(true);
  s.app.renderFrame();
  return { loaded: P.PRESET_IDS.map((id) => [id, P.hasPreset(id)]) };
}

async function main() {
  const OUT_DIR = resolve(ROOT, opts.out);
  mkdirSync(OUT_DIR, { recursive: true });
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.waitForTimeout(Number(opts.wait));
    const report = {};
    for (const view of ['depan', 'tiga-perempat']) {
      report[view] = await page.evaluate(stage, { hour: Number(opts.hour), view });
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT_DIR, `preset-lineup-${view}.jpg`), quality: 90 });
    }
    console.log(JSON.stringify({ report, errors }, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
