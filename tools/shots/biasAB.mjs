/** Uji bias bayangan pada jalan sore hari. SIM_PORT=5199 node tools/shots/biasAB.mjs */
import process from 'node:process';
import { join } from 'node:path';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const OUT = join(ROOT, 'docs', 'screenshots', 'tahap4');
const sim = await openSim({});
try {
  await settleAt(sim.page, { x: -232, z: 1095, yaw: 1.24, hour: 16.5, waitMs: 3000 });
  await sim.page.evaluate(() => { const s = window.__sim; s.store.set('graphics.gayaGrafis', 'kartun'); s.store.set('camera.mode', 'angled'); });
  await sim.page.waitForTimeout(4000);
  const info = await sim.page.evaluate(() => { const l = window.__sim.lighting?.userData?.sun ?? window.__sim.app.scene.getObjectByProperty('isDirectionalLight', true); return l ? { b: l.shadow.bias, n: l.shadow.normalBias, r: l.shadow.radius, t: l.shadow.type ?? null } : null; });
  console.log(JSON.stringify(info));
  for (const [tag, bias, nb] of [['b1', -0.0005, 0.25], ['b2', -0.002, 0.05]]) {
    await sim.page.evaluate(([b, n]) => { const l = window.__sim.app.scene.getObjectByProperty('isDirectionalLight', true); l.shadow.bias = b; l.shadow.normalBias = n; }, [bias, nb]);
    await sim.page.waitForTimeout(1500);
    await sim.page.screenshot({ path: join(OUT, `bias-${tag}.jpg`), type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: 600, height: 900 } });
  }
} finally { await sim.close(); }
process.exit(0);
