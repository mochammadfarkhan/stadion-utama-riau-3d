# R07 — Landmark dari data, label bertingkat, HUD mode Kota (K2, K3, U9)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dan `docs/kota/PLAN.md` dulu. Aturan fakta proyek: **jangan mengarang nama tempat.**
> Semua nama di kartu ini keluar dari data Overture Maps; yang tidak ada di data tidak diberi nama.

**Tujuan:** mode Kota menampilkan nama tempat yang benar dalam jumlah yang pas untuk tiap tingkat zoom (sekarang hanya 2–5 label buatan tangan).
**Pilar:** P-1. **Tonggak:** T3. **Branch:** `feat/kota-landmark`. **Prasyarat:** R06 Tugas 1 (`classifyBuilding`).

## Fakta kode (dicek 2026-11-14)

- `tools/citybake/farFetch.mjs:26–33` query `bangunan` **tidak mengambil nama**. Kolom sekarang: `lon, lat, dlon, dlat, area_deg2, h, kelas, wkt`.
  Tiap query memindai partisi Overture ±5 menit dan butuh jaringan; hasil di-cache di `data-src/overture-kota/` (di-`.gitignore`).
- `tools/citybake/farbake.mjs` `bakeBuildings`: bangunan di dalam tile terperinci dibuang (`skipTiles`) **sebelum** dicatat. Masjid Raya An-Nur ada di area tile `pusat`,
  jadi ekspor landmark harus terjadi **sebelum** penyaringan itu.
- `src/ui/CityLabels.js` (48 baris): `createCityLabels(parent, { landmarks, onSelect }) → { setVisible, update(camera, distance), dispose }`; `MAJOR = {'stadion', 'annur', 'unri-rektorat'}`;
  label lain hanya tampil bila `distance < 2600`. Label dibuat sekali dari `landmarks` (= `travel.destinations`, `src/main.js:298`).
- `src/app/cityPreview.js:53–55` `onSelect: (l) => rig.director.flyTo(l.x, l.z, LABEL_ZOOM)`; `labels.update(camera, dist)` tiap frame (baris ±211).
- Zoom Kota: `zoomMin 0.25`, `zoomMax 14` (`src/core/cameraPresets.js:32`); `dist` = jarak kamera → fokus (m).
- `src/ui/cityPreview.css:1–7` menyembunyikan `#hud-score, #hud-top-right, #story-card, #story-dialog, #hud-prompt, #minimap2d` saat `body.is-city-preview`; kartu kiri (`0 km/j`) tetap tampil.
- Atribusi data sudah ada di layar (`src/ui/Attribution.js`: OpenStreetMap, Overture Maps Foundation).

---

## Tugas 1: Ambil nama dari Overture

**Berkas:** `tools/citybake/farFetch.mjs`.

- [ ] Tambah kolom ke query `bangunan`: `coalesce(names.primary, '') AS nama` (letakkan **sebelum** `wkt`, karena `wkt` kolom terakhir yang mengandung koma berkutip).
  `splitCsv` di `farbake.mjs` sudah menangani kutip ganda; nama yang mengandung tanda kutip ditangani DuckDB (`""`).
- [ ] Jalankan `node tools/citybake/farFetch.mjs bangunan` (±5 menit, butuh internet). Sebelum itu salin cache lama: `cp data-src/overture-kota/bangunan.csv data-src/overture-kota/bangunan_v2.csv`.
  Bila perintah gagal (jaringan/DuckDB): **berhenti dan laporkan**; jangan mengisi nama dengan tangan.
- [ ] Periksa hasil: hitung baris bernama (`node -e` kecil: baris dengan kolom `nama` tidak kosong) dan tulis jumlahnya di laporan. Tulis juga 10 nama dengan luas terbesar sebagai contoh.
- [ ] Commit `feat(citybake): ambil nama bangunan dari Overture` (hanya `farFetch.mjs`; CSV tidak di-commit).

## Tugas 2: `landmarks.json` dari data

