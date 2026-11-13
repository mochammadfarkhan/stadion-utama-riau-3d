# R12 — Sisa Putaran 1 yang belum punya paket (G5, U8, K7, K8)

> **Untuk eksekutor:** baca `docs/rencana/README.md` dulu. Empat butir kecil yang berdiri sendiri; tiap butir = 1 PR kecil atau 1 commit.
> Keempatnya tidak menghalangi tonggak mana pun; kerjakan di sela kartu besar.

## Tugas 1 (G5): Gedung kit UNRI tampak kotak polos dari dekat — **selidiki dulu**

**Yang terlihat:** bidikan `docs/screenshots/kritik/unri-kotak-polos.jpg` (posisi (−206, 1118), setelah teleport): gedung di ±40 m tampak kotak abu tanpa detail.
`ARSITEKTUR.md`: gedung kit punya LOD 150/900 m. Belum diketahui apakah ini (a) pergantian LOD yang belum selesai setelah teleport, atau (b) gedung itu memang belum punya detail.

- [ ] Reproduksi **tanpa teleport**: `npm run dev`, perjalanan cepat ke "Sekretariat Lembaga", lalu **bersepeda** ke (−206, 1118) (lihat koordinat di `__sim.ents.bike.state`). Tunggu 10 detik. Bidik.
- [ ] Bila gedung menjadi berdetail setelah beberapa detik → ini (a). Cari pengatur LOD gedung kit: `grep -rn "150\|900" src/districts/unri/buildings.js src/districts/unri/*.js | head` dan
  `grep -rn "lod" src/districts/unri/buildings.js`. Perbaikan: setelah teleport (`settle`/`whenSettled` distrik), paksa satu evaluasi LOD seketika (bukan menunggu pewaktu). Tulis tes bila logikanya murni.
- [ ] Bila tetap polos → ini (b). Catat nama gedungnya (dari `public/districts/unri/buildings.json`, cari jejak terdekat ke koordinat) di `docs/KRITIK.md` dan pasang shader fasad murah yang
  sudah ada (`src/city/facade.js` `applyFacade(material, 'wall')`) pada material LOD jauh gedung kit. **Cek aturan lapisan:** `districts/` boleh mengimpor `city/`? Lihat `eslint.config.js`; bila tidak boleh,
  pindahkan `applyFacade` ke `src/world/shaders/` dulu (impor ulang dari `city/facade.js` agar pemakai lama tidak berubah).
- [ ] Commit sesuai temuan; tulis mana yang benar (a/b) di laporan.

## Tugas 2 (U8): Minimap senada tema

**Akar:** `src/ui/Minimap2D.js` memakai warna keras di kode (`BG = '#2f5b32'`, `GOAL_COLOR = '#f2b705'`, …), tidak mengikuti tema perkamen.

- [ ] Fungsi baru di `Minimap2D.js`: `readTheme(el = document.documentElement) → { bg, goal, border }` membaca `getComputedStyle(el)`:
  `--hud-accent` → `goal`; bingkai kanvas (CSS, bukan kanvas) diatur di `src/ui/perkamen.css`:
  `html[data-gaya='kartun'] #minimap2d { border: 2px solid #8b6b3d; box-shadow: 0 3px 0 rgba(90, 60, 25, 0.4), 0 8px 18px rgba(60, 40, 15, 0.3); border-radius: 10px; }`.
- [ ] Warna peta dasar (hijau/aspal/air) **tidak** diubah: itu warna dunia, bukan warna UI. Yang disamakan hanya bingkai, penanda tujuan, dan panah pemain.
- [ ] Tema bisa berganti saat main (tombol L): panggil `readTheme()` ulang saat `store` mengubah `graphics.gayaGrafis` (`minimap.refreshTheme()` dipanggil dari `bindGraphics.js`).
- [ ] Bidik `awal-sore.jpg`: bingkai minimap sewarna kartu HUD lain. Commit `fix(ui): bingkai dan penanda minimap mengikuti tema`.

## Tugas 3 (K7): Jalan arteri terbaca dari zoom jauh

