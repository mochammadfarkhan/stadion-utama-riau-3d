/**
 * Gerbang visual easter egg kampus M7: memicu tiga egg di permainan nyata (Playwright GPU) dan memotret toast/jurnal.
 *   - lambang-1-10-62: teleport ke plang N10 (Gerbang Soebrantas).
 *   - gasing-berputar: teleport titik demi titik mengitari GGM pada radius 70 m (satu putaran penuh).
 *   - kampus-biru-langit: 9 × story.update(dt 10 dtk) di dalam kampus pukul 11 cerah (90 dtk game).
 *   node tools/shots/m7Eggs.mjs [--gpu d3d11] [--out docs/screenshots/unri]
 */
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: join('docs', 'screenshots', 'unri') } } });
const OUT = resolve(ROOT, values.out);
mkdirSync(OUT, { recursive: true });

const sim = await openSim({ gpu: values.gpu });
const report = { eggs: {}, errors: [] };
try {
  const { page } = sim;
  const eggs = () => page.evaluate(() => [...window.__sim.story.state.eggs]);
  await page.evaluate(() => {
    document.getElementById('overlay')?.classList.add('hidden');
    const st = window.__sim.story;
    for (let i = 0; i < 6 && st.state.dialog; i += 1) st.advanceDialog(); // dialog pembuka chapter 1 menahan event
  });

  // 1. lambang
  await settleAt(page, { x: -1071, z: 2084, yaw: Math.PI, hour: 11, waitMs: 6000 });
  await page.waitForTimeout(1500);
  report.eggs.lambang = (await eggs()).includes('lambang-1-10-62');
  await page.screenshot({ path: join(OUT, 'm7-egg-lambang-toast.jpg'), type: 'jpeg', quality: 85 });

  // 2. GGM: satu putaran penuh (36 titik, radius 70 m dari pusat 133,1; 407,4)
  await settleAt(page, { x: 133.1 + 70, z: 407.4, yaw: 0, hour: 16, waitMs: 4000 });
  for (let k = 0; k <= 37; k += 1) {
    const a = (k / 36) * Math.PI * 2;
    await page.evaluate(([x, z, yaw]) => window.__sim.teleport(x, z, yaw), [133.1 + Math.cos(a) * 70, 407.4 + Math.sin(a) * 70, -a]);
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(800);
  report.eggs.ggm = (await eggs()).includes('gasing-berputar');
  await page.screenshot({ path: join(OUT, 'm7-egg-ggm-toast.jpg'), type: 'jpeg', quality: 85 });

  // 3. Kampus Biru Langit: bike di dalam kampus, jam 11 cerah, 90 dtk game
  await settleAt(page, { x: -206, z: 1118, yaw: Math.PI, hour: 11, waitMs: 3000 });
  await page.evaluate(() => {
    const s = window.__sim;
    s.store.set('weather.raining', false);
    const b = s.ents.bike.state;
    for (let i = 0; i < 10; i += 1) s.story.update(10, { time: 1000 + i * 10, bikePos: b, hour: 11, raining: false, inCampus: true, paused: false });
  });
  await page.waitForTimeout(800);
  report.eggs.biruLangit = (await eggs()).includes('kampus-biru-langit');
  await page.screenshot({ path: join(OUT, 'm7-egg-biru-langit-toast.jpg'), type: 'jpeg', quality: 85 });
  report.errors = sim.errors;
  report.allEggs = await eggs();
} finally {
  await sim.close();
}
console.log(JSON.stringify(report, null, 2));
