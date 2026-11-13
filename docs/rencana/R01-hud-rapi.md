# R01 — HUD rapi (U1–U5)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu (aturan global, perintah, cara lapor). Kerjakan tugas berurutan,
> centang `- [ ]` saat selesai. Jangan mengerjakan hal di luar berkas yang disebut.

**Tujuan:** menit pertama tidak lagi tampak rusak: dompet terbaca, menu utama bersih, tidak ada teks ganda atau teks teknis.
**Pilar:** P-2 (bergerak itu enak: layar tidak mengganggu). **Tonggak:** T1. **Branch:** `fix/hud-rapi`.
**Prasyarat:** R00 (alat `tools/shots/kritik.mjs`) sudah ada di `main`.
**Perkiraan:** 5 tugas kecil, satu PR.

## Peta berkas

| Berkas | Peran | Diubah di tugas |
|---|---|---|
| `src/ui/hud.css` | posisi kartu HUD, aturan `body.is-*` | 1, 2 |
| `src/ui/touch.css` | penyesuaian HUD layar sempit | 1 |
| `src/ui/MainMenu.js` | pengendali `#overlay` | 2 |
| `tests/e2e/harness.unri.mjs` | harness bidikan (menyembunyikan menu tanpa `MainMenu.hide()`) | 2 |
| `tools/shots/m7Eggs.mjs` | sama: menyembunyikan menu sendiri | 2 |
| `src/core/StoryDirector.js` | `promptFor(pos)` | 3 |
| `src/ui/HUD.js` | `setCameraMode`, `setCameraView`, baru: `setScoreVisible` | 4, 5 |
| `src/settings/schema.js` | default `performance.showStats` | 4 |
| `src/main.js` | sistem `hud` di `addFrameSystems` | 5 |
| `tests/mainMenu.test.js`, `tests/storyDirector.test.js`, `tests/hud.test.js` (baru) | tes | 2, 3, 4, 5 |

**Jangan disentuh:** `src/ui/panel.css` (rail), `src/ui/perkamen.css`, `src/ui/cityPreview.css`.

## Fakta kode yang dipakai (sudah dicek 2026-11-14)

- `src/ui/hud.css:25` → `#hud-top-right { right: 16px; text-align: right; }`.
- `src/ui/panel.css:175–187` → `.ui-rail { position: absolute; top: calc(var(--ui-u) * 3); right: calc(var(--ui-u) * 3); padding: calc(var(--ui-u) * 1); }`,
  tombolnya `.ui-rail__btn { width: calc(var(--ui-u) * 9); }`. Jadi tepi kiri rail = `3u + 1u + 9u + 1u = 14u` dari tepi kanan layar.
- `--ui-u` didefinisikan di `:root` (`src/ui/theme.css:4`): `clamp(3.5px, 0.3vw + 2.6px, 5px)`, jadi boleh dipakai di `hud.css`.
- `src/ui/touch.css:40` → `#hud-top-right { right: 56px; max-width: 34vw; }` (di dalam `@media (max-width: 640px)`).
- `src/ui/MainMenu.js`: `hide()` menambah kelas `hidden` ke `#overlay`; `away(on)` hanya menyingkirkan panel menu sementara.
- `src/main.js:564` memanggil `story.start()` saat boot, sehingga dialog pembuka sudah terbuka **di belakang menu**.
- `src/core/StoryDirector.js:236–240`:
  ```js
  promptFor(pos) {
    if (this.state.dialog) return 'Tekan E — lanjut';
  ```
  sedangkan `src/ui/StoryHUD.js:22` sudah menulis `'E / klik untuk lanjut'` di dalam kotak dialog.
- `src/ui/HUD.js:65–75` `setCameraMode(mode)` / `setCameraView(mode, povLabel, freezesBike)` dipanggil **tiap frame** oleh sistem
  `hud` (`src/main.js:437`). `HUD.toast(text, ok)` sudah ada (`HUD.js:120`).
- `src/settings/schema.js:132` → `showStats: toggle('Tampilkan FPS & draw call', true)`. Store hanya menyimpan nilai yang
  berbeda dari default, jadi mengubah default berlaku untuk pemain yang belum pernah mengubahnya.
- `src/main.js:440` → `hud.setScore(ents.match.score)` tiap frame. `regionContains(region, x, z)` (`src/regions/Region.js:125`,
  koordinat dunia) sudah diimpor di `main.js`; `stadionDef` adalah definisi region stadion di dalam `main()`.

---

## Tugas 1: Dompet tidak tertutup rail (U1)

**Berkas:** ubah `src/ui/hud.css:25`, `src/ui/touch.css:40`.

