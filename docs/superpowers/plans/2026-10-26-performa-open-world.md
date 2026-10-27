# Rencana performa open world (2026-10-26)

Keluhan: **muat lama**, **lag sesaat saat melakukan sesuatu**, **laptop panas**; RTX 3050 cukup, laptop teman (kemungkinan GPU
terintegrasi) berat. Rencana ini mengikuti praktik umum game open world (Unreal *Scalability* + *World Partition/HLOD*,
Unity *Quality tiers*, pedoman WebGL/three.js) dan diurutkan dari **untung terbesar per usaha** untuk perangkat lemah.

## Kondisi sekarang (fakta dari repo)

| Hal | Status |
|---|---|
| Waktu frame (RTX, headless 1600×900, mode 3/4) | 16,6–20,4 ms di 5 titik (README) — sudah di batas 60 FPS di GPU kuat |
| Draw call / segitiga | 134–197 draw call, 0,31–0,72 juta segitiga per titik |
| Batas FPS | **tidak ada** (`setAnimationLoop` = refresh layar; layar 144 Hz → render 144×/detik → panas) |
| Preset kualitas otomatis | **tidak ada**; resolusi render default **1,25×**, bloom/garis tepi/kartu daun menyala untuk semua perangkat |
| Resolusi adaptif | ada (`adaptiveResolution`) |
| Web Worker | **tidak ada** (parsing tile/GLB di thread utama) |
| LOD | gedung kit 150/900 m, hero GGM/Masjid LOD1, LOD tengah hero > 300 m, detail stadion > 650 m, proxy region > 900 m, humanoid/pohon |
| Tekstur | KTX2 (±16 MB PBR), anggaran 70 MB |
| Kabut | default 1.100 m |

## Prinsip

1. **Ukur dulu, di perangkat lemah.** Rata-rata FPS menipu; yang dirasakan pemain adalah **p95/p99 waktu frame** (lag) dan
   **long task > 50 ms** (patah-patah). Target minimum: laptop GPU terintegrasi (Intel Iris Xe / AMD Vega), 1080p, **30 FPS stabil**
   (p95 ≤ 40 ms); laptop RTX: 60 FPS stabil (p95 ≤ 20 ms).
2. **Anggaran per tingkat (tier), bukan satu angka.** Rendah / Sedang / Tinggi, masing-masing punya batas draw call, segitiga,
   resolusi, jarak pandang.
3. **LOD berdasarkan ukuran di layar**: fitur berukuran s meter tak terbaca (< 2 px) di jarak ≈ 450·s m (FOV 60°, 1080p).
4. **Gabung yang jauh (HLOD)**: biaya utama three.js adalah draw call (CPU), bukan segitiga.

## Fase 0 — Alat ukur yang bisa dibawa ke laptop teman (S, ±1 sesi)

- [x] `?perf` di URL: lapisan kecil + tombol **"Salin laporan"** → JSON: nama GPU (`WEBGL_debug_renderer_info`), resolusi & pixel
      ratio, rata-rata/p50/p95/p99 waktu frame 30 detik, draw call, segitiga, jumlah tekstur/geometri, memori JS (bila ada), jumlah
      long task + yang terlama (`PerformanceObserver('longtask')`), waktu muat per fase (HTML → mesin siap → area awal siap → bisa main).
- [ ] Skrip `tools/shots/perfSuite.mjs`: 8 titik standar (sekre, lembaga, rektorat, masjid, GGM, stadion dekat, stadion 700 m,
      pusat kota) × mode kamera (orang ketiga, 3/4) → `docs/perf/<tanggal>.json` + tabel ringkas.
- [ ] Baseline: jalankan di laptop 3050 + minta teman membuka Pages dengan `?perf` dan mengirim laporannya.
- **Selesai bila:** ada angka p95 & long task dari **dua** laptop, dan tahu bottleneck teman itu GPU (fill rate) atau CPU (draw call/JS).

