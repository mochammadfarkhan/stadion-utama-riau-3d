# R04 — Stadion sebagai ikon: proxy mode Kota dan wajah malam (K4, G6)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dan `docs/kota/stadion-proxy/README.md` dulu. Ini kartu visual: tiap tugas diakhiri bidikan yang kamu buka sendiri.

**Tujuan:** dari mode Kota (K), stadion langsung dikenali dari siluetnya (rusuk busur putih, selembayung, tribun warna-warni), bukan "mangkuk abu dengan cincin biru";
malam hari stadion di mode jalan tidak gelap gulita.
**Pilar:** P-1 (tempat yang dikenali). **Tonggak:** T1 (ikon sampul), bagian Kota T3. **Branch:** `feat/stadion-ikon`.
**Anggaran proxy (dari README proxy):** ≤ 8 draw call, ≤ 10.000 segitiga. Sekarang: 2 draw call, ±4.000 segitiga.

## Fakta kode (dicek 2026-11-14)

- Proxy: `src/regions/stadion/proxy.js` `buildStadionProxy(ctx) → { group, setNight(n), dispose() }`. Satu mesh `vertexColors` (`MeshLambertMaterial`) hasil `mergeGeometries` +
  satu mesh kepala lampu. Warna di objek `COLOR` bertanda `[INFERENSI, tanpa foto]`: `kursi: 0x2563b8` (biru), `fasad: 0xf3efe4`, `atap: 0xf7f7f4`.
  Pembantu: `flatRing`, `bowl()`, `floodlights()`, `paint(geometry, hex)`, `boxAt(w, h, d, x, y, z)` (dari `src/world/props/unri/geom.js`).
- Stadion asli (mode jalan) punya **sumber bentuk yang sama yang bisa dipakai ulang**:
  - `src/config/stadionSite.js` `STADIUM`: `innerSemiX 60, innerSemiZ 100, outerSemiX 118, outerSemiZ 160, roofHeight 42, facadeHeight 30, ribCount 20, ribLean 0.22, roofOpeningPad 8`.
  - `src/world/stadium/profiles.js`: `RIB_PROFILE` (8 titik `{k, y}`), `SELEMBAYUNG_PROFILE` (titik `{k, y, s}`), `ROOF_PROFILE`.
  - `src/world/stadium/ovalFrame.js`: `frameAt(u)` (→ `{x, z, nx, nz, tx, tz}`), `framePoint(u, k, y)` (→ `Vector3`); `u` = fraksi keliling, 0 di utara (−Z).
  - `src/world/stadium/ShellRibs.js`: rib asli = `ExtrudeGeometry` 48 langkah per rib (terlalu berat untuk proxy); `RIB_THICK 1.4`, `RIB_WIDTH 3.2`;
    rib ke-0 dan ke-`count/2` adalah selembayung (dua rusuk menyilang).
  - Warna: `src/config/constants.js` `COLORS.acp 0xf7f2e8` (rib), `COLORS.louvre 0xc8956a`, `COLORS.louvreGold 0xdcb46e`; kursi `src/world/stadium/Tribune.seats.js:17`
    `DEFAULT_PALETTE = [0xf2b705, 0xe8711c, 0xd62828, 0x1f7a3a, 0x1d4e89]` (kuning, oranye, merah, hijau, biru).
- `regions/` boleh mengimpor `world/` (proxy sudah mengimpor `world/stadium/ovalMath.js`).
- Pemasang proxy: `src/app/cityPreview.js:67–77` `ensureProxy()`; `setNight` dipanggil tiap frame.
- Malam di mode jalan: bidikan dasar `docs/screenshots/kritik/dasar/awal-malam.jpg`.

---

## Tugas 1: Warna proxy dari sumber yang sama dengan stadion asli

**Berkas:** `src/regions/stadion/proxy.js`.

- [ ] Impor `COLORS` dari `../../config/constants.js` dan `DEFAULT_PALETTE` dari `../../world/stadium/Tribune.seats.js`. Ubah `COLOR`:
  `fasad: COLORS.louvre`, `atap: 0xf7f7f4` (tetap), `rib: COLORS.acp`, hapus `kursi` tunggal.
- [ ] `bowl()`: jalur kursi tidak lagi satu warna biru. Bagi keliling menjadi **10 juring** dan beri warna berselang dari `DEFAULT_PALETTE` (indeks `i % 5`).
  Cara murah: buat cincin kursi dengan `ellipseRingExtrude(..., SEGMENTS)` seperti sekarang, lalu warnai **per simpul** menurut sudut simpul
  (`Math.atan2(x, -z)` → juring) dengan menulis atribut `color` langsung, bukan `paint()` satu warna. Tulis pembantu
  `paintBySector(geometry, palette, sectors)` di berkas itu.
