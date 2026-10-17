# M0 Fondasi Multi-Region — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti asumsi "satu region stadion" di composition root dengan fondasi multi-region (spec UNRI §4.3–§4.5, §12 baris M0): `regionManager` (region persistent + region streaming ber-histeresis + proxy, LIFO, maks 1 mount/0,5 s), `scheduler` time-sliced ≤ 4 ms/frame, `terrainService` stub datar, kontrak `Region` diperluas (`activation`, `proxy`, `povs`, `pads`), titik cerita ber-region + save v3, minimap satu base layer per region, POV dari region aktif — **tanpa mengubah tampilan/perilaku stadion** (paritas draw call ±2 %).

**Architecture:** `src/app/regionManager.js` menjadi pemilik tunggal region terpasang; ia memanggil `mountRegion` (kini menyuntik `ctx.terrain`, `ctx.heightAtLocal`, `ctx.schedule`) dan memperbarui collider komposit dinamis (`createDynamicCompositeCollider`), base layer minimap (`Minimap2D.setBaseLayer`), proxy, dan event `mount`/`unmount`. `StoryDirector` bekerja di koordinat dunia: data cerita (titik tanpa `region` = `'stadion'`) di-resolve sekali lewat `frameOf(regionId)` (`src/story/points.js`, `src/story/storyWorld.js`). POV region memakai tombol baru `Digit8` dan sumber `povSource.regionPov(i)` dari `regions.active()`. Region uji `dummy` (`src/app/dummyRegion.js`) membuktikan streaming/proxy/POV/minimap/scheduler di tes dan di mode dev `?dummyRegion=1`; stadion menjadi region `activation:{persistent:true}` tanpa perubahan isi.

**Tech Stack:** Three.js 0.186, Vite 8, Vitest 5, Node ≥ 20

---

## Konvensi eksekusi (mengikat, dari indeks)

- Satu implementer untuk seluruh M0; satu review di akhir tonggak. TDD (tes → gagal → implementasi → lulus) untuk logika murni/berisiko: `scheduler`, `regionManager` (histeresis/LIFO/maks mount per 0,5 s), `points.js`/`storyWorld.js`, migrasi save v2→v3, validasi `Region`, plus konversi koordinat cerita. Wiring (`main.js`, `Minimap2D`, POV) = kode lengkap + smoke (Playwright GPU) + kriteria visual.
- Tes satu berkas: `node node_modules/vitest/vitest.mjs run <path>`; seluruh suite: `node node_modules/vitest/vitest.mjs run` (bukan `npx`).
- Lint: `npm run lint` (0 error, tanpa warning baru). Build: `npm run build`. E2E: `npm run e2e -- --gpu d3d11`.
- Commit: **dua perintah terpisah** — `git add <berkas…>` lalu `git commit -m "<pesan>"` (hook `block-no-verify` memblokir perintah gabungan). `git add` berkas eksplisit, jangan `-A` (`.claude/launch.json` yang termodifikasi milik user, jangan ikut di-commit).
- Bahasa Indonesia untuk kode/komentar/pesan commit/teks UI. Conventional commits.
- Nomor baris `path:line` merujuk isi berkas **sebelum task itu** (setelah task sebelumnya selesai). Bila bergeser, cocokkan berdasarkan potongan teks yang dikutip.
- Bila langkah rencana salah terhadap kode nyata: perbaiki seminimal mungkin dan CATAT penyimpangan (berkas, rencana, yang dilakukan, alasan) di laporan akhir tonggak. Jangan menambah fitur di luar rencana.
- Setiap commit: tes berkas yang disentuh + lint hijau. Seluruh suite wajib hijau di Task 10, 12, 14, 16.

## Prasyarat & verifikasi awal

- Branch `feat/unri-kampus` (HEAD saat plan ditulis: `dd3f295` + commit plan). Tree bersih kecuali `.claude/launch.json` (milik user, biarkan).
- Baseline terukur saat plan ditulis (2026-10-17, mesin user):
  - `node node_modules/vitest/vitest.mjs run` → **Test Files 106 passed (106), Tests 857 passed (857)** (lari pertama di mesin sibuk sempat 104/837 + 2 error timeout; lari ulang hijau — bila terjadi, ulangi sekali).
  - `npm run lint` → exit 0. `npm run build` → `✓ built in ~4 s`.
- Playwright global ada di `%APPDATA%\npm\node_modules\playwright` (dipakai `tests/e2e/smoke.e2e.mjs`). GPU: `--gpu d3d11` (RTX 3050 Laptop). Port: dev 5173, smoke 5174, alat screenshot baru 5175.
- Angka paritas draw call **diukur di Task 1** (sebelum perubahan kode apa pun) dengan `tests/e2e/smoke.e2e.mjs` pemeriksaan `parity` (rerata 60 frame, titik (0, −275), jam 12, dengan & tanpa tile kota) dan disimpan ke `docs/screenshots/unri/m0-baseline-e2e.json`. Acuan historis Plan A (SwiftShader): callsMean ±502.
- **Verifikasi plan (2026-10-17, sebelum diserahkan):** seluruh kode plan ini diterapkan ke salinan sementara HEAD (di luar repo) lalu dijalankan: suite 924 tes lulus, lint 0, build sukses (region dummy tidak ikut bundel produksi), E2E `--gpu d3d11 --skip-ride` lulus dengan paritas `callsMean` 524 → 524 dan `callsMeanRegionOnly` 458 → 457 (−0,2 %), siklus `remountRegion` memori kembali ke baseline, siklus dummy 3× di browser memori GPU kembali ke baseline, screenshot dummy/POV/placement sesuai kriteria Task 15. Angka di mesin eksekutor bisa sedikit berbeda; yang mengikat adalah perbandingan Task 1 ↔ Task 16.
- Kriteria akhir M0 (spec §12): paritas `callsMean` & `callsMeanRegionOnly` ±2 % vs baseline Task 1; semua tes lama lulus (kecuali asersi versi save yang sengaja diubah di Task 11–12, tercatat); lint 0; build sukses; region kedua (dummy) didaftarkan & di-mount/unmount 3× tanpa bocor (tes Task 10); save v2 termigrasi ke v3 (tes Task 11).

## Struktur file

**Baru**

| Berkas | Task | Tanggung jawab |
|---|---|---|
| `tests/e2e/shot.mjs` | 1 | Alat screenshot titik ukur (Playwright GPU, Vite port 5175) + statistik `renderer.info`; dipakai semua tonggak UNRI. |
| `docs/screenshots/unri/m0-baseline-e2e.json`, `m0-sebelum-stadion-pusat.jpg` | 1 | Baseline paritas & visual sebelum perubahan. |
| `src/engine/scheduler.js` | 2 | `createScheduler`, `runTaskNow`, `DEFAULT_BUDGET_MS` (antrean time-sliced FIFO, owner, cancel, whenIdle). |
| `src/story/points.js` | 3 | `normalizePoint`, `resolvePoint`, `localizePoint`, `DEFAULT_REGION`, `WORLD_REGION` (murni). |
| `src/story/storyWorld.js` | 3 | `resolveChapters`, `resolveNpcs`, `resolveEggs`, `resolveAnchors` (data cerita → dunia, murni). |
| `src/app/terrainService.js` | 4 | Stub: `FLAT_TERRAIN`, `createTerrainService()` (M1 mengisi HeightField nyata). |
| `src/app/dummyRegion.js` | 9 | `createDummyRegion(opts)`, `DUMMY_REGION_ID`, `DUMMY_HALF`, `DUMMY_BOXES` — region uji streaming/proxy/POV/scheduler. |
| `src/app/regionManager.js` | 10 | `createRegionManager` (kontrak spec §4.4 + `handleOf`, `attachMinimap`, `remount`, `flush`), `MOUNT_INTERVAL_MS`, `MOUNT_RETRY_MS`, `PROXY_MAX_MESHES`, `MINIMAP_BAKE_MARGIN`. |
| `tests/scheduler.test.js`, `tests/storyPoints.test.js`, `tests/terrainService.test.js`, `tests/dummyRegion.test.js`, `tests/regionManager.test.js`, `tests/regionPov.test.js` | 2–13 | Tes modul baru. |

**Diubah**

| Berkas | Task | Perubahan |
|---|---|---|
| `src/regions/Region.js` | 5 | Validasi + normalisasi `activation`, `proxy`, `povs`, `pads`; `DEFAULT_MOUNT_RADIUS`, `DEFAULT_UNMOUNT_RADIUS`. |
| `src/regions/stadion/index.js:58-63` | 5 | `activation: { persistent: true }`. |
| `src/app/mountRegion.js` | 6 | ctx `terrain` (default `FLAT_TERRAIN`), `heightAtLocal`, `schedule`; opsi `scheduler`; `ready` menunggu antrean region; unmount membatalkan antrean. |
| `src/core/Collider.js` | 7 | `createDynamicCompositeCollider({ fallback })` (region & fallback dapat diganti; fungsi stabil). |
| `src/shared/minimapMath.js` | 8 | `layerInView`, `layerTransform`. |
| `src/ui/Minimap2D.js` | 8 | `setBaseLayer(id, canvas, {center, half, yaw})`, `removeBaseLayer(id)`, alias `setBase` → id `'stadion'`. |
| `src/story/storage.js` | 11 | `SAVE_VERSION = 3`, `migrateV2`, `sanitizePlace`; v1 → v2 → v3. |
| `src/story/eggTriggers.js` | 12 | `EGG_ANCHORS` + `ctx.anchors` (titik jangkar dunia). |
| `src/sim/story/objectives.js:12-14` | 12 | `goto` dengan target `null` (region tak dikenal) tidak pernah selesai. |
| `src/core/StoryDirector.js` | 12 | Koordinat dunia; deps `frameOf`, `placeOf`; `savedPlace`; save v3 menyimpan `place`. |
| `src/core/cameraPresets.js` | 13 | POV `region` (`Digit8`, kind `'region'`), `povPose` case `'region'`. |
| `src/core/povSource.js` | 13 | Opsi `{ regions }`; `regionPovCount()`, `regionPov(i)`. |
| `src/core/PovDirector.js` | 13 | `label` POV region = label POV subjek. |
| `src/core/CameraRig.js:137-157` | 13 | Jumlah subjek POV region; toast memakai `director.label`. (Deviasi: tidak ada di indeks, lihat Self-review.) |
| `index.html:34` | 13 | Petunjuk kontrol "1–8". |
| `src/app/keymap.js:9,13,28` | 14 | Interaksi cerita di koordinat dunia (tanpa `pointToLocal`). |
| `src/app/devtools.js` | 14 | `parseFlagParam`; `__sim.regions/scheduler/terrain`. |
| `src/main.js` | 14 | `regionManager` + `scheduler.update()` di loop + terrain stub + collider dinamis + cerita/POV/minimap per region. |
| `tests/region.test.js`, `tests/mountRegion.test.js`, `tests/compositeCollider.test.js`, `tests/minimapMath.test.js`, `tests/storyStorage.test.js`, `tests/storyDirector.test.js` | 5–12 | Tes tambahan; asersi versi save 2 → 3 (sengaja). |
| `docs/superpowers/plans/2026-10-17-unri-00-index.md` | 16 | Baris status M0. |

`eslint.config.js`: **tidak berubah** (sesuai indeks). Semua impor baru mematuhi aturan lapisan yang ada: `engine` tanpa impor lapisan lain; `story` hanya geo/config/shared/sim; `core` boleh `story`/`geo`; `app` bebas.

---

## Task 0: Verifikasi awal (tanpa commit)

**Files:** tidak ada.

- [ ] **Step 1: Tree & branch**

```bash
git status --short
```
Expected: hanya ` M .claude/launch.json` (milik user) dan, bila belum di-commit, berkas plan `docs/superpowers/plans/2026-10-17-unri-*.md`. Bila ada berkas lain (terutama di `src/` atau `tests/`): BERHENTI, tanyakan user.

```bash
git branch --show-current
```
Expected: `feat/unri-kampus`.

- [ ] **Step 2: Suite, lint, build**

```bash
node node_modules/vitest/vitest.mjs run
```
Expected: `Test Files  106 passed (106)` dan `Tests  857 passed (857)`. Catat angka aktual (bila berbeda karena commit lain, angka aktual menjadi baseline).

```bash
npm run lint
```
Expected: exit 0, tanpa keluaran error.

```bash
npm run build
```
Expected: `✓ built in` … tanpa error.

---

## Task 1: Alat screenshot titik ukur + baseline paritas & visual

**Files:**
- Create: `tests/e2e/shot.mjs`
- Create (keluaran): `docs/screenshots/unri/m0-baseline-e2e.json`, `docs/screenshots/unri/m0-sebelum-stadion-pusat.jpg`

- [ ] **Step 1: Tulis alat screenshot** — buat `tests/e2e/shot.mjs`:

```js
#!/usr/bin/env node
/**
 * Screenshot titik ukur (Playwright, GPU nyata) untuk dokumentasi per tonggak UNRI — TIDAK ikut vitest
 * (nama bukan *.test.js).
 *   node tests/e2e/shot.mjs --out docs/screenshots/unri/m0-stadion-pusat.jpg --at 0,-275,0
 *     [--hour 12] [--gpu d3d11|swiftshader] [--query dummyRegion=1] [--pov Digit8] [--wait 3000] [--stats]
 * Vite di port 5175 (root repo), Chromium headless 1280×720, tombol Mulai diklik (pointer lock ditolak
 * headless: sudah ditangani CameraRig), lalu teleport ke --at (x,z[,yaw] dunia), jam diset, cuaca cerah,
 * tile kota & region ditunggu tenang. --pov menekan tombol POV (mis. Digit8 = POV region). --stats
 * mencetak JSON: rerata 60 frame draw call & segitiga, memori GPU, region aktif, proxy yang tampak, label POV.
 * Exit 1 bila ada galat konsol.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PORT = 5175;
const POV_SETTLE_MS = 4000;
const SAMPLE_FRAMES = 60;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});

const { values: opts } = parseArgs({
  options: {
    out: { type: 'string' },
    at: { type: 'string', default: '0,-275,0' },
    hour: { type: 'string', default: '12' },
    gpu: { type: 'string', default: 'd3d11' },
    query: { type: 'string', default: '' },
    pov: { type: 'string' },
    wait: { type: 'string', default: '3000' },
    stats: { type: 'boolean', default: false },
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

/** "x,z[,yaw]" → {x, z, yaw}; galat jelas bila bukan angka. */
function parseAt(text) {
  const [x, z, yaw = 0] = text.split(',').map(Number);
  if (![x, z, yaw].every(Number.isFinite)) throw new Error(`--at harus "x,z[,yaw]" angka (dapat: "${text}")`);
  return { x, z, yaw };
}

/** Dievaluasi di halaman: siapkan adegan dan kembalikan statistik render. */
async function stage({ at, hour, pov, wait, povSettle, sampleFrames }) {
  const s = window.__sim;
  s.store.set('sky.advanceTime', false);
  s.store.set('sky.hour', hour);
  s.store.set('weather.raining', false);
  s.store.set('camera.mode', 'third');
  s.teleport(at.x, at.z, at.yaw);
  if (s.city) await s.city.whenSettled(at.x, at.z, 1000, 90000);
  await new Promise((r) => setTimeout(r, wait));
  await s.regions?.flush?.();
  if (pov) s.rig.handlePovKey(pov);
  await new Promise((r) => setTimeout(r, pov ? povSettle : 500));
  // Rerata SAMPLE_FRAMES frame (renderer.info di-reset tiap frame oleh App.render; baca antar frame).
  const info = s.app.renderer.info;
  let calls = 0;
  let triangles = 0;
  for (let i = 0; i < sampleFrames; i += 1) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    calls += info.render.calls;
    triangles += info.render.triangles;
  }
  const visibleProxies = [];
  s.app.scene.traverse((o) => { if (o.name.startsWith('proxy:') && o.visible) visibleProxies.push(o.name); });
  return {
    visibleProxies,
    callsMean: Math.round(calls / sampleFrames), trianglesMean: Math.round(triangles / sampleFrames),
    geometries: info.memory.geometries, textures: info.memory.textures,
    regions: s.regions ? s.regions.active().map((a) => a.def.id) : ['stadion'],
    povLabel: s.rig.povLabel,
  };
}

async function main() {
  if (!opts.out) throw new Error('--out <berkas.jpg> wajib');
  const at = parseAt(opts.at);
  const hour = Number(opts.hour);
  const wait = Number(opts.wait);
  if (!Number.isFinite(hour) || !Number.isFinite(wait)) throw new Error('--hour dan --wait harus angka');
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({
    root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true, fs: { strict: false } }, logLevel: 'error',
  });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const query = opts.query ? `?${opts.query}` : '';
    await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__sim?.app && !document.getElementById('start')?.disabled, null, { timeout: 240000 });
    await page.click('#start');
    const stats = await page.evaluate(stage, { at, hour, pov: opts.pov ?? null, wait, povSettle: POV_SETTLE_MS, sampleFrames: SAMPLE_FRAMES });
    const out = join(ROOT, opts.out);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
    if (opts.stats) console.log(JSON.stringify({ out: opts.out, at, hour, ...stats, errors }, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
  if (errors.length) {
    console.error(`galat konsol: ${errors.length}\n${errors.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Lint alat**

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 3: Baseline E2E (paritas, memori, rute, perjalanan cepat) — SEBELUM perubahan kode**

```bash
npm run e2e -- --gpu d3d11 --out docs/screenshots/unri/m0-baseline-e2e.json
```
Expected: exit 0; berkas JSON berisi `checks.parity.callsMean`, `checks.parity.callsMeanRegionOnly`, `checks.memory.cycles` (semua sama dengan `baseline`), `checks.ride.hitchP95` (< 50), `fails: []`. Catat dua angka paritas di laporan task. Bila `fails` tidak kosong: BERHENTI, laporkan ke user (baseline harus hijau sebelum refactor).

- [ ] **Step 4: Screenshot baseline titik ukur `stadion-pusat`**

```bash
node tests/e2e/shot.mjs --out docs/screenshots/unri/m0-sebelum-stadion-pusat.jpg --at 0,-275,0 --stats
```
Expected: JSON dengan `"regions": ["stadion"]`, `"errors": []`, `callsMean` (rerata 60 frame) — catat angkanya (saat plan diverifikasi di mesin user: **524**, dua lari identik); berkas JPEG ada. Kriteria visual: sepeda dari belakang di aspal plaza utara menghadap selatan, panel dialog "Selamat datang di Stadion Utama Riau!", HUD + minimap (peta dasar stadion) tampak, tanpa artefak.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/shot.mjs docs/screenshots/unri/m0-baseline-e2e.json docs/screenshots/unri/m0-sebelum-stadion-pusat.jpg
```
```bash
git commit -m "test(e2e): alat screenshot titik ukur (Playwright GPU) dan baseline paritas M0 sebelum refactor multi-region"
```

---

## Task 2: `scheduler` time-sliced (TDD)

**Files:**
- Create: `src/engine/scheduler.js`
- Test: `tests/scheduler.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/scheduler.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createScheduler, runTaskNow, DEFAULT_BUDGET_MS } from '../src/engine/scheduler.js';

const quiet = () => {
  const calls = [];
  return { calls, error: (...a) => calls.push(a) };
};
const clock = () => {
  const c = { t: 0 };
  c.now = () => c.t;
  return c;
};

describe('scheduler: dasar', () => {
  it('anggaran default 4 ms; fungsi biasa jalan sekali pada update berikutnya', async () => {
    expect(DEFAULT_BUDGET_MS).toBe(4);
    const s = createScheduler({ now: () => 0 });
    let n = 0;
    s.schedule(() => { n += 1; });
    expect(n).toBe(0);
    expect(s.pending()).toBe(1);
    expect(s.update()).toBe(1);
    expect(n).toBe(1);
    expect(s.pending()).toBe(0);
    expect(s.update()).toBe(0);
    await s.whenIdle(); // langsung selesai
  });

  it('generator dipotong per yield sampai anggaran habis, lalu lanjut pada update berikutnya', () => {
    const c = clock();
    const s = createScheduler({ budgetMs: 4, now: c.now });
    const hits = [];
    s.schedule(function* kerja() {
      for (let i = 0; i < 10; i += 1) {
        c.t += 1;
        hits.push(i);
        yield;
      }
    });
    expect(s.update()).toBe(4);
    expect(hits).toEqual([0, 1, 2, 3]);
    s.update();
    expect(hits).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    s.update();
    expect(hits).toHaveLength(10);
    expect(s.pending()).toBe(0);
  });

  it('minimal satu potongan per update walau satu potongan melebihi anggaran', () => {
    const c = clock();
    const s = createScheduler({ budgetMs: 4, now: c.now });
    const hits = [];
    s.schedule(function* berat() {
      for (let i = 0; i < 3; i += 1) {
        c.t += 10;
        hits.push(i);
        yield;
      }
    });
    s.update();
    expect(hits).toEqual([0]);
    s.update();
    expect(hits).toEqual([0, 1]);
  });

  it('FIFO: task berikutnya mulai setelah task sebelumnya selesai', () => {
    const s = createScheduler({ now: () => 0 });
    const log = [];
    s.schedule(function* a() { log.push('a1'); yield; log.push('a2'); });
    s.schedule(() => log.push('b'));
    s.update();
    expect(log).toEqual(['a1', 'a2', 'b']);
  });

  it('task boleh menjadwalkan task baru (masuk ke akhir antrean)', () => {
    const s = createScheduler({ now: () => 0 });
    const log = [];
    s.schedule(() => { log.push('induk'); s.schedule(() => log.push('anak')); });
    s.schedule(() => log.push('kedua'));
    s.update();
    expect(log).toEqual(['induk', 'kedua', 'anak']);
  });
});

describe('scheduler: pemilik, pembatalan, galat', () => {
  it('pending(owner) dan whenIdle(owner) per pemilik', async () => {
    const c = clock();
    const s = createScheduler({ budgetMs: 1, now: c.now });
    s.schedule(() => { c.t += 5; }, { owner: 'region:a' });
    s.schedule(() => { c.t += 5; }, { owner: 'region:b' });
    expect(s.pending('region:a')).toBe(1);
    expect(s.pending()).toBe(2);
    let aIdle = false;
    let allIdle = false;
    s.whenIdle('region:a').then(() => { aIdle = true; });
    s.whenIdle().then(() => { allIdle = true; });
    s.update(); // satu potongan (anggaran 1 ms habis): task a
    await Promise.resolve();
    expect(aIdle).toBe(true);
    expect(allIdle).toBe(false);
    s.update();
    await Promise.resolve();
    expect(allIdle).toBe(true);
  });

  it('cancel membuang task; generator yang sedang berjalan menjalankan blok finally; idempoten', () => {
    const s = createScheduler({ budgetMs: 0, now: () => 0 }); // satu potongan per update
    const log = [];
    const a = s.schedule(function* a() {
      try {
        log.push('a1');
        yield;
        log.push('a2');
      } finally {
        log.push('a-finally');
      }
    });
    const b = s.schedule(() => log.push('b'));
    s.update();
    a.cancel();
    a.cancel();
    b.cancel();
    s.update();
    expect(log).toEqual(['a1', 'a-finally']);
    expect(s.pending()).toBe(0);
  });

  it('cancelOwner hanya membatalkan milik pemilik itu dan mengembalikan jumlahnya', () => {
    const s = createScheduler({ now: () => 0 });
    const log = [];
    s.schedule(() => log.push('a'), { owner: 'x' });
    s.schedule(() => log.push('b'), { owner: 'y' });
    s.schedule(() => log.push('c'), { owner: 'x' });
    expect(s.cancelOwner('x')).toBe(2);
    expect(s.cancelOwner('x')).toBe(0);
    s.update();
    expect(log).toEqual(['b']);
  });

  it('task yang melempar dicatat lalu dibuang; antrean lanjut; whenIdle tetap selesai', async () => {
    const logger = quiet();
    const s = createScheduler({ now: () => 0, logger });
    const log = [];
    s.schedule(() => { throw new Error('rusak'); }, { owner: 'r' });
    s.schedule(function* tengah() { yield; throw new Error('rusak di tengah'); }, { owner: 'r' });
    s.schedule(() => log.push('lanjut'));
    const idle = s.whenIdle('r');
    s.update();
    await idle;
    expect(log).toEqual(['lanjut']);
    expect(logger.calls).toHaveLength(2);
    expect(String(logger.calls[0][0])).toContain('"r"');
  });

  it('input tidak sah melempar TypeError', () => {
    expect(() => createScheduler({ budgetMs: -1 })).toThrow(TypeError);
    expect(() => createScheduler({ now: 5 })).toThrow(TypeError);
    expect(() => createScheduler().schedule(null)).toThrow(TypeError);
    expect(() => runTaskNow(5)).toThrow(TypeError);
  });
});

