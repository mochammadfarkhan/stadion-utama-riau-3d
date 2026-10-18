#!/usr/bin/env node
/**
 * Smoke test E2E Plan C + Kampus UNRI M7 — TIDAK ikut `vitest run` (nama bukan *.test.js).
 *   node tests/e2e/smoke.e2e.mjs [--gpu swiftshader|d3d11] [--out laporan.json] [--skip-ride] [--skip-campus] [--only-campus]
 * Menjalankan Vite (port 5174) dari root repo, Chromium headless 1280×720 lewat paket `playwright` global
 * (npm i -g playwright; atau PLAYWRIGHT_PATH), lalu memeriksa:
 *   Kota (Plan C): 1. muat tanpa galat konsol; 2. draw call tile ≤ 150; 3. mount/unmount region stadion 3× →
 *   memori GPU kembali ke baseline; 4. rute sepeda 1,5 km ke 3 arah, hitch p95 < 50 ms (hanya --gpu d3d11);
 *   5. perjalanan cepat ke Masjid Raya An-Nur lalu kembali (kendaraan mangkal tetap, tidak terduplikasi).
 *   Kampus (spec UNRI §9, §11): titik ukur §9.2 (draw call/segitiga total, distrik, region hero, interior sekre,
 *   hitch); rute sepeda stadion → sekre ±1,15 km tanpa galat konsol + tanah tanpa jahitan; masuk/keluar sekre 3× dan
 *   mount/unmount region unri-lembaga 3× → memori kembali ke baseline; perjalanan cepat ke 2 tujuan kampus;
 *   ukuran data distrik & GLB kampus; tabel budget §9.1 (stderr + laporan JSON `budget`).
 * Exit code 0 = semua lulus. Kemajuan per tahap ditulis ke stderr, laporan JSON ke stdout.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5174;
const LIMITS = Object.freeze({
  tileCalls: 150, hitchP95Ms: 50, rideSpeed: 25, rideMeters: 1500,
  // spec UNRI §9.1
  districtCalls: 180, regionCalls: 250, totalCalls: 1000, districtTris: 600000,
  interiorCalls: 150, interiorTris: 150000, districtBytes: 8 * 1024 * 1024, glbBytes: 6 * 1024 * 1024,
  // rute kampus: kecepatan sepeda cepat (m/s) dan lompatan tinggi tanah maks per 2 m (jahitan/tebing)
  campusRideSpeed: 12, routeMaxJumpPer2m: 0.2, fastTravelDistance: 60,
});
/** Titik ukur spec UNRI §9.2 (dunia; yaw maju = (sin, cos)). `masjid` digeser keluar footprint (keputusan D11). */
const CAMPUS_POINTS = Object.freeze([
  { id: 'stadion-pusat', x: 0, z: 0, yaw: 0 },
  { id: 'jalan-stadion-kampus', x: -1, z: 500, yaw: 0 },
  { id: 'sekre-luar', x: -219, z: 1130, yaw: Math.PI },
  { id: 'interior-sekre', x: -219, z: 1130, yaw: Math.PI, interior: 'sekre' },
  { id: 'rektorat', x: -979, z: 860, yaw: Math.PI },
  { id: 'masjid', x: -1009, z: 1405, yaw: Math.PI },
]);
/** Rute sepeda stadion → sekre (±1,15 km): Jl. Stadion Utama, Jl. Muchtar Lutfi, jogging track Stadion Mini (OSM). */
const CAMPUS_ROUTE = Object.freeze([
  [0, 120], [-2, 272], [-2, 408], [0, 645], [0, 689], [-156, 706], [-150, 801], [-139, 959], [-138, 998],
  [-146, 1029], [-164, 1054], [-196, 1077], [-220, 1082],
]);
const CAMPUS_TRAVEL = Object.freeze([{ id: 'unri-sekre', x: -219, z: 1130 }, { id: 'unri-rektorat', x: -979, z: 860 }]);
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

const { values: opts } = parseArgs({
  options: {
    gpu: { type: 'string', default: 'swiftshader' },
    out: { type: 'string' },
    'skip-ride': { type: 'boolean', default: false },
    'skip-campus': { type: 'boolean', default: false },
    'only-campus': { type: 'boolean', default: false },
  },
});

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* coba kandidat berikutnya */ }
  }
  throw new Error('Paket playwright tidak ditemukan (npm i -g playwright, atau set PLAYWRIGHT_PATH)');
}