- [ ] Hapus tanda `[INFERENSI, tanpa foto]` hanya untuk warna yang kini berasal dari konstanta bersama; tulis di komentar "warna = sumber yang sama dengan stadion mode jalan".
  **Catatan kejujuran:** warna stadion mode jalan sendiri belum dicocokkan dengan foto; itu tetap tercatat `[INFERENSI]` di `docs/kota/stadion-proxy/README.md`.
- [ ] Bidik: `node tools/shots/kritik.mjs --out renders/kritik/r04-t1 --hanya kota` → `kota-dekat.jpg`: tribun berjuring warna-warni, fasad cokelat hangat.
- [ ] Commit `feat(kota): warna proxy stadion dari sumber stadion asli`.

## Tugas 2: Rusuk busur dan selembayung di proxy

**Berkas:** `src/regions/stadion/proxy.js`; tes baru `tests/stadionProxy.test.js`.

**Antarmuka (fungsi modul, diekspor untuk tes):**
```js
/** Titik-titik polyline satu rusuk pada fraksi keliling u, dari profil (k, y[, s]). @returns {THREE.Vector3[]} */
export function ribPolyline(u, profile, sign = 1)
/** Geometri rusuk berbiaya rendah: satu balok per ruas polyline. @returns {THREE.BufferGeometry} tak berindeks, sudah diwarnai */
export function ribGeometry(points, { thick = 1.6, width = 3.6, hex })
```
`ribPolyline` = isi `ribCurve` di `ShellRibs.js` **tanpa** `CatmullRomCurve3` (cukup titik profil; 8 titik → 7 ruas). `ribGeometry`: untuk tiap ruas A→B buat
`BoxGeometry(thick, panjang, width)`, putar supaya sumbu Y-nya searah A→B (`quaternion.setFromUnitVectors(sumbuY, arah)`), geser ke titik tengah, `toNonIndexed()`, `paint`.
Lebar sedikit dibesarkan dari aslinya (3,2 → 3,6) supaya terbaca dari jauh.

Hitungan anggaran: 20 posisi (18 rusuk biasa + 2 selembayung × 2 rusuk) = 22 rusuk × 7 ruas × 12 segitiga = **1.848 segitiga**. Total proxy ≈ 6.000 (< 10.000).

- [ ] **Tes dulu:**
  ```js
  import { describe, it, expect } from 'vitest';
  import { buildStadionProxy, ribPolyline } from '../src/regions/stadion/proxy.js';
  import { RIB_PROFILE } from '../src/world/stadium/profiles.js';
  import { STADIUM } from '../src/config/constants.js';

  describe('proxy stadion', () => {
    it('rusuk: kaki di tanah, puncak di atas atap', () => {
      const pts = ribPolyline(0.25, RIB_PROFILE);
      expect(pts).toHaveLength(RIB_PROFILE.length);
      expect(pts[0].y).toBe(0);
      expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(STADIUM.roofHeight);
    });
    it('anggaran: ≤ 8 draw call dan ≤ 10.000 segitiga', () => {
      const p = buildStadionProxy();
      let calls = 0;
      let tris = 0;
      p.group.traverse((o) => { if (o.isMesh) { calls += 1; tris += o.geometry.getAttribute('position').count / 3; } });
      expect(calls).toBeLessThanOrEqual(8);
      expect(tris).toBeLessThanOrEqual(10000);
      p.dispose();
    });
  });
  ```
  (Bila `buildStadionProxy` butuh DOM/kanvas, tambahkan `// @vitest-environment jsdom`; proxy sekarang tidak membuat tekstur, jadi seharusnya tidak perlu.)
- [ ] Implementasi `ribPolyline`, `ribGeometry`, dan fungsi `ribs()` yang mengembalikan larik geometri: untuk `i` dari 0 sampai `STADIUM.ribCount − 1`, `u = i / ribCount`;
  bila `i === 0 || i === ribCount / 2` → dua rusuk `SELEMBAYUNG_PROFILE` dengan `sign` +1 dan −1 (skala lebar ×0,85); selain itu satu rusuk `RIB_PROFILE`.
  Tambahkan `...ribs()` ke larik `geos` di `buildStadionProxy` (ikut digabung ke mesh utama → **0 draw call tambahan**).
