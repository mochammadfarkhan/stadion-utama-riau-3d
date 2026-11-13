/**
 * Bidikan + angka baku untuk rencana kerja (docs/rencana/): preset kualitas DIPAKSA (default Rendah, sesuai keputusan D3),
 * titik tetap, hasil JSON yang bisa dibandingkan sebelum/sesudah.
 *   node tools/shots/kritik.mjs --out <folder> [--preset rendah|sedang|tinggi] [--hanya jalan,kota,hp] [--gaya asli|kartun|facet]
 * Keluaran: <folder>/<nama>.jpg per titik + <folder>/ringkasan.json { preset, titik: {nama: {calls, triangles, fps}}, ui, errors }.
 * Kelompok: jalan (mode jalan, 1600×900), kota (mode K), hp (812×375, layar sentuh ditiru lewat ukuran saja).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'renders/kritik' },
    preset: { type: 'string', default: 'rendah' },
    hanya: { type: 'string', default: 'jalan,kota,hp' },
    gaya: { type: 'string' },
  },
});
const OUT = resolve(values.out);
const GROUPS = new Set(values.hanya.split(',').map((s) => s.trim()).filter(Boolean));
mkdirSync(OUT, { recursive: true });

/** Titik dunia tetap (meter; +X timur, +Z selatan). Ubah di sini saja bila titik awal permainan pindah. */
const TITIK_JALAN = Object.freeze([
  { nama: 'awal-sore', pakaiSpawn: true, hour: 16.5 },
  { nama: 'awal-malam', pakaiSpawn: true, hour: 20.5, waitMs: 6000 },
  { nama: 'unri-jalan', x: -206, z: 1118, yaw: -2.52, hour: 10 },
  { nama: 'sekre-luar', x: -96.65, z: 1011.5, yaw: Math.PI, hour: 11 },
  { nama: 'rektorat', x: -1074.7, z: 1316, yaw: Math.PI, hour: 9 },
]);

const summary = { preset: values.preset, gaya: values.gaya ?? null, titik: {}, ui: {}, errors: [] };

/** FPS nyata: frame App selama 3 detik (bukan teks HUD). */
const measure = (page) => page.evaluate(async () => {
  const s = window.__sim;
  const f0 = s.app.frame;
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 3000));
  const { calls, triangles } = s.app.renderer.info.render;
  return { calls, triangles, fps: Math.round(((s.app.frame - f0) / (performance.now() - t0)) * 10000) / 10 };
});

const applyPreset = (page) => page.evaluate(async ({ preset, gaya }) => {
  const s = window.__sim;
  s.rig.exitPov({ instant: true }); // POV orbit menu harus selesai seketika, bukan terbang selama bidikan pertama
  s.store.set('graphics.preset', preset);
  if (gaya) s.store.set('graphics.gayaGrafis', gaya);
  await new Promise((r) => setTimeout(r, 1500));
  return { preset: s.store.get('graphics.preset'), pixelRatio: s.store.get('graphics.pixelRatio'), shadow: s.store.get('graphics.shadowQuality'), gaya: s.store.get('graphics.gayaGrafis') };
}, { preset: values.preset, gaya: values.gaya ?? null });

/** Persegi dua elemen bertumpuk? (null bila salah satu tidak ada/tersembunyi). */
const overlap = (page, a, b) => page.evaluate(([sa, sb]) => {
  const ra = document.querySelector(sa)?.getBoundingClientRect();
  const rb = document.querySelector(sb)?.getBoundingClientRect();
  if (!ra || !rb || !ra.width || !rb.width) return null;
  return !(ra.right <= rb.left || rb.right <= ra.left || ra.bottom <= rb.top || rb.bottom <= ra.top);
}, [a, b]);

async function shotAt(page, t, spawn) {
  const at = t.pakaiSpawn ? { ...spawn, hour: t.hour, waitMs: t.waitMs } : t;
  await settleAt(page, at);
  await page.screenshot({ path: join(OUT, `${t.nama}.jpg`), type: 'jpeg', quality: 82 });
  summary.titik[t.nama] = await measure(page);
}

async function runDesktop() {
  const sim = await openSim({ width: 1600, height: 900 });
  const { page } = sim;
  try {
    summary.setelan = await applyPreset(page);
    const spawn = await page.evaluate(() => { const b = window.__sim.ents.bike.state; return { x: b.x, z: b.z, yaw: b.yaw }; });
    summary.spawn = spawn;
    if (GROUPS.has('jalan')) {
      for (const t of TITIK_JALAN) await shotAt(page, t, spawn);
      summary.ui.dompetTertutupRail = await overlap(page, '#hud-top-right', '.ui-rail');
      summary.ui.kartuKiriTertutupMisi = await overlap(page, '#hud-top-left', '#story-card');
    }
    if (GROUPS.has('kota')) {
      await settleAt(page, { ...spawn, hour: 16.75 });
      await page.evaluate(() => window.__sim.rig.handlePovKey('KeyK')); // keyboard.press('k') tidak mengaktifkan POV di headless
      await page.waitForTimeout(25000);
      await page.screenshot({ path: join(OUT, 'kota-dekat.jpg'), type: 'jpeg', quality: 82 });
      summary.titik['kota-dekat'] = await measure(page);
      await page.evaluate(() => { const d = window.__sim.rig.director; d.zoom = d.def.zoomMax; });
      await page.waitForTimeout(9000);
      await page.screenshot({ path: join(OUT, 'kota-jauh.jpg'), type: 'jpeg', quality: 82 });
      summary.titik['kota-jauh'] = await measure(page);
      await page.evaluate(() => { const s = window.__sim; s.store.set('sky.hour', 20.5); s.rig.director.zoom = 1.2; });
      await page.waitForTimeout(10000);
      await page.screenshot({ path: join(OUT, 'kota-malam.jpg'), type: 'jpeg', quality: 82 });
      summary.titik['kota-malam'] = await measure(page);
    }
  } finally {
    summary.errors.push(...sim.errors.slice(0, 10));
    await sim.close();
  }
}

async function runPhone() {
  const sim = await openSim({ width: 812, height: 375 });
  const { page } = sim;
  try {
    await applyPreset(page);
    const spawn = await page.evaluate(() => { const b = window.__sim.ents.bike.state; return { x: b.x, z: b.z, yaw: b.yaw }; });
    await shotAt(page, { nama: 'hp-awal', pakaiSpawn: true, hour: 16.5 }, spawn);
    summary.ui.hpDompetTertutupRail = await overlap(page, '#hud-top-right', '.ui-rail');
    summary.ui.hpMisiTertutupMinimap = await overlap(page, '#story-card', '#minimap2d');
  } finally {
    summary.errors.push(...sim.errors.slice(0, 10));
    await sim.close();
  }
}

if (GROUPS.has('jalan') || GROUPS.has('kota')) await runDesktop();
if (GROUPS.has('hp')) await runPhone();
writeFileSync(join(OUT, 'ringkasan.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
process.exit(0);
