/**
 * Ukur draw call/segitiga/frame saat memandang stadion dari jauh, dengan dan tanpa penyembunyian detail jauh (?nofar).
 *   SIM_PORT=5190 node tools/shots/farStadion.mjs [--style kartun|asli] [--frames 120]
 * Titik berada di timur laut stadion (area tile kota, tanpa distrik) dan menghadap stadion.
 */
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({ options: { style: { type: 'string', default: 'kartun' }, frames: { type: 'string', default: '120' } } });
const POINTS = {
  jauh700: { x: 300, z: -700, yaw: Math.atan2(-300, 700) },
  jauh1100: { x: 450, z: -1000, yaw: Math.atan2(-450, 1000) },
  dekat300: { x: 150, z: -260, yaw: Math.atan2(-150, 260) },
};

const measure = async (n) => {
  const s = window.__sim;
  const info = s.app.renderer.info.render;
  const times = [];
  let last = performance.now();
  for (let i = 0; i < n; i += 1) {
    await new Promise((r) => requestAnimationFrame(r));
    const t = performance.now();
    times.push(t - last);
    last = t;
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { calls: info.calls, tris: info.triangles, avg: Number(avg.toFixed(2)), p95: Number(times[Math.floor(times.length * 0.95)].toFixed(2)) };
};

for (const query of ['', '?nofar']) {
  const sim = await openSim({ query });
  try {
    for (const [id, pt] of Object.entries(POINTS)) {
      await settleAt(sim.page, { ...pt, hour: 11, waitMs: 3000 });
      await sim.page.evaluate((st) => {
        const s = window.__sim;
        s.store.set('graphics.gayaGrafis', st);
        s.store.set('camera.mode', 'third');
      }, v.style);
      await sim.page.waitForTimeout(6000);
      const m = await sim.page.evaluate(measure, Number(v.frames));
      console.log(JSON.stringify({ penyembunyian: query === '' ? 'ON' : 'OFF', titik: id, ...m }));
    }
    if (sim.errors.length) console.log('errors', JSON.stringify(sim.errors.slice(0, 5)));
  } finally {
    await sim.close();
  }
}
