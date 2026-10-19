/**
 * Gerbang visual + performa kamera 3/4 & gaya grafis: tiap titik x konfigurasi (lama = third+asli, angled+asli,
 * angled+kartun, angled+facet) -> screenshot + draw call/segitiga (renderer.info, 1 frame penuh) + frame time (rata-rata / p95).
 *   node tools/shots/kameraVisual.mjs [--points sekre,stadion,jalan,malam] [--configs lama,angled-asli,angled-kartun,angled-facet] [--gpu d3d11]
 * Keluaran: docs/screenshots/kamera/<titik>-<konfigurasi>.jpg + tabel JSON ke stdout.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    points: { type: 'string', default: 'sekre,stadion,jalan,malam' },
    configs: { type: 'string', default: 'lama,angled-asli,angled-kartun,angled-facet' },
    gpu: { type: 'string', default: 'd3d11' },
    frames: { type: 'string', default: '240' },
  },
});
const OUT = join(ROOT, 'docs', 'screenshots', 'kamera');
mkdirSync(OUT, { recursive: true });

const CONFIGS = {
  lama: { mode: 'third', style: 'asli' },
  'angled-asli': { mode: 'angled', style: 'asli' },
  'angled-kartun': { mode: 'angled', style: 'kartun' },
  'angled-facet': { mode: 'angled', style: 'facet' },
};
const POINTS = {
  sekre: { x: -96.65, z: 1005.5 + 6, yaw: Math.PI, hour: 11 },
  stadion: { x: null, z: null, yaw: null, hour: 16.5 },
  jalan: { x: -206, z: 1118, yaw: -2.52, hour: 10 },
  malam: { x: -96.65, z: 1005.5 + 6, yaw: Math.PI, hour: 20.5 },
};

const sim = await openSim({ gpu: v.gpu });
const rows = [];
try {
  const spawn = await sim.page.evaluate(() => {
    const b = window.__sim.ents.bike.state;
    return { x: b.x, z: b.z, yaw: b.yaw };
  });
  Object.assign(POINTS.stadion, spawn);
  for (const pid of v.points.split(',')) {
    const pt = POINTS[pid];
    await settleAt(sim.page, { ...pt, waitMs: 3000 });
    for (const cid of v.configs.split(',')) {
      const cfg = CONFIGS[cid];
      await sim.page.evaluate(({ cfg: c, pt: p }) => {
        const s = window.__sim;
        s.store.set('sky.hour', p.hour);
        s.store.set('camera.mode', c.mode);
        s.store.set('graphics.gayaGrafis', c.style);
        s.teleport(p.x, p.z, p.yaw);
      }, { cfg, pt });
      await sim.page.waitForTimeout(3500); // snap kamera, scan material, streaming ulang
      const m = await sim.page.evaluate(async (n) => {
        const s = window.__sim;
        const info = s.app.renderer.info.render;
        const times = [];
        let last = performance.now();
        for (let i = 0; i < n; i += 1) {
          await new Promise((r) => requestAnimationFrame(r));
          const t = performance.now();
          times.push(t - last);
          last = t;
        }
        const calls = info.calls;
        const tris = info.triangles;
        times.sort((a, b) => a - b);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return { calls, tris, avg: Number(avg.toFixed(2)), p95: Number(times[Math.floor(times.length * 0.95)].toFixed(2)) };
      }, Number(v.frames));
      await sim.page.screenshot({ path: join(OUT, `${pid}-${cid}.jpg`), type: 'jpeg', quality: 82 });
      rows.push({ point: pid, config: cid, ...m });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
  console.log('errors', JSON.stringify(sim.errors.slice(0, 10)));
} finally {
  await sim.close();
}
