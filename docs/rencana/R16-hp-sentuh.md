# R16 — HP dan layar sentuh (Putaran 2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Hampir semuanya CSS; cek dengan `node tools/shots/kritik.mjs --hanya hp`
> (viewport 812×375) dan bidikan `hp-awal.jpg`. Nomor baris dari pembacaan 2026-11-14; cari pemilihnya dengan grep.

**Tujuan:** game bisa dimainkan penuh di HP landscape: tidak ada jebakan, tidak ada tombol yang tertutup, semua aksi punya tombol.
**Pilar:** P-2. **Tonggak:** T1 (tugas 1–4), T2 (tugas 5–7). **Branch:** `fix/hp-sentuh`. **Prasyarat:** R01 (posisi dompet).

## Fakta kode

- Tombol layar: `src/ui/TouchControls.js:13–19` `BUTTONS = [['bel','Bel','Space','tap'], ['aksi','E','KeyE','tap'], ['sprint','Lari','ShiftLeft','hold'], ['kamera','Kamera','CameraCycle','tap'], ['jurnal','Jurnal','KeyJ','tap']]`.
  `tests/touchControls.test.js:71` menegaskan tepat lima tombol ini.
- Aksi tanpa tombol layar: **F** ganti jalan/sepeda/traktor (`src/app/keymap.js:28`), **I** tas (`src/app/inventory.js:92`), **B** ganti benih (`src/app/farm.js:222`).
- `src/ui/touch.css:34` `@media (max-width: 640px)` (tombol 56 px, HUD ringkas) **tidak pernah aktif di HP**: potret diblokir layar "putar perangkat"
  (`src/ui/orientation.js:8–9`), landscape lebih lebar dari 640 px. Di 812×375 hanya `hud.css:159` `@media (max-height: 480px)` yang aktif.
- Mode foto menyembunyikan semua UI termasuk `#touch-ui` (`src/ui/panel.css:296–303`); jalan keluarnya hanya tombol keyboard P/Esc (`src/ui/Panel.js:153–154`).
- Layar "putar perangkat": `src/ui/hud.css:150` `background: rgba(5,10,16,0.96); color: var(--hud-fg)`; di tema perkamen (`perkamen.css:4`) `--hud-fg: #3b2a1a` → kontras 1,46 : 1.
- Hotbar: `src/ui/inventory.css:3,7` 9 slot × 46 px + celah 4 px = 454 px di tengah bawah; tombol layar (`touch.css:22–26`, 64 px, kanan bawah) menimpa slot 5–9 pada 812 px.
- Toast di layar sentuh: `touch.css:50–53` `#hud-toast { top: 64px }` menimpa `#hud-travel` (`hud.css:188`, `top: 60px`).
- Hanya `.touch-stick`, `.touch-actions`, dan `#map-attribution` yang memakai `env(safe-area-inset-*)` padahal `index.html:5` memakai `viewport-fit=cover`.
- Bidikan dasar `hp-awal.jpg` (2026-11-14): rail menutup dompet, minimap menutup separuh kanan bawah, kotak dialog menimpa prompt "Tekan E".

---

## Tugas 1: Keluar dari mode foto dengan ketukan

**Berkas:** `src/ui/Panel.js` (`setPhotoMode`), `src/ui/panel.css`, tes `tests/uiPanel.test.js`.

- [ ] Tes: setelah `panel.setPhotoMode(true)`, ada elemen `.ui-photo-exit` yang terlihat; `click()` padanya membuat `panel.isPhotoMode === false`.
- [ ] Implementasi: di konstruktor panel buat `button.ui-photo-exit` (teks `Selesai`, `aria-label="Keluar dari mode foto"`) di dalam `this.root`,
  tersembunyi secara default; `setPhotoMode(on)` menampilkan/menyembunyikannya; kliknya memanggil `this.setPhotoMode(false)`.
