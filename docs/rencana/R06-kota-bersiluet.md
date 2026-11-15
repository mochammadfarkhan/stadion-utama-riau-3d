# R06 — Kota bersiluet: kelas bangunan, kubah, warna kawasan (K1, K6)

> **Untuk eksekutor:** baca `docs/rencana/README.md`, `docs/kota/PLAN.md` (bagian Landmark), dan `docs/kota/kota-jauh/README.md` dulu.
> Jalur data: `tools/citybake/farFetch.mjs` (Overture → CSV di `data-src/overture-kota/`, **sudah ada di mesin user, tidak perlu diunduh ulang untuk kartu ini**)
> → `tools/citybake/farbake.mjs` → `public/far/*.bin` → `src/city/farCity.js`.

**Tujuan:** dari zoom menengah mode Kota, kawasan bisa dibedakan dari warna, dan rumah ibadah terlihat sebagai kubah, bukan kotak abu.
**Pilar:** P-1. **Tonggak:** T3. **Branch:** `feat/kota-bersiluet`. **Prasyarat:** R08 Tugas 1 (penggabungan sel) **sebaiknya** lebih dulu supaya draw call tidak bertambah di atas angka yang sudah buruk; bila belum, kartu ini tetap aman (+2 draw call).

## Kenyataan data (dihitung dari `data-src/overture-kota/bangunan.csv`, 2026-11-14)

- 420.728 bangunan. **415.785 (98,8%) tanpa kelas.** Yang berkelas: `house 2114`, `terrace 932`, `retail 369`, `school 250`, `commercial 233`, `religious 216`, `industrial 114`,
  `residential 102`, `education 93`, `mosque 81`, `semidetached_house 77`, `warehouse 36`, `roof 36`, `medical 31`, `hospital 30`, `civic 29`, `office 28`, `detached 25`,
  `university 24`, `library 12`, `apartments 11`, `kiosk 11`, `hotel 10`, `stadium 6`, `transportation 6`, `church 6`, `supermarket 5`, `college 4`, `dormitory 4`, `public 4`, `temple 3`, `grandstand 2`, …
- Tinggi: **420.009 tanpa data tinggi**; 463 < 8 m; 209 antara 8–15 m; 35 antara 15–25 m; **hanya 12 bangunan ≥ 25 m**.
- Luas ≥ 4.000 m²: 235 bangunan (142 tanpa kelas, 20 gudang, 11 sekolah, 4 stadion, …).

**Akibat untuk rencana (mengoreksi K1 di `docs/KRITIK.md`):**
1. "Menara dari tinggi > 20 m" hampir tidak ada datanya (±25 bangunan). **Dibuang dari kartu ini.**
2. Kubah untuk `religious` + `mosque` = **297 bangunan**, bukan "ratusan masjid di seluruh kota". Tetap bernilai (itu rumah ibadah terbesar/terdata), tetapi jangan menjanjikan lebih.
   `church` (6) dan `temple` (3) **tidak** diberi kubah (bentuknya lain; jangan mengarang).
3. Warna kawasan dari kelas hanya mengenai 1,2% bangunan. Supaya kawasan terbaca, warna **juga** diturunkan dari bentuk: luas besar tanpa kelas → "gedung besar" (abu kebiruan), rumah kecil → hunian.

## Fakta kode (dicek 2026-11-14)

- Rekaman bangunan **10 byte** (`farbake.mjs` kepala berkas): `u16 x, u16 z` (desimeter dari sudut sel), `u8 lebar, u8 dalam, u8 tinggi` (0,5 m), `u8 kelas`, `u8 rotasi`, `u8 bendera` (bit0 = atap pelana).
- `farbake.mjs:39` `BUILDING_CLASS = { commercial: 1, retail: 1, office: 1, industrial: 2, warehouse: 2, religious: 3, mosque: 3, civic: 3, education: 3, school: 3, medical: 3, residential: 4, house: 4, apartments: 4 }`;
  kelas lain → 0. `bakeBuildings` (baris ±128–176): `const cls = BUILDING_CLASS[r.kelas] ?? 0;` dan
  `const gable = area < 170 && aspect < 2.8 && (cls === 0 || cls === 4) && h <= 7 ? 1 : 0;`.
- `farFetch.mjs:30` kelas = `coalesce(class, subtype, '')`.
- Klien `src/city/farCity.js`: `parseBuildings(buffer) → [{x, z, w, d, h, cls, rot, gable}]`; `FAR_CLASS_TINT` (5 entri, rentang 0,78–1,1);
  `addCell` membuat `InstancedMesh` per sel × {datar, pelana}; warna instans = `FAR_CLASS_TINT[cls] × variasi`.
  Geometri satuan: `wallsGeometry`, `flatRoofGeometry`, `gableRoofGeometry`, `mergedBuilding`. Tes: `tests/city/farCity.test.js`, `tests/city/farbake.test.js`.
- Sel: 276 (261 berisi bangunan), 353.917 bangunan di lapisan jauh (sisanya di dalam tile terperinci).

