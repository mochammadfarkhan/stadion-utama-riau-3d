/**
 * Bidikan item di tangan + animasi pakai (cangkul dipanggul lalu diayun, benih diraih, gembor dituang), kamera samping.
 * Selama ayunan, update pemain diperlambat 10× (hanya di skrip ini) agar fase animasi tertangkap screenshot.
 *   node tools/shots/itemTangan.mjs <folder-keluaran>
 */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const out = process.argv[2] ?? '.';
const SLOW = 10;
const sim = await openSim({
  beforeGoto: async (page) => page.addInitScript(() => {
    localStorage.removeItem('stadion.kebun.v1');
    localStorage.removeItem('stadion.inventory.v1');
  }),
});
const { page } = sim;
const WEST = -Math.PI / 2;
const shot = async (name) => {
  await page.evaluate(() => { window.__sim.rig.yawOffset = 1.3; }); // orbit ke kanan pemain (tampak samping)
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/tangan-${name}.png` });
};
const slow = (on) => page.evaluate(({ on, k }) => {
  const b = window.__sim.ents.bike;
  if (on) {
    const base = Object.getPrototypeOf(b).update;
    b.update = (dt, ctx) => base.call(b, dt / k, ctx);
  } else delete b.update;
}, { on, k: SLOW });
try {
  await settleAt(page, { x: -153.5, z: 969, yaw: WEST, hour: 10, waitMs: 12000 });
  await page.evaluate(async () => { (await import('/src/app/session.js')).session.started = true; });
  await page.evaluate(() => { window.__sim.ents.bike.setMode('jalan'); window.__sim.teleport(-153.5, 969, -Math.PI / 2); });
  await page.waitForTimeout(2500);
  const plan = [['Digit1', 'cangkul', 0.65, [0.3, 0.66]], ['Digit3', 'benih', 0.55, [0.5]], ['Digit2', 'gembor', 0.9, [0.5]]];
  for (const [slot, name, dur, phases] of plan) {
    await page.keyboard.press(slot);
    await page.waitForTimeout(700);
    await shot(`${name}-bawa`);
    await slow(true);
    await page.keyboard.press('KeyE');
    const t0 = Date.now();
    for (const ph of phases) {
      await page.waitForTimeout(Math.max(0, ph * dur * SLOW * 1000 - (Date.now() - t0)));
      await shot(`${name}-${Math.round(ph * 100)}`);
    }
    await page.waitForTimeout(Math.max(0, dur * SLOW * 1000 - (Date.now() - t0)) + 300);
    await slow(false);
  }
  console.log('kebun', await page.evaluate(() => localStorage.getItem('stadion.kebun.v1')?.slice(0, 100)));
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
process.exit(0);
