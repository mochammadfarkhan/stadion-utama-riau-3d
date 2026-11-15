# R22 — Waktu muat dan layar muat (Putaran 2)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Ukur dulu, baru ubah: tiap tugas punya angka sebelum/sesudah.
> Seluruh urutan boot ada di `src/main.js` fungsi `main()`.

**Tujuan:** dari membuka halaman sampai tombol Mulai aktif secepat mungkin, dan layar muat tidak berbohong.
**Pilar:** P-2. **Tonggak:** T1 (tugas 1–2), T2 (tugas 3–4). **Branch:** `perf/waktu-muat`.

## Urutan boot sekarang (`src/main.js`, dicek 2026-11-14)

| Langkah | Label layar | Yang sebenarnya dikerjakan |
|---|---|---|
| 0,05 (`:115`) | Menyiapkan mesin grafis… | mulai praload tekstur + kit karakter (paralel), App, Input, HUD, CameraRig, sentuh, gamepad, audio, store |
| 0,12 (`:161`) | langit, pencahayaan, waktu, cuaca | `await procTextures`, lighting, time, weather |
| 0,2 (`:177`) | Membangun stadion… | `await regions.register(stadionDef)` (persistent); lembaga + rektorat didaftarkan tanpa ditunggu |
| 0,4 (`:196`) | peta kota (OpenStreetMap) | `await createCity`, collider distrik |
| 0,55 (`:219`) | pemain, pelari, pedagang, penonton | `await humanoidKit`, dompet, `buildEntities` |
| 0,8 (`:246`) | **"siklus waktu dan cuaca"** (salah) | cerita, toko, minimap, **`await mountDistrict` UNRI** (`:270`), ornamen, perjalanan cepat, portal, tas, kebun (15 GLB), sistem frame, pratinjau kota, binding, kualitas, gaya, `app.start` |
| 0,9 (`:347`) | Memuat model 3D | balapan `modelsReady` vs **8 detik** (`MODELS_TIMEOUT_MS`, `:86`) |
| 0,97 (`:350`) | Menggambar peta… | `attachMinimap`, POV orbit |
| 0,98 (`:357`) | Menyiapkan shader… | `precompile`, `settleStartArea` (≤ **12 detik**, `START_SETTLE_TIMEOUT_MS`, `:87`), `precompile` lagi |
| 1 (`:363`) | Siap! | menu aktif |

Ukuran data distrik UNRI: `public/districts/unri` 2,2 MB (ground 21 berkas 1,4 MB, terrain 21 berkas 676 KB, `buildings.json` 55 KB).

---

## Tugas 1: Alat ukur waktu muat

**Berkas:** baru `tools/shots/waktuMuat.mjs`; `src/ui/LoadingScreen.js`.

- [ ] `createLoadingScreen().step(progress, label)` mencatat `performance.mark('muat:' + label)`; `done()` mencatat `performance.mark('muat:selesai')`.
- [ ] `tools/shots/waktuMuat.mjs` (pola `tools/shots/kualitas.mjs`): buka halaman dengan Playwright **tanpa** memakai `openSim` yang menunggu `window.__sim.district`
  — salin bagian peluncuran server + browser dari `tests/e2e/harness.unri.mjs`, lalu `page.waitForFunction(() => !document.getElementById('start').disabled, null, { timeout: 240000 })`
  dan cetak `performance.getEntriesByType('mark')` sebagai tabel `label → ms sejak navigasi` + selisih antar langkah.
  Jalankan 3 kali (cache hangat), laporkan median. Opsi `--dingin` memakai konteks browser baru tiap putaran.
- [ ] Jalankan dan **catat angka dasar** di tabel "Angka" pada berkas ini (kolom Sebelum). Commit `chore(alat): pengukur waktu muat`.

## Tugas 2: Label layar muat yang benar

- [ ] `main.js:246`: label 0,8 menjadi `'Menyiapkan cerita dan HUD…'`. Sisipkan `await loading.step(0.65, 'Memuat kampus UNRI…');` tepat sebelum `mountDistrict` (`:270`).
  Label 0,9 menjadi `'Memuat model 3D…'`.
