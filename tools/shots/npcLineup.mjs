/**
 * Barisan tipe NPC (npcTypes.js) dengan kit chibi Blender: dua baris (depan & sisi 3/4) di plaza utara stadion,
 * kamera bebas, lalu screenshot. Juga mencetak jumlah segitiga per humanoid.
 *   node tools/shots/npcLineup.mjs [--gpu d3d11|swiftshader] [--out docs/screenshots] [--hour 10] [--wait 4000]
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5181;
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

/** Berjalan DI DALAM halaman: susun barisan & arahkan kamera. */
async function stage({ hour, angle, half }) {
  const s = window.__sim;
  const { createHumanoid, animateIdle } = await import('/src/entities/Humanoid.js');
  const { NPC_TYPES, outfitForNpcType } = await import('/src/entities/npcTypes.js');
  const { makeRng } = await import('/src/entities/util.js');
  const { kitGeometry } = await import('/src/entities/Humanoid.kit.js');
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
  const base = { x: s.ents.bike.state.x, z: s.ents.bike.state.z - 6 };
  const h = (x, z) => s.terrain.heightAt(x, z);
  window.__lineup?.removeFromParent();
  const people = [];
  let group = null;
  const spacing = 1.15;
  // Tiap tipe: satu varian acak + satu dipaksa berhijab (kecuali satpam) agar hijab kit selalu terlihat.
  const variants = NPC_TYPES.flatMap((t) => [[t, 3, false], [t, 11, t !== 'satpam']]);
  variants.forEach(([type, seed, hijab], i) => {
    const o = outfitForNpcType(type, makeRng(seed));
    const hm = createHumanoid(hijab ? { ...o, hair: null, hat: null, hijab: [0x16a085, 0x8e44ad, 0xf5f5f5, 0x2c3e50, 0xff8fb1][i % 5] } : o);
    const x = base.x + (i - (variants.length - 1) / 2) * spacing;
    hm.group.position.set(x, h(x, base.z), base.z);
    hm.group.rotation.y = angle;
    animateIdle(hm, 0.3);
    group ??= new hm.group.constructor(); // THREE.Group tanpa impor 'three' (bare specifier) di halaman
    group.add(hm.group);
    people.push(hm);
  });
  s.app.scene.add(group);
  window.__lineup = group;
  let tris = 0;
  people[0].group.traverse((o) => { if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const cam = s.app.camera;
  // Bidik setengah barisan (kiri/kanan) dari depan sepeda pemain agar tidak terhalang.
  const fx = base.x + (half === 0 ? -1 : 1) * spacing * 3;
  cam.fov = 38;
  cam.updateProjectionMatrix();
  cam.position.set(fx, h(fx, base.z) + 1.25, base.z + 5.2);
  cam.lookAt(fx, h(fx, base.z) + 0.8, base.z);
  cam.updateMatrixWorld(true);
  s.app.renderFrame();
  return { kit: kitGeometry('head') != null, trianglesPerHumanoid: Math.round(tris), count: people.length };
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
    const page = await browser.newPage({ viewport: { width: 1600, height: 720 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    await page.waitForTimeout(Number(opts.wait));
    const report = {};
    for (const [id, angle, half] of [['kiri', 0, 0], ['kanan', 0, 1], ['kiri-samping', 0.7, 0]]) {
      report[id] = await page.evaluate(stage, { hour: Number(opts.hour), angle, half });
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT_DIR, `npc-lineup-${id}.jpg`), quality: 88 });
    }
    console.log(JSON.stringify({ report, errors }, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
