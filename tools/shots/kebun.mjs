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
  // tiga jenis berjajar: cabai, jagung, terong (B ganti benih; sistem kebun tidak menunggu menu Mulai)
  const rows = [[969, 0], [971, 0], [973, 1], [975, 1], [977, 2]];
  let held = 0;
  for (const [z, want] of rows) {
    while (held !== want) { await key('KeyB'); held = (held + 1) % 3; }
    await tp(-153.5, z, -Math.PI / 2); // menghadap barat: petak di depan
    await page.waitForTimeout(300);
    await key('KeyE', 2); // cangkul, tanam
    console.log('petak', z, await info());
    await key('KeyE'); // siram
  }
  await tp(-150, 975, -Math.PI / 2);
  await page.waitForTimeout(800);
  await shot('2-jalan-tanam');
  await tp(-155.5, 988, Math.PI / 2 + Math.PI); // depan tangga rumah, menghadap rumah (barat)
  await page.waitForTimeout(400);
  console.log('pintu', await info());
  for (let malam = 0; malam < 2; malam += 1) {
    await key('KeyE'); // tidur
    await page.waitForTimeout(800);
    for (const [z] of rows) { await tp(-153.5, z, -Math.PI / 2); await page.waitForTimeout(200); await key('KeyE'); } // siram lagi
    await tp(-155.5, 988, -Math.PI / 2);
    await page.waitForTimeout(300);
  }
  await key('KeyE'); // tidur malam ke-3: cabai & terong siap panen, jagung baru tahap 2
  await page.waitForTimeout(800);
  await tp(-149, 973, -Math.PI / 2 - 0.15);
  await page.waitForTimeout(1500);
  await shot('4-jenis');
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
