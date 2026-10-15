# Audit & Roadmap Perbaikan Simulator Stadion Utama Riau

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans untuk mengeksekusi rencana ini task per task. Langkah memakai checkbox (`- [ ]`).

**Goal:** Memperbaiki bug nyata, menaikkan FPS, menghidupkan suasana malam, merapikan alur misi/UX, dan memperkuat tes/CI/dokumentasi, berdasarkan audit kode 2026-10-14 (main @ `ceb8f70`).

**Architecture:** Audit oleh 5 agen paralel (performa, bug/lifecycle, gameplay/UX, visual/fakta, DX/CI), klaim kritis diverifikasi ulang langsung di kode. Perbaikan dikelompokkan 6 fase berurutan dampak/usaha. Fase 1 (bug terbukti) ditulis lengkap per langkah dengan TDD; Fase 2-6 ditulis sebagai paket tugas dengan file, pendekatan, dan kriteria selesai, lalu dirinci menjadi rencana bite-sized sebelum dieksekusi (supaya angka profiling Fase 2 menentukan Fase 3).

**Tech Stack:** Three.js 0.186, Vite 8 (Rolldown), Vitest 5, jsdom (hanya `tests/uiPanel.test.js`).

---

## Baseline (terukur)

| Metrik | Nilai |
|---|---|
| Tes | 25 file / 211 tes lulus; vitest ±8 dtk (sisanya overhead `npx` di Windows) |
| Build | berhasil; bundel `index-*.js` 980 kB (gzip 280 kB); 2 peringatan `INEFFECTIVE_DYNAMIC_IMPORT` |
| Render per frame (viewport 1280x720) | 774 draw call + 2,27 jt segitiga; shadow pass +317 call/2,12 jt tri; 1549 mesh |
| Waktu render | 31,1 ms CPU; 15,5 ms bila `entities` disembunyikan (humanoid = 545 dari ±755 draw call) |
| FPS screenshot lama | 21-28 fps |
| Konsol | 1 peringatan shader HLSL X4122 (tidak berbahaya) |

## Temuan terverifikasi langsung di kode (saya baca sendiri)

| # | Temuan | Bukti |
|---|---|---|
| V1 | Esc tidak menutup dialog toko (dan bila diperbaiki naif, Esc malah bisa MEMBUKA toko) | `src/main.js:184-187`: `consumePress('Escape')` di baris 184 selalu menghabiskan tombol, cabang `else if` tak pernah true. `handleShopKey` (baris 204) adalah toggle |
| V2 | Klik dialog cerita & tombol jurnal mati | `src/ui/hud.css:14` `#hud{pointer-events:none}`; `#story-dialog` (101) & `#story-journal` (107) tidak menimpa |
| V3 | Chapter 5 bisa macet permanen | `src/story/eggTriggers.js:44` mengabaikan egg yang sudah ada; `reducer.js:24` `enter` & `:92` `hydrate` mereset `progress.found` ke kosong |
| V4 | Teks easter egg tertimpa toast hadiah | `reducer.js:57` mengeluarkan 2 efek; `HUD.js:110` `toast()` menimpa `textContent` |
| V5 | Matahari→bulan meloncat (arah ±150°, intensitas 0→0,6 dalam 1 frame) | `src/world/TimeOfDay.js:90,96` |
| V6 | `PMREMGenerator` dibuat ulang tiap rebuild env (27 ms vs 2,1 ms bila dipakai ulang) + render target lama tidak di-dispose | `src/world/Lighting.js:168-175` |

Klaim lain di bawah berasal dari agen dan ditandai **[agen]**; verifikasi ulang dilakukan di langkah pertama tiap task.

## Koreksi atas klaim agen

- Kapasitas: agen visual menghitung ±41.100 kursi, agen performa mengukur 38.722 instance kursi (riset: 38.480). **Kapasitas sudah cocok; prioritas rendah.** Yang tetap benar: rasio tier bawah:atas terbalik dan VIP ±260 vs 120.
- Waktu tes "55 dtk" adalah overhead npx, bukan masalah vitest.
- Pengukuran FPS nyata tidak bisa saya ambil (panel browser tersembunyi menahan `requestAnimationFrame`); semua angka ms di atas adalah CPU/submit dari agen performa dan **harus diukur ulang di perangkat target** sebelum Fase 3.

---

## Peta Fase

| Fase | Tema | Isi ringkas | Usaha |
|---|---|---|---|
| 1 | Bug terbukti (kecil, aman) | V1-V6, schema `coerceValue`, `safeStorage`, flush settings, try/catch update loop, timeout GLB | S x 11 |
| 2 | Performa (ukur → perbaiki) | matrix world 1x, culling/shadow humanoid, merge gerobak, lampu, MSAA, minimap, bundel | S-M |
| 3 | Malam & atmosfer | halo lampu, uplight stadion, matahari/bulan terlihat, penonton 12-20 rb, saturasi kursi | S-M |
| 4 | Misi, kontrol, UX | soft-lock uang, panah tujuan, input vs fokus panel, HUD responsif, aria-live, sfx | S-M |
| 5 | DX/CI/dokumentasi | CI untuk PR, lint, coverage, README, LICENSE, .gitignore | S-M |
| 6 | Konten & fitur besar | serindit/sawit/gerobak (Blender), sentuh/gamepad, misi dipengaruhi waktu & cuaca | L |

