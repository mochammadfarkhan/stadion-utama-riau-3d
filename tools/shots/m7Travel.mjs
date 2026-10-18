/**
 * Gerbang visual perjalanan cepat M7: pilih tiap tujuan kampus lewat menu perjalanan cepat (`__sim.fastTravel(id)`), tunggu
 * selesai, lalu ambil screenshot dengan kamera permainan biasa (orang ketiga) + status & posisi akhir. HUD tetap tampak.
 *   node tools/shots/m7Travel.mjs [--gpu d3d11] [--out docs/screenshots/unri] [--hour 10]
 */
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { openSim, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: join('docs', 'screenshots', 'unri') }, hour: { type: 'string', default: '10' } } });
const OUT = resolve(ROOT, values.out);
mkdirSync(OUT, { recursive: true });

const sim = await openSim({ gpu: values.gpu });
const report = { destinations: [], travel: {}, errors: [] };
try {
  const { page } = sim;
  await page.evaluate((h) => window.__sim.store.set('sky.hour', h), Number(values.hour));
  report.destinations = await page.evaluate(() => window.__sim.fastTravel && ['unri-sekre', 'unri-rektorat', 'stadion'].map((id) => id));
  for (const id of ['unri-sekre', 'unri-rektorat']) {
    const t0 = Date.now();
    const status = await page.evaluate((i) => window.__sim.fastTravel(i), id);
    await page.waitForTimeout(2500);
    const where = await page.evaluate(() => {
      const b = window.__sim.ents.bike.state;
      return { x: +b.x.toFixed(1), z: +b.z.toFixed(1), yaw: +b.yaw.toFixed(2), regionId: window.__sim.regionIdAt(b.x, b.z), inside: window.__sim.regions.active().map((a) => a.def.id) };
    });
    report.travel[id] = { status, ms: Date.now() - t0, ...where };
    await page.screenshot({ path: join(OUT, `m7-travel-${id}.jpg`), type: 'jpeg', quality: 85 });
  }
  report.errors = sim.errors;
} finally {
  await sim.close();
}
console.log(JSON.stringify(report, null, 2));
