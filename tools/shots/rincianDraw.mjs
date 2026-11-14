/**
 * Rincian draw call per kelompok objek (preset dipaksa Rendah, seperti kritik.mjs). Satu frame direkam dengan membungkus
 * renderer.renderBufferDirect: yang dihitung adalah draw call SUNGGUHAN (sesudah frustum culling, layer, visible), bukan jumlah mesh.
 *   node tools/shots/rincianDraw.mjs [--titik awal,sekre,unri-jalan,rektorat] [--kedalaman 2] [--dalam <nama induk>] [--json <berkas>]
 * Kelompok = nama leluhur pada kedalaman tertentu di bawah scene ("induk/anak"); --dalam memulai jalur dari objek bernama itu.
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values } = parseArgs({
  options: {
    titik: { type: 'string', default: 'awal,sekre,unri-jalan,rektorat' },
    kedalaman: { type: 'string', default: '2' },
    dalam: { type: 'string' },
    json: { type: 'string' },
    preset: { type: 'string', default: 'rendah' },
  },
});

/** Titik dunia tetap (sama dengan kritik.mjs). `awal` = titik spawn. */
const TITIK = {
  awal: { pakaiSpawn: true, hour: 16.5 },
  sekre: { x: -96.65, z: 1011.5, yaw: Math.PI, hour: 11 },
  'unri-jalan': { x: -206, z: 1118, yaw: -2.52, hour: 10 },
  rektorat: { x: -1074.7, z: 1316, yaw: Math.PI, hour: 9 },
};

const sim = await openSim({ width: 1600, height: 900 });
const { page } = sim;
const hasil = { preset: values.preset, titik: {} };
try {
  await page.evaluate(async (preset) => {
    const s = window.__sim;
    s.rig.exitPov({ instant: true });
    s.store.set('graphics.preset', preset);
    await new Promise((r) => setTimeout(r, 1500));
  }, values.preset);
  const spawn = await page.evaluate(() => { const b = window.__sim.ents.bike.state; return { x: b.x, z: b.z, yaw: b.yaw }; });
  for (const nama of values.titik.split(',').map((s) => s.trim()).filter(Boolean)) {
    const t = TITIK[nama];
    if (!t) throw new Error(`titik tidak dikenal: ${nama}`);
    await settleAt(page, t.pakaiSpawn ? { ...spawn, hour: t.hour } : t);
    hasil.titik[nama] = await page.evaluate(async ({ depth, dalam }) => {
      const s = window.__sim;
      const r = s.app.renderer;
      const counts = new Map();
      const label = (o) => o.name || o.type;
      const groupOf = (obj) => {
        const chain = [];
        for (let o = obj; o && !o.isScene; o = o.parent) chain.unshift(o);
        let start = 0;
        if (dalam) {
          const i = chain.findIndex((o) => o.name === dalam);
          if (i < 0) return null;
          start = i + 1;
        }
        return chain.slice(start, start + depth).map(label).join('/') || '(akar)';
      };
      const orig = r.renderBufferDirect;
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      let t2 = 0;
      r.renderBufferDirect = function rekam(camera, scene, geometry, material, object, group) {
        t2 += 1;
        const k = groupOf(object);
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
        return orig.call(this, camera, scene, geometry, material, object, group);
      };
      await new Promise((res) => requestAnimationFrame(res)); // satu frame penuh terekam
      r.renderBufferDirect = orig;
      const kelompok = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25);
      return { calls: r.info.render.calls, terekam: t2, kelompok };
    }, { depth: Number(values.kedalaman), dalam: values.dalam ?? null });
    const h = hasil.titik[nama];
    console.log(`\n== ${nama}: calls ${h.calls} (terekam ${h.terekam})`);
    for (const [k, n] of h.kelompok) console.log(String(n).padStart(5), k);
  }
} finally {
  await sim.close();
}
if (values.json) writeFileSync(values.json, JSON.stringify(hasil, null, 1));
process.exit(0);
