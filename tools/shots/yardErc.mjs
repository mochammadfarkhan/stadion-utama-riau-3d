/**
 * Bidikan halaman sekre ERC (meja-kursi, pot, ban, karung) dari kamera 3/4.
 *   SIM_PORT=5192 node tools/shots/yardErc.mjs
 */
import process from 'node:process';
import { join } from 'node:path';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';
import { fromSekre, regionToWorld, SEKRE_FRAME } from '../../src/regions/unri-lembaga/placement.js';

const OUT = join(ROOT, 'docs', 'screenshots', 'tahap3');
const p = fromSekre(-0.5, 8.4 + 10.5);
const w = regionToWorld(p.x, p.z);
const sim = await openSim({});
try {
  await settleAt(sim.page, { x: w.x, z: w.z, yaw: SEKRE_FRAME.yaw + Math.PI, hour: 11, waitMs: 4000 });
  await sim.page.evaluate(() => {
    const s = window.__sim;
    s.store.set('graphics.gayaGrafis', 'kartun');
    s.store.set('camera.mode', 'angled');
    s.store.set('camera.angledDistance', 16);
  });
  await sim.page.waitForTimeout(6000);
  await sim.page.screenshot({ path: join(OUT, 'halaman-erc.jpg'), type: 'jpeg', quality: 82 });
  console.log('calls', await sim.page.evaluate(() => window.__sim.app.renderer.info.render.calls), 'errors', JSON.stringify(sim.errors.slice(0, 5)));
} finally {
  await sim.close();
}
process.exit(0);
