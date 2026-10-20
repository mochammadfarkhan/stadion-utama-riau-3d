/** draw call/segitiga/frame di beberapa titik kampus. SIM_PORT=5195 node tools/shots/infoPoints.mjs */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const PTS = { sekreERC: [-232, 1095], pusatLembaga: [-152, 853], rektorat: [-905, 805], perpus: [-1040, 760], masjid: [-1010, 1334], ggm: [133, 440], tengahKampus: [-500, 900] };
const sim = await openSim({});
try {
  for (const [id, [x, z]] of Object.entries(PTS)) {
    await settleAt(sim.page, { x, z, yaw: 0, hour: 11, waitMs: 4000 });
    await sim.page.evaluate(() => { const s = window.__sim; s.store.set('graphics.gayaGrafis', 'kartun'); s.store.set('camera.mode', 'angled'); });
    await sim.page.waitForTimeout(4000);
    const m = await sim.page.evaluate(async () => {
      const i = window.__sim.app.renderer.info.render;
      const t = []; let l = performance.now();
      for (let k = 0; k < 60; k += 1) { await new Promise((r) => requestAnimationFrame(r)); const n = performance.now(); t.push(n - l); l = n; }
      return { calls: i.calls, tris: i.triangles, ms: Number((t.reduce((a, b) => a + b, 0) / t.length).toFixed(1)) };
    });
    console.log(id, JSON.stringify(m));
  }
} finally { await sim.close(); }
process.exit(0);
