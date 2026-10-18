/**
 * Uji alur chapter 6 "Kampus Biru Langit" di permainan nyata (Playwright GPU, bukan vitest): save chapter 5 disuntik lewat
 * localStorage, lalu tiap misi dijalankan lewat sistem nyata (pedagang kantin, NPC ber-zone, penanda Danau, hook interior).
 *   node tools/shots/m7Story.mjs [--gpu d3d11] [--out docs/screenshots/unri]
 */
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values } = parseArgs({ options: { gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: join('docs', 'screenshots', 'unri') } } });
const OUT = resolve(ROOT, values.out);
mkdirSync(OUT, { recursive: true });

// Save "tamat chapter 5 lama" (indeks 4, finished) → harus terbuka di chapter 6 (reopenForNewChapters).
const SAVE = { version: 3, chapter: 4, step: 0, badges: ['Anak Bertuah'], eggs: [], bestLap: null, rupiah: 0, finished: true, wallet: { balance: 50000, items: [] }, place: null };

const sim = await openSim({
  gpu: values.gpu,
  beforeGoto: (page) => page.addInitScript((save) => window.localStorage.setItem('sur3d.story.v1', JSON.stringify(save)), SAVE),
});
const log = [];
const note = (name, v) => { log.push({ name, ...v }); };
try {
  const { page } = sim;
  const st = () => page.evaluate(() => { const s = window.__sim.story.state; return { chapter: s.chapter, step: s.step, finished: s.finished, dialog: Boolean(s.dialog), balance: window.__sim.story.vendors.wallet.balance, items: window.__sim.story.vendors.wallet.items.map((i) => i.id) }; });
  const advance = () => page.evaluate(() => { const s = window.__sim.story; for (let i = 0; i < 8 && s.state.dialog; i += 1) s.advanceDialog(); });
  note('awal (save tamat chapter 5)', await st());
  await advance();

  // misi 1a: beli nasi kotak dari pedagang kantin
  await settleAt(page, { x: -789, z: 1138.6, yaw: Math.PI, hour: 10, waitMs: 4000 });
  const buy = await page.evaluate(() => {
    const s = window.__sim;
    const v = s.ents.vendors.vendors.find((x) => x.id === 'kantin-fkip');
    const near = s.ents.vendors.promptVendor;
    const res = s.ents.vendors.tryBuy('nasi-kotak', 'kantin-fkip');
    if (res.ok) s.story.onBought(res.item.id);
    return { vendorAda: Boolean(v), promptNama: near?.name ?? null, ok: res.ok, error: res.error ?? null, goal: s.story.goalPoint() };
  });
  note('beli nasi kotak (kantin)', { ...buy, ...(await st()) });
  await page.screenshot({ path: join(OUT, 'm7-story-kantin-beli.jpg'), type: 'jpeg', quality: 85 });
  await advance();

  // misi 1b: antar ke Kak Nisa
  const nisa = await page.evaluate(() => window.__sim.story.npcs.find((n) => n.id === 'kak-nisa'));
  await settleAt(page, { x: nisa.x, z: nisa.z + 1.5, yaw: 0, hour: 10, waitMs: 3000 });
  const deliver = await page.evaluate(() => { const s = window.__sim; const b = s.ents.bike.state; return { handled: s.story.tryInteract({ x: b.x, z: b.z }) }; });
  await advance();
  note('antar nasi kotak (Kak Nisa)', { ...deliver, ...(await st()) });
  await page.screenshot({ path: join(OUT, 'm7-story-npc-nisa.jpg'), type: 'jpeg', quality: 85 });

  // misi 2: tanda tangan Ketua BEM
  const bem = await page.evaluate(() => window.__sim.story.npcs.find((n) => n.id === 'ketua-bem'));
  await settleAt(page, { x: bem.x, z: bem.z + 1.5, yaw: 0, hour: 10, waitMs: 3000 });
  const sign = await page.evaluate(() => { const s = window.__sim; const b = s.ents.bike.state; return { goal: s.story.goalPoint(), handled: s.story.tryInteract({ x: b.x, z: b.z }) }; });
  await advance();
  note('tanda tangan Ketua BEM', { ...sign, ...(await st()) });

  // misi 3: Danau Buatan, 5 penanda berantai
  for (let i = 0; i < 5; i += 1) {
    const goal = await page.evaluate(() => window.__sim.story.goalPoint());
    if (!goal) { note(`danau ${i + 1}`, { goal: null }); break; }
    await page.evaluate(([x, z]) => window.__sim.teleport(x, z, 0), [goal.x, goal.z]);
    await page.waitForTimeout(900);
    await advance();
    note(`danau ${i + 1}`, { goal: { x: Math.round(goal.x), z: Math.round(goal.z) }, ...(await st()) });
  }

  // misi 4: kipas sekre (hook interior M5 → story.onInteract)
  const door = await page.evaluate(() => ({ goal: window.__sim.story.goalPoint() }));
  await settleAt(page, { x: -222.3, z: 1097.3, yaw: -0.33, hour: 20, waitMs: 3000 });
  const inside = await page.evaluate(async () => {
    const s = window.__sim;
    s.portal.enter('sekre');
    for (let t = 0; t < 150 && s.portal.state !== 'inside'; t += 1) await new Promise((r) => setTimeout(r, 100));
    return s.portal.state;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'm7-story-sekre-kipas.jpg'), type: 'jpeg', quality: 85 });
  const fan = await page.evaluate(() => { window.__sim.story.onInteract('sekre:kipas'); return null; });
  await page.evaluate(async () => {
    const s = window.__sim;
    s.portal.exit();
    for (let t = 0; t < 150 && s.portal.state !== 'outside'; t += 1) await new Promise((r) => setTimeout(r, 100));
  });
  await advance();
  note('kipas sekre', { ...door, portal: inside, fan, ...(await st()) });
  sim.report = log;
  console.log(JSON.stringify({ log, errors: sim.errors }, null, 2));
} finally {
  await sim.close();
}
