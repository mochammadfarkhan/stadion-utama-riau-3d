# Plan A — Fondasi Engine (Fase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyiapkan fondasi engine untuk kota Pekanbaru (spec `docs/superpowers/specs/2026-10-16-pekanbaru-city-slice-design.md`, Fase 0) tanpa perubahan visual: loop sistem berfase dengan isolasi galat, cache sumber daya GPU yang bisa dilepas, kawasan stadion sebagai region handmade (`build`/`dispose`), collider komposit, registry emissive/basah, lifecycle `dispose()`, perbaikan layering, dan perbaikan bug dompet (save v2).

**Architecture:** Lapisan baru `src/engine/` (SystemRunner, ResourceScope, disposeTree, materialRegistry) tanpa impor world/ui. Kawasan stadion dibungkus `src/regions/stadion/` yang memenuhi kontrak `regions/Region.js` (placement identitas `{x:0,z:0,yaw:0}` dulu); `main.js` menjadi composition root yang memanggil `stadionRegion.build(ctx)`, mendaftarkan sistem berfase ke `App`, dan menyimpan disposer LIFO. Data kawasan (`SITE`/`STADIUM`) pindah ke `regions/stadion/site.js` dengan re-export kompatibilitas di `config/constants.js`; builder di bawah `buildWorld` menerima `layout`/`site` lewat parameter secara bertahap.

**Tech Stack:** Three.js 0.186, JavaScript ESM (JSDoc), Vite 8, Vitest 5 (environment `node`), ESLint 10 flat config.

---

## Konvensi eksekusi

- Tes satu berkas: `node node_modules/vitest/vitest.mjs run tests/<berkas>.test.js` (jangan `npx`).
- Seluruh suite: `node node_modules/vitest/vitest.mjs run`.
- Lint: `node node_modules/eslint/bin/eslint.js .` (harapan: 0 error; warning lama boleh tetap).
- Build: `node node_modules/vite/bin/vite.js build`.
- Commit selalu satu perintah `git add <berkas...> && git commit -m "..."` (hook memblokir `;` dan heredoc).
- Nomor baris `path:line` merujuk ke isi berkas **sebelum task itu dimulai** (setelah task sebelumnya selesai). Untuk berkas yang dibuat/ditulis ulang di task sebelumnya, rujukan memakai nama fungsi.
- Setiap commit harus hijau (suite + lint) dan tanpa perubahan visual. Task yang menyentuh `main.js` juga menjalankan build (tes tidak mengimpor `main.js`).

## Struktur file

**Baru**

| Berkas | Tanggung jawab |
|---|---|
| `src/app/session.js` | State sesi (`session.started`) + `setupMenu` (dipindah dari `main.js`). |
| `src/app/keymap.js` | Hotkey permainan (`handleKeys`, kamera, waktu/cuaca). |
| `src/app/shop.js` | Dialog beli, tombol E toko, prompt interaksi. |
| `src/app/devtools.js` | `window.__sim` (dev): teleport, statistik, teardown. |
| `src/app/lifecycle.js` | `createDisposerStack()` — disposer LIFO untuk composition root. |
| `src/engine/SystemRunner.js` | Fase `input → sim → world → camera → ui`, isolasi galat, nonaktif setelah 3 galat beruntun. |
| `src/engine/ResourceScope.js` | Cache material/geometri/tekstur ber-refcount per kunci; scope aktif (`currentScope`/`withScope`). |
| `src/engine/disposeTree.js` | Melepas geometri/material/tekstur sebuah `Object3D`, menghormati kepemilikan scope. |
| `src/engine/materialRegistry.js` | Registry material per root (dasar `registerEmissive`/`registerWet`). |
| `src/geo/regionTransform.js` | `toLocal`/`toWorld` untuk placement `{x,z,yaw}` (ditarik maju dari Fase 1 karena dipakai collider komposit). |
| `src/shared/polygon.js` | `pointInPolygon`, `convexHull` (murni). |
| `src/shared/minimapMath.js` | Dipindah dari `src/ui/minimapMath.js`. |
| `src/regions/Region.js` | Typedef kontrak + `defineRegion`, `validateBuild`, `regionContains`. |
| `src/regions/stadion/site.js` | Data `STADIUM`/`SITE` (dipindah dari `config/constants.js`) + data kebenaran tunggal (tugu, danau). |
| `src/regions/stadion/layout.js` | Dipindah dari `src/world/layout.js`; memuat aturan PJU rusak. |
| `src/regions/stadion/mask.js` | Mask region (hull elips jalan lingkar + parkir). |
| `src/regions/stadion/lamps.js` | `litLampPositions(layout)` (dipindah dari `TimeOfDay.lights.js`). |
| `src/regions/stadion/collider.js` | Collider region-lokal stadion (pindahan logika `core/Collider.js`). |
| `src/regions/stadion/index.js` | `stadionRegion` — `build(ctx) → {group, colliders, minimapLayer, systems, dispose, seatSamples, layout, lamps}`. |
| `src/world/stadium/gateCorridor.js` | Koridor gate utama (dipindah dari `core/Collider.js`). |
| `tests/systemRunner.test.js`, `tests/resourceScope.test.js`, `tests/disposeTree.test.js`, `tests/scopedCaches.test.js`, `tests/polygon.test.js`, `tests/regionTransform.test.js`, `tests/region.test.js`, `tests/compositeCollider.test.js`, `tests/materialRegistry.test.js`, `tests/nightRegistry.test.js`, `tests/singleSource.test.js`, `tests/lifecycle.test.js` | Tes modul baru. |

**Diubah**

| Berkas | Perubahan |
|---|---|
| `src/main.js` | Composition root: sistem berfase, region, collider komposit, registry, disposer. |
| `src/core/App.js` | `SystemRunner` menggantikan `updatables`/`#safeUpdate`; `dispose()`. |
| `src/core/Collider.js` | Ditulis ulang: collider komposit + `createCollider(start, isWalkable)`; tanpa impor `world/stadium/*`. |
| `src/core/Input.js` | `dispose()` (AbortController). |
| `src/core/StoryDirector.js` | Callback `onToast`/`onWalletChange` (bukan objek HUD); save v2 dompet. |
| `src/config/constants.js` | `STADIUM`/`SITE` jadi re-export dari `regions/stadion/site.js`. |
| `src/world/index.js` | `buildWorld({ layout, site })`; tanpa impor layout/collider. |
| `src/world/TimeOfDay.js`, `TimeOfDay.lights.js`, `NightHalos.js`, `Weather.js`, `Weather.rain.js`, `Weather.wet.js` | Grup milik sendiri, registry emissive/basah, `dispose()`. |
| `src/world/materials.js`, `Ground.materials.js`, `Ground.roads.js`, `Landscape.baseball.js`, `siteutil/rounded.js`, `siteutil/textCanvas.js`, `textures/surfaces.js`, `textures/decalAtlas.js`, `assets/models.js`, `src/entities/util.js`, `Humanoid.hair.js`, `Humanoid.face.js`, `Humanoid.lod.js` | Cache modul → `currentScope()`. |
| `src/world/Decals.layout.js`, `props/Monument.js`, `Landscape.zones.js`, `src/story/chapters.js` | Posisi tugu/danau dari `SITE`. |
| `src/story/storage.js`, `src/sim/vendorSim.js`, `src/entities/Vendor.js` | Save v2, migrasi v1, cadangan `.bak`, `restoreWallet`/`setWallet`. |
| `src/ui/Minimap2D.js` | Impor `shared/minimapMath`. |
| `eslint.config.js`, `vite.config.js` | Aturan arah dependensi; cakupan coverage modul murni baru. |
| `tests/collider.test.js`, `cameraClear.test.js`, `decals.test.js`, `layoutModels.test.js`, `models.test.js`, `minimapMath.test.js`, `storyDirector.test.js`, `storyStorage.test.js`, `helpers.js` | Jalur impor/API baru; asersi lama dipertahankan. |

---

### Task 0: Baseline paritas visual (tanpa commit)

**Files:** tidak ada perubahan berkas repo. Hasil disimpan di luar repo: `/tmp/sur3d-parity-baseline.json`.

- [ ] **Step 1: Pastikan pohon kerja bersih di commit awal**

Run: `git status --short && git log --oneline -1`
Expected: tidak ada keluaran status; commit teratas `29ac7bc docs: desain vertical slice kota Pekanbaru ...`.

- [ ] **Step 2: Jalankan dev server**

Pakai konfigurasi `stadion-dev` di `.claude/launch.json` (port 5173), atau jalankan di latar belakang: `node node_modules/vite/bin/vite.js --port 5173 --strictPort`. Buka `http://localhost:5173/` di tab yang **terlihat** (tab tersembunyi menghentikan `requestAnimationFrame`) dan tunggu menu utama muncul (label muat "Siap!").

- [ ] **Step 3: Ukur draw call di plaza utara**

Jalankan di konsol halaman (atau alat JavaScript browser). `renderer.info` di-reset di awal `App.render`, jadi nilai dibaca **di antara frame**: `requestAnimationFrame` lalu `setTimeout(0)` memastikan frame berikutnya sudah selesai dirender. Peta bayangan dirender tiap 2 frame, maka yang dibandingkan adalah rata-rata 60 frame.

```js
(async () => {
  const s = window.__sim;
  s.rig.exitPov();
  s.store.set('sky.advanceTime', false);
  s.store.set('sky.hour', 12);
  s.store.set('weather.raining', false);
  s.store.set('camera.mode', 'third');
  s.teleport(0, -275, 0);
  await new Promise((r) => setTimeout(r, 3000)); // kamera, rumput, dan LOD mengendap
  const frames = [];
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    frames.push({ ...s.app.renderer.info.render });
  }
  const calls = frames.map((f) => f.calls);
  const tris = frames.map((f) => f.triangles);
  const mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  return JSON.stringify({
    callsMean: mean(calls), callsMin: Math.min(...calls), callsMax: Math.max(...calls),
    trianglesMean: mean(tris), memory: { ...s.app.renderer.info.memory },
  });
})();
```

Expected: string JSON, mis. `{"callsMean":…, "callsMin":…, "callsMax":…, "trianglesMean":…, "memory":{"geometries":…,"textures":…}}`.

- [ ] **Step 4: Simpan baseline di luar repo**

Run: `printf '%s\n' '<tempel JSON dari Step 3>' > /tmp/sur3d-parity-baseline.json && cat /tmp/sur3d-parity-baseline.json`
Expected: JSON tercetak. Hentikan dev server.

---

### Task 1: Pecah `main.js` (pemindahan murni)

**Files:**
- Create: `src/app/session.js`, `src/app/keymap.js`, `src/app/shop.js`, `src/app/devtools.js`
- Modify: `src/main.js:1-43` (impor), `src/main.js:46`, `src/main.js:48-49`, `src/main.js:206-339`

- [ ] **Step 1: Buat `src/app/session.js`** (isi dari `main.js:48-49` dan `main.js:219-250`, tanpa perubahan logika)

```js
/**
 * Sesi permainan & menu utama (dipindah dari main.js tanpa perubahan perilaku).
 */
import { requestLandscape } from '../ui/orientation.js';
import { mountSettingsPanel } from '../ui/mountSettingsPanel.js';

/** Sesi: false selama menu utama terbuka (kamera orbit latar, tombol game diabaikan). */
export const session = { started: false };

/** Menu utama: Mulai/Lanjutkan, Mulai dari awal, Pengaturan; klik kanvas mengunci pointer sesudah mulai. */
export function setupMenu({ app, rig, hud, store, touchUi, touch, menu, story }) {
  let panel = null;
  let started = false;
  const begin = () => {
    started = true;
    session.started = true;
    rig.exitPov(); // akhiri orbit latar menu
    menu.hide();
    if (touch) {
      touchUi.setVisible(true); // pointer lock tidak ada di ponsel; kontrol layar menggantikannya
      requestLandscape(); // layar penuh + kunci landscape (gestur pengguna = tombol Mulai)
    } else {
      rig.requestLock();
    }
  };
  menu.on({
    start: begin,
    newGame: () => { story.reset(); begin(); },
    settings: () => { menu.away(true); panel?.togglePanel?.(true); },
  });
  mountSettingsPanel({
    store, app, rig, hud,
    onPanelToggle: (open) => { if (!open && !started) menu.away(false); }, // panel ditutup sebelum mulai: menu muncul lagi
  }).then(({ panel: p }) => {
    panel = p;
    if (p) return; // panel memasang handler klik kanvas sendiri (cek isPointerOverUI)
    app.renderer.domElement.addEventListener('click', () => {
      if (started && !hud.shopOpen && !touch) rig.requestLock();
    });
  });
}
```

- [ ] **Step 2: Buat `src/app/shop.js`** (isi dari `main.js:206-217`, `295-306`, `330-339`)

```js
/**
 * Dialog beli & prompt interaksi E (dipindah dari main.js tanpa perubahan perilaku).
 */

/** Dialog beli: pedagang bisa berjalan menjauh saat dialog terbuka; kunci id pedagang saat dibuka. */
export function setupShop(hud, ents, story) {
  const shop = { vendorId: null };
  hud.onBuy = (itemId) => {
    if (!shop.vendorId) return;
    const res = ents.vendors.tryBuy(itemId, shop.vendorId);
    hud.setWallet(ents.vendors.wallet);
    hud.toast(res.ok ? `Beli ${res.item.name} ✔` : res.error, res.ok);
    if (res.ok) story.onBought(res.item.id);
  };
  return shop;
}

export function handleShopKey(rig, hud, ents, shop) {
  if (rig.freezesBike) return; // sepeda dibekukan di POV: tidak ada transaksi
  if (hud.shopOpen) {
    hud.closeShop();
    shop.vendorId = null;
    rig.requestLock();
  } else if (ents.vendors.promptVendor) {
    shop.vendorId = ents.vendors.promptVendor.id;
    hud.openShop(shopInfo(ents.vendors.promptVendor));
    document.exitPointerLock?.();
  }
}

export function updatePrompt(hud, ents, story, bikePos) {
  if (hud.shopOpen) return hud.setPrompt(null);
  const pv = ents.vendors.promptVendor; // satu sumber kebenaran jarak interaksi (VendorGroup)
  hud.setPrompt(story.promptFor(bikePos) ?? (pv ? `Tekan E — ${pv.name}` : null));
}

/** Bentuk data untuk dialog HUD dari info pedagang. */
function shopInfo(vendor) {
  return { name: vendor.name, items: vendor.catalog };
}
```

- [ ] **Step 3: Buat `src/app/keymap.js`** (isi dari `main.js:46` dan `main.js:264-328`)

```js
/**
 * Hotkey permainan (dipindah dari main.js tanpa perubahan perilaku). Hotkey menulis ke store;
 * binding (ui/bindings) yang menerapkannya ke scene.
 */
import { EXIT_KEY, POVS } from '../core/cameraPresets.js';
import { routeEscape } from '../core/escapeRoute.js';
import { nextPresetAfter, PRESET_HOURS } from '../sim/dayCycle.js';
import { handleShopKey } from './shop.js';

const HOURS = 24;

/** Hotkey lama menulis ke store (binding menerapkan ke scene). */
export function handleKeys(input, { rig, hud, ents, shop, time, store, story }) {
  const toggle = (key) => store.set(key, !store.get(key));
  handleCameraKeys(input, { rig, hud, store });
  if (input.consumePress('KeyM')) toggle('performance.minimap');
  if (input.consumePress('KeyO')) toggle('graphics.ao'); // matikan AO bila FPS rendah
  handleTimeWeatherKeys(input, hud, time, store);
  if (input.consumePress('KeyJ')) story.toggleJournal();
  const escTarget = input.consumePress('Escape')
    ? routeEscape({ journalOpen: story.journal.open, shopOpen: hud.shopOpen })
    : null;
  if (escTarget === 'journal') story.toggleJournal();
  if (input.consumePress('KeyE')) {
    if (hud.shopOpen || !story.tryInteract(ents.bike.state)) handleShopKey(rig, hud, ents, shop);
  } else if (escTarget === 'shop') handleShopKey(rig, hud, ents, shop);
}

/** V: ganti mode kamera pemain, atau keluar dari POV. Digit1..7 masuk POV, Digit0 keluar. */
function handleCameraKeys(input, { rig, hud, store }) {
  if (input.consumePress('KeyV')) {
    if (rig.povId) rig.exitPov();
    else store.set('camera.mode', rig.mode === 'third' ? 'first' : 'third');
  }
  for (const code of [EXIT_KEY, ...POVS.map((p) => p.key)]) {
    if (!input.consumePress(code)) continue;
    const msg = rig.handlePovKey(code);
    if (msg) hud.toast(msg, true);
    else if (code !== EXIT_KEY) hud.toast('POV belum tersedia', false);
  }
}

/** R hujan, N preset waktu berikutnya, T jalankan/hentikan jam, [ / ] mundur/maju 1 jam. */
function handleTimeWeatherKeys(input, hud, time, store) {
  const setHour = (h) => store.set('sky.hour', ((h % HOURS) + HOURS) % HOURS);
  if (input.consumePress('KeyR')) {
    const on = !store.get('weather.raining');
    store.set('weather.raining', on);
    hud.toast(on ? 'Hujan turun' : 'Hujan reda', true);
  }
  if (input.consumePress('KeyN')) {
    const name = nextPresetAfter(time.hour);
    setHour(PRESET_HOURS[name]);
    hud.toast(`Waktu: ${name}`, true);
  }
  if (input.consumePress('KeyT')) {
    const running = !store.get('sky.advanceTime');
    store.set('sky.advanceTime', running);
    hud.toast(running ? 'Jam berjalan' : 'Jam berhenti', true);
  }
  if (input.consumePress('BracketLeft')) setHour(time.hour - 1);
  if (input.consumePress('BracketRight')) setHour(time.hour + 1);
}
```

- [ ] **Step 4: Buat `src/app/devtools.js`** (isi dari `main.js:252-262`)

```js
/**
 * Alat debug mode dev (dipindah dari main.js tanpa perubahan perilaku).
 */
import { createCollider } from '../core/Collider.js';

/** Alat debug hanya di mode dev: teleport, statistik renderer, store settings. */
export function exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
  };
}
```

- [ ] **Step 5: Hapus kode yang dipindah dari `src/main.js`** (dari bawah ke atas agar nomor baris tetap benar)

1. Hapus `main.js:206-339` (dari komentar `/** Dialog beli: ...` sampai akhir `function shopInfo`), sisakan baris kosong sebelum `/** Muat model GLB ...`.
2. Hapus `main.js:48-49` (komentar `/** Sesi: ...` dan `const session = { started: false };`).
3. Hapus `main.js:46` (`const HOURS = 24;`).

- [ ] **Step 6: Perbarui blok impor `src/main.js:1-43`**

Sebelum (baris yang berubah):

```js
import { EXIT_KEY, POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
import { routeEscape } from './core/escapeRoute.js';
...
import { formatHour, nextPresetAfter, PRESET_HOURS } from './sim/dayCycle.js';
...
import { createRotatePrompt, requestLandscape } from './ui/orientation.js';
...
import { mountSettingsPanel } from './ui/mountSettingsPanel.js';
```

Sesudah:

```js
import { POVS } from './core/cameraPresets.js';
import { createAudioBus } from './core/AudioBus.js';
...
import { formatHour } from './sim/dayCycle.js';
...
import { createRotatePrompt } from './ui/orientation.js';
```

(baris `routeEscape` dan `mountSettingsPanel` dihapus), lalu tambahkan setelah `import { StoryJournal } from './ui/StoryJournal.js';`:

```js
import { session, setupMenu } from './app/session.js';
import { handleKeys } from './app/keymap.js';
import { setupShop, updatePrompt } from './app/shop.js';
import { exposeDevTools } from './app/devtools.js';
```

- [ ] **Step 7: Verifikasi suite, lint, build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build`
Expected: semua tes PASS, lint 0 error (tidak ada `no-undef`/`no-unused-vars` baru), build sukses.

- [ ] **Step 8: Commit**

```bash
git add src/main.js src/app/session.js src/app/keymap.js src/app/shop.js src/app/devtools.js && git commit -m "refactor: pecah main.js ke src/app (session, keymap, shop, devtools) tanpa perubahan perilaku"
```

---

### Task 2: `SystemRunner` menggantikan updatable raksasa dan `App.#safeUpdate`

**Files:**
- Create: `src/engine/SystemRunner.js`, `tests/systemRunner.test.js`
- Modify: `src/core/App.js:10-15,25-35,48,62-70,204-220,236`; `src/main.js` (fungsi `main`, `setupStory`, `setupMinimap`)

- [ ] **Step 1: Tulis tes gagal `tests/systemRunner.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createSystemRunner, PHASES, MAX_CONSECUTIVE_FAILURES } from '../src/engine/SystemRunner.js';

const quietLogger = () => {
  const calls = [];
  return { calls, error: (...args) => calls.push(args) };
};
const sys = (id, phase, update = () => {}, extra = {}) => ({ id, phase, update, dispose() {}, ...extra });
const boom = () => { throw new Error('rusak'); };

describe('SystemRunner: urutan fase', () => {
  it('menjalankan input → sim → world → camera → ui; dalam satu fase sesuai urutan daftar', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const log = [];
    const mk = (id, phase) => sys(id, phase, () => log.push(id));
    r.add(mk('ui1', 'ui'));
    r.add(mk('w1', 'world'));
    r.add(mk('in1', 'input'));
    r.add(mk('w2', 'world'));
    r.add(mk('cam', 'camera'));
    r.add(mk('sim1', 'sim'));
    r.update(0.016, {});
    expect(log).toEqual(['in1', 'sim1', 'w1', 'w2', 'cam', 'ui1']);
    expect(r.ids).toEqual(log);
    expect(PHASES).toEqual(['input', 'sim', 'world', 'camera', 'ui']);
  });

  it('meneruskan dt dan ctx apa adanya', () => {
    const r = createSystemRunner();
    const seen = [];
    const ctx = { time: 3 };
    r.add(sys('a', 'sim', (dt, c) => seen.push([dt, c])));
    r.update(0.02, ctx);
    expect(seen).toEqual([[0.02, ctx]]);
  });
});

describe('SystemRunner: isolasi galat', () => {
  it('sistem yang melempar tidak menghentikan sistem lain', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    let n = 0;
    r.add(sys('rusak', 'sim', boom));
    r.add(sys('sehat', 'ui', () => { n += 1; }));
    r.update(0.016, {});
    expect(n).toBe(1);
    expect(r.has('rusak')).toBe(true);
  });

  it(`dinonaktifkan setelah ${MAX_CONSECUTIVE_FAILURES} galat beruntun dan dicatat dengan id`, () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    let n = 0;
    r.add(sys('rusak', 'world', boom));
    r.add(sys('sehat', 'ui', () => { n += 1; }));
    for (let i = 0; i < 3; i += 1) r.update(0.016, {});
    expect(r.has('rusak')).toBe(false);
    expect(r.disabled).toEqual(['rusak']);
    expect(n).toBe(3);
    expect(logger.calls).toHaveLength(2);
    expect(logger.calls[0][0]).toContain('"rusak"');
    expect(logger.calls[1][0]).toContain('dinonaktifkan');
    expect(logger.calls[1][0]).toContain('"rusak"');
    r.update(0.016, {});
    expect(n).toBe(4);
  });

  it('galat yang diselingi frame sukses mereset hitungan', () => {
    const r = createSystemRunner({ logger: quietLogger() });
    const plan = [true, true, false, true, true, true];
    let frame = 0;
    r.add(sys('kadang', 'sim', () => { if (plan[frame]) throw new Error('x'); }));
    for (; frame < 5; frame += 1) r.update(0.016, {});
    expect(r.has('kadang')).toBe(true);
    r.update(0.016, {});
    expect(r.has('kadang')).toBe(false);
  });
});

describe('SystemRunner: pendaftaran & dispose', () => {
  it('menolak sistem tidak valid dan id ganda', () => {
    const r = createSystemRunner();
    expect(() => r.add({ phase: 'sim', update() {} })).toThrow(TypeError);
    expect(() => r.add(sys('a', 'render'))).toThrow(TypeError);
    expect(() => r.add({ id: 'b', phase: 'sim' })).toThrow(TypeError);
    r.add(sys('a', 'sim'));
    expect(() => r.add(sys('a', 'ui'))).toThrow(/sudah terdaftar/);
  });

  it('remove mengembalikan true/false; sistem tanpa dispose diperbolehkan', () => {
    const r = createSystemRunner();
    r.add({ id: 'tanpaDispose', phase: 'ui', update() {} });
    expect(r.remove('tanpaDispose')).toBe(true);
    expect(r.remove('tanpaDispose')).toBe(false);
  });

  it('dispose memanggil dispose tiap sistem, galatnya diisolasi, runner kosong', () => {
    const logger = quietLogger();
    const r = createSystemRunner({ logger });
    const order = [];
    r.add(sys('a', 'sim', () => {}, { dispose: () => order.push('a') }));
    r.add(sys('b', 'ui', () => {}, { dispose: () => { throw new Error('gagal'); } }));
    r.add({ id: 'c', phase: 'world', update() {} });
    r.dispose();
    expect(order).toEqual(['a']);
    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0][0]).toContain('"b"');
    expect(r.ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/systemRunner.test.js`
Expected: FAIL — `Failed to resolve import "../src/engine/SystemRunner.js"`.

- [ ] **Step 3: Implementasi `src/engine/SystemRunner.js`**

