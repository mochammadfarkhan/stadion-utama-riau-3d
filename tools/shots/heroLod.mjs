/**
 * Beban render per gedung hero region (anak `lembaga:konten` / konten rektorat) dari satu titik: selisih draw call &
 * segitiga bila anak disembunyikan (frame yang sama, pass bayangan ikut), plus jarak datar ke pusat bbox anak.
 *   node tools/shots/heroLod.mjs [--x -700 --z 853 --yaw 1.57] [--query nohero]
 */
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    x: { type: 'string', default: '-700' }, z: { type: 'string', default: '853' }, yaw: { type: 'string', default: '1.57' },
    hour: { type: 'string', default: '11' }, wait: { type: 'string', default: '4000' }, query: { type: 'string', default: '' },
  },
});
const sim = await openSim({ query: v.query });
try {
  await settleAt(sim.page, { x: Number(v.x), z: Number(v.z), yaw: Number(v.yaw), hour: Number(v.hour), waitMs: Number(v.wait) });
  const out = await sim.page.evaluate((focus) => {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    const render2 = () => { s.app.renderFrame(); s.app.renderFrame(); return { calls: info.calls, tris: info.triangles }; };
    const base = render2();
    const rows = [{ name: '(total frame)', calls: base.calls, tris: base.tris, d: 0 }];
    for (const a of s.regions.active()) {
      const root = a.region?.lateRoot;
      if (!root) continue;
      for (const c of root.children) {
        const box = new c.position.constructor();
        c.updateWorldMatrix(true, true);
        const bb = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
        c.traverse((o) => {
          if (!o.isMesh || !o.geometry.boundingBox) o.geometry?.computeBoundingBox?.();
          if (!o.isMesh) return;
          const g = o.geometry.boundingBox;
          for (const [x, z] of [[g.min.x, g.min.z], [g.max.x, g.max.z]]) {
            box.set(x, 0, z).applyMatrix4(o.matrixWorld);
            bb.min[0] = Math.min(bb.min[0], box.x); bb.min[1] = Math.min(bb.min[1], box.z);
            bb.max[0] = Math.max(bb.max[0], box.x); bb.max[1] = Math.max(bb.max[1], box.z);
          }
        });
        const cx = (bb.min[0] + bb.max[0]) / 2;
        const cz = (bb.min[1] + bb.max[1]) / 2;
        const prev = c.visible;
        c.visible = false;
        const r = render2();
        c.visible = prev;
        rows.push({ name: `${a.def.id}/${c.name || c.type}`, calls: base.calls - r.calls, tris: base.tris - r.tris, d: Math.round(Math.hypot(cx - focus.x, cz - focus.z)) });
      }
    }
    render2();
    return rows;
  }, { x: Number(v.x), z: Number(v.z) });
  for (const r of out) console.log(`${String(r.calls).padStart(5)} calls ${String(r.tris).padStart(9)} tris ${String(r.d).padStart(5)} m  ${r.name}`);
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
process.exit(0);