**Keadaan:** `src/city/farCity.js` `FAR_ROAD_WIDTH = [18, 16, 14, 12, 10, 8, 6.5]` m (sudah dilebarkan). Di zoom penuh (jarak kamera > 15 km) jalan 18 m < 1 piksel.

- [ ] Shader jalan: lebar efektif mengikuti jarak kamera. Cara termurah tanpa menulis ulang geometri: simpan **arah samping** tiap simpul sebagai atribut (`aSide`: vektor xz satuan × tanda)
  dan posisi tengah jalan sebagai `position`; di vertex shader (`onBeforeCompile` pada `roadMat`, pola `applyNightGlow`) geser `position.xz += aSide * halfWidth * max(1.0, uPixelWorld * minPx / (2.0 * halfWidth))`
  dengan `uPixelWorld` = ukuran dunia satu piksel pada jarak fokus (dikirim `update({ distance })`: `2 * distance * tan(fov/2) / tinggiLayar`) dan `minPx` per kelas: kelas 0–2 → 2,5 px; kelas 3–4 → 1,5 px; kelas 5–6 → 0 (tidak dijaga).
  `halfWidth` dan `minPx` dikemas di atribut `aRoad` (vec2).
- [ ] Murni untuk dites: `export function pixelWorldSize(distance, fovDeg, viewportH) → number` dan `export function roadHalfWidth(halfWidth, minPx, pixelWorld) → number`. Tes 4 nilai.
- [ ] Bila R08 Tugas 1 (penggabungan blok) sudah masuk, kerjakan di geometri gabungan; bila belum, kerjakan R08 dulu.
- [ ] Bidik `kota-jauh.jpg`: jaringan jalan utama terlihat sebagai garis tipis; `kota-dekat.jpg` tidak berubah. Commit `feat(kota): jalan arteri terbaca dari zoom jauh`.

## Tugas 4 (K8): Lapangan, sekolah, rumah sakit, makam di peta tanah

**Keadaan:** `tools/citybake/farFetch.mjs` mengambil `base/land_cover` (tutupan lahan), **bukan** `base/land_use`. Peta tanah (`ground.webp`) digambar di `farbake.mjs` dari `COVER_COLOR` + air + jalan + kerapatan bangunan.

- [ ] `farFetch.mjs` query baru `guna`: `SELECT coalesce(class, subtype, '') AS kelas, ST_AsText(ST_Simplify(geometry, 0.00005)) AS wkt FROM ${base('base', 'land_use')} WHERE ${where()}` → `guna.csv`.
  Jalankan `node tools/citybake/farFetch.mjs guna` (±5 menit, butuh internet). **Periksa nilai `kelas` yang benar-benar ada** (hitung per nilai dengan `node -e`) dan tulis di laporan; jangan mengandaikan nama kelas.
- [ ] `farbake.mjs`: tabel `USE_COLOR` untuk kelas yang **ada di data** dari kelompok: lapangan olahraga (`pitch`/`sports…`), sekolah/kampus, rumah sakit, makam, taman, bandara/landasan.
  Warna usulan: lapangan `#6fae4e`, pendidikan `#c9b98a`, kesehatan `#d9c7c7`, makam `#7f9a78`, taman `#74a857`, landasan `#8a8d92`. Digambar **setelah** tutupan lahan dan **sebelum** jalan
  (pola pemakaian `COVER_COLOR` di pembuat SVG peta tanah). Bila `guna.csv` tidak ada → lewati dengan peringatan.
- [ ] Tes murni kecil: fungsi `useColor(kelas) → string|null` (kelas tak dikenal → `null`).
- [ ] Bake ulang, bidik `kota-menengah.jpg`: lapangan dan kompleks kampus/sekolah terbaca sebagai bidang berwarna. Ukuran `ground.webp` tidak naik > 15%.
- [ ] Commit `feat(citybake): guna lahan (lapangan, sekolah, RS, makam) di peta tanah`.

## Selesai bila

- Tiap tugas: lint bersih, tes terkait lulus, bidikan sebelum/sesudah di `docs/screenshots/kritik/r12/`.
- `docs/KRITIK.md` (G5, U8, K7, K8), `docs/kota/PLAN.md` (C3, C5), README rencana diperbarui.
