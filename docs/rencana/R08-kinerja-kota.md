# R08 — Kinerja mode Kota: zoom penuh ≤ 600 draw call (G7, G8)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Ukur sebelum dan sesudah tiap tugas dengan
> `node tools/shots/kritik.mjs --out renders/kritik/<nama> --hanya kota` dan catat `kota-jauh.calls` / `triangles` di tabel "Angka".

**Tujuan:** zoom penuh mode Kota ≤ 600 draw call dan ≤ 3 juta segitiga (sekarang 1.399 / 4,95 juta), tanpa mengubah tampilan zoom dekat.
**Pilar:** P-1 (melihat seluruh kota harus lancar). **Tonggak:** T3. **Branch:** `perf/kota-zoom-penuh`. **Kerjakan sebelum R06/R07** bila memungkinkan.

## Dari mana 1.399 draw call itu (dihitung dari `public/far/manifest.json` + `src/city/farCity.js`)

- 276 sel 2 km. Per sel `addCell` membuat: bangunan **datar** + bangunan **pelana** (≤ 2 `InstancedMesh`; 261 sel berisi bangunan), **pohon** (1; 268 sel), **jalan** (1 `Mesh`; 205 sel).
  Maksimum 2×261 + 268 + 205 = **995** hanya dari lapisan jauh. Sisanya: 65 tile terperinci (±6–9 per tile), proxy, lalu lintas, langit.
- Segitiga: 353.917 bangunan × (8 dinding + 2 atap, atau + 6 atap pelana) ≈ 3,6–4 juta; 183.592 pohon × 8 = 1,47 juta.
- Semua sel tampil sekaligus saat zoom penuh (kamera melihat seluruh peta).

## Fakta kode

- `src/city/farCity.js` `addCell(c)` (baris ±296–360): `ox = c.ix * manifest.cell`, daftar per sel → mesh per sel. `counts = { cells, buildings, trees, roadMeshes }`. `stats()`.
- `createFarCity(...)` mengembalikan `{ group, setActive(on), update(o), stats(), dispose() }`; `update({ focus, distance, hour })` dipanggil `src/city/index.js` tiap frame saat pratinjau.
- `src/app/cityPreview.js` menghitung `dist` (jarak kamera → fokus) tiap frame (baris ±200–212).
- Efek maket: `TiltShiftPass` (`src/core/postprocessing/efekLayar.js`), blur 5-tap separabel setengah resolusi (`BLUR`: offset 1,38 dan 3,23 teksel × `dir`), `radius` dikali `MAKET.radiusScale` di `cityPreview.js`.

---

## Tugas 1: Gabungkan sel menjadi blok 4 × 4 (8 km)

**Rancangan:** mesh tidak lagi per sel, melainkan per **blok** `BATCH × BATCH` sel (`BATCH = 4`). 276 sel → ±25 blok → ≤ 25 × 4 = **100** mesh lapisan jauh.
Data per sel tetap diunduh per sel (berkas tidak berubah, **tanpa bake ulang**); yang berubah hanya cara merakit.

**Antarmuka murni baru (diekspor dari `farCity.js`):**
```js
export const FAR_BATCH = 4;
/** Kunci blok untuk sel (ix, iz). */
export function batchKey(ix, iz, n = FAR_BATCH)   // `${Math.floor(ix / n)}_${Math.floor(iz / n)}`
```
- [ ] Tes (`tests/city/farCity.test.js`): `batchKey(0, 0) === '0_0'`, `batchKey(3, 3) === '0_0'`, `batchKey(4, -1) === '1_-1'`, `batchKey(-1, -4) === '-1_-1'`.
- [ ] Ubah alur muat: `loadAll` mengelompokkan `manifest.cells` per `batchKey`; untuk tiap blok, unduh semua selnya (paralel dibatasi `FETCH_PARALLEL`), kumpulkan
  `flat[]`, `gable[]`, `trees[]`, `roads[]` **dengan koordinat dunia** (tambahkan `ox, oz` saat mengumpulkan), lalu buat **satu** `InstancedMesh` per jenis per blok dan **satu** geometri jalan per blok
  (`roadGeometry` sudah menerima `ox, oz`; panggil per sel lalu `mergeGeometries`, atau perluas agar menerima daftar `{ roads, ox, oz }`).
  `life.addRoads(ox, oz, roads)` tetap dipanggil per sel. Nama mesh: `bangunanJauh:<blok>:datar` dst.
- [ ] Urutan blok: yang terdekat ke stadion dulu (pola `sort` yang sudah ada). Blok yang sedang dimuat belum tampil; itu diterima (dulu per sel 2 km, sekarang per blok 8 km:
  **cek** bahwa waktu sampai blok pertama tampil tidak lebih dari ±2× sebelumnya; bila lebih, turunkan `FAR_BATCH` ke 3).
- [ ] `mesh.computeBoundingSphere()` tetap dipanggil supaya blok di luar layar dibuang saat zoom dekat.
- [ ] Ukur. Harapan `kota-jauh.calls` turun ±900. Commit `perf(kota): gabung sel kota jauh per blok 8 km`.

## Tugas 2: Kurangi isi saat zoom jauh (tanpa bake)

**Rancangan:** di tiap blok, instans diurutkan **sekali** saat dibuat (bangunan: luas `w × d` menurun; pohon: tinggi menurun), lalu `mesh.count` diturunkan saat kamera jauh.
Bangunan terkecil dan pohon terpendek hilang lebih dulu; dari jarak itu mereka lebih kecil dari satu piksel.