---

## Tugas 1: Kelas yang lebih kaya di bake

**Berkas:** `tools/citybake/farbake.mjs`, `tests/city/farbake.test.js`.

**Antarmuka murni baru (diekspor):**
```js
/** Indeks kelas klien: 0 lain, 1 niaga, 2 industri, 3 publik, 4 hunian, 5 ibadah, 6 pendidikan, 7 kesehatan, 8 olahraga, 9 gedung besar (tanpa kelas, luas ≥ 1500 m²). */
export const FAR_CLASS = Object.freeze({ lain: 0, niaga: 1, industri: 2, publik: 3, hunian: 4, ibadah: 5, pendidikan: 6, kesehatan: 7, olahraga: 8, besar: 9 });
export function classifyBuilding(kelas: string, area: number): number
/** Bendera byte ke-10: bit0 pelana, bit1 kubah. */
export function buildingFlags({ cls, area, aspect, h }): number
```
Pemetaan `classifyBuilding` (nilai `kelas` persis seperti di data):
- niaga: `commercial retail office hotel supermarket kiosk` · industri: `industrial warehouse manufacture` · publik: `civic public transportation post_office library`
- hunian: `residential house apartments terrace semidetached_house detached dormitory` · ibadah: `religious mosque church temple`
- pendidikan: `education school university college kindergarten` · kesehatan: `medical hospital` · olahraga: `stadium grandstand`
- `''`/tak dikenal: `area ≥ 1500 → besar (9)`, selain itu `lain (0)`.

`buildingFlags`: bit0 (pelana) = aturan lama dengan `cls ∈ {0, 4}`; bit1 (kubah) = `kelas ∈ {religious, mosque}` **dan** `area ≥ 120` (musala kecil tetap kotak) —
karena `classifyBuilding` meleburkan gereja/kuil ke ibadah, `buildingFlags` menerima juga `kelas` mentah: tanda tangan akhir `buildingFlags({ kelas, cls, area, aspect, h })`.

- [ ] **Tes dulu:**
  ```js
  expect(classifyBuilding('mosque', 400)).toBe(5);
  expect(classifyBuilding('university', 900)).toBe(6);
  expect(classifyBuilding('hospital', 3000)).toBe(7);
  expect(classifyBuilding('terrace', 80)).toBe(4);
  expect(classifyBuilding('', 2000)).toBe(9);
  expect(classifyBuilding('', 80)).toBe(0);
  expect(buildingFlags({ kelas: 'mosque', cls: 5, area: 400, aspect: 1.2, h: 8 }) & 2).toBe(2);
  expect(buildingFlags({ kelas: 'church', cls: 5, area: 400, aspect: 1.2, h: 8 }) & 2).toBe(0);
  expect(buildingFlags({ kelas: 'mosque', cls: 5, area: 60, aspect: 1, h: 4 }) & 2).toBe(0);
  expect(buildingFlags({ kelas: '', cls: 0, area: 100, aspect: 1.5, h: 4 }) & 1).toBe(1);
  ```
- [ ] Implementasi; `bakeBuildings` memakai keduanya (hapus objek `BUILDING_CLASS`). Perbarui komentar format di kepala berkas (bendera bit1 = kubah; daftar kelas).
- [ ] `manifest.json`: naikkan `version` 2 → 3 (cari di `main()` berkas itu) supaya klien lama tidak salah baca.
- [ ] Bake ulang: `node tools/citybake/farbake.mjs` (±15 detik; butuh `data-src/overture-kota/*.csv` yang sudah ada). `git status` → hanya `public/far/*` berubah; ukuran total folder tidak berubah berarti.
- [ ] Commit `feat(citybake): kelas bangunan diperkaya + bendera kubah` (sertakan `public/far`).

## Tugas 2: Klien membaca kelas baru; warna kawasan terbaca (K6)

**Berkas:** `src/city/farCity.js`, `tests/city/farCity.test.js`.

- [ ] `parseBuildings`: tambah field `dome: (flags & 2) === 2`. Tes: buffer 10 byte dengan bendera `3` → `gable true, dome true`.
- [ ] `FAR_CLASS_TINT` menjadi 10 entri (pengali RGB atas dinding krem `#d6ccb8` dan atap):
  ```js
  export const FAR_CLASS_TINT = Object.freeze([
    [1, 1, 1],          // 0 lain
    [1.08, 0.86, 0.72], // 1 niaga: hangat jingga
    [0.70, 0.80, 0.98], // 2 industri: biru-abu
    [1.12, 1.08, 0.86], // 3 publik: krem terang
    [1.0, 0.93, 0.86],  // 4 hunian
    [0.82, 1.08, 0.86], // 5 ibadah: hijau lembut
    [1.10, 0.98, 0.70], // 6 pendidikan: kuning gading
    [1.12, 1.12, 1.14], // 7 kesehatan: putih
    [0.92, 0.92, 0.96], // 8 olahraga
    [0.80, 0.84, 0.92], // 9 gedung besar tanpa kelas: abu kebiruan
  ]);
  ```
  Tes: panjang 10; tiap entri 3 angka dalam [0,6; 1,2].
