/**
 * Gerbang visual M8-T4 (pohon kartu daun V15 vs gumpalan V11): titik x jam x kamera x varian -> screenshot, atau --perf.
 *   SIM_PORT=5190 node tools/shots/m8t4Visual.mjs [--views sekre,hutan,panorama] [--hours 11,17] [--cams first,angled]
 *     [--variants v11,v15] [--out m8t4] [--wait 6000] [--perf] [--rounds 2]
 * v11 = gaya kartun + graphics.kartuDaun=false (gumpalan); v15 = kartun + kartuDaun=true (kartu daun).
 * --perf: draw call, segitiga, frame rata-rata/p95 per titik (kamera 3/4 untuk sekre, mata untuk hutan), bergantian v11/v15 sebanyak --rounds.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    views: { type: 'string', default: 'sekre,hutan,panorama' },
    hours: { type: 'string', default: '11,17' },
    cams: { type: 'string', default: 'first,angled' },
    variants: { type: 'string', default: 'v11,v15' },
    out: { type: 'string', default: 'm8t4' },
    wait: { type: 'string', default: '6000' },
    gpu: { type: 'string', default: 'd3d11' },
    frames: { type: 'string', default: '300' },
    rounds: { type: 'string', default: '2' },
    perf: { type: 'boolean', default: false },
  },
});
const OUT = join(ROOT, 'docs', 'screenshots', v.out);
mkdirSync(OUT, { recursive: true });
const HEADING_98 = Math.atan2(Math.sin((98 * Math.PI) / 180), -Math.cos((98 * Math.PI) / 180));
const VIEWS = {
  sekre: { x: -96.65, z: 1011.5, yaw: Math.PI, cams: ['first', 'angled'] },
  hutan: { x: -88, z: 998, yaw: Math.PI / 2, cams: ['first', 'angled'] },
  panorama: { x: -137.1, z: 999.5, yaw: HEADING_98, cams: ['first'] },
};

const measure = async (n) => {
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
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { calls: info.calls, tris: info.triangles, avg: Number(avg.toFixed(2)), p95: Number(times[Math.floor(times.length * 0.95)].toFixed(2)) };
};

const sim = await openSim({ gpu: v.gpu });
try {
  for (const vid of v.views.split(',')) {
    const pt = VIEWS[vid];
    await settleAt(sim.page, { ...pt, hour: 17, waitMs: 3000 });
    const hours = v.perf ? [17] : v.hours.split(',').map(Number);
    const cams = v.perf ? [vid === 'sekre' ? 'angled' : 'first'] : v.cams.split(',').filter((c) => pt.cams.includes(c));
    for (const hour of hours) {
      for (const cam of cams) {
        const variants = v.perf ? Array.from({ length: Number(v.rounds) }, () => v.variants.split(',')).flat() : v.variants.split(',');
        for (const variant of variants) {
          await sim.page.evaluate(({ c, vr, h, p }) => {
            const s = window.__sim;
            s.store.set('sky.hour', h);
            s.store.set('camera.mode', c);
            s.store.set('graphics.gayaGrafis', 'kartun');
            s.store.set('graphics.kartuDaun', vr === 'v15');
            s.teleport(p.x, p.z, p.yaw);
          }, { c: cam, vr: variant, h: hour, p: pt });
          await sim.page.waitForTimeout(Number(v.wait));
          if (v.perf) {
            const m = await sim.page.evaluate(measure, Number(v.frames));
            const cards = await sim.page.evaluate(() => { const o = window.__sim.app.scene.getObjectByName('ukm-pohon:lod0-daun'); return { leafCards: Boolean(o?.parent?.visible) }; });
            console.log(JSON.stringify({ view: vid, cam, variant, ...cards, ...m }));
          } else {
            const name = `${vid}-${cam}-${String(hour).replace('.', '')}-${variant}.jpg`;
            await sim.page.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 84 });
            console.log(name);
          }
        }
      }
    }
  }
  console.log('errors', JSON.stringify(sim.errors.slice(0, 10)));
} finally {
  await sim.close();
}