**Status (2026-10-27):** overlay `?perf` jadi (`src/app/perfProbe.js`, logika murni + tes `src/engine/perfStats.js`, bidikan
`tools/shots/perfOverlay.mjs`). Jendela frame 30 detik; waktu CPU per frame = sistem + render di thread utama
(`App.cpuMs`); **dugaan** dari frame median: dekat sasaran → lancar / tersendat (≥ 10% frame > 1,5× selang sasaran), selain
itu porsi CPU ≥ 75% → CPU, ≤ 50% → GPU. Tahap muat dari `performance.mark` tiap langkah layar muat. Contoh iGPU AMD
(preset Otomatis → Rendah, batas 30): 29,8 fps, p95 40 ms, CPU p50 11 ms → lancar; layar muat 19 s (dev server) dengan tahap
terlama "Menyiapkan shader…" 4,3 s; long task saat muat 17 (maks ±1,3 s). Belum: `perfSuite.mjs` dan laporan dari laptop teman.

## Fase 1 — Untung cepat untuk laptop lemah & panas (M, ±1–2 sesi)

- [x] **Batas FPS** (pengaturan Performa): 30 / 60 / tanpa batas; default 60 (`engine/frameCap.js`, jadwal bebas drift).
      Belum: "Hemat baterai" otomatis saat on-battery.
- [x] **Preset kualitas** Rendah / Sedang / Tinggi / **Otomatis** (default) + Kustom (`config/quality.js`, `app/quality.js`):
      | Setelan | Rendah | Sedang | Tinggi |
      |---|---|---|---|
      | Resolusi render | 0,75× | 1,0× | 1,25× |
      | Bayangan | mati / kontak saja | rendah | sedang |
      | Bloom, garis tepi, AO | mati | bloom saja | sesuai pilihan |
      | Kartu daun pohon | mati | aktif ≤ 25 m | aktif |
      | Jarak kabut / pandang | 650 m | 900 m | 1.100 m |
      | Kepadatan NPC/penonton | 0,4 | 0,7 | 1 |
- [x] **Deteksi otomatis**: tebakan awal dari nama GPU (Intel/AMD terintegrasi → Rendah) + uji 5 detik setelah area awal siap; turun
      satu tingkat bila p95 > anggaran (sekali, beri toast "kualitas diturunkan, ubah di Pengaturan").
- **Selesai bila:** laptop teman ≥ 30 FPS (p95 ≤ 40 ms) di 8 titik standar dengan preset Otomatis; laptop 3050 tidak lagi merender
  di atas 60 FPS (suhu turun).

**Status Fase 1 (2026-10-26):** selesai kecuali hemat baterai. Diukur di laptop user lewat Chromium headless — ternyata
memakai **GPU terintegrasi AMD Radeon (0x164C)**, bukan RTX 3050: Otomatis menebak Rendah, uji p95 94 ms; resolusi tetap 0,75:
batas 30 = 29,9 FPS, batas 60 ≈ tanpa batas (41 vs 35–39 FPS, GPU-bound); di titik kebun Rendah 27 FPS vs Tinggi 2 FPS.
Belum diukur di laptop teman.

## Fase 2 — Hilangkan lag sesaat (stutter) (M, ±2 sesi)

Penyebab umum di WebGL, diperiksa satu-satu dengan laporan long task dari Fase 0:
- [ ] **Kompilasi shader saat konten muncul pertama kali** (traktor, kebun, interior, partikel, gaya grafis lain): panggil
      `renderer.compileAsync(objek, kamera)` saat model selesai dimuat, **sebelum** ditampilkan (praktik "shader/PSO warm-up").
- [ ] **Unggah tekstur/geometri pertama kali**: `renderer.initTexture()` untuk tekstur besar setelah dimuat.
- [ ] **Sampah memori (GC) per frame**: audit `new THREE.*` di dalam loop per frame/per instans (mis. `Matrix4` di update kebun),
      ganti objek sementara yang dipakai ulang.
- [ ] **Parsing di Worker**: decode `*.data.json` tile & distrik di Web Worker (transfer `ArrayBuffer`); thread utama hanya membuat
      mesh.
- [ ] **Time-slicing berbasis waktu**: scheduler rakitan region memakai anggaran **ms per frame** (mis. 4 ms Rendah / 6 ms Tinggi),
      bukan "satu langkah per frame".