Urutan wajib: 1 → 2 (ukur) → 3. Fase 4 dan 5 independen dan bisa paralel dengan 2-3 (file berbeda: lihat konflik di bawah).

**Konflik file antar fase:** `src/main.js` (Fase 1 & 4), `src/world/TimeOfDay.js` (Fase 1 & 3), `src/core/App.js` (Fase 2 & 1). Jalankan Fase 1 lebih dulu, lalu fase lain boleh paralel di worktree terpisah.

---

# FASE 1: Bug terbukti

Jalankan tes dengan `node node_modules/vitest/vitest.mjs run <file>` (lebih cepat dari `npx` di Windows).

### Task 1: Chapter 5 tidak boleh macet (V3)

**Files:**
- Modify: `src/sim/story/reducer.js` (`enter`, `hydrate`, `dispatch`)
- Test: `tests/storyReducer.test.js`

Desain: saat masuk langkah bertipe `find`, `progress.found` diisi dari `s.eggs ∩ objective.ids`. Bila sudah lengkap (semua egg ditemukan sebelumnya), langkah diselesaikan pada event non-`egg` berikutnya (tick datang tiap frame), sehingga dialog intro tetap tampil dulu karena `reduce` menahan event selama dialog terbuka.

- [ ] **Step 1: Tulis tes yang gagal** (tambahkan di akhir `describe('createStory', ...)`; data uji sudah punya chapter `c2` step `s4` bertipe `find` dengan `ids:['e1']`)

```js
describe('langkah find dengan egg yang sudah ditemukan lebih dulu', () => {
  const atFind = (eggsFound) => {
    const base = story.hydrate({ chapter: 1, step: 1, eggs: eggsFound, badges: [], bestLap: null, rupiah: 0, finished: false });
    return base;
  };

  it('hydrate mengisi progress.found dari egg tersimpan', () => {
    expect(atFind(['e1']).progress.found).toEqual(['e1']);
    expect(atFind([]).progress.found).toEqual([]);
  });

  it('egg yang sudah lengkap menyelesaikan langkah pada event berikutnya', () => {
    const { state } = story.reduce(atFind(['e1']), { type: 'tick', dt: 0.016 });
    expect(state.finished).toBe(true);
  });

  it('enter dari langkah sebelumnya memakai egg yang sudah ditemukan', () => {
    let s = story.hydrate({ chapter: 1, step: 0, eggs: ['e1'], badges: [], bestLap: null, rupiah: 0, finished: false });
    s = story.reduce(s, { type: 'lapDone', seconds: 5 }).state; // selesaikan 'laps' -> masuk s4 (find)
    expect(s.progress.found).toEqual(['e1']);
  });

  it('egg yang belum ada tetap dihitung lewat event egg', () => {
    const s0 = atFind([]);
    const { state } = story.reduce(s0, { type: 'egg', id: 'e1' });
    expect(state.finished).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `node node_modules/vitest/vitest.mjs run tests/storyReducer.test.js`
Expected: FAIL pada 3 tes pertama (`found` bernilai `[]`, `finished` false).

- [ ] **Step 3: Implementasi minimal** di `src/sim/story/reducer.js`

Ganti `enter` dan tambahkan `seedFound` dan `findDone`:

```js
  /** Untuk langkah `find`: egg yang sudah ditemukan sebelum langkah ini ikut dihitung. */
  const seedFound = (s) => {
    const o = stepOf(s).objective;
    if (o.type !== 'find') return s;
    const found = o.ids.filter((id) => s.eggs.includes(id));
    return found.length ? { ...s, progress: { count: 0, found } } : s;
  };

  const findDone = (s) => {
    const o = stepOf(s).objective;
    return o.type === 'find' && s.progress.found.length >= o.ids.length;
  };

  const enter = (s, lead = [], silent = false) => {
    const step = stepOf(s);
    const lines = silent ? [] : [...lead, ...(step.say ?? [])];
    return seedFound({ ...s, progress: EMPTY_PROGRESS, timeLeft: step.timeLimit ?? null, dialog: lines.length ? { lines, index: 0 } : null });
  };
```

Di `dispatch`, setelah baris `if (s.finished) return [s, []];` tambahkan:

```js
    if (event.type !== 'egg' && findDone(s)) return completeStep(s, []);
```

Di `hydrate`, ganti `const s = {...}` menjadi:

```js
      const s = seedFound({ ...initial(), ...save, progress: EMPTY_PROGRESS, dialog: null });