describe('runTaskNow', () => {
  it('menjalankan fungsi biasa dan generator sampai habis secara sinkron', () => {
    const log = [];
    runTaskNow(() => log.push('f'));
    runTaskNow(function* g() { log.push('g1'); yield; log.push('g2'); });
    expect(log).toEqual(['f', 'g1', 'g2']);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/scheduler.test.js
```
Expected: FAIL — `Failed to load url ../src/engine/scheduler.js` / `Cannot find module`.

- [ ] **Step 3: Implementasi** — buat `src/engine/scheduler.js`:

```js
/**
 * Antrean kerja time-sliced (spec UNRI §4.3, M0): pekerjaan berat region/distrik dipotong per frame
 * agar tidak menimbulkan hitch. `task` = fungsi biasa (satu potongan) atau fungsi generator (setiap
 * `yield` = titik potong). update() menjalankan potongan berurutan FIFO sampai anggaran `budgetMs`
 * habis — minimal satu potongan per update agar antrean selalu maju. `owner` (mis. 'region:dummy')
 * mengelompokkan task untuk dibatalkan/ditunggu bersama. Task yang melempar dicatat lalu dibuang;
 * antrean tetap lanjut. Lapisan engine: tanpa impor three/world/ui.
 */
export const DEFAULT_BUDGET_MS = 4;

/** @typedef {() => (void | Iterator<unknown>)} Task */
/** @typedef {{cancel(): void}} TaskHandle */

const isIterator = (v) => v != null && typeof v.next === 'function' && typeof v[Symbol.iterator] === 'function';

/**
 * Jalankan task sampai habis secara sinkron (tanpa scheduler: mount di tes/alat).
 * @param {Task} task
 */
export function runTaskNow(task) {
  if (typeof task !== 'function') throw new TypeError('runTaskNow: task harus fungsi');
  const out = task();
  if (!isIterator(out)) return;
  while (!out.next().done) {
    // setiap yield = titik potong; tanpa scheduler dijalankan beruntun
  }
}

/**
 * @param {{budgetMs?: number, now?: () => number, logger?: {error: (...args: unknown[]) => void}}} [opts]
 * @returns {{schedule(task: Task, opts?: {owner?: unknown}): TaskHandle, cancelOwner(owner: unknown): number,
 *   update(): number, pending(owner?: unknown): number, whenIdle(owner?: unknown): Promise<void>}}
 */
export function createScheduler({ budgetMs = DEFAULT_BUDGET_MS, now = () => performance.now(), logger = console } = {}) {
  if (!Number.isFinite(budgetMs) || budgetMs < 0) throw new TypeError('createScheduler: budgetMs harus angka ≥ 0');
  if (typeof now !== 'function') throw new TypeError('createScheduler: now() harus fungsi');
  let queue = [];   // job: { task, owner, iter, done } — urut FIFO
  let waiters = []; // { owner, all, resolve }

  const count = (owner, all) => (all ? queue.length : queue.reduce((n, j) => n + (j.owner === owner ? 1 : 0), 0));

  const settle = () => {
    if (!waiters.length) return;
    const done = waiters.filter((w) => count(w.owner, w.all) === 0);
    if (!done.length) return;
    waiters = waiters.filter((w) => !done.includes(w));
    for (const w of done) w.resolve();
  };

  /** Keluarkan job dari antrean; false bila sudah keluar sebelumnya. */
  const drop = (job) => {
    if (job.done) return false;
    job.done = true;
    queue = queue.filter((j) => j !== job);
    return true;
  };

  /** Generator yang dibatalkan di tengah jalan: jalankan blok finally-nya. */
  const close = (job) => {
    if (!job.iter) return;
    try {
      job.iter.return();
    } catch (err) {
      logger.error(`Scheduler: task milik "${String(job.owner)}" gagal ditutup:`, err);
    }
  };

  /** Satu potongan job; true bila job selesai. */
  const step = (job) => {
    if (!job.iter) {
      const out = job.task();
      if (!isIterator(out)) return true;
      job.iter = out;
    }
    return job.iter.next().done === true;
  };

  return {
    schedule(task, { owner = null } = {}) {
      if (typeof task !== 'function') throw new TypeError('Scheduler.schedule: task harus fungsi');
      const job = { task, owner, iter: null, done: false };
      queue = [...queue, job];
      return Object.freeze({
        cancel() {
          if (!drop(job)) return;
          close(job);
          settle();
        },
      });
    },
    cancelOwner(owner) {
      const jobs = queue.filter((j) => j.owner === owner);
      for (const j of jobs) {
        drop(j);
        close(j);
      }
      if (jobs.length) settle();
      return jobs.length;
    },
    /** Jalankan potongan sampai anggaran habis (minimal satu). @returns {number} jumlah potongan */
    update() {
      if (!queue.length) return 0;
      const start = now();
      let slices = 0;
      do {
        const job = queue[0];
        let finished = true;
        try {
          finished = step(job);
        } catch (err) {
          logger.error(`Scheduler: task milik "${String(job.owner)}" gagal, dibuang:`, err);
        }
        slices += 1;
        if (finished && drop(job)) settle();
      } while (queue.length > 0 && now() - start < budgetMs);
      return slices;
    },
    /** Jumlah task tertunda; tanpa argumen = semua pemilik. */
    pending(owner) { return count(owner, owner === undefined); },
    /** Selesai saat task milik `owner` (tanpa argumen: semua) habis. */
    whenIdle(owner) {
      const all = owner === undefined;
      if (count(owner, all) === 0) return Promise.resolve();
      return new Promise((resolve) => { waiters = [...waiters, { owner, all, resolve }]; });
    },
  };
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/scheduler.test.js
```
Expected: `Tests  11 passed (11)`.

- [ ] **Step 5: Lint**

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/scheduler.js tests/scheduler.test.js
```
```bash
git commit -m "feat(engine): scheduler time-sliced (FIFO, generator per yield, owner, cancel, whenIdle) untuk build region inkremental"
```

---

## Task 3: Titik cerita ber-region — `points.js` + `storyWorld.js` (TDD)

**Files:**
- Create: `src/story/points.js`, `src/story/storyWorld.js`
- Test: `tests/storyPoints.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/storyPoints.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizePoint, resolvePoint, localizePoint, DEFAULT_REGION, WORLD_REGION } from '../src/story/points.js';
import { resolveChapters, resolveNpcs, resolveEggs, resolveAnchors } from '../src/story/storyWorld.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';

const F = createRegionFrame({ x: 100, z: -50, yaw: 0.3 });
const frameOf = (id) => ({ stadion: IDENTITY_FRAME, lembaga: F })[id] ?? null;

describe('normalizePoint', () => {
  it('tanpa region → stadion; field lain dibuang', () => {
    expect(DEFAULT_REGION).toBe('stadion');
    expect(normalizePoint({ x: 1, z: 2, radius: 9 })).toEqual({ region: 'stadion', x: 1, z: 2 });
  });
  it('region dipertahankan (termasuk world)', () => {
    expect(normalizePoint({ region: 'lembaga', x: 1, z: 2 })).toEqual({ region: 'lembaga', x: 1, z: 2 });
    expect(normalizePoint({ region: WORLD_REGION, x: 1, z: 2 }).region).toBe('world');
  });
  it('titik tidak sah melempar TypeError', () => {
    for (const bad of [null, 5, {}, { x: 1 }, { x: Number.NaN, z: 0 }, { x: 0, z: 0, region: '' }, { x: 0, z: 0, region: 5 }]) {
      expect(() => normalizePoint(bad)).toThrow(TypeError);
    }
  });
});

describe('resolvePoint', () => {
  it('stadion identitas & world: koordinat apa adanya', () => {
    expect(resolvePoint({ x: 3, z: 4 }, frameOf)).toEqual({ x: 3, z: 4 });
    expect(resolvePoint({ region: 'world', x: 3, z: 4 }, () => null)).toEqual({ x: 3, z: 4 });
  });
  it('region ber-placement: frame.toWorld', () => {
    const w = resolvePoint({ region: 'lembaga', x: 10, z: 0 }, frameOf);
    expect(w.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(w.z).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
  });
  it('region tak dikenal atau titik null → null', () => {
    expect(resolvePoint({ region: 'hilang', x: 0, z: 0 }, frameOf)).toBeNull();
    expect(resolvePoint(null, frameOf)).toBeNull();
    expect(resolvePoint(undefined, frameOf)).toBeNull();
  });
});

describe('localizePoint', () => {
  it('dunia → lokal region (+yaw), dan kembali lewat resolvePoint', () => {
    const p = localizePoint({ x: 120, z: -40, yaw: 1 }, 'lembaga', frameOf);
    expect(p.region).toBe('lembaga');
    expect(p.yaw).toBeCloseTo(0.7, 12);
    const back = resolvePoint(p, frameOf);
    expect(back.x).toBeCloseTo(120, 9);
    expect(back.z).toBeCloseTo(-40, 9);
  });
  it('tanpa region → world; frame tak dikenal atau titik rusak → null; yaw hilang → 0', () => {
    expect(localizePoint({ x: 1, z: 2, yaw: 3 }, null, frameOf)).toEqual({ region: 'world', x: 1, z: 2, yaw: 3 });
    expect(localizePoint({ x: 1, z: 2 }, 'world', frameOf)).toEqual({ region: 'world', x: 1, z: 2, yaw: 0 });
    expect(localizePoint({ x: 1, z: 2 }, 'hilang', frameOf)).toBeNull();
    expect(localizePoint({ x: Number.NaN, z: 2 }, 'stadion', frameOf)).toBeNull();
  });
});

describe('storyWorld', () => {
  const chapters = [{
    id: 'c',
    title: 'C',
    steps: [
      { id: 'a', objective: { type: 'goto', target: { region: 'lembaga', x: 10, z: 0 }, radius: 5 } },
      { id: 'b', objective: { type: 'buy', itemId: 'x' } },
      { id: 'c', objective: { type: 'goto', target: { region: 'hilang', x: 0, z: 0 }, radius: 5 } },
    ],
  }];

  it('resolveChapters: target goto ke dunia; objective lain sama; region tak dikenal → target null', () => {
    const r = resolveChapters(chapters, frameOf);
    expect(r[0].title).toBe('C');
    expect(r[0].steps[0].objective.target.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(r[0].steps[0].objective.radius).toBe(5);
    expect(r[0].steps[1].objective).toBe(chapters[0].steps[1].objective);
    expect(r[0].steps[2].objective.target).toBeNull();
    expect(chapters[0].steps[0].objective.target).toEqual({ region: 'lembaga', x: 10, z: 0 }); // input tidak diubah
  });

  it('resolveNpcs membuang NPC di region tak dikenal; field lain dipertahankan', () => {
    const r = resolveNpcs([{ id: 'a', name: 'A', x: 1, z: 2, yaw: 0.5 }, { id: 'b', name: 'B', region: 'hilang', x: 0, z: 0 }], frameOf);
    expect(r).toEqual([{ id: 'a', name: 'A', x: 1, z: 2, yaw: 0.5 }]);
  });

  it('resolveEggs: `at` ke dunia dengan radius; tanpa `at` tetap; region tak dikenal → tanpa `at`', () => {
    const eggs = [
      { id: 'a', at: { region: 'lembaga', x: 10, z: 0, radius: 3 } },
      { id: 'b', trigger: 'khusus' },
      { id: 'c', at: { region: 'hilang', x: 0, z: 0, radius: 3 } },
    ];
    const r = resolveEggs(eggs, frameOf);
    expect(r[0].at.radius).toBe(3);
    expect(r[0].at.z).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
    expect(r[1]).toBe(eggs[1]);
    expect(r[2].at).toBeUndefined();
  });

  it('resolveAnchors: tiap titik ke dunia; tak dikenal → null', () => {
    expect(resolveAnchors({ tugu: { x: 1, z: 2 }, jauh: { region: 'hilang', x: 0, z: 0 } }, frameOf)).toEqual({ tugu: { x: 1, z: 2 }, jauh: null });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/storyPoints.test.js
```
Expected: FAIL — modul `src/story/points.js` tidak ditemukan.

- [ ] **Step 3: Implementasi** — buat `src/story/points.js`:

```js
/**
 * Titik cerita ber-region (spec UNRI §4.5), murni. Titik = { region, x, z }: x/z region-lokal
 * (region 'world' = koordinat dunia). Data lama tanpa `region` dianggap 'stadion' (kompatibel).
 * `frameOf(regionId)` → frame (geo/regionTransform createRegionFrame) atau null bila region tak dikenal.
 */
export const DEFAULT_REGION = 'stadion';
export const WORLD_REGION = 'world';

/**
 * @param {{region?: string, x: number, z: number}} p
 * @returns {{region: string, x: number, z: number}}
 */
export function normalizePoint(p) {
  if (!p || typeof p !== 'object' || !Number.isFinite(p.x) || !Number.isFinite(p.z)) {
    throw new TypeError('normalizePoint: titik {x, z} harus angka hingga');
  }
  const region = p.region ?? DEFAULT_REGION;
  if (typeof region !== 'string' || region === '') throw new TypeError('normalizePoint: region harus string tidak kosong');
  return { region, x: p.x, z: p.z };
}

/**
 * Titik ber-region → dunia.
 * @param {{region?: string, x: number, z: number}|null|undefined} p
 * @param {(regionId: string) => ({identity: boolean, toWorld(x: number, z: number): {x: number, z: number}}|null)} frameOf
 * @returns {{x: number, z: number}|null} null bila p kosong atau region tak dikenal
 */
export function resolvePoint(p, frameOf) {
  if (p == null) return null;
  const n = normalizePoint(p);
  if (n.region === WORLD_REGION) return { x: n.x, z: n.z };
  const frame = frameOf(n.region);
  if (!frame) return null;
  if (frame.identity) return { x: n.x, z: n.z };
  return frame.toWorld(n.x, n.z);
}

/**
 * Titik dunia (+yaw opsional) → titik ber-region di frame `regionId` (null/'world' = dunia).
 * @param {{x: number, z: number, yaw?: number}} p
 * @param {string|null} regionId
 * @param {(regionId: string) => object|null} frameOf
 * @returns {{region: string, x: number, z: number, yaw: number}|null} null bila titik rusak atau frame tak dikenal
 */
export function localizePoint(p, regionId, frameOf) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  const yaw = Number.isFinite(p.yaw) ? p.yaw : 0;
  if (!regionId || regionId === WORLD_REGION) return { region: WORLD_REGION, x: p.x, z: p.z, yaw };
  const frame = frameOf(regionId);
  if (!frame) return null;
  const l = frame.toLocal(p.x, p.z);
  return { region: regionId, x: l.x, z: l.z, yaw: frame.yawToLocal(yaw) };
}
```

Buat `src/story/storyWorld.js`:

```js
/**
 * Data cerita → koordinat dunia (M0 multi-region), murni. Titik di data cerita adalah titik ber-region
 * (story/points.js; tanpa `region` = 'stadion'); StoryDirector bekerja di koordinat dunia sehingga tujuan
 * di region mana pun dibandingkan langsung dengan posisi sepeda. Titik yang region-nya tidak dikenal
 * menjadi null (tujuan tak tercapai, penanda disembunyikan), bukan galat. Input tidak diubah.
 */
import { resolvePoint } from './points.js';

const resolveObjective = (o, frameOf) => (o.type === 'goto' ? { ...o, target: resolvePoint(o.target, frameOf) } : o);

/** Chapter dengan target `goto` di koordinat dunia. */
export function resolveChapters(chapters, frameOf) {
  return chapters.map((c) => ({
    ...c,
    steps: c.steps.map((s) => ({ ...s, objective: resolveObjective(s.objective, frameOf) })),
  }));
}

/** NPC cerita dengan x/z dunia; NPC di region tak dikenal dibuang. */
export function resolveNpcs(npcs, frameOf) {
  return npcs.flatMap((n) => {
    const w = resolvePoint(n, frameOf);
    return w ? [{ ...n, x: w.x, z: w.z }] : [];
  });
}

/** Easter egg: pemicu jarak `at` ke dunia (radius dipertahankan); region tak dikenal → tanpa `at`. */
export function resolveEggs(eggs, frameOf) {
  return eggs.map((e) => {
    if (!e.at) return e;
    const w = resolvePoint(e.at, frameOf);
    return { ...e, at: w ? { ...w, radius: e.at.radius } : undefined };
  });
}

/** Titik jangkar pemicu khusus (eggTriggers) ke dunia; tak dikenal → null. */
export function resolveAnchors(anchors, frameOf) {
  return Object.fromEntries(Object.entries(anchors).map(([k, p]) => [k, resolvePoint(p, frameOf)]));
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/storyPoints.test.js
```
Expected: `Tests  12 passed (12)`.

- [ ] **Step 5: Lint**

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/story/points.js src/story/storyWorld.js tests/storyPoints.test.js
```
```bash
git commit -m "feat(story): titik cerita ber-region (normalizePoint, resolvePoint, localizePoint) dan resolusi data cerita ke dunia"
```

---

## Task 4: `terrainService` stub datar

**Files:**
- Create: `src/app/terrainService.js`
- Test: `tests/terrainService.test.js`

- [ ] **Step 1: Tulis tes** — buat `tests/terrainService.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { FLAT_TERRAIN, createTerrainService } from '../src/app/terrainService.js';

describe('terrainService (stub M0)', () => {
  it('FLAT_TERRAIN: tinggi 0, normal ke atas (menulis ke out bila ada), grade 0, versi 0, beku', () => {
    expect(FLAT_TERRAIN.heightAt(123, -456)).toBe(0);
    expect(FLAT_TERRAIN.normalAt(1, 2)).toEqual({ x: 0, y: 1, z: 0 });
    const out = { x: 9, y: 9, z: 9 };
    expect(FLAT_TERRAIN.normalAt(1, 2, out)).toBe(out);
    expect(out).toEqual({ x: 0, y: 1, z: 0 });
    expect(FLAT_TERRAIN.gradeAlong(0, 0, 1)).toBe(0);
    expect(FLAT_TERRAIN.version).toBe(0);
    expect(Object.isFrozen(FLAT_TERRAIN)).toBe(true);
  });

  it('createTerrainService meneruskan ke field (datar di M0)', () => {
    const t = createTerrainService();
    expect(t.field).toBe(FLAT_TERRAIN);
    expect(t.heightAt(5, 5)).toBe(0);
    expect(t.normalAt(5, 5)).toEqual({ x: 0, y: 1, z: 0 });
    expect(t.gradeAlong(5, 5, 0)).toBe(0);
    expect(t.version).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/terrainService.test.js
```
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi** — buat `src/app/terrainService.js`:

```js
/**
 * Layanan terrain global (spec UNRI §4.1). M0: stub DATAR — `heightAt` = 0 di mana pun sehingga stadion
 * dan tile kota tidak berubah. Disuntikkan sebagai `ctx.terrain` ke region (mountRegion) lewat regionManager.
 * M1 mengganti isi `createTerrainService` dengan HeightField nyata (src/geo/terrain/heightfield.js) TANPA
 * mengubah ekspor: { field, heightAt, normalAt, gradeAlong, version }.
 */

/** Normal datar; menulis ke `out` bila diberikan (pola tanpa alokasi). */
function flatNormal(_x, _z, out) {
  if (!out) return { x: 0, y: 1, z: 0 };
  out.x = 0;
  out.y = 1;
  out.z = 0;
  return out;
}

/** Terrain datar (dipakai default mountRegion dan stub layanan). */
export const FLAT_TERRAIN = Object.freeze({
  heightAt: () => 0,
  normalAt: flatNormal,
  gradeAlong: () => 0,
  version: 0,
});

/**
 * @returns {{field: object, heightAt(x: number, z: number): number,
 *   normalAt(x: number, z: number, out?: {x: number, y: number, z: number}): {x: number, y: number, z: number},
 *   gradeAlong(x: number, z: number, yaw: number): number, readonly version: number}}
 */
export function createTerrainService() {
  const field = FLAT_TERRAIN;
  return Object.freeze({
    field,
    heightAt: (x, z) => field.heightAt(x, z),
    normalAt: (x, z, out) => field.normalAt(x, z, out),
    gradeAlong: (x, z, yaw) => field.gradeAlong(x, z, yaw),
    get version() { return field.version; },
  });
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/terrainService.test.js
```
Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/terrainService.js tests/terrainService.test.js
```
```bash
git commit -m "feat(app): terrainService stub datar (FLAT_TERRAIN) sebagai kontrak ctx.terrain untuk M1"
```

---

## Task 5: Kontrak `Region` diperluas — `activation`, `proxy`, `povs`, `pads` (TDD)

**Files:**
- Modify: `src/regions/Region.js` (seluruh berkas, 66 baris)
- Modify: `src/regions/stadion/index.js:58-63`
- Test: `tests/region.test.js` (ubah impor baris 2; tambah describe di akhir berkas, setelah baris 82)

- [ ] **Step 1: Tulis tes yang gagal**

Ganti baris 2 `tests/region.test.js`:

```js
import { defineRegion, validateBuild, regionContains } from '../src/regions/Region.js';
```
menjadi:
```js
import {
  defineRegion, validateBuild, regionContains, withPlacement, DEFAULT_MOUNT_RADIUS, DEFAULT_UNMOUNT_RADIUS,
} from '../src/regions/Region.js';
```

Tambahkan di akhir berkas:

```js
describe('kontrak Region: field opsional M0 (spec UNRI §4.3)', () => {
  it('tanpa activation → persistent; persistent:true dinormalisasi dan beku', () => {
    expect(defineRegion(spec()).activation).toEqual({ persistent: true });
    const r = defineRegion(spec({ activation: { persistent: true, center: { x: 1, z: 1 } } }));
    expect(r.activation).toEqual({ persistent: true });
    expect(Object.isFrozen(r.activation)).toBe(true);
  });

  it('activation streaming: center wajib, radius default 700/900, unmount > mount', () => {
    expect([DEFAULT_MOUNT_RADIUS, DEFAULT_UNMOUNT_RADIUS]).toEqual([700, 900]);
    const r = defineRegion(spec({ activation: { center: { x: 5, z: 6 } } }));
    expect(r.activation).toEqual({ persistent: false, center: { x: 5, z: 6 }, mountRadius: 700, unmountRadius: 900 });
    expect(Object.isFrozen(r.activation.center)).toBe(true);
    expect(defineRegion(spec({ activation: { center: { x: 0, z: 0 }, mountRadius: 100, unmountRadius: 150 } })).activation.unmountRadius).toBe(150);
    expect(() => defineRegion(spec({ activation: 'ya' }))).toThrow(/activation harus objek/);
    expect(() => defineRegion(spec({ activation: { center: { x: 0 } } }))).toThrow(/activation\.center/);
    expect(() => defineRegion(spec({ activation: { center: { x: 0, z: 0 }, mountRadius: -1 } }))).toThrow(/mountRadius harus > 0/);
    expect(() => defineRegion(spec({ activation: { center: { x: 0, z: 0 }, mountRadius: 900, unmountRadius: 900 } }))).toThrow(/histeresis/);
  });

  it('proxy harus fungsi bila ada', () => {
    expect(defineRegion(spec({ proxy: () => ({}) })).proxy).toBeTypeOf('function');
    expect(defineRegion(spec()).proxy).toBeUndefined();
    expect(() => defineRegion(spec({ proxy: {} }))).toThrow(/proxy/);
  });

  it('povs: default [], id unik, label, pose fungsi', () => {
    expect(defineRegion(spec()).povs).toEqual([]);
    const pov = { id: 'a', label: 'A', pose: () => null };
    expect(defineRegion(spec({ povs: [pov] })).povs[0]).toMatchObject({ id: 'a', label: 'A' });
    expect(() => defineRegion(spec({ povs: {} }))).toThrow(/povs harus array/);
    expect(() => defineRegion(spec({ povs: [{ ...pov, id: '' }] }))).toThrow(/povs\[0\]\.id/);
    expect(() => defineRegion(spec({ povs: [pov, pov] }))).toThrow(/ganda/);
    expect(() => defineRegion(spec({ povs: [{ ...pov, label: 3 }] }))).toThrow(/povs\[0\]\.label/);
    expect(() => defineRegion(spec({ povs: [{ ...pov, pose: null }] }))).toThrow(/povs\[0\]\.pose/);
  });

  it('pads: default [], ring ≥ 3 titik, y median|angka (default median)', () => {
    expect(defineRegion(spec()).pads).toEqual([]);
    const ring = [[0, 0], [4, 0], [4, 4]];
    expect(defineRegion(spec({ pads: [{ ring }] })).pads).toEqual([{ ring, y: 'median' }]);
    expect(defineRegion(spec({ pads: [{ ring, y: 1.5 }] })).pads[0].y).toBe(1.5);
    expect(() => defineRegion(spec({ pads: 'x' }))).toThrow(/pads harus array/);
    expect(() => defineRegion(spec({ pads: [{ ring: [[0, 0], [1, 1]] }] }))).toThrow(/pads\[0\]\.ring/);
    expect(() => defineRegion(spec({ pads: [{ ring, y: 'tinggi' }] }))).toThrow(/pads\[0\]\.y/);
  });

  it('region stadion persistent; withPlacement mempertahankan field M0', () => {
    expect(stadionRegion.activation).toEqual({ persistent: true });
    const moved = withPlacement(stadionRegion, { x: 1, z: 2, yaw: 0 });
    expect(moved.activation).toEqual({ persistent: true });
    expect(moved.povs).toEqual([]);
    expect(moved.pads).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/region.test.js
```
Expected: FAIL — `DEFAULT_MOUNT_RADIUS` undefined / `activation` undefined pada 6 tes baru; tes lama tetap lulus.

- [ ] **Step 3: Implementasi** — ganti seluruh isi `src/regions/Region.js`:

```js
/**
 * Kontrak region handmade (spec Pekanbaru §3.1, perluasan spec UNRI §4.3) + helper validasi.
 * Field opsional M0 dinormalisasi oleh defineRegion:
 * - activation: { persistent:true } (default) | { center:{x,z} dunia, mountRadius=700, unmountRadius=900 }
 * - proxy?(ctx) -> { group, dispose }: siluet murah saat region tidak terpasang (≤ 8 draw call)
 * - povs: [{ id, label, pose(frame, ctx) }] (default []): POV milik region, pose di koordinat DUNIA
 * - pads: [{ ring:[[lx,lz]...], y:'median'|number }] (default []): pad rata untuk campusbake (M1)
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../geo/polygon.js';

/** @typedef {'input'|'sim'|'world'|'camera'|'ui'} Phase */
/** @typedef {{id:string, phase:Phase, update(dt:number, ctx:object):void, dispose?():void}} System */
/** @typedef {{x:number, z:number, yaw:number}} Placement */
/**
 * Collider region-lokal. Fase 0 memakai (lx, lz); parameter `clear`/`ly` di spec ditunda ke Fase 2.
 * @typedef {{isWalkable(lx:number, lz:number):boolean, isCameraClear(lx:number, lz:number):boolean}} RegionColliders
 */
/**
 * @typedef {{group: import('three').Group, colliders: RegionColliders,
 *   minimapLayer: (ctx2d: CanvasRenderingContext2D, view: object) => void, systems: System[], dispose(): void}} RegionBuild
 */
/**
 * ctx build. terrain/heightAtLocal/schedule (M0, mountRegion): build berat wajib inkremental lewat schedule.
 * @typedef {{scene?:object, renderer?:object, camera?:object, scope:object, store?:object, clock?:object,
 *   placement?:Placement, terrain?:{heightAt(x:number, z:number):number},
 *   heightAtLocal?:(lx:number, lz:number) => number, schedule?:(task:Function) => {cancel():void}}} RegionContext
 */
/** @typedef {{persistent:true}|{persistent:false, center:{x:number,z:number}, mountRadius:number, unmountRadius:number}} Activation */
/**
 * @typedef {{id:string, label:string, pose(frame:object, ctx:{time:number, bike:object}):
 *   ({px:number,py:number,pz:number,tx:number,ty:number,tz:number,fov?:number}|null)}} RegionPov
 */
/** @typedef {{ring:Array<[number,number]>, y:'median'|number}} RegionPad */

const finite = Number.isFinite;

export const DEFAULT_MOUNT_RADIUS = 700;
export const DEFAULT_UNMOUNT_RADIUS = 900;
const PERSISTENT = Object.freeze({ persistent: true });

/** @returns {Activation} */
function normalizeActivation(a, id) {
  if (a == null) return PERSISTENT; // region lama tanpa activation: selalu terpasang
  if (typeof a !== 'object') throw new TypeError(`Region "${id}": activation harus objek`);
  if (a.persistent === true) return PERSISTENT;
  const c = a.center;
  if (!c || !finite(c.x) || !finite(c.z)) {
    throw new TypeError(`Region "${id}": activation.center {x,z} harus angka hingga (atau persistent:true)`);
  }
  const mountRadius = a.mountRadius ?? DEFAULT_MOUNT_RADIUS;
  const unmountRadius = a.unmountRadius ?? DEFAULT_UNMOUNT_RADIUS;
  if (!finite(mountRadius) || mountRadius <= 0) throw new TypeError(`Region "${id}": activation.mountRadius harus > 0`);
  if (!finite(unmountRadius) || unmountRadius <= mountRadius) {
    throw new TypeError(`Region "${id}": activation.unmountRadius harus > mountRadius (histeresis)`);
  }
  return Object.freeze({ persistent: false, center: Object.freeze({ x: c.x, z: c.z }), mountRadius, unmountRadius });
}

/** @returns {ReadonlyArray<RegionPov>} */
function normalizePovs(povs, id) {
  if (povs == null) return Object.freeze([]);
  if (!Array.isArray(povs)) throw new TypeError(`Region "${id}": povs harus array`);
  const seen = new Set();
  return Object.freeze(povs.map((p, i) => {
    if (!p || typeof p.id !== 'string' || p.id === '') throw new TypeError(`Region "${id}": povs[${i}].id wajib string`);
    if (seen.has(p.id)) throw new TypeError(`Region "${id}": povs id "${p.id}" ganda`);
    seen.add(p.id);
    if (typeof p.label !== 'string' || p.label === '') throw new TypeError(`Region "${id}": povs[${i}].label wajib string`);
    if (typeof p.pose !== 'function') throw new TypeError(`Region "${id}": povs[${i}].pose(frame, ctx) wajib fungsi`);
    return Object.freeze({ ...p });
  }));
}

const ringOk = (r) => Array.isArray(r) && r.length >= 3 && r.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1]));

/** @returns {ReadonlyArray<RegionPad>} */
function normalizePads(pads, id) {
  if (pads == null) return Object.freeze([]);
  if (!Array.isArray(pads)) throw new TypeError(`Region "${id}": pads harus array`);
  return Object.freeze(pads.map((p, i) => {
    if (!p || !ringOk(p.ring)) throw new TypeError(`Region "${id}": pads[${i}].ring minimal 3 titik [lx,lz]`);
    const y = p.y ?? 'median';
    if (y !== 'median' && !finite(y)) throw new TypeError(`Region "${id}": pads[${i}].y harus 'median' atau angka`);
    return Object.freeze({ ring: Object.freeze(p.ring.map((q) => Object.freeze([q[0], q[1]]))), y });
  }));
}

/**
 * @param {{id:string, placement:Placement, mask:Array<[number, number]>, build:(ctx:RegionContext)=>Promise<RegionBuild>,
 *   activation?:object, proxy?:(ctx:{scope:object, placement:Placement, terrain:object}) => {group:object, dispose():void},
 *   povs?:RegionPov[], pads?:RegionPad[]}} spec
 */
export function defineRegion(spec) {
  if (!spec || typeof spec.id !== 'string' || spec.id === '') throw new TypeError('Region: id wajib string');
  const p = spec.placement;
  if (!p || ![p.x, p.z, p.yaw].every(finite)) throw new TypeError(`Region "${spec.id}": placement {x,z,yaw} harus angka hingga`);
  const maskOk = Array.isArray(spec.mask) && spec.mask.length >= 3
    && spec.mask.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1]));
  if (!maskOk) throw new TypeError(`Region "${spec.id}": mask minimal 3 titik [x,z]`);
  if (typeof spec.build !== 'function') throw new TypeError(`Region "${spec.id}": build(ctx) wajib`);
  if (spec.proxy != null && typeof spec.proxy !== 'function') throw new TypeError(`Region "${spec.id}": proxy(ctx) harus fungsi`);
  return Object.freeze({
    ...spec,
    placement: Object.freeze({ x: p.x, z: p.z, yaw: p.yaw }),
    activation: normalizeActivation(spec.activation, spec.id),
    povs: normalizePovs(spec.povs, spec.id),
    pads: normalizePads(spec.pads, spec.id),
  });
}

/** Pastikan hasil build memenuhi kontrak; kembalikan apa adanya (boleh berisi field tambahan). */
export function validateBuild(result, id) {
  const missing = [];
  if (!result?.group?.isObject3D) missing.push('group');
  if (typeof result?.colliders?.isWalkable !== 'function' || typeof result?.colliders?.isCameraClear !== 'function') missing.push('colliders');
  if (typeof result?.minimapLayer !== 'function') missing.push('minimapLayer');
  if (!Array.isArray(result?.systems)) missing.push('systems');
  if (typeof result?.dispose !== 'function') missing.push('dispose');
  if (missing.length) throw new TypeError(`Region "${id}": hasil build tidak lengkap (${missing.join(', ')})`);
  return result;
}

/** Apakah titik dunia (x, z) berada di dalam mask region (setelah transform placement). */
export function regionContains(region, x, z) {
  const l = toLocal(region.placement, x, z);
  return pointInPolygon(l.x, l.z, region.mask);
}

/**
 * Setengah sisi persegi berpusat placement yang memuat seluruh mask (m), mis. untuk bake minimap.
 * Memakai jarak radial terjauh (bukan max |x|, |z|) agar tetap memuat mask untuk yaw placement apa pun
 * (kamera bake sejajar sumbu dunia, utara di atas).
 */
export function maskHalfExtent(mask) {
  return Math.max(...mask.map(([x, z]) => Math.hypot(x, z)));
}

/** Salinan definisi region dengan placement lain (uji placement non-identitas, mode dev). */
export function withPlacement(region, placement) {
  return defineRegion({ ...region, placement });
}
```

Ganti `src/regions/stadion/index.js:58-63`:

```js
export const stadionRegion = defineRegion({
  id: STADION_ID,
  placement: STADION_PLACEMENT,
  mask: STADION_MASK,
  build: async (ctx) => buildStadion(ctx ?? {}),
});
```
menjadi:
```js
export const stadionRegion = defineRegion({
  id: STADION_ID,
  placement: STADION_PLACEMENT,
  mask: STADION_MASK,
  activation: { persistent: true }, // selalu terpasang (spec UNRI §4.3); isi region tidak berubah di M0
  build: async (ctx) => buildStadion(ctx ?? {}),
});
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/region.test.js tests/compositeCollider.test.js tests/placement.test.js tests/mountRegion.test.js
```
Expected: semua lulus (`tests/region.test.js` 15 tes: 9 lama + 6 baru).

- [ ] **Step 5: Lint**

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/regions/Region.js src/regions/stadion/index.js tests/region.test.js
```
```bash
git commit -m "feat(regions): kontrak Region M0 (activation persistent/streaming ber-histeresis, proxy, povs, pads) + stadion persistent"
```

---

## Task 6: `mountRegion` — ctx `terrain`, `heightAtLocal`, `schedule` (TDD)

**Files:**
- Modify: `src/app/mountRegion.js` (seluruh berkas, 85 baris)
- Test: `tests/mountRegion.test.js` (tambah impor setelah baris 7; tambah describe di akhir berkas, setelah baris 156)

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan setelah baris 7 (`import { stadionRegion } …`) di `tests/mountRegion.test.js`:

```js
import { createScheduler } from '../src/engine/scheduler.js';
import { FLAT_TERRAIN } from '../src/app/terrainService.js';
```

Tambahkan di akhir berkas:

```js
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Region minimal sah (tanpa sistem) yang memanggil `onBuild(ctx)` saat build. */
function ctxRegion(id, onBuild = () => {}) {
  return defineRegion({
    id,
    placement: { x: 100, z: -50, yaw: 0.3 },
    mask: square,
    build: async (ctx) => {
      onBuild(ctx);
      const group = new THREE.Group();
      return validateBuild({
        group,
        colliders: { isWalkable: () => true, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [],
        dispose: () => { group.removeFromParent(); ctx.scope.dispose(); },
      }, id);
    },
  });
}

describe('mountRegion: ctx M0 (terrain, heightAtLocal, schedule)', () => {
  it('ctx.terrain default datar; heightAtLocal mengubah titik lokal ke dunia lewat placement', async () => {
    let seen = null;
    await mountRegion(fakeApp(), ctxRegion('datar', (ctx) => { seen = ctx; }), { logger: quiet });
    expect(seen.terrain).toBe(FLAT_TERRAIN);
    expect(seen.heightAtLocal(3, 4)).toBe(0);
    const calls = [];
    const terrain = { ...FLAT_TERRAIN, heightAt: (x, z) => { calls.push([x, z]); return 7; } };
    await mountRegion(fakeApp(), ctxRegion('miring', (ctx) => { seen = ctx; }), { terrain, logger: quiet });
    expect(seen.terrain).toBe(terrain);
    expect(seen.heightAtLocal(10, 0)).toBe(7);
    expect(calls[0][0]).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(calls[0][1]).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
  });

  it('tanpa scheduler: ctx.schedule menjalankan task langsung (generator sampai habis)', async () => {
    const log = [];
    await mountRegion(fakeApp(), ctxRegion('langsung', (ctx) => {
      ctx.schedule(function* kerja() { log.push(1); yield; log.push(2); });
      log.push('build');
    }), { logger: quiet });
    expect(log).toEqual([1, 2, 'build']);
  });

  it('dengan scheduler: task milik "region:<id>", ready menunggu antrean habis', async () => {
    const scheduler = createScheduler({ now: () => 0 });
    const log = [];
    const m = await mountRegion(fakeApp(), ctxRegion('antre', (ctx) => {
      ctx.schedule(function* kerja() { log.push(1); yield; log.push(2); });
    }), { scheduler, logger: quiet });
    let ready = false;
    m.ready.then(() => { ready = true; });
    await tick();
    expect(scheduler.pending('region:antre')).toBe(1);
    expect(ready).toBe(false);
    scheduler.update();
    await tick();
    expect(log).toEqual([1, 2]);
    expect(ready).toBe(true);
  });

  it('unmount membatalkan antrean region; ready tetap selesai', async () => {
    const scheduler = createScheduler({ now: () => 0 });
    const log = [];
    const m = await mountRegion(fakeApp(), ctxRegion('batal', (ctx) => { ctx.schedule(() => log.push('jalan')); }), { scheduler, logger: quiet });
    m.unmount();
    expect(scheduler.pending()).toBe(0);
    scheduler.update();
    await m.ready;
    expect(log).toEqual([]);
  });

  it('build yang melempar membatalkan task yang sudah dijadwalkannya', async () => {
    const scheduler = createScheduler({ now: () => 0 });
    const def = defineRegion({
      id: 'rusak', placement: { x: 0, z: 0, yaw: 0 }, mask: square,
      build: async (ctx) => { ctx.schedule(() => {}); throw new Error('build rusak'); },
    });
    await expect(mountRegion(fakeApp(), def, { scheduler, logger: quiet })).rejects.toThrow(/build rusak/);
    expect(scheduler.pending()).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/mountRegion.test.js
```
Expected: FAIL pada 5 tes baru (`seen.terrain` undefined, `ctx.schedule is not a function`); 7 tes lama lulus.

- [ ] **Step 3: Implementasi** — ganti seluruh isi `src/app/mountRegion.js`:

```js
/**
 * Pasang region handmade ke App dan bongkar lagi (Plan C, I1/I2; perluasan M0 UNRI):
 * build (ResourceScope milik region; ctx + terrain/heightAtLocal/schedule) → placement pada region.group →
 * scene + freezeStatic → registry emissive/basah/lampu → sistem region. unmount() membatalkan antrean
 * scheduler milik region lalu membongkar TERBALIK: sistem dicabut (dispose dipanggil SystemRunner), registry
 * dilepas, lalu region.dispose() (disposeTree + scope). Build yang melempar melepas scope & antreannya;
 * kegagalan setelah build menggulung balik pemasangan. `ready` selesai setelah konten belakangan (GLB) DAN
 * antrean scheduler region habis.
 */
import { createResourceScope } from '../engine/ResourceScope.js';
import { runTaskNow } from '../engine/scheduler.js';
import { freezeStatic } from '../world/util/freezeStatic.js';
import { toWorld } from '../geo/regionTransform.js';
import { FLAT_TERRAIN } from './terrainService.js';

/** Terapkan placement {x, z, yaw} ke grup region (rotasi sumbu +Y = regionTransform.toWorld). */
export function applyPlacement(group, placement) {
  group.position.set(placement.x, 0, placement.z);
  group.rotation.set(0, placement.yaw, 0);
  group.updateMatrix();
  return group;
}

/** Antrean task region: scheduler bersama (time-sliced) atau langsung (tanpa scheduler: tes/alat). */
function regionQueue(scheduler, owner) {
  if (!scheduler) {
    return {
      schedule: (task) => { runTaskNow(task); return { cancel() {} }; },
      cancel() {},
      idle: () => Promise.resolve(),
    };
  }
  return {
    schedule: (task) => scheduler.schedule(task, { owner }),
    cancel: () => scheduler.cancelOwner(owner),
    idle: () => scheduler.whenIdle(owner),
  };
}

/**
 * @param {{scene: import('three').Scene, renderer?: object, camera?: object, timer?: object,
 *   addSystem(s: object): object, removeSystem(id: string): boolean}} app
 * @param {{id: string, placement: {x:number,z:number,yaw:number}, build(ctx: object): Promise<object>}} def
 * @param {{store?: object|null, time?: {registerEmissive(root: object): () => boolean,
 *   registerLamps?(opts: object): () => boolean}|null, weather?: {registerWet(root: object): () => boolean}|null,
 *   terrain?: {heightAt(x: number, z: number): number}, scheduler?: {schedule: Function, cancelOwner: Function, whenIdle: Function}|null,
 *   createScope?: (name: string) => object, logger?: {error: (...args: unknown[]) => void}}} [opts]
 * @returns {Promise<{def: object, region: object, ready: Promise<unknown>, mounted: boolean, unmount(): void}>}
 */
export async function mountRegion(app, def, {
  store = null, time = null, weather = null, terrain = FLAT_TERRAIN, scheduler = null, createScope = createResourceScope, logger = console,
} = {}) {
  const scope = createScope(`region:${def.id}`);
  const queue = regionQueue(scheduler, `region:${def.id}`);
  const heightAtLocal = (lx, lz) => {
    const w = toWorld(def.placement, lx, lz);
    return terrain.heightAt(w.x, w.z);
  };
  let region;
  try {
    region = await def.build({
      scene: app.scene, renderer: app.renderer, camera: app.camera, scope, store, clock: app.timer, placement: def.placement,
      terrain, heightAtLocal, schedule: queue.schedule,
    });
  } catch (err) {
    queue.cancel(); // task yang sempat dijadwalkan build tidak boleh menyentuh region gagal
    scope.dispose(); // build gagal: scope tidak boleh bocor
    throw err;
  }
  const undo = []; // LIFO
  const unwind = () => {
    while (undo.length) {
      const fn = undo.pop();
      try {
        fn();
      } catch (err) {
        logger.error(`Region "${def.id}": pembongkaran gagal (dilanjutkan):`, err);
      }
    }
  };
  try {
    undo.push(() => region.dispose());
    applyPlacement(region.group, def.placement);
    app.scene.add(region.group);
    freezeStatic(region.group);
    if (time) undo.push(time.registerEmissive(region.group));
    if (time?.registerLamps && region.nightLights) undo.push(time.registerLamps({ ...region.nightLights, lensRoot: region.group }));
    if (weather) undo.push(weather.registerWet(region.group));
    for (const system of region.systems) {
      app.addSystem(system);
      undo.push(() => app.removeSystem(system.id));
    }
  } catch (err) {
    queue.cancel();
    unwind();
    throw err;
  }
  let mounted = true;
  // Konten yang datang belakangan (model GLB) baru terdaftar setelah siap, dan hanya bila masih terpasang.
  // ready juga menunggu antrean scheduler region (build inkremental) habis.
  const ready = Promise.resolve(region.ready).then(async (result) => {
    await queue.idle();
    if (mounted && time && region.lateRoot) undo.push(time.registerEmissive(region.lateRoot));
    return result;
  });
  return {
    def,
    region,
    ready,
    get mounted() { return mounted; },
    unmount() {
      if (!mounted) return;
      mounted = false;
      queue.cancel();
      unwind();
    },
  };
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/mountRegion.test.js tests/lifecycle.test.js
```
Expected: `tests/mountRegion.test.js` 12 tes lulus (7 lama + 5 baru), `tests/lifecycle.test.js` lulus.

- [ ] **Step 5: Lint**

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/mountRegion.js tests/mountRegion.test.js
```
```bash
git commit -m "feat(app): mountRegion menyuntik ctx.terrain, heightAtLocal, schedule; ready menunggu antrean region; unmount membatalkannya"
```

---

## Task 7: Collider komposit dinamis (TDD)

**Files:**
- Modify: `src/core/Collider.js` (tambah fungsi setelah `createCompositeCollider`, sebelum baris `const TRAPPED_EPS = 1e-6;`)
- Test: `tests/compositeCollider.test.js` (ubah impor baris 2; tambah describe di akhir berkas)

- [ ] **Step 1: Tulis tes yang gagal**

Ganti baris 2 `tests/compositeCollider.test.js`:
```js
import { createCollider, createCompositeCollider, localized } from '../src/core/Collider.js';
```
menjadi:
```js
import { createCollider, createCompositeCollider, createDynamicCompositeCollider, localized } from '../src/core/Collider.js';
```

Tambahkan di akhir berkas:

```js
describe('collider komposit dinamis (M0)', () => {
  it('region & fallback dapat diganti; fungsi tetap sama (aman disimpan CameraRig/sepeda)', () => {
    const region = defineRegion({ id: 'uji', placement: { x: 100, z: 0, yaw: 0 }, mask: square, build: async () => ({}) });
    const blocked = { isWalkable: () => false, isCameraClear: () => false };
    const dyn = createDynamicCompositeCollider();
    const walk = dyn.isWalkable;
    expect(walk(100, 0)).toBe(true); // tanpa region & fallback: terbuka
    dyn.setRegions([{ region, colliders: blocked }]);
    expect(walk(100, 0)).toBe(false);
    expect(dyn.isCameraClear(100, 0)).toBe(false);
    expect(walk(0, 0)).toBe(true);
    dyn.setFallback(blocked);
    expect(walk(0, 0)).toBe(false);
    dyn.setRegions([]);
    expect(walk(100, 0)).toBe(false); // kini lewat fallback
    expect(dyn.penetration(Number.NaN, 0)).toBe(Infinity);
  });

  it('input tidak sah ditolak', () => {
    const dyn = createDynamicCompositeCollider();
    expect(() => dyn.setRegions(null)).toThrow(TypeError);
    expect(() => dyn.setFallback({})).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/compositeCollider.test.js
```
Expected: FAIL — `createDynamicCompositeCollider is not a function`.

- [ ] **Step 3: Implementasi** — sisipkan di `src/core/Collider.js` tepat sebelum baris `const TRAPPED_EPS = 1e-6;`:

```js
/**
 * Collider komposit DINAMIS (M0 multi-region): daftar region aktif dan fallback dapat diganti saat
 * region dipasang/dilepas (regionManager memanggil setRegions). Fungsi isWalkable/isCameraClear/penetration
 * stabil (aman disimpan CameraRig & collider sepeda) dan selalu membaca komposit terbaru.
 * @param {{fallback?: {isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}} [opts]
 */
export function createDynamicCompositeCollider({ fallback = OPEN } = {}) {
  let regions = [];
  let fb = fallback;
  let inner = createCompositeCollider({ regions, fallback: fb });
  const rebuild = () => { inner = createCompositeCollider({ regions, fallback: fb }); };
  return Object.freeze({
    isWalkable: (x, z) => inner.isWalkable(x, z),
    isCameraClear: (x, z) => inner.isCameraClear(x, z),
    penetration: (x, z) => inner.penetration(x, z),
    /** @param {Array<{region:{placement:object, mask:Array<[number,number]>}, colliders:object}>} list */
    setRegions(list) {
      if (!Array.isArray(list)) throw new TypeError('setRegions: list harus array {region, colliders}');
      regions = [...list];
      rebuild();
    },
    setFallback(next) {
      if (typeof next?.isWalkable !== 'function' || typeof next?.isCameraClear !== 'function') {
        throw new TypeError('setFallback: collider butuh isWalkable(x,z) dan isCameraClear(x,z)');
      }
      fb = next;
      rebuild();
    },
  });
}

```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/compositeCollider.test.js tests/collider.test.js
```
Expected: semua lulus.

- [ ] **Step 5: Commit**

```bash
git add src/core/Collider.js tests/compositeCollider.test.js
```
```bash
git commit -m "feat(core): collider komposit dinamis (setRegions/setFallback) untuk region yang dipasang-lepas"
```

---

## Task 8: Minimap — base layer per region (`setBaseLayer`/`removeBaseLayer`)

Wiring UI (Minimap2D) + matematika murni yang dites (`layerInView`, `layerTransform`).

**Files:**
- Modify: `src/shared/minimapMath.js` (tambah di akhir berkas)
- Modify: `src/ui/Minimap2D.js` (seluruh berkas, 160 baris)
- Test: `tests/minimapMath.test.js` (ubah impor baris 2; tambah describe di akhir berkas)

- [ ] **Step 1: Tulis tes yang gagal**

Ganti baris 2 `tests/minimapMath.test.js`:
```js
import { sourceRect, projectToView, clampToEdge, flipRowsInPlace, snapRect } from '../src/shared/minimapMath.js';
```
menjadi:
```js
import {
  sourceRect, projectToView, clampToEdge, flipRowsInPlace, snapRect, layerInView, layerTransform,
} from '../src/shared/minimapMath.js';
import { toWorld } from '../src/geo/regionTransform.js';
```

Tambahkan di akhir berkas:

```js
describe('base layer region (M0)', () => {
  /** Terapkan matriks kanvas [a,b,c,d,e,f] ke titik (u, v). */
  const apply = (m, u, v) => ({ x: m[0] * u + m[2] * v + m[4], y: m[1] * u + m[3] * v + m[5] });

  it('layerTransform yaw 0: titik lokal jatuh di proyeksi titik dunia yang sama', () => {
    const layer = { center: { x: 100, z: -50 }, half: 300, yaw: 0 };
    const focus = { x: 120, z: -40 };
    const p = apply(layerTransform(layer, focus, 160, 400), 10, 20);
    const v = projectToView({ x: 110, z: -30 }, focus, 160, 400);
    expect(p.x).toBeCloseTo(v.x, 9);
    expect(p.y).toBeCloseTo(v.y, 9);
  });

  it('layerTransform yaw ≠ 0: mengikuti regionTransform.toWorld', () => {
    const layer = { center: { x: 100, z: -50 }, half: 300, yaw: 0.7 };
    const focus = { x: 0, z: 0 };
    const p = apply(layerTransform(layer, focus, 160, 400), 10, 20);
    const v = projectToView(toWorld({ x: 100, z: -50, yaw: 0.7 }, 10, 20), focus, 160, 400);
    expect(p.x).toBeCloseTo(v.x, 9);
    expect(p.y).toBeCloseTo(v.y, 9);
  });

  it('layerInView: hanya layer yang beririsan jendela; layer diputar memakai jangkauan diagonal', () => {
    const layer = { center: { x: 0, z: 0 }, half: 100, yaw: 0 };
    expect(layerInView(layer, { x: 250, z: 0 }, 160)).toBe(true);
    expect(layerInView(layer, { x: 260, z: 0 }, 160)).toBe(false);
    expect(layerInView(layer, { x: 0, z: -261 }, 160)).toBe(false);
    expect(layerInView({ ...layer, yaw: 0.5 }, { x: 260, z: 0 }, 160)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/minimapMath.test.js
```
Expected: FAIL — `layerTransform is not a function`.

- [ ] **Step 3: Implementasi matematika** — tambahkan di akhir `src/shared/minimapMath.js`:

```js

/**
 * Base layer region beririsan dengan jendela ±halfExtent di sekitar fokus? Layer berpusat `center`
 * (dunia) bersisi 2×half; layer diputar (yaw ≠ 0) memakai jangkauan diagonal (konservatif).
 * @param {{center:{x:number,z:number}, half:number, yaw:number}} layer
 */
export function layerInView(layer, focus, halfExtent) {
  const reach = (layer.yaw ? layer.half * Math.SQRT2 : layer.half) + halfExtent;
  return Math.abs(fin(focus?.x) - layer.center.x) < reach && Math.abs(fin(focus?.z) - layer.center.z) < reach;
}

/**
 * Matriks kanvas [a, b, c, d, e, f] (CanvasRenderingContext2D.setTransform) yang memetakan koordinat
 * lokal layer (lx, lz) — kanvas layer digambar di (−half, −half, 2·half, 2·half) — ke piksel tampilan
 * dengan fokus di tengah. Rotasi mengikuti regionTransform.toWorld (yaw sumbu +Y, utara = −z di atas).
 * @param {{center:{x:number,z:number}, half:number, yaw:number}} layer
 * @returns {[number, number, number, number, number, number]}
 */
export function layerTransform(layer, focus, halfExtent, viewPx) {
  const k = viewPx / (2 * halfExtent);
  const c = Math.cos(layer.yaw);
  const s = Math.sin(layer.yaw);
  return [
    k * c, -k * s, k * s, k * c,
    viewPx / 2 + (layer.center.x - fin(focus?.x)) * k,
    viewPx / 2 + (layer.center.z - fin(focus?.z)) * k,
  ];
}
```

- [ ] **Step 4: Jalankan tes matematika, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/minimapMath.test.js tests/placement.test.js
```
Expected: semua lulus.

- [ ] **Step 5: Implementasi Minimap2D** — ganti seluruh isi `src/ui/Minimap2D.js`:

```js
/**
 * Minimap 2D, lapisan dari bawah ke atas: (1) tile kota (canvas per tile dari city/tileMinimap.js) dan
 * (2) base layer per region (M0 multi-region): peta dasar tampak atas yang di-bake SEKALI dari scene
 * lewat kamera ortografis (App.bakeMinimap), digambar sesuai urutan pertama kali dipasang. Per frame hanya
 * `drawImage` jendela di sekitar pemain + marker pada canvas 2D kecil. Tanpa render 3D tambahan, tidak
 * terpengaruh siang/malam, dan murah. Utara = atas.
 */
import {
  clampToEdge, layerInView, layerTransform, projectToView, snapRect, sourceRect, worldRectToView,
} from '../shared/minimapMath.js';

const BG = '#2f5b32';
const REDRAW_SEC = 1 / 15;     // 15 Hz cukup untuk peta
const EDGE_MARGIN = 12;
const GOAL_COLOR = '#f2b705';
const BIKE_COLOR = '#e53935';
/** Id base layer yang dipakai alias lama setBase() (peta dasar region stadion). */
export const LEGACY_BASE_ID = 'stadion';

export class Minimap2D {
  /**
   * @param {HTMLElement} root
   * @param {{size?:number, halfExtent?:number}} [opts] size: sisi (px CSS); halfExtent: ±meter yang tampak
   */
  constructor(root, { size = 200, halfExtent = 160 } = {}) {
    this.size = size;
    this.halfExtent = halfExtent;
    /** @type {Map<string, {canvas: CanvasImageSource & {width:number}, center:{x:number,z:number}, half:number, yaw:number}>} */
    this.layers = new Map();
    this.tileLayer = null;
    this._last = -Infinity;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap2d';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Minimap: utara di atas, sepeda di tengah');
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx = this.canvas.getContext?.('2d') ?? null;
    this.dpr = dpr;
    root.append(this.canvas);
  }

  /**
   * Pasang/ganti base layer region. Urutan gambar = urutan pertama kali id dipasang.
   * @param {string} id id region
   * @param {CanvasImageSource & {width:number}} canvas peta dasar (yaw 0: utara di atas)
   * @param {{center?:{x:number,z:number}, half:number, yaw?:number}} opts center = pusat area bake (dunia),
   *   half = setengah sisi area (m), yaw = rotasi layer (rad, konvensi placement; bake App selalu 0)
   */
  setBaseLayer(id, canvas, { center = { x: 0, z: 0 }, half, yaw = 0 } = {}) {
    if (typeof id !== 'string' || id === '') throw new TypeError('Minimap2D.setBaseLayer: id wajib string');
    if (!canvas || !(half > 0) || !Number.isFinite(center?.x) || !Number.isFinite(center?.z) || !Number.isFinite(yaw)) {
      throw new TypeError(`Minimap2D.setBaseLayer("${id}"): canvas, half > 0, center {x,z}, dan yaw angka wajib`);
    }
    const next = new Map(this.layers);
    next.set(id, Object.freeze({ canvas, center: Object.freeze({ x: center.x, z: center.z }), half, yaw }));
    this.layers = next;
    this._last = -Infinity;
  }

  /** @returns {boolean} true bila layer ada lalu dilepas */
  removeBaseLayer(id) {
    if (!this.layers.has(id)) return false;
    const next = new Map(this.layers);
    next.delete(id);
    this.layers = next;
    this._last = -Infinity;
    return true;
  }

  /**
   * Alias lama (sebelum M0): peta dasar region stadion.
   * @param {CanvasImageSource & {width:number}} baseCanvas peta dasar
   * @param {number} worldHalf setengah sisi area bake (m)
   * @param {{x:number, z:number}} [center] pusat area bake di frame dunia (placement region)
   */
  setBase(baseCanvas, worldHalf, center = { x: 0, z: 0 }) {
    this.setBaseLayer(LEGACY_BASE_ID, baseCanvas, { center, half: worldHalf, yaw: 0 });
  }

  /** @param {{tilesInView(focus:{x:number,z:number}, halfExtent:number): Array<{canvas: CanvasImageSource, bounds: object}>}|null} layer */
  setTileLayer(layer) {
    this.tileLayer = layer;
    this._last = -Infinity;
  }

  setVisible(visible) { this.canvas.classList.toggle('hidden', !visible); }

  get visible() { return !this.canvas.classList.contains('hidden'); }

  /**
   * @param {number} time detik (untuk throttle dan denyut penanda)
   * @param {{focus:{x:number,z:number}, yaw:number, goal?:{x:number,z:number}|null,
   *   getPins?:()=>{x:number,z:number,color:string}[]}} s
   */
  update(time, { focus, yaw = 0, goal = null, getPins = null }) {
    const ctx = this.ctx;
    if (!ctx || !this.visible || time - this._last < REDRAW_SEC) return;
    this._last = time;
    const S = this.canvas.width;
    const k = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, S, S);
    for (const t of this.tileLayer?.tilesInView(focus, this.halfExtent) ?? []) {
      const r = snapRect(worldRectToView(t.bounds, focus, this.halfExtent, S));
      ctx.drawImage(t.canvas, r.x, r.y, r.w, r.h);
    }
    for (const layer of this.layers.values()) this.#layer(layer, focus, S);
    ctx.setTransform(k, 0, 0, k, 0, 0); // koordinat tampilan dalam px CSS
    for (const p of getPins?.() ?? []) this.#pin(p, focus);
    if (goal) this.#goal(goal, focus, time);
    this.#bike(yaw);
    this.#north();
  }

  /** Satu base layer: yaw 0 = jendela sumber (jalur lama, paritas); yaw ≠ 0 = gambar penuh bertransformasi. */
  #layer(l, focus, S) {
    if (!layerInView(l, focus, this.halfExtent)) return;
    const ctx = this.ctx;
    if (l.yaw === 0) {
      const r = sourceRect(focus, this.halfExtent, l.half, l.canvas.width, l.center);
      ctx.drawImage(l.canvas, r.sx, r.sy, r.sw, r.sh, 0, 0, S, S);
      return;
    }
    const m = layerTransform(l, focus, this.halfExtent, S);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(l.canvas, -l.half, -l.half, 2 * l.half, 2 * l.half);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  #pin(p, focus) {
    const v = projectToView(p, focus, this.halfExtent, this.size);
    if (!v.inside) return;
    const ctx = this.ctx;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  #goal(goal, focus, time) {
    const v = projectToView(goal, focus, this.halfExtent, this.size);
    const c = clampToEdge(v.x, v.y, this.size, EDGE_MARGIN);
    const ctx = this.ctx;
    const pulse = 1 + 0.18 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = GOAL_COLOR;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    if (v.inside) {
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeRect(-5, -5, 10, 10);
    } else {
      ctx.rotate(c.angle); // panah ke arah tujuan di luar peta
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  #bike(yaw) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.size / 2, this.size / 2);
    ctx.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw))); // arah hadap: (sin yaw, cos yaw) di (x, z) layar
    ctx.fillStyle = BIKE_COLOR;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  #north() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('U', this.size / 2, 11);
  }
}
```

- [ ] **Step 6: Lint + build** (Minimap2D tidak dites unit: DOM/canvas)

```bash
npm run lint
```
Expected: exit 0.

```bash
npm run build
```
Expected: `✓ built in` tanpa error. (`main.js` masih memanggil `minimap.setBase(...)` — alias menjaga perilaku sampai Task 14.)

- [ ] **Step 7: Commit**

```bash
git add src/shared/minimapMath.js src/ui/Minimap2D.js tests/minimapMath.test.js
```
```bash
git commit -m "feat(ui): minimap dengan base layer per region (setBaseLayer/removeBaseLayer, yaw), setBase jadi alias id stadion"
```

---

## Task 9: Region uji `dummy`

Region kecil yang memakai SEMUA fitur M0 (streaming, proxy, POV, minimap layer, build inkremental via `ctx.schedule`); dipakai tes manager (Task 10) dan smoke dev `?dummyRegion=1` (Task 15).

**Files:**
- Create: `src/app/dummyRegion.js`
- Test: `tests/dummyRegion.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/dummyRegion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDummyRegion, DUMMY_BOXES, DUMMY_REGION_ID } from '../src/app/dummyRegion.js';
import { mountRegion } from '../src/app/mountRegion.js';
import { createScheduler } from '../src/engine/scheduler.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { createRegionFrame } from '../src/geo/regionTransform.js';

const quiet = { error() {}, warn() {} };
const fakeApp = () => ({ scene: new THREE.Scene(), addSystem() {}, removeSystem() { return true; } });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('region dummy (M0)', () => {
  it('streaming 700/900 di sekitar pusat, satu POV dunia, proxy ≤ 8 mesh', () => {
    const def = createDummyRegion({ x: 10, z: 20 });
    expect(def.id).toBe(DUMMY_REGION_ID);
    expect(def.activation).toEqual({ persistent: false, center: { x: 10, z: 20 }, mountRadius: 700, unmountRadius: 900 });
    expect(def.povs.map((p) => p.id)).toEqual(['atas']);
    const pose = def.povs[0].pose(createRegionFrame(def.placement), { time: 0 });
    expect([pose.tx, pose.tz]).toEqual([10, 20]);
    const scope = createResourceScope('uji-proxy');
    const proxy = def.proxy({ scope });
    let meshes = 0;
    proxy.group.traverse((o) => { if (o.isMesh) meshes += 1; });
    expect(meshes).toBeGreaterThan(0);
    expect(meshes).toBeLessThanOrEqual(8);
    scope.dispose();
  });

  it('build inkremental: kotak dipasang lewat scheduler, ready menunggu antrean habis', async () => {
    const scheduler = createScheduler({ budgetMs: 0, now: () => 0 }); // satu potongan per update
    const m = await mountRegion(fakeApp(), createDummyRegion(), { scheduler, logger: quiet });
    let ready = false;
    m.ready.then(() => { ready = true; });
    expect(m.region.group.children).toHaveLength(1); // tanah saja
    scheduler.update();
    expect(m.region.group.children).toHaveLength(2);
    while (scheduler.pending()) scheduler.update();
    await tick();
    expect(m.region.group.children).toHaveLength(1 + DUMMY_BOXES);
    expect(ready).toBe(true);
    m.unmount();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/dummyRegion.test.js
```
Expected: FAIL — modul `src/app/dummyRegion.js` tidak ditemukan.

- [ ] **Step 3: Implementasi** — buat `src/app/dummyRegion.js`:

```js
/**
 * Region uji "dummy" (M0): membuktikan kontrak multi-region tanpa konten kampus — streaming ber-histeresis,
 * proxy (1 draw call), POV region, base layer minimap, dan build inkremental lewat ctx.schedule (satu kotak per
 * potongan scheduler). Dipakai tes dan mode dev `?dummyRegion=1` (pusat default (0, 1100): selatan stadion,
 * dekat calon zona sekre). Bukan konten produksi (main.js memuatnya hanya di mode dev).
 */
import * as THREE from 'three';
import { defineRegion, validateBuild } from '../regions/Region.js';
import { disposeTree } from '../engine/disposeTree.js';
import { RENDER_LAYERS } from '../config/constants.js';

export const DUMMY_REGION_ID = 'dummy';
export const DUMMY_HALF = 40;   // setengah sisi mask persegi (m)
export const DUMMY_BOXES = 12;  // kotak yang dipasang inkremental
const RING_RADIUS = 25;
const BOX = 6;
const GROUND_LIFT = 0.05;       // di atas tanah tile kota (hindari z-fighting)
const POV_HEIGHT = 120;
const POV_BACK = 90;

/**
 * @param {{id?: string, x?: number, z?: number, yaw?: number, mountRadius?: number, unmountRadius?: number, boxes?: number}} [opts]
 */
export function createDummyRegion({
  id = DUMMY_REGION_ID, x = 0, z = 1100, yaw = 0, mountRadius = 700, unmountRadius = 900, boxes = DUMMY_BOXES,
} = {}) {
  return defineRegion({
    id,
    placement: { x, z, yaw },
    mask: [[-DUMMY_HALF, -DUMMY_HALF], [DUMMY_HALF, -DUMMY_HALF], [DUMMY_HALF, DUMMY_HALF], [-DUMMY_HALF, DUMMY_HALF]],
    activation: { center: { x, z }, mountRadius, unmountRadius },
    proxy: ({ scope }) => {
      const mesh = new THREE.Mesh(
        scope.get('dummy.proxy.geo', () => new THREE.BoxGeometry(DUMMY_HALF * 2, BOX, DUMMY_HALF * 2)),
        scope.get('dummy.proxy.mat', () => new THREE.MeshBasicMaterial({ color: 0x8a8f99 })),
      );
      mesh.position.y = BOX / 2;
      const group = new THREE.Group();
      group.name = `proxy:${id}`;
      group.add(mesh);
      return { group, dispose() {} }; // sumber daya milik scope proxy; manager yang melepasnya
    },
    povs: [{
      id: 'atas',
      label: 'Region uji dari atas',
      pose: (frame) => {
        const c = frame.toWorld(0, 0);
        return { px: c.x, py: POV_HEIGHT, pz: c.z + POV_BACK, tx: c.x, ty: 0, tz: c.z };
      },
    }],
    build: async ({ scope, schedule, heightAtLocal }) => {
      if (!scope || typeof schedule !== 'function') throw new TypeError(`Region "${id}": ctx.scope dan ctx.schedule wajib`);
      const group = new THREE.Group();
      group.name = `region:${id}`;
      const ground = new THREE.Mesh(
        scope.get('dummy.ground.geo', () => new THREE.PlaneGeometry(DUMMY_HALF * 2, DUMMY_HALF * 2).rotateX(-Math.PI / 2)),
        scope.get('dummy.ground.mat', () => new THREE.MeshStandardMaterial({ color: 0x9fb38a })),
      );
      ground.position.y = GROUND_LIFT;
      ground.layers.enable(RENDER_LAYERS.minimap);
      group.add(ground);
      const boxGeo = scope.get('dummy.box.geo', () => new THREE.BoxGeometry(BOX, BOX, BOX));
      const boxMat = scope.get('dummy.box.mat', () => new THREE.MeshStandardMaterial({ color: 0xd9a441 }));
      schedule(function* pasangKotak() {
        for (let i = 0; i < boxes; i += 1) {
          const a = (i / boxes) * Math.PI * 2;
          const lx = Math.cos(a) * RING_RADIUS;
          const lz = Math.sin(a) * RING_RADIUS;
          const box = new THREE.Mesh(boxGeo, boxMat);
          box.position.set(lx, (heightAtLocal?.(lx, lz) ?? 0) + BOX / 2, lz);
          box.layers.enable(RENDER_LAYERS.minimap);
          group.add(box); // ditambah setelah freezeStatic: matriksnya tetap diperbarui normal
          yield;
        }
      });
      return validateBuild({
        group,
        colliders: { isWalkable: () => true, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [],
        dispose() {
          group.removeFromParent();
          disposeTree(group, { scope });
          scope.dispose();
        },
      }, id);
    },
  });
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/dummyRegion.test.js
```
Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Lint & commit**

```bash
npm run lint
```
Expected: exit 0.

```bash
git add src/app/dummyRegion.js tests/dummyRegion.test.js
```
```bash
git commit -m "feat(app): region uji dummy (streaming, proxy, POV, layer minimap, build inkremental via scheduler)"
```

---

## Task 10: `regionManager` (TDD — histeresis, LIFO, maks mount per 0,5 s, tanpa bocor)

**Files:**
- Create: `src/app/regionManager.js`
- Test: `tests/regionManager.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/regionManager.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createRegionManager, MOUNT_INTERVAL_MS, MOUNT_RETRY_MS, MINIMAP_BAKE_MARGIN,
} from '../src/app/regionManager.js';
import { createDummyRegion, DUMMY_BOXES } from '../src/app/dummyRegion.js';
import { defineRegion, validateBuild } from '../src/regions/Region.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { createScheduler } from '../src/engine/scheduler.js';
import { createDynamicCompositeCollider } from '../src/core/Collider.js';

const quiet = { error() {}, warn() {} };
const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeApp() {
  const runner = createSystemRunner({ logger: quiet });
  const bakes = [];
  return {
    scene: new THREE.Scene(),
    runner,
    bakes,
    addSystem: (s) => runner.add(s),
    removeSystem: (id) => runner.remove(id),
    bakeMinimap: (half, center) => { bakes.push({ half, x: center.x, z: center.z }); return { width: 64 }; },
  };
}

/** Region kecil (satu mesh, satu sistem); `fail()` true → build melempar. */
function simpleRegion(id, { placement = { x: 0, z: 0, yaw: 0 }, activation = { persistent: true }, fail = () => false } = {}) {
  return defineRegion({
    id,
    placement,
    mask: square,
    activation,
    build: async ({ scope }) => {
      if (fail()) throw new Error(`build ${id} rusak`);
      const group = new THREE.Group();
      group.name = `region:${id}`;
      group.add(new THREE.Mesh(scope.get('g', () => new THREE.BoxGeometry()), scope.get('m', () => new THREE.MeshBasicMaterial())));
      return validateBuild({
        group,
        colliders: { isWalkable: () => false, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [{ id: `${id}.sistem`, phase: 'world', update() {} }],
        dispose() { group.removeFromParent(); scope.dispose(); },
      }, id);
    },
  });
}

/** Manager + jam palsu + scheduler yang menghabiskan antrean dalam satu update. */
function setup(opts = {}) {
  const app = fakeApp();
  const clock = { t: 0 };
  const scheduler = createScheduler({ now: () => 0, logger: quiet });
  const scopes = [];
  const createScope = (name) => {
    const s = createResourceScope(name, { logger: quiet });
    scopes.push(s);
    return s;
  };
  const rm = createRegionManager({ app, scheduler, createScope, now: () => clock.t, logger: quiet, ...opts });
  /** Satu "frame": majukan jam, update pada `focus`, tunggu mount, habiskan antrean scheduler. */
  const frame = async (focus, advanceMs = 0) => {
    clock.t += advanceMs;
    rm.update(focus);
    await rm.flush();
    scheduler.update();
    await tick();
  };
  return { app, clock, scheduler, scopes, rm, frame };
}

const ids = (rm) => rm.active().map((a) => a.def.id);

describe('regionManager: persistent', () => {
  it('register persistent langsung memasang; active/frameOf/regionAt/handleOf', async () => {
    const { rm, app } = setup();
    const handle = await rm.register(simpleRegion('tetap', { placement: { x: 100, z: 0, yaw: 0 } }));
    expect(handle.mounted).toBe(true);
    expect(ids(rm)).toEqual(['tetap']);
    expect(rm.active()[0].region).toBe(handle.region);
    expect(rm.handleOf('tetap')).toBe(handle);
    expect(rm.handleOf('hilang')).toBeNull();
    expect(rm.frameOf('tetap').toWorld(1, 0).x).toBeCloseTo(101, 9);
    expect(rm.frameOf('hilang')).toBeNull();
    expect(rm.regionAt(105, 0)).toBe('tetap');
    expect(rm.regionAt(0, 0)).toBeNull();
    expect(app.runner.ids).toEqual(['tetap.sistem']);
  });

  it('id ganda ditolak; region persistent tidak dilepas oleh update sejauh apa pun', async () => {
    const { rm, frame } = setup();
    await rm.register(simpleRegion('tetap'));
    expect(() => rm.register(simpleRegion('tetap'))).toThrow(/sudah terdaftar/);
    expect(() => rm.register({ id: 'mentah' })).toThrow(/defineRegion/);
    await frame({ x: 99999, z: 0 }, 10000);
    expect(ids(rm)).toEqual(['tetap']);
  });

  it('persistent yang gagal: register menolak (main.js menampilkan galat fatal seperti sebelumnya)', async () => {
    const { rm } = setup();
    await expect(rm.register(simpleRegion('rusak', { fail: () => true }))).rejects.toThrow(/build rusak rusak/);
    expect(ids(rm)).toEqual([]);
  });
});

describe('regionManager: streaming', () => {
  it('histeresis: pasang < mountRadius, tetap di antara radius, lepas > unmountRadius; proxy bergantian', async () => {
    const { rm, frame, app } = setup();
    await rm.register(createDummyRegion({ x: 0, z: 0 })); // 700 / 900
    const proxy = app.scene.getObjectByName('proxy:dummy');
    expect(proxy.visible).toBe(true);
    await frame({ x: 800, z: 0 });
    expect(ids(rm)).toEqual([]);
    await frame({ x: 600, z: 0 });
    expect(ids(rm)).toEqual(['dummy']);
    expect(proxy.visible).toBe(false);
    await frame({ x: 850, z: 0 }, 1000);
    expect(ids(rm)).toEqual(['dummy']); // 850 < 900: tetap
    await frame({ x: 950, z: 0 }, 1000);
    expect(ids(rm)).toEqual([]);
    expect(proxy.visible).toBe(true);
    await frame({ x: 800, z: 0 }, 1000);
    expect(ids(rm)).toEqual([]); // 800 > 700: tidak dipasang lagi
  });

  it('maksimal satu mount per 0,5 s; yang terdekat lebih dulu', async () => {
    const { rm, frame } = setup();
    await rm.register(createDummyRegion({ id: 'a', x: 100, z: 0 }));
    await rm.register(createDummyRegion({ id: 'b', x: -50, z: 0 }));
    await frame({ x: 0, z: 0 });
    expect(ids(rm)).toEqual(['b']);
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS - 1);
    expect(ids(rm)).toEqual(['b']);
    await frame({ x: 0, z: 0 }, 1);
    expect(ids(rm)).toEqual(['b', 'a']);
  });

  it('satu mount berjalan sekaligus: mount berikutnya menunggu yang sedang berjalan', async () => {
    const gates = [];
    const mount = (_app, def) => new Promise((resolve) => {
      gates.push(() => resolve({ def, region: { colliders: {} }, ready: Promise.resolve(), mounted: true, unmount() {} }));
    });
    const { rm, clock } = setup({ mount });
    await rm.register(createDummyRegion({ id: 'a', x: 0, z: 0 }));
    await rm.register(createDummyRegion({ id: 'b', x: 10, z: 0 }));
    rm.update({ x: 0, z: 0 });
    await tick();
    clock.t += 5000;
    rm.update({ x: 0, z: 0 });
    await tick();
    expect(gates).toHaveLength(1);
    gates[0]();
    await rm.flush();
    expect(ids(rm)).toEqual(['a']);
    clock.t += 5000;
    rm.update({ x: 0, z: 0 });
    await tick();
    expect(gates).toHaveLength(2);
  });

  it('LIFO: pelepasan terbalik dari urutan pemasangan (menjauh & dispose)', async () => {
    const { rm, frame } = setup();
    const log = [];
    rm.on('unmount', ({ def }) => log.push(def.id));
    await rm.register(simpleRegion('tetap', { placement: { x: 5000, z: 5000, yaw: 0 } }));
    await rm.register(createDummyRegion({ id: 'a', x: 0, z: 0 }));
    await rm.register(createDummyRegion({ id: 'b', x: 100, z: 0 }));
    await frame({ x: 0, z: 0 });
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS);
    expect(ids(rm)).toEqual(['tetap', 'a', 'b']);
    await frame({ x: -3000, z: 0 }, MOUNT_INTERVAL_MS);
    expect(log).toEqual(['b', 'a']);
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS);
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS);
    expect(ids(rm)).toEqual(['tetap', 'a', 'b']);
    log.length = 0;
    rm.dispose();
    rm.dispose(); // idempoten
    expect(log).toEqual(['b', 'a', 'tetap']);
    expect(ids(rm)).toEqual([]);
  });

  it('mount streaming yang gagal dicatat, tidak melempar, dicoba lagi setelah MOUNT_RETRY_MS', async () => {
    let fail = true;
    const errors = [];
    const logger = { error: (...a) => errors.push(String(a[0])), warn() {} };
    const { rm, frame } = setup({ logger });
    await rm.register(simpleRegion('rapuh', { activation: { center: { x: 0, z: 0 } }, fail: () => fail }));
    await frame({ x: 0, z: 0 });
    expect(ids(rm)).toEqual([]);
    expect(errors.some((e) => e.includes('"rapuh"'))).toBe(true);
    fail = false;
    await frame({ x: 0, z: 0 }, MOUNT_RETRY_MS - 1);
    expect(ids(rm)).toEqual([]);
    await frame({ x: 0, z: 0 }, 1);
    expect(ids(rm)).toEqual(['rapuh']);
  });

  it('dispose saat mount berjalan: region dilepas begitu mount selesai', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const base = createDummyRegion({ x: 0, z: 0 });
    const slow = defineRegion({ ...base, build: async (ctx) => { await gate; return base.build(ctx); } });
    const { rm, app } = setup();
    await rm.register(slow);
    rm.update({ x: 0, z: 0 });
    await tick();
    rm.dispose();
    release();
    await rm.flush();
    expect(app.scene.children).toHaveLength(0);
    expect(ids(rm)).toEqual([]);
  });
});

describe('regionManager: event, collider, minimap, remount', () => {
  it('event mount/unmount membawa {def, region, frame}; fungsi lepas berhenti mendengar; event tak dikenal ditolak', async () => {
    const { rm, frame } = setup();
    const seen = [];
    const off = rm.on('mount', (r) => seen.push(['mount', r.def.id, r.region.group.isObject3D, r.frame.placement.x]));
    rm.on('unmount', (r) => seen.push(['unmount', r.def.id]));
    await rm.register(createDummyRegion({ x: 300, z: 0 }));
    await frame({ x: 300, z: 0 });
    off();
    await frame({ x: 5000, z: 0 }, 1000);
    await frame({ x: 300, z: 0 }, 1000);
    expect(seen).toEqual([['mount', 'dummy', true, 300], ['unmount', 'dummy']]);
    expect(() => rm.on('lain', () => {})).toThrow(/tidak dikenal/);
  });

  it('collider komposit & base layer minimap mengikuti region aktif', async () => {
    const collider = createDynamicCompositeCollider({ fallback: { isWalkable: () => true, isCameraClear: () => true } });
    const layers = new Map();
    const minimap = { setBaseLayer: (id, _canvas, o) => layers.set(id, o), removeBaseLayer: (id) => layers.delete(id) };
    const { rm, frame, app } = setup({ collider });
    await rm.register(simpleRegion('tetap', { placement: { x: 100, z: 0, yaw: 0 } }));
    expect(collider.isWalkable(100, 0)).toBe(false); // dirutekan ke region (isWalkable false)
    expect(collider.isWalkable(0, 0)).toBe(true);
    rm.attachMinimap(minimap); // membake region aktif saat itu juga (paritas langkah "Menggambar peta")
    const half = Math.ceil(Math.hypot(10, 10)) + MINIMAP_BAKE_MARGIN;
    expect(layers.get('tetap')).toEqual({ center: { x: 100, z: 0 }, half, yaw: 0 });
    await rm.register(createDummyRegion({ x: 0, z: 1000 }));
    await frame({ x: 0, z: 1000 });
    await tick();
    expect([...layers.keys()]).toEqual(['tetap', 'dummy']); // dibake setelah region siap
    expect(collider.isWalkable(0, 1000)).toBe(true);
    await frame({ x: 0, z: -5000 }, 1000);
    expect([...layers.keys()]).toEqual(['tetap']);
    expect(app.bakes).toHaveLength(2);
    expect(() => rm.attachMinimap({})).toThrow(TypeError);
  });

  it('remount (dev/E2E): lepas lalu pasang ulang; region tak terdaftar ditolak', async () => {
    const { rm, app } = setup();
    const first = await rm.register(simpleRegion('tetap'));
    await rm.remount('tetap');
    expect(first.mounted).toBe(false);
    expect(rm.handleOf('tetap')).not.toBe(first);
    expect(rm.handleOf('tetap').mounted).toBe(true);
    expect(app.runner.ids).toEqual(['tetap.sistem']);
    await expect(rm.remount('hilang')).rejects.toThrow(/tidak terdaftar/);
  });
});

describe('regionManager: region kedua (dummy) dipasang-lepas 3× tanpa bocor', () => {
  it('scene, sistem, scope, dan seluruh geometri/material kembali bersih tiap siklus', async () => {
    const { rm, frame, app, scopes } = setup();
    await rm.register(simpleRegion('tetap', { placement: { x: 5000, z: 5000, yaw: 0 } }));
    await rm.register(createDummyRegion({ x: 0, z: 0 }));
    const baseline = app.scene.children.length; // region tetap + proxy dummy
    for (let i = 0; i < 3; i += 1) {
      await frame({ x: 0, z: 0 }, 1000);
      const handle = rm.handleOf('dummy');
      await handle.ready;
      expect(handle.region.group.children).toHaveLength(1 + DUMMY_BOXES);
      const resources = new Set();
      handle.region.group.traverse((o) => {
        if (o.geometry) resources.add(o.geometry);
        if (o.material) resources.add(o.material);
      });
      const released = new Set();
      for (const r of resources) r.addEventListener('dispose', () => released.add(r));
      await frame({ x: 5000, z: 0 }, 1000);
      expect(app.scene.children).toHaveLength(baseline);
      expect(app.runner.ids).toEqual(['tetap.sistem']);
      const regionScope = scopes.filter((s) => s.name === 'region:dummy').at(-1);
      expect(regionScope.disposed).toBe(true);
      expect(regionScope.size).toBe(0);
      expect(released.size).toBe(resources.size);
    }
    expect(scopes.filter((s) => s.name === 'region:dummy')).toHaveLength(3);
    rm.dispose();
    expect(app.scene.children).toHaveLength(0);
    expect(scopes.every((s) => s.disposed)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/regionManager.test.js
```
Expected: FAIL — modul `src/app/regionManager.js` tidak ditemukan.

- [ ] **Step 3: Implementasi** — buat `src/app/regionManager.js`:

```js
/**
 * Region manager (spec UNRI §4.4, M0): pemilik tunggal region terpasang; menggantikan variabel
 * `stadion`/`frame`/`remountRegion` di main.js.
 * - Region `activation.persistent` dipasang saat register (Promise handle; galat diteruskan ke pemanggil).
 * - Region streaming dipasang bila jarak fokus ke `activation.center` < mountRadius dan dilepas bila
 *   > unmountRadius (histeresis); maksimal satu mount per MOUNT_INTERVAL_MS dan satu mount berjalan
 *   sekaligus (terdekat lebih dulu). Mount streaming yang gagal dicatat dan dicoba lagi setelah MOUNT_RETRY_MS.
 * - Pelepasan LIFO: yang terakhir dipasang dilepas pertama (update & dispose).
 * - Tiap pasang/lepas: collider komposit (`collider.setRegions`), base layer minimap (bake setelah region
 *   siap; `attachMinimap` membake region aktif saat itu juga), proxy (siluet murah, tampil hanya saat region
 *   tidak terpasang), event 'mount'/'unmount' ({def, region, frame}).
 */
import { mountRegion as defaultMount, applyPlacement } from './mountRegion.js';
import { FLAT_TERRAIN } from './terrainService.js';
import { createRegionFrame } from '../geo/regionTransform.js';
import { regionContains, maskHalfExtent } from '../regions/Region.js';
import { createResourceScope } from '../engine/ResourceScope.js';
import { disposeTree } from '../engine/disposeTree.js';
import { freezeStatic } from '../engine/freezeStatic.js';

export const MOUNT_INTERVAL_MS = 500;
export const MOUNT_RETRY_MS = 10000;
export const PROXY_MAX_MESHES = 8;
export const MINIMAP_BAKE_MARGIN = 20; // m di luar mask pada peta dasar region
const EVENTS = Object.freeze(['mount', 'unmount']);

/** @typedef {{def: object, region: object, frame: object}} ActiveRegion */

const countMeshes = (root) => {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n += 1; });
  return n;
};

/**
 * @param {{app: {scene: object, bakeMinimap?: (half: number, center: {x:number,z:number}) => object,
 *     addSystem(s: object): object, removeSystem(id: string): boolean},
 *   store?: object|null, time?: object|null, weather?: object|null, terrain?: object,
 *   collider?: {setRegions(list: Array<{region: object, colliders: object}>): void}|null,
 *   minimap?: {setBaseLayer: Function, removeBaseLayer: Function}|null, createScope?: (name: string) => object,
 *   scheduler?: object|null, mount?: Function, now?: () => number,
 *   logger?: {error: (...a: unknown[]) => void, warn?: (...a: unknown[]) => void}}} opts
 *   scheduler/mount/now/logger: tambahan M0 (injeksi untuk tes); kontrak spec §4.4 tidak berubah.
 */
export function createRegionManager({
  app, store = null, time = null, weather = null, terrain = FLAT_TERRAIN, collider = null, minimap = null,
  createScope = createResourceScope, scheduler = null, mount = defaultMount, now = () => performance.now(), logger = console,
} = {}) {
  if (!app?.scene) throw new TypeError('createRegionManager: app.scene wajib');
  const entries = new Map(); // id -> { def, frame, status:'idle'|'mounting'|'mounted', handle, proxy, failedAt }
  let order = [];            // id terpasang, urut pemasangan
  let active = Object.freeze([]);
  let listeners = { mount: [], unmount: [] };
  let inFlight = new Set();
  let lastMountAt = -Infinity;
  let minimapRef = minimap;
  let disposed = false;

  const patch = (id, fields) => {
    const e = entries.get(id);
    if (e) entries.set(id, { ...e, ...fields });
  };
  const recordOf = (e) => Object.freeze({ def: e.def, region: e.handle.region, frame: e.frame });

  const refreshActive = () => {
    active = Object.freeze(order.map((id) => recordOf(entries.get(id))));
    collider?.setRegions(active.map((a) => ({ region: a.def, colliders: a.region.colliders })));
  };

  const emit = (type, record) => {
    for (const fn of listeners[type]) {
      try {
        fn(record);
      } catch (err) {
        logger.error(`RegionManager: listener "${type}" gagal (dilanjutkan):`, err);
      }
    }
  };

  /** Bake peta dasar region (tampak atas area mask + margin) ke base layer minimap. */
  const bake = (id) => {
    const e = entries.get(id);
    if (!minimapRef || !e || typeof app.bakeMinimap !== 'function') return;
    try {
      const half = Math.ceil(maskHalfExtent(e.def.mask)) + MINIMAP_BAKE_MARGIN;
      const p = e.def.placement;
      minimapRef.setBaseLayer(id, app.bakeMinimap(half, p), { center: { x: p.x, z: p.z }, half, yaw: 0 });
    } catch (err) {
      // Minimap hanya pelengkap: GPU yang gagal mengalokasikan target/readPixels tidak boleh menggagalkan game.
      logger.error(`Minimap dasar region "${id}" gagal dibuat, minimap memakai latar polos:`, err);
    }
  };

  const buildProxy = (def) => {
    const scope = createScope(`proxy:${def.id}`);
    try {
      const built = def.proxy({ scope, placement: def.placement, terrain });
      if (!built?.group?.isObject3D || typeof built.dispose !== 'function') {
        throw new TypeError(`Region "${def.id}": proxy(ctx) harus mengembalikan { group, dispose }`);
      }
      const meshes = countMeshes(built.group);
      if (meshes > PROXY_MAX_MESHES) logger.warn?.(`Proxy region "${def.id}": ${meshes} mesh > ${PROXY_MAX_MESHES} (budget draw call proxy)`);
      applyPlacement(built.group, def.placement);
      app.scene.add(built.group);
      freezeStatic(built.group);
      return { group: built.group, dispose: built.dispose, scope };
    } catch (err) {
      scope.dispose();
      logger.error(`Proxy region "${def.id}" gagal dibuat (dilewati):`, err);
      return null;
    }
  };

  const disposeProxy = (proxy) => {
    try {
      proxy.dispose();
    } catch (err) {
      logger.error('Proxy region gagal di-dispose (dilanjutkan):', err);
    }
    proxy.group.removeFromParent();
    disposeTree(proxy.group, { scope: proxy.scope });
    proxy.scope.dispose();
  };

  const onMounted = (id, handle) => {
    if (disposed || !entries.has(id)) {
      handle.unmount(); // manager dibongkar selama mount berjalan
      return null;
    }
    patch(id, { status: 'mounted', handle });
    order = [...order, id];
    refreshActive();
    const e = entries.get(id);
    if (e.proxy) e.proxy.group.visible = false;
    emit('mount', recordOf(e));
    if (minimapRef) {
      handle.ready.catch(() => null).then(() => {
        if (entries.get(id)?.handle === handle && handle.mounted) bake(id);
      });
    }
    return handle;
  };

  const mountEntry = (id, { rethrow = false } = {}) => {
    const { def } = entries.get(id);
    patch(id, { status: 'mounting' });
    const opts = { store, time, weather, terrain, scheduler, createScope, logger };
    const job = Promise.resolve()
      .then(() => mount(app, def, opts))
      .then((handle) => onMounted(id, handle), (err) => {
        patch(id, { status: 'idle', failedAt: now() });
        if (rethrow) throw err;
        logger.error(`Region "${id}" gagal dipasang (dicoba lagi setelah ${MOUNT_RETRY_MS / 1000} s):`, err);
        return null;
      })
      .finally(() => {
        inFlight = new Set([...inFlight].filter((p) => p !== job));
      });
    inFlight = new Set([...inFlight, job]);
    return job;
  };

  const unmountEntry = (id) => {
    const e = entries.get(id);
    if (e?.status !== 'mounted') return false;
    const record = recordOf(e);
    order = order.filter((x) => x !== id);
    patch(id, { status: 'idle', handle: null });
    refreshActive(); // collider tidak lagi merutekan ke region yang akan dibongkar
    minimapRef?.removeBaseLayer(id);
    emit('unmount', record);
    e.handle.unmount();
    if (e.proxy) e.proxy.group.visible = true;
    return true;
  };

  const flush = () => Promise.allSettled([...inFlight]).then(() => undefined);

  return {
    /**
     * Daftarkan region (hasil defineRegion). Persistent: dipasang sekarang → Promise handle mountRegion.
     * Streaming: proxy dibuat (bila ada), dipasang oleh update() → Promise null.
     */
    register(def) {
      if (disposed) throw new Error('RegionManager sudah di-dispose');
      if (typeof def?.id !== 'string' || !def.activation || typeof def.build !== 'function') {
        throw new TypeError('RegionManager.register: def harus hasil defineRegion (id, activation, build)');
      }
      if (entries.has(def.id)) throw new Error(`RegionManager: region "${def.id}" sudah terdaftar`);
      entries.set(def.id, {
        def, frame: createRegionFrame(def.placement), status: 'idle', handle: null, proxy: null, failedAt: -Infinity,
      });
      if (def.activation.persistent) return mountEntry(def.id, { rethrow: true });
      if (typeof def.proxy === 'function') patch(def.id, { proxy: buildProxy(def) });
      return Promise.resolve(null);
    },

    /** Tiap frame: pasang/lepas region streaming menurut fokus dunia (histeresis, LIFO, laju mount). */
    update(focus) {
      if (disposed || !Number.isFinite(focus?.x) || !Number.isFinite(focus?.z)) return;
      const t = now();
      let far = null;
      let best = null;
      for (const e of entries.values()) {
        const act = e.def.activation;
        if (act.persistent) continue;
        const d = Math.hypot(focus.x - act.center.x, focus.z - act.center.z);
        if (e.status === 'mounted' && d > act.unmountRadius) {
          far = far ?? [];
          far.push(e.def.id);
        } else if (e.status === 'idle' && d < act.mountRadius && t - e.failedAt >= MOUNT_RETRY_MS && (!best || d < best.d)) {
          best = { id: e.def.id, d };
        }
      }
      if (far) {
        const snapshot = order;
        for (let i = snapshot.length - 1; i >= 0; i -= 1) if (far.includes(snapshot[i])) unmountEntry(snapshot[i]); // LIFO
      }
      if (best && inFlight.size === 0 && t - lastMountAt >= MOUNT_INTERVAL_MS) {
        lastMountAt = t;
        mountEntry(best.id);
      }
    },

    /** @returns {ReadonlyArray<ActiveRegion>} region terpasang, urut pemasangan */
    active: () => active,
    /** Frame region terdaftar (terpasang atau tidak); null bila id tak dikenal. */
    frameOf: (id) => entries.get(id)?.frame ?? null,
    /** Id region terpasang yang mask-nya memuat titik dunia (x, z); null bila tidak ada. */
    regionAt(x, z) {
      for (const a of active) if (regionContains(a.def, x, z)) return a.def.id;
      return null;
    },
    /** Handle mountRegion region terpasang (ready, region, mounted); null bila tidak terpasang. */
    handleOf: (id) => entries.get(id)?.handle ?? null,

    /** @param {'mount'|'unmount'} type @returns {() => void} pelepas listener */
    on(type, fn) {
      if (!EVENTS.includes(type)) throw new TypeError(`RegionManager.on: event "${type}" tidak dikenal (mount|unmount)`);
      if (typeof fn !== 'function') throw new TypeError('RegionManager.on: fn harus fungsi');
      listeners = { ...listeners, [type]: [...listeners[type], fn] };
      return () => { listeners = { ...listeners, [type]: listeners[type].filter((f) => f !== fn) }; };
    },

    /** Pasang minimap; base layer region aktif dibake SEKARANG, region berikutnya setelah siap. */
    attachMinimap(m) {
      if (typeof m?.setBaseLayer !== 'function' || typeof m?.removeBaseLayer !== 'function') {
        throw new TypeError('RegionManager.attachMinimap: minimap butuh setBaseLayer/removeBaseLayer');
      }
      minimapRef = m;
      for (const id of order) bake(id);
    },

    /** Dev/E2E: lepas lalu pasang ulang region (tanpa batas laju). @returns {Promise<unknown>} ready region baru */
    async remount(id) {
      if (!entries.has(id)) throw new Error(`RegionManager.remount: region "${id}" tidak terdaftar`);
      await flush();
      unmountEntry(id);
      const handle = await mountEntry(id, { rethrow: true });
      return handle ? handle.ready : null;
    },

    /** Selesai saat semua mount yang sedang berjalan selesai (berhasil atau gagal). */
    flush,

    /** Lepas semua region (LIFO) lalu semua proxy; idempoten. */
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of [...order].reverse()) unmountEntry(id);
      for (const e of [...entries.values()].reverse()) if (e.proxy) disposeProxy(e.proxy);
      entries.clear();
      listeners = { mount: [], unmount: [] };
    },
  };
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/regionManager.test.js
```
Expected: `Tests  13 passed (13)`.

- [ ] **Step 5: Seluruh suite + lint**

```bash
node node_modules/vitest/vitest.mjs run
```
Expected: semua lulus (baseline + tes baru Task 2–10).

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/regionManager.js tests/regionManager.test.js
```
```bash
git commit -m "feat(app): regionManager (persistent + streaming ber-histeresis, maks 1 mount/0,5 s, LIFO, proxy, collider, minimap, event)"
```

---

## Task 11: Save v3 — `migrateV2` (TDD)

Save v2 tidak memuat koordinat apa pun; v3 menambahkan **`place`** = tempat terakhir pemain sebagai titik ber-region `{region, x, z, yaw}` (spec §4.5) atau `null`. Progres & dompet v2 dipertahankan utuh. Rantai: v1 → v2 → v3.

**Files:**
- Modify: `src/story/storage.js` (seluruh berkas, 102 baris)
- Test: `tests/storyStorage.test.js` (seluruh berkas, 82 baris — asersi versi 2 → 3 sengaja diubah)

- [ ] **Step 1: Tulis tes yang gagal** — ganti seluruh isi `tests/storyStorage.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  sanitizeSave, sanitizeWallet, sanitizePlace, loadStory, saveStory, migrateV1, migrateV2,
  STORY_KEY, STORY_BACKUP_KEY, SAVE_VERSION,
} from '../src/story/storage.js';

const mem = (init = {}) => {
  const data = { ...init };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, data };
};
const LIMITS = { chapters: 5, steps: [2, 2, 2, 1, 1], eggIds: ['a', 'b'], startBalance: 50000, itemIds: ['es-teh', 'rujak'] };
const TEH = { id: 'es-teh', name: 'Es Teh', kind: 'minuman', price: 5000 };
const V2 = {
  version: 2, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false,
  wallet: { balance: 31000, items: [TEH] },
};
const V3 = { ...V2, version: 3, place: { region: 'stadion', x: 12.5, z: -190, yaw: 0.4 } };

describe('story storage v3 (M0 multi-region)', () => {
  it('SAVE_VERSION = 3; round-trip v3 (progres + dompet + tempat)', () => {
    const s = mem();
    saveStory(s, V3);
    expect(SAVE_VERSION).toBe(3);
    expect(loadStory(s, LIMITS)).toEqual(V3);
  });

  it('v2 → v3: progres & dompet utuh, tempat null (tanpa kehilangan progres)', () => {
    const expected = { ...V2, version: 3, place: null };
    expect(migrateV2(V2, LIMITS)).toEqual(expected);
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify(V2) }), LIMITS)).toEqual(expected);
  });

  it('v1 → v2 → v3: hadiah dikreditkan SEKALI ke saldo awal, tanpa barang', () => {
    const v1 = { version: 1, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false };
    expect(migrateV1(v1, LIMITS)).toEqual({ ...v1, version: 2, wallet: { balance: 70000, items: [] } });
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify(v1) }), LIMITS))
      .toEqual({ ...v1, version: 3, wallet: { balance: 70000, items: [] }, place: null });
  });

  it('tempat tidak sah dibuang (null) tanpa membuang progres; tempat sah dipangkas ke field kontrak', () => {
    for (const place of [null, 'x', { region: '', x: 0, z: 0, yaw: 0 }, { region: 'stadion', x: Number.NaN, z: 0, yaw: 0 }, { x: 1, z: 2, yaw: 0 }]) {
      expect(sanitizeSave({ ...V3, place }, LIMITS)).toEqual({ ...V3, place: null });
    }
    expect(sanitizePlace({ region: 'unri-lembaga', x: 1, z: 2, yaw: 3, extra: true })).toEqual({ region: 'unri-lembaga', x: 1, z: 2, yaw: 3 });
  });

  it('JSON rusak atau versi tak dikenal → null dan teks asli dicadangkan ke .bak', () => {
    expect(STORY_BACKUP_KEY).toBe(`${STORY_KEY}.bak`);
    const broken = mem({ [STORY_KEY]: '{oops' });
    expect(loadStory(broken, LIMITS)).toBeNull();
    expect(broken.data[STORY_BACKUP_KEY]).toBe('{oops');
    const future = JSON.stringify({ version: 99 });
    const unknown = mem({ [STORY_KEY]: future });
    expect(loadStory(unknown, LIMITS)).toBeNull();
    expect(unknown.data[STORY_BACKUP_KEY]).toBe(future);
  });

  it('v2 atau v3 dengan dompet tidak sah dianggap rusak (dicadangkan)', () => {
    for (const bad of [{ ...V2, wallet: 'x' }, { ...V3, wallet: null }]) {
      const text = JSON.stringify(bad);
      const s = mem({ [STORY_KEY]: text });
      expect(loadStory(s, LIMITS)).toBeNull();
      expect(s.data[STORY_BACKUP_KEY]).toBe(text);
    }
  });

  it('tanpa save: null tanpa cadangan', () => {
    const s = mem();
    expect(loadStory(s, LIMITS)).toBeNull();
    expect(s.data[STORY_BACKUP_KEY]).toBeUndefined();
  });

  it('membuang nilai di luar rentang, id tak dikenal, dan item dompet tak sah (v2 → v3)', () => {
    const r = sanitizeSave({
      version: 2, chapter: 99, step: -3, badges: ['ok', 5], eggs: ['a', 'zzz'], bestLap: -1, rupiah: 'x', finished: 'y',
      wallet: { balance: -50, items: [TEH, { id: 'palsu' }, null, { id: 'rujak', price: -3 }] },
    }, LIMITS);
    expect(r).toEqual({
      version: 3, chapter: 4, step: 0, badges: ['ok'], eggs: ['a'], bestLap: null, rupiah: 0, finished: false,
      wallet: { balance: 0, items: [TEH, { id: 'rujak', name: 'rujak', kind: '', price: 0 }] },
      place: null,
    });
    expect(sanitizeSave(null, LIMITS)).toBeNull();
  });

  it('sanitizeWallet tanpa daftar id menerima item ber-id string', () => {
    expect(sanitizeWallet({ balance: 10.7, items: [{ id: 'apa', name: 'Apa', kind: 'buah', price: 1 }] }))
      .toEqual({ balance: 10, items: [{ id: 'apa', name: 'Apa', kind: 'buah', price: 1 }] });
    expect(sanitizeWallet(null)).toBeNull();
  });

  it('storage yang melempar, null, atau gagal menulis cadangan tidak crash', () => {
    const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); } };
    expect(loadStory(bad, LIMITS)).toBeNull();
    expect(loadStory(null, LIMITS)).toBeNull();
    expect(() => saveStory(bad, { version: 3 })).not.toThrow();
    const full = { getItem: () => '{oops', setItem() { throw new Error('penuh'); } };
    expect(loadStory(full, LIMITS)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/storyStorage.test.js
```
Expected: FAIL — `migrateV2`/`sanitizePlace` bukan fungsi, `SAVE_VERSION` = 2.

- [ ] **Step 3: Implementasi** — ganti seluruh isi `src/story/storage.js`:

```js
/**
 * Simpan/muat progres cerita di localStorage (kunci tetap; versi di dalam data). Data dari storage
 * tidak dipercaya: dibersihkan terhadap batas chapter/langkah, id yang dikenal, dompet yang sah, dan
 * tempat terakhir yang sah. Rantai migrasi: v1 (tanpa dompet) → v2 (dompet {balance, items}) → v3
 * (M0 multi-region: `place` = tempat terakhir pemain sebagai titik ber-region {region, x, z, yaw},
 * story/points.js; null bila belum tercatat). Data rusak atau versi tak dikenal dicadangkan ke
 * STORY_BACKUP_KEY sebelum mulai baru (tidak dibuang diam-diam).
 */
export const STORY_KEY = 'sur3d.story.v1';
export const STORY_BACKUP_KEY = `${STORY_KEY}.bak`;
export const SAVE_VERSION = 3;
const V2 = 2;

const int = (v, min, max) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : min);
const strings = (a, allowed) => (Array.isArray(a)
  ? a.filter((x) => typeof x === 'string' && (!allowed || allowed.includes(x))) : []);
const nonNegInt = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Item dompet sah: id string (dan dikenal bila itemIds ada); nama/jenis string; harga ≥ 0. */
function sanitizeItems(items, itemIds) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i && typeof i === 'object' && typeof i.id === 'string' && (!itemIds || itemIds.includes(i.id)))
    .map((i) => ({
      id: i.id,
      name: typeof i.name === 'string' ? i.name : i.id,
      kind: typeof i.kind === 'string' ? i.kind : '',
      price: nonNegInt(i.price),
    }));
}

/** @returns {{balance:number, items:object[]}|null} */
export function sanitizeWallet(raw, itemIds) {
  if (!raw || typeof raw !== 'object') return null;
  return { balance: nonNegInt(raw.balance), items: sanitizeItems(raw.items, itemIds) };
}

/**
 * Tempat terakhir (titik ber-region) atau null bila tidak sah. Region tidak dicek terhadap daftar region:
 * pemakai me-resolve lewat frameOf (region tak dikenal → null di sana).
 * @returns {{region:string, x:number, z:number, yaw:number}|null}
 */
export function sanitizePlace(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.region !== 'string' || raw.region === '') return null;
  if (![raw.x, raw.z, raw.yaw].every(Number.isFinite)) return null;
  return { region: raw.region, x: raw.x, z: raw.z, yaw: raw.yaw };
}

/** Field progres yang sama di v1, v2 & v3. */
function sanitizeProgress(raw, limits) {
  const chapter = int(raw.chapter, 0, limits.chapters - 1);
  const stepMax = Math.max(0, (limits.steps[chapter] ?? 1) - 1);
  return {
    chapter,
    step: int(raw.step, 0, stepMax),
    badges: strings(raw.badges),
    eggs: strings(raw.eggs, limits.eggIds),
    bestLap: Number.isFinite(raw.bestLap) && raw.bestLap > 0 ? raw.bestLap : null,
    rupiah: nonNegInt(raw.rupiah),
    finished: raw.finished === true,
  };
}

/** v1 → v2: hadiah (rupiah) dikreditkan SEKALI ke saldo awal; belanjaan v1 memang tidak pernah tersimpan. */
export function migrateV1(raw, limits) {
  const progress = sanitizeProgress(raw, limits);
  return { version: V2, ...progress, wallet: { balance: nonNegInt(limits.startBalance) + progress.rupiah, items: [] } };
}

/**
 * v2 → v3: progres & dompet utuh; tempat terakhir belum pernah tersimpan (null).
 * @returns {object|null} null bila dompet v2 tidak sah (save dianggap rusak)
 */
export function migrateV2(raw, limits) {
  const wallet = sanitizeWallet(raw.wallet, limits.itemIds);
  return wallet ? { version: SAVE_VERSION, ...sanitizeProgress(raw, limits), wallet, place: null } : null;
}

/**
 * @param {{chapters:number, steps:number[], eggIds:string[], startBalance?:number, itemIds?:string[]}} limits
 * @returns {object|null} save v3 tersanitasi; null bila bukan save yang dikenali
 */
export function sanitizeSave(raw, limits) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === 1) return migrateV2(migrateV1(raw, limits), limits);
  if (raw.version === V2) return migrateV2(raw, limits);
  if (raw.version !== SAVE_VERSION) return null;
  const wallet = sanitizeWallet(raw.wallet, limits.itemIds);
  return wallet ? { version: SAVE_VERSION, ...sanitizeProgress(raw, limits), wallet, place: sanitizePlace(raw.place) } : null;
}

function backup(storage, text) {
  try {
    storage.setItem(STORY_BACKUP_KEY, text);
  } catch {
    // storage penuh/diblokir: tetap mulai baru
  }
}

export function loadStory(storage, limits) {
  let text;
  try {
    text = storage.getItem(STORY_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    backup(storage, text);
    return null;
  }
  const save = sanitizeSave(raw, limits);
  if (!save) backup(storage, text);
  return save;
}

export function saveStory(storage, save) {
  try {
    storage.setItem(STORY_KEY, JSON.stringify(save));
  } catch {
    // storage penuh/diblokir: progres hanya di memori
  }
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/storyStorage.test.js
```
Expected: `Tests  10 passed (10)`.

- [ ] **Step 5: Cek tes cerita lain** (StoryDirector masih menulis `version: SAVE_VERSION` → kini 3)

```bash
node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js
```
Expected: FAIL tepat 2 tes — `belanja tersimpan: reload tidak mengembalikan uang` dan `mulai dari awal: dompet kembali ke saldo awal dan tersimpan` (`toMatchObject({ version: 2 … })` menerima 3). Diperbaiki di Task 12 Step 1 (perubahan asersi yang disengaja). **Jangan commit Task 11 sendirian dalam keadaan merah:** lanjutkan ke Task 12, commit Task 11 dan 12 setelah Task 12 Step 6 hijau (dua commit berurutan, lihat Task 12 Step 8).

---

## Task 12: `StoryDirector` di koordinat dunia (TDD) + jangkar easter egg + guard `goto`

**Files:**
- Modify: `src/story/eggTriggers.js` (seluruh berkas, 49 baris)
- Modify: `src/sim/story/objectives.js:12-14`
- Modify: `src/core/StoryDirector.js` (seluruh berkas, 266 baris)
- Test: `tests/storyDirector.test.js` (impor baris 3; baris 170 & 192; describe baru di akhir berkas)

- [ ] **Step 1: Tulis tes yang gagal**

Di `tests/storyDirector.test.js`, ganti baris 3:
```js
import { TUGU, CHAPTERS } from '../src/story/chapters.js';
```
menjadi:
```js
import { TUGU, CHAPTERS, STORY_NPCS } from '../src/story/chapters.js';
import { createRegionFrame } from '../src/geo/regionTransform.js';
```

Ganti baris 170 (setelah impor bertambah 1 baris, kini baris 171):
```js
    expect(savedIn(m)).toMatchObject({ version: 2, wallet: { balance: 45000 } });
```
menjadi:
```js
    expect(savedIn(m)).toMatchObject({ version: 3, wallet: { balance: 45000 } });
```

Ganti baris 192 (kini 193):
```js
    expect(savedIn(m)).toMatchObject({ version: 2, chapter: 0, wallet: { balance: 50000, items: [] } });
```
menjadi:
```js
    expect(savedIn(m)).toMatchObject({ version: 3, chapter: 0, wallet: { balance: 50000, items: [] } });
```

Tambahkan di akhir berkas:

```js
describe('StoryDirector: koordinat dunia multi-region (M0)', () => {
  const stadion = createRegionFrame({ x: 1000, z: -200, yaw: 0.5 });
  const frameOf = (id) => (id === 'stadion' ? stadion : null);
  const startedIn = (opts, extra = {}) => {
    const m = makeDeps(opts);
    const d = new StoryDirector({ ...m.deps, frameOf, ...extra });
    d.start();
    return { d, ...m };
  };

  it('tujuan goto di-resolve ke dunia: posisi dunia tugu menyelesaikan chapter 0, posisi lokal tidak', () => {
    const { d } = startedIn();
    d.advanceDialog();
    d.advanceDialog();
    const w = stadion.toWorld(TUGU.x, TUGU.z);
    expect(d.goalPoint()).toEqual(w);
    d.update(0.016, ctx(TUGU.x, TUGU.z));
    expect(d.state.chapter).toBe(0);
    d.update(0.016, ctx(w.x, w.z));
    expect(d.state.chapter).toBe(1);
  });

  it('pedagang dicari dari posisi lokal stadion; penanda di titik dunia', () => {
    const { d } = startedIn({ save: { version: 1, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false } });
    const asked = [];
    d.vendors.nearestSelling = (_itemId, from) => { asked.push({ ...from }); return { x: 5, z: 5 }; };
    const at = stadion.toWorld(0, 10);
    d.update(0.016, ctx(at.x, at.z));
    const goal = d.goalPoint();
    const want = stadion.toWorld(5, 5);
    expect(goal.x).toBeCloseTo(want.x, 9);
    expect(goal.z).toBeCloseTo(want.z, 9);
    expect(asked.at(-1).x).toBeCloseTo(0, 9);
    expect(asked.at(-1).z).toBeCloseTo(10, 9);
  });

  it('NPC cerita ditemukan di posisi dunianya', () => {
    const { d } = startedIn();
    d.advanceDialog();
    d.advanceDialog();
    const satpam = STORY_NPCS.find((n) => n.id === 'satpam');
    const w = stadion.toWorld(satpam.x, satpam.z);
    expect(d.promptFor({ x: satpam.x, z: satpam.z })).toBeNull();
    expect(d.promptFor(w)).toMatch(/Pak Satpam/);
  });

  it('save v3 menyimpan tempat dari placeOf; tempat tersimpan dibaca sebagai savedPlace', () => {
    const place = { region: 'stadion', x: 1, z: 2, yaw: 0.5 };
    const m = makeDeps();
    const d = new StoryDirector({ ...m.deps, frameOf, placeOf: () => place });
    d.start();
    expect(d.savedPlace).toBeNull();
    d.vendors.wallet = { balance: 45000, items: [] };
    d.onBought('es-teh');
    expect(JSON.parse(m.store.get(STORY_KEY))).toMatchObject({ version: 3, place });
    const reload = makeDeps({ store: m.store });
    const d2 = new StoryDirector({ ...reload.deps, frameOf });
    d2.start();
    expect(d2.savedPlace).toEqual(place);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js
```
Expected: FAIL pada 4 tes baru (frame diabaikan: chapter 0 selesai di posisi lokal, `savedPlace` undefined, `place` tidak tersimpan); 2 tes versi kini lulus.

- [ ] **Step 3: Jangkar easter egg** — ganti seluruh isi `src/story/eggTriggers.js`:

```js
/**
 * Pemicu easter egg (murni): menerima konteks per frame dan mengembalikan id egg yang
 * baru terpicu. State kecil (bel, pembelian, lama berdiri saat hujan) dikembalikan baru.
 * Titik jangkar pemicu khusus (satpam, tugu, tengah lapangan) region-lokal stadion; StoryDirector
 * mengirim versi dunianya lewat `ctx.anchors` (M0 multi-region). Tanpa `ctx.anchors` dipakai EGG_ANCHORS.
 */
import { STORY_NPCS, TUGU } from './chapters.js';

const BELL_COUNT = 3;
const BELL_WINDOW = 4;      // detik
const BELL_RANGE = 12;      // m dari satpam
const TEA_COUNT = 5;
const RAIN_DWELL = 5;       // detik berdiri di bawah layar tugu
const TUGU_RANGE = 14;
const CENTER = Object.freeze({ x: 0, z: 0 });
const CENTER_RANGE = 20;
const MIDNIGHT_HALF_WINDOW_H = 0.5; // ±30 menit (jam berjalan 0,25 jam/dtk: ±6 menit hanya ±0,8 dtk)

const SATPAM = STORY_NPCS.find((n) => n.id === 'satpam');

/** Titik jangkar pemicu khusus (region-lokal stadion; titik ber-region tanpa `region`). */
export const EGG_ANCHORS = Object.freeze({ satpam: SATPAM, tugu: TUGU, center: CENTER });

export function createEggState() {
  return Object.freeze({ bells: Object.freeze([]), purchases: 0, rainTime: 0 });
}

/**
 * @param {{bells:number[],purchases:number,rainTime:number}} state
 * @param {{time:number,dt:number,pos:{x:number,z:number},hour:number,raining:boolean,bell:boolean,bought:string|null,
 *   anchors?:{satpam:{x:number,z:number}|null, tugu:{x:number,z:number}|null, center:{x:number,z:number}|null}}} ctx
 *   anchors: titik jangkar di frame yang sama dengan `pos` (null = jangkar tak tersedia, pemicunya mati)
 * @param {readonly object[]} eggs daftar easter egg (`at` di frame yang sama dengan `pos`)
 * @param {readonly string[]} known id yang sudah ditemukan (dilewati)
 * @returns {{state:object, ids:string[]}}
 */
export function stepEggs(state, ctx, eggs, known = []) {
  const { satpam, tugu, center } = ctx.anchors ?? EGG_ANCHORS;
  const near = (p, r) => p != null && Math.hypot(ctx.pos.x - p.x, ctx.pos.z - p.z) <= r;
  const recent = state.bells.filter((t) => ctx.time - t <= BELL_WINDOW);
  const bells = ctx.bell && near(satpam, BELL_RANGE) ? [...recent, ctx.time] : recent;
  const purchases = state.purchases + (ctx.bought === 'es-teh' ? 1 : 0);
  const rainTime = ctx.raining && near(tugu, TUGU_RANGE) ? state.rainTime + ctx.dt : 0;
  const midnight = (ctx.hour >= 24 - MIDNIGHT_HALF_WINDOW_H || ctx.hour <= MIDNIGHT_HALF_WINDOW_H) && near(center, CENTER_RANGE);
  const specials = {
    'bell-satpam': bells.length >= BELL_COUNT,
    'midnight-center': midnight,
    'es-teh-5': purchases >= TEA_COUNT,
    'rain-tugu': rainTime >= RAIN_DWELL,
  };
  const ids = eggs
    .filter((e) => !known.includes(e.id) && ((e.at && near(e.at, e.at.radius)) || specials[e.trigger]))
    .map((e) => e.id);
  return { state: { bells, purchases, rainTime }, ids };
}
```

- [ ] **Step 4: Guard `goto`** — ganti `src/sim/story/objectives.js:12-14`:

```js
    case 'goto':
      return event.type === 'position' && dist(event, objective.target) <= objective.radius
        ? finish(progress) : pass(progress);
```
menjadi:
```js
    case 'goto': // target null = region tujuan tak dikenal (titik ber-region gagal di-resolve): tidak pernah selesai
      return event.type === 'position' && objective.target != null && dist(event, objective.target) <= objective.radius
        ? finish(progress) : pass(progress);
```

- [ ] **Step 5: StoryDirector** — ganti seluruh isi `src/core/StoryDirector.js`:

```js
/**
 * StoryDirector: menjembatani dunia 3D dan mesin cerita murni. Mengirim event
 * (posisi, pembelian, interaksi, putaran, easter egg), menerapkan efek (hadiah,
 * toast, barang diantar, simpan), dan menggambar HUD/jurnal/penanda.
 * M0 multi-region: bekerja di koordinat DUNIA. Titik data cerita adalah titik ber-region
 * (story/points.js; tanpa `region` = 'stadion') yang di-resolve sekali lewat `frameOf(regionId)`
 * (story/storyWorld.js). Pedagang tetap entitas region stadion (koordinat lokal) dan dikonversi di batas.
 */
import { CHAPTERS, STORY_NPCS } from '../story/chapters.js';
import { EASTER_EGGS, EGG_IDS } from '../story/easterEggs.js';
import { createEggState, stepEggs, EGG_ANCHORS } from '../story/eggTriggers.js';
import { loadStory, saveStory, SAVE_VERSION } from '../story/storage.js';
import { resolvePoint } from '../story/points.js';
import { resolveAnchors, resolveChapters, resolveEggs, resolveNpcs } from '../story/storyWorld.js';
import { createStory } from '../sim/story/reducer.js';
import { fundsShortfall } from '../story/funds.js';
import { createLapTracker, stepLap } from '../sim/story/lapTracker.js';
import { pointOnLane, laneLength } from '../sim/trackPath.js';
import { VENDOR_CATALOG, createWallet } from '../sim/vendorSim.js';
import { VENDOR } from '../config/constants.js';
import { IDENTITY_FRAME } from '../geo/regionTransform.js';

const NPC_RANGE = 4;
const LAP_LANE = 4;          // lane tengah: radius cek menutup semua lane
const LAP_CHECKPOINTS = 8;
const LAP_RADIUS = 9;
const FUNDS_CHECK_SEC = 1;   // seberapa sering saldo dicek terhadap langkah beli/antar
const PROGRESS_KEYS = ['chapter', 'step', 'badges', 'eggs', 'bestLap', 'rupiah', 'finished'];
const ITEM_IDS = Object.values(VENDOR_CATALOG).flat().map((i) => i.id);
const STADION_REGION = 'stadion'; // pemilik pedagang & lintasan atletik (entitas region-lokal)

const LIMITS = Object.freeze({
  chapters: CHAPTERS.length, steps: CHAPTERS.map((c) => c.steps.length), eggIds: EGG_IDS,
  startBalance: VENDOR.startBalance, itemIds: ITEM_IDS,
});

/** Checkpoint lintasan (lokal stadion) → dunia; cadangan = koordinat lokal bila stadion tak terdaftar. */
function lapCheckpoints(frameOf) {
  const len = laneLength(LAP_LANE);
  return Array.from({ length: LAP_CHECKPOINTS }, (_, i) => {
    const p = pointOnLane(LAP_LANE, (i / LAP_CHECKPOINTS) * len);
    return resolvePoint({ region: STADION_REGION, x: p.x, z: p.z }, frameOf) ?? { x: p.x, z: p.z };
  });
}

export class StoryDirector {
  /**
   * HUD tidak diimpor/dipegang langsung: efek toast & dompet dikirim lewat callback (core tidak bergantung ui).
   * @param {{storage:object, vendors:object, storyHud:object, journal:object, markers:object,
   *   onToast?:(text:string, ok:boolean)=>void, onWalletChange?:(wallet:object)=>void,
   *   pointerLock?:{release:()=>void, request:()=>void},
   *   frameOf?:(regionId:string)=>object|null, placeOf?:()=>({region:string,x:number,z:number,yaw:number}|null)}} deps
   *   frameOf: frame region (regionManager.frameOf); default identitas untuk semua region (tes/perilaku lama).
   *   placeOf: tempat pemain sekarang sebagai titik ber-region; ikut disimpan di save v3.
   */
  constructor({
    storage, vendors, storyHud, journal, markers, onToast = () => {}, onWalletChange = () => {}, pointerLock = null,
    frameOf = () => IDENTITY_FRAME, placeOf = () => null,
  }) {
    this.chapters = resolveChapters(CHAPTERS, frameOf);
    this.npcs = resolveNpcs(STORY_NPCS, frameOf);
    this.eggs = resolveEggs(EASTER_EGGS, frameOf);
    this.anchors = resolveAnchors(EGG_ANCHORS, frameOf);
    this.story = createStory({ chapters: this.chapters, eggs: this.eggs });
    Object.assign(this, { storage, vendors, storyHud, journal, markers, onToast, onWalletChange, pointerLock, frameOf, placeOf });
    this.state = this.story.initial();
    this.eggState = createEggState();
    this.checkpoints = lapCheckpoints(frameOf);
    this.lap = null;
    this.bell = false;
    this.bought = null;
    this.bikePos = { x: 0, z: 0 };
    this.fundsTimer = 0;
    this.fundedStep = null; // 'chapter:step' yang sudah diberi uang saku (sekali per langkah)
    this.savedPlace = null; // tempat terakhir dari save v3 (M0: tidak dipakai untuk spawn, paritas stadion)
  }

  /** Muat progres + dompet + tempat tersimpan (save v3; v1/v2 dimigrasi). Tidak ada credit-ulang hadiah. */
  start() {
    const save = loadStory(this.storage, LIMITS);
    if (save) {
      const { wallet, version: _version, place, ...progress } = save;
      this.savedPlace = place;
      this.state = this.story.hydrate(progress);
      this.vendors.setWallet(wallet);
      this.onWalletChange(this.vendors.wallet);
    }
    this.#render();
  }

  onBell() { this.bell = true; }

  onBought(itemId) {
    this.bought = itemId;
    this.dispatch({ type: 'bought', itemId });
    this.#persist(); // dompet berubah karena belanja: simpan agar reload tidak "mengembalikan" uang
  }

  /** Simpan progres + dompet + tempat (save v3). */
  #persist() {
    saveStory(this.storage, {
      version: SAVE_VERSION,
      ...Object.fromEntries(PROGRESS_KEYS.map((k) => [k, this.state[k]])),
      wallet: this.vendors.wallet,
      place: this.placeOf() ?? null,
    });
  }

  dispatch(event) {
    const { state, effects } = this.story.reduce(this.state, event);
    if (state === this.state && !effects.length) return;
    // Waktu habis mengulang langkah (timeLeft naik lagi): tracker putaran lama tidak boleh ikut terhitung.
    if (event.type === 'tick' && state.timeLeft != null && this.state.timeLeft != null && state.timeLeft > this.state.timeLeft) this.lap = null;
    this.state = state;
    effects.forEach((e) => this.#apply(e));
    this.#render();
  }

  #apply(effect) {
    switch (effect.type) {
      case 'toast': this.onToast(effect.text, effect.ok); break;
      case 'reward':
        this.vendors.credit(effect.rupiah);
        this.onWalletChange(this.vendors.wallet);
        this.onToast(`${effect.badge ? `Lencana: ${effect.badge} · ` : ''}+Rp ${effect.rupiah.toLocaleString('id-ID')}`, true);
        break;
      case 'consumeItem':
        this.vendors.consume(effect.itemId);
        this.onWalletChange(this.vendors.wallet);
        break;
      case 'save': this.#persist(); break;
      default: break;
    }
  }

  /**
   * @param {number} dt
   * @param {{time:number, bikePos:{x:number,z:number}, hour:number, raining:boolean, paused?:boolean}} ctx
   *   bikePos: koordinat DUNIA (M0). paused: toko/POV beku, jam misi tidak berjalan (jurnal terbuka juga menjeda)
   */
  update(dt, ctx) {
    const pos = ctx.bikePos;
    this.bikePos = pos;
    this.dispatch({ type: 'position', x: pos.x, z: pos.z });
    const paused = ctx.paused || this.journal.open;
    if (this.state.timeLeft != null && !this.state.dialog && !paused) this.dispatch({ type: 'tick', dt });
    this.#ensureFunds(dt);
    this.#updateLaps(pos, ctx.time);
    this.#updateEggs(dt, ctx);
    this.markers.setTarget(this.goalPoint());
    this.markers.update(ctx.time);
  }

  /** Pengaman soft-lock: beri uang saku bila saldo tak cukup untuk langkah beli/antar saat ini. */
  #ensureFunds(dt) {
    this.fundsTimer -= dt;
    if (this.fundsTimer > 0 || this.state.finished || this.state.dialog) return;
    this.fundsTimer = FUNDS_CHECK_SEC;
    const key = `${this.state.chapter}:${this.state.step}`;
    if (this.fundedStep === key) return;
    const short = fundsShortfall(this.#step().objective, this.vendors.wallet);
    if (short <= 0) return;
    this.fundedStep = key;
    this.vendors.credit(short);
    this.onWalletChange(this.vendors.wallet);
    this.onToast(`Uang saku +Rp ${short.toLocaleString('id-ID')} untuk menyelesaikan misi`, true);
    this.#persist();
  }

  #updateLaps(pos, time) {
    const step = this.#step();
    if (this.state.finished || step.objective.type !== 'laps' || this.state.dialog) { this.lap = null; return; }
    this.lap ??= createLapTracker(this.checkpoints, LAP_RADIUS);
    const r = stepLap(this.lap, pos, time);
    this.lap = r.state;
    if (r.lapSeconds != null) this.dispatch({ type: 'lapDone', seconds: r.lapSeconds });
  }

  #updateEggs(dt, ctx) {
    const r = stepEggs(this.eggState, {
      time: ctx.time, dt, pos: ctx.bikePos, hour: ctx.hour, raining: ctx.raining, bell: this.bell, bought: this.bought,
      anchors: this.anchors,
    }, this.eggs, this.state.eggs);
    this.eggState = r.state;
    this.bell = false;
    this.bought = null;
    r.ids.forEach((id) => this.dispatch({ type: 'egg', id }));
  }

  #step() { return this.chapters[this.state.chapter].steps[this.state.step]; }

  /** Pedagang hidup di koordinat lokal region stadion: cari dari posisi lokal, kembalikan titik dunia. */
  #nearestSelling(itemId) {
    const frame = this.frameOf(STADION_REGION);
    if (!frame || frame.identity) return this.vendors.nearestSelling(itemId, this.bikePos);
    const local = frame.toLocal(this.bikePos.x, this.bikePos.z);
    const best = this.vendors.nearestSelling(itemId, local);
    return best ? frame.toWorld(best.x, best.z) : null;
  }

  /** Titik DUNIA tujuan aktif untuk penanda & minimap (null bila tidak ada). */
  goalPoint() {
    if (this.state.finished || this.state.dialog) return null;
    const o = this.#step().objective;
    if (o.type === 'goto') return o.target;
    if (o.type === 'buy') return this.#nearestSelling(o.itemId);
    if (o.type === 'deliver') {
      const carrying = this.vendors.wallet.items.some((i) => i.id === o.itemId);
      return carrying ? this.npcs.find((n) => n.id === o.npcId) ?? null : this.#nearestSelling(o.itemId);
    }
    if (o.type === 'laps') return this.checkpoints[this.lap?.next ?? 0];
    if (o.type === 'find') {
      const id = o.ids.find((i) => !this.state.progress.found.includes(i));
      return this.eggs.find((e) => e.id === id)?.at ?? null;
    }
    return null;
  }

  #nearNpc(pos) {
    return this.npcs.find((n) => Math.hypot(n.x - pos.x, n.z - pos.z) <= NPC_RANGE) ?? null;
  }

  /** Teks prompt E untuk NPC/dialog (null bila tidak ada). `pos` dunia. */
  promptFor(pos) {
    if (this.state.dialog) return 'Tekan E — lanjut';
    const npc = this.#nearNpc(pos);
    return npc ? `Tekan E — bicara dengan ${npc.name}` : null;
  }

  /** E ditekan: lanjutkan dialog atau bicara dengan NPC (`pos` dunia). @returns {boolean} true bila ditangani. */
  tryInteract(pos) {
    if (this.state.dialog) { this.dispatch({ type: 'advance' }); return true; }
    const npc = this.#nearNpc(pos);
    if (!npc) return false;
    const carrying = this.vendors.wallet.items.map((i) => i.id);
    const before = this.state;
    this.dispatch({ type: 'interacted', id: npc.id, carrying });
    if (this.state === before) this.onToast(`${npc.name}: Halo, semangat ya!`, true);
    return true;
  }

  advanceDialog() { if (this.state.dialog) this.dispatch({ type: 'advance' }); }

  /** Jurnal butuh kursor: lepas pointer lock saat dibuka, kunci lagi saat ditutup. */
  toggleJournal() {
    if (this.journal.open) {
      this.journal.hide();
      this.pointerLock?.request();
      return;
    }
    this.pointerLock?.release();
    this.journal.show(this.#journalView());
  }

  reset() {
    this.dispatch({ type: 'reset' });
    this.eggState = createEggState();
    this.fundedStep = null; // uang saku per langkah boleh diberikan lagi setelah mulai ulang
    this.fundsTimer = 0;
    this.vendors.setWallet(createWallet()); // "Mulai dari awal" = dompet awal juga
    this.onWalletChange(this.vendors.wallet);
    this.#persist();
    this.journal.hide();
    this.onToast('Cerita dimulai ulang', true);
  }

  #journalView() {
    const s = this.state;
    return {
      rank: this.story.rankOf(s), rupiah: s.rupiah, bestLap: s.bestLap,
      chapters: this.chapters.map((c, i) => ({ title: c.title, done: s.finished || i < s.chapter, current: !s.finished && i === s.chapter })),
      badges: s.badges,
      eggs: this.eggs.map((e) => ({ title: e.title, text: e.text, hint: e.hint, found: s.eggs.includes(e.id) })),
    };
  }

  #goalText() {
    const s = this.state;
    const step = this.#step();
    const o = step.objective;
    if (o.type === 'laps') return `${step.text} (${s.progress.count}/${o.count})`;
    if (o.type === 'find') return `${step.text} (${s.progress.found.length}/${o.ids.length})`;
    return step.text;
  }

  #render() {
    const s = this.state;
    this.storyHud.render({
      chapterTitle: this.chapters[s.chapter].title,
      rank: this.story.rankOf(s),
      goal: s.finished ? '' : this.#goalText(),
      timeLeft: s.timeLeft,
      dialogLine: s.dialog ? s.dialog.lines[s.dialog.index] : null,
      finished: s.finished,
    });
  }
}
```

- [ ] **Step 6: Jalankan tes cerita, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js tests/storyStorage.test.js tests/storyEggTriggers.test.js tests/storyObjectives.test.js tests/storyReducer.test.js tests/storyData.test.js tests/storyLapTracker.test.js tests/storyFunds.test.js
```
Expected: semua lulus (`tests/storyDirector.test.js` = jumlah lama + 4).

- [ ] **Step 7: Seluruh suite + lint**

```bash
node node_modules/vitest/vitest.mjs run
```
Expected: semua lulus.

```bash
npm run lint
```
Expected: exit 0.

- [ ] **Step 8: Commit (dua commit berurutan: Task 11 lalu Task 12)**

```bash
git add src/story/storage.js tests/storyStorage.test.js
```
```bash
git commit -m "feat(story): save v3 dengan tempat terakhir ber-region (migrateV2, sanitizePlace), rantai migrasi v1 → v2 → v3"
```
```bash
git add src/story/eggTriggers.js src/sim/story/objectives.js src/core/StoryDirector.js tests/storyDirector.test.js
```
```bash
git commit -m "feat(core): StoryDirector di koordinat dunia (titik cerita ber-region via frameOf, pedagang dikonversi di batas, save menyimpan tempat)"
```

Catatan: di antara dua commit ini `tests/storyDirector.test.js` (versi lama di HEAD) gagal 2 asersi versi — diterima karena commit kedua menyusul langsung; jangan push di antaranya.

---

## Task 13: POV dari region aktif (`Digit8`)

Wiring + tes murni kecil. Region mendefinisikan `povs: [{id, label, pose(frame, ctx)}]` (pose dunia); tombol **8** = "POV region": tekan lagi untuk berpindah antar-POV region aktif (pola `cycle` pelari/pedagang). Tanpa region ber-POV: toast "POV belum tersedia" (perilaku tombol POV yang ada).

**Files:**
- Modify: `src/core/cameraPresets.js` (sisip setelah baris 23; case baru sebelum baris 269 `default: return false;`; JSDoc `povPose`)
- Modify: `src/core/povSource.js` (seluruh berkas, 61 baris)
- Modify: `src/core/PovDirector.js` (baris 40, 45, 52)
- Modify: `src/core/CameraRig.js:137-157`
- Modify: `index.html:34`
- Test: `tests/regionPov.test.js`

- [ ] **Step 1: Tulis tes yang gagal** — buat `tests/regionPov.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { POV_BY_ID, POV_BY_KEY, POVS, povPose, createPose } from '../src/core/cameraPresets.js';
import { PovDirector } from '../src/core/PovDirector.js';
import { createPovSource } from '../src/core/povSource.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';

const pose = (over = {}) => ({ px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 6, ...over });
const bike = { x: 0, z: 0, yaw: 0 };

describe('POV region (M0)', () => {
  it('Digit8 = POV region: cycle, tidak mengendalikan sepeda; POV 1–7 tidak berubah', () => {
    expect(POV_BY_KEY.Digit8.id).toBe('region');
    expect(POV_BY_ID.region).toMatchObject({ kind: 'region', cycle: true, controlsBike: false });
    expect(POVS.slice(0, 7).map((p) => p.id)).toEqual(['udara', 'tribun', 'bola', 'pelari', 'pedagang', 'orbit', 'atas']);
  });

  it('povPose region: pose dunia dari sumber apa adanya (tanpa transform frame stadion)', () => {
    const src = {
      bike, frame: createRegionFrame({ x: 500, z: 0, yaw: 1 }),
      regionPov: () => ({ id: 'r:a', label: 'A', pose: ({ time }) => pose({ tz: 6 + time }) }),
    };
    const out = createPose();
    expect(povPose(POV_BY_ID.region, src, 0, 1, out)).toBe(true);
    expect(out).toEqual({ px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 7, fov: POV_BY_ID.region.fov });
    expect(povPose(POV_BY_ID.region, { ...src, regionPov: () => ({ pose: () => pose({ fov: 30 }) }) }, 0, 0, out)).toBe(true);
    expect(out.fov).toBe(30);
  });

  it('povPose region: tanpa POV region atau pose tidak sah → false', () => {
    const out = createPose();
    expect(povPose(POV_BY_ID.region, { bike }, 0, 0, out)).toBe(false);
    expect(povPose(POV_BY_ID.region, { bike, regionPov: () => null }, 0, 0, out)).toBe(false);
    expect(povPose(POV_BY_ID.region, { bike, regionPov: () => ({ pose: () => null }) }, 0, 0, out)).toBe(false);
    expect(povPose(POV_BY_ID.region, { bike, regionPov: () => ({ pose: () => pose({ py: Number.NaN }) }) }, 0, 0, out)).toBe(false);
  });

  it('povSource: POV dari region aktif (urut pemasangan), indeks melingkar, frame region diteruskan', () => {
    const frame = createRegionFrame({ x: 100, z: 0, yaw: 0 });
    const regions = {
      active: () => [
        { def: { id: 'stadion', povs: [] }, frame: IDENTITY_FRAME },
        { def: { id: 'uji', povs: [{ id: 'a', label: 'A', pose: (f) => pose({ px: f.toWorld(0, 0).x }) }, { id: 'b', label: 'B', pose: () => pose() }] }, frame },
      ],
    };
    const ents = { bike: { state: { x: 0, z: 0, yaw: 0 } } };
    const src = createPovSource(ents, IDENTITY_FRAME, { regions });
    expect(src.regionPovCount()).toBe(2);
    const a = src.regionPov(2); // melingkar ke indeks 0
    expect([a.id, a.label]).toEqual(['uji:a', 'A']);
    expect(a.pose({ time: 0, bike: src.bike }).px).toBe(100);
    expect(src.regionPov(1).label).toBe('B');
    const lone = createPovSource(ents);
    expect(lone.regionPovCount()).toBe(0);
    expect(lone.regionPov(0)).toBeNull();
  });

  it('PovDirector: label POV region = label POV subjek; pindah subjek mengganti label', () => {
    const d = new PovDirector(new PerspectiveCamera(60, 16 / 9, 0.3, 2500));
    expect(d.label).toBeNull();
    const list = [{ label: 'A', pose: () => pose() }, { label: 'B', pose: () => pose({ px: 50 }) }];
    const src = { bike, regionPov: (i) => list[i % 2] };
    expect(d.enter(POV_BY_ID.region, src, 0)).toBe(true);
    expect(d.label).toBe('A');
    d.setSubject(1);
    expect(d.label).toBe('B');
    d.exit({ instant: true });
    expect(d.label).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

```bash
node node_modules/vitest/vitest.mjs run tests/regionPov.test.js
```
Expected: FAIL — `POV_BY_KEY.Digit8` undefined, `regionPovCount is not a function`.

- [ ] **Step 3: `cameraPresets.js`**

Sisipkan setelah baris 23 (entri `{ id: 'atas', … }`):

```js
  // M0 multi-region: POV milik region aktif (Region.povs, pose dunia); tekan lagi = POV region berikutnya.
  { id: 'region', label: 'POV region', key: 'Digit8', kind: 'region', fov: 55, controlsBike: false, cycle: true, minElev: -0.2, maxElev: 1.4, zoomMin: 0.4, zoomMax: 2.0 },
```

Pada JSDoc `povPose`, ganti baris parameter `src`:
```js
 *   vendor?:(i:number)=>({x:number,z:number,yaw:number}|null), frame?:object}} src
```
menjadi:
```js
 *   vendor?:(i:number)=>({x:number,z:number,yaw:number}|null), frame?:object,
 *   regionPov?:(i:number)=>({id:string, label:string, pose(ctx:{time:number, bike:object}):object|null}|null)}} src
```

Di dalam `switch (def.id)` `povPose`, sisipkan sebelum baris `default: return false;`:

```js
    case 'region': { // pose region sudah di frame DUNIA: tanpa poseToWorld stadion
      const p = src.regionPov?.(subject)?.pose({ time, bike: src.bike });
      if (!p || ![p.px, p.py, p.pz, p.tx, p.ty, p.tz].every(Number.isFinite)) return false;
      out.px = p.px; out.py = p.py; out.pz = p.pz;
      out.tx = p.tx; out.ty = p.ty; out.tz = p.tz;
      out.fov = Number.isFinite(p.fov) ? p.fov : def.fov;
      return true;
    }
```

- [ ] **Step 4: `povSource.js`** — ganti seluruh isi:

```js
import { pointOnLane } from '../sim/trackPath.js';
import { IDENTITY_FRAME } from '../geo/regionTransform.js';

/**
 * Adapter entitas → sumber posisi untuk POV (lihat cameraPresets.povPose).
 * Entitas region (bola, pelari, pedagang) hidup di koordinat region-lokal; adapter mengubahnya ke
 * frame dunia lewat `frame` (createRegionFrame region stadion). Sepeda sudah di koordinat dunia.
 * M0: `regions` (regionManager) memberi POV milik region aktif (`def.povs`, pose dunia) untuk POV 'region'.
 * Mengembalikan objek yang dipakai ulang (tanpa alokasi per panggilan selain hasil sim).
 * @param {{bike:{state:object}, match?:{ball?:{pos:{x:number,z:number}}},
 *   runners?:{runners:object[]}, vendors?:{vendors:object[]}}} ents
 * @param {{identity:boolean, toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}} [frame]
 * @param {{regions?: {active(): ReadonlyArray<{def:{id:string, povs?:ReadonlyArray<object>}, frame:object}>}|null}} [opts]
 */
export function createPovSource(ents, frame = IDENTITY_FRAME, { regions = null } = {}) {
  const ballOut = { x: 0, z: 0 };
  const runnerOut = { x: 0, z: 0, yaw: 0 };
  const vendorOut = { x: 0, z: 0, yaw: 0 };
  const wrap = (i, n) => ((i % n) + n) % n;
  const place = (out, x, z, yaw) => {
    if (frame.identity) {
      out.x = x;
      out.z = z;
      if (yaw !== undefined) out.yaw = yaw;
      return out;
    }
    const w = frame.toWorld(x, z);
    out.x = w.x;
    out.z = w.z;
    if (yaw !== undefined) out.yaw = frame.yawToWorld(yaw);
    return out;
  };
  /** POV region aktif, urut pemasangan region lalu urutan `povs`. */
  const regionPovs = () => {
    const out = [];
    for (const a of regions?.active() ?? []) {
      for (const pov of a.def.povs ?? []) out.push({ regionId: a.def.id, frame: a.frame, pov });
    }
    return out;
  };

  return {
    frame,
    get bike() { return ents.bike.state; },

    ball() {
      const pos = ents.match?.ball?.pos;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return null;
      return place(ballOut, pos.x, pos.z);
    },

    runnerCount() { return ents.runners?.runners.length ?? 0; },
    runner(i) {
      const list = ents.runners?.runners ?? [];
      if (list.length === 0) return null;
      const r = list[wrap(i, list.length)];
      const p = pointOnLane(r.lane, r.dist);
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) return null;
      return place(runnerOut, p.x, p.z, p.yaw ?? 0);
    },

    vendorCount() { return ents.vendors?.vendors.length ?? 0; },
    vendor(i) {
      const list = ents.vendors?.vendors ?? [];
      if (list.length === 0) return null;
      const v = list[wrap(i, list.length)];
      if (!Number.isFinite(v?.position?.x) || !Number.isFinite(v?.position?.z)) return null;
      return place(vendorOut, v.position.x, v.position.z, v.yaw ?? 0);
    },

    regionPovCount() { return regionPovs().length; },
    /** POV region ke-i (melingkar); `pose(ctx)` = pov.pose(frame region, ctx). null bila tidak ada. */
    regionPov(i) {
      const list = regionPovs();
      if (list.length === 0) return null;
      const r = list[wrap(i, list.length)];
      return { id: `${r.regionId}:${r.pov.id}`, label: r.pov.label, pose: (ctx) => r.pov.pose(r.frame, ctx) };
    },
  };
}
```

- [ ] **Step 5: `PovDirector.js`**

Setelah baris 40 (`this._hasSmooth = false;` di constructor, sebelum `}` penutup constructor), sisipkan:
```js
    this._src = null; // sumber POV terakhir (label subjek POV region)
