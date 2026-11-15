# R21 — Keterbacaan dan aksesibilitas (Putaran 2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Tema perkamen adalah **default** (`graphics.gayaGrafis` default `'kartun'`,
> `src/settings/schema.js:73`; `html[data-gaya='kartun']` dipasang `src/ui/bindings/bindGraphics.js:40–41`), jadi cacat kontras di bawah
> dilihat semua pemain. Rasio kontras dihitung dengan rumus WCAG terhadap perkamen `#f4e6c6`.

**Tujuan:** semua teks terbaca, semua kontrol terjangkau keyboard/pembaca layar, daftar kontrol tidak saling bertentangan.
**Pilar:** P-2. **Tonggak:** T1 (tugas 1–2: cacat yang terlihat), T4 (sisanya). **Branch:** `fix/keterbacaan`.

## Tugas 1: Tiga teks yang tidak terbaca di tema perkamen (cacat, bukan selera)

| Tempat | Akar | Rasio sekarang | Perbaikan |
|---|---|---|---|
| Daftar barang toko | `src/ui/hud.css:52–55` tombol `background: #16222f; color: var(--hud-fg)`; di perkamen `--hud-fg = #3b2a1a` | 1,17 : 1 | `src/ui/perkamen.css`: `html[data-gaya='kartun'] #hud-shop-list button { background: #efe0bd; border-color: #b39463; color: #3b2a1a; }` dan `…button:hover { border-color: var(--hud-accent); background: #e6d2a6; }` |
| Semua toast | `hud.css:42–43` latar hijau/merah, warna teks diwarisi dari `#hud` | 2,55 / 2,74 : 1 | `hud.css:38–41` `#hud-toast`: tambah `color: #f4f6f8;` |
| Judul toko | `hud.css:50` `#hud-shop h2 { color: var(--hud-accent) }` di atas `rgba(10,18,28,0.9)`; `perkamen.css` mengganti latar `#hud-shop` jadi perkamen | cek | pastikan setelah perubahan judul toko ≥ 4,5 : 1 (lihat Tugas 2 untuk aksen baru) |

- [ ] Terapkan ketiganya. **Cek:** buka toko pedagang (E di dekat pedagang) pada gaya kartun → nama barang dan harga terbaca; picu toast (tekan R: "Hujan turun") → teks putih.
- [ ] Commit `fix(ui): teks toko dan toast terbaca di tema perkamen`.

## Tugas 2: Warna aksen dan teks redup di atas ambang 4,5 : 1

Nilai sekarang di `src/ui/perkamen.css:3–20` terhadap `#f4e6c6`: `--ui-dim #a08a66` 2,69 · `--hud-accent`/`--ui-accent #b4571b` 3,93 (dipakai `#hud-time` 13 px) ·
`--hud-muted #7a6445` 4,54 · hijau jurnal `#3f7a2c` 4,21.

- [ ] Ganti: `--hud-accent: #9a4612; --ui-accent: #9a4612; --ui-accent-rgb: 154, 70, 18; --ui-dim: #7d6a4c; --hud-muted: #6b5639;` dan
  `html[data-gaya='kartun'] #story-journal li.done { color: #2f5f20; }`. Di `src/ui/theme.css:14` (tema gelap): `--ui-dim: #7d90a1`.
- [ ] **Hitung, jangan menebak:** tulis skrip sekali pakai (jangan di-commit) yang menghitung rasio WCAG tiap pasangan di atas terhadap `#f4e6c6` dan `#eedcb7`;
  semua harus ≥ 4,5. Bila ada yang kurang, gelapkan 5% dan hitung lagi. Tempel tabel hasil di laporan PR.
- [ ] Tombol utama menu memakai `#fff7e6` di atas aksen: dengan aksen baru rasionya naik; cek ≥ 4,5.
- [ ] Bidik `node tools/shots/kritik.mjs --out renders/kritik/r21 --hanya jalan`; bandingkan `awal-sore.jpg` dengan dasar: karakter perkamen harus tetap sama.
- [ ] Commit `fix(ui): kontras aksen dan teks redup tema perkamen`.