```

(Catatan: `initial()` memanggil `enter` pada chapter 0 yang bertipe `goto`, jadi aman. `seedFound` di `hydrate` dipanggil setelah `chapter/step` dari `save` diterapkan.)

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `node node_modules/vitest/vitest.mjs run tests/storyReducer.test.js tests/storyObjectives.test.js tests/storyEggTriggers.test.js`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add src/sim/story/reducer.js tests/storyReducer.test.js
git commit -m "fix: chapter find tidak macet bila egg sudah ditemukan sebelumnya"
```

### Task 2: Esc hanya menutup, tidak pernah membuka toko (V1)

**Files:**
- Create: `src/core/escapeRoute.js`
- Modify: `src/main.js:184-187`
- Test: `tests/escapeRoute.test.js`

- [ ] **Step 1: Tes yang gagal**

```js
import { describe, it, expect } from 'vitest';
import { routeEscape } from '../src/core/escapeRoute.js';

describe('routeEscape', () => {
  it('jurnal terbuka -> tutup jurnal (prioritas)', () => {
    expect(routeEscape({ journalOpen: true, shopOpen: true })).toBe('journal');
  });
  it('toko terbuka -> tutup toko', () => {
    expect(routeEscape({ journalOpen: false, shopOpen: true })).toBe('shop');
  });
  it('tidak ada yang terbuka -> tidak melakukan apa pun (jangan membuka toko)', () => {
    expect(routeEscape({ journalOpen: false, shopOpen: false })).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan** `node node_modules/vitest/vitest.mjs run tests/escapeRoute.test.js` → FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

`src/core/escapeRoute.js`:

```js
/** Esc menutup lapisan teratas: jurnal dulu, lalu toko; tidak pernah membuka apa pun. */
export function routeEscape({ journalOpen, shopOpen }) {
  if (journalOpen) return 'journal';
  if (shopOpen) return 'shop';
  return null;
}
```

Di `src/main.js` tambahkan `import { routeEscape } from './core/escapeRoute.js';` dan ganti baris 184-187 menjadi:

```js
  const escTarget = input.consumePress('Escape')
    ? routeEscape({ journalOpen: story.journal.open, shopOpen: hud.shopOpen })
    : null;
  if (escTarget === 'journal') story.journal.hide();
  if (input.consumePress('KeyE')) {
    if (hud.shopOpen || !story.tryInteract(ents.bike.state)) handleShopKey(rig, hud, ents, shop);
  } else if (escTarget === 'shop') handleShopKey(rig, hud, ents, shop);
```

(Urutan `consumePress('KeyE')` dipertahankan seperti semula; `KeyJ` di baris sebelumnya tidak berubah.)

- [ ] **Step 4: Jalankan** tes baru + `node node_modules/vitest/vitest.mjs run` penuh → PASS.
- [ ] **Step 5: Verifikasi manual** (`npx vite --port 5190`): dekati pedagang, E (toko terbuka), Esc (tertutup); Esc saat tidak ada toko di dekat pedagang tidak membuka toko.
- [ ] **Step 6: Commit** `git commit -m "fix: Esc menutup toko/jurnal dan tidak membuka toko"`

### Task 3: Dialog & jurnal bisa diklik, pointer lock dilepas saat jurnal (V2)

**Files:**
- Modify: `src/ui/hud.css` (setelah `#story-dialog`/`#story-journal`), `src/core/StoryDirector.js:159-162`

- [ ] **Step 1:** Tambahkan di `hud.css`:

```css
#story-dialog, #story-journal { pointer-events: auto; }
```

- [ ] **Step 2:** Ubah `toggleJournal` di `StoryDirector.js` supaya melepas pointer lock saat dibuka (agar tombol terklik) dan meminta lock lagi saat ditutup:

```js
  toggleJournal() {
    if (this.journal.open) {
      this.journal.hide();
      this.rig?.requestLock?.();
      return;
    }
    document.exitPointerLock?.();
    this.journal.show(this.#journalView());
  }
```

Sebelum mengedit, baca `StoryDirector.js` konstruktor: bila `rig` belum disimpan di `this`, teruskan lewat opsi konstruktor (pola yang sama dengan `hud`), dan sesuaikan pemanggil di `src/main.js` `setupStory`.

- [ ] **Step 3: Verifikasi manual:** buka dialog, klik untuk lanjut; J membuka jurnal, klik "Mulai ulang cerita" meminta konfirmasi kedua kali; "Tutup" menutup.
- [ ] **Step 4: Commit** `git commit -m "fix: dialog dan jurnal cerita dapat diklik"`

### Task 4: Teks easter egg dan hadiah tidak saling menimpa (V4)

**Files:**
- Modify: `src/ui/HUD.js` (`toast`), `src/core/StoryDirector.js:73-78` (penerapan efek), `src/ui/hud.css` (`#hud-toast` vs `#story-dialog`)