```

Ganti baris 45:
```js
  get label() { return this.mode === 'pov' ? this.def.label : null; }
```
menjadi:
```js
  /** Label POV aktif; POV region memakai label POV region subjek (mis. "Teras sekre"). */
  get label() {
    if (this.mode !== 'pov') return null;
    if (this.def.kind === 'region') return this._src?.regionPov?.(this.subject)?.label ?? this.def.label;
    return this.def.label;
  }
```

Di `enter(def, src, subject = 0)`, setelah baris `this.def = def;` sisipkan:
```js
    this._src = src;
```

- [ ] **Step 6: `CameraRig.js:137-157`** — ganti blok `handlePovKey` + `#subjectCount`:

```js
  handlePovKey(code) {
    if (code === EXIT_KEY) return this.exitPov() ? 'Kembali ke sepeda' : null;
    const def = POV_BY_KEY[code];
    if (!def || !this._source) return null;
    const d = this.director;
    if (d.povId === def.id) {
      if (!def.cycle) return this.exitPov() ? 'Kembali ke sepeda' : null;
      const count = this.#subjectCount(def.id);
      d.setSubject((d.subject + 1) % Math.max(1, count));
      return `${def.label} ${(d.subject % Math.max(1, count)) + 1}/${count}`;
    }
    return d.enter(def, this._source, 0) ? def.label : null;
  }

  #subjectCount(id) {
    const s = this._source;
    if (id === 'pelari') return s.runnerCount?.() ?? 1;
    if (id === 'pedagang') return s.vendorCount?.() ?? 1;
    return 1;
  }
```
menjadi:
```js
  handlePovKey(code) {
    if (code === EXIT_KEY) return this.exitPov() ? 'Kembali ke sepeda' : null;
    const def = POV_BY_KEY[code];
    if (!def || !this._source) return null;
    const d = this.director;
    if (d.povId === def.id) {
      if (!def.cycle) return this.exitPov() ? 'Kembali ke sepeda' : null;
      const count = this.#subjectCount(def.id);
      d.setSubject((d.subject + 1) % Math.max(1, count));
      return `${d.label} ${(d.subject % Math.max(1, count)) + 1}/${count}`; // POV region: label POV subjek
    }
    return d.enter(def, this._source, 0) ? d.label : null;
  }

  #subjectCount(id) {
    const s = this._source;
    if (id === 'pelari') return s.runnerCount?.() ?? 1;
    if (id === 'pedagang') return s.vendorCount?.() ?? 1;
    if (id === 'region') return s.regionPovCount?.() ?? 1;
    return 1;
  }
```
(Untuk POV non-region `d.label === def.label`: toast tidak berubah.)

