/** Daftar segitiga/draw call per anak grup region pada jarak tertentu. SIM_PORT=5194 node tools/shots/regionTris.mjs [x z] */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const [x = -152, z = 853] = process.argv.slice(2).map(Number);
const sim = await openSim({});
try {
  await settleAt(sim.page, { x, z, yaw: 0, hour: 11, waitMs: 4000 });
  const rep = await sim.page.evaluate(() => {
    const s = window.__sim;
    const out = [];
    for (const a of s.regions.active()) {
      const root = a.region?.group ?? a.region?.root ?? a.region;
      if (!root) { out.push({ id: a.def.id, note: 'tanpa group', keys: Object.keys(a) }); continue; }
      const kids = [];
      root.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        const tris = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        kids.push({ name: o.name || o.parent?.name || '?', tris: Math.round(tris), inst: o.isInstancedMesh ? o.count : 0, cast: o.castShadow });
      });
      kids.sort((p, q) => q.tris - p.tris);
      out.push({ id: a.def.id, meshes: kids.length, tris: kids.reduce((t, k) => t + k.tris, 0), top: kids.slice(0, 12) });
    }
    return out;
  });
  console.log(JSON.stringify(rep, null, 1));
} finally { await sim.close(); }
process.exit(0);