**Antarmuka murni baru:**
```js
/** Bagian instans yang digambar (0..1) menurut jarak kamera → fokus (m). */
export function farDetail(distance, kind)
// bangunan: ≤ 6000 → 1;  ≥ 20000 → 0.45;  linier di antaranya
// pohon:    ≤ 4000 → 1;  ≥ 14000 → 0.25;  linier di antaranya
```
- [ ] Tes: `farDetail(1000, 'bangunan') === 1`, `farDetail(20000, 'bangunan') === 0.45`, `farDetail(13000, 'bangunan')` ≈ 0,725; `farDetail(14000, 'pohon') === 0.25`; jenis tak dikenal → 1.
- [ ] Simpan `mesh.userData.total = items.length` dan `mesh.userData.kind`. `update(o)` (sudah menerima `distance`): bila `Math.abs(distance - lastDistance) / lastDistance > 0.08`,
  setel `mesh.count = Math.max(1, Math.round(total * farDetail(distance, kind)))` untuk semua mesh instans. Tanpa alokasi.
- [ ] Ukur segitiga di zoom penuh (harapan ≈ 4,95 jt × ±0,45 ≈ 2,3 jt). **Bidik dan bandingkan** `kota-jauh.jpg` sebelum/sesudah: kepadatan kota harus tampak sama dari jarak itu.
  Bila kota tampak "botak", naikkan batas bawah bangunan ke 0,6.
- [ ] Commit `perf(kota): jumlah bangunan dan pohon mengikuti jarak kamera`.

## Tugas 3: Pola kisi pada blur maket (G8)

**Akar:** blur 5-tap dengan offset sampai 3,23 teksel × `radius`; saat `radius` dikali `MAKET.radiusScale`, jarak antar-sampel melebihi satu teksel → pola kisi di daerah buram
(terlihat di `docs/screenshots/kritik/kota-jauh.jpg`).

- [ ] Baca `TiltShiftPass.render` di `src/core/postprocessing/efekLayar.js`. Ubah supaya blur dijalankan dalam **beberapa iterasi beradius kecil**:
  `const n = Math.min(4, Math.max(1, Math.ceil(this.radius / 1.2)));` lalu ulangi pasangan blur horizontal+vertikal `n` kali dengan radius per iterasi `this.radius / Math.sqrt(n)`
  (ping-pong antara dua target yang sudah ada). Fungsi murni kecil untuk dites: `export function blurPlan(radius) → { iterations, step }`.
- [ ] Tes `blurPlan(1) → { iterations: 1, step: 1 }`, `blurPlan(3.6) → { iterations: 3, step: ≈2.078 }`, `blurPlan(100).iterations === 4`.
- [ ] Biaya: +2 lintasan setengah resolusi per iterasi tambahan, hanya di mode Kota gaya maket. Ukur fps `kota-dekat` sebelum/sesudah.
- [ ] Bidik `kota-jauh.jpg`: daerah buram mulus. Commit `fix(efek): blur maket tanpa pola kisi`.

## Tugas 4: Pojok putih di zoom penuh (G8)

- [ ] Reproduksi: `kota-jauh.jpg` dasar menunjukkan pojok layar putih/terang di luar alas diorama. Periksa di konsol dev saat zoom penuh: `__sim.app.scene.background` dan `scene.fog.color`.
- [ ] Perbaikan yang diputuskan: selama pratinjau Kota aktif, `scene.background` mengikuti warna kabut tiap frame (sudah dilakukan `styleManager` untuk gaya non-asli:
  `if (scene.background?.isColor) scene.background.copy(f.color)`); bila pojok tetap putih berarti itu **langit** (kubah `Sky`) yang terlihat di bawah cakrawala.
  Tambahkan satu bidang besar "lantai dunia" di bawah alas diorama: `PlaneGeometry(200000, 200000)` pada `y = GROUND_Y - 900` (dasar lapisan `SLAB_STRATA`), `MeshBasicMaterial({ color: warna kabut, fog: true })`,
  bagian dari `group` kota jauh (+1 draw call).
- [ ] Bila setelah itu tepi masih terlihat janggal, batasi `zoomMax` `'kota'` dari 14 ke nilai terbesar yang masih menampilkan seluruh `manifest.bounds` (hitung dari bidikan, jangan menebak;
  tulis nilai akhirnya di laporan).
- [ ] Commit `fix(kota): tidak ada pojok putih di zoom penuh`.

## Angka (isi saat mengerjakan; dasar 2026-11-14 preset Rendah, headless)

| Titik | Dasar calls / segitiga | Setelah T1 | Setelah T2 | Target |
|---|---|---|---|---|
| `kota-dekat` | 157 / 0,43 jt | | | tidak naik |
| `kota-jauh` (zoom penuh) | 1.399 / 4,95 jt | | | ≤ 600 / ≤ 3 jt |
| `kota-malam` | 218 / 0,57 jt | | | tidak naik |

## Selesai bila

- Target tabel tercapai; tes `tests/city/farCity.test.js` lulus; lint bersih.
- Ukur di laptop user dengan `?perf` pada zoom penuh (fps headless tidak bisa dipercaya); tulis angkanya di `docs/kota/PLAN.md` baris "Ukur di GPU asli".
- `docs/ARSITEKTUR.md` tabel "Dunia: siapa dipasang kapan" (baris pratinjau kota) dan log keputusan (+1 baris: "kota jauh digabung per blok 8 km"), `docs/KRITIK.md` (G7, G8), README rencana diperbarui.

## Tidak dikerjakan

- Cincin tile terperinci kedua (±6 km): ditahan sampai kartu ini lulus (keputusan arah).
- LOD geometri bangunan (kotak tanpa atap pelana saat jauh): hanya bila T2 belum cukup.