- [ ] **Step 7: `index.html:34`** — ganti `<b>1–7</b> sudut pandang` menjadi `<b>1–8</b> sudut pandang`.

- [ ] **Step 8: Jalankan tes POV & kamera, pastikan LULUS**

```bash
node node_modules/vitest/vitest.mjs run tests/regionPov.test.js tests/cameraPresets.test.js tests/povDirector.test.js tests/cameraRigLook.test.js tests/cameraRigPlayer.test.js tests/placement.test.js
```
Expected: semua lulus (`tests/regionPov.test.js` 5 tes).

- [ ] **Step 9: Lint & commit**

```bash
npm run lint
```
Expected: exit 0.

```bash
git add src/core/cameraPresets.js src/core/povSource.js src/core/PovDirector.js src/core/CameraRig.js index.html tests/regionPov.test.js
```
```bash
git commit -m "feat(core): POV dari region aktif (tombol 8, pose dunia milik region, label per POV region)"
```

---

## Task 14: Wiring `main.js` + keymap + devtools

Wiring (tanpa tes unit baru; diverifikasi suite + build + smoke Task 15). Perilaku stadion harus identik: region stadion persistent dipasang pada langkah loading yang sama, kota sesudahnya, minimap dibake pada langkah 0,97 yang sama.

**Files:**
- Modify: `src/app/keymap.js:9,13,28`
- Modify: `src/app/devtools.js` (seluruh berkas, 30 baris)
- Modify: `src/main.js` (seluruh berkas, 356 baris)