- [ ] **Step 1:** Baca `StoryDirector.js:60-90` (penerapan efek `toast`/`reward`). Pastikan konsep dulu: dua efek berturut-turut (egg `toast` lalu `reward`) harus menjadi satu pesan atau antrean.
- [ ] **Step 2:** Tes jsdom (di `tests/hud.test.js` baru, `// @vitest-environment jsdom`): panggil `toast('A')` lalu `toast('B')`, lalu `advanceTimersByTime(2300)` → teks 'A' sempat tampil lebih dulu dan 'B' sesudahnya (antrean FIFO), durasi = `max(TOAST_MS, 55 ms x panjang teks)`.
- [ ] **Step 3:** Ubah `HUD.toast` menjadi antrean FIFO dengan durasi proporsional panjang teks; naikkan `#hud-toast` ke `z-index` di atas dialog (`bottom` di atas `#story-dialog`, mis. `bottom: 190px`) agar hadiah tidak tertutup dialog `outro`.
- [ ] **Step 4:** Jalankan seluruh tes, lalu verifikasi manual (cari jejak-2 → teks egg terbaca penuh, lalu "+Rp ...").
- [ ] **Step 5: Commit** `git commit -m "fix: antrean toast agar teks easter egg tidak tertimpa"`

### Task 5: `coerceValue` menolak null/''/[]/boolean untuk field numerik

**Files:** Modify `src/settings/schema.js:135` · Test `tests/settingsStore.test.js`

- [ ] **Step 1: Tes gagal**

```js
import { SETTINGS_SCHEMA, coerceValue, listFields } from '../src/settings/schema.js';

it('coerceValue: nilai non-numerik jatuh ke default, bukan minimum', () => {
  const [, fov] = listFields(SETTINGS_SCHEMA).find(([k]) => k === 'camera.fov');
  for (const bad of [null, '', [], true, undefined, {}]) {
    expect(coerceValue(fov, bad)).toBe(fov.default);
  }
  expect(coerceValue(fov, '70')).toBe(70);
});
```

- [ ] **Step 2:** Jalankan → FAIL (`null` → 40).
- [ ] **Step 3: Implementasi** ganti `const n = Number(value);` dengan:

```js
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
  const n = isNumeric ? Number(value) : NaN;
```

- [ ] **Step 4:** Jalankan `settingsStore` + `bindings` → PASS. **Step 5:** `git commit -m "fix: coerceValue menolak null dan nilai non-numerik"`

### Task 6: `safeLocalStorage` tidak mematikan baca saat kuota penuh

**Files:** Modify `src/settings/safeStorage.js` · Create `tests/safeStorage.test.js`

- [ ] **Step 1: Tes gagal**

```js
import { describe, it, expect } from 'vitest';
import { safeLocalStorage } from '../src/settings/safeStorage.js';

const fakeWin = (ls) => ({ localStorage: ls });
const storage = (overrides = {}) => {
  const data = new Map([['k', 'v']]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k), ...overrides };
};

describe('safeLocalStorage', () => {
  it('null bila localStorage tidak ada atau getter melempar', () => {
    expect(safeLocalStorage(null)).toBeNull();
    expect(safeLocalStorage({ get localStorage() { throw new Error('denied'); } })).toBeNull();
  });
  it('kuota penuh (setItem melempar) tetap mengembalikan storage agar data lama terbaca', () => {
    const ls = storage({ setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } });
    expect(safeLocalStorage(fakeWin(ls))).toBe(ls);
  });
  it('akses ditolak saat getItem melempar -> null', () => {
    const ls = storage({ getItem: () => { throw new Error('denied'); } });
    expect(safeLocalStorage(fakeWin(ls))).toBeNull();
  });
});
```

- [ ] **Step 2:** Jalankan → tes kuota penuh FAIL.
- [ ] **Step 3: Implementasi**

```js
export function safeLocalStorage(win = typeof window !== 'undefined' ? window : null) {
  try {
    const ls = win?.localStorage;
    if (!ls) return null;
    ls.getItem(PROBE_KEY); // baca ditolak -> tidak dapat dipakai sama sekali
    try {
      ls.setItem(PROBE_KEY, '1');
      ls.removeItem(PROBE_KEY);
    } catch {
      // kuota penuh: tetap dipakai agar data yang sudah ada dapat dibaca
    }
    return ls;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4:** PASS. **Step 5:** `git commit -m "fix: safeLocalStorage tetap dapat membaca saat kuota penuh"`

### Task 7: Pakai ulang PMREMGenerator dan dispose render target (V6)

**Files:** Modify `src/world/Lighting.js:163-180`

Tidak bisa diuji unit (perlu WebGL); verifikasi dengan pengukuran.

- [ ] **Step 1:** Baca `Lighting.js:150-190` (konteks `createEnvironment`, nilai kembalian `rebuildEnvironment`).
- [ ] **Step 2:** Implementasi: satu generator seumur hidup, simpan `envTarget`, dispose target lama:

```js
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = null;
  const rebuild = () => {
    try {
      const next = pmrem.fromScene(envScene, ENV_SIGMA);
      envTarget?.dispose();
      envTarget = next;
      scene.environment = next.texture;
      scene.environmentIntensity = ENV_INTENSITY;
    } catch {
      /* pertahankan blok catch yang sudah ada */
    }
  };