```js
/**
 * SystemRunner: menjalankan sistem per frame dalam fase eksplisit input → sim → world → camera → ui.
 * Di dalam satu fase, urutan = urutan pendaftaran. Satu sistem yang melempar galat tidak menghentikan
 * sistem lain; setelah MAX_CONSECUTIVE_FAILURES galat beruntun sistem dinonaktifkan dan id-nya dicatat.
 * Lapisan engine: tanpa impor three/world/ui.
 */
export const PHASES = Object.freeze(['input', 'sim', 'world', 'camera', 'ui']);
export const MAX_CONSECUTIVE_FAILURES = 3;

const PHASE_INDEX = new Map(PHASES.map((p, i) => [p, i]));

/**
 * @typedef {{id:string, phase:'input'|'sim'|'world'|'camera'|'ui', update(dt:number, ctx:object):void, dispose?():void}} System
 */

function assertSystem(system) {
  if (!system || typeof system.id !== 'string' || system.id === '') throw new TypeError('SystemRunner: sistem butuh id string');
  if (!PHASE_INDEX.has(system.phase)) throw new TypeError(`SystemRunner: fase "${system.phase}" (sistem "${system.id}") tidak dikenal`);
  if (typeof system.update !== 'function') throw new TypeError(`SystemRunner: sistem "${system.id}" butuh update(dt, ctx)`);
}

/**
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createSystemRunner({ logger = console } = {}) {
  let entries = []; // { system, failures } terurut fase lalu pendaftaran
  const disabled = [];

  const insert = (entry) => {
    const idx = PHASE_INDEX.get(entry.system.phase);
    const at = entries.findIndex((e) => PHASE_INDEX.get(e.system.phase) > idx);
    entries = at < 0 ? [...entries, entry] : [...entries.slice(0, at), entry, ...entries.slice(at)];
  };

  const fail = (entry, err) => {
    entry.failures += 1;
    const { id } = entry.system;
    if (entry.failures >= MAX_CONSECUTIVE_FAILURES) {
      logger.error(`Sistem "${id}" dinonaktifkan setelah ${entry.failures} galat beruntun:`, err);
      entries = entries.filter((e) => e !== entry);
      disabled.push(id);
    } else if (entry.failures === 1) {
      logger.error(`Sistem "${id}" galat (dicoba lagi pada frame berikutnya):`, err);
    }
  };

  return {
    /** @param {System} system */
    add(system) {
      assertSystem(system);
      if (entries.some((e) => e.system.id === system.id)) throw new Error(`SystemRunner: id "${system.id}" sudah terdaftar`);
      insert({ system, failures: 0 });
      return system;
    },
    remove(id) {
      const before = entries.length;
      entries = entries.filter((e) => e.system.id !== id);
      return entries.length !== before;
    },
    has(id) { return entries.some((e) => e.system.id === id); },
    get ids() { return entries.map((e) => e.system.id); },
    get disabled() { return [...disabled]; },
    update(dt, ctx) {
      for (const entry of entries) { // iterasi atas array saat ini; penghapusan membuat array baru
        try {
          entry.system.update(dt, ctx);
          entry.failures = 0;
        } catch (err) {
          fail(entry, err);
        }
      }
    },
    dispose() {
      const list = entries;
      entries = [];
      for (const { system } of list) {
        try {
          system.dispose?.();
        } catch (err) {
          logger.error(`Sistem "${system.id}" gagal di-dispose:`, err);
        }
      }
    },
  };
}
```

- [ ] **Step 4: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/systemRunner.test.js`
Expected: PASS (9 tes).

- [ ] **Step 5: Ganti mekanisme updatable di `src/core/App.js`**

1. Setelah `import { DepthRenderPass, OutlinePass } from './postprocessing/OutlinePass.js';` (`App.js:10`) tambahkan:

```js
import { createSystemRunner } from '../engine/SystemRunner.js';
```

2. Hapus `App.js:15` (`const MAX_UPDATE_FAILURES = 3; ...`).
3. `App.js:27` dan `App.js:34` — sebelum:

```js
 * Modul lain mendaftar lewat addUpdatable({ update(dt, ctx) }).
...
  #failures = new Map(); // updatable -> jumlah error beruntun
```

sesudah:

```js
 * Modul lain mendaftar lewat addSystem({ id, phase, update(dt, ctx) }) (engine/SystemRunner);
 * addUpdatable({ update }) tetap ada sebagai adaptor fase 'ui' untuk binding settings.
...
  #legacy = new Map(); // updatable lama -> id sistem adaptor
  #legacySeq = 0;
```

4. `App.js:48` — `this.updatables = [];` menjadi `this.systems = createSystemRunner();`
5. `App.js:62-70` — sebelum:

```js
  addUpdatable(obj) {
    if (obj && typeof obj.update === 'function') this.updatables.push(obj);
    return obj;
  }

  /** Hapus updatable yang didaftarkan lewat addUpdatable (salinan baru, tanpa mutasi array). */
  removeUpdatable(obj) {
    this.updatables = this.updatables.filter((u) => u !== obj);
  }
```

sesudah:

```js
  /** Daftarkan sistem berfase (lihat engine/SystemRunner). */
  addSystem(system) {
    return this.systems.add(system);
  }

  removeSystem(id) {
    return this.systems.remove(id);
  }

  /** Adaptor API lama: objek { update(dt, ctx) } menjadi sistem fase `phase` (default 'ui'). */
  addUpdatable(obj, phase = 'ui') {
    if (!obj || typeof obj.update !== 'function') return obj;
    this.#legacySeq += 1;
    const id = `updatable-${this.#legacySeq}`;
    this.#legacy.set(obj, id);
    this.systems.add({ id, phase, update: (dt, ctx) => obj.update(dt, ctx) });
    return obj;
  }

  /** Hapus updatable yang didaftarkan lewat addUpdatable. */
  removeUpdatable(obj) {
    const id = this.#legacy.get(obj);
    if (!id) return;
    this.systems.remove(id);
    this.#legacy.delete(obj);
  }
```

6. Hapus `App.js:204-220` (komentar + metode `#safeUpdate`).
7. `App.js:236` — `for (const u of this.updatables) this.#safeUpdate(u, dt, ctx);` menjadi `this.systems.update(dt, ctx);`

- [ ] **Step 6: Daftarkan sistem berfase di `src/main.js`**

Di `main()` (urutan pendaftaran dalam fase yang sama mengikuti urutan lama):

```js
// sebelum
  app.addUpdatable({ update: (dt) => gamepad.update(dt) });
// sesudah
  app.addSystem({ id: 'gamepad', phase: 'input', update: (dt) => gamepad.update(dt) });
```

```js
// sebelum
  app.addUpdatable({ update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });
// sesudah
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });
```

```js
// sebelum
  app.addUpdatable({ update: (dt, ctx) => { updateWind(dt); world.update(dt, ctx.time, ctx.focus); } }); // angin global tiap frame
// sesudah
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  app.addSystem({ id: 'world', phase: 'world', update: (dt, ctx) => world.update(dt, ctx.time, ctx.focus) });
```

```js
// sebelum
  for (const e of ents.updatables) app.addUpdatable(e);
// sesudah
  ents.updatables.forEach((e, i) => app.addSystem({ id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, ctx) }));
```

```js
// sebelum
  app.addUpdatable({ update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addUpdatable(weather); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini
// sesudah
  app.addSystem({ id: 'timeOfDay', phase: 'world', update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addSystem({ id: 'weather', phase: 'world', update: (dt, ctx) => weather.update(dt, ctx) }); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini
```

Ganti seluruh blok `const bikePos = new THREE.Vector3();` + `app.addUpdatable({ update(dt, ctx) { ... input.endFrame(); }, });` menjadi:

```js
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story });

  const bikePos = new THREE.Vector3();
```

dan tambahkan fungsi baru setelah `main()` (sebelum `/** Cerita: ...`):

```js
/**
 * Sistem per frame milik composition root (dulu satu updatable raksasa). Hotkey kini di fase input
 * (efeknya terlihat satu frame lebih awal; tidak ada perbedaan visual), cerita di sim, kamera di camera,
 * HUD dan input.endFrame di ui (endFrame terdaftar terakhir di antara konsumen tombol).
 */
function addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story }) {
  app.addSystem({
    id: 'keymap',
    phase: 'input',
    update: () => { if (session.started) handleKeys(input, { rig, hud, ents, shop, time, store, story }); }, // menu terbuka: tombol game diabaikan
  });
  app.addSystem({
    id: 'story',
    phase: 'sim',
    update: (dt, ctx) => story.update(dt, {
      time: ctx.time, bikePos: ents.bike.state, hour: time.hour,
      raining: Boolean(store.get('weather.raining')), paused: hud.shopOpen || rig.freezesBike,
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
      updatePrompt(hud, ents, story, ents.bike.state);
    },
  });
  app.addSystem({ id: 'input.endFrame', phase: 'ui', update: () => input.endFrame() });
}
```

Di `setupStory`:

```js
// sebelum
  app.addUpdatable({ update: (dt, ctx) => npcs.refreshLabels(ctx.focus ?? ctx.bikePos, ents.vendors.labelsEnabled) });
// sesudah
  app.addSystem({ id: 'storyNpcLabels', phase: 'ui', update: (dt, ctx) => npcs.refreshLabels(ctx.focus ?? ctx.bikePos, ents.vendors.labelsEnabled) });
```

Di `setupMinimap`:

```js
// sebelum
  app.addUpdatable({
    update(dt, ctx) {
// sesudah
  app.addSystem({
    id: 'minimap',
    phase: 'ui',
    update(dt, ctx) {
```

- [ ] **Step 7: Verifikasi suite, lint, build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build`
Expected: semua PASS (termasuk `tests/bindings.test.js` yang memakai `addUpdatable/removeUpdatable` palsu), lint 0 error, build sukses.

- [ ] **Step 8: Commit**

```bash
git add src/engine/SystemRunner.js tests/systemRunner.test.js src/core/App.js src/main.js && git commit -m "feat: SystemRunner berfase (input→sim→world→camera→ui) dengan isolasi galat menggantikan updatable raksasa"
```

---

### Task 3: `ResourceScope` + `disposeTree`

**Files:**
- Create: `src/engine/ResourceScope.js`, `src/engine/disposeTree.js`, `tests/resourceScope.test.js`, `tests/disposeTree.test.js`

- [ ] **Step 1: Tulis tes gagal `tests/resourceScope.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createResourceScope, currentScope, withScope, collectResources } from '../src/engine/ResourceScope.js';

const quiet = () => {
  const calls = [];
  return { calls, error: (...a) => calls.push(a) };
};
const onDispose = (res) => {
  const hit = { n: 0 };
  res.addEventListener('dispose', () => { hit.n += 1; });
  return hit;
};

describe('ResourceScope: get & refcount', () => {
  it('make dipanggil sekali per kunci; refs bertambah tiap get', () => {
    const scope = createResourceScope('uji');
    const make = vi.fn(() => new THREE.MeshBasicMaterial());
    const a = scope.get('m', make);
    const b = scope.get('m', make);
    expect(a).toBe(b);
    expect(make).toHaveBeenCalledTimes(1);
    expect(scope.refs('m')).toBe(2);
    expect(scope.refs('tidak-ada')).toBe(0);
    expect(scope.has('m')).toBe(true);
    expect(scope.size).toBe(1);
    expect(createResourceScope().name).toBe('scope');
  });

  it('release menurunkan refs; di nol sumber daya di-dispose dan kunci hilang', () => {
    const scope = createResourceScope('uji');
    const geo = scope.get('g', () => new THREE.BoxGeometry());
    scope.get('g', () => new THREE.BoxGeometry());
    const hit = onDispose(geo);
    expect(scope.release('g')).toBe(true);
    expect(hit.n).toBe(0);
    expect(scope.release('g')).toBe(true);
    expect(hit.n).toBe(1);
    expect(scope.has('g')).toBe(false);
    expect(scope.owns(geo)).toBe(false);
    expect(scope.release('g')).toBe(false);
  });

  it('objek polos/array: anggota material/geometri/tekstur dimiliki & dilepas sekali walau ada alias', () => {
    const scope = createResourceScope('uji');
    const shared = new THREE.MeshStandardMaterial();
    const tex = new THREE.Texture();
    const set = scope.get('set', () => ({ a: shared, alias: shared, t: tex, n: 3 }));
    const list = scope.get('list', () => [new THREE.PlaneGeometry(), 'bukan sumber daya']);
    expect(scope.owns(set.a)).toBe(true);
    expect(scope.owns(tex)).toBe(true);
    expect(scope.owns(list[0])).toBe(true);
    const hm = onDispose(shared);
    const ht = onDispose(tex);
    scope.dispose();
    expect(hm.n).toBe(1);
    expect(ht.n).toBe(1);
    expect(scope.size).toBe(0);
    expect(scope.disposed).toBe(true);
  });

  it('disposer kustom dipakai; galatnya dicatat tanpa menghentikan pelepasan lain', () => {
    const logger = quiet();
    const scope = createResourceScope('uji', { logger });
    const seen = [];
    scope.get('rusak', () => ({}), { dispose: () => { throw new Error('gagal'); } });
    scope.get('ok', () => 42, { dispose: (v) => seen.push(v) });
    scope.dispose();
    expect(seen).toEqual([42]);
    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0][0]).toContain('"rusak"');
  });

  it('forget melepas kunci tanpa dispose', () => {
    const scope = createResourceScope('uji');
    const mat = scope.get('m', () => new THREE.MeshBasicMaterial());
    const hit = onDispose(mat);
    expect(scope.forget('m')).toBe(true);
    expect(scope.forget('m')).toBe(false);
    expect(scope.owns(mat)).toBe(false);
    scope.dispose();
    expect(hit.n).toBe(0);
  });

  it('get setelah dispose atau dengan make bukan fungsi melempar', () => {
    const scope = createResourceScope('uji');
    expect(() => scope.get('x', 5)).toThrow(TypeError);
    scope.dispose();
    expect(() => scope.get('x', () => 1)).toThrow(/sudah di-dispose/);
  });

  it('collectResources: hanya sumber daya three langsung (satu tingkat)', () => {
    const m = new THREE.MeshBasicMaterial();
    expect(collectResources(m)).toEqual([m]);
    expect(collectResources(null)).toEqual([]);
    expect(collectResources(Promise.resolve())).toEqual([]);
    expect(collectResources({ nested: { m } })).toEqual([]);
  });
});

describe('ResourceScope: scope aktif', () => {
  it('default global; withScope menukar sementara dan memulihkan walau melempar', () => {
    const global = currentScope();
    expect(global.name).toBe('global');
    const s = createResourceScope('region');
    expect(withScope(s, () => currentScope())).toBe(s);
    expect(currentScope()).toBe(global);
    expect(() => withScope(s, () => { throw new Error('x'); })).toThrow('x');
    expect(currentScope()).toBe(global);
    expect(() => withScope(null, () => 1)).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Tulis tes gagal `tests/disposeTree.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { disposeTree } from '../src/engine/disposeTree.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';

const track = (res) => {
  let n = 0;
  res.addEventListener('dispose', () => { n += 1; });
  return () => n;
};

describe('disposeTree', () => {
  it('melepas geometri, material (termasuk array), tekstur material & uniform, sekali per sumber daya', () => {
    const root = new THREE.Group();
    const geo = new THREE.BoxGeometry();
    const map = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map });
    const uniformTex = new THREE.Texture();
    const shader = new THREE.ShaderMaterial({ uniforms: { uTex: { value: uniformTex } } });
    const matB = new THREE.MeshBasicMaterial();
    root.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, [mat, matB]));
    const child = new THREE.Group();
    child.add(new THREE.Points(new THREE.BufferGeometry(), shader));
    root.add(child);
    const counters = [geo, map, mat, uniformTex, shader, matB].map(track);
    const res = disposeTree(root);
    expect(counters.map((c) => c())).toEqual([1, 1, 1, 1, 1, 1]);
    expect(res).toEqual({ geometries: 2, materials: 3, textures: 2 });
    expect(root.children).toHaveLength(0);
  });

  it('InstancedMesh ikut di-dispose (atribut instans)', () => {
    const root = new THREE.Group();
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);
    root.add(mesh);
    const n = track(mesh);
    disposeTree(root);
    expect(n()).toBe(1);
  });

  it('sumber daya milik ResourceScope dilewati (dilepas scope, bukan pohon)', () => {
    const scope = createResourceScope('uji');
    const shared = scope.get('mat', () => new THREE.MeshBasicMaterial());
    const own = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(own, shared));
    const nShared = track(shared);
    const nOwn = track(own);
    disposeTree(root, { scope });
    expect(nShared()).toBe(0);
    expect(nOwn()).toBe(1);
    scope.dispose();
    expect(nShared()).toBe(1);
  });

  it('root null atau kosong aman', () => {
    expect(disposeTree(null)).toEqual({ geometries: 0, materials: 0, textures: 0 });
    expect(disposeTree(new THREE.Group())).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });
});
```

- [ ] **Step 3: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/resourceScope.test.js tests/disposeTree.test.js`
Expected: FAIL — modul `src/engine/ResourceScope.js` dan `src/engine/disposeTree.js` tidak ditemukan.

- [ ] **Step 4: Implementasi `src/engine/ResourceScope.js`**

```js
/**
 * ResourceScope: cache sumber daya GPU (material/geometri/tekstur) ber-refcount per kunci.
 * - get(key, make) membuat sekali lalu menaikkan refs; release(key) menurunkan, di nol dilepas.
 * - dispose() melepas semua entri (dipakai saat region di-dispose).
 * - owns(resource) dipakai disposeTree agar sumber daya bersama tidak dilepas dua kali oleh pohon.
 * Modul memakai currentScope() pada saat pemanggilan; withScope(scope, fn) menukar scope aktif
 * selama fn sinkron (mis. saat region dibangun). Lapisan engine: tanpa impor three/world/ui.
 */
const RESOURCE_FLAGS = ['isMaterial', 'isBufferGeometry', 'isTexture'];

const isResource = (v) => Boolean(v) && typeof v === 'object' && RESOURCE_FLAGS.some((f) => v[f] === true);

/** Sumber daya langsung di dalam nilai cache: nilai itu sendiri, atau anggota array/objek polos (satu tingkat). */
export function collectResources(value) {
  if (isResource(value)) return [value];
  if (Array.isArray(value)) return value.filter(isResource);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).filter(isResource);
  }
  return [];
}

function defaultDispose(value) {
  for (const r of new Set(collectResources(value))) r.dispose();
}

/**
 * @param {string} [name]
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createResourceScope(name = 'scope', { logger = console } = {}) {
  const entries = new Map(); // key -> { value, refs, dispose, resources }
  const owned = new Map();   // resource -> jumlah entri yang memuatnya
  let disposed = false;

  const own = (resources, delta) => {
    for (const r of resources) {
      const n = (owned.get(r) ?? 0) + delta;
      if (n > 0) owned.set(r, n);
      else owned.delete(r);
    }
  };

  const drop = (key, entry) => {
    entries.delete(key);
    own(entry.resources, -1);
    try {
      entry.dispose(entry.value);
    } catch (err) {
      logger.error(`ResourceScope "${name}": gagal melepas "${key}":`, err);
    }
  };

  return {
    name,
    /**
     * @template T
     * @param {string} key
     * @param {() => T} make
     * @param {{dispose?: (value: T) => void}} [opts]
     * @returns {T}
     */
    get(key, make, { dispose = defaultDispose } = {}) {
      if (disposed) throw new Error(`ResourceScope "${name}" sudah di-dispose`);
      if (typeof make !== 'function') throw new TypeError('ResourceScope.get: make harus fungsi');
      const hit = entries.get(key);
      if (hit) {
        hit.refs += 1;
        return hit.value;
      }
      const value = make();
      const resources = [...new Set(collectResources(value))];
      entries.set(key, { value, refs: 1, dispose, resources });
      own(resources, 1);
      return value;
    },
    has(key) { return entries.has(key); },
    refs(key) { return entries.get(key)?.refs ?? 0; },
    release(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      entry.refs -= 1;
      if (entry.refs <= 0) drop(key, entry);
      return true;
    },
    /** Hapus entri tanpa melepas nilainya (mis. muatan yang gagal agar bisa dicoba ulang). */
    forget(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      entries.delete(key);
      own(entry.resources, -1);
      return true;
    },
    owns(resource) { return owned.has(resource); },
    get size() { return entries.size; },
    get disposed() { return disposed; },
    dispose() {
      for (const [key, entry] of [...entries]) drop(key, entry);
      disposed = true;
    },
  };
}

let current = createResourceScope('global');

/** Scope yang dipakai cache modul saat ini (default: scope global aplikasi). */
export function currentScope() {
  return current;
}

/** Jalankan fn (sinkron) dengan `scope` sebagai scope aktif; scope sebelumnya selalu dipulihkan. */
export function withScope(scope, fn) {
  if (!scope || typeof scope.get !== 'function') throw new TypeError('withScope: scope tidak valid');
  const prev = current;
  current = scope;
  try {
    return fn();
  } finally {
    current = prev;
  }
}
```

- [ ] **Step 5: Implementasi `src/engine/disposeTree.js`**

```js
/**
 * Lepas geometri, material, dan tekstur di bawah `root`, lalu kosongkan anak-anaknya.
 * Sumber daya milik `scope` (ResourceScope) dilewati: scope yang melepasnya di scope.dispose().
 * Setiap sumber daya dilepas sekali walau dibagi banyak mesh. Lapisan engine: tanpa impor three.
 * @param {import('three').Object3D|null} root
 * @param {{scope?: {owns(resource: object): boolean}|null}} [opts]
 * @returns {{geometries:number, materials:number, textures:number}} jumlah yang benar-benar dilepas
 */
export function disposeTree(root, { scope = null } = {}) {
  const counts = { geometries: 0, materials: 0, textures: 0 };
  if (!root) return counts;
  const geometries = new Set();
  const materials = new Set();
  const instanced = [];
  root.traverse((o) => {
    if (o.geometry?.isBufferGeometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.isMaterial) materials.add(m);
    if (o.isInstancedMesh) instanced.push(o);
  });
  const textures = new Set();
  for (const m of materials) {
    for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture) textures.add(u.value);
  }
  const release = (set, key) => {
    for (const r of set) {
      if (scope?.owns(r)) continue;
      r.dispose();
      counts[key] += 1;
    }
  };
  release(geometries, 'geometries');
  release(materials, 'materials');
  release(textures, 'textures');
  for (const mesh of instanced) mesh.dispose();
  root.clear();
  return counts;
}
```

- [ ] **Step 6: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/resourceScope.test.js tests/disposeTree.test.js`
Expected: PASS (12 tes).

- [ ] **Step 7: Lint**

Run: `node node_modules/eslint/bin/eslint.js .`
Expected: 0 error.

- [ ] **Step 8: Commit**

```bash
git add src/engine/ResourceScope.js src/engine/disposeTree.js tests/resourceScope.test.js tests/disposeTree.test.js && git commit -m "feat: ResourceScope ber-refcount dan disposeTree yang menghormati kepemilikan scope"
```

---

### Task 4: Cache modul dunia + material saat-impor → `ResourceScope`

**Files:**
- Modify: `src/world/materials.js:6-8,17,27-30`, `src/world/Ground.materials.js:1-3,60-81`, `src/world/textures/surfaces.js:7-9,24-29`, `src/world/textures/decalAtlas.js:7-9,275-302`, `src/world/siteutil/rounded.js:1-3,12,25-31`, `src/world/siteutil/textCanvas.js:1,52-63`, `src/world/Landscape.baseball.js:1-3,16-23,35-36,56-57,81-82,97-98`, `src/world/Ground.roads.js:1-5,19,53,63,72,170`, `tests/helpers.js`
- Create: `tests/scopedCaches.test.js`

- [ ] **Step 1: Tambahkan helper tes di akhir `tests/helpers.js`**

```js
import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';

/** Panggil `make` dua kali di scope `a` dan sekali di scope `b` (scope baru). */
export function inTwoScopes(make) {
  const a = createResourceScope('a');
  const b = createResourceScope('b');
  return { a, b, first: withScope(a, make), again: withScope(a, make), other: withScope(b, make) };
}

/** Himpunan material (bukan array) dan geometri di bawah root. */
export function materialsOf(root) {
  const out = new Set();
  root.traverse((o) => { if (o.material && !Array.isArray(o.material)) out.add(o.material); });
  return out;
}

export function geometriesOf(root) {
  const out = new Set();
  root.traverse((o) => { if (o.geometry) out.add(o.geometry); });
  return out;
}
```

(letakkan baris `import` di **atas** berkas, sebelum `export function deepFreeze`.)