- [ ] **Step 1: `keymap.js`**

Hapus baris 9:
```js
import { pointToLocal } from './regionContext.js';
```

Ganti baris 13:
```js
export function handleKeys(input, { rig, hud, ents, shop, time, store, story, frame, travelMenu = null }) {
```
menjadi:
```js
export function handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu = null }) {
```

Ganti baris 28:
```js
    if (hud.shopOpen || !story.tryInteract(pointToLocal(frame, ents.bike.state))) handleShopKey(rig, hud, ents, shop); // cerita region-lokal
```
menjadi:
```js
    if (hud.shopOpen || !story.tryInteract(ents.bike.state)) handleShopKey(rig, hud, ents, shop); // cerita di koordinat dunia (M0)
```

- [ ] **Step 2: `devtools.js`** — ganti seluruh isi:

```js
/**
 * Alat debug mode dev: teleport, statistik renderer, store settings, region manager, pembongkaran aplikasi.
 */
import { createCollider } from '../core/Collider.js';

/**
 * Placement uji dari query string `?placement=x,z,yaw` (meter, meter, radian); null bila tidak ada
 * atau tidak valid. Hanya dipakai mode dev (uji placement non-identitas ujung-ke-ujung).
 */
export function parsePlacementParam(search) {
  const raw = new URLSearchParams(search ?? '').get('placement');
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  const [x, z, yaw] = parts;
  return { x, z, yaw };
}

/** Bendera dev dari query string (`?nama`, `?nama=1`); false bila tidak ada atau bernilai "0"/"false". */
export function parseFlagParam(search, name) {
  const params = new URLSearchParams(search ?? '');
  if (!params.has(name)) return false;
  const v = params.get(name);
  return v !== '0' && v !== 'false';
}

export function exposeDevTools({
  app, ents, rig, time, weather, store, audioBus, story, colliders, city = null, remountRegion = null, fastTravel = null,
  regions = null, scheduler = null, terrain = null, teardown,
}) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story, city, remountRegion, fastTravel, regions, scheduler, terrain,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
    /** Bongkar seluruh aplikasi (uji siklus hidup); muat ulang halaman untuk memulai lagi. */
    teardown,
  };
}
```

