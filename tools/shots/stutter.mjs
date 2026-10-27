/**
 * Ukur lag sesaat (rencana performa Fase 2) per momen permainan: long task (PerformanceObserver 'longtask'), jeda frame
 * > 50 ms, jumlah program shader BARU (renderer.info.programs), dan SUMBER kompilasi yang membekukan frame (objek yang
 * sedang digambar saat gl.getProgramInfoLog > 50 ms — dibungkus hanya di skrip ini).
 * Langkah: diam di stadion → teleport ke kebun (region + distrik + model kebun) → traktor (F) → jalan kaki (F) → buka tas
 * (I) → cangkul pertama (E, partikel) → rektorat → masjid → An-Nur (tile kota) → kembali ke stadion.
 *   node tools/shots/stutter.mjs [--json keluaran.json] [--query ?nowarm]   (preset Sedang dipasang sebelum muat)
 */
import process from 'node:process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({ options: { json: { type: 'string', default: '' }, query: { type: 'string', default: '' } } });
const sim = await openSim({
  query: v.query,
  beforeGoto: async (page) => page.addInitScript(() => {
    localStorage.removeItem('stadion.kebun.v1');
    localStorage.removeItem('stadion.inventory.v1');
    // preset tetap SEBELUM muat: ganti preset di tengah jalan mengubah kunci program semua material (bayangan) → ukuran kotor
    localStorage.setItem('sur3d.settings.v1', JSON.stringify({ 'graphics.preset': 'sedang' }));
    window.__lt = [];
    window.__gaps = [];
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__lt.push([e.startTime, e.duration]); })
        .observe({ type: 'longtask', buffered: true });
    } catch { /* tanpa dukungan longtask */ }
    let last = performance.now();
    const tick = (t) => { if (t - last > 50) window.__gaps.push([last, t - last]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }),
});
const { page } = sim;
const rows = [];
const key = async (k, wait = 250) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const tp = (x, z, yaw = 0) => page.evaluate((p) => window.__sim.teleport(p.x, p.z, p.yaw), { x, z, yaw });

async function step(name, action, waitMs) {
  const t0 = await page.evaluate(() => ({ t: performance.now(), prog: window.__sim.app.renderer.info.programs.length }));
  await action();
  await page.waitForTimeout(waitMs);
  const r = await page.evaluate((s) => {
    const t1 = performance.now();
    const lt = window.__lt.filter(([t]) => t >= s.t && t <= t1).map(([, d]) => d);
    const gaps = window.__gaps.filter(([t]) => t >= s.t && t <= t1).map(([, d]) => d);
    const pr = window.__sim.app.renderer.info.programs.length;
    return {
      longTasks: lt.length, longMax: Math.round(Math.max(0, ...lt)), longSum: Math.round(lt.reduce((a, b) => a + b, 0)),
      gaps: gaps.length, gapMax: Math.round(Math.max(0, ...gaps)), newPrograms: pr - s.prog, programs: pr,
      stalls: (window.__stalls ?? []).filter(([t]) => t >= s.t && t <= t1).map(([, d]) => d),
    };
  }, t0);
  rows.push({ step: name, ...r });
  console.log(`${name.padEnd(22)} long ${String(r.longTasks).padStart(3)} max ${String(r.longMax).padStart(5)} ms sum ${String(r.longSum).padStart(6)} ms | jeda>50 ${String(r.gaps).padStart(3)} max ${String(r.gapMax).padStart(5)} ms | shader baru ${r.newPrograms} (total ${r.programs})`);
  for (const d of r.stalls.slice(0, 6)) console.log(`    stall shader: ${d}`);
}

try {
  await settleAt(page, { x: 0, z: -275, yaw: 0, hour: 11, waitMs: 6000 });
  await page.evaluate(async () => {
    (await import('/src/app/session.js')).session.started = true;
  });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { // pencatat stall shader: objek yang digambar ketika driver menunggu kompilasi
    const r = window.__sim.app.renderer;
    const gl = r.getContext();
    const path = (o) => { const a = []; for (let c = o; c && a.length < 4; c = c.parent) a.push(c.name || c.type); return a.reverse().join('/'); };
    let last = null;
    const draw = r.renderBufferDirect.bind(r);
    r.renderBufferDirect = (cam, scene, geo, mat, obj, grp) => { last = { mat, obj }; return draw(cam, scene, geo, mat, obj, grp); };
    const log = gl.getProgramInfoLog.bind(gl);
    window.__stalls = [];
    gl.getProgramInfoLog = (prog) => {
      const t = performance.now();
      const out = log(prog);
      const ms = performance.now() - t;
      if (ms > 50 && last) window.__stalls.push([t, `${Math.round(ms)} ms ${last.mat.type}:${last.mat.name}${last.obj.isInstancedMesh ? ' inst' : last.obj.isBatchedMesh ? ' batch' : ''} <- ${path(last.obj)}`]);
      return out;
    };
  });
  const annur = await page.evaluate(() => {
    const a = window.__sim.city?.manifest?.areas?.find((x) => x.id === 'pusat');
    return a ? { x: (a.bounds.minX + a.bounds.maxX) / 2, z: (a.bounds.minZ + a.bounds.maxZ) / 2 } : null;
  });
  await step('diam stadion', async () => {}, 5000);
  await step('teleport kebun', () => tp(-150, 973, -Math.PI / 2), 10000);
  await step('traktor pertama (F)', () => key('KeyF'), 3000);
  await step('jalan kaki (F)', () => key('KeyF'), 3000);
  await step('buka tas (I)', async () => { await key('KeyI', 800); await key('Escape'); }, 1500);
  await step('cangkul pertama (E)', async () => { await tp(-153.5, 969, -Math.PI / 2); await page.waitForTimeout(400); await key('KeyE'); }, 2500);
  await step('teleport rektorat', () => tp(-905, 805), 10000);
  await step('teleport masjid', () => tp(-1010, 1334), 10000);
  if (annur) await step('teleport An-Nur', () => tp(annur.x, annur.z), 15000);
  await step('kembali stadion', () => tp(0, -275), 12000);
  await step('diam stadion 2', async () => {}, 5000);
  if (v.json) writeFileSync(v.json, JSON.stringify({ date: new Date().toISOString(), gpu: await page.evaluate(() => JSON.parse(localStorage.getItem('sur3d.quality.v1') ?? 'null')?.gpu ?? null), rows }, null, 1));
  console.log('errors', sim.errors);
} finally {
  await sim.close();
}
process.exit(0);