- [ ] **Langkah 1: ambil angka sebelum.** Jalankan `node tools/shots/kritik.mjs --out renders/kritik/r01-sebelum --hanya jalan,hp`.
  Harapan: di `ringkasan.json`, `ui.dompetTertutupRail` bernilai `true`.
- [ ] **Langkah 2: ubah `hud.css`.** Ganti baris 25 menjadi:
  ```css
  /* 16u = tepi kiri rail pengaturan (14u, lihat .ui-rail di panel.css) + jarak 2u */
  #hud-top-right { right: calc(var(--ui-u) * 16); text-align: right; }
  ```
- [ ] **Langkah 3: ubah `touch.css`.** Ganti baris 40 menjadi `#hud-top-right { max-width: 34vw; }` (nilai `right` diwarisi dari `hud.css`).
- [ ] **Langkah 4: cek.** Jalankan lagi alat dengan `--out renders/kritik/r01-sesudah --hanya jalan,hp`.
  Lulus bila `ui.dompetTertutupRail === false` **dan** `ui.hpDompetTertutupRail === false`. Buka `awal-sore.jpg`: teks "Dompet" dan
  angka rupiah terbaca penuh.
- [ ] **Langkah 5: commit.** `git add src/ui/hud.css src/ui/touch.css` lalu (perintah terpisah) `git commit -m "fix(ui): dompet tidak tertutup rail pengaturan"`.

## Tugas 2: HUD disembunyikan selama menu utama (U2)

**Berkas:** ubah `src/ui/MainMenu.js`, `src/ui/hud.css`, `tests/e2e/harness.unri.mjs:49`, `tools/shots/m7Eggs.mjs:23`; tes `tests/mainMenu.test.js`.

**Antarmuka yang dihasilkan:** kelas `is-menu` pada `<body>` selama menu utama belum ditutup. Dipasang di konstruktor `MainMenu`,
dilepas **hanya** oleh `MainMenu.hide()`. `away()` tidak mengubahnya.

- [ ] **Langkah 1: tes gagal dulu.** Di `tests/mainMenu.test.js`, ubah fungsi `dom()` supaya baris pertamanya `document.body.className = '';`,
  lalu tambahkan di dalam `describe('MainMenu', …)`:
  ```js
  it('body.is-menu terpasang selama menu tampil, bertahan saat away(), dilepas oleh hide()', () => {
    const m = new MainMenu();
    expect(document.body.classList.contains('is-menu')).toBe(true);
    m.away(true);
    expect(document.body.classList.contains('is-menu')).toBe(true);
    m.hide();
    expect(document.body.classList.contains('is-menu')).toBe(false);
  });
  ```
- [ ] **Langkah 2: jalankan, pastikan gagal.** `node node_modules/vitest/vitest.mjs run tests/mainMenu.test.js` → 1 gagal (`expected false to be true`).
- [ ] **Langkah 3: implementasi.** Di `MainMenu`: simpan `this.body = doc.body;` di konstruktor dan panggil `this.body.classList.add('is-menu');`.
  Di `hide()` tambahkan `this.body.classList.remove('is-menu');`.
- [ ] **Langkah 4: CSS.** Tambahkan di `src/ui/hud.css`, tepat setelah blok `/* --- Menu utama --- */` (setelah baris `.menu-credit`):
  ```css
  /* Selama menu utama: HUD, dialog cerita, hotbar, minimap, tombol layar disembunyikan (atribusi peta tetap tampil). */
  body.is-menu #hud,
  body.is-menu #minimap2d,
  body.is-menu #touch-ui,
  body.is-menu #hotbar-wrap,
  body.is-menu #hud-travel { visibility: hidden !important; }
  ```
  `#story-card` dan `#story-dialog` adalah anak `#hud`, jadi ikut tersembunyi. Dialog tetap terbuka di state dan muncul begitu menu ditutup.
- [ ] **Langkah 5: perbaiki dua alat yang menutup menu tanpa `MainMenu.hide()`.** Di `tests/e2e/harness.unri.mjs:49` dan
  `tools/shots/m7Eggs.mjs:23`, tepat setelah baris `document.getElementById('overlay')?.classList.add('hidden');` tambahkan
  `document.body.classList.remove('is-menu');`. **Kalau ini terlewat, semua bidikan alat akan tanpa HUD.**
- [ ] **Langkah 6: cek.** Tes `tests/mainMenu.test.js` lulus semua. Lalu `node tools/shots/kritik.mjs --out renders/kritik/r01-t2 --hanya jalan`:
  di `awal-sore.jpg` HUD **tetap tampil** (bukti langkah 5 benar).
