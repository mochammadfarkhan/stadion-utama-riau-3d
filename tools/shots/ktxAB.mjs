/**
 * A/B KTX2 vs WebP: dua bidikan identik (?nokt2 = WebP) di titik sekre + beda piksel rata-rata + memori tekstur PBR.
 *   SIM_PORT=5190 node tools/shots/ktxAB.mjs
 */
import { join } from 'node:path';
import sharp from 'sharp';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const OUT = join(ROOT, 'docs', 'screenshots', 'm8poles');
const shots = {};
for (const [label, query] of [['ktx2', ''], ['webp', '?nokt2']]) {
  const sim = await openSim({ query });
  try {
    await settleAt(sim.page, { x: -137.1, z: 999.5, yaw: 1.7, hour: 11, waitMs: 3000 });
    await sim.page.evaluate(() => {
      const s = window.__sim;
      s.store.set('graphics.gayaGrafis', 'kartun');
      s.store.set('camera.mode', 'first');
    });
    await sim.page.waitForTimeout(12000);
    const info = await sim.page.evaluate(async () => {
      const m = await import('/src/world/textures/pbr.js');
      const mem = m.pbrMemory();
      const comp = mem.entries.filter((e) => e.compressed).length;
      return { bytesMB: Number((mem.bytes / 1048576).toFixed(1)), textures: mem.count, kompresi: comp };
    });
    const path = join(OUT, `ktxAB-${label}.png`);
    await sim.page.screenshot({ path });
    shots[label] = path;
    console.log(label, JSON.stringify(info), 'errors', JSON.stringify(sim.errors.filter((e) => !/X4122|toNonIndexed/.test(e)).slice(0, 3)));
  } finally {
    await sim.close();
  }
}
const [a, b] = await Promise.all([sharp(shots.ktx2).removeAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(shots.webp).removeAlpha().raw().toBuffer({ resolveWithObject: true })]);
let sum = 0;
for (let i = 0; i < a.data.length; i += 1) sum += Math.abs(a.data[i] - b.data[i]);
console.log('beda piksel rata-rata (0-255):', (sum / a.data.length).toFixed(2));
