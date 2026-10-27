/**
 * Cek overlay `?perf`: muat dengan ?perf, diam di kebun ±12 detik, tekan "Salin laporan", cetak JSON laporan, simpan bidikan.
 *   node tools/shots/perfOverlay.mjs [--out bidikan.png] [--wait 12000]
 */
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({ options: { out: { type: 'string', default: 'perf-overlay.png' }, wait: { type: 'string', default: '12000' } } });
const sim = await openSim({ query: '?perf' });
const { page } = sim;
try {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await page.evaluate(async () => { (await import('/src/app/session.js')).session.started = true; });
  await settleAt(page, { x: -168, z: 975, yaw: 0, hour: 10, waitMs: 3000 });
  await page.waitForTimeout(Number(v.wait));
  await page.click('#perf-overlay .perf-copy');
  await page.waitForTimeout(500);
  const text = await page.evaluate(async () => {
    const manual = document.querySelector('#perf-overlay .perf-manual');
    if (manual && !manual.hidden) return `[manual]\n${manual.value}`;
    return navigator.clipboard.readText();
  });
  console.log(await page.$eval('#perf-overlay .perf-lines', (el) => el.textContent));
  console.log(await page.$eval('#perf-overlay .perf-status', (el) => el.textContent));
  console.log(text);
  await page.screenshot({ path: v.out });
  if (sim.errors.length) console.log('galat:', sim.errors.slice(0, 5));
} finally {
  await sim.close();
}
process.exit(0);
