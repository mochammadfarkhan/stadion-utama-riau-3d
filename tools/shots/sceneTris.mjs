/** Segitiga terdeteksi tampil (frustum + layer) per akar scene di satu titik. SIM_PORT=5196 node tools/shots/sceneTris.mjs x z */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const [x, z] = process.argv.slice(2).map(Number);
const sim = await openSim({});
try {
  await settleAt(sim.page, { x, z, yaw: 0, hour: 11, waitMs: 4000 });
  await sim.page.evaluate(() => { const s = window.__sim; s.store.set('graphics.gayaGrafis', 'kartun'); s.store.set('camera.mode', 'angled'); });
  await sim.page.waitForTimeout(4000);
  const rows = await sim.page.evaluate(() => {
    const s = window.__sim;
    const cam = s.app.camera;
    const by = new Map();
    const top = (o) => { let n = o; while (n.parent && n.parent !== s.app.scene) n = n.parent; return n.name || n.type; };
    s.app.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      let v = true; for (let n = o; n; n = n.parent) if (!n.visible) { v = false; break; }
      if (!v || !o.layers.test(cam.layers)) return;
      const g = o.geometry;
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      const k = top(o) + (top(o) === 'distrik:unri' || top(o) === 'world' ? '/' + (o.name || o.parent?.name || '?').slice(0, 24) : '');
      const e = by.get(k) ?? { tris: 0, meshes: 0 };
      e.tris += t; e.meshes += 1; by.set(k, e);
    });
    return [...by.entries()].map(([k, e]) => ({ k, tris: Math.round(e.tris), meshes: e.meshes })).sort((a, b) => b.tris - a.tris).slice(0, 18);
  });
  console.log(JSON.stringify(rows));
} finally { await sim.close(); }
process.exit(0);
