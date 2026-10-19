/**
 * Profil beban render distrik UNRI di satu titik (dunia): draw call & segitiga per anak grup distrik (selisih bila disembunyikan,
 * frame yang sama; pass bayangan ikut terhitung), untuk memilih mitigasi spec §9.3.
 *   node tools/shots/m7Profile.mjs [--x -979 --z 860 --yaw 3.14 --hour 12] [--gpu d3d11]
 */
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    x: { type: 'string', default: '-979' }, z: { type: 'string', default: '860' }, yaw: { type: 'string', default: '3.14' },
    hour: { type: 'string', default: '12' }, gpu: { type: 'string', default: 'd3d11' },
  },
});
const sim = await openSim({ gpu: v.gpu });
try {
  await settleAt(sim.page, { x: Number(v.x), z: Number(v.z), yaw: Number(v.yaw), hour: Number(v.hour), waitMs: 4000 });
  const out = await sim.page.evaluate(() => {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    const render2 = () => { s.app.renderFrame(); s.app.renderFrame(); return { calls: info.calls, tris: info.triangles }; };
    const base = render2();
    const sh = s.app.renderer.shadowMap;
    const shadowOn = sh.enabled;
    sh.enabled = false; // hanya pass utama (segitiga "terlihat" tanpa pass bayangan)
    const noShadow = render2();
    sh.enabled = shadowOn;
    render2();
    const root = s.district.district.group;
    const rows = [{ name: '(total frame, dengan pass bayangan)', calls: base.calls, tris: base.tris }, { name: '(total frame, TANPA pass bayangan)', calls: noShadow.calls, tris: noShadow.tris }];
    const walk = (node, depth, prefix) => {
      for (const c of node.children) {
        const prev = c.visible;
        c.visible = false;
        const r = render2();
        c.visible = prev;
        rows.push({ name: `${prefix}${c.name || c.type}`, calls: base.calls - r.calls, tris: base.tris - r.tris });
        if (depth > 0 && c.children.length && c.children.length < 40 && base.tris - r.tris > 40000) walk(c, depth - 1, `${prefix}${c.name || c.type}/`);
      }
    };
    walk(root, 1, 'distrik/');
    return rows;
  });
  for (const r of out) console.log(`${String(r.calls).padStart(5)} calls ${String(r.tris).padStart(9)} tris  ${r.name}`);
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