```

Tambahkan `dispose()` pada objek hasil (`pmrem.dispose(); envTarget?.dispose();`) bila struktur kembalian memungkinkan.

- [ ] **Step 3: Ukur:** di dev server, tekan `T` (jam berjalan) dan bandingkan hitch tiap ±4 dtk sebelum/sesudah dengan `performance.now()` di sekitar `rebuild()` (target: 27 ms → ±2 ms).
- [ ] **Step 4:** `git commit -m "perf: pakai ulang PMREMGenerator dan dispose env target lama"`

### Task 8: Transisi matahari ↔ bulan halus (V5)

**Files:** Modify `src/sim/dayCycle.js` (helper murni), `src/world/TimeOfDay.js:86-100` · Test `tests/timeOfDayMath.test.js`

- [ ] **Step 1: Tes gagal**

```js
import { sunMoonWeight } from '../src/sim/dayCycle.js';

describe('sunMoonWeight', () => {
  it('0 di bawah -band, 1 di atas +band, 0,5 di horizon', () => {
    expect(sunMoonWeight(-20)).toBe(0);
    expect(sunMoonWeight(20)).toBe(1);
    expect(sunMoonWeight(0)).toBeCloseTo(0.5, 5);
  });
  it('monoton dan kontinu (tanpa loncatan > 0,05 per 0,5 derajat)', () => {
    let prev = sunMoonWeight(-10);
    for (let e = -9.5; e <= 10; e += 0.5) {
      const w = sunMoonWeight(e);
      expect(w).toBeGreaterThanOrEqual(prev);
      expect(w - prev).toBeLessThan(0.05 + 1e-9);
      prev = w;
    }
  });
});
```

- [ ] **Step 2:** Jalankan → FAIL (belum diekspor).
- [ ] **Step 3: Implementasi** di `dayCycle.js`:

```js
const BLEND_BAND_DEG = 6;
/** Bobot matahari terhadap bulan: 0 (malam) → 1 (siang), smoothstep di sekitar horizon. */
export function sunMoonWeight(elevationDeg, band = BLEND_BAND_DEG) {
  const t = Math.min(1, Math.max(0, (elevationDeg + band) / (2 * band)));
  return t * t * (3 - 2 * t);
}
```

Di `TimeOfDay.js`: `applyDirection` mencampur arah `_sunDir` dan `_moonDir` dengan `w = sunMoonWeight(sun.elevationDeg)` lalu `normalize()` (simpan ke vektor sementara baru `_lightDir`; `L.setSkyDirection(_sunDir)` tidak berubah), dan `applyPreset` memakai:

```js
const w = sunMoonWeight(sun.elevationDeg);
L.sun.intensity = p.sunIntensity * fade * w + MOON_MAX_INTENSITY * (1 - w);
```

Catatan: `applyDirection` ber-cache per jam (`lastDirHour`); karena cache sudah dipakai per perubahan jam tiap frame, cukup tetap seperti ada. Verifikasi di browser bahwa bayangan tidak berputar mendadak di jam 18.3 dan 06.0 (geser jam dengan `[` `]` dan `T`).

- [ ] **Step 4:** PASS + build. **Step 5:** `git commit -m "fix: transisi matahari-bulan halus tanpa loncatan arah dan intensitas"`

### Task 9: Ketahanan runtime (App loop, GLB, settings flush)

**Files:** Modify `src/core/App.js:157-158`, `src/main.js:116`, `src/world/assets/models.js:22-23`, `src/main.js` (pagehide)

- [ ] **Step 1: Update loop aman.** Bungkus tiap `u.update(dt, ctx)` dengan try/catch yang mencatat error sekali lalu menonaktifkan updatable tersebut (`this.updatables.delete`/`Set`), supaya `render()` tetap jalan.

```js
for (const u of [...this.updatables]) {
  try { u.update(dt, ctx); } catch (err) {
    console.error('Updatable gagal, dinonaktifkan:', err);
    this.updatables.splice(this.updatables.indexOf(u), 1);
  }
}
```

(Sesuaikan `splice` bila `updatables` berupa `Set`.)

- [ ] **Step 2: Jangan blokir "Mulai" oleh GLB.** `Promise.race([modelsReady, new Promise((r) => setTimeout(r, 8000))])` di `main.js:116`; di `models.js` hapus entri cache saat gagal (`.catch((e) => { cache.delete(url); throw e; })`). Fallback prosedural sudah ada.
- [ ] **Step 3: Flush settings.** Di `main.js` setelah `store` dibuat: `addEventListener('pagehide', () => store.flush())` dan `visibilitychange` (hidden → flush).
- [ ] **Step 4:** Jalankan seluruh tes dan `vite build`. **Step 5:** `git commit -m "fix: ketahanan loop update, timeout GLB, flush settings saat pagehide"`

### Task 10: Gerbang Fase 1

- [ ] `node node_modules/vitest/vitest.mjs run` (semua lulus), `npx vite build` (berhasil), verifikasi manual daftar di Task 2-4 dan 8, lalu buka PR "fix: bug terbukti hasil audit" dan jalankan reviewer `general-purpose` (bukan `code-reviewer` bawaan, lihat memori proyek).

---

# FASE 2: Performa (ukur dulu)

Prinsip: tiap perubahan diukur dengan panel Performa (draw call/segitiga) dan `renderer.info`, dibandingkan baseline di atas. Render saat ini terikat CPU/draw call.

| Task | Perubahan | File | Perkiraan hasil | Usaha |
|---|---|---|---|---|
| 2.1 | `scene.matrixWorldAutoUpdate = false` + satu `scene.updateMatrixWorld()` di awal `App.render` (kini 2-3x per frame oleh composer, label, minimap) | `src/core/App.js:177-205` | -2 sampai -4 ms CPU | S |
| 2.2 | Humanoid jauh (> ±90 m) disembunyikan dan animasinya dilewati; `castShadow` hanya < ±40 m | `src/entities/index.js`, `Humanoid.js:34-39`, `Runner.js` | -100 sampai -250 draw call (terbesar) | S |
| 2.3 | `mergeByMaterial(cart)` pada gerobak | `src/entities/Vendor.js:46-56` | -±90 draw call | S |
| 2.4 | Minimap: render 5-10 Hz (bukan tiap 2 frame) | `src/core/App.js:19,186-206` | -±4,6 ms CPU | S |
| 2.5 | `antialias:false` + `samples:4` pada render target composer (atau SMAA) | `src/core/App.js:212,247-251` | hemat memori MSAA sia-sia, scene benar-benar antialias | S |
| 2.6 | Kurangi `PointLight` malam 12 → 4-6; gunakan kolam cahaya palsu yang sudah ada | `src/world/TimeOfDay.lights.js:61-123` | -±2 ms CPU + beban fragment (ukur GPU) | M |
| 2.7 | Impor statis `CSS2DRenderer` & `Cart.js` (hilangkan 2 peringatan); chunk `three` terpisah via `build.rolldownOptions.output.codeSplitting`; lazy-load `GLTFLoader`, story, `GTAOPass` | `vite.config.js`, `Vendor.js:31,48`, `StoryNpcs.js:15`, `models.js:2`, `App.js:233` | -10-15% bundel awal; cache `three` stabil | S-M |
| 2.8 | Tekstur prosedural: `fbm` tanpa alokasi, turunkan map ke 256 atau bake saat build | `src/world/textures/noise.js`, `surfaces.js` | startup lebih cepat (ukur di perangkat target) | M |
| 2.9 | Bagi instansi pohon/semak per grid 4x4 supaya frustum culling bekerja | `Landscape.trees.js:92`, `siteutil/instanceParts.js:26` | GPU (ukur) | M |
| 2.10 | Kompres `lancang-kuning.glb` (1,12 MB, 41k tri, tanpa kompresi) dengan `gltfpack -cc`; batasi shadow caster | `public/models/monumen/`, `models.js:41` | -60-75% ukuran | S-M |
| 2.11 | Story: dispatch `tick` hanya saat timer aktif; render HUD hanya saat detik berubah | `StoryDirector.js:90-113`, `StoryHUD.js:31` | kecil | S |
| 2.12 | `hud.tickFps` memakai delta mentah, bukan dt yang di-clamp | `main.js:97`, `App.js:153` | FPS HUD jujur | S |

**Kriteria selesai Fase 2:** draw call utama turun dari 774 ke ≤ 450, waktu render CPU dari 31 ms ke ≤ 18 ms di mesin yang sama, tanpa regresi visual (bandingkan screenshot `docs/screenshots/`).

---

# FASE 3: Malam, atmosfer, dan kepadatan visual

Dikerjakan setelah Fase 2 karena menambah beban render. Semua poin **[agen visual]**, dengan bukti dari kode dan screenshot.

| Task | Perubahan | File | Usaha |
|---|---|---|---|
| 3.1 | Cakram matahari/bulan + halo + glow senja di shader awan (kubah awan kini menutup Sky; bulan hanya ada di UI dial) | `src/world/StylizedClouds.js:90-107`, `TimeOfDay.js` | S-M |
| 3.2 | Halo additive instanced pada lensa floodlight dan lampu PJU (kini titik putih datar) atau UnrealBloom setengah resolusi | `Fixtures.js:62`, `App.js:225-243` | S / M |
| 3.3 | Stadion menyala malam: uplight palsu pada rib/louvre (emissive gradient), hemisphere biru malam | `stadium/ShellRibs.js`, `FacadeLouvre.js`, `TimeOfDay.lights.js` | M |
| 3.4 | Bayangan bulan lembut/dimatikan saat intensitas rendah | `TimeOfDay.js:25`, `Lighting.js:19-24` | S |
| 3.5 | Hujan malam: warna/opacity mengikuti luminansi preset; bintang tertutup awan saat hujan | `Weather.rain.js:11-12`, `TimeOfDay.js:116` | S |
| 3.6 | Penonton 3.200 → 12-20 rb (instanced, 1 draw call) dan saturasi kursi diturunkan | `world/layout.js:94`, `Tribune.seats.js:17,30` | S |
| 3.7 | Tekstur pitch di-tile per strip + detail noise (kini 14 cm/texel, blotchy) | `stadium/Pitch.js:11-12` | S-M |
| 3.8 | Permukaan basah memantulkan langit (envMap basah efektif ~0,18, hampir tak terlihat) | `Lighting.js:16`, `constants.js WEATHER.wetEnvIntensity` | S |
| 3.9 | Rapikan konstanta: hapus `STADIUM.seatColors` mati; dokumentasikan asumsi VIP (±260 vs 120), rasio tier terbalik, footprint +18% sumbu panjang, warna lintasan salmon vs bata (keputusan gaya) | `constants.js:29,41-48` | S |

**Kriteria selesai:** 4 screenshot waktu (pagi, siang, sore, malam) + malam-hujan di `docs/screenshots/time-of-day/` menunjukkan matahari/bulan terlihat, lampu bercahaya, stadion terbaca malam; FPS tidak lebih rendah dari akhir Fase 2.

---

# FASE 4: Misi, kontrol, dan UX

Semua **[agen gameplay]** kecuali yang sudah ditandai V1-V4 di atas.

| Task | Perubahan | File | Usaha |
|---|---|---|---|
| 4.1 | Soft-lock uang: bila saldo < harga item objective `buy`, subsidi atau pesan jelas; dompet dan item tersimpan di save | `StoryDirector.js:47-51`, `vendorSim.js:89-96`, `story/storage.js` | S-M |
| 4.2 | Panah/jarak tujuan di HUD; `goalPoint` untuk objective `buy` menunjuk ke pedagang terdekat yang menjual item; teks "masuk lewat gerbang utara" untuk Coach Dedi | `StoryDirector.js:121-131`, `StoryHUD.js` | S |
| 4.3 | Egg tidak terpicu tak sengaja: `bangku-keramat` dan `jejak-*` hanya aktif pada chapter tertentu atau butuh tombol E; jendela `bola-tengah-malam` dilebarkan (23:30-00:30); event egg diantrekan saat dialog terbuka | `easterEggs.js:12,16`, `eggTriggers.js:15,36`, `reducer.js:102` | S |
| 4.4 | Timer chapter berhenti saat toko/jurnal/POV beku dan di-reset (`lap`) saat waktu habis | `StoryDirector.js:92,164` | S |
| 4.5 | Input game diabaikan bila fokus di kontrol panel; modifier (Ctrl+R) tidak memicu hotkey; input tidak aktif sebelum tombol "Mulai" diklik | `core/Input.js:7-12`, `main.js:177-188,108`, `Panel.js:137` | S |
| 4.6 | HUD responsif (`@media`), jangan menimpa minimap; `aria-live` pada toast/dialog/prompt; `role="dialog"` + fokus jurnal; `prefers-reduced-motion` untuk `pulse`; kontras teks muted | `hud.css`, `StoryJournal.js:21` | S-M |
| 4.7 | Onboarding: overlay awal memuat J, 1-7, P, H; hint WASD/E di dialog pertama | `index.html:22-30`, `chapters.js` | S |
| 4.8 | Sfx sintetis (Web Audio) untuk hadiah/chapter/egg lewat kanal `sfx` di `AudioBus`; peringatan visual sisa waktu < 30 dtk | `core/AudioBus.js`, `StoryHUD.js` | S |
| 4.9 | Selaraskan teks dan fakta: klaim "AIR MOLEK"/"air jernih" (riset hanya menyebut kemungkinan), hint `bel-satpam` (syarat 3x dalam 4 dtk radius 12 m), `Air Mineral Pak Dedi` vs `Coach Dedi`, jumlah gelar spec 4 vs kode 6; label NPC mengikuti `LABEL_DISTANCE` dan toggle label | `chapters.js:81,86`, `StoryNpcs.js:11-37`, spec | S |

**Kriteria selesai:** tidak ada jalur soft-lock (uji tes reducer untuk tiap kondisi), semua teks egg terbaca, kontrol bisa dipakai di lebar 375 px, README kontrol sama dengan HUD.

---

# FASE 5: DX, CI, dokumentasi

Semua **[agen DX]**, diverifikasi dengan membaca `package.json`, `deploy.yml`, `README.md`, `git ls-files`.

| Task | Perubahan | File | Usaha |
|---|---|---|---|
| 5.1 | CI untuk PR: `ci.yml` (`on: pull_request`, `permissions: contents: read`; `npm ci`, tes, build). Di `deploy.yml`: pindahkan `pages: write`/`id-token: write` ke job deploy, guard `if: github.ref == 'refs/heads/main'`, pin Node (`.nvmrc`/`engines`), `timeout-minutes` | `.github/workflows/` | S |
| 5.2 | ESLint flat config + Prettier + `@vitest/coverage-v8` + skrip `lint`/`coverage`; `// @ts-check` bertahap di `src/sim`, `src/story`, `src/settings` | `package.json`, `eslint.config.js`, `vite.config.js` | S-M |
| 5.3 | Tes untuk modul tanpa tes: `ballPhysics` (dt besar), `ovalMath`, `StoryDirector` (dengan stub), `povSource`, rng deterministik; tes properti (loop 1000 langkah) untuk dt besar dan wrap jam | `tests/` | M |
| 5.4 | Vitest: `isolate:false` untuk tes murni dan `jsdom` hanya untuk `ui*.test.js` | `vite.config.js` | S |
| 5.5 | README: hapus klaim "tanpa aset unduhan" (ada 2 GLB + Google Fonts), perbarui struktur (`story/`, `settings/`, `sim/story/`, `ui/bindings/`, `assets-src/`), kontrol (E dobel, V ganda, Esc, J/H/F1/P/1-7), langkah regenerasi GLB dari Blender; tambah LICENSE (keputusan pemilik) dan `ARCHITECTURE.md` ringkas | `README.md`, `LICENSE`, `docs/` | S |
| 5.6 | Hygiene repo: `*.blend1` ke `.gitignore` + `git rm --cached`; `.claude/launch.json` (path absolut Windows) jadi contoh; `.mcp.json` lokal; hapus/pindahkan `src/ui/demo*.html|js` (terbukti tidak masuk bundel); putuskan nasib `src/sim/ellipse.js` (hanya dipakai tes, duplikat `ovalMath`/`ellipseGeo`) | repo | S |
| 5.7 | Self-host font (`@fontsource-variable/inter`) agar tidak memblokir render dan jalan offline | `index.html:8-12` | S |
| 5.8 | Ekstrak `Minimap.js` dan `postfx.js` dari `App.js` (335 baris), `keymap.js` dari `main.js` (264 baris) | `src/core/` | M |