- [ ] **Step 3: `main.js`** — ganti seluruh isi:

```js
import * as THREE from 'three';
import { App, hasWebGL } from './core/App.js';
import { Input } from './core/Input.js';
import { createGamepadPoller } from './core/gamepad.js';
import { TouchControls } from './ui/TouchControls.js';
import { isTouchPrimary } from './ui/touchMath.js';
import './ui/touch.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { CameraRig } from './core/CameraRig.js';
import { createCollider, createDynamicCompositeCollider, localized } from './core/Collider.js';
import { createPovSource } from './core/povSource.js';
import { POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
import { createLighting } from './world/Lighting.js';
import { createTimeOfDay } from './world/TimeOfDay.js';
import { createWeather } from './world/Weather.js';
import { formatHour } from './sim/dayCycle.js';
import { Minimap2D } from './ui/Minimap2D.js';
import { MainMenu } from './ui/MainMenu.js';
import { hasStoryProgress } from './ui/menuModel.js';
import { createRotatePrompt } from './ui/orientation.js';
import { STORY_NPCS } from './story/chapters.js';
import { resolvePoint, localizePoint } from './story/points.js';
import { updateWind } from './world/shaders/windState.js';
import { buildEntities } from './entities/index.js';
import { HUD } from './ui/HUD.js';
import { createWallet } from './sim/vendorSim.js';
import { createSettingsStore, STORAGE_KEY } from './settings/store.js';
import { safeLocalStorage } from './settings/safeStorage.js';
import { bindAll } from './ui/bindings/index.js';
import { createLoadingScreen } from './ui/LoadingScreen.js';
import { StoryDirector } from './core/StoryDirector.js';
import { StoryNpcs } from './entities/StoryNpcs.js';
import { createStoryMarkers } from './world/StoryMarkers.js';
import { StoryHUD } from './ui/StoryHUD.js';
import { StoryJournal } from './ui/StoryJournal.js';
import { disposeTree } from './engine/disposeTree.js';
import { createScheduler } from './engine/scheduler.js';
import { stadionRegion, STADION_ID } from './regions/stadion/index.js';
import { session, setupMenu } from './app/session.js';
import { handleKeys } from './app/keymap.js';
import { setupShop, updatePrompt } from './app/shop.js';
import { exposeDevTools, parsePlacementParam, parseFlagParam } from './app/devtools.js';
import { createDisposerStack } from './app/lifecycle.js';
import { applyPlacement } from './app/mountRegion.js';
import { createRegionManager } from './app/regionManager.js';
import { createTerrainService } from './app/terrainService.js';
import { createLocalContext, pointToWorld } from './app/regionContext.js';
import { withPlacement } from './regions/Region.js';
import { createCity } from './city/index.js';
import { STREAM } from './city/ChunkStreamer.js';
import { createAttribution } from './ui/Attribution.js';
import { travelDestinations, createFastTravel } from './app/fastTravel.js';
import { FastTravelMenu, createTravelScreen } from './ui/FastTravelMenu.js';

const MODELS_TIMEOUT_MS = 8000;

function showFatal(msg) {
  const panel = document.querySelector('#overlay .panel');
  panel.replaceChildren(Object.assign(document.createElement('p'), { textContent: msg }));
}

async function main() {
  if (!hasWebGL()) return showFatal('Browser ini tidak mendukung WebGL. Coba Chrome/Edge terbaru.');
  const loading = createLoadingScreen();
  await loading.step(0.05, 'Menyiapkan mesin grafis…');

  // Pembongkaran berurutan terbalik (LIFO); dipakai __sim.teardown() di mode dev.
  const lifecycle = createDisposerStack();
  const listeners = new AbortController();
  const app = new App(document.getElementById('app'));
  lifecycle.add(() => app.dispose());
  lifecycle.add(() => listeners.abort());
  const input = new Input();
  lifecycle.add(() => input.dispose());
  const hud = new HUD(document.getElementById('hud'));
  const rig = new CameraRig(app.camera, app.renderer.domElement);
  lifecycle.add(() => rig.dispose());
  // Kontrol sentuh + gamepad menulis ke Input yang sama dengan keyboard.
  const touchUi = new TouchControls(document.body, { input, rig, surface: app.renderer.domElement });
  lifecycle.add(() => touchUi.dispose());
  const gamepad = createGamepadPoller(input, { lookBy: (dx, dy) => rig.lookBy(dx, dy) });
  app.addSystem({ id: 'gamepad', phase: 'input', update: (dt) => gamepad.update(dt) });
  window.addEventListener('gamepadconnected', () => hud.toast('Gamepad terhubung', true), { signal: listeners.signal });
  const audioBus = createAudioBus();
  lifecycle.add(() => audioBus.dispose());
  const storage = safeLocalStorage();
  const firstRun = storage?.getItem(STORAGE_KEY) == null;
  const store = createSettingsStore({ storage });
  const touch = isTouchPrimary();
  if (touch && firstRun) store.set('performance.minimap', false); // layar kecil: minimap menutupi tombol layar
  // Perubahan terakhir tidak boleh hilang saat tab ditutup/disembunyikan (debounce 150 ms).
  window.addEventListener('pagehide', () => store.flush(), { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); }, { signal: listeners.signal });

  await loading.step(0.12, 'Menyiapkan langit, pencahayaan, waktu, dan cuaca…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });
  // Mode dev: ?placement=x,z,yaw memindahkan region (uji I1); produksi selalu memakai placement region.
  const devPlacement = import.meta.env.DEV ? parsePlacementParam(window.location.search) : null;
  const stadionDef = devPlacement ? withPlacement(stadionRegion, devPlacement) : stadionRegion;
  // Siklus waktu & cuaca dibuat sebelum region: region mendaftar ke registry emissive/basah/lampu saat dipasang.
  // Sistemnya tetap didaftarkan sesudah entitas (urutan fase world tidak berubah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  const weather = createWeather(app.scene, app, lighting, { audioBus, puddlePlacement: stadionDef.placement });
  app.scene.add(weather.group);
  lifecycle.add(() => weather.dispose());

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  const { regions, scheduler, terrain, colliders } = createRegionLayer({ app, store, time, weather, lifecycle });
  const stadion = await regions.register(stadionDef); // persistent: dipasang sekarang (urutan muat seperti sebelum M0)
  const frame = regions.frameOf(STADION_ID); // frame region stadion: entitas, cerita NPC, kamera, minimap
  const toLocalCtx = createLocalContext(frame);
  if (import.meta.env.DEV && parseFlagParam(window.location.search, 'dummyRegion')) {
    const { createDummyRegion } = await import('./app/dummyRegion.js');
    regions.register(createDummyRegion()); // uji streaming M0: pusat (0, 1100), pasang < 700 m, lepas > 900 m
  }
  /** Uji siklus hidup (dev/E2E): lepas lalu pasang ulang region stadion; kembalikan Promise model siap. */
  const remountRegion = () => regions.remount(STADION_ID);
  const region = stadion.region;

  await loading.step(0.4, 'Menyiapkan peta kota (OpenStreetMap)…');
  // Kota: tile OSM di-stream di sekitar fokus. Manifest gagal → null: mode hanya-region (perilaku lama) + toast.
  const city = await createCity({ app, baseUrl: import.meta.env.BASE_URL, weather, time, toast: (t, ok) => hud.toast(t, ok) });
  if (city) {
    lifecycle.add(() => city.dispose());
    time.setFogLimit(STREAM.loadRadius); // batas muat tertutup kabut
    lifecycle.add(createAttribution(document.body).dispose);
  }
  // Di dalam mask region aktif → collider region (lokal); di luar → TileCollider kota (tanpa kota: tanah stadion
  // menutup dunia). Komposit meneruskan `penetration`: sepeda terjebak hanya boleh keluar, tidak menembus.
  colliders.setFallback(city ? city.collider : localized(stadionDef, region.colliders));
  rig.setObstacleTest(colliders.isCameraClear);
  const modelsReady = stadion.ready
    .then(({ failed, cancelled }) => { // region dibongkar sebelum selesai: tidak ada yang dilaporkan
      if (!cancelled && stadion.mounted && failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false);
    })
    .catch((err) => console.error('Model 3D region gagal diproses:', err));

  await loading.step(0.55, 'Menyiapkan pemain, pelari, pedagang, dan penonton…');
  const wallet = createWallet();
  // Jangkar region: entitas & objek cerita region-lokal ditempel di bawah grup ber-placement.
  const anchor = applyPlacement(new THREE.Group(), frame.placement);
  anchor.name = 'jangkarRegion';
  app.scene.add(anchor);
  lifecycle.add(() => anchor.removeFromParent());
  const spawn = region.layout.spawn; // region-lokal: plaza utara, menghadap stadion
  const start = { ...frame.toWorld(spawn.x, spawn.z), yaw: frame.yawToWorld(spawn.yaw) };
  const ents = buildEntities({ start, world: region, wallet, camera: app.camera });
  app.scene.add(ents.group);
  anchor.add(ents.regionGroup);
  lifecycle.add(() => {
    ents.bike.dispose();
    for (const g of [ents.group, ents.regionGroup]) { g.removeFromParent(); disposeTree(g); }
  });
  ents.bike.setCollider(createCollider(start, colliders.isWalkable, colliders.penetration));
  rig.attachSource(createPovSource(ents, frame, { regions }));
  regions.on('unmount', () => { if (rig.povId === 'region') rig.exitPov(); }); // POV region yang dilepas tidak boleh membeku
  ents.bike.setAudioBus(audioBus);
  // Sepeda di frame dunia; entitas region menerima ctx region-lokal (bikePos/focus dikonversi sekali per frame).
  ents.updatables.forEach((e, i) => app.addSystem({
    id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, e === ents.bike ? ctx : toLocalCtx(ctx)),
  }));

  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  time.registerEmissive(ents.group);
  time.registerEmissive(ents.regionGroup);
  app.addSystem({ id: 'timeOfDay', phase: 'world', update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addSystem({ id: 'weather', phase: 'world', update: (dt, ctx) => weather.update(dt, ctx) }); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  const story = setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story, frame, regions);
  if (city) minimap.setTileLayer(city.minimap);
  const travel = setupFastTravel({ lifecycle, hud, rig, ents, colliders, city, frame, spawn: region.layout.spawn, touch });
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel });

  // Binding store -> scene (satu sumber kebenaran). Dipasang setelah semua objek ada.
  lifecycle.add(bindAll(store, {
    app, time, lighting, weather, rig, hud, audioBus, crowd: ents.crowd, vendors: ents.vendors,
  }));

  const bikePos = new THREE.Vector3();
  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali
    return { dt, rawDt, time: t, bikePos, focus: rig.focus, input: hud.shopOpen || rig.freezesBike || travel.blocksInput ? null : input };
  });
  // LIFO: loop berhenti lebih dulu, sebelum sistem kehilangan sumber dayanya (App.dispose mengulanginya, idempoten).
  lifecycle.add(() => app.renderer.setAnimationLoop(null));

  const menu = new MainMenu();
  const rotatePrompt = createRotatePrompt(document.body, { isTouch: touch });
  lifecycle.add(() => rotatePrompt.dispose());
  setupMenu({ app, rig, hud, store, touchUi, touch, menu, story })
    .then((mounted) => lifecycle.add(() => mounted.dispose()))
    .catch((err) => console.error('Panel pengaturan gagal dipasang:', err));
  await loading.step(0.9, 'Memuat model 3D (tugu, bangku)…');
  // Model 3D opsional (ada cadangan prosedural): jangan tahan tombol Mulai bila unduhan macet.
  await Promise.race([modelsReady, new Promise((resolve) => setTimeout(resolve, MODELS_TIMEOUT_MS))]);
  await loading.step(0.97, 'Menggambar peta…');
  // Base layer minimap per region aktif dibake sekarang (galat bake ditangani manager: latar polos);
  // region yang dipasang kemudian dibake setelah siap.
  regions.attachMinimap(minimap);
  await loading.step(1, 'Siap!');
  loading.done();
  // Latar menu: kamera orbit sinematik mengelilingi stadion (sepeda dibekukan, cerita dijeda) sampai pemain menekan Mulai.
  rig.handlePovKey(POVS.find((p) => p.id === 'orbit').key);
  menu.ready({ hasProgress: hasStoryProgress(story.state), touch });
  if (import.meta.env.DEV) {
    exposeDevTools({
      app, ents, rig, time, weather, store, audioBus, story, colliders, city, remountRegion, regions, scheduler, terrain,
      fastTravel: (id) => travel.go(id), teardown: () => lifecycle.disposeAll(),
    });
  }
}

/**
 * Lapisan multi-region (M0): terrain (stub datar), scheduler time-sliced, collider komposit dinamis, dan
 * region manager. Sistem `regions` (sim) memasang/melepas region streaming menurut fokus; `scheduler` (ui,
 * akhir frame sebelum render) menjalankan pekerjaan berat region ≤ 4 ms/frame.
 */
function createRegionLayer({ app, store, time, weather, lifecycle }) {
  const terrain = createTerrainService();
  const scheduler = createScheduler();
  const colliders = createDynamicCompositeCollider();
  const regions = createRegionManager({ app, store, time, weather, terrain, collider: colliders, scheduler });
  lifecycle.add(() => regions.dispose()); // LIFO: region dicabut sebelum time/weather di-dispose
  app.addSystem({ id: 'regions', phase: 'sim', update: (dt, ctx) => regions.update(ctx.focus) });
  app.addSystem({ id: 'scheduler', phase: 'ui', update: () => scheduler.update() });
  return { regions, scheduler, terrain, colliders };
}

/**
 * Sistem per frame milik composition root (dulu satu updatable raksasa). Hotkey kini di fase input
 * (efeknya terlihat satu frame lebih awal; tidak ada perbedaan visual), cerita di sim, kamera di camera,
 * HUD dan input.endFrame di ui (endFrame terdaftar terakhir di antara konsumen tombol).
 */
function addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel }) {
  app.addSystem({
    id: 'keymap',
    phase: 'input',
    update: () => { if (session.started) handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu: travel.menu }); }, // menu terbuka: tombol game diabaikan
  });
  app.addSystem({
    id: 'story',
    phase: 'sim',
    update: (dt, ctx) => story.update(dt, {
      time: ctx.time, bikePos: ents.bike.state, hour: time.hour, // cerita di koordinat dunia (titik ber-region di-resolve StoryDirector)
      raining: Boolean(store.get('weather.raining')), paused: hud.shopOpen || rig.freezesBike || travel.busy, // timer misi beku selama perjalanan
    }),
  });
  app.addSystem({
    id: 'cameraRig',
    phase: 'camera',
    update: (dt, ctx) => {
      rig.update(ents.bike.state, dt, ctx.time);
      ents.bike.setRiderVisible(!rig.firstPersonView);
      // POV beku: sepeda berhenti seketika (bukan meluncur karena momentum)
      if (rig.freezesBike && ents.bike.state.v !== 0) ents.bike.state = { ...ents.bike.state, v: 0 };
    },
  });
  app.addSystem({
    id: 'hud',
    phase: 'ui',
    update: (dt, ctx) => {
      hud.setCameraView(rig.mode, rig.povLabel, rig.freezesBike);
      hud.setSpeed(ents.bike.speedKmh);
      hud.setTime(formatHour(time.hour), time.presetName, weather.weatherName);
      hud.setScore(ents.match.score);
      hud.tickFps(ctx.rawDt ?? dt); // FPS jujur: delta mentah, bukan yang di-clamp
      updatePrompt(hud, ents, story, ents.bike.state); // prompt NPC cerita di koordinat dunia
    },
  });
  app.addSystem({ id: 'input.endFrame', phase: 'ui', update: () => input.endFrame() });
}

/**
 * Perjalanan cepat (G / tombol HUD): Stadion & Masjid Raya An-Nur; teleport menunggu tile tujuan
 * dimuat streamer sebelum layar perjalanan ditutup. Tanpa kota: hanya Stadion.
 */
function setupFastTravel({ lifecycle, hud, rig, ents, colliders, city, frame, spawn, touch }) {
  const screen = createTravelScreen(document.body);
  lifecycle.add(() => screen.dispose());
  const travel = createFastTravel({
    destinations: travelDestinations({ manifest: city?.manifest ?? null, frame, spawn }), bike: ents.bike, colliders, city, screen,
    isCameraClear: colliders.isCameraClear, rig, // POV ditutup dulu (menu & devtools); muncul dengan ruang kamera
  });
  const menu = new FastTravelMenu(document.body, {
    destinations: travel.destinations,
    touch,
    onTravel: (id) => travel.go(id)
      .then((status) => { if (status === 'timeout') hud.toast('Sebagian peta tujuan belum termuat', false); })
      .catch((err) => console.error('Perjalanan cepat gagal:', err)),
  });
  lifecycle.add(() => menu.dispose());
  return {
    menu,
    get busy() { return travel.busy; },
    /** Selama perjalanan atau panel terbuka sepeda tidak dikayuh (pola toko): WASD memilih tujuan. */
    get blocksInput() { return travel.busy || menu.open; },
    go: (id) => travel.go(id),
  };
}

/**
 * Cerita: NPC (region-lokal stadion, di bawah jangkar) dan penanda tujuan (DUNIA: tujuan bisa di region mana
 * pun), HUD, jurnal; progres dimuat dari localStorage (save v3 menyimpan tempat pemain sebagai titik ber-region).
 */
function setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle }) {
  const root = document.getElementById('hud');
  const npcs = new StoryNpcs();
  const markers = createStoryMarkers();
  anchor.add(npcs.group);
  app.scene.add(markers.group); // goalPoint() StoryDirector kini titik dunia
  lifecycle.add(() => markers.group.removeFromParent());
  ents.lod.addFrom(npcs.group);
  app.addSystem({
    id: 'storyNpcLabels',
    phase: 'ui',
    update: (dt, ctx) => {
      const local = toLocalCtx(ctx);
      npcs.refreshLabels(local.focus ?? local.bikePos, ents.vendors.labelsEnabled);
    },
  });
  const frameOf = (id) => regions.frameOf(id);
  let story = null;
  const storyHud = new StoryHUD(root, { onAdvance: () => story.advanceDialog() });
  const journal = new StoryJournal(root, { onReset: () => story.reset(), onClose: () => story.toggleJournal() });
  const pointerLock = { release: () => document.exitPointerLock?.(), request: () => rig.requestLock() };
  story = new StoryDirector({
    storage: safeLocalStorage(), vendors: ents.vendors, storyHud, journal, markers, pointerLock,
    onToast: (text, ok) => hud.toast(text, ok),
    onWalletChange: (wallet) => hud.setWallet(wallet),
    frameOf,
    placeOf: () => {
      const b = ents.bike.state;
      return localizePoint(b, regions.regionAt(b.x, b.z), frameOf);
    },
  });
  ents.bike.onRing = () => story.onBell();
  story.start();
  return story;
}

const PIN_VENDOR = '#ff9f1c';
const PIN_NPC = '#4cc9f0';

/** Minimap 2D (frame dunia): base layer per region dibake regionManager; marker region diubah ke dunia. */
function setupMinimap(app, ents, story, frame, regions) {
  const minimap = new Minimap2D(document.body);
  const frameOf = (id) => regions.frameOf(id);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => pointToWorld(frame, { x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.flatMap((n) => {
      const w = resolvePoint(n, frameOf);
      return w ? [{ x: w.x, z: w.z, color: PIN_NPC }] : [];
    }),
  ];
  app.addSystem({
    id: 'minimap',
    phase: 'ui',
    update(dt, ctx) {
      minimap.setVisible(app.minimapVisible);
      const b = ents.bike.state;
      minimap.update(ctx.time, { focus: b, yaw: b.yaw, goal: story.goalPoint(), getPins: pins });
    },
  });
  return minimap;
}

main().catch((err) => {
  console.error(err);
  document.getElementById('loading-fill')?.classList.add('failed');
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat. Muat ulang halaman.';
});
```