- [ ] **Step 2: Tulis tes gagal `tests/scopedCaches.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';
import { inTwoScopes, materialsOf, geometriesOf } from './helpers.js';
import { Materials } from '../src/world/materials.js';
import { groundMaterials } from '../src/world/Ground.materials.js';
import { asphaltTexture } from '../src/world/textures/surfaces.js';
import { createDecalAtlas } from '../src/world/textures/decalAtlas.js';
import { roundedBox } from '../src/world/siteutil/rounded.js';
import { makeTextMaterial } from '../src/world/siteutil/textCanvas.js';
import { createBaseballVenue } from '../src/world/Landscape.baseball.js';
import { createRingRoad } from '../src/world/Ground.roads.js';

describe('cache modul dunia memakai ResourceScope aktif', () => {
  it.each([
    ['Materials.acp', () => Materials.acp()],
    ['roundedBox', () => roundedBox(1, 0.5, 0.4, 0.05)],
    ['makeTextMaterial', () => makeTextMaterial('UJI', { bg: '#fff' })],
  ])('%s: sama dalam satu scope, baru di scope lain, dimiliki scope', (_name, make) => {
    const { a, first, again, other } = inTwoScopes(make);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(a.owns(first)).toBe(true);
  });

  it('groundMaterials dan tekstur permukaan: satu set per scope, dimiliki scope', () => {
    const g = inTwoScopes(() => groundMaterials());
    expect(g.again).toBe(g.first);
    expect(g.other.grass).not.toBe(g.first.grass);
    expect(g.a.owns(g.first.asphalt)).toBe(true);
    const t = inTwoScopes(() => asphaltTexture());
    expect(t.other.map).not.toBe(t.first.map);
    expect(t.a.owns(t.first.map)).toBe(true);
  });

  it('atlas dekal: satu tekstur per scope', () => {
    const { a, first, again, other } = inTwoScopes(() => createDecalAtlas());
    expect(again).toBe(first);
    expect(other.texture).not.toBe(first.texture);
    expect(a.owns(first.texture)).toBe(true);
  });

  it('dispose scope melepas material cache', () => {
    const a = createResourceScope('a');
    const mat = withScope(a, () => Materials.steel());
    let disposed = false;
    mat.addEventListener('dispose', () => { disposed = true; });
    a.dispose();
    expect(disposed).toBe(true);
  });
});

describe('material/geometri saat-impor kini lazy per scope', () => {
  it('venue baseball: semua material milik scope a dan tidak dibagi dengan scope b', () => {
    const { a, first, other } = inTwoScopes(() => createBaseballVenue());
    const matsA = [...materialsOf(first)];
    const matsB = materialsOf(other);
    expect(matsA.length).toBeGreaterThan(0);
    expect(matsA.every((m) => a.owns(m))).toBe(true);
    expect(matsA.some((m) => matsB.has(m))).toBe(false);
  });

  it('marka jalan lingkar: geometri dash dimiliki scope', () => {
    const { a, first, other } = inTwoScopes(() => createRingRoad());
    const owned = [...geometriesOf(first)].filter((g) => a.owns(g));
    expect(owned).toHaveLength(1);
    expect(geometriesOf(other).has(owned[0])).toBe(false);
  });
});
```

- [ ] **Step 3: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/scopedCaches.test.js`
Expected: FAIL — `expected ... not to be ...` / `a.owns(...)` bernilai `false` (cache masih tingkat modul).

- [ ] **Step 4: `src/world/materials.js`**

Tambah impor setelah `import { surfaceMaps } from './textures/surfaces.js';` (`:8`):

```js
import { currentScope } from '../engine/ResourceScope.js';
```

Hapus `:17` (`const cache = new Map();`). Ganti `:27-30`:

```js
// sebelum
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}
// sesudah
/** Material bersama per ResourceScope aktif (region di-dispose → material ikut dilepas). */
function cached(key, make) {
  return currentScope().get(`materials:${key}`, make);
}
```

- [ ] **Step 5: `src/world/Ground.materials.js`**

Tambah impor setelah `:3`: `import { currentScope } from '../engine/ResourceScope.js';`. Ganti `:60-81`:

```js
// sebelum
let cache = null;

/** Buat (sekali) dan kembalikan set material bersama. */
export function groundMaterials() {
  if (cache) return cache;
  const asphalt = surfaceMaterial('asphalt');
  cache = {
    grass: surfaceMaterial('grass'),
    ...
    amphitheater: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.amphitheater }),
  };
  return cache;
}
// sesudah
/** Set material tanah bersama, satu per ResourceScope aktif. */
export function groundMaterials() {
  return currentScope().get('ground:materials', createGroundMaterials);
}

function createGroundMaterials() {
  const asphalt = surfaceMaterial('asphalt');
  return {
    grass: surfaceMaterial('grass'),
    paving: surfaceMaterial('paving', { color: COLORS.concrete }),
    asphalt,
    asphaltPlain: asphalt,
    concrete: surfaceMaterial('concrete', { color: COLORS.concrete }),
    kerb: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.kerb }),
    sidewalk: surfaceMaterial('concrete', { color: GROUND_COLORS.sidewalk }),
    lineWhite: new THREE.MeshBasicMaterial({ color: GROUND_COLORS.lineWhite }),
    lineYellow: new THREE.MeshBasicMaterial({ color: GROUND_COLORS.lineYellow }),
    joggingTrack: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.joggingTrack }),
    dirt: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.dirt }),
    amphitheater: new THREE.MeshLambertMaterial({ color: GROUND_COLORS.amphitheater }),
  };
}
```

- [ ] **Step 6: `src/world/textures/surfaces.js`**

Tambah impor setelah `:9`: `import { currentScope } from '../../engine/ResourceScope.js';`. Ganti `:24-29`:

```js
// sebelum
const cache = new Map();

function cached(name, make) {
  if (!cache.has(name)) cache.set(name, Object.freeze(make()));
  return cache.get(name);
}
// sesudah
/** Tekstur asli per nama, satu set per ResourceScope aktif ({map, normalMap?, roughnessMap?}). */
function cached(name, make) {
  return currentScope().get(`surfaces:${name}`, () => Object.freeze(make()));
}
```

- [ ] **Step 7: `src/world/textures/decalAtlas.js`**

Tambah impor setelah `:9`: `import { currentScope } from '../../engine/ResourceScope.js';`. Ganti `:275-302`:

```js
// sebelum
let cache = null;

/**
 * Atlas dekal (di-cache; satu tekstur untuk seluruh dunia).
 * @returns {{texture: import('three').Texture, uv(name:string): {u0:number,v0:number,du:number,dv:number}, names: string[]}}
 */
export function createDecalAtlas() {
  if (cache) return cache;
  const uvs = ...
  ...
  cache = Object.freeze({ texture, uv, names: DECAL_NAMES });
  return cache;
}
// sesudah
/**
 * Atlas dekal (satu tekstur per ResourceScope aktif).
 * @returns {{texture: import('three').Texture, uv(name:string): {u0:number,v0:number,du:number,dv:number}, names: string[]}}
 */
export function createDecalAtlas() {
  return currentScope().get('decals:atlas', buildDecalAtlas);
}

function buildDecalAtlas() {
  const uvs = ...            // baris :283-299 tidak berubah
  ...
  return Object.freeze({ texture, uv, names: DECAL_NAMES });
}
```

(isi `:283-299` — dari `const uvs = Object.fromEntries(...)` sampai blok `if (hasDocument()) { ... } else { ... }` — dipertahankan apa adanya di dalam `buildDecalAtlas`.)

- [ ] **Step 8: `src/world/siteutil/rounded.js`**

Tambah impor setelah `:3`: `import { currentScope } from '../../engine/ResourceScope.js';`. Hapus `:12` (`const boxCache = new Map();`). Ganti `:29-30`:

```js
// sebelum
  if (!boxCache.has(key)) boxCache.set(key, mergeVertices(new RoundedBoxGeometry(w, h, d, seg, radius)));
  return boxCache.get(key);
// sesudah
  return currentScope().get(`rounded:${key}`, () => mergeVertices(new RoundedBoxGeometry(w, h, d, seg, radius)));
```

- [ ] **Step 9: `src/world/siteutil/textCanvas.js`**

Tambah impor setelah `:1`: `import { currentScope } from '../../engine/ResourceScope.js';`. Ganti `:52-63`:

```js
// sebelum
const materialCache = new Map();

/**
 * Material plane bertulisan; ...
 */
export function makeTextMaterial(text, opts = {}) {
  const key = `${text}|${JSON.stringify(opts)}`;
  if (!materialCache.has(key)) materialCache.set(key, buildTextMaterial(text, opts));
  return materialCache.get(key);
}
// sesudah
/**
 * Material plane bertulisan; fallback warna polos jika kanvas tak tersedia.
 * Di-cache per (teks + opsi) dalam ResourceScope aktif agar papan dengan tulisan sama berbagi
 * material dan bisa digabung menjadi satu draw call. Tekstur kanvas ikut dilepas bersama material.
 */
export function makeTextMaterial(text, opts = {}) {
  const key = `${text}|${JSON.stringify(opts)}`;
  return currentScope().get(`text:${key}`, () => buildTextMaterial(text, opts), { dispose: disposeTextMaterial });
}