**Berkas:** `tools/citybake/farbake.mjs`, `tests/city/farbake.test.js`. Keluaran: `public/far/landmarks.json`.

**Antarmuka murni baru (diekspor):**
```js
/** Bobot kelas untuk skor landmark (indeks FAR_CLASS dari R06). */
export const LANDMARK_WEIGHT = Object.freeze([1, 1.2, 0.6, 2, 0.3, 3, 1.5, 2, 3, 1]);
/** Skor: luas × tinggi efektif × bobot kelas. Tinggi kosong (0) dianggap 6 m. */
export function landmarkScore({ area, h, cls }) // = area * Math.max(h, 6) * LANDMARK_WEIGHT[cls]
/**
 * Saring + urutkan + buang kembaran. Masukan: [{nama, x, z, h, area, cls}].
 * Aturan: nama kosong dibuang; nama < 4 huruf dibuang; calon = cls ∈ {3,5,6,7,8} ATAU area ≥ 2000 ATAU h ≥ 20;
 * dua calon bernama sama (tanpa beda huruf besar/kecil) berjarak < 400 m → simpan yang skornya lebih tinggi;
 * hasil diurutkan skor menurun, dipotong `limit`.
 */
export function pickLandmarks(rows, { limit = 160 } = {})
```
Format keluaran: `{ "sumber": "Overture Maps <rilis dari config.js OVERTURE.release>", "dibuat": "<tanggal ISO>", "butir": [{ "nama", "x", "z", "h", "kelas", "luas", "skor" }] }`
dengan `x, z` dibulatkan ke meter, `skor` bilangan bulat. Perkiraan ukuran < 20 KB.

- [ ] **Tes dulu:**
  ```js
  const rows = [
    { nama: 'Masjid A', x: 0, z: 0, h: 0, area: 3000, cls: 5 },
    { nama: 'masjid a', x: 100, z: 0, h: 0, area: 500, cls: 5 },     // kembaran < 400 m → dibuang
    { nama: 'Rumah', x: 900, z: 0, h: 0, area: 90, cls: 4 },          // bukan calon
    { nama: '', x: 0, z: 900, h: 30, area: 4000, cls: 1 },            // tanpa nama → dibuang
    { nama: 'Gedung B', x: 0, z: 5000, h: 30, area: 1800, cls: 1 },   // calon karena tinggi
  ];
  const out = pickLandmarks(rows);
  expect(out.map((r) => r.nama)).toEqual(['Gedung B', 'Masjid A']); // 1800×30×1,2 = 64.800 > 3000×6×3 = 54.000
  expect(landmarkScore({ area: 3000, h: 0, cls: 5 })).toBe(54000);
  ```
- [ ] Implementasi; di `bakeBuildings` kumpulkan baris bernama **sebelum** `if (skipTiles.has(...)) continue;` ke larik `named`; di `main()` tulis `landmarks.json` dan tambahkan
  `manifest.landmarks = 'landmarks.json'`. Bila kolom `nama` tidak ada di CSV (cache lama): lewati dengan `console.warn`, jangan gagal.
- [ ] Bake: `node tools/citybake/farbake.mjs`. **Baca 40 butir teratas dengan mata.** Buang sampah yang jelas lewat aturan umum (mis. nama yang hanya angka), **bukan** dengan daftar hitam buatan tangan.
  Tempel 20 teratas di laporan PR supaya user bisa mengoreksi (user orang Pekanbaru; ia tahu mana yang benar-benar ikonik).
- [ ] Commit `feat(citybake): landmarks.json dari bangunan bernama` (sertakan `public/far/landmarks.json` dan `manifest.json`).

## Tugas 3: Label bertingkat tanpa tumpang-tindih

**Berkas:** baru `src/ui/cityLabelLayout.js` (murni), `src/ui/CityLabels.js`, `src/app/cityPreview.js`, `src/city/farCity.js`; tes baru `tests/cityLabelLayout.test.js`.