- **Selesai bila:** tidak ada long task > 100 ms saat berjalan/berkendara melintasi kota & kampus, dan tidak ada > 50 ms saat
  memakai item/masuk interior (diukur `?perf`).

**Status Fase 2 (2026-10-27):** diukur dulu (`tools/shots/stutter.mjs`: long task, jeda frame, shader baru, dan SUMBER stall
shader per momen; CPU profile) → **±90 % waktu long task saat masuk area baru = kompilasi shader di frame pertama**
(`getProgramInfoLog` menunggu link D3D11/ANGLE ±0,4 s/program di iGPU). Parsing GLB/noise/drape < 0,7 s, jadi Worker &
audit alokasi ditunda. Dikerjakan:
- `App.warmup/needsWarmup/materialReadyFor`: kompilasi varian PERSIS objek (compile sinkron = mulai link paralel) lalu tunggu
  SEMUA program siap; termasuk **varian depth pass bayangan** (proxy berjenis sama, material depth meniru
  `WebGLShadowMap.getDepthMaterial` — salin map/alphaMap/alphaTest, sisi VSM, penerima VSM ikut, dikompilasi tanpa lampu).
- Region ber-proxy disembunyikan sampai `ready` + hangat (proxy tetap tampil); chunk distrik lewat `watchWarmup`
  (`childadded`, hanya objek yang shader-nya belum siap); kebun/traktor/item/partikel dihangatkan sebelum tampil; interior &
  perjalanan cepat `precompile()` saat layar tertutup; `precompile()` muat ikut varian depth seluruh scene.
- `styleManager` menunda pbrSwap sampai shader material PBR tujuan siap.
- Bake minimap region asinkron (`readRenderTargetPixelsAsync` + `createImageBitmap flipY`).
- Hasil A/B (`?nowarm`, preset Sedang dipasang sebelum muat, iGPU): long task terlama di skenario 1.735 → 754 ms (−57 %),
  total long task 13,4 → 8,7 s (−35 %); masjid 1.735 → 217 ms, buka tas 156 → 0 ms; `tanahKota` depth 1,2 s → 0.
- **Sisa:** stall 150–400 ms dari material yang diubah SESUDAH dihangatkan (registri basah/emisif, pertukaran gaya),
  dan long task non-shader (perakitan region, tekstur prosedural `noise.js`, `updateMatrixWorld` ±0,3 s/2,5 s) →
  langkah berikut: hangatkan ulang saat registri mengubah material, Worker untuk tekstur prosedural/parsing, bekukan
  matriks objek statis yang belum.

**Lanjutan Fase 2 (2026-10-27):**
- Registri basah/emisif ternyata hanya mengubah uniform (bukan sebab stall). Sebab sebenarnya: isi region yang dibangun
  SESUDAH tampil (LOD pohon dekat, benda halaman) → region kini juga diawasi `watchWarmup` sesudah tampil.
- `needsWarmup/warmup` punya jalur cepat (kunci varian material+versi+jenis objek yang sudah terbukti siap) → biaya
  `compile()` warm-up sendiri hilang dari chunk berikutnya.
- Long task non-shader diprofil (`tools/shots/cpuSegmen.mjs`): **atlas kanvas sekretariat** — `fitFont` turun 1 px per
  langkah (measureText + set font berulang, ±330 ms sinkron di build region) → `fitFontSize` pencarian biner (hasil
  identik, ≤ 8 ukur) di 4 tempat; **bake minimap** 1536 → 1024 px (salinan GPU→CPU 258 → 39 ms, data 9,4 → 4,2 MB).
- **Worker tidak dibuat:** tekstur prosedural (`noise.js`) tidak konsisten muncul dan konten kampus tidak memakai
  `fillCanvas` (bake ulang dengan kunjungan kampus tetap 19 tekstur); resepnya berupa closure sehingga tidak bisa dikirim
  ke Worker. Sebagai gantinya manifest bake disimpan sesudah `releaseBaked()` → tekstur yang diminta lagi dimuat ulang
  asinkron dari berkas (bukan dihitung per piksel).