- [ ] CSS (`panel.css`, setelah blok mode foto): tombol `position: fixed; right: max(16px, env(safe-area-inset-right)); top: max(16px, env(safe-area-inset-top)); min-width: 48px; min-height: 48px; opacity: 0.55;`
  dan **tidak** ikut aturan `body.is-photo … { visibility: hidden }` (tombol ini bukan anak `.ui-panel`/`.ui-rail`).
  `captureScreenshot` (`src/ui/Screenshot.js`) memotret kanvas, jadi tombol tidak ikut terfoto; cek dengan satu foto.
- [ ] Commit `fix(sentuh): mode foto bisa ditutup dengan ketukan`.

## Tugas 2: Layar "putar perangkat" terbaca

- [ ] `src/ui/hud.css:150`: ganti `color: var(--hud-fg)` menjadi `color: #f4f6f8`. Di `.rotate-icon` (baris 153–154) warna bingkai memakai `var(--hud-accent)`;
  biarkan (oranye di atas gelap terbaca).
- [ ] Cek: `resize` viewport ke 375×812 dengan gaya `kartun` → teks putih di atas gelap. Commit `fix(sentuh): teks layar putar perangkat terbaca`.

## Tugas 3: Tombol Mode dan Tas

**Berkas:** `src/ui/TouchControls.js`, `src/ui/touch.css`, `tests/touchControls.test.js`.

**Keputusan tata letak:** tombol layar jadi **2 baris × 4** di kanan bawah: baris bawah `Bel, E, Lari`, baris atas `Kamera, Jurnal, Mode, Tas`.
Tombol `Ganti benih` (B) kontekstual: hanya tampil saat prompt kebun meminta benih (Tugas 5).

- [ ] Tes: ubah harapan daftar tombol menjadi tujuh id `['bel','aksi','sprint','kamera','jurnal','mode','tas']`; tombol `mode` mengirim `KeyF` (tap), `tas` mengirim `KeyI` (tap).
- [ ] Implementasi: tambah `['mode', 'Mode', 'KeyF', 'tap']` dan `['tas', 'Tas', 'KeyI', 'tap']` ke `BUTTONS`.
- [ ] CSS: `.touch-actions { grid-auto-flow: row; grid-template-columns: repeat(4, 60px); gap: 8px; }` dan `.touch-btn { width: 60px; height: 60px; }`;
  urutan DOM menentukan baris, jadi susun `BUTTONS` sehingga empat pertama = baris atas.
- [ ] Label aksesibel: elemen ke-5 opsional pada entri `BUTTONS` = `aria-label` (`'Interaksi'` untuk tombol `E`). Tes: `aria-label` tombol aksi = `Interaksi`.
- [ ] Commit `feat(sentuh): tombol Mode dan Tas`.

## Tugas 4: Tata letak HUD untuk HP landscape

**Berkas:** `src/ui/touch.css`, `src/ui/hud.css`, `src/ui/inventory.css`.

- [ ] `touch.css:34`: ganti kueri menjadi `@media (max-height: 480px), (max-width: 640px)`. Lalu periksa isi bloknya satu per satu pada 812×375
  (`#hud-top-right` sekarang mewarisi posisi dari R01; hapus sisa `right: 56px` bila masih ada).
- [ ] Minimap di layar pendek: tambah di blok `@media (max-height: 480px)` `hud.css`: `#minimap2d { width: 110px !important; height: 110px !important; top: 8px; bottom: auto; right: calc(var(--ui-u) * 16 + 150px); }`
  (pindah ke atas, di kiri kartu dompet, supaya kanan bawah bebas untuk tombol). Sesuaikan angka `150px` sampai tidak bertumpuk dengan dompet.
- [ ] Rail di layar sentuh: `@media (pointer: coarse) { .ui-rail__tabs, .ui-rail__sep { display: none; } }` (hanya tombol buka panel yang tinggal).
- [ ] Hotbar: `@media (pointer: coarse) { #hotbar-wrap { left: max(180px, calc(env(safe-area-inset-left) + 170px)); transform: none; bottom: max(8px, env(safe-area-inset-bottom)); } .inv-row { grid-template-columns: repeat(9, 38px); } .inv-slot { width: 38px; height: 38px; } }`
  — 9×38 + 8×4 = 374 px, dari x 180 sampai 554; tombol layar 4×60 + 3×8 = 264 px mulai x ≥ 532 pada lebar 812. Bila masih bertumpuk di 812 px, kecilkan slot ke 36 px.
