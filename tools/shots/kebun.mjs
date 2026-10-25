/**
 * Uji main kebun: sepeda → F jalan kaki → E cangkul/tanam/siram beberapa petak → tidur di rumah → F traktor.
 *   node tools/shots/kebun.mjs <folder-keluaran>
 */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const out = process.argv[2] ?? '.';
const sim = await openSim({ beforeGoto: async (page) => page.addInitScript(() => localStorage.removeItem('stadion.kebun.v1')) });
const { page } = sim;
const shot = (n) => page.screenshot({ path: `${out}/kebun-${n}.png` });
const key = async (k, n = 1) => { for (let i = 0; i < n; i += 1) { await page.keyboard.press(k); await page.waitForTimeout(250); } };
const tp = (x, z, yaw) => page.evaluate((p) => window.__sim.teleport(p.x, p.z, p.yaw), { x, z, yaw });
const info = () => page.evaluate(() => ({ mode: window.__sim.ents?.bike?.mode ?? null, prompt: document.querySelector('#hud-prompt')?.textContent, wallet: document.querySelector('#hud-wallet')?.textContent }));
try {
  await settleAt(page, { x: -150, z: 973, yaw: -Math.PI / 2, hour: 9, waitMs: 12000 });
  await page.waitForTimeout(3000);
  await shot('1-sepeda');
  // keymap (F) baru aktif setelah menu Mulai (session.started); harness tidak membuka menu → ganti mode lewat API
  const toMode = (m) => page.evaluate((mode) => window.__sim.ents.bike.setMode(mode), m);
  await toMode('jalan');
  console.log('setelah F', await info());
  for (const [x, z] of [[-153.5, 969], [-153.5, 971], [-153.5, 973], [-153.5, 975]]) {
    await tp(x, z, -Math.PI / 2); // menghadap barat: petak di depan
    await page.waitForTimeout(300);
    console.log('petak', x, z, await info());
    await key('KeyE', 3); // cangkul, tanam, siram
  }
  await tp(-150, 975, -Math.PI / 2);
  await page.waitForTimeout(800);
  await shot('2-jalan-tanam');
  await tp(-155.5, 988, Math.PI / 2 + Math.PI); // depan tangga rumah, menghadap rumah (barat)
  await page.waitForTimeout(400);
  console.log('pintu', await info());
  await key('KeyE'); // tidur
  await page.waitForTimeout(1500);
  await tp(-150, 973, -Math.PI / 2);
  await toMode('traktor');
  console.log('traktor', await info());
  await tp(-163, 980.5, Math.PI); // ujung selatan kolom 2, menghadap utara
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000); // melaju ke utara melintasi petak rumput → dibajak
  await page.keyboard.up('KeyW');
  await tp(-150, 984, -Math.PI / 2 - 0.5);
  await page.waitForTimeout(1500);
  await shot('3-traktor');
  console.log('kebun', await page.evaluate(() => localStorage.getItem('stadion.kebun.v1')));
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
process.exit(0);
