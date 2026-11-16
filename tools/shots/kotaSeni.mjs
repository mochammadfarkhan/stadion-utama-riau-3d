/**
 * Bidikan arah seni mode Kota (pembanding gambar target user 2026-11-16): kamera K diarahkan ke stadion
 * (origin dunia) pada beberapa zoom, preset dipaksa. Untuk dibuka dan dibandingkan sendiri, bukan tes.
 *   node tools/shots/kotaSeni.mjs --out renders/kota-seni [--preset rendah|tinggi] [--zoom 0.35,0.6] [--x 0 --z 0] [--jam 16.75]
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'renders/kota-seni' },
    preset: { type: 'string', default: 'rendah' },
    zoom: { type: 'string', default: '0.35,0.6' },
    x: { type: 'string', default: '60' },
    z: { type: 'string', default: '-40' },
    jam: { type: 'string', default: '16.75' },
  },
});
const OUT = resolve(values.out);
mkdirSync(OUT, { recursive: true });

const sim = await openSim({ width: 1600, height: 900 });
const { page } = sim;
try {
  await page.evaluate((preset) => {
    const s = window.__sim;
    s.rig.exitPov({ instant: true });
    s.store.set('graphics.preset', preset);
  }, values.preset);
  const spawn = await page.evaluate(() => { const b = window.__sim.ents.bike.state; return { x: b.x, z: b.z, yaw: b.yaw }; });
  await settleAt(page, { ...spawn, hour: Number(values.jam) });
  await page.evaluate(() => window.__sim.rig.handlePovKey('KeyK'));
  await page.waitForTimeout(6000);
  for (const zoom of values.zoom.split(',').map(Number)) {
    await page.evaluate(({ x, z, zoom: zm }) => window.__sim.rig.director.flyTo(x, z, zm), { x: Number(values.x), z: Number(values.z), zoom });
    await page.waitForTimeout(20000);
    const file = join(OUT, `${values.preset}-z${zoom}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
    const info = await page.evaluate(() => window.__sim.app.renderer.info.render);
    process.stdout.write(`${file} calls=${info.calls} tris=${info.triangles}\n`);
  }
} finally {
  if (sim.errors.length) process.stdout.write(`errors: ${sim.errors.slice(0, 5).join(' | ')}\n`);
  await sim.close();
}