- [ ] Toast: `touch.css` `#hud-toast { top: 96px; }`.
- [ ] Dialog vs prompt: saat dialog cerita terbuka prompt sudah `null` (R01 Tugas 3). Pastikan `#story-dialog` di layar pendek (`hud.css:165`) tidak menutup joystick:
  `left: 50%` dengan `width: min(560px, 46vw)`.
- [ ] Zona aman: ganti nilai tetap dengan `max(<nilai>, env(safe-area-inset-<sisi>))` untuk `#hud-top-left` (left), `#hud-top-right` (right), `.ui-rail` (right, top),
  `#minimap2d` (right), `#hotbar-wrap` (bottom), `#map-attribution` (bottom).
- [ ] **Cek:** tambahkan pemeriksaan tumpang-tindih baru ke `tools/shots/kritik.mjs` di `runPhone()` (pola `overlap(page, a, b)` sudah ada):
  `hpHotbarTertutupTombol: overlap('#hotbar-wrap', '.touch-actions')`, `hpMinimapTertutupTombol: overlap('#minimap2d', '.touch-actions')`,
  `hpToastTertutupTravel: overlap('#hud-toast', '#hud-travel')`. Karena `openSim` tidak menyalakan tombol layar, sebelum mengukur jalankan
  `page.evaluate(() => document.getElementById('touch-ui')?.classList.remove('hidden'))`. Lulus bila semuanya `false`.
- [ ] Commit `fix(sentuh): tata letak HUD untuk HP landscape`.

## Tugas 5: Tombol kontekstual "Ganti benih"

- [ ] `TouchControls#setButtonVisible(id: string, on: boolean): void` + entri `['benih', 'Ganti', 'KeyB', 'tap']` yang tersembunyi secara default.
  `setupFarm` (`src/app/farm.js`) menerima `onSeedContext: (aktif: boolean) => void` dan memanggilnya saat pemain masuk/keluar jangkauan kotak benih
  (`KEBUN.seedBox`, `KEBUN.boxRadius`); `main.js` meneruskannya ke `touchUi.setButtonVisible('benih', aktif)`. Tes di `tests/touchControls.test.js`.
- [ ] Commit `feat(sentuh): tombol ganti benih saat di kotak benih`.

## Tugas 6: Ukuran sentuh tombol panel

- [ ] `src/ui/panel.css`: `@media (pointer: coarse) { .ui-iconbtn, .ui-rail__btn { min-width: 44px; min-height: 44px; } }`. Commit.

## Tugas 7: Gamepad setara

- [ ] `src/core/gamepad.js`: petakan stik kanan ditekan (indeks tombol 11) → `KeyF`, stik kiri ditekan (indeks 10) → `KeyI`. Tes `tests/gamepad.test.js`.
- [ ] Tombol Back mengirim `KeyH` yang tidak dibaca siapa pun (`gamepad.js:15`): tambahkan `SettingsPanel#handleEscape(): boolean` (publik, memakai logika Esc
  yang sudah ada di `Panel.js:154–161`) dan satu sistem fase `input` di `src/ui/mountSettingsPanel.js` yang memanggil `panel.togglePanel()` saat
  `input.consumePress('KeyH')` dan `panel.handleEscape()` saat `input.consumePress('Escape')` bila panel/bantuan/foto terbuka. `mountSettingsPanel` perlu menerima `input`.
- [ ] Commit `feat(gamepad): mode, tas, dan panel bisa dijangkau`.

---

## Selesai bila

- `ringkasan.json` kelompok `hp`: semua kunci `hp…` bernilai `false`; `hp-awal.jpg` menunjukkan dompet terbaca, joystick dan tombol tidak tertutup.
- Uji di HP sungguhan (atau emulasi sentuh DevTools 812×375): mulai → jalan → F (Mode) → tas → kebun: tanam satu benih tanpa keyboard; mode foto masuk dan keluar.
- Tandai R16 di README rencana.