**Antarmuka murni:**
```js
/** Berapa label data yang boleh tampil pada jarak kamera ini. */
export function labelBudget(distance)   // < 2600 → 40; < 9000 → 16; selain itu → 6
/**
 * Pilih label yang tampil. items: [{ id, sx, sy, w, h, priority }] (koordinat layar px, sudah diurutkan prioritas menurun; `fixed: true` = wajib tampil).
 * Serakah: ambil berurutan, tolak yang kotaknya (ditambah `gap` px) memotong kotak yang sudah diambil, berhenti setelah `budget` label tidak wajib.
 * @returns {Set<string>} id yang tampil
 */
export function layoutLabels(items, { budget, gap = 6 })
```
- [ ] Tes: dua kotak bertumpuk → hanya prioritas tertinggi; `budget 1` dengan tiga kotak terpisah → 1 + semua yang `fixed`; kotak `fixed` selalu ada walau bertumpuk.
- [ ] `createFarCity` memuat `landmarks.json` bila `manifest.landmarks` ada dan mengeksposnya: `get landmarks()` (larik `butir`, atau `[]`). Gagal muat → `[]` + `logger.error`.
- [ ] `createCityLabels(parent, { landmarks, onSelect })` → tambah metode `setData(list)` (dipanggil `cityPreview` setelah kota jauh selesai dimuat) dan **kolam 46 tombol** yang dipakai ulang
  (tidak membuat/menghapus DOM tiap frame). Label tujuan perjalanan cepat (dari `landmarks` awal) = `fixed`. Lebar kotak label diperkirakan `8 * teks.length + 18` px, tinggi 24 px.
  `update(camera, distance)`: proyeksikan → buang yang di luar layar → `layoutLabels` → tampilkan. Jalankan tata letak **tiap 6 frame** (bukan tiap frame); posisi tetap diperbarui tiap frame.
  Label data yang namanya sama dengan label wajib dalam radius 300 m dibuang (hindari "Stadion Utama Riau" ganda).
- [ ] Gaya: label data memakai kelas `city-label minor` (lebih kecil dan lebih tembus daripada `major`); tambahkan aturannya di `src/ui/cityPreview.css` dengan ukuran huruf ≥ 13 px.
- [ ] Bidik tiga zoom (`kota-dekat`, `kota-menengah`, `kota-jauh`): tidak ada label bertumpuk; jumlah label naik saat mendekat.
- [ ] Commit `feat(kota): label landmark bertingkat dari data`.

## Tugas 4: HUD mode Kota (U9)

- [ ] `src/ui/cityPreview.css`: tambah `body.is-city-preview #hud-speed { display: none; }` (kecepatan sepeda tidak relevan saat sepeda dibekukan). Baris jam (`#hud-time`) dan baris POV
  (`#hud-cam`, tampil lagi saat POV aktif sejak R01) tetap.
- [ ] Bidik `kota-dekat.jpg`: kartu kiri hanya berisi jam + petunjuk POV. Commit `fix(kota): HUD ringkas di mode Kota`.

---

## Selesai bila

- Tes `tests/city/farbake.test.js tests/cityLabelLayout.test.js tests/city/farCity.test.js` lulus; lint bersih.
- `landmarks.json` < 50 KB; tidak ada nama yang ditulis tangan di kode (`grep -rn "Masjid\|Mal \|Hotel" src/ui/CityLabels.js src/city/farCity.js` kosong).
- Uji P-1 (wajib, oleh user): di zoom menengah dengan label mati (mode foto), user menunjuk ≥ 5 tempat dan menyebut namanya; lalu label dinyalakan untuk mencocokkan.
- `docs/kota/PLAN.md` (B2, C2), `docs/kota/kota-jauh/README.md`, `docs/KRITIK.md` (K2, K3, U9), README rencana diperbarui. Daftar 20 landmark teratas ditempel di `docs/kota/PLAN.md` sebagai dasar urutan model Blender (R26).

## Tidak dikerjakan

- Paspor kota (cap per landmark) dan "Ke sini" dari label → R11 (memakai `landmarks.json` ini).
- Nama jalan, nama kecamatan: butuh sumber dan tata letak lain.