- [ ] Commit `fix(muat): label layar muat sesuai pekerjaan`.

## Tugas 3: Tombol Mulai tidak menunggu yang tidak perlu

**Keputusan:** menu tampil begitu dunia bisa digambar; penyelesaian streaming + prekompilasi berjalan **di belakang orbit menu**. Tombol Mulai aktif setelah
`settle + precompile` selesai **atau** 4 detik, mana yang lebih dulu. Model opsional (`modelsReady`) tidak ditunggu sama sekali (sudah ada cadangan prosedural).

- [ ] `main.js`: `MODELS_TIMEOUT_MS` dihapus; baris `await Promise.race([modelsReady, …])` (`:349`) dihapus (janji `modelsReady` tetap dipakai untuk toast gagal).
- [ ] `START_SETTLE_TIMEOUT_MS` 12000 → 6000. Setelah `await precompiled`, jalankan `settleStartArea(...).then(precompile)` sebagai janji `siap`,
  set `app.holdRender = false` segera setelah `precompiled` (dunia terlihat di belakang menu), lalu `await Promise.race([siap, tunggu(4000)])` sebelum `menu.ready(...)`.
- [ ] **Risiko yang harus dicek:** `app.holdRender = false` sebelum streaming selesai bisa membuat frame pertama mengompilasi shader secara sinkron (membeku).
  Ukur dengan `node tools/shots/stutter.mjs` (alat yang sudah ada) sebelum dan sesudah; bila frame terpanjang setelah menu tampil > 500 ms, kembalikan urutan lama untuk
  `holdRender` dan hanya pertahankan pemangkasan batas waktu.
- [ ] Ukur ulang dengan `tools/shots/waktuMuat.mjs`; isi kolom Sesudah. Commit `perf(muat): tombol Mulai tidak menunggu model opsional`.

## Tugas 4: Distrik UNRI tidak menahan boot

**Keadaan:** `main.js:270` `const unri = await mountDistrict(...)` menunggu manifest + `buildings.json` + pemasangan gedung. Chunk terrain/tanah sudah streaming per fokus.
`unri` dipakai sesudahnya oleh: `settleStartArea({ unri })`, `setupFastTravel({ unri })` (`campus: Boolean(unri)`), `lifecycle`, devtools (`district: unri`).

**Keputusan:** bila titik mulai sudah di sekre (R03), distrik **harus** siap sebelum Mulai, jadi tugas ini hanya bernilai untuk waktu sampai menu tampil.
Kerjakan **setelah R03**, dengan cara: `mountDistrict` dimulai lebih awal (tepat setelah `createCity`, paralel dengan langkah 0,55) dan baru di-`await` di tempat lama.

- [ ] Pindahkan pemanggilan `mountDistrict(...)` ke atas tanpa `await` (simpan janjinya: `const unriPromise = mountDistrict(...)`), `await` di posisi lama.
  Argumen yang belum ada pada saat itu (`minimap`) dibuat lebih awal: `setupMinimap` butuh `ents` dan `story`; bila tidak bisa dipindah, **batalkan tugas ini dan tulis alasannya** — jangan memaksa.
- [ ] Ukur ulang; pertahankan hanya bila median turun > 300 ms. Commit atau catat "dibatalkan: <alasan>".

## Angka (isi saat mengerjakan)

| Ukuran | Sebelum | Sesudah T3 | Sesudah T4 |
|---|---|---|---|
| Navigasi → menu tampil (ms, median 3×) | | | |
| Navigasi → tombol Mulai aktif (ms) | | | |
| Langkah terlama (label, ms) | | | |
| Frame terpanjang setelah menu (`stutter.mjs`, ms) | | | |

## Tidak dikerjakan

- Web Worker untuk parsing tile: `ARSITEKTUR.md` titik lemah no. 3 menyebut penyebab utama = kompilasi shader, bukan parsing. Buka lagi hanya bila `stutter.mjs` menunjukkan sebaliknya.
- Memuat malas 15 GLB kebun (`src/app/farm.js:81–85`, ±275 KB): setelah titik mulai pindah ke sekre (±80 m dari kebun) tidak ada yang dihemat.