- [ ] **Step 4: Suite + lint + build**

```bash
node node_modules/vitest/vitest.mjs run
```
Expected: semua lulus (termasuk `tests/keymapTravel.test.js`; deps ekstra `frame` di tes diabaikan).

```bash
npm run lint
```
Expected: exit 0 (tidak ada impor tak terpakai: `pointToLocal`, `createCompositeCollider`, `mountRegion`, `createRegionFrame`, `maskHalfExtent` sudah dihapus dari `main.js`).

```bash
npm run build
```
Expected: `✓ built in` tanpa error. Cek bahwa region dummy tidak masuk chunk utama produksi:

```bash
grep -l "Region uji dari atas" dist/assets/*.js
```
Expected: tidak ada keluaran (exit 1): cabang `import.meta.env.DEV` dibuang saat build produksi sehingga region dummy tidak ikut bundel (terverifikasi saat plan ditulis). Bila muncul di berkas mana pun: catat sebagai temuan (ukuran kecil, tidak memblokir), jangan ubah rencana.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/app/keymap.js src/app/devtools.js
```
```bash
git commit -m "refactor: main.js memakai regionManager (stadion persistent), scheduler di loop, terrain stub, collider dinamis, cerita/POV/minimap per region"
```

---

## Task 15: Smoke visual (Playwright GPU) — stadion identik, region dummy, POV, placement uji

Tanpa perubahan kode. Bila salah satu kriteria gagal: perbaiki di task terkait (catat penyimpangan), ulangi smoke.

**Files:** keluaran `docs/screenshots/unri/m0-*.jpg`.

- [ ] **Step 1: Stadion (titik ukur `stadion-pusat`) — harus identik dengan baseline**

```bash
node tests/e2e/shot.mjs --out docs/screenshots/unri/m0-stadion-pusat.jpg --at 0,-275,0 --stats
```
Expected: `"regions": ["stadion"]`, `"visibleProxies": []`, `"errors": []`, `callsMean` dalam ±2 % dari `callsMean` Task 1 Step 4 (catat keduanya; saat plan diverifikasi pada salinan sementara: 524 → 524). Kriteria visual: bandingkan berdampingan dengan `m0-sebelum-stadion-pusat.jpg` — komposisi, warna, minimap (peta dasar stadion + tile kota), panel dialog identik.

- [ ] **Step 2: Region dummy — proxy saat jauh**

```bash
node tests/e2e/shot.mjs --query dummyRegion=1 --out docs/screenshots/unri/m0-dummy-proxy.jpg --at 0,380,0 --stats
```
Expected: `"regions": ["stadion"]` (jarak 720 m > 700: belum dipasang), `"visibleProxies": ["proxy:dummy"]`, `"errors": []`. Kriteria visual: jalan lurus ke selatan; proxy pada 720 m tertutup kabut (bukti utama = `visibleProxies`), tidak ada kotak oranye.

- [ ] **Step 3: Region dummy — terpasang (build inkremental selesai)**

```bash
node tests/e2e/shot.mjs --query dummyRegion=1 --out docs/screenshots/unri/m0-dummy-terpasang.jpg --at 0,1040,0 --stats
```
Expected: `"regions": ["stadion", "dummy"]`, `"visibleProxies": []`, `"errors": []`. Kriteria visual: minimap menampilkan persegi hijau-zaitun dengan cincin 12 titik oranye tepat di selatan penanda sepeda (base layer dummy dibake setelah region siap). Di tampilan 3D kotak oranye sebagian tertutup rumah tile kota (region dummy tidak mengecualikan gedung kota — wajar untuk region uji).

- [ ] **Step 4: POV region (tombol 8)**

```bash
node tests/e2e/shot.mjs --query dummyRegion=1 --out docs/screenshots/unri/m0-dummy-pov.jpg --at 0,950,0 --pov Digit8 --stats
```
Expected: `"povLabel": "Region uji dari atas"`, `"regions": ["stadion", "dummy"]`, `"errors": []`. Kriteria visual: kamera tinggi (≈120 m) dari selatan-atas menatap pusat region dummy: pelat hijau-zaitun 80 × 80 m dengan cincin 12 kotak oranye di tengah layar (di antara rumah tile kota); HUD kiri atas "POV: Region uji dari atas (sepeda dibekukan · V/0 kembali)".

- [ ] **Step 5: Placement non-identitas (frame stadion lewat regionManager)**

```bash
node tests/e2e/shot.mjs --query placement=300,-200,0.6 --out docs/screenshots/unri/m0-placement-uji.jpg --at 300,-475,0 --pov Digit1 --stats
```
Expected: `"errors": []`, `"regions": ["stadion"]`, `"povLabel": "Udara"`. Kriteria visual: POV Udara membingkai stadion yang dipindah/diputar (bukan tanah kosong di origin); minimap memakai base layer stadion di pusat placement baru.

- [ ] **Step 6: Siklus pasang-lepas dummy di browser (memori GPU kembali)** — pelengkap tes Task 10 (yang memakai Node tanpa GPU). Jalankan dev server (`preview_start` nama `stadion-dev`), buka `http://localhost:5173/?dummyRegion=1` lewat Playwright MCP (`plugin_playwright`, `browser_navigate`), klik `#start`, lalu `browser_evaluate` fungsi berikut:

