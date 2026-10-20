/** Bidik titik sekre dengan tilt-shift ON dan OFF. SIM_PORT=5198 node tools/shots/efekAB.mjs */
import process from 'node:process';
import { join } from 'node:path';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const OUT = join(ROOT, 'docs', 'screenshots', 'tahap4');
const sim = await openSim({});
try {
  await settleAt(sim.page, { x: -232, z: 1095, yaw: 1.24, hour: 16.5, waitMs: 3000 });
  for (const on of [false, true]) {
    await sim.page.evaluate((v) => { const s = window.__sim; s.store.set('graphics.gayaGrafis', 'kartun'); s.store.set('camera.mode', 'angled'); s.store.set('graphics.tiltShift', v); }, on);
    await sim.page.waitForTimeout(5000);
    await sim.page.screenshot({ path: join(OUT, `tilt-${on ? 'on' : 'off'}.jpg`), type: 'jpeg', quality: 80 });
    console.log(on, await sim.page.evaluate(() => window.__sim.app.renderer.info.render.calls));
  }
} finally { await sim.close(); }
process.exit(0);
