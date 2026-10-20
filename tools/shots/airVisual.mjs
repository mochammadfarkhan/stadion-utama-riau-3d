/**
 * Gerbang visual M8 P2 (air kartun): titik x jam x kamera x gaya -> screenshot, atau --perf (draw call + frame).
 *   SIM_PORT=5191 node tools/shots/airVisual.mjs [--points danau,danau2,waduk] [--hours 11,17,20.5] [--cams angled,first]
 *     [--styles asli,kartun] [--out m8air] [--wait 5000] [--rain] [--perf]
 * Titik = posisi bike (dunia) + yaw (maju = (sin, cos)); kamera mengikuti bike. Danau Buatan lokal region + (-985,8; 800).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    points: { type: 'string', default: 'danau' },
    hours: { type: 'string', default: '11' },
    cams: { type: 'string', default: 'angled' },
    styles: { type: 'string', default: 'asli,kartun' },
    out: { type: 'string', default: 'm8air' },
    wait: { type: 'string', default: '4000' },
    gpu: { type: 'string', default: 'd3d11' },
    frames: { type: 'string', default: '300' },
    rain: { type: 'boolean', default: false },
    perf: { type: 'boolean', default: false },
  },
});
const OUT = join(ROOT, 'docs', 'screenshots', v.out);
mkdirSync(OUT, { recursive: true });
const POINTS = {
  danau: { x: -778, z: 824, yaw: 0.35 }, // tepi utara Danau Buatan, menghadap ke danau
  danau2: { x: -745, z: 819, yaw: 2.3 }, // dekat batu pijakan, menghadap barat-daya sepanjang danau
  waduk: { x: -620, z: 520, yaw: 0 },
  dermaga: { x: -705, z: 806, yaw: -1.45 }, // taman bundaran, menghadap dermaga (ke barat)
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
  for (const pid of v.points.split(',')) {
    const pt = POINTS[pid];
    await settleAt(sim.page, { ...pt, hour: 11, waitMs: 3000 });
    for (const hour of v.hours.split(',').map(Number)) {
      for (const cam of v.cams.split(',')) {
        for (const style of v.styles.split(',')) {
          await sim.page.evaluate(({ c, st, h, p, rain }) => {
            const s = window.__sim;
            s.store.set('sky.hour', h);
            s.store.set('camera.mode', c);
            s.store.set('graphics.gayaGrafis', st);
            s.store.set('weather.raining', rain);
            s.teleport(p.x, p.z, p.yaw);
          }, { c: cam, st: style, h: hour, p: pt, rain: v.rain });
          await sim.page.waitForTimeout(Number(v.wait));
          if (v.perf) {
            const m = await sim.page.evaluate(measure, Number(v.frames));
            console.log(JSON.stringify({ point: pid, hour, cam, style, ...m }));
          } else {
            const name = `${pid}-${cam}-${String(hour).replace('.', '')}-${style}${v.rain ? '-hujan' : ''}.jpg`;
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
