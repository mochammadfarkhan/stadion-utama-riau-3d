/** Daftar mesh stadion tampil di jarak jauh (nama, segitiga). SIM_PORT=5197 node tools/shots/stadionMeshes.mjs */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const sim = await openSim({});
try {
  await settleAt(sim.page, { x: 450, z: -1000, yaw: Math.atan2(-450, 1000), hour: 11, waitMs: 5000 });
  const rows = await sim.page.evaluate(() => {
    const s = window.__sim; const cam = s.app.camera; const out = [];
    s.app.scene.traverse((o) => {
      if (!o.isMesh || !o.layers.test(cam.layers)) return;
      for (let n = o; n; n = n.parent) if (!n.visible) return;
      let p = o; while (p.parent && p.parent !== s.app.scene) p = p.parent;
      if (p.name !== 'jangkarRegion') return;
      const g = o.geometry;
      out.push([o.name || o.parent?.name || '?', Math.round((g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1))]);
    });
    return out.sort((a, b) => b[1] - a[1]);
  });
  console.log(rows.length, rows.reduce((t, r) => t + r[1], 0));
  console.log(rows.map((r) => r.join(':')).join(' | '));
} finally { await sim.close(); }
process.exit(0);