function disposeTextMaterial(mat) {
  mat.map?.dispose();
  mat.dispose();
}
```

- [ ] **Step 10: `src/world/Landscape.baseball.js`**

Tambah impor setelah `:3`: `import { currentScope } from '../engine/ResourceScope.js';`. Ganti `:16-23`:

```js
// sebelum
const outfieldMat = new THREE.MeshLambertMaterial({ color: 0x2c7d35 });
...
const dugoutMat = new THREE.MeshLambertMaterial({ color: 0x8f8f88 });
// sesudah
/** Material venue (dulu dibuat saat impor), kini satu set per ResourceScope aktif. */
function baseballMaterials() {
  return currentScope().get('baseball:materials', () => ({
    outfield: new THREE.MeshLambertMaterial({ color: 0x2c7d35 }),
    infield: new THREE.MeshLambertMaterial({ color: 0x9c6b3c }),
    innerGrass: new THREE.MeshLambertMaterial({ color: 0x3a9344 }),
    base: new THREE.MeshLambertMaterial({ color: 0xf5f5f0 }),
    fence: new THREE.MeshLambertMaterial({ color: 0x4a5a3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    post: new THREE.MeshLambertMaterial({ color: 0x6e7278 }),
    net: new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    dugout: new THREE.MeshLambertMaterial({ color: 0x8f8f88 }),
  }));
}
```

Lalu sisipkan satu baris sebagai baris pertama tiap fungsi (nama variabel lama dipertahankan sehingga sisa badan fungsi tidak berubah):

```js
function createFieldSurface() {
  const { outfield: outfieldMat, infield: infieldMat, innerGrass: innerGrassMat, base: baseMat } = baseballMaterials();
  const g = new THREE.Group();
```

```js
function createOutfieldFence() {
  const { fence: fenceMat, post: postMat } = baseballMaterials();
  const r = FIELD.outfieldR;
```

```js
function createBackstop() {
  const { net: netMat, post: postMat } = baseballMaterials();
  const g = new THREE.Group();
```

```js
function createDugouts() {
  const { dugout: dugoutMat } = baseballMaterials();
  const g = new THREE.Group();
```

- [ ] **Step 11: `src/world/Ground.roads.js`**

Tambah impor setelah `:5`: `import { currentScope } from '../engine/ResourceScope.js';`. Ganti `:19`:

```js
// sebelum
const dashGeometry = new THREE.BoxGeometry(DASH.length, DASH.thickness, DASH.width);
// sesudah
/** Geometri marka putus-putus bersama (dulu dibuat saat impor), satu per ResourceScope aktif. */
const dashGeometry = () => currentScope().get('roads:dash', () => new THREE.BoxGeometry(DASH.length, DASH.thickness, DASH.width));
```

Pada `:53`, `:63`, `:72`, `:170` ganti `geometry: dashGeometry` menjadi `geometry: dashGeometry()`.

- [ ] **Step 12: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/scopedCaches.test.js`
Expected: PASS (8 tes).

- [ ] **Step 13: Seluruh suite + lint**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js .`
Expected: semua PASS (mis. `decals.test.js`, `surfaceLayers.test.js` tetap lulus di scope global), lint 0 error.

- [ ] **Step 14: Commit**

```bash
git add src/world/materials.js src/world/Ground.materials.js src/world/textures/surfaces.js src/world/textures/decalAtlas.js src/world/siteutil/rounded.js src/world/siteutil/textCanvas.js src/world/Landscape.baseball.js src/world/Ground.roads.js tests/helpers.js tests/scopedCaches.test.js && git commit -m "refactor: cache material/geometri/tekstur dunia dan material saat-impor pindah ke ResourceScope"
```

---

### Task 5: Cache entitas dan model GLB → `ResourceScope`

**Files:**
- Modify: `src/entities/util.js:5,7,15-26`, `src/entities/Humanoid.hair.js:7-11,80,87-96`, `src/entities/Humanoid.face.js:7-9,18,63-77,79-84`, `src/entities/Humanoid.lod.js:8-9,17-18,57`, `src/world/assets/models.js:1-27`
- Modify: `tests/scopedCaches.test.js` (tambah describe)

- [ ] **Step 1: Tambah tes gagal di akhir `tests/scopedCaches.test.js`**

Tambahkan impor di atas berkas:

```js
import * as THREE from 'three';
import { matFor } from '../src/entities/util.js';
import { hairGeometry, HAIR_STYLES } from '../src/entities/Humanoid.hair.js';
import { faceGeometry, createFace } from '../src/entities/Humanoid.face.js';
import { buildStaticLodMesh } from '../src/entities/Humanoid.lod.js';
import { loadModel, modelUrl } from '../src/world/assets/models.js';
```

dan di akhir berkas:

```js
const lodMaterial = () => {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial()));
  group.add(body);
  return buildStaticLodMesh(group, body).material;
};

describe('cache entitas memakai ResourceScope aktif', () => {
  it.each([
    ['matFor', () => matFor(0x123456)],
    ['hairGeometry', () => hairGeometry(HAIR_STYLES[0])],
    ['faceGeometry', () => faceGeometry({ glasses: true })],
    ['material wajah', () => createFace().material],
    ['material LOD', lodMaterial],
  ])('%s: sama dalam satu scope, baru di scope lain, dimiliki scope', (_name, make) => {
    const { a, first, again, other } = inTwoScopes(make);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(a.owns(first)).toBe(true);
  });
});

describe('model GLB memakai ResourceScope aktif', () => {
  it('entri ada selama memuat dan dilupakan bila gagal (boleh dicoba ulang)', async () => {
    const scope = createResourceScope('uji');
    const path = 'models/tidak-ada.glb';
    const pending = withScope(scope, () => loadModel(path));
    expect(scope.has(`models:${modelUrl(path)}`)).toBe(true);
    await expect(pending).rejects.toBeTruthy();
    await Promise.resolve();
    expect(scope.size).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/scopedCaches.test.js`
Expected: FAIL pada describe baru (`a.owns(...)` false; `scope.has(...)` false).

- [ ] **Step 3: `src/entities/util.js`**

Tambah setelah `:5`: `import { currentScope } from '../engine/ResourceScope.js';`. Hapus `:7`. Ganti `:15-26`:

```js
// sebelum
export function matFor(color, extra = {}) {
  const key = `${color}|${extra.emissive ?? 0}|${extra.side ?? 0}`;
  const hit = materialCache.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshLambertMaterial({
    color,
    emissive: extra.emissive ?? 0x000000,
    side: extra.side ?? THREE.FrontSide,
  });
  materialCache.set(key, mat);
  return mat;
}
// sesudah
export function matFor(color, extra = {}) {
  const key = `${color}|${extra.emissive ?? 0}|${extra.side ?? 0}`;
  return currentScope().get(`entities:mat:${key}`, () => new THREE.MeshLambertMaterial({
    color,
    emissive: extra.emissive ?? 0x000000,
    side: extra.side ?? THREE.FrontSide,
  }));
}
```

Ubah juga JSDoc berkas `:2-3` menjadi `Utilitas bersama untuk modul entitas: material per ResourceScope, RNG deterministik, dan helper matematika kecil.`

- [ ] **Step 4: `src/entities/Humanoid.hair.js`**

Tambah setelah `:11`: `import { currentScope } from '../engine/ResourceScope.js';`. Hapus `:80` (`const cache = new Map();`). Ganti `:87-96`:

```js
// sebelum
/** Geometri gabungan untuk satu gaya; dibuat sekali lalu di-cache. */
export function hairGeometry(style) {
  const key = BUILDERS[style] ? style : 'helmet';
  const hit = cache.get(key);
  if (hit) return hit;
  const pieces = BUILDERS[key]().map(unindexed);
  const merged = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  cache.set(key, merged);
  return merged;
}
// sesudah
/** Geometri gabungan untuk satu gaya; dibuat sekali per ResourceScope aktif. */
export function hairGeometry(style) {
  const key = BUILDERS[style] ? style : 'helmet';
  return currentScope().get(`humanoid:hair:${key}`, () => {
    const pieces = BUILDERS[key]().map(unindexed);
    return pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  });
}
```

- [ ] **Step 5: `src/entities/Humanoid.face.js`**

Tambah setelah `:9`: `import { currentScope } from '../engine/ResourceScope.js';`. Ganti `:18`:

```js
// sebelum
export const FACE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
// sesudah
/** Material wajah bersama (warna dari atribut vertex), satu per ResourceScope aktif. */
export function faceMaterial() {
  return currentScope().get('humanoid:faceMaterial', () => new THREE.MeshLambertMaterial({ vertexColors: true }));
}
```

Ganti `:63-77`:

```js
// sebelum
const variants = new Map();

/** Geometri wajah untuk kombinasi {glasses, mustache}; dibuat sekali lalu di-cache. */
export function faceGeometry({ glasses: hasGlasses = false, mustache: hasMustache = false } = {}) {
  const key = `${hasGlasses ? 'g' : '-'}${hasMustache ? 'm' : '-'}`;
  const hit = variants.get(key);
  if (hit) return hit;
  const pieces = [...eyes(), ...cheeks()];
  if (hasGlasses) pieces.push(...glasses());
  if (hasMustache) pieces.push(...mustache());
  const merged = mergeGeometries(pieces, false);
  variants.set(key, merged);
  return merged;
}
// sesudah
/** Geometri wajah untuk kombinasi {glasses, mustache}; dibuat sekali per ResourceScope aktif. */
export function faceGeometry({ glasses: hasGlasses = false, mustache: hasMustache = false } = {}) {
  const key = `${hasGlasses ? 'g' : '-'}${hasMustache ? 'm' : '-'}`;
  return currentScope().get(`humanoid:face:${key}`, () => {
    const pieces = [...eyes(), ...cheeks()];
    if (hasGlasses) pieces.push(...glasses());
    if (hasMustache) pieces.push(...mustache());
    return mergeGeometries(pieces, false);
  });
}
```

Pada `createFace` (`:80`): `new THREE.Mesh(faceGeometry(opts), FACE_MAT)` menjadi `new THREE.Mesh(faceGeometry(opts), faceMaterial())`.

- [ ] **Step 6: `src/entities/Humanoid.lod.js`**

Tambah setelah `:9`: `import { currentScope } from '../engine/ResourceScope.js';`. Ganti `:17-18`:

```js
// sebelum
/** Material bersama untuk semua mesh LOD (Lambert, warna dari atribut vertex). */
const lodMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
// sesudah
/** Material bersama untuk semua mesh LOD (Lambert, warna dari atribut vertex), satu per ResourceScope aktif. */
const lodMaterial = () => currentScope().get('humanoid:lodMaterial', () => new THREE.MeshLambertMaterial({ vertexColors: true }));
```

`:57`: `mergeGeometries(parts, false), lodMaterial)` menjadi `mergeGeometries(parts, false), lodMaterial())`.

- [ ] **Step 7: `src/world/assets/models.js`**

Ganti `:1-27`:

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { currentScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';

/**
 * Pemuat model GLB hasil Blender. Satu loader; cache per URL di ResourceScope aktif: model yang sama
 * dimuat sekali lalu di-clone (geometri & material dibagikan antar salinan).
 * Path relatif terhadap folder public/, sehingga tetap benar di GitHub Pages.
 */
const loader = new GLTFLoader();

/** URL absolut terhadap base Vite ("/" saat dev, "/<repo>/" di Pages). */
export function modelUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}${path.replace(/^\//, '')}`;
}

/** Muat GLB sekali per scope; kembalikan Promise<THREE.Group> sumber (jangan dimodifikasi). */
export function loadModel(path) {
  const url = modelUrl(path);
  const scope = currentScope();
  const key = `models:${url}`;
  return scope.get(key, () => {
    const pending = loader.loadAsync(url).then((gltf) => prepare(gltf.scene));
    pending.catch(() => scope.forget(key)); // gagal: jangan cache selamanya, izinkan coba lagi
    return pending;
  }, { dispose: disposeModel });
}

/** Lepas sumber model setelah muatannya selesai (muatan gagal diabaikan). */
function disposeModel(pending) {
  pending.then((root) => disposeTree(root)).catch(() => {});
}
```

(sisa berkas mulai `/** Salinan siap pakai dari model ...` tidak berubah.)

- [ ] **Step 8: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/scopedCaches.test.js tests/models.test.js tests/humanoidLod.test.js`
Expected: PASS.

- [ ] **Step 9: Seluruh suite + lint**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js .`
Expected: semua PASS, lint 0 error (tidak ada sisa referensi `FACE_MAT`).

- [ ] **Step 10: Commit**

```bash
git add src/entities/util.js src/entities/Humanoid.hair.js src/entities/Humanoid.face.js src/entities/Humanoid.lod.js src/world/assets/models.js tests/scopedCaches.test.js && git commit -m "refactor: cache entitas (material, rambut, wajah, LOD) dan model GLB pindah ke ResourceScope"
```

---

### Task 6: Kontrak Region + region `stadion`

**Files:**
- Create: `src/geo/regionTransform.js`, `src/shared/polygon.js`, `src/regions/Region.js`, `src/regions/stadion/site.js`, `src/regions/stadion/mask.js`, `src/regions/stadion/lamps.js`, `src/regions/stadion/index.js`, `tests/polygon.test.js`, `tests/regionTransform.test.js`, `tests/region.test.js`
- Move: `src/world/layout.js` → `src/regions/stadion/layout.js`
- Modify: `src/config/constants.js:33-88`, `src/regions/stadion/layout.js:1-5`, `src/world/index.js:2,28,39-83,107-141`, `src/world/TimeOfDay.lights.js:9,31-33,37-44,127-132`, `src/world/TimeOfDay.js:66-72,83`, `src/main.js` (impor, `main`, `loadBlenderModels`), `tests/layoutModels.test.js:3`, `tests/models.test.js:4`

- [ ] **Step 1: Tulis tes gagal `tests/polygon.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { pointInPolygon, convexHull } from '../src/shared/polygon.js';

describe('pointInPolygon', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  it('titik di dalam/luar persegi; input tak valid = di luar', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
    expect(pointInPolygon(Number.NaN, 5, square)).toBe(false);
    expect(pointInPolygon(1, 1, [[0, 0], [1, 1]])).toBe(false);
    expect(pointInPolygon(1, 1, null)).toBe(false);
  });
  it('poligon cekung (bentuk L)', () => {
    const L = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
    expect(pointInPolygon(2, 8, L)).toBe(true);
    expect(pointInPolygon(8, 8, L)).toBe(false);
  });
});

describe('convexHull', () => {
  it('membuang titik dalam, kolinear, dan tak hingga; urutan berlawanan jarum jam', () => {
    expect(convexHull([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [5, 5], [Number.NaN, 1]]))
      .toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
  it('kurang dari 3 titik dikembalikan sebagai salinan', () => {
    const pts = [[1, 2]];
    const hull = convexHull(pts);
    expect(hull).toEqual([[1, 2]]);
    expect(hull[0]).not.toBe(pts[0]);
  });
});
```

- [ ] **Step 2: Tulis tes gagal `tests/regionTransform.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { toLocal, toWorld } from '../src/geo/regionTransform.js';

describe('regionTransform', () => {
  it('placement identitas tidak mengubah koordinat', () => {
    const id = { x: 0, z: 0, yaw: 0 };
    expect(toWorld(id, 3, -4)).toEqual({ x: 3, z: -4 });
    expect(toLocal(id, 3, -4)).toEqual({ x: 3, z: -4 });
  });
  it('toWorld sama dengan transform Object3D (position + rotation.y)', () => {
    const p = { x: 120, z: -40, yaw: 0.7 };
    const obj = new THREE.Object3D();
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = p.yaw;
    obj.updateMatrixWorld(true);
    const v = obj.localToWorld(new THREE.Vector3(10, 0, -25));
    const w = toWorld(p, 10, -25);
    expect(w.x).toBeCloseTo(v.x, 9);
    expect(w.z).toBeCloseTo(v.z, 9);
  });
  it('toLocal kebalikan toWorld', () => {
    const p = { x: -500, z: 12000, yaw: -2.1 };
    const w = toWorld(p, 33.5, -71.25);
    const l = toLocal(p, w.x, w.z);
    expect(l.x).toBeCloseTo(33.5, 9);
    expect(l.z).toBeCloseTo(-71.25, 9);
  });
  it('placement tidak lengkap melempar', () => {
    expect(() => toLocal({ x: 0, z: 0 }, 1, 1)).toThrow(TypeError);
    expect(() => toWorld(null, 1, 1)).toThrow(TypeError);
  });
});
```

- [ ] **Step 3: Tulis tes gagal `tests/region.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { defineRegion, validateBuild, regionContains } from '../src/regions/Region.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { STADION_MASK, createStadionMask } from '../src/regions/stadion/mask.js';
import { litLampPositions } from '../src/regions/stadion/lamps.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { SITE } from '../src/regions/stadion/site.js';
import { SITE as SITE_COMPAT } from '../src/config/constants.js';
import { buildWorld } from '../src/world/index.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';

const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const spec = (over = {}) => ({ id: 'uji', placement: { x: 0, z: 0, yaw: 0 }, mask: square, build: async () => ({}), ...over });

describe('kontrak Region', () => {
  it('defineRegion memvalidasi id, placement, mask, build', () => {
    expect(defineRegion(spec()).id).toBe('uji');
    expect(() => defineRegion(spec({ id: '' }))).toThrow(/id/);
    expect(() => defineRegion(spec({ placement: { x: 0, z: 0 } }))).toThrow(/placement/);
    expect(() => defineRegion(spec({ mask: [[0, 0], [1, 1]] }))).toThrow(/mask/);
    expect(() => defineRegion(spec({ build: null }))).toThrow(/build/);
  });
  it('validateBuild menyebut semua bagian yang hilang', () => {
    expect(() => validateBuild({}, 'uji')).toThrow(/group, colliders, minimapLayer, systems, dispose/);
  });
  it('regionContains memakai placement (offset + yaw)', () => {
    const r = defineRegion(spec({ placement: { x: 100, z: 0, yaw: Math.PI / 4 } }));
    expect(regionContains(r, 100, 0)).toBe(true);
    expect(regionContains(r, 0, 0)).toBe(false);
  });
});

describe('region stadion: data', () => {
  it('SITE dari site.js sama dengan re-export lama di config/constants.js', () => {
    expect(SITE_COMPAT).toBe(SITE);
  });
  it('mask memuat stadion, plaza, dan parkir; danau & area jauh di luar', () => {
    expect(createStadionMask(SITE)).toEqual(createStadionMask());
    for (const [x, z] of [[0, 0], [0, -180], [0, -330], [190, -330], [240, 0]]) expect(regionContains(stadionRegion, x, z)).toBe(true);
    for (const [x, z] of [[0, -500], [600, 0], [-60, -480]]) expect(regionContains(stadionRegion, x, z)).toBe(false);
    expect(stadionRegion.mask).toBe(STADION_MASK);
    expect(stadionRegion.placement).toEqual({ x: 0, z: 0, yaw: 0 });
  });
  it('PJU menyala: plaza i%7==3 dan jalan lingkar i%9==4 padam', () => {
    const lit = litLampPositions(LAYOUT);
    expect(lit).toHaveLength(LAYOUT.plazaLamps.length - 4 + LAYOUT.ringRoadLamps.length - 5 + LAYOUT.nagaSaktiLamps.length);
    expect(lit).not.toContainEqual({ x: LAYOUT.plazaLamps[3].x, z: LAYOUT.plazaLamps[3].z });
    expect(lit).not.toContainEqual({ x: LAYOUT.ringRoadLamps[4].x, z: LAYOUT.ringRoadLamps[4].z });
  });
  it('buildWorld tanpa layout melempar (layout wajib dari region)', () => {
    expect(() => buildWorld()).toThrow(/layout wajib/);
  });
});

describe('region stadion: build & dispose', () => {
  it('build(ctx) memenuhi kontrak; dispose mengosongkan grup dan scope', async () => {
    const scope = createResourceScope('uji');
    const built = await stadionRegion.build({ scope });
    expect(built.group.children.length).toBeGreaterThan(0);
    expect(built.systems.map((s) => s.id)).toEqual(['stadion.world']);
    expect(typeof built.colliders.isWalkable).toBe('function');
    expect(built.seatSamples.length).toBeGreaterThan(0);
    expect(built.lamps).toEqual(litLampPositions(LAYOUT));
    expect(scope.size).toBeGreaterThan(0);
    built.dispose();
    built.dispose(); // idempoten
    expect(built.group.children).toHaveLength(0);
    expect(scope.size).toBe(0);
    expect(scope.disposed).toBe(true);
  }, 30000);
  it('build tanpa ctx.scope ditolak', async () => {
    await expect(stadionRegion.build({})).rejects.toThrow(/ctx.scope/);
  });
});
```

- [ ] **Step 4: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/polygon.test.js tests/regionTransform.test.js tests/region.test.js`
Expected: FAIL — modul `src/shared/polygon.js`, `src/geo/regionTransform.js`, `src/regions/...` tidak ditemukan.

- [ ] **Step 5: Implementasi `src/shared/polygon.js`**

```js
/**
 * Geometri poligon 2D murni (bidang XZ, titik [x, z]).
 */

/** Ray casting: true bila (x, z) di dalam poligon (cekung boleh). Input tak valid = false. */
export function pointInPolygon(x, z, poly) {
  if (!Array.isArray(poly) || poly.length < 3 || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Hull cembung (Andrew monotone chain), berlawanan jarum jam, tanpa titik kolinear. */
export function convexHull(points) {
  const pts = points
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [p[0], p[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(pts);
  const upper = half([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
```

- [ ] **Step 6: Implementasi `src/geo/regionTransform.js`**

```js
/**
 * Transform region handmade: koordinat region-lokal ↔ frame dunia (ENU, +X timur, −Z utara).
 * placement {x, z, yaw}: yaw = rotasi pada sumbu +Y (sama dengan Object3D.rotation.y).
 */
function assertPlacement(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.yaw)) {
    throw new TypeError('placement {x, z, yaw} harus angka hingga');
  }
}

/** Lokal → dunia. */
export function toWorld(p, lx, lz) {
  assertPlacement(p);
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return { x: p.x + c * lx + s * lz, z: p.z - s * lx + c * lz };
}

/** Dunia → lokal (kebalikan toWorld). */
export function toLocal(p, x, z) {
  assertPlacement(p);
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const dx = x - p.x;
  const dz = z - p.z;
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}
```

- [ ] **Step 7: Implementasi `src/regions/Region.js`**

```js
/**
 * Kontrak region handmade (spec §3.1) + helper validasi.
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../shared/polygon.js';

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
/** @typedef {{scene?:object, renderer?:object, camera?:object, scope:object, store?:object, clock?:object}} RegionContext */

const finite = Number.isFinite;

/**
 * @param {{id:string, placement:Placement, mask:Array<[number, number]>, build:(ctx:RegionContext)=>Promise<RegionBuild>}} spec
 */
export function defineRegion(spec) {
  if (!spec || typeof spec.id !== 'string' || spec.id === '') throw new TypeError('Region: id wajib string');
  const p = spec.placement;
  if (!p || ![p.x, p.z, p.yaw].every(finite)) throw new TypeError(`Region "${spec.id}": placement {x,z,yaw} harus angka hingga`);
  const maskOk = Array.isArray(spec.mask) && spec.mask.length >= 3
    && spec.mask.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1]));
  if (!maskOk) throw new TypeError(`Region "${spec.id}": mask minimal 3 titik [x,z]`);
  if (typeof spec.build !== 'function') throw new TypeError(`Region "${spec.id}": build(ctx) wajib`);
  return Object.freeze({ ...spec, placement: Object.freeze({ x: p.x, z: p.z, yaw: p.yaw }) });
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
```

- [ ] **Step 8: Buat `src/regions/stadion/site.js` dan jadikan `config/constants.js` re-export**

Pindahkan `config/constants.js:33-88` (komentar `// Tribun & cangkang stadion` sampai penutup `SITE`) **apa adanya** ke berkas baru `src/regions/stadion/site.js`, diawali komentar:

```js
/**
 * Data kawasan region "stadion" (region-lokal, meter; origin = pusat lapangan, −Z = utara).
 * Dulu `STADIUM`/`SITE` di config/constants.js; di sana kini hanya re-export kompatibilitas.
 */
```

lalu blok `export const STADIUM = Object.freeze({ ... });` dan `export const SITE = Object.freeze({ ... });` (tanpa perubahan isi). Di `config/constants.js`, ganti `:33-88` dengan:

```js
// Data kawasan stadion dipindah ke region (regions/stadion/site.js). Re-export ini menjaga impor lama
// tetap jalan (utang Fase 0: hapus setelah semua builder menerima `site` lewat parameter).
export { STADIUM, SITE } from '../regions/stadion/site.js';
```

- [ ] **Step 9: Pindahkan layout**

Run: `git mv src/world/layout.js src/regions/stadion/layout.js`

Lalu di `src/regions/stadion/layout.js:1-5`:

```js
// sebelum
/**
 * Tata letak kawasan: posisi props & titik aktivitas (data murni, tanpa THREE).
 * Origin = pusat lapangan; utara = −Z (Jl. Naga Sakti, plaza depan); barat = −X.
 */
import { STADIUM, SITE } from '../config/constants.js';
// sesudah
/**
 * Tata letak region stadion: posisi props & titik aktivitas (data murni, tanpa THREE, region-lokal).
 * Origin = pusat lapangan; utara = −Z (Jl. Naga Sakti, plaza depan); barat = −X.
 */
import { STADIUM, SITE } from './site.js';
```

Perbarui impor tes: `tests/layoutModels.test.js:3` dan `tests/models.test.js:4` menjadi `import { LAYOUT } from '../src/regions/stadion/layout.js';`.

- [ ] **Step 10: Implementasi `src/regions/stadion/mask.js`**

```js
/**
 * Mask region stadion (region-lokal): fitur kota di dalamnya dibuang saat bake (Fase 1).
 * Fallback sampai poligon OSM tersedia (Fase 3): hull cembung elips jalan lingkar + jalur jogging
 * (dengan margin) dan blok parkir mobil & motor.
 */
import { SITE } from './site.js';
import { convexHull } from '../../shared/polygon.js';

const MASK_MARGIN = 8;        // m di luar sumbu jalur jogging
const ELLIPSE_SAMPLES = 48;

const ellipsePoints = (semiX, semiZ, n) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2;
  return [semiX * Math.cos(t), semiZ * Math.sin(t)];
});

const rectCorners = ({ x, z, w, d }) => [
  [x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2],
];

/** @returns {ReadonlyArray<readonly [number, number]>} */
export function createStadionMask(site = SITE) {
  const semiX = site.ringRoadSemiX + site.joggingTrackOffset + MASK_MARGIN;
  const semiZ = site.ringRoadSemiZ + site.joggingTrackOffset + MASK_MARGIN;
  const pts = [...ellipsePoints(semiX, semiZ, ELLIPSE_SAMPLES), ...rectCorners(site.parkingCar), ...rectCorners(site.parkingMoto)];
  return Object.freeze(convexHull(pts).map((p) => Object.freeze(p)));
}

export const STADION_MASK = createStadionMask();
```

- [ ] **Step 11: Pindahkan aturan PJU ke `src/regions/stadion/lamps.js`**

```js
/**
 * PJU yang menyala di region stadion (dipakai TimeOfDay untuk PointLight, kolam cahaya, halo).
 */
// Aturan PJU rusak harus sama dengan world/index.js (plaza i%7==3, jalan lingkar i%9==4).
const PLAZA_BROKEN = (i) => i % 7 === 3;
const RING_BROKEN = (i) => i % 9 === 4;

/** Posisi semua PJU yang berlampu (data murni). */
export function litLampPositions(layout) {
  return [
    ...layout.plazaLamps.filter((_, i) => !PLAZA_BROKEN(i)),
    ...layout.ringRoadLamps.filter((_, i) => !RING_BROKEN(i)),
    ...layout.nagaSaktiLamps,
  ].map((p) => ({ x: p.x, z: p.z }));
}
```

Di `src/world/TimeOfDay.lights.js`: hapus `:9` (`import { LAYOUT } from './layout.js';`), hapus `:31-33` (komentar aturan + `PLAZA_BROKEN`/`RING_BROKEN`), hapus `:37-44` (`litLampPositions`); `const _fwd` di `:35` tetap. Ganti `:127-132`:

```js
// sebelum
/**
 * @returns {{ update(dt, bikePos, bikeYaw): void, setLampsOn(on: boolean): void, get lampsOn }}
 */
export function createNightLights(scene) {
  const emissives = collectEmissiveMaterials(scene);
  const lamps = litLampPositions();
// sesudah
/**
 * @param {THREE.Object3D} scene
 * @param {{lamps?: {x:number, z:number}[]}} [opts] posisi PJU yang menyala (dari region)
 * @returns {{ update(dt, bikePos, bikeYaw): void, setLampsOn(on: boolean): void, get lampsOn }}
 */
export function createNightLights(scene, { lamps = [] } = {}) {
  const emissives = collectEmissiveMaterials(scene);
```

Di `src/world/TimeOfDay.js`: `:66-67` tambahkan baris JSDoc `@param {{lamps?: {x:number, z:number}[]}} [opts] PJU menyala dari region` setelah `@param {THREE.Group} lightingGroup ...`; `:72` menjadi `export function createTimeOfDay(lightingGroup, scene, renderer, app, { lamps = [] } = {}) {`; `:83` menjadi `const night = createNightLights(scene, { lamps });`.

- [ ] **Step 12: `buildWorld({ layout, site })` di `src/world/index.js`**

`:2` menjadi `import { RENDER_LAYERS, STADIUM, SITE } from '../config/constants.js';`. Hapus `:28` (`import { LAYOUT } from './layout.js';`). Ganti `:39-83`:

```js
/**
 * Merakit seluruh dunia statis region stadion. Setiap bagian statis digabung per material
 * (mergeByMaterial) agar jumlah draw call minimal; objek besar diberi layer minimap agar tampil
 * di peta kecil. `layout` WAJIB dari region (regions/stadion/layout.js); `site` default = SITE.
 * @param {{layout: object, site?: object}} opts
 * @returns {{group: THREE.Group, update(dt:number, t:number, focus?:object):void, seatSamples: object[], layout: object}}
 */
export function buildWorld({ layout, site = SITE } = {}) {
  if (!layout) throw new TypeError('buildWorld: layout wajib (diberikan region)');
  const group = new THREE.Group();
  group.name = 'world';
  const updatables = [];
  const add = (obj, { merge = true, minimap = false } = {}) => {
    const out = merge ? mergeByMaterial(obj) : obj;
    if (minimap) enableMinimap(out);
    group.add(out);
    if (out.userData?.update) updatables.push(out.userData.update);
    return out;
  };

  const ground = createGround();
  const lots = collectParkingLots(ground);
  add(ground, { minimap: true });
  add(withMinimapParts(createLandscape(), MINIMAP_LANDSCAPE_PARTS));
  add(createGrass(), { merge: false });
  add(withMinimapParts(createShell(), MINIMAP_SHELL_PARTS));
  add(createFacade());
  const tribune = add(withMinimapParts(createTribune(), MINIMAP_TRIBUNE_PARTS), { merge: false });
  add(createPitch(), { minimap: true });
  add(createTrack(), { minimap: true });
  add(createDecals(), { merge: false }); // dekal permukaan: 1 InstancedMesh, bukan layer minimap
  add(createFixtures());
  add(createSerinditStatue()); // terpisah dari fixtures agar namanya terjaga: model Blender menggantikannya (layout.blenderModels)
  add(createTunnels());
  addStadiumSurroundings(add, layout, site);
  addPlazaFurniture(add, layout);
  addNagaSakti(add, layout);
  addParking(add, lots);

  const seatSamples = sampleSeats(tribune.userData.tiers, layout.spectatorCount);
  return {
    group,
    seatSamples,
    layout,
    update: (dt, t, focus) => updatables.forEach((fn) => fn(dt, t, focus)),
  };
}
```

Ganti `:107-141` (tiga fungsi) — `LAYOUT.` menjadi parameter `layout`, tugu tanjak memakai `site`:

```js
function addStadiumSurroundings(add, layout, site) {
  add(createFlagpoles());
  add(createLancangKuning());
  add(createTanjakMonument({ x: site.tanjakMonument.x, z: site.tanjakMonument.z }));
  add(createGapura({ damaged: true }));
  add(createGuardPosts(layout.guardPosts));
  const signs = new THREE.Group();
  signs.name = 'signage';
  for (const s of layout.roadSigns) signs.add(placed(createRoadSign({ text: s.text, kind: s.kind }), s));
  for (const b of layout.banners) signs.add(placed(createBanner({ text: b.text }), b));
  for (const b of layout.billboards) signs.add(placed(createBillboard({ text: b.text }), b));
  add(signs);
}

function addPlazaFurniture(add, layout) {
  add(createBenches(layout.benches.map((p, i) => ({ ...p, type: i % 3 === 0 ? 'besi' : 'semen' }))));
  add(createTrashBins(layout.trashBins));
  add(createPlanters(layout.planters));
  // Semua tiang PJU dalam satu panggilan agar instanced per varian (bukan per area)
  add(createLampPosts([
    ...layout.plazaLamps.map((p, i) => ({ ...p, broken: i % 7 === 3 })),
    ...layout.ringRoadLamps.map((p, i) => ({ ...p, double: true, broken: i % 9 === 4 })),
    ...layout.nagaSaktiLamps,
  ]));
}

function addNagaSakti(add, layout) {
  for (const seg of layout.nagaSaktiFence) {
    add(createFence({ points: [{ x: seg.from, z: seg.z }, { x: seg.to, z: seg.z }], height: 2 }));
  }
  const stalls = new THREE.Group();
  stalls.name = 'lapakPKL';
  layout.stalls.forEach((p, i) => stalls.add(placed(stallFor(i), p)));
  add(stalls); // semua lapak digabung per material → belasan draw call
}
```

- [ ] **Step 13: Implementasi `src/regions/stadion/index.js`**

```js
/**
 * Region handmade "stadion": kawasan Stadion Utama Riau yang sudah ada, dibungkus kontrak Region
 * (regions/Region.js). Fase 0: placement identitas {0,0,0} — koordinat lama = koordinat dunia.
 */
import { defineRegion, validateBuild } from '../Region.js';
import { withScope } from '../../engine/ResourceScope.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { buildWorld } from '../../world/index.js';
import { isWalkable, isCameraClear } from '../../core/Collider.js';
import { SITE } from './site.js';
import { LAYOUT } from './layout.js';
import { STADION_MASK } from './mask.js';
import { litLampPositions } from './lamps.js';

export const STADION_ID = 'stadion';

/** Fase 0 hanya memakai ctx.scope (ResourceScope milik region). */
function buildStadion({ scope }) {
  if (!scope) throw new TypeError('Region stadion: ctx.scope (ResourceScope) wajib');
  const world = withScope(scope, () => buildWorld({ layout: LAYOUT, site: SITE }));
  let disposed = false;
  return validateBuild({
    group: world.group,
    colliders: { isWalkable, isCameraClear },
    minimapLayer: () => {}, // Fase 0: peta dasar masih di-bake App.bakeMinimap dari layer minimap (Fase 2: layer region)
    systems: [{ id: 'stadion.world', phase: 'world', update: (dt, ctx) => world.update(dt, ctx.time, ctx.focus), dispose() {} }],
    seatSamples: world.seatSamples,
    layout: LAYOUT,
    lamps: litLampPositions(LAYOUT),
    dispose() {
      if (disposed) return;
      disposed = true;
      world.group.removeFromParent();
      disposeTree(world.group, { scope });
      scope.dispose();
    },
  }, STADION_ID);
}

export const stadionRegion = defineRegion({
  id: STADION_ID,
  placement: { x: 0, z: 0, yaw: 0 },
  mask: STADION_MASK,
  build: async (ctx) => buildStadion(ctx ?? {}),
});
```

- [ ] **Step 14: Jalankan tes baru, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/polygon.test.js tests/regionTransform.test.js tests/region.test.js`
Expected: PASS (15 tes; tes build ±1–3 s).

- [ ] **Step 15: Pakai region di `src/main.js`**

Impor: hapus `import { buildWorld } from './world/index.js';` dan `import { LAYOUT } from './world/layout.js';`; tambahkan setelah `import { StoryJournal } from './ui/StoryJournal.js';`:

```js
import { createResourceScope } from './engine/ResourceScope.js';
import { stadionRegion } from './regions/stadion/index.js';
```

Di `main()`:

```js
// sebelum
  const world = buildWorld();
  app.scene.add(world.group);
  freezeStatic(world.group); // dunia statis: matriks dihitung sekali, tidak per frame
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  const modelsReady = loadBlenderModels(blenderModels, world.group, hud);
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  app.addSystem({ id: 'world', phase: 'world', update: (dt, ctx) => world.update(dt, ctx.time, ctx.focus) });
// sesudah
  const region = await stadionRegion.build({
    scene: app.scene, renderer: app.renderer, camera: app.camera, scope: createResourceScope('region:stadion'), store, clock: app.timer,
  });
  app.scene.add(region.group);
  freezeStatic(region.group); // dunia statis: matriks dihitung sekali, tidak per frame
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  const modelsReady = loadBlenderModels(blenderModels, region, hud);
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  region.systems.forEach((s) => app.addSystem(s));
```

```js
// sebelum
  const ents = buildEntities({ start: START_POS, world, wallet, camera: app.camera });
// sesudah
  const ents = buildEntities({ start: START_POS, world: region, wallet, camera: app.camera });
```

```js
// sebelum
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app);
// sesudah
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app, { lamps: region.lamps });
```

Ganti fungsi `loadBlenderModels`:

```js
/**
 * Muat model GLB hasil Blender (region.layout.blenderModels) tanpa menahan start aplikasi.
 * Model yang gagal dimuat hanya dilewati; dunia prosedural tetap lengkap.
 */
async function loadBlenderModels(group, region, hud) {
  const { failed } = await placeModels(group, region.layout.blenderModels ?? [], { world: region.group });
  if (failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false);
}
```

- [ ] **Step 16: Seluruh suite, lint, build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build`
Expected: semua PASS, lint 0 error, build sukses.

- [ ] **Step 17: Commit**

```bash
git add src/geo/regionTransform.js src/shared/polygon.js src/regions/Region.js src/regions/stadion/site.js src/regions/stadion/layout.js src/regions/stadion/mask.js src/regions/stadion/lamps.js src/regions/stadion/index.js src/world/layout.js src/config/constants.js src/world/index.js src/world/TimeOfDay.lights.js src/world/TimeOfDay.js src/main.js tests/polygon.test.js tests/regionTransform.test.js tests/region.test.js tests/layoutModels.test.js tests/models.test.js && git commit -m "feat: kontrak Region dan region stadion (site, layout, mask, build/dispose) dengan buildWorld berparameter"
```

---

### Task 7: Collider region-lokal + collider komposit (core tanpa `world/stadium/*`)

**Files:**
- Create: `src/world/stadium/gateCorridor.js`, `src/regions/stadion/collider.js`, `tests/compositeCollider.test.js`
- Modify (tulis ulang): `src/core/Collider.js`
- Modify: `src/world/index.js:28`, `src/world/Decals.layout.js:14`, `src/regions/stadion/index.js` (impor collider), `src/main.js` (impor, `main`), `src/app/devtools.js`, `tests/collider.test.js:2,18`, `tests/cameraClear.test.js:2`, `tests/decals.test.js:6`

- [ ] **Step 1: Tulis tes gagal `tests/compositeCollider.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createCollider, createCompositeCollider, localized } from '../src/core/Collider.js';
import { stadionColliders, createStadionColliders } from '../src/regions/stadion/collider.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { defineRegion } from '../src/regions/Region.js';

const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];

describe('collider komposit', () => {
  it('titik di dalam mask region → collider region dengan koordinat lokal; di luar → fallback', () => {
    const calls = [];
    const region = defineRegion({ id: 'uji', placement: { x: 100, z: 0, yaw: Math.PI / 2 }, mask: square, build: async () => ({}) });
    const colliders = {
      isWalkable: (lx, lz) => { calls.push([lx, lz]); return false; },
      isCameraClear: () => false,
    };
    const comp = createCompositeCollider({ regions: [{ region, colliders }], fallback: { isWalkable: () => true, isCameraClear: () => true } });
    expect(comp.isWalkable(100, -5)).toBe(false);
    expect(calls[0][0]).toBeCloseTo(5, 9);
    expect(calls[0][1]).toBeCloseTo(0, 9);
    expect(comp.isCameraClear(100, 3)).toBe(false);
    expect(comp.isWalkable(200, 0)).toBe(true);
    expect(comp.isCameraClear(200, 0)).toBe(true);
  });

  it('tanpa fallback: di luar semua region terbuka; koordinat tak hingga selalu terhalang', () => {
    const comp = createCompositeCollider();
    expect(comp.isWalkable(5, 5)).toBe(true);
    expect(comp.isWalkable(Number.NaN, 0)).toBe(false);
    expect(comp.isCameraClear(0, undefined)).toBe(false);
  });

  it('localized mengubah koordinat dunia ke lokal region', () => {
    const region = defineRegion({ id: 'geser', placement: { x: 50, z: -20, yaw: 0 }, mask: square, build: async () => ({}) });
    const seen = [];
    const loc = localized(region, { isWalkable: (x, z) => { seen.push([x, z]); return true; }, isCameraClear: () => true });
    loc.isWalkable(55, -18);
    expect(seen).toEqual([[5, 2]]);
    expect(loc.isCameraClear(0, 0)).toBe(true);
  });

  it('paritas: komposit stadion (placement identitas) = collider region di seluruh grid dunia', () => {
    const comp = createCompositeCollider({
      regions: [{ region: stadionRegion, colliders: stadionColliders }],
      fallback: localized(stadionRegion, stadionColliders),
    });
    const mismatch = [];
    for (let x = -700; x <= 700; x += 23) {
      for (let z = -700; z <= 700; z += 23) {
        if (comp.isWalkable(x, z) !== stadionColliders.isWalkable(x, z)) mismatch.push(['walk', x, z]);
        if (comp.isCameraClear(x, z) !== stadionColliders.isCameraClear(x, z)) mismatch.push(['cam', x, z]);
      }
    }
    expect(mismatch).toEqual([]);
  });
});

describe('createCollider & collider stadion', () => {
  it('createCollider wajib diberi isWalkable', () => {
    expect(() => createCollider({ x: 0, z: 0 })).toThrow(TypeError);
  });
  it('createStadionColliders dapat diinjeksi data site/stadium', () => {
    const c = createStadionColliders();
    expect(c.isWalkable(0, 0)).toBe(true);
    expect(c.obstacles.map((o) => o.name)).toEqual(['tuguLancangKuning', 'tuguTanjak']);
  });
});
```

- [ ] **Step 2: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/compositeCollider.test.js`
Expected: FAIL — `src/regions/stadion/collider.js` tidak ditemukan / `createCompositeCollider` bukan fungsi.

- [ ] **Step 3: Buat `src/world/stadium/gateCorridor.js`** (pindahan `core/Collider.js:2-3,5-7,19-45`)

```js
/**
 * Koridor gate utama stadion sebagai segmen garis region-lokal (dari luar cangkang ke apron lintasan).
 * Dipakai collider region, penempatan penonton, dan dekal. Dulu di core/Collider.js.
 */
import { GATES } from './gateLayout.js';
import { framePoint } from './ovalFrame.js';

export const GATE_HALF_WIDTH = 4.6;   // sedikit lebih sempit dari terowongan 10 m
const CORRIDOR_K_START = -0.08;
const CORRIDOR_K_END = 1.25;

const CORRIDORS = GATES.filter((g) => g.main).map((g) => {
  const a = framePoint(g.u, CORRIDOR_K_START, 0);
  const b = framePoint(g.u, CORRIDOR_K_END, 0);
  return { ax: a.x, az: a.z, bx: b.x, bz: b.z };
});

/** Jarak titik ke segmen garis (2D). */
function distToSegment(px, pz, s) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / len2));
  return Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t));
}

/** Jarak terdekat titik ke garis tengah koridor gate utama. */
export function distanceToGateCorridor(x, z) {
  return Math.min(...CORRIDORS.map((s) => distToSegment(x, z, s)));
}

export function inGateCorridor(x, z) {
  return distanceToGateCorridor(x, z) < GATE_HALF_WIDTH;
}
```

- [ ] **Step 4: Buat `src/regions/stadion/collider.js`** (logika `core/Collider.js:8-17,26-27,47-57,73-85`, region-lokal)

```js
/**
 * Collider region stadion (koordinat region-lokal): mangkuk & cangkang stadion, koridor gate utama,
 * tugu padat, danau, dan batas tanah region. Data dari site.js (dapat diinjeksi untuk tes).
 */
import { SITE, STADIUM } from './site.js';
import { distanceToGateCorridor, inGateCorridor, GATE_HALF_WIDTH } from '../../world/stadium/gateCorridor.js';

const GROUND_MARGIN = 20;
const LAKE_RADIUS = 70;
const BIKE_CLEARANCE = 0.6;
const CAMERA_CLEARANCE = 0.8;  // kamera butuh jarak lebih lega dari dinding daripada sepeda
const TUGU_POOL_R = 8.0;
const TANJAK_R = 1.6;

/** Radius ternormalisasi terhadap elips (1 = tepat di tepi). */
const ellipseRadius = (x, z, a, b) => Math.sqrt((x / a) ** 2 + (z / b) ** 2);

/**
 * @param {{site?: object, stadium?: object}} [data]
 * @returns {{obstacles: ReadonlyArray<{name:string,x:number,z:number,r:number}>,
 *   isWalkable(lx:number, lz:number):boolean, isCameraClear(lx:number, lz:number):boolean}}
 */
export function createStadionColliders({ site = SITE, stadium = STADIUM } = {}) {
  const limit = site.groundSize / 2 - GROUND_MARGIN;
  /** Rintangan lingkaran padat di plaza/kawasan: kolam tugu Lancang Kuning & tugu tanjak. */
  const obstacles = Object.freeze([
    Object.freeze({ name: 'tuguLancangKuning', x: 0, z: -(stadium.outerSemiZ + 45), r: TUGU_POOL_R + BIKE_CLEARANCE }),
    Object.freeze({ name: 'tuguTanjak', x: site.tanjakMonument.x, z: site.tanjakMonument.z, r: TANJAK_R + BIKE_CLEARANCE }),
  ]);
  const inLake = (x, z) => Math.hypot(x - site.lakeCenter.x, z - site.lakeCenter.z) < LAKE_RADIUS;
  const hitsObstacle = (x, z, pad) => obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);
  const outsideWalls = (x, z, innerPad, outerPad) => (
    ellipseRadius(x, z, stadium.innerSemiX - innerPad, stadium.innerSemiZ - innerPad) < 1
    || ellipseRadius(x, z, stadium.outerSemiX + outerPad, stadium.outerSemiZ + outerPad) > 1
  );

  /** Posisi valid: di dalam mangkuk, di luar cangkang, atau di koridor gate; tidak di danau; dalam batas tanah. */
  function isWalkable(lx, lz) {
    if (Math.abs(lx) > limit || Math.abs(lz) > limit) return false;
    if (inLake(lx, lz)) return false;
    if (hitsObstacle(lx, lz, 0)) return false;
    if (inGateCorridor(lx, lz)) return true;
    return outsideWalls(lx, lz, 2, 1.5);
  }

  /** Bebas untuk KAMERA: di luar dinding tribun/cangkang (kecuali koridor gate) dan rintangan padat. */
  function isCameraClear(lx, lz) {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return false;
    if (hitsObstacle(lx, lz, CAMERA_CLEARANCE - BIKE_CLEARANCE)) return false;
    if (distanceToGateCorridor(lx, lz) < GATE_HALF_WIDTH - 0.6) return true;
    return outsideWalls(lx, lz, 1, 3);
  }

  return Object.freeze({ obstacles, isWalkable, isCameraClear });
}