async function main() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  // fs.strict=false: worktree dengan node_modules berupa junction ke checkout utama (path di luar root).
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.swiftshader });
  const report = { gpu: opts.gpu, checks: {}, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) report.errors.push(`HTTP ${res.status()} ${res.url()}`); });
    const step = async (name, fn) => {
      const t0 = Date.now();
      process.stderr.write(`[e2e] ${name}…\n`);
      const v = await fn();
      process.stderr.write(`[e2e] ${name} selesai (${Math.round((Date.now() - t0) / 1000)} s)\n`);
      return v;
    };
    await step('muat halaman', () => page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 }));
    await step('tunggu __sim', () => page.waitForFunction(() => window.__sim?.app && window.__sim.city, null, { timeout: 240000 }));
    report.checks.load = await step('prepare', () => page.evaluate(PAGE.prepare));
    if (!opts['only-campus']) {
      report.checks.tileCalls = await step('tileCalls', () => page.evaluate(PAGE.tileCalls));
      report.checks.parity = await step('parity', () => page.evaluate(PAGE.parity));
      report.checks.memory = await step('memoryCycle', () => page.evaluate(PAGE.memoryCycle));
      if (!opts['skip-ride']) report.checks.ride = await step('ride', () => page.evaluate(PAGE.ride, LIMITS));
      report.checks.fastTravel = await step('fastTravel', () => page.evaluate(PAGE.fastTravel));
      report.checks.tileCallsAnNur = await step('tileCallsAnNur', () => page.evaluate(PAGE.tileCalls));
      report.checks.fastTravelBack = await step('fastTravelBack', () => page.evaluate(PAGE.fastTravelBack));
    }
    if (!opts['skip-campus']) await runCampus(page, step, report);
  } finally {
    await browser.close();
    await server.close();
  }
  if (!opts['skip-campus']) {
    report.budget = budgetTable(report);
    printBudget(report.budget, report.gpu);
  }
  const fails = verdict(report);
  report.fails = fails;
  const json = JSON.stringify(report, null, 2);
  if (opts.out) writeFileSync(opts.out, `${json}\n`);
  console.log(json);
  process.exitCode = fails.length ? 1 : 0;
}

/** Tahap kampus (spec UNRI §9.2, §11). */
async function runCampus(page, step, report) {
  report.checks.campusData = campusDataSizes();
  await step('tunggu kampus', () => page.waitForFunction(
    () => window.__sim?.district && window.__sim.regions && window.__sim.portal && window.__sim.regionIdAt, null, { timeout: 240000 },
  ));
  await page.evaluate(PAGE.installKampus);
  report.checks.campusPoints = [];
  for (const p of CAMPUS_POINTS) report.checks.campusPoints.push(await step(`titik ${p.id}`, () => page.evaluate(PAGE.campusPoint, p)));
  if (!opts['skip-ride']) {
    const before = report.errors.length;
    report.checks.campusRide = await step('rute stadion → sekre', () => page.evaluate(PAGE.campusRide, { route: CAMPUS_ROUTE, speed: LIMITS.campusRideSpeed }));
    report.checks.campusRide.consoleErrors = report.errors.length - before;
  }
  report.checks.interiorCycle = await step('siklus interior 3×', () => page.evaluate(PAGE.interiorCycle));
  report.checks.regionCycle = await step('siklus region 3×', () => page.evaluate(PAGE.regionCycle));
  report.checks.fastTravelCampus = await step('perjalanan cepat kampus', () => page.evaluate(PAGE.fastTravelCampus, CAMPUS_TRAVEL));
}

