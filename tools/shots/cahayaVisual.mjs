/**
 * Gerbang visual M8-B (cahaya/atmosfer/warna): titik x jam x kamera x gaya (asli vs kartun) -> screenshot.
 *   SIM_PORT=5190 node tools/shots/cahayaVisual.mjs [--points sekre,stadion] [--hours 7.5,17,20.5] [--cams angled,first]
 *     [--styles asli,kartun] [--out m8cahaya] [--wait 9000] [--perf]
 * --perf: ukur draw call + frame rata-rata/p95 di titik sekre (kamera 3/4, jam 17) untuk gaya yang diberikan lewat --styles.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    points: { type: 'string', default: 'sekre,stadion' },
    hours: { type: 'string', default: '7.5,17,20.5' },
    cams: { type: 'string', default: 'angled,first' },
    styles: { type: 'string', default: 'asli,kartun' },
    out: { type: 'string', default: 'm8cahaya' },
    wait: { type: 'string', default: '3500' },
    gpu: { type: 'string', default: 'd3d11' },
    frames: { type: 'string', default: '300' },
    perf: { type: 'boolean', default: false },
    facesun: { type: 'boolean', default: false }, // hadapkan kamera ke arah matahari (uji aura/hamburan kabut)
    set: { type: 'string', default: '' }, // pengaturan tambahan "kunci=nilai,kunci=nilai" (JSON-parse nilai)
  },
});
const OUT = join(ROOT, 'docs', 'screenshots', v.out);
mkdirSync(OUT, { recursive: true });
const POINTS = {
  sekre: { x: -96.65, z: 1011.5, yaw: Math.PI },
  stadion: { x: null, z: null, yaw: null },
};

const measure = (n) => async () => {
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
  const spawn = await sim.page.evaluate(() => {
    const b = window.__sim.ents.bike.state;
    return { x: b.x, z: b.z, yaw: b.yaw };
  });
  Object.assign(POINTS.stadion, spawn);
  const extra = v.set ? Object.fromEntries(v.set.split(',').map((kv) => { const [k, ...r] = kv.split('='); return [k, JSON.parse(r.join('='))]; })) : {};
  for (const pid of v.points.split(',')) {
    const pt = POINTS[pid];
    await settleAt(sim.page, { ...pt, hour: 17, waitMs: 3000 });
    for (const hour of v.hours.split(',').map(Number)) {
      for (const cam of v.cams.split(',')) {
        for (const style of v.styles.split(',')) {
          await sim.page.evaluate(({ c, st, h, p, ex }) => {
            const s = window.__sim;
            s.store.set('sky.hour', h);
            s.store.set('camera.mode', c);
            s.store.set('graphics.gayaGrafis', st);
            for (const [k, val] of Object.entries(ex)) s.store.set(k, val);
            s.teleport(p.x, p.z, p.yaw);
          }, { c: cam, st: style, h: hour, p: pt, ex: extra });
          if (v.facesun) {
            await sim.page.waitForTimeout(600);
            await sim.page.evaluate(({ p }) => {
              const s = window.__sim;
              let sun = null;
              s.app.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
              const dx = sun.position.x - sun.target.position.x;
              const dz = sun.position.z - sun.target.position.z;
              s.teleport(p.x, p.z, Math.atan2(dx, dz));
            }, { p: pt });
          }
          await sim.page.waitForTimeout(Number(v.wait));
          if (v.perf) {
            const m = await sim.page.evaluate(measure(Number(v.frames)));
            console.log(JSON.stringify({ point: pid, hour, cam, style, extra: v.set, ...m }));
          } else {
            const name = `${pid}-${cam}-${String(hour).replace('.', '')}-${style}${v.facesun ? '-sun' : ''}.jpg`;
            await sim.page.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 82 });
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