export const stadionColliders = createStadionColliders();
export const OBSTACLES = stadionColliders.obstacles;
export const { isWalkable, isCameraClear } = stadionColliders;
```

- [ ] **Step 5: Tulis ulang `src/core/Collider.js`**

```js
/**
 * Collider komposit (menggantikan fungsi global lama): titik dunia → region yang mask-nya memuat
 * titik itu (koordinat diubah ke lokal region) → collider region; selain itu → `fallback`
 * (Fase 2: TileCollider). Tidak mengimpor world/stadium/*: geometri stadion datang dari region.
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../shared/polygon.js';

const OPEN = Object.freeze({ isWalkable: () => true, isCameraClear: () => true });

/** Bungkus collider region-lokal agar menerima koordinat dunia (dipakai sebagai fallback). */
export function localized(region, colliders) {
  return Object.freeze({
    isWalkable(x, z) {
      const l = toLocal(region.placement, x, z);
      return colliders.isWalkable(l.x, l.z);
    },
    isCameraClear(x, z) {
      const l = toLocal(region.placement, x, z);
      return colliders.isCameraClear(l.x, l.z);
    },
  });
}

/**
 * @param {{regions?: Array<{region:{placement:object, mask:Array<[number,number]>}, colliders:object}>,
 *   fallback?: {isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}} [opts]
 * @returns {{isWalkable(x:number, z:number):boolean, isCameraClear(x:number, z:number):boolean}}
 */
export function createCompositeCollider({ regions = [], fallback = OPEN } = {}) {
  const list = regions.map(({ region, colliders }) => Object.freeze({ region, colliders }));
  const route = (x, z, method) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    for (const { region, colliders } of list) {
      const l = toLocal(region.placement, x, z);
      if (pointInPolygon(l.x, l.z, region.mask)) return colliders[method](l.x, l.z);
    }
    return fallback[method](x, z);
  };
  return Object.freeze({
    isWalkable: (x, z) => route(x, z, 'isWalkable'),
    isCameraClear: (x, z) => route(x, z, 'isCameraClear'),
  });
}

/**
 * Collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
 * Mencoba meluncur (slide) di sumbu X atau Z agar tidak "lengket".
 * @param {{x:number, z:number}} start
 * @param {(x:number, z:number) => boolean} isWalkable
 */
export function createCollider(start = { x: 0, z: 0 }, isWalkable) {
  if (typeof isWalkable !== 'function') throw new TypeError('createCollider: isWalkable(x, z) wajib');
  let last = { x: start.x, z: start.z };
  return (x, z) => {
    if (isWalkable(x, z)) return (last = { x, z });
    if (isWalkable(x, last.z)) return (last = { x, z: last.z });
    if (isWalkable(last.x, z)) return (last = { x: last.x, z });
    return { ...last };
  };
}
```

- [ ] **Step 6: Perbarui pemakai**

- `src/world/index.js:28` (baris `:29` lama, bergeser setelah impor layout dihapus di Task 6): `import { distanceToGateCorridor } from '../core/Collider.js';` → `import { distanceToGateCorridor } from './stadium/gateCorridor.js';`
- `src/world/Decals.layout.js:14`: sama, menjadi `import { distanceToGateCorridor } from './stadium/gateCorridor.js';`
- `src/regions/stadion/index.js`: `import { isWalkable, isCameraClear } from '../../core/Collider.js';` → `import { stadionColliders } from './collider.js';` dan `colliders: { isWalkable, isCameraClear },` → `colliders: stadionColliders,`
- `tests/decals.test.js:6`: `import { distanceToGateCorridor } from '../src/world/stadium/gateCorridor.js';`
- `tests/cameraClear.test.js:2`: `import { isCameraClear, OBSTACLES } from '../src/regions/stadion/collider.js';`
- `tests/collider.test.js:2` menjadi dua baris:

```js
import { createCollider } from '../src/core/Collider.js';
import { isWalkable, OBSTACLES } from '../src/regions/stadion/collider.js';
```

dan `:18` `const collide = createCollider(start);` → `const collide = createCollider(start, isWalkable);` (asersi tidak berubah).

- `src/app/devtools.js`: signature `exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders })` dan `ents.bike.setCollider(createCollider({ x, z }));` → `ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable));`
- `src/main.js`: `import { createCollider, isCameraClear } from './core/Collider.js';` → `import { createCollider, createCompositeCollider, localized } from './core/Collider.js';`. Hapus baris `rig.setObstacleTest(isCameraClear);` di awal `main()`, lalu setelah `freezeStatic(region.group); ...` sisipkan:

```js
  const colliders = createCompositeCollider({
    regions: [{ region: stadionRegion, colliders: region.colliders }],
    fallback: localized(stadionRegion, region.colliders), // Fase 0: tanah region (1,4 km) masih menutup seluruh dunia; Fase 2: TileCollider
  });
  rig.setObstacleTest(colliders.isCameraClear);
```

`ents.bike.setCollider(createCollider(START_POS));` → `ents.bike.setCollider(createCollider(START_POS, colliders.isWalkable));`, dan panggilan `exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story })` → `exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders })`. (Pengujian rintangan kamera baru dipasang sebelum `app.start`, jadi tidak ada frame tanpa tabrakan.)

- [ ] **Step 7: Jalankan tes collider, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/compositeCollider.test.js tests/collider.test.js tests/cameraClear.test.js tests/decals.test.js`
Expected: PASS (asersi lama `collider`/`cameraClear`/`decals` lulus tanpa diubah).

- [ ] **Step 8: Seluruh suite, lint, build; pastikan core bebas `world/stadium`**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build && grep -rn "world/stadium" src/core || echo "core bersih"`
Expected: semua PASS, build sukses, keluaran terakhir `core bersih`.

- [ ] **Step 9: Commit**

```bash
git add src/world/stadium/gateCorridor.js src/regions/stadion/collider.js src/core/Collider.js src/world/index.js src/world/Decals.layout.js src/regions/stadion/index.js src/main.js src/app/devtools.js tests/compositeCollider.test.js tests/collider.test.js tests/cameraClear.test.js tests/decals.test.js && git commit -m "refactor: collider region-lokal stadion dan collider komposit; core tidak lagi mengimpor world/stadium"
```

---

### Task 8: Registry emissive/basah; TimeOfDay & Weather menempel ke grup sendiri

**Files:**
- Create: `src/engine/materialRegistry.js`, `tests/materialRegistry.test.js`, `tests/nightRegistry.test.js`
- Modify: `src/world/TimeOfDay.lights.js:7-10,34-48,50-65,84-113,115-178` (nomor setelah Task 6), `src/world/NightHalos.js:15-21,74-89`, `src/world/TimeOfDay.js:66-73,80-84,155` (nomor setelah Task 6), `src/world/Weather.rain.js:146,152`, `src/world/Weather.wet.js:6-7,26-41,121-144`, `src/world/Weather.js:80-84,109-112`, `src/main.js` (`main`)

- [ ] **Step 1: Tulis tes gagal `tests/materialRegistry.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMaterialRegistry } from '../src/engine/materialRegistry.js';

const meshWith = (mat, name = '') => Object.assign(new THREE.Mesh(new THREE.BoxGeometry(), mat), { name });
const groupOf = (...children) => {
  const g = new THREE.Group();
  g.add(...children);
  return g;
};
const red = () => new THREE.MeshBasicMaterial({ color: 0xff0000 });
const selectRed = (mat) => (mat.color?.getHex() === 0xff0000 ? { mat } : null);

