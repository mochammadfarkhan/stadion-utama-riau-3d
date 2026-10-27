/**
 * Profil CPU (CDP) 14 detik setelah teleport ke (x, z), preset Sedang dipasang sebelum muat (rencana performa Fase 2):
 * total CPU non-shader vs tunggu shader, segmen sibuk > 50 ms (≈ long task) beserta isinya per fungsi src terdekat,
 * rantai pemanggil noise/teks kanvas, dan biaya per berkas/fungsi src (inklusif three.js yang dipanggilnya).
 *   node tools/shots/cpuSegmen.mjs -150 973
 */
import process from 'node:process';
import { openSim, settleAt } from '../../tests/e2e/harness.unri.mjs';
const [x, z] = process.argv.slice(2).map(Number);
const sim = await openSim({ beforeGoto: async (pg) => pg.addInitScript(() => localStorage.setItem('sur3d.settings.v1', JSON.stringify({ 'graphics.preset': 'sedang' }))) });
const { page } = sim;
try {
  await settleAt(page, { x: 0, z: -275, yaw: 0, hour: 11, waitMs: 6000 });
  await page.waitForTimeout(5000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  await page.evaluate((p) => window.__sim.teleport(p.x, p.z, 0), { x, z });
  await page.waitForTimeout(14000);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parentOf = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parentOf.set(c, n.id);
  const own = new Map(); const fn = new Map(); let total = 0; let shader = 0;
  const srcOf = (id) => { for (let cur = id; cur !== undefined; cur = parentOf.get(cur)) { const f = byId.get(cur).callFrame; if (/\/src\//.test(f.url)) return [f.url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, ''), `${f.functionName || '(anon)'} @ ${f.url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`]; } return ['(luar src)', '(luar src)']; };
  profile.samples.forEach((id, i) => {
    const n = byId.get(id); const ms = (profile.timeDeltas[i] ?? 0) / 1000; const name = n.callFrame.functionName;
    if (name === '(idle)' || name === '(program)') return;
    if (name === 'getProgramInfoLog') { shader += ms; return; }
    total += ms;
    const [file, f] = srcOf(id);
    own.set(file, (own.get(file) ?? 0) + ms); fn.set(f, (fn.get(f) ?? 0) + ms);
  });
  // segmen sibuk berturut-turut (≈ long task): sampel non-idle beruntun; isi teratas per segmen
  const segs = []; let cur = null; let t = profile.startTime;
  profile.samples.forEach((id, i) => {
    t += profile.timeDeltas[i] ?? 0;
    const name = byId.get(id).callFrame.functionName;
    const busy = name !== '(idle)';
    if (busy) {
      if (!cur) cur = { start: t, end: t, fns: new Map() };
      cur.end = t;
      const ms = (profile.timeDeltas[i] ?? 0) / 1000;
      const so = srcOf(id)[1];
      const leaf = `${name || '(anon)'}<${(byId.get(id).callFrame.url || 'native').replace(/^.*\//, '').replace(/\?.*$/, '')}>`;
      const k = name === 'getProgramInfoLog' ? '[tunggu shader]' : name === '(program)' ? '[program/GC native]' : so === '(luar src)' ? `luar:${leaf}` : so;
      cur.fns.set(k, (cur.fns.get(k) ?? 0) + ms);
    } else if (cur) { segs.push(cur); cur = null; }
  });
  if (cur) segs.push(cur);
  const longSegs = segs.map((g) => ({ ms: (g.end - g.start) / 1000, fns: g.fns })).filter((g) => g.ms > 50).sort((a, b) => b.ms - a.ms).slice(0, 10);
  console.log('== segmen sibuk > 50 ms (terbesar) ==');
  for (const g of longSegs) console.log(`${String(Math.round(g.ms)).padStart(6)} ms: ` + [...g.fns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, ms]) => `${k} ${Math.round(ms)}`).join(' | '));
  const chains = new Map();
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    if (!/periodicNoise|fillPixels|fbm|latticeOf|fitFont|measureText/.test(n.callFrame.functionName)) return;
    const names = [];
    for (let c = parentOf.get(id); c !== undefined && names.length < 9; c = parentOf.get(c)) { const f = byId.get(c).callFrame; if (f.functionName && !/periodicNoise|fbm|latticeOf|noise/.test(f.functionName)) names.push(`${f.functionName}@${(f.url || '').replace(/^.*\//, '').replace(/\?.*$/, '')}`); }
    const k = `${n.callFrame.functionName} <- ${names.join(' <- ')}`;
    chains.set(k, (chains.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  });
  console.log('== rantai noise/teks ==' + String.fromCharCode(10) + [...chains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, ms]) => `${String(Math.round(ms)).padStart(5)} ms ${k}`).join(String.fromCharCode(10)));
  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, ms]) => `${String(Math.round(ms)).padStart(6)} ms  ${n}`).join(String.fromCharCode(10));
  console.log(`CPU non-shader ${Math.round(total)} ms, tunggu shader ${Math.round(shader)} ms`);
  console.log('== per berkas src (inklusif three yang dipanggil) ==' + String.fromCharCode(10) + top(own, 18));
  console.log('== per fungsi src ==' + String.fromCharCode(10) + top(fn, 22));
} finally { await sim.close(); }
process.exit(0);