- [ ] Atap: ganti cincin atap datar (`ellipseRingExtrude(ix + pad, …, 1.4, rh − 1.4)`) dengan dua cincin berundak yang mengikuti `ROOF_PROFILE` secara kasar:
  cincin luar pada `y = rh − 4`, cincin punggung pada `y = rh` (lebar masing-masing setengah bentang). Cukup; jangan membuat permukaan lengkung.
- [ ] Bidik `--out renders/kritik/r04-t2 --hanya kota`. Di `kota-dekat.jpg`: rusuk putih terlihat mengelilingi oval dan dua selembayung menyilang di ujung utara/selatan.
  Bandingkan siluetnya dengan stadion asli di `docs/screenshots/kritik/dasar/awal-sore.jpg` (rusuk miring keluar lalu melengkung ke dalam).
- [ ] Commit `feat(kota): rusuk busur dan selembayung di proxy stadion`.

## Tugas 3: Papan nama dan pendar malam di proxy

- [ ] Papan nama "STADION UTAMA RIAU" di sisi utara: **bukan teks** (tidak terbaca dari udara dan butuh tekstur). Cukup balok biru tua pipih `boxAt(46, 5, 0.6, 0, fh * 0.55, -(oz + 1))`
  berwarna seperti papan asli (ambil warna latar papan dari `src/world/stadium/FacadeSigns.js`; baca berkasnya, jangan menebak hex).
- [ ] `setNight(n)`: selain kepala lampu, tambah **satu** mesh "pendar lapangan": lingkaran elips datar di atas rumput (`MeshBasicMaterial`, warna `0xdfffc8`, `transparent`, `blending: AdditiveBlending`,
  `depthWrite: false`, opacity = `0.35 * n`), supaya dari udara malam hari lapangan tampak disinari. +1 draw call (total 3).
- [ ] Bidik `kota-malam.jpg`: stadion adalah titik paling terang di sekitarnya. Commit `feat(kota): papan nama dan pendar lapangan malam di proxy`.

## Tugas 4: Stadion mode jalan tidak gelap saat malam (G6)

**Keadaan:** di `awal-malam.jpg` cangkang stadion gelap dan papan nama mati; lampu sorot + pendar hanya ada di proxy.

**Cara yang sudah disediakan kode:** registry emissive waktu (`time.registerEmissive(group)`, dipakai `main.js:247–248` dan region saat dipasang) + pola `city/nightGlow.js`.

- [ ] **Baca dulu:** `grep -rn "registerEmissive\|emissiveIntensity\|nightFactor" src/world src/regions/stadion | head -30` untuk melihat konvensi: material mana yang dianggap "menyala malam"
  (biasanya lewat `userData` atau nama material). Tulis konvensinya di laporan.
- [ ] Terapkan konvensi itu pada: (a) material papan nama di `src/world/stadium/FacadeSigns.js` (huruf menyala putih-hangat), (b) strip bukaan concourse/jendela di `ShellBase.js`
  bila ada material kaca/jendela, (c) kepala lampu sorot bila stadion asli punya tiang lampu (`src/world/stadium/Fixtures.js`).
  **Tanpa menambah `PointLight`/`SpotLight`** (anggaran): hanya warna emissive yang mengikuti faktor malam.
- [ ] Bidik `--hanya jalan`, bandingkan `awal-malam.jpg`: tulisan stadion terbaca, ada garis cahaya hangat di badan stadion. `calls` tidak naik.
- [ ] Commit `feat(stadion): papan nama dan bukaan menyala malam`.

---

## Selesai bila

- `tests/stadionProxy.test.js` lulus (anggaran proxy); lint bersih.
- Bidikan sesudah (`kota-dekat.jpg`, `kota-malam.jpg`, `awal-malam.jpg`) disimpan ke `docs/screenshots/kritik/r04/` dan disandingkan dengan dasar di PR.
- Uji P-1: tunjukkan `kota-dekat.jpg` (label dimatikan dengan mode foto) ke satu orang Pekanbaru tanpa penjelasan; catat apakah ia menyebut "stadion".
- `docs/kota/stadion-proxy/README.md` (Status + Log), `docs/kota/PLAN.md` (A1), `docs/KRITIK.md` (K4, G6), README rencana diperbarui.

## Tidak dikerjakan

- Mencocokkan warna dengan foto asli stadion: butuh foto rujukan dari user (dicatat di "Menunggu user").
- Penonton/keramaian hari pertandingan → R10.