- Koreksi: `OutlinePass.js:30` di profil = `DepthRenderPass` (render scene utama), bukan biaya garis tepi.
- Hasil (preset Sedang, iGPU): total long task skenario `stutter.mjs` 8,7 → ±3,8 s (vs 13,4 s tanpa warm-up), long task
  terlama ±524 ms; teleport rektorat 641 → 240 ms. Sisa: stall shader bervariasi antar run (urutan streaming), perakitan
  geometri distrik (drape/waterEdge/kit) < 100 ms per potong.

## Fase 3 — Muat lebih cepat (M)

- [ ] Ukur fase muat (Fase 0), lalu **muat malas** konten yang tidak dibutuhkan di awal: interior sekre, studio reels, kebun &
      traktor (saat < 600 m), cerita kampus, tekstur gaya grafis yang tidak aktif.
- [ ] Kompres GLB yang belum: `gltfpack` (paket npm `gltfpack`, meshopt + kuantisasi) untuk `public/models/**`.
- [ ] **Cache aset**: service worker sederhana (cache-first untuk `models/`, `textures/`, `tiles/` bertanda versi) → kunjungan kedua
      jauh lebih cepat.
- [ ] Prioritas unduhan: area spawn dulu (sudah ada), sisanya setelah "bisa main".
- **Selesai bila:** "bisa main" < 8 detik di laptop teman (kunjungan pertama) dan < 3 detik (kunjungan kedua).

## Fase 4 — LOD & HLOD dunia (L, bertahap per jenis bangunan)

- [ ] **Aturan LOD berbasis ukuran di layar** (satu fungsi murni + tes): jarak tingkat = f(ukuran objek, tier).
      Patokan Tinggi (Rendah ×0,7):
      | Tingkat | Isi | Gedung kecil–sedang | Landmark (stadion, rektorat, GGM, masjid) |
      |---|---|---|---|
      | LOD0 | penuh | ≤ 150–250 m | ≤ 300–400 m |
      | LOD1 | massa + atap + pita jendela | 250–600 m | 400 m – 1,2 km |
      | LOD2 | kotak siluet (vertex color) | 600 m – kabut | 1,2 km – cakrawala |
- [ ] **LOD1/LOD2 massing untuk landmark** (Blender, ±50–300 segitiga, vertex color, tanpa tekstur): stadion utama, rektorat, GGM,
      masjid. Billboard **tidak** dipakai untuk gedung (salah saat kamera mengorbit / mode 3/4).
- [ ] **HLOD per sel 250 m**: semua LOD2 dalam satu sel digabung jadi **1 mesh** (dibake offline untuk kota/kampus); sel dekat
      memakai mesh asli.
- [ ] **Kabut = jarak pandang**: di luar jarak kabut efektif tier → tidak dirender sama sekali (kecuali landmark LOD2).
- [ ] **Skyline** (opsional): cincin panorama bertekstur di luar radius streaming untuk siluet kota jauh.
- [ ] Transisi tanpa "pop": histeresis (sudah) + fade dither (pakai ulang `src/engine/occlusionFade.js`).
- **Selesai bila:** draw call di 8 titik standar turun ≥ 30% pada mode 3/4 tanpa regresi visual di bidikan kunci.

## Fase 5 — Pagar pengaman (S, berkelanjutan)

- [ ] Anggaran per tier di `src/config/` dan dicek oleh `perfSuite.mjs` (gagal bila > anggaran atau naik > 10% dari baseline).
- [ ] Tambah ke AGENTS.md: fitur baru wajib lewat `perfSuite` sebelum push; konten baru wajib punya LOD/ukuran layar & warm-up shader.

## Urutan yang disarankan

Fase 0 → 1 → 2 → 3 → 4 → 5. Fase 1 kemungkinan besar sudah menyelesaikan "panas" dan sebagian besar "berat di laptop teman";
Fase 2 untuk "lag sesaat"; Fase 4 investasi untuk dunia yang terus bertambah. Tiap fase diukur ulang dengan alat Fase 0.
