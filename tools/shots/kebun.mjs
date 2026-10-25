/**
 * Uji main kebun + inventory: F ke jalan kaki → hotbar 1–3 (cangkul, gembor, benih) → cangkul/tanam/siram → beli benih
 * di kotak benih (B, E) → buka tas (I) → tidur 2 malam → panen → kirim → tidur (uang masuk) → traktor.
 *   node tools/shots/kebun.mjs <folder-keluaran>
 */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const out = process.argv[2] ?? '.';
const sim = await openSim({
  beforeGoto: async (page) => page.addInitScript(() => {
    localStorage.removeItem('stadion.kebun.v1');
    localStorage.removeItem('stadion.inventory.v1');
  }),
});
const { page } = sim;
const WEST = -Math.PI / 2;
const shot = (n) => page.screenshot({ path: `${out}/kebun-${n}.png` });
const key = async (k, n = 1) => { for (let i = 0; i < n; i += 1) { await page.keyboard.press(k); await page.waitForTimeout(250); } };
const tp = async (x, z, yaw = WEST) => { await page.evaluate((p) => window.__sim.teleport(p.x, p.z, p.yaw), { x, z, yaw }); await page.waitForTimeout(300); };
const info = () => page.evaluate(() => ({
  mode: window.__sim.ents?.bike?.mode ?? null,
  prompt: document.querySelector('#hud-prompt')?.textContent,
  wallet: document.querySelector('#hud-wallet')?.textContent,
  held: document.querySelector('#hotbar .inv-slot.selected')?.title || '(kosong)',
}));
const log = async (label) => console.log(label, JSON.stringify(await info()));
const DOOR = [-156.8, 988];
const TILE = [-153.5, 969]; // berdiri di timur petak (7,0), menghadap barat
try {
  await settleAt(page, { x: -150, z: 973, yaw: WEST, hour: 9, waitMs: 12000 });
  await page.evaluate(async () => { (await import('/src/app/session.js')).session.started = true; }); // = klik Mulai
  await page.waitForTimeout(3000);
  for (let i = 0; i < 3 && (await info()).mode !== 'jalan'; i += 1) await key('KeyF');
  await log('mode');
  await tp(...TILE);
  await log('petak + cangkul');
  await key('Digit2'); await log('petak + gembor (harus minta cangkul)');
  await key('Digit1'); await key('KeyE'); await log('sesudah cangkul');
  await key('Digit3'); await key('KeyE'); await log('sesudah tanam');
  await key('Digit2'); await key('KeyE'); await log('sesudah siram');
  await tp(-150, 973, WEST - 0.2);
  await page.waitForTimeout(800);
  await shot('5-hotbar');
  await tp(-156, 984.4); await log('kotak benih');
  await key('KeyB'); await key('KeyE', 2); await log('beli 2 benih jagung');
  await key('KeyI'); await page.waitForTimeout(500);
  await shot('6-tas');
  await key('Escape'); await log('tas ditutup');
  for (let night = 0; night < 2; night += 1) {
    await tp(...DOOR); await key('KeyE'); await page.waitForTimeout(500);
    await tp(...TILE); await key('Digit2'); await key('KeyE');
  }
  await log('siap panen');
  await key('KeyE'); await log('sesudah panen');
  await key('Digit5'); await tp(-156, 991.6); await log('kotak kiriman');
  await key('KeyE'); await log('sesudah kirim');
  await tp(...DOOR); await log('pintu'); await key('KeyE'); await page.waitForTimeout(500); await log('sesudah tidur');
  console.log('tas', await page.evaluate(() => localStorage.getItem('stadion.inventory.v1')));
  await tp(-150, 973);
  await key('KeyF'); await key('KeyF'); await log('F x2');
  await page.waitForTimeout(1200);
  await shot('3-traktor');
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
process.exit(0);
