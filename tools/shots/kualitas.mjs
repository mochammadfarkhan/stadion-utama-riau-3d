/**
 * Cek preset kualitas & batas FPS di game: nama GPU, tier Otomatis, nilai setelan terpasang, lalu FPS nyata (frame App
 * per detik) untuk batas 30 / 60 / tanpa batas.   node tools/shots/kualitas.mjs
 */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const sim = await openSim({ beforeGoto: async (page) => page.addInitScript(() => localStorage.removeItem('sur3d.quality.v1')) });
const { page } = sim;
try {
  await settleAt(page, { x: 0, z: -275, yaw: 0, hour: 11, waitMs: 4000 });
  await page.waitForTimeout(10000); // pemanasan 3 s + uji 5 s
  const info = await page.evaluate(() => {
    const s = window.__sim;
    const keys = ['graphics.preset', 'graphics.pixelRatio', 'graphics.shadowQuality', 'graphics.bloom', 'performance.fpsCap', 'sky.fogDistance'];
    return { saved: JSON.parse(localStorage.getItem('sur3d.quality.v1')), settings: Object.fromEntries(keys.map((k) => [k, s.store.get(k)])), pixelRatio: s.app.pixelRatio };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.evaluate(() => { // ukur terkendali: resolusi tetap (adaptif mengubah beban GPU di antara putaran)
    window.__sim.store.set('graphics.adaptiveResolution', false);
    window.__sim.store.set('graphics.pixelRatio', 0.75);
  });
  await page.waitForTimeout(3000);
  for (const cap of ['tanpa batas', '60', '30', 'tanpa batas', '60', '30']) {
    const fps = await page.evaluate(async (c) => {
      const s = window.__sim;
      s.store.set('performance.fpsCap', c);
      await new Promise((r) => setTimeout(r, 1500));
      const f0 = s.app.frame;
      const t0 = performance.now();
      let calls = 0;
      const tick = () => { calls += 1; if (performance.now() - t0 < 4000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await new Promise((r) => setTimeout(r, 4000));
      const sec = (performance.now() - t0) / 1000;
      return `${((s.app.frame - f0) / sec).toFixed(1)} render/s, rAF ${(calls / sec).toFixed(1)}/s, rasio ${s.app.pixelRatio}`;
    }, cap);
    console.log(`batas ${cap}: ${fps}`);
  }
  console.log('preset sesudah ubah fpsCap manual:', await page.evaluate(() => window.__sim.store.get('graphics.preset')));
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
process.exit(0);