```js
async () => {
  const s = window.__sim;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = () => ({ g: s.app.renderer.info.memory.geometries, t: s.app.renderer.info.memory.textures });
  const cycle = async () => {
    s.teleport(0, 950, 0); await wait(1500); await s.regions.flush(); await s.regions.handleOf('dummy')?.ready; await wait(500);
    s.teleport(0, -275, 0); await wait(1500);
  };
  await cycle(); // pemanasan
  const base = snap();
  const out = [];
  for (let i = 0; i < 3; i += 1) { await cycle(); out.push(snap()); }
  return { base, out, active: s.regions.active().map((a) => a.def.id) };
}
```
Expected: setiap entri `out` sama dengan `base` (geometri & tekstur), `active` = `["stadion"]`. Bila panel Browser tersembunyi sehingga rAF berhenti, jalankan lewat Playwright headless (`--gpu d3d11`) — lihat catatan indeks.

- [ ] **Step 7: Commit screenshot**

```bash
git add docs/screenshots/unri/m0-stadion-pusat.jpg docs/screenshots/unri/m0-dummy-proxy.jpg docs/screenshots/unri/m0-dummy-terpasang.jpg docs/screenshots/unri/m0-dummy-pov.jpg docs/screenshots/unri/m0-placement-uji.jpg
```
```bash
git commit -m "docs: screenshot titik ukur M0 (stadion identik, region dummy proxy/terpasang/POV, placement uji)"
```

---

## Task 16: Verifikasi akhir tonggak M0 + status indeks

**Files:**
- Create (keluaran): `docs/screenshots/unri/m0-akhir-e2e.json`
- Modify: `docs/superpowers/plans/2026-10-17-unri-00-index.md` (baris tabel "Status tonggak", baris `| M0 | belum | — | |`)

- [ ] **Step 1: Seluruh suite**

```bash
node node_modules/vitest/vitest.mjs run
```
Expected: `Test Files  112 passed (112)`; `Tests` = baseline Task 0 + **67** (857 → **924** bila baseline 857; diverifikasi saat plan ditulis pada salinan sementara: 110 berkas lulus + 2 berkas yang gagal start karena timeout worker lalu lulus saat diulang = 924). Rincian: scheduler 11, storyPoints 12, terrainService 2, region +6 (9 → 15), mountRegion +5 (7 → 12), compositeCollider +2 (6 → 8), minimapMath +3 (8 → 11), dummyRegion 2, regionManager 13, storyStorage +2 (8 → 10), storyDirector +4 (17 → 21), regionPov 5. Timeout start worker Vitest di mesin sibuk (`Failed to start forks worker`) bukan kegagalan tes: ulangi berkas itu saja. Bila angka berbeda: cocokkan per berkas dan catat.

- [ ] **Step 2: Lint & build**

```bash
npm run lint
```
Expected: exit 0.

```bash
npm run build
```
Expected: `✓ built in` tanpa error.

- [ ] **Step 3: E2E penuh (GPU) sesudah refactor**

```bash
npm run e2e -- --gpu d3d11 --out docs/screenshots/unri/m0-akhir-e2e.json
```
Expected: exit 0, `fails: []` (galat konsol 0, draw call tile ≤ 150, memori siklus `remountRegion` = baseline, hitch p95 < 50 ms, perjalanan cepat An-Nur & kembali ok).

- [ ] **Step 4: Bandingkan paritas draw call (±2 %)**

```bash
node -e "const a=require('./docs/screenshots/unri/m0-baseline-e2e.json').checks.parity,b=require('./docs/screenshots/unri/m0-akhir-e2e.json').checks.parity;let ok=true;for(const k of ['callsMean','callsMeanRegionOnly']){const d=Math.abs(b[k]-a[k])/a[k];ok=ok&&d<=0.02;console.log(k,a[k],'->',b[k],(d*100).toFixed(2)+'%',d<=0.02?'OK':'GAGAL')}process.exitCode=ok?0:1"
```
Expected: dua baris `OK`, exit 0. Bila `GAGAL`: BERHENTI — selidiki (`__sim.app.renderer.info` dengan/ tanpa `markers.group`, proxy, sistem baru) sebelum melanjutkan; laporkan ke user bila penyebabnya bukan regresi (mis. derau pengukuran > 2 % antar dua lari baseline: ulangi baseline dua kali dan pakai rerata).

- [ ] **Step 5: Perbarui status indeks** — catat hash commit terakhir kode:

```bash
git log -1 --format=%h
```

Di `docs/superpowers/plans/2026-10-17-unri-00-index.md`, ganti baris:
```
| M0 | belum | — | |
```
menjadi (isi `<hash>` dari perintah di atas dan angka aktual):
```
| M0 | selesai | <hash> | regionManager + scheduler + save v3 + POV/minimap per region; paritas callsMean <baseline>→<akhir> (±<x> %); tes <N>; dummy region 3× tanpa bocor |
```

- [ ] **Step 6: Commit**

```bash
git add docs/screenshots/unri/m0-akhir-e2e.json docs/superpowers/plans/2026-10-17-unri-00-index.md
```
```bash
git commit -m "docs: M0 fondasi multi-region selesai (paritas draw call, E2E akhir, status indeks)"
```

- [ ] **Step 7: Review tonggak** — satu review di akhir tonggak (superpowers:requesting-code-review), cakupan `git diff dd3f295..HEAD -- src tests`. Tangani temuan CRITICAL/HIGH sebelum M1.

---

## Self-review

### Cakupan spec → task

| Spec | Butir | Task |
|---|---|---|
| §4.3 | `activation` persistent / center+radius (histeresis) | 5 (validasi), 10 (perilaku) |
| §4.3 | `proxy?(ctx)` ≤ 8 draw call | 5, 9, 10 (`PROXY_MAX_MESHES` peringatan) |
| §4.3 | `povs?` | 5, 13 |
| §4.3 | `pads?` | 5 (validasi; dipakai campusbake M1) |
| §4.3 | `ctx.terrain`, `ctx.heightAtLocal`, `ctx.schedule`, `ready` setelah antrean habis | 4, 6 |
| §4.3 | scheduler ≤ 4 ms/frame (`src/engine/scheduler.js`) | 2, 14 (sistem `scheduler`) |
| §4.3 | stadion `activation:{persistent:true}`, paritas ±2 % | 5, 1 (baseline), 15, 16 |
| §4.4 | `createRegionManager({app, store, time, weather, terrain, collider, minimap, createScope})`, `register`, `update(focusWorld)`, `active()`, `frameOf`, `regionAt`, `on`, `dispose`; maks 1 mount/0,5 s; komposit collider/minimap/POV membaca manager | 10, 14 |
| §4.5 | titik `{region,x,z}`, tanpa region = `'stadion'`; `SAVE_VERSION = 3` + migrasi v2→v3 | 3, 11, 12 |
| §4.1 (sebagian) | `terrainService` stub, `heightAt` = 0 | 4 |
| §11 | tes regionManager (histeresis, LIFO, maks mount/0,5 s), migrasi save v2→v3 | 10, 11 |
| §12 M0 | regionManager, streaming + proxy, frame/cerita/POV/minimap per region, scheduler, save v3; stadion identik; tes lama lulus | 2–16 |
| Indeks M0 | `Minimap2D.setBaseLayer/removeBaseLayer`, alias `setBase` → `'stadion'` | 8 |
| Indeks M0 | `eslint.config.js` tidak berubah | (tidak disentuh) |
| §15 risiko M0 | paritas draw call, semua tes lama, M0 tanpa fitur kampus | 1, 15, 16 |

### Scan placeholder

Dicari: "TBD", "TODO", "tambahkan error handling", "mirip Task", fungsi tanpa definisi. Hasil: tidak ada. Setiap fungsi yang dirujuk didefinisikan di plan ini atau sudah ada di repo (dibaca langsung): `createRegionFrame`, `IDENTITY_FRAME`, `toWorld` (`src/geo/regionTransform.js`); `regionContains`, `maskHalfExtent`, `withPlacement` (`src/regions/Region.js`); `createResourceScope`, `disposeTree`, `freezeStatic`, `createSystemRunner` (`src/engine/*`); `createCompositeCollider`, `OPEN` (`src/core/Collider.js`, `OPEN` konstanta modul yang sama); `sourceRect`, `projectToView`, `fin` (`src/shared/minimapMath.js`, `fin` konstanta modul yang sama); `RENDER_LAYERS` (`src/config/constants.js:44`); `App.bakeMinimap(worldHalf, center)` (`src/core/App.js:289`); `pointOnLane`, `laneLength`, `createLapTracker`, `stepLap`, `createStory`, `fundsShortfall` (impor lama StoryDirector). Placeholder `<hash>`, `<baseline>`, `<akhir>`, `<x>`, `<N>` di Task 16 Step 5 adalah nilai ukur yang diisi saat eksekusi (bukan kode).

### Konsistensi nama (indeks/spec ↔ plan)

- `createScheduler({ budgetMs = 4, now })` → `{ schedule(task, { owner }) -> { cancel() }, cancelOwner, update, pending(owner?), whenIdle(owner?) }` — persis indeks; tambahan: opsi `logger`, ekspor `runTaskNow`, `DEFAULT_BUDGET_MS`; `update()` mengembalikan jumlah potongan, `cancelOwner` jumlah task.
- `createRegionManager({ app, store, time, weather, terrain, collider, minimap, createScope })`, `register(def)`, `update(focusWorld)`, `active() -> [{ def, region, frame }]`, `frameOf(id)`, `regionAt(x,z) -> id|null`, `on('mount'|'unmount', fn)`, `dispose()` — persis spec §4.4. Tambahan (diizinkan "menambah"): opsi `scheduler`, `mount`, `now`, `logger`; metode `handleOf`, `attachMinimap`, `remount`, `flush`; `register` mengembalikan Promise; `on` mengembalikan pelepas.
- `normalizePoint(p) -> {region,x,z}`, `resolvePoint(p, frameOf) -> {x,z}|null` — persis indeks; tambahan `localizePoint`, `DEFAULT_REGION`, `WORLD_REGION`, `src/story/storyWorld.js`.
- `FLAT_TERRAIN = { heightAt: () => 0, normalAt, gradeAlong, version: 0 }`, `createTerrainService() -> { field, heightAt, normalAt, gradeAlong, version }` — persis indeks.
- `SAVE_VERSION = 3`, `migrateV2` — persis indeks; tambahan `sanitizePlace`.
- `setBaseLayer(id, canvas, { center:{x,z}, half, yaw })`, `removeBaseLayer(id)`, `setBase` alias `'stadion'` — persis indeks.
- `activation: { persistent: true }` di `src/regions/stadion/index.js` — persis indeks.

### Deviasi dari indeks (dicatat untuk review)

1. **`src/core/CameraRig.js` diubah** (tidak ada di daftar M0 indeks): jumlah subjek POV `region` dan toast memakai `director.label`. Alasan: tanpa ini tombol 8 tidak bisa berpindah antar-POV region. M1 juga mengubah CameraRig (urutan aman).
2. **Berkas baru di luar peta indeks:** `src/story/storyWorld.js`, `src/app/dummyRegion.js`, `tests/e2e/shot.mjs`; **berkas diubah di luar peta:** `src/core/Collider.js`, `src/shared/minimapMath.js`, `src/story/eggTriggers.js`, `src/sim/story/objectives.js` (guard `goto` null — M7 juga menyentuh berkas ini), `src/core/StoryDirector.js`, `src/app/keymap.js`, `src/app/devtools.js`, `index.html`. Alasan: konsekuensi langsung "cerita/minimap/POV per region" (spec §12) dan kebutuhan smoke; semua di dalam tonggak M0.
3. **Isi save v3 = field `place`** (tempat terakhir ber-region). Save v2 tidak menyimpan koordinat apa pun, jadi migrasi "titik ber-region" (spec §4.5) diwujudkan sebagai field baru `place: null` untuk save lama. M0 tidak memakainya untuk spawn (paritas); `StoryDirector.savedPlace` tersedia untuk tonggak berikut.
4. **POV region memakai tombol baru `Digit8`** (POV 1–7 stadion tidak berubah).
5. **`activation` absen = persistent** (kompatibel dengan region & tes lama).
6. **Asersi tes lama yang sengaja diubah:** `tests/storyStorage.test.js` (versi 2 → 3, ditulis ulang), `tests/storyDirector.test.js` baris 170 & 192 (`version: 2` → `3`).

### Risiko

- **Konversi koordinat cerita** (StoryDirector ke dunia): placement stadion produksi ≈ identitas tetapi `frame.identity` = false (geser < 2 cm), jadi jalur konversi aktif di produksi. Dimitigasi tes frame non-identitas (Task 12) + smoke `?placement=` (Task 15 Step 5).
- **Waktu bake minimap**: `attachMinimap` membake pada langkah 0,97 yang sama; region streaming dibake setelah siap (satu hitch kecil per region, di luar loading). `remount` (E2E memori) kini juga membake ulang — siklus baseline E2E menyerap selisihnya (baseline diambil setelah pemanasan).
- **Derau paritas**: rerata 60 frame bisa berfluktuasi; bila > 2 % tanpa sebab kode, ulangi baseline (Task 16 Step 4).
- **Antara commit Task 11 dan 12** suite merah 2 asersi; jangan push di antaranya.

---

## Serah terima ke M1

API yang tersedia setelah M0 (signature persis):

```js
// src/engine/scheduler.js
export const DEFAULT_BUDGET_MS; // 4
export function runTaskNow(task /* () => void | Iterator */): void
export function createScheduler({ budgetMs = 4, now = () => performance.now(), logger = console } = {})
  -> { schedule(task, { owner = null } = {}) -> { cancel(): void },
       cancelOwner(owner) -> number, update() -> number /* potongan */, pending(owner?) -> number,
       whenIdle(owner?) -> Promise<void> }

// src/app/terrainService.js  (M1 mengganti isi, ekspor tetap)
export const FLAT_TERRAIN; // beku: { heightAt(x,z)->0, normalAt(x,z,out?)->{x:0,y:1,z:0}, gradeAlong(x,z,yaw)->0, version:0 }
export function createTerrainService()
  -> { field, heightAt(x, z) -> number, normalAt(x, z, out?) -> {x,y,z}, gradeAlong(x, z, yaw) -> number, get version() -> number }

// src/app/mountRegion.js
export function applyPlacement(group, placement) -> group
export async function mountRegion(app, def, { store = null, time = null, weather = null, terrain = FLAT_TERRAIN,
  scheduler = null, createScope = createResourceScope, logger = console } = {})
  -> { def, region, ready: Promise, mounted: boolean, unmount(): void }
// ctx build: { scene, renderer, camera, scope, store, clock, placement, terrain, heightAtLocal(lx, lz) -> number,
//              schedule(task) -> { cancel() } }   (owner antrean = `region:${def.id}`)

// src/app/regionManager.js
export const MOUNT_INTERVAL_MS /* 500 */, MOUNT_RETRY_MS /* 10000 */, PROXY_MAX_MESHES /* 8 */, MINIMAP_BAKE_MARGIN /* 20 */;
export function createRegionManager({ app, store = null, time = null, weather = null, terrain = FLAT_TERRAIN,
  collider = null, minimap = null, createScope = createResourceScope, scheduler = null, mount = mountRegion,
  now = () => performance.now(), logger = console } = {})
  -> { register(def) -> Promise<handle|null>, update(focusWorld /* {x,z} */): void,
       active() -> ReadonlyArray<{ def, region, frame }>, frameOf(id) -> frame|null, regionAt(x, z) -> string|null,
       handleOf(id) -> handle|null, on('mount'|'unmount', fn({def, region, frame})) -> () => void,
       attachMinimap(minimap): void, remount(id) -> Promise<unknown>, flush() -> Promise<void>, dispose(): void }

// src/app/dummyRegion.js
export const DUMMY_REGION_ID /* 'dummy' */, DUMMY_HALF /* 40 */, DUMMY_BOXES /* 12 */;
export function createDummyRegion({ id = 'dummy', x = 0, z = 1100, yaw = 0, mountRadius = 700, unmountRadius = 900,
  boxes = 12 } = {}) -> RegionDef

// src/regions/Region.js
export const DEFAULT_MOUNT_RADIUS /* 700 */, DEFAULT_UNMOUNT_RADIUS /* 900 */;
export function defineRegion(spec) -> RegionDef   // + activation (dinormalisasi), proxy?, povs ([]), pads ([])
//   activation: { persistent:true } | { persistent:false, center:{x,z}, mountRadius, unmountRadius }
//   proxy(ctx:{ scope, placement, terrain }) -> { group, dispose }
//   povs: [{ id, label, pose(frame, ctx:{time, bike}) -> {px,py,pz,tx,ty,tz,fov?} (dunia) | null }]
//   pads: [{ ring:[[lx,lz]...] (≥3), y:'median'|number }]
export function validateBuild(result, id), regionContains(region, x, z), maskHalfExtent(mask), withPlacement(region, placement)

// src/core/Collider.js
export function createDynamicCompositeCollider({ fallback = OPEN } = {})
  -> { isWalkable(x, z), isCameraClear(x, z), penetration(x, z), setRegions([{ region, colliders }]), setFallback(collider) }

// src/ui/Minimap2D.js
setBaseLayer(id, canvas, { center = {x:0, z:0}, half, yaw = 0 }): void
removeBaseLayer(id) -> boolean
setBase(baseCanvas, worldHalf, center) // alias → setBaseLayer('stadion', …)
// src/shared/minimapMath.js
export function layerInView(layer, focus, halfExtent) -> boolean
export function layerTransform(layer, focus, halfExtent, viewPx) -> [a, b, c, d, e, f]

// src/story/points.js
export const DEFAULT_REGION /* 'stadion' */, WORLD_REGION /* 'world' */;
export function normalizePoint(p) -> { region, x, z }
export function resolvePoint(p, frameOf) -> { x, z } | null
export function localizePoint(p /* {x,z,yaw?} dunia */, regionId, frameOf) -> { region, x, z, yaw } | null
// src/story/storyWorld.js
export function resolveChapters(chapters, frameOf), resolveNpcs(npcs, frameOf), resolveEggs(eggs, frameOf), resolveAnchors(anchors, frameOf)

// src/story/storage.js
export const SAVE_VERSION /* 3 */;
export function migrateV1(raw, limits) -> save v2
export function migrateV2(raw, limits) -> save v3 | null   // place: null
export function sanitizePlace(raw) -> { region, x, z, yaw } | null
// save v3: { version:3, chapter, step, badges, eggs, bestLap, rupiah, finished, wallet:{balance, items}, place }

// src/story/eggTriggers.js
export const EGG_ANCHORS; // { satpam, tugu, center } region-lokal stadion; stepEggs menerima ctx.anchors (dunia)

// src/core/StoryDirector.js
new StoryDirector({ …deps lama, frameOf = () => IDENTITY_FRAME, placeOf = () => null })
// update(dt, { bikePos /* DUNIA */, … }); goalPoint() -> titik DUNIA | null; promptFor(pos dunia); tryInteract(pos dunia);
// savedPlace: { region, x, z, yaw } | null

// src/core/cameraPresets.js / povSource.js / PovDirector.js
// POV_BY_ID.region = { key:'Digit8', kind:'region', cycle:true, controlsBike:false, fov:55, … }
// createPovSource(ents, frame = IDENTITY_FRAME, { regions = null } = {}) + regionPovCount() -> number,
//   regionPov(i) -> { id:'<regionId>:<povId>', label, pose(ctx) } | null
// PovDirector.label: POV region = label POV subjek

// src/app/devtools.js
export function parseFlagParam(search, name) -> boolean
// window.__sim (DEV): + regions, scheduler, terrain

// tests/e2e/shot.mjs (CLI): --out <jpg> --at x,z[,yaw] [--hour] [--gpu] [--query] [--pov DigitN] [--wait ms] [--stats]
```

Catatan untuk M1:
- `main.js` sudah membuat satu `terrain = createTerrainService()` dan meneruskannya ke `createRegionManager` → `mountRegion` → `ctx.terrain`. M1 cukup mengisi `createTerrainService` (HeightField nyata) dan menyuntik `terrain` yang sama ke sepeda/kamera/entitas/`mountDistrict` (variabel `terrain` di `main()` dari `createRegionLayer`).
- `scheduler` (variabel di `main()`) siap dipakai `mountDistrict(app, def, { terrain, collider, minimap, scheduler, createScope })`.
- Collider komposit dinamis (`colliders`) menerima region dari manager; urutan spec §4.2 "regions → district → tile kota" berarti M1 menyusun fallback = komposit(distrik → tile kota) lewat `colliders.setFallback(...)`.
- Region hero (M4/M6) cukup `regions.register(defineRegion({ …, activation:{ center, mountRadius:700, unmountRadius:900 }, proxy, povs, pads }))` di `main.js`.
- Frame stadion: `regions.frameOf('stadion')`; titik cerita baru (M7) memakai `{ region:'unri-lembaga'|'world', x, z }`.
