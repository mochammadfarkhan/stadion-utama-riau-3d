/**
 * Cek fade pohon penutup pemain di kamera 3/4: pemain diletakkan di belakang pohon dari arah kamera.
 *   SIM_PORT=5191 node tools/shots/fadePohon.mjs
 * Keluaran: docs/screenshots/tahap3/fade-{on,off}.jpg + jumlah draw call dan error.
 */
import process from 'node:process';
import { join } from 'node:path';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const OUT = join(ROOT, 'docs', 'screenshots', 'tahap3');
const START = { x: -232, z: 1095, yaw: 1.24 };
const sim = await openSim({});
try {
  await settleAt(sim.page, { ...START, hour: 11, waitMs: 3000 });
  const tree = await sim.page.evaluate(() => {
    const s = window.__sim;
    const p = s.rig?.focus ?? { x: -232, z: 1095 };
    let best = null;
    s.app.scene.traverse((o) => {
      if (!o.isInstancedMesh || !/tajuk/i.test(o.name)) return;
      const m = new s.app.camera.matrix.constructor();
      for (let i = 0; i < o.count; i += 1) {
        o.getMatrixAt(i, m);
        m.premultiply(o.matrixWorld);
        const x = m.elements[12];
        const z = m.elements[14];
        const d = Math.hypot(x - p.x, z - p.z);
        if (!best || d < best.d) best = { x, z, d, name: o.name };
      }
    });
    return best;
  });
  console.log('pohon terdekat', JSON.stringify(tree));
  if (!tree) throw new Error('tidak ada pohon');
  const setup = () => sim.page.evaluate(() => {
    const s = window.__sim;
    s.store.set('graphics.gayaGrafis', 'kartun');
    s.store.set('camera.mode', 'angled');
    s.store.set('camera.angledLockYaw', true);
  });
  const dir = () => sim.page.evaluate(() => {
    const s = window.__sim;
    const c = s.app.camera.position;
    const f = s.rig.focus ?? s.rig.target;
    const dx = f.x - c.x;
    const dz = f.z - c.z;
    const l = Math.hypot(dx, dz) || 1;
    return { dx: dx / l, dz: dz / l };
  });
  await settleAt(sim.page, { x: tree.x, z: tree.z, yaw: START.yaw, hour: 11, waitMs: 2000 });
  await setup();
  await sim.page.waitForTimeout(3000);
  for (let i = 0; i < 2; i += 1) {
    const d = await dir();
    await settleAt(sim.page, { x: tree.x + d.dx * 8, z: tree.z + d.dz * 8, yaw: Math.atan2(d.dx, d.dz), hour: 11, waitMs: 3500 });
    await setup();
    await sim.page.waitForTimeout(3000);
  }
  await sim.page.screenshot({ path: join(OUT, 'fade-on.jpg'), type: 'jpeg', quality: 80 });
  console.log('errors', JSON.stringify(sim.errors.slice(0, 5)));
} finally {
  await sim.close();
}
process.exit(0);