## Tugas 3: Ukuran teks minimum 13 px + skala teks

Daftar lengkap teks < 13 px (pemilih · berkas:baris · nilai):
`#hud .muted` hud.css:16 12 · `#hud .label` :17 11 · `.loading-note` :81 12 · `.vendor-label` :87 12 · `.story-rank` :100 12 · `.story-dialog-hint` :109 12 ·
`.menu-hint` :141 12 · `.menu-credit` :145 11 (opacity 0,6) · `#hud-score` (layar pendek) :166 12 · `#map-attribution` :179 10 · `#hud-travel` :190 12 ·
touch.css:36 `.touch-btn` 12 · :42 `.pill` 12 · inventory.css:21 `.inv-count` 12 · :22 `.inv-key` 10 · :34 `.inv-sep` 12 · :36 `.inv-hint` 12 ·
infoCard.css:13 12 · cityPreview.css:14 `.city-label` 12 · time-of-day.css:158, :229 **8,5** · :165 11 · theme.css:5–6 `--ui-fs` 12–13,5 dan `--ui-fs-sm` ×0,86 (10,3–11,6).

- [ ] `src/ui/theme.css`: `--ui-text-scale: 1;` di `:root`; `--ui-fs: calc(clamp(13px, 0.25vw + 12px, 15px) * var(--ui-text-scale)); --ui-fs-sm: calc(var(--ui-fs) * 0.92);`.
- [ ] Naikkan tiap literal 10–12 px di daftar menjadi `calc(13px * var(--ui-text-scale))`; 8,5 px → 11 px (label dial SVG, ruangnya sempit); `#hud .big` 28 px →
  `calc(28px * var(--ui-text-scale))`. Atribusi peta boleh 11 px (teks hukum, bukan informasi main).
- [ ] Setelan baru: grup `aksesibilitas` di `src/settings/schema.js` (judul `'Aksesibilitas'`): `textScale: range('Ukuran teks', 1, 0.85, 1.5, 0.05, { unit: '×' })`,
  `reduceMotion: toggle('Kurangi gerakan', false)`. Binding baru `src/ui/bindings/bindAccessibility.js` (daftarkan di `bindings/index.js`):
  `store.bind('aksesibilitas.textScale', (v) => document.documentElement.style.setProperty('--ui-text-scale', String(v)))` dan
  `store.bind('aksesibilitas.reduceMotion', (v) => document.documentElement.toggleAttribute('data-kurangi-gerak', Boolean(v)))`.
  Tes di `tests/bindings.test.js` (jsdom): nilai 1,25 → properti CSS terpasang `'1.25'`.
- [ ] Periksa tumpang-tindih di skala 1,5 dengan `tools/shots/kritik.mjs` (tambahkan opsi `--skala-teks <n>` yang menyetel setelan itu sebelum membidik).
- [ ] Commit `feat(aksesibilitas): teks minimum 13 px dan skala teks`.

## Tugas 4: Kurangi gerakan

- [ ] CSS: `@media (prefers-reduced-motion: reduce), … ` tidak bisa digabung dengan atribut, jadi tulis dua blok dengan isi sama: satu `@media (prefers-reduced-motion: reduce)`
  dan satu `html[data-kurangi-gerak]`: `.ui-ctl.is-flash { animation: none; }` (controls.css:12), `[class*='ui-tod-'] { animation: none; }` (time-of-day.css:70),
  `#loading-fill { transition: none; }` (hud.css:79), `#hud-prompt, .rotate-icon { animation: none; }`.
- [ ] JS: di `main.js` saat `firstRun` dan `matchMedia('(prefers-reduced-motion: reduce)').matches` → `store.set('aksesibilitas.reduceMotion', true)` dan
  `store.set('camera.kotaIntro', false)`. Bila `aksesibilitas.reduceMotion` aktif, efek kamera baru dari R15 (FOV kecepatan, guncangan) **mati**.