---

# FASE 6: Konten dan fitur besar

Rincian dibuat setelah Fase 1-3 selesai karena bergantung hasil profiling.

- **Aset Blender (urut dampak/usaha):** patung serindit + cawan obor → pohon sawit/trembesi halus → gerobak PKL variasi → angkot/Trans Metro → gedung Auditorium UR sebagai latar. Pos jaga di setiap gate dan gerbang kawasan kedua (riset: 2 gerbang, pos di tiap pintu).
- **Kontrol:** gamepad (M), joystick virtual + tombol E/bel + drag kamera untuk ponsel (L), rebinding tombol (M).
- **Gameplay:** misi dipengaruhi siklus waktu/cuaca (kopi laris malam, misi hujan memakai `weather.raining`), misi foto tugu lewat Mode Foto (P), medali putaran (emas/perak/perunggu) dari `bestLap`, time trial dengan ghost lap, ikon NPC dan pedagang di minimap, pencapaian di jurnal, audio ambient per zona dan waktu.
- **Lingkungan:** latar horizon (ring pohon kabur/billboard gedung), kelapa sawit di sekitar kawasan, LOD gate/kursi/rib.

---

## Keputusan yang dibutuhkan dari pemilik

1. **Lisensi** proyek (MIT?) dan sumber font/aset, untuk Task 5.5.
2. **Skala dukungan sentuh/ponsel**: hanya HUD responsif (Fase 4) atau kontrol sentuh penuh (Fase 6, besar).
3. **Fakta vs gaya** (Task 3.9): warna lintasan tetap salmon pastel (gaya cozy chibi) atau dikembalikan ke merah bata (fakta).
4. **Klaim "AIR MOLEK"** pada teks chapter 5 dilunakkan atau dipertahankan sebagai fiksi cerita.
5. **Perangkat target FPS** untuk menetapkan anggaran draw call Fase 2.

## Self-review

- **Cakupan:** setiap temuan yang dilaporkan lima agen dipetakan ke satu task; temuan hanya-hipotesis ditandai dan diverifikasi saat eksekusi.
- **Placeholder:** Task 3, 4, dan 9 Fase 1 meminta pembacaan file singkat di langkah pertama karena bentuk kode sekitarnya (penerapan efek toast, konstruktor `StoryDirector`) belum saya baca; kodenya sudah dispesifikasikan sebatas yang terverifikasi. Fase 2-6 sengaja berupa paket tugas, bukan langkah bite-sized.
- **Konsistensi nama:** `routeEscape`, `sunMoonWeight`, `seedFound`, `findDone` dipakai konsisten antar tes dan implementasi.