/** Ukuran berkas (byte) rekursif. */
function dirBytes(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? dirBytes(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
}

/** Data distrik (terrain + ground + buildings.json + manifest) dan total GLB kampus baru (spec §9.1). */
function campusDataSizes() {
  const district = join(ROOT, 'public', 'districts', 'unri');
  const models = join(ROOT, 'public', 'models', 'unri');
  return {
    districtBytes: existsSync(district) ? dirBytes(district) : null,
    glbBytes: existsSync(models)
      ? readdirSync(models).filter((f) => f.endsWith('.glb')).reduce((s, f) => s + statSync(join(models, f)).size, 0)
      : null,
  };
}

/** Tabel budget spec §9.1 dari laporan (nilai maks antar titik ukur). */
function budgetTable(r) {
  const c = r.checks;
  const pts = (c.campusPoints ?? []).filter((p) => !p.interior);
  const inter = (c.campusPoints ?? []).find((p) => p.interior);
  const max = (key) => (pts.length ? Math.max(...pts.map((p) => p[key])) : null);
  const regionMax = pts.length ? Math.max(0, ...pts.flatMap((p) => p.regions.map((g) => g.calls))) : null;
  const hitch = [...(c.campusPoints ?? []).map((p) => p.hitchP95), c.campusRide?.hitchP95].filter(Number.isFinite);
  const rows = [
    { metrik: 'Draw call distrik (terrain+ground+gedung+vegetasi)', batas: LIMITS.districtCalls, nilai: max('districtCalls') },
    { metrik: 'Draw call region hero aktif (maks)', batas: LIMITS.regionCalls, nilai: regionMax },
    { metrik: 'Draw call total', batas: LIMITS.totalCalls, nilai: max('totalCalls') },
    { metrik: 'Segitiga terlihat distrik', batas: LIMITS.districtTris, nilai: max('districtTris') },
    { metrik: 'Data distrik (byte)', batas: LIMITS.districtBytes, nilai: c.campusData?.districtBytes ?? null },
    { metrik: 'GLB kampus total (byte)', batas: LIMITS.glbBytes, nilai: c.campusData?.glbBytes ?? null },
    { metrik: 'Interior sekre draw call', batas: LIMITS.interiorCalls, nilai: inter?.calls ?? null },
    { metrik: 'Interior sekre segitiga', batas: LIMITS.interiorTris, nilai: inter?.tris ?? null },
    { metrik: 'Hitch p95 (ms, maks; hanya d3d11)', batas: LIMITS.hitchP95Ms, nilai: hitch.length ? Math.max(...hitch) : null },
  ];
  return rows.map((row) => ({
    ...row,
    lulus: row.nilai != null && (row.metrik.startsWith('Hitch') ? row.nilai < row.batas : row.nilai <= row.batas),
  }));
}

function printBudget(rows, gpu) {
  process.stderr.write(`[e2e] Budget spec UNRI §9.1 (gpu ${gpu}):\n`);
  for (const r of rows) process.stderr.write(`  ${r.lulus ? 'LULUS' : 'GAGAL'}  ${r.metrik}: ${r.nilai ?? '-'} (batas ${r.batas})\n`);
}

/** Daftar kegagalan dari laporan. */
function verdict(r) {
  const f = [];
  if (r.errors.length) f.push(`galat konsol: ${r.errors.length}`);
  if (!r.checks.load?.settled) f.push('tile sekitar stadion tidak selesai dimuat');
  if (!opts['only-campus']) f.push(...verdictCity(r));
  if (!opts['skip-campus']) f.push(...verdictCampus(r));
  return f;
}

/** Pemeriksaan kota Plan C (isi lama, tidak berubah). */
function verdictCity(r) {
  const f = [];
  const c = r.checks;
  if (!(c.tileCalls?.calls <= LIMITS.tileCalls)) f.push(`draw call tile ${c.tileCalls?.calls} > ${LIMITS.tileCalls}`);
  if (!(c.tileCallsAnNur?.calls <= LIMITS.tileCalls)) f.push(`draw call tile An-Nur ${c.tileCallsAnNur?.calls} > ${LIMITS.tileCalls}`);
  const m = c.memory;
  const back = (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  if (!m || !m.cycles.every(back)) f.push(`memori tidak kembali ke baseline: ${JSON.stringify(m)}`);
  if (c.ride && r.gpu === 'd3d11' && !(c.ride.hitchP95 < LIMITS.hitchP95Ms)) f.push(`hitch p95 ${c.ride.hitchP95} ms ≥ ${LIMITS.hitchP95Ms}`);
  if (c.ride && c.ride.failedTiles > 0) f.push(`tile gagal saat rute: ${c.ride.failedTiles}`);
  if (!c.fastTravel?.ok || !(c.fastTravel.distance < 250)) f.push(`perjalanan cepat An-Nur gagal: ${JSON.stringify(c.fastTravel)}`);
  const ret = c.fastTravelBack;
  if (!ret?.ok || !(ret.vehicles > 0) || ret.vehicles !== c.fastTravel?.vehiclesBefore) {
    f.push(`kembali ke stadion / kendaraan mangkal: ${JSON.stringify({ ret, before: c.fastTravel?.vehiclesBefore })}`);
  }
  return f;
}

/** Pemeriksaan kampus (spec UNRI §1 butir 1, 4, 5; §9; §11). */
function verdictCampus(r) {
  const f = [];
  const c = r.checks;
  const d = c.campusData;
  if (!(d?.districtBytes <= LIMITS.districtBytes)) f.push(`data distrik ${d?.districtBytes} B > ${LIMITS.districtBytes}`);
  if (!(d?.glbBytes <= LIMITS.glbBytes)) f.push(`GLB kampus ${d?.glbBytes} B > ${LIMITS.glbBytes}`);
  for (const p of c.campusPoints ?? []) {
    if (p.interior) {
      if (!p.entered || !p.exited) f.push(`${p.id}: masuk/keluar sekre gagal`);
      if (!p.bikeKept) f.push(`${p.id}: sepeda berpindah setelah keluar sekre`);
      if (!(p.calls <= LIMITS.interiorCalls)) f.push(`${p.id}: draw call ${p.calls} > ${LIMITS.interiorCalls}`);
      if (!(p.tris <= LIMITS.interiorTris)) f.push(`${p.id}: segitiga ${p.tris} > ${LIMITS.interiorTris}`);
    } else {
      if (!p.mounted) f.push(`${p.id}: region ${p.region} tidak terpasang`);
      if (!(p.totalCalls <= LIMITS.totalCalls)) f.push(`${p.id}: draw call total ${p.totalCalls} > ${LIMITS.totalCalls}`);
      if (!(p.districtCalls <= LIMITS.districtCalls)) f.push(`${p.id}: draw call distrik ${p.districtCalls} > ${LIMITS.districtCalls}`);
      if (!(p.districtTris <= LIMITS.districtTris)) f.push(`${p.id}: segitiga distrik ${p.districtTris} > ${LIMITS.districtTris}`);
      for (const g of p.regions) if (!(g.calls <= LIMITS.regionCalls)) f.push(`${p.id}: draw call region ${g.id} ${g.calls} > ${LIMITS.regionCalls}`);
    }
    if (r.gpu === 'd3d11' && !(p.hitchP95 < LIMITS.hitchP95Ms)) f.push(`${p.id}: hitch p95 ${p.hitchP95} ms ≥ ${LIMITS.hitchP95Ms}`);
  }
  const ride = c.campusRide;
  if (ride) {
    if (ride.consoleErrors > 0) f.push(`rute kampus: ${ride.consoleErrors} galat konsol`);
    if (ride.failedTiles > 0) f.push(`rute kampus: tile gagal ${ride.failedTiles}`);
    if (!(ride.maxGroundJump <= LIMITS.routeMaxJumpPer2m)) f.push(`rute kampus: lompatan tanah ${ride.maxGroundJump} m per 2 m > ${LIMITS.routeMaxJumpPer2m}`);
    if (r.gpu === 'd3d11' && !(ride.hitchP95 < LIMITS.hitchP95Ms)) f.push(`rute kampus: hitch p95 ${ride.hitchP95} ms`);
  }
  const back = (m) => (v) => v.geometries === m.baseline.geometries && v.textures === m.baseline.textures;
  const ic = c.interiorCycle;
  if (!ic || !ic.cycles.every((v) => v.entered && v.exited) || !ic.cycles.every(back(ic))) f.push(`siklus interior 3×: ${JSON.stringify(ic)}`);
  const rc = c.regionCycle;
  if (!rc || !rc.cycles.every((v) => v.unmounted && v.mounted) || !rc.cycles.every(back(rc))) f.push(`siklus region 3×: ${JSON.stringify(rc)}`);
  for (const t of CAMPUS_TRAVEL) {
    const v = c.fastTravelCampus?.[t.id];
    const regionOk = !v?.regionHere || v.mounted.includes(v.regionHere);
    if (!v || v.status !== 'ok' || !(v.distance <= LIMITS.fastTravelDistance) || !v.walkable || !regionOk) f.push(`perjalanan cepat ${t.id}: ${JSON.stringify(v)}`);
  }
  if (c.fastTravelCampus && c.fastTravelCampus.back !== 'ok') f.push(`kembali dari kampus ke stadion: ${c.fastTravelCampus.back}`);
  return f;
}

/** Fungsi yang dievaluasi di halaman (window.__sim dari src/app/devtools.js). */
const PAGE = {
  async prepare() {
    const s = window.__sim;
    s.rig.exitPov();
    s.store.set('sky.advanceTime', false);
    s.store.set('sky.hour', 12);
    s.store.set('weather.raining', false);
    s.store.set('camera.mode', 'third');
    s.teleport(0, -275, 0);
    const settled = await s.city.whenSettled(0, -275, 1000, 90000);
    await new Promise((r) => setTimeout(r, 2000));
    return { settled, stats: s.city.stats() };
  },
  /** Draw call milik tile = calls(semua) − calls(grup kota disembunyikan), frame yang sama. */
  tileCalls() {
    const s = window.__sim;
    const info = s.app.renderer.info.render;
    s.app.renderFrame();
    const all = info.calls;
    s.city.group.visible = false;
    s.app.renderFrame();
    const without = info.calls;
    s.city.group.visible = true;
    return { calls: all - without, total: all, triangles: s.city.stats().triangles };
  },
  /** Paritas kawasan stadion (snippet harness Plan A): rerata 60 frame, dengan & tanpa tile kota. */
  async parity() {
    const s = window.__sim;
    const sample = async () => {
      const calls = [];
      for (let i = 0; i < 60; i += 1) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        calls.push(s.app.renderer.info.render.calls);
      }
      return Math.round(calls.reduce((a, b) => a + b, 0) / calls.length);
    };
    const withCity = await sample();
    s.city.group.visible = false;
    const regionOnly = await sample();
    s.city.group.visible = true;
    return { callsMean: withCity, callsMeanRegionOnly: regionOnly, baselinePlanA: 502 };
  },
  /**
   * Siklus pasang/lepas region. Baseline diambil SETELAH satu siklus pemanasan: pada muat pertama model
   * GLB sudah siap sebelum frame pertama, sedangkan saat dipasang ulang versi prosedural cadangan
   * (tugu, serindit) sempat tergambar (terunggah ke GPU) sebelum GLB tiba — selisih tetap, bukan bocor.
   * Sebelum tiap snapshot semua level LOD humanoid (detail penuh + mesh gabungan, tanpa frustum culling)
   * dirender sekali: geometri diunggah ke GPU saat pertama tergambar, jadi pelari (`runner-*`, entitas
   * non-region) yang baru melintasi ambang LOD di tengah siklus tidak lagi menaikkan hitungan.
   */
  async memoryCycle() {
    const s = window.__sim;
    const warmHumanoids = () => {
      const saved = [];
      const force = (o, key, value) => { saved.push([o, key, o[key]]); o[key] = value; };
      s.app.scene.traverse((o) => {
        const info = o.userData?.humanoidLod;
        if (!info) return;
        force(o, 'visible', true); // kolam mahasiswa M7 (grup tersembunyi) ikut terunggah ke GPU
        for (const part of [info.body, info.mesh]) {
          force(part, 'visible', true);
          part.traverse((m) => { if (m.isMesh) force(m, 'frustumCulled', false); });
        }
      });
      s.app.renderFrame();
      for (let i = saved.length - 1; i >= 0; i -= 1) saved[i][0][saved[i][1]] = saved[i][2];
    };
    const snap = async () => {
      warmHumanoids();
      for (let i = 0; i < 5; i += 1) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const m = s.app.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    };
    const initial = await snap();
    await s.remountRegion(); // pemanasan
    const baseline = await snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) {
      await s.remountRegion();
      cycles.push(await snap());
    }
    return { initial, baseline, cycles, after: cycles[cycles.length - 1] };
  },
  /** Kendarai sepeda di garis lurus (posisi diset per frame) ke 3 arah; ukur selang frame. */
  async ride({ rideSpeed, rideMeters }) {
    const s = window.__sim;
    const dirs = [[0, -1], [1, 0], [-Math.SQRT1_2, Math.SQRT1_2]];
    const deltas = [];
    const perDir = [];
    for (const [dx, dz] of dirs) {
      const from = deltas.length;
      s.teleport(0, -275, Math.atan2(dx, dz));
      await s.city.whenSettled(0, -275, 600, 60000);
      await new Promise((resolve) => {
        let last = performance.now();
        let dist = 0;
        const step = (now) => {
          const dt = Math.min(0.1, (now - last) / 1000);
          deltas.push(now - last);
          last = now;
          dist += rideSpeed * dt;
          const st = s.ents.bike.state;
          s.ents.bike.state = { ...st, x: dx * dist, z: -275 + dz * dist, yaw: Math.atan2(dx, dz), v: 0 };
          if (dist < rideMeters) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      const d = deltas.slice(from);
      perDir.push({ dir: [dx, dz].map((v) => Math.round(v * 100) / 100), frames: d.length, hitchP95: Math.round(percentile(d, 0.95)), maxMs: Math.round(Math.max(...d)) });
    }
    const st = s.city.stats();
    return {
      frames: deltas.length, hitchP95: Math.round(percentile(deltas, 0.95)), maxMs: Math.round(Math.max(...deltas)), failedTiles: st.failed, perDir,
    };
    function percentile(arr, p) {
      const v = [...arr].sort((a, b) => a - b);
      return v[Math.min(v.length - 1, Math.floor(p * v.length))];
    }
  },
  async fastTravel() {
    const s = window.__sim;
    const area = s.city.manifest.areas.find((a) => a.id === 'pusat');
    const cx = (area.bounds.minX + area.bounds.maxX) / 2;
    const cz = (area.bounds.minZ + area.bounds.maxZ) / 2;
    let vehiclesBefore = 0;
    s.app.scene.traverse((o) => { if (o.name.startsWith('kendaraan:')) vehiclesBefore += 1; });
    const t0 = performance.now();
    const status = await s.fastTravel('annur'); // 'ok' | 'timeout' | 'busy' | 'unknown'
    const travelMs = Math.round(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 1500));
    const b = s.ents.bike.state;
    const loaded = s.city.streamer.keys('loaded');
    return {
      ok: status === 'ok', status, travelMs, distance: Math.round(Math.hypot(b.x - cx, b.z - cz)), walkable: s.city.collider.isWalkable(b.x, b.z),
      pusatTiles: loaded.filter((k) => Number(k.split('_')[0]) >= 12).length, overlayHidden: document.getElementById('travel-screen')?.classList.contains('hidden'),
      vehiclesBefore,
    };
  },
  /** Kembali ke stadion: kendaraan mangkal (amandemen Task 18b) tetap ada & tidak terduplikasi. */
  async fastTravelBack() {
    const s = window.__sim;
    const t0 = performance.now();
    const status = await s.fastTravel('stadion');
    const travelMs = Math.round(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 1500));
    let vehicles = 0;
    s.app.scene.traverse((o) => { if (o.name.startsWith('kendaraan:')) vehicles += 1; });
    return { ok: status === 'ok', status, travelMs, vehicles };
  },
  /** Helper kampus di window.__e2eKampus (fungsi PAGE diserialisasi; tidak berbagi closure Node). */
  installKampus() {
    const s = window.__sim;
    const raf = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, timeoutMs) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeoutMs) {
        if (fn()) return true;
        await sleep(100);
      }
      return Boolean(fn());
    };
    const k = {
      raf, sleep, until,
      async settle(x, z, yaw) {
        s.teleport(x, z, yaw);
        await raf();
        if (s.city) await s.city.whenSettled(x, z, 1000, 90000);
        if (s.district?.whenSettled) await s.district.whenSettled(x, z);
        const id = s.regionIdAt(x, z);
        const mounted = id ? await until(() => s.regions.active().some((a) => a.def.id === id), 30000) : true;
        const hit = id ? s.regions.active().find((a) => a.def.id === id) : null;
        if (hit) await Promise.resolve(hit.region?.ready);
        if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
        await sleep(1500);
        return { region: id, mounted };
      },
      draw() {
        s.app.renderFrame();
        const i = s.app.renderer.info.render;
        return { calls: i.calls, tris: i.triangles };
      },
      hidden(objs, fn) {
        const saved = objs.map((o) => [o, o.visible]);
        objs.forEach((o) => { o.visible = false; });
        try {
          return fn();
        } finally {
          saved.forEach(([o, v]) => { o.visible = v; });
        }
      },
      /** Draw call & segitiga: total, distrik inti (tanpa kehidupan kampus), kehidupan kampus, per region hero. */
      measure() {
        const all = k.draw();
        const life = s.district.district.life?.group;
        const noLife = life ? k.hidden([life], k.draw) : all;
        const noDistrict = k.hidden([s.district.district.group], k.draw);
        const regions = s.regions.active().filter((a) => a.def.id !== 'stadion').map((a) => {
          const r = k.hidden([s.app.scene.getObjectByName(`region:${a.def.id}`)].filter(Boolean), k.draw);
          return { id: a.def.id, calls: all.calls - r.calls, tris: all.tris - r.tris };
        });
        return {
          totalCalls: all.calls, totalTris: all.tris,
          districtCalls: noLife.calls - noDistrict.calls, districtTris: noLife.tris - noDistrict.tris,
          lifeCalls: all.calls - noLife.calls, lifeTris: all.tris - noLife.tris, regions,
        };
      },
      async p95(n = 120) {
        const d = [];
        let last = performance.now();
        for (let i = 0; i < n; i += 1) {
          await new Promise((r) => requestAnimationFrame(r));
          const now = performance.now();
          d.push(now - last);
          last = now;
        }
        d.sort((a, b) => a - b);
        return Math.round(d[Math.min(d.length - 1, Math.floor(0.95 * d.length))]);
      },
      warmHumanoids() {
        const saved = [];
        const force = (o, key, value) => { saved.push([o, key, o[key]]); o[key] = value; };
        s.app.scene.traverse((o) => {
          const info = o.userData?.humanoidLod;
          if (!info) return;
          force(o, 'visible', true);
          for (const part of [info.body, info.mesh]) {
            force(part, 'visible', true);
            part.traverse((m) => { if (m.isMesh) force(m, 'frustumCulled', false); });
          }
        });
        s.app.renderFrame();
        for (let i = saved.length - 1; i >= 0; i -= 1) saved[i][0][saved[i][1]] = saved[i][2];
      },
      async snap() {
        k.warmHumanoids();
        for (let i = 0; i < 5; i += 1) await raf();
        const m = s.app.renderer.info.memory;
        return { geometries: m.geometries, textures: m.textures };
      },
      async enterSekre() {
        s.portal.enter('sekre');
        return until(() => s.portal.state === 'inside', 15000);
      },
      async exitSekre() {
        s.portal.exit();
        return until(() => s.portal.state === 'outside', 15000);
      },
    };
    window.__e2eKampus = k;
    return true;
  },
  /** Satu titik ukur §9.2: luar = draw call/segitiga per lapisan + hitch; interior = draw call/segitiga sekre. */
  async campusPoint(p) {
    const s = window.__sim;
    const k = window.__e2eKampus;
    const at = await k.settle(p.x, p.z, p.yaw);
    if (p.interior) {
      const bike = { x: s.ents.bike.state.x, z: s.ents.bike.state.z };
      const entered = await k.enterSekre();
      await k.sleep(1000);
      const m = k.draw();
      const hitchP95 = await k.p95();
      const exited = await k.exitSekre();
      const b = s.ents.bike.state;
      return {
        id: p.id, interior: true, entered, exited, calls: m.calls, tris: m.tris, hitchP95,
        bikeKept: Math.hypot(b.x - bike.x, b.z - bike.z) < 0.5,
      };
    }
    return { id: p.id, ...at, ...k.measure(), hitchP95: await k.p95(), life: s.district.district.life?.students?.stats ?? null, motor: s.district.district.life?.motors?.stats ?? null };
  },
  /** Rute sepeda stadion → sekre (posisi diset per frame); tinggi tanah dicatat tiap 2 m selama rute (jahitan). */
  async campusRide({ route, speed }) {
    const s = window.__sim;
    const k = window.__e2eKampus;
    const cum = [0];
    for (let i = 1; i < route.length; i += 1) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const total = cum[cum.length - 1];
    const at = (d) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i += 1;
      const a = route[i - 1];
      const b = route[i];
      const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    };
    const p0 = at(0);
    await k.settle(p0.x, p0.z, p0.yaw);
    const deltas = [];
    let maxJump = 0;
    let prevY = null;
    let nextMark = 0;
    await new Promise((resolve) => {
      let last = performance.now();
      let dist = 0;
      const tick = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        deltas.push(now - last);
        last = now;
        dist += speed * dt;
        const p = at(Math.min(dist, total));
        s.ents.bike.state = { ...s.ents.bike.state, x: p.x, z: p.z, yaw: p.yaw, v: 0 };
        while (nextMark <= Math.min(dist, total)) {
          const q = at(nextMark);
          const y = s.terrain?.heightAt(q.x, q.z) ?? 0;
          if (prevY !== null) maxJump = Math.max(maxJump, Math.abs(y - prevY));
          prevY = y;
          nextMark += 2;
        }
        if (dist < total) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    return {
      meters: Math.round(total), frames: deltas.length, hitchP95: Math.round(sorted[Math.floor(0.95 * sorted.length)]),
      maxMs: Math.round(sorted[sorted.length - 1]), maxGroundJump: Number(maxJump.toFixed(2)), failedTiles: s.city?.stats().failed ?? 0,
    };
  },
  /** Masuk/keluar sekre 3× setelah satu siklus pemanasan → memori GPU kembali ke baseline (spec §9.1). */
  async interiorCycle() {
    const k = window.__e2eKampus;
    await k.settle(-219, 1130, Math.PI);
    const cycle = async () => {
      const entered = await k.enterSekre();
      await k.sleep(800);
      const exited = await k.exitSekre();
      await k.sleep(500);
      return { entered, exited, ...(await k.snap()) };
    };
    const initial = await k.snap();
    await cycle(); // pemanasan: aset interior pernah dimuat sekali
    const baseline = await k.snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) cycles.push(await cycle());
    return { initial, baseline, cycles };
  },
  /** Region unri-lembaga dilepas (fokus jauh) lalu dipasang ulang 3× → memori di titik yang sama kembali ke baseline. */
  async regionCycle() {
    const s = window.__sim;
    const k = window.__e2eKampus;
    const home = [-219, 1130, Math.PI];
    const away = [0, -275, 0];
    const lembagaActive = () => s.regions.active().some((a) => a.def.id === 'unri-lembaga');
    const cycle = async () => {
      await k.settle(...away);
      const unmounted = await k.until(() => !lembagaActive(), 20000);
      await k.settle(...home);
      return { unmounted, mounted: lembagaActive(), ...(await k.snap()) };
    };
    await k.settle(...home);
    await cycle(); // pemanasan: semua jalur muat/lepas (tile, chunk distrik, region) pernah dilalui sekali
    const baseline = await k.snap();
    const cycles = [];
    for (let i = 0; i < 3; i += 1) cycles.push(await cycle());
    return { baseline, cycles };
  },
  /** Perjalanan cepat ke 2 tujuan kampus lalu kembali ke stadion. */
  async fastTravelCampus(targets) {
    const s = window.__sim;
    const out = {};
    for (const t of targets) {
      const t0 = performance.now();
      const status = await s.fastTravel(t.id);
      await new Promise((r) => setTimeout(r, 1500));
      const b = s.ents.bike.state;
      out[t.id] = {
        status, travelMs: Math.round(performance.now() - t0), distance: Math.round(Math.hypot(b.x - t.x, b.z - t.z)),
        walkable: s.colliders.isWalkable(b.x, b.z), regionHere: s.regionIdAt(t.x, t.z), mounted: s.regions.active().map((a) => a.def.id),
      };
    }
    out.back = await s.fastTravel('stadion');
    return out;
  },
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