- [ ] Bidik `node tools/shots/kritik.mjs --out renders/kritik/r06-t2 --hanya kota` dan buka `kota-dekat.jpg` + satu bidikan zoom menengah (tambahkan titik `kota-menengah`
  ke alat: `director.zoom = 4`, tunggu 9 detik). Warna harus **terbaca tetapi tidak norak**: bila kota tampak seperti konfeti, kecilkan simpangan tiap kanal 30% ke arah 1 dan bidik ulang (satu putaran saja).
- [ ] Commit `feat(kota): warna kawasan per kelas`.

## Tugas 3: Kubah rumah ibadah (K1)

**Berkas:** `src/city/farCity.js`, `tests/city/farCity.test.js`.

**Rancangan:** bangunan berkubah **tetap** digambar sebagai kotak beratap datar seperti sekarang; kubah adalah **ornamen** di atasnya, dikumpulkan dari semua sel ke
**satu `InstancedMesh` global** (≤ 297 instans) → **+1 draw call** untuk seluruh kota.

**Antarmuka (diekspor untuk tes):**
```js
/** Kubah satuan: setengah bola radius 0,5 di atas leher silinder pendek, alas di y = 0, warna per vertex (kubah, leher). ≤ 120 segitiga. */
export function domeGeometry(domeColor, neckColor)
/** Skala & posisi kubah untuk satu bangunan. @returns {{x, y, z, r}} r = radius kubah (m) */
export function domePlacement(b, ox, oz)   // r = clamp(Math.min(b.w, b.d) * 0.32, 2.5, 14); y = Math.max(2.4, b.h)
```
Warna (tambahkan ke `FAR_COLORS`): `dome: '#3f8f6a'` (hijau kubah), `domeNeck: '#f1ead8'`. **[INFERENSI]:** warna kubah seragam hijau adalah gaya, bukan data; tulis itu di komentar.

- [ ] Tes: `domeGeometry` punya atribut `position` dan `color`, ≤ 360 simpul, `y` minimum 0; `domePlacement({ w: 20, d: 30, h: 8, x: 5, z: 6 }, 100, 200)` → `{ x: 105, y: 8, z: 206, r: 6.4 }`;
  bangunan mungil (`w: 4`) → `r = 2.5`.
- [ ] `createFarCity`: larik `domes = []` diisi di `addCell` untuk `b.dome`. Setelah `loadAll` selesai memuat semua sel, buat satu `InstancedMesh(domeGeo, buildingMat-tanpa-fasad, domes.length)`
  bernama `kubahJauh` (material sendiri `MeshLambertMaterial({ vertexColors: true })`, **tanpa** `applyFacade`), skala `(2r, 2r, 2r)`, posisi `(x, y, z)`.
  Karena sel dimuat bertahap, kubah muncul setelah semua sel selesai; itu diterima.
- [ ] `stats()` menambah `domes: domes.length`. Catat angka sebenarnya di laporan (harapan: mendekati 297 dikurangi yang berada di dalam tile terperinci dan yang luasnya < 120 m²).
- [ ] Bidik zoom menengah di atas kawasan padat: titik-titik hijau kubah terlihat tersebar. Bila dari zoom menengah kubah tidak terlihat sama sekali, naikkan batas bawah `r` dari 2,5 ke 4 (kubah boleh sedikit lebih besar dari aslinya: ini maket).
- [ ] Commit `feat(kota): kubah rumah ibadah (satu InstancedMesh)`.

## Tugas 4: Tile terperinci ikut konsisten (cek saja)

- [ ] Bangunan di dalam tile terperinci (65 tile LOD0, `public/tiles`) **tidak** lewat jalur ini. Buka `kota-dekat.jpg`: bila di perbatasan tile terperinci ↔ kota jauh warna melompat mencolok,
  catat di laporan dan di `docs/kota/PLAN.md` (jangan diperbaiki di kartu ini; pewarnaan tile ada di `src/city/facade.js` / bake tile).

---

## Selesai bila

- Tes `tests/city/farbake.test.js tests/city/farCity.test.js` lulus; lint bersih; `npm run build` tidak membengkak (`public/far` ±3 MB seperti sebelumnya).
- `ringkasan.json`: `kota-jauh.calls` naik ≤ 2 dari dasar (1399) atau dari angka setelah R08.
- Bidikan sebelum/sesudah disimpan di `docs/screenshots/kritik/r06/`.
- `docs/kota/kota-jauh/README.md` (format v3, kelas, kubah), `docs/kota/PLAN.md` (B1, C1), `docs/KRITIK.md` (K1 dengan koreksi data, K6), README rencana diperbarui.

## Tidak dikerjakan

- Bentuk menara, atap gergaji industri, gereja/kuil: datanya terlalu sedikit atau bentuknya tidak diketahui.
- Nama landmark dan label → R07. Model buatan tangan (Blender) → R26.