describe('createMaterialRegistry', () => {
  it('mendaftarkan material terpilih sekali per uuid; material array dilewati', () => {
    const r = red();
    const blue = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const reg = createMaterialRegistry(selectRed);
    reg.register(groupOf(meshWith(r), meshWith(r), meshWith(blue), meshWith([r, blue])));
    expect(reg.size).toBe(1);
    expect(reg.entries.map((e) => e.mat)).toEqual([r]);
    reg.clear();
    expect(reg.size).toBe(0);
  });

  it('material bersama dua root: onRemove hanya saat root terakhir dilepas', () => {
    const r = red();
    const removed = [];
    const reg = createMaterialRegistry(selectRed, { onRemove: (e) => removed.push(e.mat) });
    const a = groupOf(meshWith(r));
    const b = groupOf(meshWith(r));
    const offA = reg.register(a);
    reg.register(b);
    expect(offA()).toBe(true);
    expect(reg.size).toBe(1);
    expect(removed).toEqual([]);
    expect(reg.unregister(b)).toBe(true);
    expect(reg.size).toBe(0);
    expect(removed).toEqual([r]);
    expect(reg.unregister(b)).toBe(false);
  });

  it('register root yang sama dua kali idempoten; clear memanggil onRemove sekali', () => {
    const removed = [];
    const reg = createMaterialRegistry(selectRed, { onRemove: (e) => removed.push(e) });
    const root = groupOf(meshWith(red()));
    reg.register(root);
    reg.register(root);
    expect(reg.size).toBe(1);
    reg.clear();
    expect(removed).toHaveLength(1);
  });

  it('select menerima objek pemilik (mis. filter nama mesh)', () => {
    const mat = new THREE.MeshBasicMaterial();
    const reg = createMaterialRegistry((m, o) => (o.name === 'aspal' ? { m } : null));
    reg.register(groupOf(meshWith(mat, 'lain')));
    expect(reg.size).toBe(0);
    reg.register(groupOf(meshWith(mat, 'aspal')));
    expect(reg.size).toBe(1);
  });

  it('select dan root tidak valid melempar', () => {
    expect(() => createMaterialRegistry(null)).toThrow(TypeError);
    expect(() => createMaterialRegistry(selectRed).register({})).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Tulis tes gagal `tests/nightRegistry.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNightLights } from '../src/world/TimeOfDay.lights.js';
import { createWetSurfaces } from '../src/world/Weather.wet.js';
import { WEATHER } from '../src/config/constants.js';

const rootWith = (mat, name = 'objek') => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(), mat);
  m.name = name;
  g.add(m);
  return g;
};
const runFrames = (night, n) => { for (let i = 0; i < n; i += 1) night.update(0.1, { x: 0, z: 0 }, 0); };

describe('lampu malam: grup pemilik & registry emissive', () => {
  it('objek lampu menempel ke grup pemilik, bukan scene', () => {
    const parent = new THREE.Group();
    createNightLights(parent, { lamps: [{ x: 0, z: 0 }] });
    expect(parent.getObjectByName('lampuSepeda')).toBeTruthy();
    expect(parent.getObjectByName('kolamCahayaPJU')).toBeTruthy();
    expect(parent.getObjectByName('floodlightSorot-0')).toBeTruthy();
  });

  it('material yang didaftarkan belakangan (mis. GLB) ikut menyala; unregister memulihkan nilai siang', () => {
    const night = createNightLights(new THREE.Group(), { lamps: [] });
    const glow = new THREE.MeshStandardMaterial({ emissive: 0xffaa00, emissiveIntensity: 0.5 });
    const tagged = new THREE.MeshStandardMaterial({ emissive: 0x8fa6ff, emissiveIntensity: 0 });
    tagged.userData.nightEmissive = { on: 0.3, off: 0 };
    const root = new THREE.Group();
    root.add(rootWith(glow), rootWith(tagged));
    night.setLampsOn(true);
    runFrames(night, 5);
    expect(glow.emissiveIntensity).toBe(0.5);
    night.registerEmissive(root);
    expect(night.emissiveCount).toBe(2);
    runFrames(night, 200);
    expect(glow.emissiveIntensity).toBeCloseTo(0.9, 5); // 0,5 × boost 1,8
    expect(tagged.emissiveIntensity).toBeCloseTo(0.3, 5);
    night.unregisterEmissive(root);
    expect(glow.emissiveIntensity).toBe(0.5);
    expect(tagged.emissiveIntensity).toBe(0);
    expect(night.emissiveCount).toBe(0);
  });
});

describe('permukaan basah: grup pemilik & registry', () => {
  it('genangan menempel ke grup pemilik; hanya mesh bernama permukaan basah yang terdaftar', () => {
    const parent = new THREE.Group();
    const wet = createWetSurfaces(parent);
    expect(parent.getObjectByName('genangan')).toBe(wet.group);
    const road = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const other = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const root = new THREE.Group();
    root.add(rootWith(road, 'aspal+3'), rootWith(other, 'atapSeng'));
    wet.register(root);
    expect(wet.count).toBe(1);
    wet.update(0.1, 1);
    expect(road.roughness).toBeCloseTo(WEATHER.wetRoughness, 6);
    expect(road.color.r).toBeCloseTo(WEATHER.wetDarken, 6);
    expect(other.roughness).toBe(0.9);
    wet.unregister(root);
    expect(road.roughness).toBeCloseTo(0.9, 6);
    expect(road.color.r).toBeCloseTo(1, 6);
  });

  it('material yang didaftarkan saat hujan sudah berjalan ikut basah pada frame berikutnya', () => {
    const wet = createWetSurfaces(new THREE.Group());
    wet.update(0.1, 0.5);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    wet.register(rootWith(mat, 'rumput'));
    wet.update(0.1, 0.5);
    expect(mat.roughness).toBeCloseTo(0.9 + (WEATHER.wetRoughness - 0.9) * 0.5, 6);
  });
});
```

- [ ] **Step 3: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/materialRegistry.test.js tests/nightRegistry.test.js`
Expected: FAIL — `materialRegistry.js` tidak ditemukan; `night.registerEmissive is not a function`; `wet.register is not a function`.

- [ ] **Step 4: Implementasi `src/engine/materialRegistry.js`**

```js
/**
 * Registry material per root: sistem global (TimeOfDay, Weather) mendaftarkan objek yang datang kapan
 * pun (region, entitas, GLB, tile) alih-alih scene.traverse sekali saat konstruksi, dan melepasnya saat
 * root di-dispose. `select(material, object)` → entri atau null bila material tidak relevan. Material
 * dicatat sekali (per uuid) walau dimiliki beberapa root; `onRemove(entry)` dipanggil saat root
 * terakhir pemiliknya dilepas (memulihkan nilai asli). Lapisan engine: tanpa impor three.
 */
export function createMaterialRegistry(select, { onRemove = () => {} } = {}) {
  if (typeof select !== 'function') throw new TypeError('createMaterialRegistry: select harus fungsi');
  const records = new Map(); // uuid -> { entry, owners: Set<root> }
  const roots = new Map();   // root -> Set<uuid>
  let list = [];
  const refresh = () => { list = [...records.values()].map((r) => r.entry); };

  const unregister = (root) => {
    const uuids = roots.get(root);
    if (!uuids) return false;
    roots.delete(root);
    for (const uuid of uuids) {
      const rec = records.get(uuid);
      rec.owners.delete(root);
      if (rec.owners.size === 0) {
        records.delete(uuid);
        onRemove(rec.entry);
      }
    }
    refresh();
    return true;
  };

  return {
    /** @returns {() => boolean} fungsi unregister untuk root ini */
    register(root) {
      if (!root || typeof root.traverse !== 'function') throw new TypeError('register: root harus Object3D');
      if (roots.has(root)) return () => unregister(root);
      const uuids = new Set();
      root.traverse((o) => {
        const mat = o.material;
        if (!mat || Array.isArray(mat)) return;
        const rec = records.get(mat.uuid);
        if (rec) {
          rec.owners.add(root);
          uuids.add(mat.uuid);
          return;
        }
        const entry = select(mat, o);
        if (!entry) return;
        records.set(mat.uuid, { entry, owners: new Set([root]) });
        uuids.add(mat.uuid);
      });
      roots.set(root, uuids);
      refresh();
      return () => unregister(root);
    },
    unregister,
    /** Snapshot entri (array baru tiap kali registry berubah). */
    get entries() { return list; },
    get size() { return records.size; },
    clear() { for (const root of [...roots.keys()]) unregister(root); },
  };
}
```

- [ ] **Step 5: `src/world/TimeOfDay.lights.js` — registry & grup pemilik**

1. Setelah `import { createNightHalos } from './NightHalos.js';` tambahkan `import { createMaterialRegistry } from '../engine/materialRegistry.js';`
2. Ganti fungsi `collectEmissiveMaterials` (`:34-48`) dengan:

```js
/** Entri registry emissive: material bertanda userData.nightEmissive, atau bercahaya (emissive > 0) → boost otomatis. */
export function selectEmissive(mat) {
  if (!mat.emissive) return null;
  const tagged = mat.userData?.nightEmissive;
  const base = mat.emissiveIntensity;
  const glow = !tagged && base > 0 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0;
  if (!tagged && !glow) return null;
  const cfg = tagged ?? { on: base * EMISSIVE_AUTO_BOOST, off: base };
  return { mat, on: cfg.on, off: cfg.off };
}
```

3. Di `createPointLights`, `createHeadlight`, `createLightPools`, `createFloodSpots`: ganti nama parameter `scene` → `parent` dan setiap `scene.add(` → `parent.add(` (empat tempat: `createPointLights`, `createHeadlight`, `createLightPools`, `createFloodSpots`).
4. Ganti seluruh `createNightLights` (JSDoc sampai akhir berkas) dengan:

```js
/**
 * @param {THREE.Object3D} parent grup pemilik (TimeOfDay.group), bukan scene
 * @param {{lamps?: {x:number, z:number}[], lensRoot?: THREE.Object3D}} [opts]
 *   lamps: posisi PJU menyala (dari region); lensRoot: tempat mencari lensa floodlight (grup region)
 * @returns {{ update(dt, bikePos, bikeYaw?, focus?): void, setLampsOn(on: boolean): void, lampsOn: boolean,
 *   registerEmissive(root): () => boolean, unregisterEmissive(root): boolean, emissiveCount: number, dispose(): void }}
 */
export function createNightLights(parent, { lamps = [], lensRoot = parent } = {}) {
  const emissives = createMaterialRegistry(selectEmissive, { onRemove: (e) => { e.mat.emissiveIntensity = e.off; } });
  const points = createPointLights(parent);
  const headlight = createHeadlight(parent);
  const floods = createFloodSpots(parent);
  const pools = createLightPools(parent, lamps);
  const halos = createNightHalos(parent, lamps.map((l) => ({ x: l.x, y: LAMP_HEIGHT, z: l.z })), lensRoot);
  const order = lamps.map((_, i) => i);
  const dist2 = new Float32Array(lamps.length);
  let lampsOn = false;
  let level = 0;       // 0..1 intensitas lampu (transisi)
  let pickTimer = 0;

  /** Pilih PJU terdekat (≤ maxPointLights dalam pointLightRange) tiap pointLightInterval. */
  const pickNearest = (pos) => {
    for (let i = 0; i < lamps.length; i += 1) {
      const dx = lamps[i].x - pos.x;
      const dz = lamps[i].z - pos.z;
      dist2[i] = dx * dx + dz * dz;
    }
    order.sort((a, b) => dist2[a] - dist2[b]);
    const maxD2 = DAY.pointLightRange * DAY.pointLightRange;
    points.forEach((light, k) => {
      const idx = order[k];
      const hit = idx !== undefined && dist2[idx] <= maxD2;
      light.userData.active = hit;
      if (hit) light.position.set(lamps[idx].x, LAMP_HEIGHT, lamps[idx].z);
    });
  };

  const updateHeadlight = (pos, yaw) => {
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    headlight.position.set(pos.x + _fwd.x * 0.6, HEADLIGHT_HEIGHT, pos.z + _fwd.z * 0.6);
    headlight.target.position.set(pos.x + _fwd.x * HEADLIGHT_REACH, 0, pos.z + _fwd.z * HEADLIGHT_REACH);
    headlight.intensity = HEADLIGHT_POWER * level;
  };

  return {
    get lampsOn() { return lampsOn; },
    setLampsOn(on) { lampsOn = Boolean(on); },
    /** Daftarkan material emissive di bawah `root` (region, entitas, GLB yang datang belakangan). */
    registerEmissive: (root) => emissives.register(root),
    unregisterEmissive: (root) => emissives.unregister(root),
    get emissiveCount() { return emissives.size; },
    /** `focus`: pusat pemilihan PJU terdekat (titik pandang POV); lampu depan tetap di sepeda. */
    update(dt, bikePos, bikeYaw = 0, focus = bikePos) {
      const target = lampsOn ? 1 : 0;
      level = THREE.MathUtils.damp(level, target, FADE_RATE * 3, dt);
      if (Math.abs(level - target) < 0.002) level = target;
      for (const e of emissives.entries) e.mat.emissiveIntensity = THREE.MathUtils.lerp(e.off, e.on, level);
      pickTimer -= dt;
      if (pickTimer <= 0) {
        pickTimer = DAY.pointLightInterval;
        pickNearest(focus);
      }
      for (const light of points) light.intensity = light.userData.active ? LAMP_POWER * level : 0;
      pools.material.opacity = POOL_OPACITY * level;
      pools.visible = level > 0.01;
      halos.setLevel(level);
      for (const f of floods) f.intensity = FLOOD_POWER * level;
      updateHeadlight(bikePos, bikeYaw);
    },
    /** Lepas semua registrasi (nilai emissive siang dipulihkan). */
    dispose() { emissives.clear(); },
  };
}
```

- [ ] **Step 6: `src/world/NightHalos.js:15-21,74-89`**

`floodLensPositions` (`:15-21`) tidak lagi menerima scene, melainkan root apa pun (tes lama tetap memberi scene):

```js
// sebelum
/** Posisi dunia semua instans lensa floodlight (InstancedMesh dengan material 'lensaFloodlight'). */
export function floodLensPositions(scene) {
  const out = [];
  const m = new THREE.Matrix4();
  const c = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
// sesudah
/** Posisi dunia semua instans lensa floodlight (InstancedMesh dengan material 'lensaFloodlight') di bawah `root`. */
export function floodLensPositions(root) {
  const out = [];
  const m = new THREE.Matrix4();
  const c = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
```

Lalu `:74-89`:

```js
// sebelum
/**
 * @param {THREE.Scene} scene
 * @param {{x:number, y:number, z:number}[]} lampPositions posisi bohlam PJU yang menyala
 * @returns {{setLevel(level:number):void}}
 */
export function createNightHalos(scene, lampPositions) {
  ...
    makePoints(floodLensPositions(scene), { color: FLOOD_COLOR, size: FLOOD_SIZE, opacity: FLOOD_OPACITY, map }),
  ...
  scene.add(group);
// sesudah
/**
 * @param {THREE.Object3D} parent grup pemilik halo
 * @param {{x:number, y:number, z:number}[]} lampPositions posisi bohlam PJU yang menyala
 * @param {THREE.Object3D} [lensRoot] tempat mencari lensa floodlight (default: parent)
 * @returns {{setLevel(level:number):void}}
 */
export function createNightHalos(parent, lampPositions, lensRoot = parent) {
  ...
    makePoints(floodLensPositions(lensRoot), { color: FLOOD_COLOR, size: FLOOD_SIZE, opacity: FLOOD_OPACITY, map }),
  ...
  parent.add(group);
```

- [ ] **Step 7: `src/world/TimeOfDay.js` — grup sendiri**

`:66-73` (JSDoc + signature):

```js
/**
 * @param {THREE.Group} lightingGroup hasil createLighting (userData: sun, hemi, sky, ...)
 * @param {{lamps?: {x:number, z:number}[], lensRoot?: THREE.Object3D|null}} [opts]
 *   lamps: PJU menyala dari region; lensRoot: grup region tempat lensa floodlight
 * @returns {{group: THREE.Group, update(dt, ctx, bikeState?):void, registerEmissive(root):() => boolean,
 *   unregisterEmissive(root):boolean, setHour(h):void, nextPreset():string, toggleSpeed():boolean,
 *   setSpeed(v):void, setAzimuthOffset(deg):void, setCloudCover(v):void, setHaze(v):void, setFogDistance(m):void,
 *   hour:number, presetName:string, speed:number, preset:object, overrides:object}}
 */
export function createTimeOfDay(lightingGroup, scene, renderer, app, { lamps = [], lensRoot = null } = {}) {
```

`:80-84`:

```js
// sebelum
  const stars = createStars(DAY.starCount);
  scene.add(stars);
  const bodies = createCelestialBodies();
  scene.add(bodies.group);
  const night = createNightLights(scene, { lamps });
// sesudah
  // Semua objek siklus waktu di grup sendiri (pemanggil menambahkannya ke scene), bukan langsung ke scene.
  const group = new THREE.Group();
  group.name = 'siklusWaktu';
  const stars = createStars(DAY.starCount);
  group.add(stars);
  const bodies = createCelestialBodies();
  group.add(bodies.group);
  const night = createNightLights(group, { lamps, lensRoot: lensRoot ?? group });
```

Di objek kembalian (`:155`), sebelum `get hour() {` tambahkan:

```js
    group,
    /** Daftarkan material emissive di bawah root (region/entitas/GLB); kembalikan fungsi unregister. */
    registerEmissive: (root) => night.registerEmissive(root),
    unregisterEmissive: (root) => night.unregisterEmissive(root),
```

- [ ] **Step 8: `src/world/Weather.rain.js` dan `src/world/Weather.wet.js`**

`Weather.rain.js:146` `export function createRain(scene) {` → `export function createRain(parent) {`; `:152` `scene.add(group);` → `parent.add(group);` (perbarui JSDoc `:142-145` bila menyebut scene).

`Weather.wet.js`: setelah `:7` tambahkan `import { createMaterialRegistry } from '../engine/materialRegistry.js';`. Ganti `collectWettable` (`:26-41`):

```js
/** Entri registry: material unik dari mesh bernama permukaan basah; nilai asli disimpan. */
function selectWet(mat, o) {
  if (!o.isMesh || !WET_MESH_NAMES.has(baseName(o.name)) || !mat.color) return null;
  return {
    mat,
    color: mat.color.clone(),
    roughness: typeof mat.roughness === 'number' ? mat.roughness : null,
    envMapIntensity: typeof mat.envMapIntensity === 'number' ? mat.envMapIntensity : null,
  };
}
```

Ganti `createWetSurfaces` (`:121-144`):

```js
/**
 * @param {THREE.Object3D} parent grup pemilik (Weather.group)
 * @returns {{ update(dt, intensity): void, register(root): () => boolean, unregister(root): boolean,
 *   dispose(): void, group: THREE.Group, count: number }}
 */
export function createWetSurfaces(parent) {
  const registry = createMaterialRegistry(selectWet, { onRemove: (e) => applyWet(e, 0) });
  const normalMap = createRippleNormalTexture();
  const puddles = createPuddles(normalMap);
  parent.add(puddles.group);
  let last = -1;

  return {
    group: puddles.group,
    get count() { return registry.size; },
    /** Daftarkan permukaan basah di bawah root; frame berikutnya menerapkan intensitas saat ini. */
    register(root) {
      const off = registry.register(root);
      last = -1;
      return off;
    },
    unregister: (root) => registry.unregister(root),
    update(dt, intensity) {
      const on = intensity > 0.001;
      puddles.group.visible = on;
      if (on) normalMap.offset.x = (normalMap.offset.x + dt * RIPPLE_SPEED) % 1;
      if (intensity === last) return;
      last = intensity;
      for (const e of registry.entries) applyWet(e, intensity);
      puddles.mat.opacity = PUDDLE_OPACITY * intensity;
    },
    /** Lepas semua registrasi (material kering dipulihkan). */
    dispose() { registry.clear(); },
  };
}
```

Perbarui komentar berkas `:1-5` menjadi: `Permukaan basah: material tanah/jalan (mesh bernama di Ground/Track) didaftarkan lewat registry lalu dibuat lebih licin dan gelap saat hujan, plus genangan ...`.

- [ ] **Step 9: `src/world/Weather.js` — grup sendiri**

`:80-83`:

```js
// sebelum
export function createWeather(scene, app, lighting, { audioBus = null } = {}) {
  const L = lighting.userData;
  const rain = createRain(scene);
  const wet = createWetSurfaces(scene);
// sesudah
export function createWeather(scene, app, lighting, { audioBus = null } = {}) {
  const L = lighting.userData;
  // Hujan & genangan di grup sendiri (pemanggil menambahkannya ke scene); scene hanya untuk kabut/env.
  const group = new THREE.Group();
  group.name = 'cuaca';
  const rain = createRain(group);
  const wet = createWetSurfaces(group);
```

Di objek kembalian (`:109`), sebelum `get isRaining() {` tambahkan:

```js
    group,
    /** Daftarkan permukaan basah di bawah root (region/tile); kembalikan fungsi unregister. */
    registerWet: (root) => wet.register(root),
    unregisterWet: (root) => wet.unregister(root),
```

Perbarui JSDoc `@returns` `:73-75` dengan `group, registerWet(root), unregisterWet(root)`.

- [ ] **Step 10: Jalankan tes registry, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/materialRegistry.test.js tests/nightRegistry.test.js tests/nightHalos.test.js`
Expected: PASS.

- [ ] **Step 11: Pasang grup & registrasi di `src/main.js`**

```js
// sebelum
  // Siklus waktu & cuaca: dibuat setelah dunia + entitas ada (mencari material emissive & permukaan basah).
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app, { lamps: region.lamps });
  const weather = createWeather(app.scene, app, lighting, { audioBus });
// sesudah
  // Siklus waktu & cuaca: objeknya di grup sendiri; material emissive/basah didaftarkan lewat registry.
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app, { lamps: region.lamps, lensRoot: region.group });
  app.scene.add(time.group);
  time.registerEmissive(region.group);
  time.registerEmissive(ents.group);
  modelsReady
    .then(() => time.registerEmissive(blenderModels)) // GLB yang datang belakangan ikut menyala malam hari
    .catch((err) => console.error('Registrasi emissive model 3D gagal:', err));
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.scene.add(weather.group);
  weather.registerWet(region.group);
```

Catatan paritas: urutan traversal scene tetap (`lighting, world, modelBlender, entities, siklusWaktu{bintang, benda langit, lampu}, cuaca{hujan, genangan}, …`), sehingga urutan render & jumlah lampu identik. Satu-satunya perbedaan yang disengaja: material emissive GLB (`AK_Lampu`, `BK_Lampu`, `SR_Api`) kini **selalu** ikut siklus malam; dulu hanya bila GLB selesai dimuat sebelum langkah muat 0,8 (balapan).

- [ ] **Step 12: Seluruh suite, lint, build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build && grep -n "scene.traverse\|scene.add" src/world/TimeOfDay.lights.js src/world/Weather.wet.js src/world/Weather.rain.js src/world/NightHalos.js || echo "tanpa scene.traverse/scene.add"`
Expected: semua PASS, build sukses, keluaran terakhir `tanpa scene.traverse/scene.add`.

- [ ] **Step 13: Commit**

```bash
git add src/engine/materialRegistry.js src/world/TimeOfDay.lights.js src/world/NightHalos.js src/world/TimeOfDay.js src/world/Weather.rain.js src/world/Weather.wet.js src/world/Weather.js src/main.js tests/materialRegistry.test.js tests/nightRegistry.test.js && git commit -m "feat: registry emissive/basah menggantikan scene.traverse; TimeOfDay dan Weather menempel ke grup sendiri"
```

---

### Task 9: Kebenaran tunggal — tugu, PJU rusak, danau

**Files:**
- Create: `tests/singleSource.test.js`
- Modify: `src/regions/stadion/site.js` (blok `SITE`), `src/regions/stadion/layout.js:35-42,73`, `src/regions/stadion/lamps.js`, `src/regions/stadion/collider.js`, `src/world/index.js` (`addStadiumSurroundings`, `addPlazaFurniture`), `src/world/props/Monument.js:2,173-175`, `src/world/Decals.layout.js:22`, `src/world/Landscape.zones.js:9`, `src/story/chapters.js:5,18`

- [ ] **Step 1: Tulis tes gagal `tests/singleSource.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { SITE } from '../src/config/constants.js';
import { TUGU } from '../src/story/chapters.js';
import { OBSTACLES, isWalkable } from '../src/regions/stadion/collider.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { litLampPositions } from '../src/regions/stadion/lamps.js';
import { createLancangKuning } from '../src/world/props/Monument.js';
import { createDecalLayout } from '../src/world/Decals.layout.js';
import { ZONES } from '../src/world/Landscape.zones.js';

describe('kebenaran tunggal: tugu Lancang Kuning', () => {
  it('SITE.tugu dipakai cerita, collider, layout model, Monument, dan lumut dinding kolam', () => {
    const t = SITE.tugu;
    expect(TUGU).toEqual({ x: t.x, z: t.z });
    const o = OBSTACLES.find((x) => x.name === 'tuguLancangKuning');
    expect([o.x, o.z, o.r]).toEqual([t.x, t.z, t.poolR + 0.6]);
    const model = LAYOUT.blenderModels.find((m) => m.replaces === 'tuguLancangKuning');
    expect([model.x, model.z]).toEqual([t.x, t.z]);
    const mono = createLancangKuning();
    expect([mono.position.x, mono.position.z]).toEqual([t.x, t.z]);
    const moss = createDecalLayout().filter((d) => d.name === 'moss' && d.vertical);
    expect(moss.length).toBeGreaterThan(0);
    for (const d of moss) expect(Math.hypot(d.x - t.x, d.z - t.z)).toBeCloseTo(11.53, 6);
  });
});

describe('kebenaran tunggal: PJU rusak', () => {
  it('flag broken di data layout; lampu malam memakai flag yang sama', () => {
    expect(LAYOUT.plazaLamps.map((p) => p.broken)).toEqual(LAYOUT.plazaLamps.map((_, i) => i % 7 === 3));
    expect(LAYOUT.ringRoadLamps.map((p) => p.broken)).toEqual(LAYOUT.ringRoadLamps.map((_, i) => i % 9 === 4));
    const all = [...LAYOUT.plazaLamps, ...LAYOUT.ringRoadLamps, ...LAYOUT.nagaSaktiLamps];
    expect(litLampPositions(LAYOUT)).toEqual(all.filter((p) => !p.broken).map((p) => ({ x: p.x, z: p.z })));
  });
});

describe('kebenaran tunggal: danau', () => {
  it('collider danau mengikuti elips air visual (ZONES.lake), bukan lingkaran r=70', () => {
    const L = SITE.lake;
    expect([ZONES.lake.semiX, ZONES.lake.semiZ]).toEqual([L.semiX, L.semiZ]);
    expect(SITE.lakeCenter).toEqual({ x: L.x, z: L.z });
    expect(isWalkable(L.x, L.z)).toBe(false);
    expect(isWalkable(L.x + L.semiX - 5, L.z)).toBe(false); // di air, di luar lingkaran lama
    expect(isWalkable(L.x, L.z + L.semiZ + 5)).toBe(true);  // tepi daratan, dulu terblokir lingkaran
  });
});
```

- [ ] **Step 2: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/singleSource.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'x')` (belum ada `SITE.tugu`/`SITE.lake`), flag `broken` `undefined`.

- [ ] **Step 3: Data tunggal di `src/regions/stadion/site.js`**

Sisipkan tepat sebelum `export const SITE = Object.freeze({`:

```js
/** Danau kawasan (elips air, region-lokal): satu sumber untuk visual (Landscape.water), zona, dan collider. */
const LAKE = Object.freeze({ x: -60, z: -480, semiX: 90, semiZ: 55 });
/** Tugu Lancang Kuning di plaza utara: satu sumber untuk collider, cerita, dekal, model GLB, dan Monument. */
const TUGU = Object.freeze({ x: 0, z: -(STADIUM.outerSemiZ + 45), poolR: 8.0 });
```

Di dalam `SITE`, ganti baris `lakeCenter: { x: -60, z: -480 },` dengan:

```js
  lakeCenter: Object.freeze({ x: LAKE.x, z: LAKE.z }),
  lake: LAKE,
  tugu: TUGU,
```

- [ ] **Step 4: Pemakai tugu**

- `src/story/chapters.js:5`: `import { STADIUM, SITE } from '../config/constants.js';` → `import { SITE } from '../config/constants.js';`; `:18`: `export const TUGU = freezeDeep({ x: SITE.tugu.x, z: SITE.tugu.z });`
- `src/world/Decals.layout.js:22`: `const TUGU = Object.freeze({ x: SITE.tugu.x, z: SITE.tugu.z, clear: 14, wallR: 11.53, wallH: 0.7, moss: 6 });`
- `src/regions/stadion/layout.js:73`: `{ path: 'models/monumen/lancang-kuning.glb', x: SITE.tugu.x, z: SITE.tugu.z, replaces: 'tuguLancangKuning' },`
- `src/world/props/Monument.js:2`: `import { SITE, STADIUM } from '../../config/constants.js';` → `import { SITE } from '../../config/constants.js';`; `:162` komentar menjadi `/** Tugu Lancang Kuning lengkap; default di SITE.tugu (plaza utara). */`; `:173-174`:

```js
// sebelum
  const z = opts.z ?? -(STADIUM.outerSemiZ + 45);
  return placeObject(g, { x: opts.x ?? 0, z, rotY: opts.rotY ?? 0 });
// sesudah
  return placeObject(g, { x: opts.x ?? SITE.tugu.x, z: opts.z ?? SITE.tugu.z, rotY: opts.rotY ?? 0 });
```

- `src/world/index.js` (`addStadiumSurroundings`): `add(createLancangKuning());` → `add(createLancangKuning({ x: site.tugu.x, z: site.tugu.z }));`
- `src/regions/stadion/collider.js`: hapus `const TUGU_POOL_R = 8.0;` dan ganti entri rintangan tugu:

```js
    Object.freeze({ name: 'tuguLancangKuning', x: site.tugu.x, z: site.tugu.z, r: site.tugu.poolR + BIKE_CLEARANCE }),
```

- [ ] **Step 5: Aturan PJU rusak di data layout**

`src/regions/stadion/layout.js` — sisipkan setelah `const nearGapura = (x) => Math.abs(x) < GAPURA_GAP;` (`:35`):

```js
// PJU rusak (padam) — satu sumber untuk tiang (world/index.js) dan lampu malam (regions/stadion/lamps.js).
const BROKEN_PLAZA_LAMP = (i) => i % 7 === 3;
const BROKEN_RING_LAMP = (i) => i % 9 === 4;
const withBroken = (list, isBroken) => list.map((p, i) => ({ ...p, broken: isBroken(i) }));
```

dan ganti `:41-42`:

```js
// sebelum
  plazaLamps: ringPositions(PLAZA_RING.semiX + 6, PLAZA_RING.semiZ + 6, 28, { phase: 0.05 }),
  ringRoadLamps: ringPositions(RING_ROAD_SIDEWALK.semiX, RING_ROAD_SIDEWALK.semiZ, 44),
// sesudah
  plazaLamps: withBroken(ringPositions(PLAZA_RING.semiX + 6, PLAZA_RING.semiZ + 6, 28, { phase: 0.05 }), BROKEN_PLAZA_LAMP),
  ringRoadLamps: withBroken(ringPositions(RING_ROAD_SIDEWALK.semiX, RING_ROAD_SIDEWALK.semiZ, 44), BROKEN_RING_LAMP),
```

`src/regions/stadion/lamps.js` — ganti seluruh isi:

```js
/**
 * PJU yang menyala di region stadion (dipakai TimeOfDay untuk PointLight, kolam cahaya, halo).
 * Status rusak dibaca dari data layout (flag `broken`), bukan aturan salinan.
 */
export function litLampPositions(layout) {
  return [...layout.plazaLamps, ...layout.ringRoadLamps, ...layout.nagaSaktiLamps]
    .filter((p) => !p.broken)
    .map((p) => ({ x: p.x, z: p.z }));
}
```

`src/world/index.js` (`addPlazaFurniture`):

```js
// sebelum
    ...layout.plazaLamps.map((p, i) => ({ ...p, broken: i % 7 === 3 })),
    ...layout.ringRoadLamps.map((p, i) => ({ ...p, double: true, broken: i % 9 === 4 })),
// sesudah
    ...layout.plazaLamps,
    ...layout.ringRoadLamps.map((p) => ({ ...p, double: true })),
```

- [ ] **Step 6: Danau**

`src/world/Landscape.zones.js:9`: `lake: { semiX: 90, semiZ: 55, margin: 10 },` → `lake: { semiX: SITE.lake.semiX, semiZ: SITE.lake.semiZ, margin: 10 },`

`src/regions/stadion/collider.js`: hapus `const LAKE_RADIUS = 70;` dan ganti `inLake`:

```js
  /** Elips air danau (sama dengan Landscape.water / ZONES.lake). */
  const inLake = (x, z) => ((x - site.lake.x) / site.lake.semiX) ** 2 + ((z - site.lake.z) / site.lake.semiZ) ** 2 < 1;
```

- [ ] **Step 7: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/singleSource.test.js tests/region.test.js tests/decals.test.js tests/collider.test.js tests/storyDirector.test.js`
Expected: PASS (layout dekal tetap deterministik; nilai tugu tidak berubah).

- [ ] **Step 8: Seluruh suite + lint**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js .`
Expected: semua PASS, lint 0 error.

- [ ] **Step 9: Commit**

```bash
git add src/regions/stadion/site.js src/regions/stadion/layout.js src/regions/stadion/lamps.js src/regions/stadion/collider.js src/world/index.js src/world/props/Monument.js src/world/Decals.layout.js src/world/Landscape.zones.js src/story/chapters.js tests/singleSource.test.js && git commit -m "refactor: posisi tugu, aturan PJU rusak, dan elips danau dipusatkan di data region stadion"
```

---

### Task 10: Layering — `shared/minimapMath`, StoryDirector lewat callback, aturan ESLint

**Files:**
- Move: `src/ui/minimapMath.js` → `src/shared/minimapMath.js`
- Modify: `src/core/App.js:3`, `src/ui/Minimap2D.js:7`, `tests/minimapMath.test.js:2`, `src/core/StoryDirector.js:33-39,57,81,84-85,89,125-126,187,208`, `tests/storyDirector.test.js:20`, `src/main.js` (`setupStory`), `eslint.config.js`, `vite.config.js:25`

- [ ] **Step 1: Pindahkan minimapMath**

Run: `git mv src/ui/minimapMath.js src/shared/minimapMath.js`

- `src/core/App.js:3`: `import { flipRowsInPlace } from '../shared/minimapMath.js';`
- `src/ui/Minimap2D.js:7`: `import { clampToEdge, projectToView, sourceRect } from '../shared/minimapMath.js';`
- `tests/minimapMath.test.js:2`: `import { sourceRect, projectToView, clampToEdge, flipRowsInPlace } from '../src/shared/minimapMath.js';`

- [ ] **Step 2: Ubah tes StoryDirector agar memakai callback (harapan FAIL dulu)**

`tests/storyDirector.test.js:20`:

```js
// sebelum
      hud: { toast: (t, ok) => log.toasts.push([t, ok]), setWallet: () => {} },
// sesudah
      onToast: (t, ok) => log.toasts.push([t, ok]),
      onWalletChange: () => {},
```

Run: `node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'toast')` (StoryDirector masih memanggil `this.hud`).

- [ ] **Step 3: StoryDirector berbicara lewat callback**

`src/core/StoryDirector.js:33-39`:

```js
// sebelum
  /**
   * @param {{storage:object, vendors:object, hud:object, storyHud:object, journal:object, markers:object,
   *   pointerLock?:{release:()=>void, request:()=>void}}} deps
   */
  constructor({ storage, vendors, hud, storyHud, journal, markers, pointerLock = null }) {
    this.story = createStory({ chapters: CHAPTERS, eggs: EASTER_EGGS });
    Object.assign(this, { storage, vendors, hud, storyHud, journal, markers, pointerLock });
// sesudah
  /**
   * HUD tidak diimpor/dipegang langsung: efek toast & dompet dikirim lewat callback (core tidak bergantung ui).
   * @param {{storage:object, vendors:object, storyHud:object, journal:object, markers:object,
   *   onToast?:(text:string, ok:boolean)=>void, onWalletChange?:(wallet:object)=>void,
   *   pointerLock?:{release:()=>void, request:()=>void}}} deps
   */
  constructor({ storage, vendors, storyHud, journal, markers, onToast = () => {}, onWalletChange = () => {}, pointerLock = null }) {
    this.story = createStory({ chapters: CHAPTERS, eggs: EASTER_EGGS });
    Object.assign(this, { storage, vendors, storyHud, journal, markers, onToast, onWalletChange, pointerLock });
```

Lalu ganti setiap pemakaian:
- `:57`, `:84`, `:89`, `:125`: `this.hud.setWallet(this.vendors.wallet);` → `this.onWalletChange(this.vendors.wallet);`
- `:81`: `case 'toast': this.hud.toast(effect.text, effect.ok); break;` → `case 'toast': this.onToast(effect.text, effect.ok); break;`
- `:85`, `:126`, `:187`, `:208`: `this.hud.toast(` → `this.onToast(`

`src/main.js` (`setupStory`):

```js
// sebelum
  story = new StoryDirector({ storage: safeLocalStorage(), vendors: ents.vendors, hud, storyHud, journal, markers, pointerLock });
// sesudah
  story = new StoryDirector({
    storage: safeLocalStorage(), vendors: ents.vendors, storyHud, journal, markers, pointerLock,
    onToast: (text, ok) => hud.toast(text, ok),
    onWalletChange: (wallet) => hud.setWallet(wallet),
  });
```

- [ ] **Step 4: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js tests/minimapMath.test.js && grep -n "this.hud" src/core/StoryDirector.js || echo "tanpa this.hud"`
Expected: PASS; keluaran terakhir `tanpa this.hud`.

- [ ] **Step 5: Aturan arah dependensi di `eslint.config.js`**

Ganti seluruh isi:

```js
import js from '@eslint/js';
import globals from 'globals';

/**
 * Arah dependensi antarlapisan (spec Pekanbaru §3), dicocokkan ke string impor dengan regex.
 * Hanya aturan yang sudah lulus setelah Fase 0; utang yang belum ditegakkan dicatat di rencana:
 * sim masih boleh three (sim/trackPath.js), regions boleh world (builder handmade).
 */
const layers = (dirs) => ({
  regex: `(^|/)(${dirs.join('|')})/`,
  message: `Lapisan ini tidak boleh mengimpor ${dirs.join('/, ')}/ (lihat spec §3).`,
});
const MAIN = { regex: '(^|/)main\\.js$', message: 'main.js adalah composition root; jangan diimpor.' };
const THREE_PKG = { regex: '^three($|/)', message: 'Modul murni tidak boleh bergantung pada three.' };
const STADIUM_GEOMETRY = { regex: '(^|/)world/stadium/', message: 'core tidak boleh mengimpor geometri stadion (lewat region).' };
const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.playwright-mcp/**', 'assets-src/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['tests/**', 'vite.config.js', 'eslint.config.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ['src/engine/**/*.js'], rules: restrict(layers(['world', 'ui', 'regions', 'city', 'core', 'entities', 'story', 'sim', 'app']), MAIN) },
  { files: ['src/geo/**/*.js'], rules: restrict(THREE_PKG, layers(['world', 'ui', 'regions', 'city', 'core', 'entities', 'story', 'sim', 'engine', 'app']), MAIN) },
  { files: ['src/shared/**/*.js'], rules: restrict(layers(['world', 'ui', 'regions', 'city', 'core', 'entities', 'story', 'sim', 'engine', 'app']), MAIN) },
  { files: ['src/story/**/*.js'], rules: restrict(THREE_PKG, layers(['world', 'ui', 'regions', 'city', 'core', 'entities', 'engine', 'app']), MAIN) },
  { files: ['src/sim/**/*.js'], rules: restrict(layers(['world', 'ui', 'regions', 'city', 'core', 'entities', 'story', 'app']), MAIN) },
  { files: ['src/world/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'regions', 'city', 'app']), MAIN) },
  { files: ['src/regions/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'city', 'app']), MAIN) },
  { files: ['src/core/**/*.js'], rules: restrict(layers(['ui', 'app']), STADIUM_GEOMETRY, MAIN) },
  { files: ['src/ui/**/*.js'], rules: restrict(layers(['app']), MAIN) },
];
```

- [ ] **Step 6: Lint harus lulus, dan aturan benar-benar menangkap pelanggaran**

Run: `node node_modules/eslint/bin/eslint.js .`
Expected: 0 error.

Run (probe sementara, dihapus setelahnya): `printf "import '../ui/HUD.js';\nimport '../world/stadium/gateLayout.js';\n" > src/core/__lintprobe.js && node node_modules/eslint/bin/eslint.js src/core/__lintprobe.js; rm src/core/__lintprobe.js`
Expected: 2 error `no-restricted-imports` (pesan "Lapisan ini tidak boleh mengimpor ui/..." dan "core tidak boleh mengimpor geometri stadion"). Bila tidak muncul error, opsi `regex` tidak terbaca — hentikan dan periksa versi ESLint (`node node_modules/eslint/bin/eslint.js --version`, harus ≥ 9.5).

- [ ] **Step 7: Cakupan coverage modul murni baru di `vite.config.js:25`**

```js
// sebelum
      include: ['src/sim/**', 'src/story/**', 'src/settings/**', 'src/core/{adaptiveResolution,cameraMath,escapeRoute,gamepad,Input}.js', 'src/ui/{minimapMath,touchMath,toastQueue}.js'],
// sesudah
      include: [
        'src/sim/**', 'src/story/**', 'src/settings/**',
        'src/core/{adaptiveResolution,cameraMath,escapeRoute,gamepad,Input}.js', 'src/ui/{touchMath,toastQueue}.js',
        'src/engine/**', 'src/geo/**', 'src/shared/**', 'src/regions/Region.js', 'src/regions/stadion/mask.js',
      ],
```

- [ ] **Step 8: Seluruh suite, lint, build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build`
Expected: semua PASS, lint 0 error, build sukses.

- [ ] **Step 9: Commit**

```bash
git add src/shared/minimapMath.js src/ui/minimapMath.js src/core/App.js src/ui/Minimap2D.js tests/minimapMath.test.js src/core/StoryDirector.js tests/storyDirector.test.js src/main.js eslint.config.js vite.config.js && git commit -m "refactor: minimapMath ke shared, StoryDirector lewat callback, ESLint menegakkan arah dependensi"
```

---

### Task 11: Lifecycle `dispose()` dan siklus build→dispose region

**Files:**
- Create: `src/app/lifecycle.js`, `tests/lifecycle.test.js`
- Modify: `src/core/App.js` (field, `:60` — baris `:58` lama setelah Task 2, metode baru), `src/core/Input.js:20-33`, `src/world/Weather.js:11,19-66,80,87` + objek kembalian, `src/world/TimeOfDay.js:14-22` + objek kembalian, `src/app/session.js` (`setupMenu`), `src/app/devtools.js`, `src/main.js` (tulis ulang penuh)

- [ ] **Step 1: Tulis tes gagal `tests/lifecycle.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDisposerStack } from '../src/app/lifecycle.js';
import { Input } from '../src/core/Input.js';
import { createWeather } from '../src/world/Weather.js';
import { createTimeOfDay } from '../src/world/TimeOfDay.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';

/** EventTarget palsu yang menghormati opsi { signal } (AbortController). */
function abortableTarget() {
  const handlers = {};
  return {
    addEventListener(type, fn, opts) {
      (handlers[type] ??= []).push(fn);
      opts?.signal?.addEventListener('abort', () => { handlers[type] = handlers[type].filter((h) => h !== fn); });
    },
    fire: (type, ev = {}) => (handlers[type] ?? []).forEach((fn) => fn(ev)),
    count: (type) => (handlers[type] ?? []).length,
  };
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.sampleRate = 100;
    this.state = 'running';
    this.destination = {};
    this.closed = false;
    FakeAudioContext.instances.push(this);
  }
  createBuffer(_ch, frames) { return { getChannelData: () => new Float32Array(frames) }; }
  createBufferSource() { return { connect: (n) => n, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect: (n) => n }; }
  createGain() { return { gain: { value: 0 }, connect: (n) => n, disconnect() {} }; }
  resume() { return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}

const fakeApp = () => ({ camera: new THREE.PerspectiveCamera(), renderer: {} });

describe('createDisposerStack', () => {
  it('LIFO, galat diisolasi, idempoten', () => {
    const calls = [];
    const logger = { error: (...a) => calls.push(['error', a[0]]) };
    const stack = createDisposerStack({ logger });
    stack.add(() => calls.push('a'));
    stack.add(() => { throw new Error('x'); });
    expect(stack.add(() => calls.push('c'))).toBeTypeOf('function');
    expect(stack.size).toBe(3);
    stack.disposeAll();
    stack.disposeAll();
    expect(calls).toEqual(['c', ['error', 'Pembongkaran gagal (dilanjutkan):'], 'a']);
    expect(stack.size).toBe(0);
    expect(() => stack.add(null)).toThrow(TypeError);
  });
});

describe('Input.dispose', () => {
  it('melepas listener keyboard/blur dan mengosongkan state', () => {
    const t = abortableTarget();
    const input = new Input(t);
    t.fire('keydown', { code: 'KeyW', target: { tagName: 'BODY' } });
    expect(input.isDown('KeyW')).toBe(true);
    input.dispose();
    expect(input.isDown('KeyW')).toBe(false);
    expect(t.count('keydown') + t.count('keyup') + t.count('blur')).toBe(0);
    t.fire('keydown', { code: 'KeyA', target: { tagName: 'BODY' } });
    expect(input.isDown('KeyA')).toBe(false);
  });
});

describe('Weather.dispose', () => {
  it('melepas listener gesture, menutup AudioContext milik sendiri, melepas grup', () => {
    const saved = globalThis.AudioContext;
    globalThis.AudioContext = FakeAudioContext;
    try {
      const t = abortableTarget();
      const scene = new THREE.Scene();
      const weather = createWeather(scene, fakeApp(), { userData: {} }, { eventTarget: t });
      scene.add(weather.group);
      expect(t.count('pointerdown')).toBe(1);
      t.fire('pointerdown');
      const ctx = FakeAudioContext.instances.at(-1);
      weather.dispose();
      expect(t.count('pointerdown') + t.count('keydown')).toBe(0);
      expect(ctx.closed).toBe(true);
      expect(weather.group.parent).toBeNull();
      expect(weather.group.children).toHaveLength(0);
    } finally {
      globalThis.AudioContext = saved;
    }
  });

  it('AudioContext dari audioBus tidak ditutup Weather', () => {
    const shared = new FakeAudioContext();
    const t = abortableTarget();
    const audioBus = { ensure: () => shared, channel: () => shared.destination };
    const weather = createWeather(new THREE.Scene(), fakeApp(), { userData: {} }, { audioBus, eventTarget: t });
    t.fire('keydown');
    weather.dispose();
    expect(shared.closed).toBe(false);
  });
});

describe('TimeOfDay.dispose', () => {
  it('melepas grup dan registrasi emissive', () => {
    const scene = new THREE.Scene();
    const lighting = { userData: { defaults: { cloudCoverage: 0.3 } } };
    const time = createTimeOfDay(lighting, scene, {}, fakeApp(), { lamps: [] });
    scene.add(time.group);
    const mat = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 0.4 });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
    time.registerEmissive(root);
    time.dispose();
    expect(time.group.parent).toBeNull();
    expect(time.group.children).toHaveLength(0);
    expect(mat.emissiveIntensity).toBe(0.4);
  });
});

describe('region stadion: siklus build → dispose 3×', () => {
  it('tiap siklus: grup tanpa anak, scope kosong, semua geometri & material di grup dilepas', async () => {
    for (let i = 0; i < 3; i += 1) {
      const scope = createResourceScope(`uji-${i}`);
      const built = await stadionRegion.build({ scope });
      const resources = new Set();
      built.group.traverse((o) => {
        if (o.geometry) resources.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) resources.add(m);
      });
      const released = new Set();
      for (const r of resources) r.addEventListener('dispose', () => released.add(r));
      built.dispose();
      expect(built.group.children).toHaveLength(0);
      expect(scope.size).toBe(0);
      expect(released.size).toBe(resources.size);
    }
  }, 60000);
});
```

- [ ] **Step 2: Jalankan, harapan FAIL**

Run: `node node_modules/vitest/vitest.mjs run tests/lifecycle.test.js`
Expected: FAIL — `src/app/lifecycle.js` tidak ditemukan (seluruh berkas gagal dimuat). Setelah Step 3 dibuat, sisa kegagalan: `input.dispose is not a function`; `ReferenceError: window is not defined` dari `createWeather` (listener masih ke `window`); `time.dispose is not a function`. Tes siklus region sudah lulus sejak Task 6 — dipertahankan sebagai regresi.

- [ ] **Step 3: Implementasi `src/app/lifecycle.js`**

```js
/**
 * Tumpukan disposer composition root: dipanggil terbalik (LIFO) agar yang dibuat terakhir dibongkar
 * pertama. Galat satu disposer dicatat lalu pembongkaran berlanjut. disposeAll idempoten.
 * @param {{logger?: {error: (...args: unknown[]) => void}}} [opts]
 */
export function createDisposerStack({ logger = console } = {}) {
  let stack = [];
  return {
    /** @template {() => void} F @param {F} fn @returns {F} */
    add(fn) {
      if (typeof fn !== 'function') throw new TypeError('createDisposerStack.add: fn harus fungsi');
      stack = [...stack, fn];
      return fn;
    },
    get size() { return stack.length; },
    disposeAll() {
      const list = stack;
      stack = [];
      for (let i = list.length - 1; i >= 0; i -= 1) {
        try {
          list[i]();
        } catch (err) {
          logger.error('Pembongkaran gagal (dilanjutkan):', err);
        }
      }
    },
  };
}
```

- [ ] **Step 4: `Input.dispose()` (`src/core/Input.js:20-33`)**

```js
// sebelum
export class Input {
  #keys = new Set();
  #virtual = new Map(); // kode tombol → Set sumber yang sedang menahan (touch, gamepad, ...)
  #pressedOnce = new Set();

  constructor(target = window) {
    target.addEventListener('keydown', (e) => {
      if (belongsToUi(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!this.isDown(e.code)) this.#pressedOnce.add(e.code);
      this.#keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.#keys.delete(e.code));
    (typeof window !== 'undefined' ? window : target).addEventListener('blur', () => this.#keys.clear());
  }
// sesudah
export class Input {
  #keys = new Set();
  #virtual = new Map(); // kode tombol → Set sumber yang sedang menahan (touch, gamepad, ...)
  #pressedOnce = new Set();
  #abort = new AbortController();

  constructor(target = window) {
    const { signal } = this.#abort;
    target.addEventListener('keydown', (e) => {
      if (belongsToUi(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!this.isDown(e.code)) this.#pressedOnce.add(e.code);
      this.#keys.add(e.code);
    }, { signal });
    target.addEventListener('keyup', (e) => this.#keys.delete(e.code), { signal });
    (typeof window !== 'undefined' ? window : target).addEventListener('blur', () => this.#keys.clear(), { signal });
  }

  /** Lepas semua listener dan kosongkan state tombol (dipanggil saat aplikasi dibongkar). */
  dispose() {
    this.#abort.abort();
    this.#keys.clear();
    this.#virtual.clear();
    this.#pressedOnce.clear();
  }
```

- [ ] **Step 5: `Weather.dispose()`**

`src/world/Weather.js` — setelah `import { createWetSurfaces } from './Weather.wet.js';` (`:11`) tambahkan `import { disposeTree } from '../engine/disposeTree.js';`. Ganti `createRainAudio` (`:19-66`):

```js
/**
 * Suara hujan dari derau terfilter (Web Audio); dibuat setelah gesture pengguna (pointerdown/keydown
 * pada `eventTarget`). Bila audioBus ada, memakai konteks bersama dan kanal 'ambience' (volume dari
 * settings) — konteks itu milik bus, jadi tidak ditutup di sini.
 */
function createRainAudio(audioBus, eventTarget) {
  let ctx = null;
  let gain = null;
  let src = null;
  let ownsCtx = false;
  const listeners = new AbortController();
  const start = () => {
    if (ctx) return;
    const shared = audioBus?.ensure?.() ?? null;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    ctx = shared ?? (Ctor ? new Ctor() : null);
    if (!ctx) return;
    ownsCtx = !shared;
    const out = audioBus?.channel?.('ambience') ?? ctx.destination;
    const frames = ctx.sampleRate * AUDIO_BUFFER_SECONDS;
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i += 1) { // derau "pink-ish": white noise dihaluskan
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 3.5;
    }
    src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = AUDIO_FILTER_HZ;
    gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(out);
    src.start();
  };
  const onGesture = () => start();
  eventTarget?.addEventListener?.('pointerdown', onGesture, { passive: true, signal: listeners.signal });
  eventTarget?.addEventListener?.('keydown', onGesture, { passive: true, signal: listeners.signal });
  let resuming = false;
  return {
    setLevel(level) {
      if (!gain) return;
      if (level > 0 && ctx.state === 'suspended' && !resuming) {
        resuming = true;
        ctx.resume().catch(() => {}).finally(() => { resuming = false; });
      }
      gain.gain.value = AUDIO_GAIN * level;
    },
    dispose() {
      listeners.abort();
      try {
        src?.stop();
      } catch {
        // sumber sudah berhenti
      }
      gain?.disconnect();
      if (ownsCtx && ctx?.close) Promise.resolve(ctx.close()).catch(() => {});
      src = null;
      gain = null;
      ctx = null;
    },
  };
}
```

Signature (`:80`) menjadi `export function createWeather(scene, app, lighting, { audioBus = null, eventTarget = globalThis.window } = {}) {`, dan `const audio = createRainAudio(audioBus);` menjadi `const audio = createRainAudio(audioBus, eventTarget);`. Di objek kembalian, setelah `update(dt, ctx) { ... },` tambahkan:

```js
    /** Bongkar: listener gesture, audio (konteks milik sendiri ditutup), registry basah, grup cuaca. */
    dispose() {
      audio.dispose();
      wet.dispose();
      group.removeFromParent();
      disposeTree(group);
    },
```

Perbarui JSDoc `@param {{audioBus?: object}} opts` menjadi `@param {{audioBus?: object, eventTarget?: EventTarget}} opts` dan `@returns` dengan `dispose():void`.

- [ ] **Step 6: `TimeOfDay.dispose()`**

`src/world/TimeOfDay.js` — setelah `import { createCelestialBodies, celestialLook } from './CelestialBodies.js';` tambahkan `import { disposeTree } from '../engine/disposeTree.js';`. Di objek kembalian, setelah `update(dt, ctx, bikeState) { ... },` tambahkan:

```js
    /** Bongkar: registrasi emissive dilepas (nilai siang dipulihkan), grup siklus waktu dilepas. */
    dispose() {
      night.dispose();
      group.removeFromParent();
      disposeTree(group);
    },
```

- [ ] **Step 7: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/lifecycle.test.js tests/inputVirtual.test.js`
Expected: PASS.

- [ ] **Step 8: `App.dispose()` (`src/core/App.js`)**

Tambahkan field setelah `#legacySeq = 0;`:

```js
  #disposed = false;
  #onResize = () => this.resize();
```

`:60` `window.addEventListener('resize', () => this.resize());` → `window.addEventListener('resize', this.#onResize);`. Tambahkan metode setelah `renderFrame()`:

```js
  /**
   * Bongkar aplikasi: hentikan loop, lepas listener resize, dispose sistem, pass, render target,
   * renderer, dan elemen DOM-nya. Idempoten. (Tidak dapat dites di Node: butuh WebGL.)
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.#onResize);
    this.systems.dispose();
    for (const pass of this.post.composer.passes) pass.dispose?.();
    this.post.composer.dispose();
    this.labelRenderer.domElement.remove();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
```

- [ ] **Step 9: `setupMenu` mengembalikan hasil panel; devtools menyediakan teardown**

`src/app/session.js` — ganti blok `mountSettingsPanel({ ... }).then(({ panel: p }) => { ... });` di akhir `setupMenu`:

```js
  // Kembalikan hasil pemasangan panel agar composition root dapat memanggil dispose()-nya.
  return mountSettingsPanel({
    store, app, rig, hud,
    onPanelToggle: (open) => { if (!open && !started) menu.away(false); }, // panel ditutup sebelum mulai: menu muncul lagi
  }).then((mounted) => {
    panel = mounted.panel;
    if (!mounted.panel) {
      // tanpa panel: klik kanvas mengunci pointer (panel memasang handler sendiri, cek isPointerOverUI)
      app.renderer.domElement.addEventListener('click', () => {
        if (started && !hud.shopOpen && !touch) rig.requestLock();
      });
    }
    return mounted;
  });
```

`src/app/devtools.js` — ganti seluruh isi:

```js
/**
 * Alat debug mode dev: teleport, statistik renderer, store settings, pembongkaran aplikasi.
 */
import { createCollider } from '../core/Collider.js';

export function exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders, teardown }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
    /** Bongkar seluruh aplikasi (uji siklus hidup); muat ulang halaman untuk memulai lagi. */
    teardown,
  };
}
```

- [ ] **Step 10: Tulis ulang `src/main.js` (versi akhir Fase 0)**

Isi lengkap berkas (menggabungkan Task 1–11; fungsi yang tidak disebut berubah identik dengan sebelumnya):

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
import { createCollider, createCompositeCollider, localized } from './core/Collider.js';
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
import { SITE } from './config/constants.js';
import { STORY_NPCS } from './story/chapters.js';
import { freezeStatic } from './world/util/freezeStatic.js';
import { createModelGroup, placeModels } from './world/assets/models.js';
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
import { createResourceScope } from './engine/ResourceScope.js';
import { disposeTree } from './engine/disposeTree.js';
import { stadionRegion } from './regions/stadion/index.js';
import { session, setupMenu } from './app/session.js';
import { handleKeys } from './app/keymap.js';
import { setupShop, updatePrompt } from './app/shop.js';
import { exposeDevTools } from './app/devtools.js';
import { createDisposerStack } from './app/lifecycle.js';

const START_POS = { x: 0, z: -275, yaw: 0 }; // plaza utara, menghadap stadion
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

  await loading.step(0.12, 'Menyiapkan langit dan pencahayaan…');
  const lighting = createLighting(app.scene, app.renderer);
  app.scene.add(lighting);
  app.addSystem({ id: 'lighting', phase: 'world', update: (dt, ctx) => lighting.userData.update?.(dt, ctx.time, ctx.focus, ctx.shadowFrame) });

  await loading.step(0.2, 'Membangun stadion, tribun, dan lingkungan…');
  const region = await stadionRegion.build({
    scene: app.scene, renderer: app.renderer, camera: app.camera, scope: createResourceScope('region:stadion'), store, clock: app.timer,
  });
  lifecycle.add(() => region.dispose());
  app.scene.add(region.group);
  freezeStatic(region.group); // dunia statis: matriks dihitung sekali, tidak per frame
  const colliders = createCompositeCollider({
    regions: [{ region: stadionRegion, colliders: region.colliders }],
    fallback: localized(stadionRegion, region.colliders), // Fase 0: tanah region (1,4 km) masih menutup seluruh dunia; Fase 2: TileCollider
  });
  rig.setObstacleTest(colliders.isCameraClear);
  const blenderModels = createModelGroup();
  app.scene.add(blenderModels);
  lifecycle.add(() => { blenderModels.removeFromParent(); disposeTree(blenderModels); });
  const modelsReady = loadBlenderModels(blenderModels, region, hud);
  app.addSystem({ id: 'wind', phase: 'world', update: (dt) => updateWind(dt) }); // angin global tiap frame
  region.systems.forEach((s) => app.addSystem(s));

  await loading.step(0.55, 'Menyiapkan pemain, pelari, pedagang, dan penonton…');
  const wallet = createWallet();
  const ents = buildEntities({ start: START_POS, world: region, wallet, camera: app.camera });
  app.scene.add(ents.group);
  lifecycle.add(() => { ents.bike.dispose(); ents.group.removeFromParent(); disposeTree(ents.group); });
  ents.bike.setCollider(createCollider(START_POS, colliders.isWalkable));
  rig.attachSource(createPovSource(ents));
  ents.bike.setAudioBus(audioBus);
  ents.updatables.forEach((e, i) => app.addSystem({ id: `entities.${i}`, phase: 'sim', update: (dt, ctx) => e.update(dt, ctx) }));

  await loading.step(0.8, 'Menyiapkan siklus waktu dan cuaca…');
  // Siklus waktu & cuaca: objeknya di grup sendiri; material emissive/basah didaftarkan lewat registry.
  const time = createTimeOfDay(lighting, app.scene, app.renderer, app, { lamps: region.lamps, lensRoot: region.group });
  app.scene.add(time.group);
  lifecycle.add(() => time.dispose());
  time.registerEmissive(region.group);
  time.registerEmissive(ents.group);
  modelsReady
    .then(() => time.registerEmissive(blenderModels)) // GLB yang datang belakangan ikut menyala malam hari
    .catch((err) => console.error('Registrasi emissive model 3D gagal:', err));
  const weather = createWeather(app.scene, app, lighting, { audioBus });
  app.scene.add(weather.group);
  lifecycle.add(() => weather.dispose());
  weather.registerWet(region.group);
  app.addSystem({ id: 'timeOfDay', phase: 'world', update: (dt, ctx) => time.update(dt, ctx, ents.bike.state) });
  app.addSystem({ id: 'weather', phase: 'world', update: (dt, ctx) => weather.update(dt, ctx) }); // setelah TimeOfDay: mengalikan nilai pencahayaan frame ini

  hud.setWallet(wallet);
  hud.setCameraMode(rig.mode);
  const story = setupStory({ app, ents, hud, rig });
  const shop = setupShop(hud, ents, story);
  const minimap = setupMinimap(app, ents, story);
  addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story });

  // Binding store -> scene (satu sumber kebenaran). Dipasang setelah semua objek ada.
  lifecycle.add(bindAll(store, {
    app, time, lighting, weather, rig, hud, audioBus, crowd: ents.crowd, vendors: ents.vendors,
  }));

  const bikePos = new THREE.Vector3();
  app.start((dt, t, rawDt) => {
    bikePos.set(ents.bike.state.x, 0, ents.bike.state.z);
    // focus = titik pusat tampilan (sepeda, atau titik pandang saat POV); sepeda beku di POV tanpa kendali
    return { dt, rawDt, time: t, bikePos, focus: rig.focus, input: hud.shopOpen || rig.freezesBike ? null : input };
  });

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
  try {
    minimap.setBase(app.bakeMinimap(SITE.groundSize / 2), SITE.groundSize / 2);
  } catch (err) {
    // Minimap hanya pelengkap: GPU yang gagal mengalokasikan target/readPixels tidak boleh menggagalkan game.
    console.error('Minimap dasar gagal dibuat, minimap memakai latar polos:', err);
  }
  await loading.step(1, 'Siap!');
  loading.done();
  // Latar menu: kamera orbit sinematik mengelilingi stadion (sepeda dibekukan, cerita dijeda) sampai pemain menekan Mulai.
  rig.handlePovKey(POVS.find((p) => p.id === 'orbit').key);
  menu.ready({ hasProgress: hasStoryProgress(story.state), touch });
  if (import.meta.env.DEV) {
    exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders, teardown: () => lifecycle.disposeAll() });
  }
}

/**
 * Sistem per frame milik composition root (dulu satu updatable raksasa). Hotkey kini di fase input
 * (efeknya terlihat satu frame lebih awal; tidak ada perbedaan visual), cerita di sim, kamera di camera,
 * HUD dan input.endFrame di ui (endFrame terdaftar terakhir di antara konsumen tombol).
 */
function addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story }) {
  app.addSystem({
    id: 'keymap',
    phase: 'input',
    update: () => { if (session.started) handleKeys(input, { rig, hud, ents, shop, time, store, story }); }, // menu terbuka: tombol game diabaikan
  });
  app.addSystem({
    id: 'story',
    phase: 'sim',
    update: (dt, ctx) => story.update(dt, {
      time: ctx.time, bikePos: ents.bike.state, hour: time.hour,
      raining: Boolean(store.get('weather.raining')), paused: hud.shopOpen || rig.freezesBike,
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
      updatePrompt(hud, ents, story, ents.bike.state);
    },
  });
  app.addSystem({ id: 'input.endFrame', phase: 'ui', update: () => input.endFrame() });
}

/** Cerita: NPC, penanda tujuan, HUD, jurnal; progres dimuat dari localStorage. */
function setupStory({ app, ents, hud, rig }) {
  const root = document.getElementById('hud');
  const npcs = new StoryNpcs();
  const markers = createStoryMarkers();
  app.scene.add(npcs.group, markers.group);
  ents.lod.addFrom(npcs.group);
  app.addSystem({ id: 'storyNpcLabels', phase: 'ui', update: (dt, ctx) => npcs.refreshLabels(ctx.focus ?? ctx.bikePos, ents.vendors.labelsEnabled) });
  let story = null;
  const storyHud = new StoryHUD(root, { onAdvance: () => story.advanceDialog() });
  const journal = new StoryJournal(root, { onReset: () => story.reset(), onClose: () => story.toggleJournal() });
  const pointerLock = { release: () => document.exitPointerLock?.(), request: () => rig.requestLock() };
  story = new StoryDirector({
    storage: safeLocalStorage(), vendors: ents.vendors, storyHud, journal, markers, pointerLock,
    onToast: (text, ok) => hud.toast(text, ok),
    onWalletChange: (w) => hud.setWallet(w),
  });
  ents.bike.onRing = () => story.onBell();
  story.start();
  return story;
}

const PIN_VENDOR = '#ff9f1c';
const PIN_NPC = '#4cc9f0';

/** Minimap 2D: peta dasar di-bake sekali (lihat App.bakeMinimap); marker digambar di canvas kecil. */
function setupMinimap(app, ents, story) {
  const minimap = new Minimap2D(document.body);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => ({ x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.map((n) => ({ x: n.x, z: n.z, color: PIN_NPC })),
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

/**
 * Muat model GLB hasil Blender (region.layout.blenderModels) tanpa menahan start aplikasi.
 * Model yang gagal dimuat hanya dilewati; dunia prosedural tetap lengkap.
 */
async function loadBlenderModels(group, region, hud) {
  const { failed } = await placeModels(group, region.layout.blenderModels ?? [], { world: region.group });
  if (failed.length) hud.toast(`${failed.length} model 3D gagal dimuat`, false);
}

main().catch((err) => {
  console.error(err);
  document.getElementById('loading-fill')?.classList.add('failed');
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat. Muat ulang halaman.';
});
```

- [ ] **Step 11: Seluruh suite, lint, build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js . && node node_modules/vite/bin/vite.js build`
Expected: semua PASS, lint 0 error, build sukses.

- [ ] **Step 12: Commit**

```bash
git add src/app/lifecycle.js src/core/App.js src/core/Input.js src/world/Weather.js src/world/TimeOfDay.js src/app/session.js src/app/devtools.js src/main.js tests/lifecycle.test.js && git commit -m "feat: lifecycle dispose untuk App, Input, Weather, TimeOfDay, dan composition root (disposer LIFO)"
```

---

### Task 12: Bug dompet — save v2, migrasi v1, cadangan `.bak` (TDD penuh)

**Files:**
- Modify: `tests/storyStorage.test.js` (tulis ulang), `tests/storyDirector.test.js:4,6-27,102` + describe baru, `src/story/storage.js` (tulis ulang), `src/sim/vendorSim.js:79-83`, `src/entities/Vendor.js:9,213`, `src/core/StoryDirector.js:9-13,20-22,53-62,66-69,93,117-129,206-211` (nomor setelah Task 10: JSDoc konstruktor bertambah 2 baris)

- [ ] **Step 1: Tulis ulang `tests/storyStorage.test.js` (harapan FAIL)**

```js
import { describe, it, expect } from 'vitest';
import {
  sanitizeSave, sanitizeWallet, loadStory, saveStory, migrateV1, STORY_KEY, STORY_BACKUP_KEY, SAVE_VERSION,
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

describe('story storage v2', () => {
  it('round-trip v2 (progres + dompet)', () => {
    const s = mem();
    saveStory(s, V2);
    expect(SAVE_VERSION).toBe(2);
    expect(loadStory(s, LIMITS)).toEqual(V2);
  });

  it('v1 dimigrasi: hadiah dikreditkan SEKALI ke saldo awal, tanpa barang', () => {
    const v1 = { version: 1, chapter: 2, step: 1, badges: ['x'], eggs: ['a'], bestLap: 41.5, rupiah: 20000, finished: false };
    const expected = { ...v1, version: 2, wallet: { balance: 70000, items: [] } };
    expect(migrateV1(v1, LIMITS)).toEqual(expected);
    expect(loadStory(mem({ [STORY_KEY]: JSON.stringify(v1) }), LIMITS)).toEqual(expected);
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

  it('v2 dengan dompet tidak sah dianggap rusak (dicadangkan)', () => {
    const text = JSON.stringify({ ...V2, wallet: 'x' });
    const s = mem({ [STORY_KEY]: text });
    expect(loadStory(s, LIMITS)).toBeNull();
    expect(s.data[STORY_BACKUP_KEY]).toBe(text);
  });

  it('tanpa save: null tanpa cadangan', () => {
    const s = mem();
    expect(loadStory(s, LIMITS)).toBeNull();
    expect(s.data[STORY_BACKUP_KEY]).toBeUndefined();
  });

  it('membuang nilai di luar rentang, id tak dikenal, dan item dompet tak sah', () => {
    const r = sanitizeSave({
      version: 2, chapter: 99, step: -3, badges: ['ok', 5], eggs: ['a', 'zzz'], bestLap: -1, rupiah: 'x', finished: 'y',
      wallet: { balance: -50, items: [TEH, { id: 'palsu' }, null, { id: 'rujak', price: -3 }] },
    }, LIMITS);
    expect(r).toEqual({
      version: 2, chapter: 4, step: 0, badges: ['ok'], eggs: ['a'], bestLap: null, rupiah: 0, finished: false,
      wallet: { balance: 0, items: [TEH, { id: 'rujak', name: 'rujak', kind: '', price: 0 }] },
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
    expect(() => saveStory(bad, { version: 2 })).not.toThrow();
    const full = { getItem: () => '{oops', setItem() { throw new Error('penuh'); } };
    expect(loadStory(full, LIMITS)).toBeNull();
  });
});
```

Run: `node node_modules/vitest/vitest.mjs run tests/storyStorage.test.js`
Expected: FAIL — `STORY_BACKUP_KEY`/`SAVE_VERSION`/`migrateV1`/`sanitizeWallet` tidak diekspor; round-trip v2 mengembalikan `null`.

- [ ] **Step 2: Tulis ulang `src/story/storage.js`**

```js
/**
 * Simpan/muat progres cerita di localStorage (kunci tetap; versi di dalam data). Data dari storage
 * tidak dipercaya: dibersihkan terhadap batas chapter/langkah, id yang dikenal, dan dompet yang sah.
 * v2 menyimpan dompet {balance, items}; v1 (tanpa dompet) dimigrasi sekali. Data rusak atau versi tak
 * dikenal dicadangkan ke STORY_BACKUP_KEY sebelum mulai baru (tidak dibuang diam-diam).
 */
export const STORY_KEY = 'sur3d.story.v1';
export const STORY_BACKUP_KEY = `${STORY_KEY}.bak`;
export const SAVE_VERSION = 2;

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

/** Field progres yang sama di v1 & v2. */
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
  return { version: SAVE_VERSION, ...progress, wallet: { balance: nonNegInt(limits.startBalance) + progress.rupiah, items: [] } };
}

/**
 * @param {{chapters:number, steps:number[], eggIds:string[], startBalance?:number, itemIds?:string[]}} limits
 * @returns {object|null} save v2 tersanitasi; null bila bukan save yang dikenali
 */
export function sanitizeSave(raw, limits) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === 1) return migrateV1(raw, limits);
  if (raw.version !== SAVE_VERSION) return null;
  const wallet = sanitizeWallet(raw.wallet, limits.itemIds);
  return wallet ? { version: SAVE_VERSION, ...sanitizeProgress(raw, limits), wallet } : null;
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

- [ ] **Step 3: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/storyStorage.test.js`
Expected: PASS (8 tes).

- [ ] **Step 4: Ubah tes StoryDirector (harapan FAIL)**

Ganti `makeDeps` (`tests/storyDirector.test.js:6-27`, versi setelah Task 10) dan impor `:4`:

```js
import { STORY_KEY, STORY_BACKUP_KEY } from '../src/story/storage.js';

function makeDeps({ balance = 50000, items = [], save = null, store = null } = {}) {
  const map = store ?? new Map(save ? [[STORY_KEY, JSON.stringify(save)]] : []);
  const log = { toasts: [], credits: [], renders: 0, targets: [] };
  const vendors = {
    wallet: { balance, items },
    credit(n) { this.wallet = { ...this.wallet, balance: this.wallet.balance + n }; log.credits.push(n); },
    consume(id) { this.wallet = { ...this.wallet, items: this.wallet.items.filter((i) => i.id !== id) }; },
    setWallet(w) { this.wallet = { balance: w.balance, items: [...w.items] }; },
    nearestSelling: () => ({ x: 5, z: 5 }),
  };
  return {
    log,
    store: map,
    deps: {
      storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
      vendors,
      onToast: (t, ok) => log.toasts.push([t, ok]),
      onWalletChange: () => {},
      storyHud: { render: () => { log.renders += 1; } },
      journal: { open: false, show() { this.open = true; }, hide() { this.open = false; } },
      markers: { setTarget: (p) => log.targets.push(p), update: () => {} },
    },
  };
}
```

Di describe `pengaman uang (soft-lock)` (`:102`), fixture `atBuy` kini memakai save v2 (saldo dari dompet tersimpan, bukan dari dompet sesi):

```js
// sebelum
  const atBuy = (balance) => started({ balance, save: { version: 1, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false } });
// sesudah
  const atBuy = (balance) => started({ save: { version: 2, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false, wallet: { balance, items: [] } } });
```

Tambahkan describe baru di akhir berkas:

```js
describe('StoryDirector: dompet tersimpan (save v2)', () => {
  const TEH = { id: 'es-teh', name: 'Es Teh', kind: 'minuman', price: 5000 };
  const v2 = (wallet, extra = {}) => ({ version: 2, chapter: 1, step: 0, badges: [], eggs: [], bestLap: null, rupiah: 5000, finished: false, wallet, ...extra });
  const savedIn = (m) => JSON.parse(m.deps.storage.getItem(STORY_KEY));

  it('memuat dompet dari save tanpa mengkredit ulang hadiah', () => {
    const { d, log } = started({ save: v2({ balance: 1200, items: [TEH] }) });
    expect(d.vendors.wallet.balance).toBe(1200);
    expect(d.vendors.wallet.items.map((i) => i.id)).toEqual(['es-teh']);
    expect(log.credits).toEqual([]);
  });

  it('belanja tersimpan: reload tidak mengembalikan uang', () => {
    const m = makeDeps();
    const d = new StoryDirector(m.deps);
    d.start();
    d.vendors.wallet = { balance: 45000, items: [TEH] }; // hasil tryBuy di VendorGroup
    d.onBought('es-teh');
    expect(savedIn(m)).toMatchObject({ version: 2, wallet: { balance: 45000 } });
    const reload = makeDeps({ store: m.store });
    const d2 = new StoryDirector(reload.deps);
    d2.start();
    expect(d2.vendors.wallet.balance).toBe(45000);
    expect(reload.log.credits).toEqual([]);
  });

  it('uang saku (soft-lock) ikut tersimpan', () => {
    const m = makeDeps({ save: v2({ balance: 1000, items: [] }, { rupiah: 0 }) });
    const d = new StoryDirector(m.deps);
    d.start();
    d.update(1.1, ctx(0, 0));
    expect(savedIn(m).wallet.balance).toBe(5000);
  });

  it('mulai dari awal: dompet kembali ke saldo awal dan tersimpan', () => {
    const m = makeDeps({ save: v2({ balance: 1234, items: [] }) });
    const d = new StoryDirector(m.deps);
    d.start();
    d.reset();
    expect(d.vendors.wallet).toEqual({ balance: 50000, items: [] });
    expect(savedIn(m)).toMatchObject({ version: 2, chapter: 0, wallet: { balance: 50000, items: [] } });
  });

  it('save rusak dicadangkan ke kunci .bak lalu mulai baru', () => {
    const m = makeDeps();
    m.deps.storage.setItem(STORY_KEY, '{bukan json');
    const d = new StoryDirector(m.deps);
    d.start();
    expect(m.deps.storage.getItem(STORY_BACKUP_KEY)).toBe('{bukan json');
    expect(d.state.chapter).toBe(0);
  });
});
```

Catatan: tes `memuat progres tersimpan` (save v1, harapan saldo `50000 + 100`) **tidak diubah** — kini lulus lewat migrasi (saldo awal + rupiah sekali), bukan lewat credit-ulang.

Run: `node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js`
Expected: FAIL — `belanja tersimpan` (save tidak berisi `wallet`), `memuat dompet` (credits `[5000]`), `pengaman uang` (saldo masih dari dompet sesi), `mulai dari awal`.

- [ ] **Step 5: `restoreWallet` di `src/sim/vendorSim.js` dan `setWallet` di `VendorGroup`**

`src/sim/vendorSim.js` — setelah fungsi `safeWallet` (`:79-83`) tambahkan:

```js
/** Dompet dari data luar (save): saldo ≥ 0 dan salinan daftar item; tidak memutasi masukan. */
export function restoreWallet(wallet) {
  const w = safeWallet(wallet);
  return { balance: w.balance, items: [...w.items] };
}
```

`src/entities/Vendor.js:9` — tambahkan `restoreWallet` ke impor dari `../sim/vendorSim.js`. Setelah `credit(amount) { ... }` (`:213`) tambahkan:

```js

  /** Ganti dompet (mis. dari save cerita); data disanitasi. */
  setWallet(wallet) { this.#wallet = restoreWallet(wallet); }
```

- [ ] **Step 6: StoryDirector menyimpan & memuat dompet**

`src/core/StoryDirector.js`:

1. `:9`: `import { loadStory, saveStory } from '../story/storage.js';` → `import { loadStory, saveStory, SAVE_VERSION } from '../story/storage.js';`; setelah `:13` tambahkan:

```js
import { VENDOR_CATALOG, createWallet } from '../sim/vendorSim.js';
import { VENDOR } from '../config/constants.js';
```

2. `:20-22`:

```js
// sebelum
const SAVE_KEYS = ['version', 'chapter', 'step', 'badges', 'eggs', 'bestLap', 'rupiah', 'finished'];

const LIMITS = Object.freeze({ chapters: CHAPTERS.length, steps: CHAPTERS.map((c) => c.steps.length), eggIds: EGG_IDS });
// sesudah
const PROGRESS_KEYS = ['chapter', 'step', 'badges', 'eggs', 'bestLap', 'rupiah', 'finished'];
const ITEM_IDS = Object.values(VENDOR_CATALOG).flat().map((i) => i.id);

const LIMITS = Object.freeze({
  chapters: CHAPTERS.length, steps: CHAPTERS.map((c) => c.steps.length), eggIds: EGG_IDS,
  startBalance: VENDOR.startBalance, itemIds: ITEM_IDS,
});
```

3. `start()` (`:53-62`):

```js
// sebelum
  /** Muat progres tersimpan; hadiah yang sudah dikumpulkan ditambahkan ke dompet sesi ini. */
  start() {
    const save = loadStory(this.storage, LIMITS);
    if (save) {
      this.state = this.story.hydrate(save);
      this.vendors.credit(this.state.rupiah);
      this.onWalletChange(this.vendors.wallet);
    }
    this.#render();
  }
// sesudah
  /** Muat progres + dompet tersimpan (save v2; v1 dimigrasi sekali). Tidak ada credit-ulang hadiah. */
  start() {
    const save = loadStory(this.storage, LIMITS);
    if (save) {
      const { wallet, version: _version, ...progress } = save;
      this.state = this.story.hydrate(progress);
      this.vendors.setWallet(wallet);
      this.onWalletChange(this.vendors.wallet);
    }
    this.#render();
  }
```

4. `onBought` (`:66-69`):

```js
  onBought(itemId) {
    this.bought = itemId;
    this.dispatch({ type: 'bought', itemId });
    this.#persist(); // dompet berubah karena belanja: simpan agar reload tidak "mengembalikan" uang
  }

  /** Simpan progres + dompet (save v2). */
  #persist() {
    saveStory(this.storage, {
      version: SAVE_VERSION,
      ...Object.fromEntries(PROGRESS_KEYS.map((k) => [k, this.state[k]])),
      wallet: this.vendors.wallet,
    });
  }
```

5. `:93`: `case 'save': saveStory(this.storage, Object.fromEntries(SAVE_KEYS.map((k) => [k, this.state[k]]))); break;` → `case 'save': this.#persist(); break;`
6. `#ensureFunds` — setelah `this.onToast(\`Uang saku +Rp ...\`, true);` (akhir metode) tambahkan `this.#persist();`
7. `reset()` (`:206-211`):

```js
  reset() {
    this.dispatch({ type: 'reset' });
    this.eggState = createEggState();
    this.vendors.setWallet(createWallet()); // "Mulai dari awal" = dompet awal juga
    this.onWalletChange(this.vendors.wallet);
    this.#persist();
    this.journal.hide();
    this.onToast('Cerita dimulai ulang', true);
  }
```

- [ ] **Step 7: Jalankan, harapan PASS**

Run: `node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js tests/storyStorage.test.js tests/vendorSim.test.js tests/storyFunds.test.js`
Expected: PASS.

- [ ] **Step 8: Seluruh suite + lint**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/eslint/bin/eslint.js .`
Expected: semua PASS, lint 0 error.

- [ ] **Step 9: Commit**

```bash
git add src/story/storage.js src/sim/vendorSim.js src/entities/Vendor.js src/core/StoryDirector.js tests/storyStorage.test.js tests/storyDirector.test.js && git commit -m "fix: dompet disimpan di save v2 (migrasi v1 sekali, cadangan .bak) sehingga belanja tidak kembali saat reload"
```

---

### Task 13: Verifikasi akhir (suite, lint, build, coverage, paritas visual)

**Files:** tidak ada perubahan kode (kecuali bila verifikasi gagal — perbaiki di task terkait, bukan di sini).

- [ ] **Step 1: Suite penuh + coverage**

Run: `node node_modules/vitest/vitest.mjs run --coverage`
Expected: semua tes PASS; ringkasan coverage memenuhi ambang (lines/statements/functions ≥ 90, branches ≥ 85) termasuk `src/engine/**`, `src/geo/**`, `src/shared/**`, `src/regions/Region.js`, `src/regions/stadion/mask.js`.

- [ ] **Step 2: Lint**

Run: `node node_modules/eslint/bin/eslint.js .`
Expected: 0 error.

- [ ] **Step 3: Build produksi**

Run: `node node_modules/vite/bin/vite.js build`
Expected: build sukses; peringatan ukuran chunk hanya untuk vendor `three` seperti sebelumnya.

- [ ] **Step 4: Periksa tujuan layering secara langsung**

Run: `grep -rn "from '\.\./ui/\|world/stadium" src/core; grep -rn "scene.traverse" src/world; grep -rln "new Map()" src/world/materials.js src/entities/util.js src/entities/Humanoid.hair.js src/entities/Humanoid.face.js src/world/assets/models.js || echo "cache modul bersih"`
Expected: dua grep pertama tanpa keluaran; keluaran terakhir `cache modul bersih`.

- [ ] **Step 5: Paritas visual draw call (±5%)**

Jalankan dev server (konfigurasi `stadion-dev` atau `node node_modules/vite/bin/vite.js --port 5173 --strictPort`), buka `http://localhost:5173/` di tab terlihat, tunggu menu muncul, lalu jalankan **snippet yang sama persis** dengan Task 0 Step 3. Bandingkan dengan `/tmp/sur3d-parity-baseline.json`:

Run: `cat /tmp/sur3d-parity-baseline.json`
Expected: `|callsMean_baru − callsMean_baseline| / callsMean_baseline ≤ 0,05` dan hal yang sama untuk `trianglesMean`. `memory.geometries`/`memory.textures` boleh sedikit berbeda (cache per scope region vs global: entitas yang memakai `roundedBox`/`makeTextMaterial` kini punya instans sendiri), tetapi tidak boleh tumbuh antar pengukuran ulang.

- [ ] **Step 6: Cek konsol dan siklus malam/hujan**

Di konsol halaman yang sama:

```js
(async () => {
  const s = window.__sim;
  s.store.set('sky.hour', 21);
  s.store.set('weather.raining', true);
  await new Promise((r) => setTimeout(r, 4000));
  return { lampsOn: s.time.preset.lampsOn, raining: s.weather.isRaining, disabled: s.app.systems.disabled };
})();
```

Expected: `{ lampsOn: true, raining: true, disabled: [] }`; tidak ada galat merah di konsol; secara visual lampu PJU, floodlight, lampu angkot/bus, dan genangan tampak seperti sebelum refactor.

- [ ] **Step 7: Teardown bersih**

Di konsol: `window.__sim.teardown(); document.querySelector('#app canvas')`
Expected: `null` (kanvas dilepas), tidak ada galat konsol baru; muat ulang halaman memulai aplikasi normal kembali. Hentikan dev server.

- [ ] **Step 8: Ringkasan riwayat**

Run: `git log --oneline 29ac7bc..HEAD`
Expected: 12 commit (Task 1–12), pesan conventional commit.

---

## Self-review

**Cakupan spec Fase 0 → task**

| Spec Fase 0 | Task |
|---|---|
| 1. SystemRunner menggantikan updatable raksasa (`main.js:118-134`) dan `App.#safeUpdate`; isolasi galat; nonaktif setelah 3× dengan id | 2 |
| 2. ResourceScope + disposeTree; cache modul & material saat-impor ke scope | 3, 4, 5 |
| 3. `SITE`/`STADIUM`/`LAYOUT` diinjeksi; `buildWorld()` → `regions/stadion.build(ctx)`; bertahap | 6 (site/layout/mask/index, `buildWorld({layout, site})`), 7 (collider berparameter) |
| 4. TimeOfDay/Weather/lampu/hujan di grup pemilik; registry emissive/basah | 8 |
| 5. `dispose()` App/Input/Weather/entitas; panggil dispose yang dibuang (`main.js:137,148,240`) | 11 (`bindAll` → disposer, `createRotatePrompt().dispose`, `mountSettingsPanel().dispose`, `CameraRig.dispose`, `Bicycle.dispose`) |
| 6. Layering: `minimapMath` → shared; collider lewat region; StoryDirector lewat callback | 7, 10 |
| 7. `main.js` dipecah (composition, keymap, shop, session, devtools) | 1 (+ `lifecycle.js` di 11) |
| 8. Bug dompet: save v2, migrasi v1→v2, tanpa credit-ulang | 12 |
| 9. Kebenaran tunggal tugu & PJU rusak; collider danau mengikuti bentuk visual | 9 |
| §5 Save rusak → `*.bak`; sistem galat 3× dinonaktifkan | 12, 2 |
| §6 TDD: SystemRunner, ResourceScope, mask, migrasi save; coverage 90/85 modul murni | 2, 3, 6, 12, 13 |
| Kriteria sukses 1 (paritas ±5%) | 0, 13 |

**Keputusan yang menyimpang dari teks spec (disengaja)**

- Urutan task diubah dari daftar permintaan: pemecahan `main.js` di depan (pemindahan murni, memperkecil diff berikutnya), region sebelum registry (registry butuh `lensRoot`/`lamps` dari region), collider sebelum kebenaran tunggal.
- `geo/regionTransform.js` ditarik maju dari Fase 1 karena collider komposit butuh `toLocal`.
- `regions/*` boleh mengimpor `world/*` (builder handmade); spec §3 hanya mendaftar `engine, geo, shared, config`. Aturan ESLint mengikuti kenyataan ini.
- Migrasi v1: saldo = `VENDOR.startBalance + rupiah` (yang dilihat pemain pada load berikutnya di kode lama), bukan `rupiah` mentah — agar migrasi tidak memotong 50.000 saldo awal.
- "Mulai dari awal" kini juga mengembalikan dompet ke saldo awal (dulu dompet sesi dibiarkan dan saldo kembali ke 50.000 hanya setelah reload).
- Collider region memakai `(lx, lz)`; parameter `clear`/`ly` di kontrak spec ditunda ke Fase 2 karena belum ada pemakai.
- Hotkey berpindah ke fase `input` (efek satu frame lebih awal, tanpa beda visual); label NPC & minimap kini di fase `ui` setelah kamera.

**Utang yang sengaja ditunda**

- `config/constants.js` masih me-re-export `STADIUM`/`SITE`; builder dalam (`world/stadium/*`, `Ground*`, `Landscape*`, `Grass.placement`, `Decals.layout`, `Flagpole`, `Gapura`, `ovalFrame` → koridor gate) masih impor default. Hanya `buildWorld`, tugu (Monument), dan collider yang diinjeksi. Target: Fase 3 saat placement non-identitas.
- 12 berkas masih punya material/geometri saat-impor (±59 objek): `Landscape.trees`, `Landscape.water`, `props/Bench`, `props/Cart` (+ `matCache`), `props/Gapura`, `props/LampPost`, `props/Monument`, `props/Planter`, `props/TrashBin`, `props/Vehicles`, `Footballer.ball` (`sharedGeo/sharedMat`). `disposeTree` tetap melepas GPU-nya, tetapi objeknya bertahan di modul dan dipakai ulang saat build berikutnya.
- Data region-spesifik masih di sistem global: posisi genangan (`Weather.wet` memakai `SITE`), floodlight (`TimeOfDay.lights` memakai `STADIUM`), tanah 1.400 m sebagai fallback collider. Pindah ke `region.systems` di Fase 3.
- `minimapLayer` region masih no-op (peta dasar tetap di-bake `App.bakeMinimap`); diisi Fase 2.
- `sim/trackPath.js` mengimpor three, jadi aturan "sim murni tanpa three" belum ditegakkan.
- `session` tetap objek yang dimutasi (pemindahan murni); `StoryDirector` masih memegang `storyHud`/`journal` (spec hanya meminta HUD).
- `StoryNpcs`/`StoryMarkers` belum didaftarkan ke disposer composition root.
- Material emissive GLB kini selalu ikut siklus malam (dulu bergantung balapan muat) — perbedaan kecil yang disengaja, dicatat di Task 8.
