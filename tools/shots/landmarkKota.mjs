/**
 * Bidikan landmark hero mode Kota di beberapa zoom (cek LOD).
 *   node tools/shots/landmarkKota.mjs --out <folder> [--id an-nur] [--zoom 0.9,2,5,9] [--hour 11] [--yaw 0]
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';
import { LANDMARKS } from '../../src/city/landmarks.js';

const { values: v } = parseArgs({ options: { out: { type: 'string', default: 'renders/landmark' }, id: { type: 'string', default: 'an-nur' }, zoom: { type: 'string', default: '0.9,2,5,9' }, hour: { type: 'string', default: '11' } } });
const OUT = resolve(v.out);
mkdirSync(OUT, { recursive: true });
const lm = LANDMARKS.find((l) => l.id === v.id);
const sim = await openSim({ width: 1400, height: 800 });
const { page } = sim;
try {
  await page.evaluate(() => window.__sim.rig.exitPov({ instant: true }));
  await settleAt(page, { x: 150, z: -260, yaw: 0, hour: Number(v.hour) });
  await page.evaluate(() => window.__sim.rig.handlePovKey('KeyK'));
  await page.waitForTimeout(25000);
  for (const z of v.zoom.split(',').map(Number)) {
    await page.evaluate(({ x, zz, zoom }) => window.__sim.rig.director.flyTo(x, zz, zoom), { x: lm.x, zz: lm.z, zoom: z });
    await page.waitForTimeout(9000);
    await page.screenshot({ path: join(OUT, `${v.id}-zoom${z}.jpg`), type: 'jpeg', quality: 85 });
    const info = await page.evaluate((id) => {
      const s = window.__sim;
      const r = s.app.renderer.info.render;
      const root = s.app.scene.getObjectByName(`landmark:${id}`);
      const lod = root ? root.children.findIndex((c) => c.visible) : -1;
      const d = root ? s.app.camera.position.distanceTo(root.position) : null;
      return { calls: r.calls, tris: r.triangles, lod, dist: d && Math.round(d), zoomReal: s.rig.director.zoom };
    }, v.id);
    console.log(JSON.stringify({ zoom: z, ...info }));
  }
  if (sim.errors.length) console.log('errors', JSON.stringify(sim.errors.slice(0, 5)));
} finally {
  await sim.close();
}
