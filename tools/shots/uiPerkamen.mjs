/** Bidikan HUD tema perkamen (kartun) siang dan malam. SIM_PORT=5193 node tools/shots/uiPerkamen.mjs */
import process from 'node:process';
import { join } from 'node:path';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const OUT = join(ROOT, 'docs', 'screenshots', 'tahap4');
const sim = await openSim({});
try {
  for (const hour of [11, 22]) {
    await settleAt(sim.page, { x: -232, z: 1095, yaw: 1.24, hour, waitMs: 3000 });
    await sim.page.evaluate(() => { const s = window.__sim; s.store.set('graphics.gayaGrafis', 'kartun'); s.store.set('camera.mode', 'angled'); });
    await sim.page.waitForTimeout(5000);
    await sim.page.screenshot({ path: join(OUT, `hud-perkamen-${hour}.jpg`), type: 'jpeg', quality: 80 });
  }
  console.log('errors', JSON.stringify(sim.errors.slice(0, 5)));
} finally { await sim.close(); }
process.exit(0);