- [ ] **Langkah 7: cek menu dengan mata.** Buka `npm run dev`, muat halaman, **jangan** tekan Mulai: tidak ada kartu kecepatan, dompet,
  kartu misi, dialog, atau minimap di belakang menu. Tekan Mulai: semuanya muncul, dialog pembuka tampil.
- [ ] **Langkah 8: commit.** `git add` kelima berkas, lalu `git commit -m "fix(ui): HUD disembunyikan selama menu utama"`.

## Tugas 3: Prompt ganda saat dialog (U3)

**Berkas:** ubah `src/core/StoryDirector.js:237`; tes `tests/storyDirector.test.js`.

- [ ] **Langkah 1: tes gagal dulu.** Tambahkan di dalam `describe('StoryDirector: alur dasar', …)`:
  ```js
  it('selagi dialog terbuka, promptFor mengembalikan null (petunjuk sudah ada di kotak dialog)', () => {
    const { d } = started();
    expect(d.state.dialog).not.toBeNull();
    expect(d.promptFor({ x: 0, z: 0 })).toBeNull();
  });
  ```
- [ ] **Langkah 2: jalankan, pastikan gagal** (`expected 'Tekan E — lanjut' to be null`): `node node_modules/vitest/vitest.mjs run tests/storyDirector.test.js`.
- [ ] **Langkah 3: implementasi.** Ganti baris 237 menjadi `if (this.state.dialog) return null; // petunjuk "E / klik" ada di kotak dialog (StoryHUD)`.
  `tryInteract` tidak diubah (E tetap melanjutkan dialog).
- [ ] **Langkah 4: jalankan tes, lulus.** Lalu commit: `git add src/core/StoryDirector.js tests/storyDirector.test.js`, `git commit -m "fix(cerita): tanpa prompt ganda saat dialog"`.

## Tugas 4: Teks teknis keluar dari HUD utama (U4)

**Berkas:** ubah `src/ui/HUD.js`, `src/settings/schema.js:132`; buat `tests/hud.test.js`.

**Antarmuka yang dihasilkan (dipakai tugas 5):** berkas tes `tests/hud.test.js` dengan pembantu `makeHud()`.

Perilaku yang diputuskan:
- Baris `#hud-cam` **tersembunyi** selama tidak ada POV. Saat POV aktif (ada `povLabel`), baris tampil dengan teks lama
  (`POV: <label> (sepeda dibekukan · V/0 kembali)`), karena itu petunjuk keluar yang masih dibutuhkan.
- Saat mode kamera pemain **berubah** (bukan panggilan pertama), tampilkan toast sekali: `Kamera: orang pertama`, `Kamera: orang ketiga`,
  atau `Kamera: 3/4 dari atas`.
- Baris fps default mati (`performance.showStats` default `false`). Overlay `?perf` tidak terpengaruh.

- [ ] **Langkah 1: tes gagal dulu.** Buat `tests/hud.test.js`:
  ```js
  // @vitest-environment jsdom
  import { describe, it, expect, beforeEach } from 'vitest';
  import { HUD } from '../src/ui/HUD.js';

  function makeHud() {
    document.body.innerHTML = '<div id="hud"></div>';
    const hud = new HUD(document.getElementById('hud'));
    const toasts = [];
    hud.toast = (text, ok = true) => toasts.push([text, ok]);
    return { hud, toasts, byId: (id) => document.getElementById(id) };
  }

  describe('HUD: baris kamera', () => {
    let k;
    beforeEach(() => { k = makeHud(); });

    it('tanpa POV: baris kamera tersembunyi; panggilan pertama tidak memunculkan toast', () => {
      k.hud.setCameraView('third', null, false);
      expect(k.byId('hud-cam').classList.contains('hidden')).toBe(true);
      expect(k.toasts).toEqual([]);
    });

    it('ganti mode kamera: toast sekali, tidak berulang tiap frame', () => {
      k.hud.setCameraView('third', null, false);
      k.hud.setCameraView('first', null, false);
      k.hud.setCameraView('first', null, false);
      expect(k.toasts).toEqual([['Kamera: orang pertama', true]]);
    });

    it('POV aktif: baris kamera tampil dengan petunjuk keluar', () => {
      k.hud.setCameraView('third', 'Kota', true);
      expect(k.byId('hud-cam').classList.contains('hidden')).toBe(false);
      expect(k.byId('hud-cam').textContent).toBe('POV: Kota (sepeda dibekukan · V/0 kembali)');
    });
  });
  ```