- [ ] Commit `feat(aksesibilitas): kurangi gerakan`.

## Tugas 5: Pembaca layar dan fokus keyboard

- [ ] `src/ui/HUD.js:8–15` pembantu `el()` hanya menyalin `id/className/dataset`, sehingga `role`/`aria-live` yang diberikan di baris 147 **terbuang diam-diam**.
  Perbaiki: semua atribut lain dipasang dengan `setAttribute`. Tes (`tests/hud.test.js`): `#hud-toast` punya `role="status"` dan `aria-live="polite"`.
- [ ] `#hud-prompt`: `aria-live="polite"`. `#story-dialog` (`src/ui/StoryHUD.js:23`): `role="dialog"`, `aria-live="polite"`, `tabIndex = 0`, Enter/Spasi = lanjut.
- [ ] `#hud-shop`: `role="dialog"`, `aria-labelledby="hud-shop-title"`; `openShop()` memfokuskan tombol barang pertama.
- [ ] Cincin fokus: `hud.css` `#overlay button:focus-visible, #story-journal button:focus-visible, #hud-shop-list button:focus-visible, .inv-slot:focus-visible, .touch-btn:focus-visible { outline: 3px solid var(--hud-accent); outline-offset: 2px; }`.
- [ ] Commit `fix(aksesibilitas): peran ARIA dan cincin fokus`.

## Tugas 6: Satu sumber daftar kontrol

Sekarang tiga daftar saling bertentangan: `index.html:30` menulis "1–8 sudut pandang" dan tidak menyebut F, C, L, I, O, Q/Z, 0, B, K, G;
`SIM_HELP_ITEMS` (`src/ui/mountSettingsPanel.js:25–32`) hanya 1–7 dan 0 tanpa K dan G; saat jalan kaki angka 1–9 memilih hotbar, bukan sudut pandang.

- [ ] Baru `src/config/controlsHelp.js` (data murni): `export const CONTROL_HELP = Object.freeze([{ group: 'Bergerak', keys: ['W','A','S','D'], text: 'Kayuh / belok', touch: 'Joystick', pad: 'Stik kiri' }, …])`.
  Isinya **harus cocok dengan kode**; sumber kebenaran tiap tombol:
  `src/app/keymap.js` (F, J, G, M, O, L, R, N, T, `[`/`]`, V, C, Q/Z, Esc), `src/entities/Bicycle.js:36–43,236` (WASD/panah, Shift, Spasi),
  `src/app/inventory.js:92–95` (I, 1–9 saat jalan kaki), `src/app/farm.js:222,225` (B, E), `src/core/cameraPresets.js:22–37` (1–8, K, 0), `src/ui/Panel.js:150–154` (H, P, F1).
- [ ] `mountSettingsPanel.js` dan menu utama (`<details id="menu-controls">` diisi oleh `MainMenu.ready()`) membangun daftar dari `CONTROL_HELP`.
  Tes: tiap `keys` di `CONTROL_HELP` muncul di salah satu berkas sumber di atas (tes `grep` sederhana dengan `readFileSync`), supaya daftar tidak basi lagi.
- [ ] Commit `fix(ui): satu sumber daftar kontrol`.

## Tidak dikerjakan (dicatat)

- Ganti tombol oleh pemain (rebinding): tombol tersebar di ≥ 8 berkas dan panel memakai `e.key` sementara game memakai `e.code`. Butuh modul `config/keybindings.js` +
  `Input.action(name)`. Kartu tersendiri setelah T2; jangan dicicil setengah.
- Pemusatan teks antarmuka (`config/strings.js`): hanya berguna bila ada bahasa kedua. Tunda sampai diminta.
- Jeda permainan saat jendela tidak fokus: `StoryDirector` sudah menerima `paused` (`main.js:419`); tambah `|| !document.hasFocus()` di sana saat mengerjakan R10 (misi berwaktu).