- [ ] **Langkah 2: jalankan, pastikan gagal:** `node node_modules/vitest/vitest.mjs run tests/hud.test.js`.
- [ ] **Langkah 3: implementasi di `HUD.js`.**
  - Konstanta modul: `const CAMERA_LABEL = Object.freeze({ first: 'Kamera: orang pertama', third: 'Kamera: orang ketiga', angled: 'Kamera: 3/4 dari atas' });`
  - `setCameraMode(mode)`: sembunyikan `this.el.cam` (kelas `hidden`); bila `this._camMode !== undefined && this._camMode !== mode`,
    panggil `this.toast(CAMERA_LABEL[mode] ?? CAMERA_LABEL.third, true)`; simpan `this._camMode = mode`.
  - `setCameraView(mode, povLabel, freezesBike)`: bila ada `povLabel`, lepas kelas `hidden` dari `this.el.cam` lalu tulis teks seperti sekarang
    (jangan ubah `_camMode`); bila tidak, teruskan ke `setCameraMode(mode)`.
  - Di `buildLayout`: elemen `cam` dibuat dengan `className: 'muted hidden'`.
- [ ] **Langkah 4: default fps.** `src/settings/schema.js:132` → `showStats: toggle('Tampilkan FPS & draw call', false),`.
  Jalankan `node node_modules/vitest/vitest.mjs run tests/settingsStore.test.js tests/bindings.test.js`; bila ada tes yang mengandaikan default `true`,
  ubah harapannya ke `false` (itu perubahan yang disengaja).
- [ ] **Langkah 5: jalankan `tests/hud.test.js`, lulus.** Commit: `git add src/ui/HUD.js src/settings/schema.js tests/hud.test.js` (+ tes lain bila diubah),
  `git commit -m "fix(ui): baris kamera dan fps keluar dari HUD utama"`.

## Tugas 5: Skor pertandingan hanya di kawasan stadion (U5)

**Berkas:** ubah `src/ui/HUD.js`, `src/main.js` (pemanggilan `addFrameSystems` ±baris 295 dan sistem `hud` ±baris 433–444); tes `tests/hud.test.js`.

**Antarmuka:** `HUD#setScoreVisible(visible: boolean): void` — menulis ke DOM hanya bila nilainya berubah.

- [ ] **Langkah 1: tes gagal dulu.** Tambahkan di `tests/hud.test.js`:
  ```js
  describe('HUD: skor', () => {
    it('setScoreVisible menyembunyikan/menampilkan pil skor', () => {
      const { hud, byId } = makeHud();
      hud.setScoreVisible(false);
      expect(byId('hud-score').classList.contains('hidden')).toBe(true);
      hud.setScoreVisible(true);
      expect(byId('hud-score').classList.contains('hidden')).toBe(false);
    });
  });
  ```
- [ ] **Langkah 2: implementasi `setScoreVisible`** di `HUD.js` (pola: bandingkan dengan `this._last.scoreVisible`, lalu `classList.toggle('hidden', !visible)`).
- [ ] **Langkah 3: sambungkan di `main.js`.**
  - Di `main()`, sebelum pemanggilan `addFrameSystems(...)`: `const inStadion = () => regionContains(stadionDef, ents.bike.state.x, ents.bike.state.z);`
  - Tambahkan `inStadion` ke objek argumen `addFrameSystems({ ... })` dan ke parameter fungsi `addFrameSystems`.
  - Di sistem `hud`, tepat setelah `hud.setScore(ents.match.score);`: `hud.setScoreVisible(inStadion());`
- [ ] **Langkah 4: cek.** `npm run lint`, lalu `node tools/shots/kritik.mjs --out renders/kritik/r01-t5 --hanya jalan`:
  `awal-sore.jpg` menampilkan pil "PSPS 0 – 0 TAMU"; `unri-jalan.jpg` dan `rektorat.jpg` **tidak**.
- [ ] **Langkah 5: commit.** `git add src/ui/HUD.js src/main.js tests/hud.test.js`, `git commit -m "fix(ui): skor pertandingan hanya tampil di kawasan stadion"`.

---

## Selesai bila

- `npm run lint` bersih; `node node_modules/vitest/vitest.mjs run tests/mainMenu.test.js tests/storyDirector.test.js tests/hud.test.js` lulus.
- `ringkasan.json` sesudah: `ui.dompetTertutupRail === false`, `ui.hpDompetTertutupRail === false`, `errors` kosong.
- Bidikan `awal-sore.jpg`: dompet terbaca, tidak ada baris "Kamera: …" maupun "… fps".
- Sebelum push: `npm test` dan `npm run build` hijau.
- Tandai U1–U5 jadi ✅ di `docs/KRITIK.md` dan baris R01 di `docs/rencana/README.md`.

## Yang sengaja tidak dikerjakan di sini

- Arah/jarak ke tujuan misi (U6) → R03. Warna minimap (U8) → R12. HUD mode Kota (U9) → R07.
- Tata letak HUD untuk HP → R16.
