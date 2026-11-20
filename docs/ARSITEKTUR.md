# Peta arsitektur (titik masuk dokumentasi)

> Baca berkas ini dulu sebelum menjelajah kode. Perbarui bila menambah lapisan, sistem per-frame,
> region/distrik, atau mengubah anggaran. Terakhir diperbarui: 2026-10-27.

## Angka cepat (2026-10-27)

| Hal | Nilai |
|---|---|
| Kode `src/` | ±52.800 baris JS, ±440 berkas; terbesar `world/` (17,3 rb), `regions/` (7,1 rb) |
| Tes | 142 berkas di `tests/` (Vitest, hanya logika berisiko) |
| Aset `public/` | 34 MB (KTX2 + GLB); berkas terbesar ±1,2 MB |
| Bundel build | `three` ±700 KB + kode aplikasi ±300 KB (dist lama, belum diukur ulang) |
| Rencana/spec | `docs/superpowers/plans/` (18), `docs/superpowers/specs/` (6) |

## Lapisan (`src/`) dan siapa boleh mengimpor siapa

Aturan dipaksa oleh `eslint.config.js` (`no-restricted-imports`). Urutan kira-kira dari paling murni ke paling atas:

| Lapisan | Isi | Catatan aturan |
|---|---|---|
| `config/`, `geo/` | konstanta, data, matematika poligon | murni: tanpa `three`, tanpa lapisan lain |
| `shared/` | utilitas kecil lintas lapisan | tanpa lapisan lain |
| `engine/` | `SystemRunner`, scheduler, frameCap, qualityTier, disposeTree | tanpa lapisan lain |
| `sim/` | logika permainan murni (kebun, inventory, partikel, dompet, siklus hari) | hanya `engine` |
| `story/` | data bab/NPC/titik | tanpa `three`, hanya `sim` |
| `world/` | rendering dunia: tanah, rumput, pohon, langit, cuaca, kit gedung, tekstur, shader | tidak boleh ke ui/core/entities/regions/districts/city/app |
| `entities/` | sepeda, humanoid, kendaraan | — |
| `city/` | streaming tile kota (`ChunkStreamer`, `TileLoader`) | hanya bawah `world` |
| `regions/` | region (stadion, unri-lembaga, unri-rektorat) + `heroLod` | tidak ke ui/core/app/districts/city |
| `districts/` | distrik besar (UNRI) + `terrainChunks` | — |
| `interiors/` | interior (sekre ERC D5, tribun) | — |
| `core/` | `App` (renderer, loop), kamera, input, collider, audio, StoryDirector | tidak ke ui/app/districts, tidak ke `world/stadium` |
| `ui/` | HUD, menu, panel, minimap, inventory, sentuh | tidak ke `app` |
| `app/` | perekat fitur: regionManager, mount, farm, shop, quality, session | — |
| `main.js` | **composition root**: merakit semuanya | tidak boleh diimpor siapa pun |

## Alur boot (`src/main.js`)

1. `App` dibuat (renderer, scene, kamera) → cek WebGL.
2. Layar muat (`ui/LoadingScreen`) melangkah: tekstur prosedural → region stadion (persistent) →
   distrik UNRI (`mountDistrict`) → entitas → waktu/cuaca → cerita → HUD/minimap.
3. Tiap modul mendaftar ke loop lewat `app.addSystem({ id, phase, update(dt, ctx) })`.
4. `regionManager.update(focus)` tiap frame memasang/melepas region streaming.
5. Sepeda dibuat di titik stadion (latar menu orbit stadion). Saat Mulai: tempat tersimpan dipulihkan, atau bila tidak ada,
   `travel.goTo(START_POINT)` (`config/startPoint.js`) membawa pemain ke depan pintu sekre ERC lewat layar perjalanan (R03).

## Loop per frame

`App` menjalankan sistem per **fase** (urutan tetap): `input` → `sim` → `world` → `ui`, lalu render.
Contoh: `gamepad` (input), `entities.N` + `regions` (sim), `timeOfDay` → `weather` → `heroOrnaments`
(world), `scheduler` + HUD/minimap (ui). Batas FPS (`engine/frameCap.js`) memotong frame sebelum semua ini.

Aturan praktis untuk sistem baru:
- Jangan alokasi (`new THREE.Vector3` dll.) di dalam `update`; simpan scratch di closure modul.
- Kerja berat yang tidak perlu tiap frame → `scheduler` (dicicil), bukan di `update`.
- Pasang/lepas harus simetris: semua yang dibuat saat mount punya `dispose` (lihat `engine/disposeTree.js`).

> Fitur Kota (pratinjau K, tile terperinci, kota jauh, proxy stadion, resep ganti model): **`docs/kota/README.md`** + rencana hidup `docs/kota/PLAN.md` (perbarui tiap sesi).
>
> Kritik kualitas (grafis, model manusia, UI, desain sistem, detail peta) dengan daftar prioritas: **`docs/KRITIK.md`** (hidup, per putaran).
>
> Kartu kerja siap eksekusi dari kritik itu (urutan, prasyarat, tes, angka lulus): **`docs/rencana/README.md`**. Alat ukur baku: `tools/shots/kritik.mjs` (preset dipaksa Rendah).

## Dunia: siapa dipasang kapan

| Bagian | Cara aktif | LOD/penghematan |
|---|---|---|
| Stadion (`regions/stadion`) | `activation.persistent` — selalu terpasang | detail > 650 m dimatikan |
| UNRI lembaga / rektorat | streaming jarak (mountRadius/unmountRadius, histeresis, 1 mount/500 ms) | proxy siluet > 900 m; hero LOD1/tengah > 300 m |
| Distrik UNRI (`districts/unri`) | dipasang saat boot | `terrainChunks`, gedung kit 150/900 m |
| Kota (`city/`) | tile streaming (`ChunkStreamer`) | tile di luar radius dilepas |
| Pratinjau kota (K, `app/cityPreview.js`) | POV `kota`: kamera isometrik; stadion→proxy, region ditahan, semua 65 tile LOD0 dimuat | `city/farCity.js`: SELURUH Pekanbaru di luar tile (380 rb bangunan instans + jalan + peta tanah 2048² WebP), data `public/far/` dari `tools/citybake/farFetch.mjs` + `farbake.mjs` |
| Rincian tile (`city/tileDetail.js`, `facade.js`, `groundDetail.js`) | marka jalan + pohon instans dari data.json; shader jendela/genteng/variasi tanah (tanpa tekstur) | hanya LOD0; wilayah region hero dikecualikan |
| Pohon/humanoid/rumput | instancing | LOD per jenis |

## Anggaran (dari AGENTS.md)

- Draw call region ≤ 250 (terukur 134–197 per titik di GPU kuat pada 2026-10; **terukur ulang 2026-11-14 di preset Rendah, seluruh adegan: 459–511 per titik mode jalan** → kartu R05).
- Tekstur GPU ≤ 70 MB (PBR KTX2 ±16 MB).
- Konten berulang lewat generator + instancing.

## Titik lemah yang diketahui (jujur)

1. **Berkas panjang** — `main.js` sudah dirampingkan (2026-11-14: 599 → ±370 baris; perakitan cerita, minimap, portal, perjalanan cepat,
   sistem frame, dan lapisan region pindah ke `app/*Setup.js`, `app/frameSystems.js`, `app/regionLayer.js`, `app/heroRegions.js`).
   Fitur baru tetap dirakit di `app/<fitur>.js`; `main.js` hanya memanggilnya. ESLint `max-lines` (400 baris kode) memperingatkan
   berkas yang masih melewati batas: `core/App.js`, `interiors/sekre/boards.js`, `interiors/sekre/room.js`, `world/kit/atlasPaint.openings.js` —
   pecah saat berkas itu disentuh kartu kerja, bukan sebagai pekerjaan terpisah. Perabot sekre: satu model = satu berkas di `interiors/sekre/perabot/`.
2. **GPU terintegrasi masih berat** — di laptop user (AMD Radeon terintegrasi) titik kebun: preset Rendah 27 FPS,
   Tinggi 2 FPS. Penyebab spesifik di kebun belum diprofil. Lihat `plans/2026-10-26-performa-open-world.md` Fase 2–4.
3. **Lag sesaat saat streaming** — terukur (Fase 2) penyebab utamanya kompilasi shader, bukan parsing (< 0,7 s);
   sudah ditangani dengan warm-up shader. Web Worker sengaja **belum** dibuat; buka lagi hanya bila `tools/shots/stutter.mjs`
   menunjukkan parsing jadi dominan.
4. **Distrik UNRI dipasang penuh saat boot**, bukan streaming seperti region → waktu muat awal.
5. **Belum ada satu tempat untuk keputusan desain** — tersebar di 18 plan + 6 spec. Pakai log di bawah.

## Log keputusan (tambah 1 baris per keputusan, terbaru di atas)

| Tanggal | Keputusan | Alasan / rujukan |
|---|---|---|
| 2026-11-15 | Sekre: model realistis CC0 Poly Haven (`HQ_ASET`, `tools/sekrehq/build.mjs`) + sorot sore ber-cookie hanya di preset Tinggi; Rendah tetap low poly | permintaan user (rujukan foto meja bersinar sore); laptop iGPU tetap di Rendah |
| 2026-11-14 | Rampingkan berkas gemuk tanpa ubah perilaku: `main.js` → `app/*`, perabot sekre satu model satu berkas, ESLint `max-lines` 400 (peringatan) | permintaan user: kode dirapikan dulu sebelum kartu R01–R25 dikerjakan model kecil; enam kartu menyentuh `main.js` |
| 2026-11-15 | Warga kampus memakai pack orang low poly kiriman user (`entities/Orang.js`, kit NPC sama dengan `createStudentKit`; 1 SkinnedMesh/orang, 19 klip bersama, palet 256 px × kulit sawo/terang); humanoid lama = cadangan & setelan `graphics.orangPack`. Ruang uji dev `/ruang-uji.html` | permintaan user; FBX mentah tanpa lisensi tetap di `data-src/` (tidak di-commit) |
| 2026-11-14 | Landmark hero mode Kota = model Blender 3 LOD yang dipilih menurut jarak kamera (`src/city/landmarks.js`, di dalam grup `kota`, aktif hanya saat pratinjau K); GLB di `public/models/landmark/`. Batas LOD dihitung dari jarak kamera ≈ 1300 m × zoom; daftar posisi tambahan dihasilkan skrip Blender ke `src/city/landmarks.data.js` (26 landmark per 2026-11-15) | An-Nur dulu sebagai percontohan; satu draw call per landmark; resep `docs/kota/landmark/README.md` |
| 2026-11-14 | Kritik dipecah jadi kartu kerja `docs/rencana/R01…R25` (satu kartu = satu PR); alat ukur baku `tools/shots/kritik.mjs` dengan preset dipaksa Rendah. Terukur: mode jalan 459–511 draw call (anggaran ≤ 250), Kota zoom penuh 1.399 | permintaan user: rencana harus bisa dieksekusi model kecil; angka di `docs/rencana/R00-alat-ukur.md` |
| 2026-11-14 | Judul game: **"Anak Bertuah"** (teks di `index.html`/README belum diganti; nama repo tetap) | keputusan user D4, `docs/KRITIK.md` bagian Arah |
| 2026-11-13 | Arah game: dunia terbuka bebas ("GTA pada akhirnya"), **sekre ERC pusatnya**; Kota dan mode jalan dikerjakan seimbang; arah seni dikunci di preset Rendah; judul akan diganti; penguji = teman ERC | keputusan user D1–D6, `docs/KRITIK.md` bagian Arah |
| 2026-11-14 | Karakter jadi dibangun dari kode di A-pose rujukan, vertex dicocokkan ke siluet lembar rujukan user per baris 1 cm, lalu **gambar rujukan diproyeksikan jadi tekstur** (depan/samping/belakang per normal) dan lengan diputar ke pose game; skor IoU siluet `skor_rujukan.py` (kardigan 0,84, pirang 0,80) | user minta model "persis rujukan" (alur plane 2D + maju-mundur vertex); `assets-src/blender/karakter/karakter_preset.py` |
| 2026-11-14 | Karakter jadi kiriman user (3 model, `entities/Humanoid.preset.js`): di-rig di Blender (`assets-src/blender/karakter/rig_preset.py`, 13 tulang = nama pivot Humanoid), tulang = pivot sehingga anim/pose lama langsung jalan; dipasang ke NPC sekre Mala & Fitri via `createHumanoid({preset})` | model user datang (memori: "model manusia tunggu rujukan user"); 1 SkinnedMesh/orang |
| 2026-11-15 | Pratinjau Kota zoom jauh: 157 tile terperinci **digabung per material** (`city/tileMerge.js`, ±5 mesh) dan tile asli disembunyikan; dibangun bertahap (≤ 8 ms per tick) setelah himpunan tile tenang, dibuang saat pratinjau ditutup | R08: diprofil di iGPU AMD user, tile = ±590 dari 780 draw call; zoom jauh 779 → 197 call; biaya ±35 MB geometri selama pratinjau [INFERENSI dari jumlah titik] |
| 2026-11-13 | Pratinjau kota memuat seluruh Pekanbaru lewat lapisan "jauh" instans (bukan tile bake penuh) | 380 rb bangunan = 3 MB biner (8 B/bangunan) vs ±130 MB bila di-bake sebagai tile GLB; peta tanah WebP karena hanya dilihat dari jauh |
| 2026-11-20 | Grafis F1 (cahaya dan nilai): bayangan matahari **PCF** menggantikan VSM, matahari naik dan hemisphere turun di jam 7.5–16 (`LIGHT_BY_HOUR`), grading lebih jenuh, kabut dekat ≥ 450 m, FXAA di semua rasio render, preset Rendah kini berbayangan 1024 | rujukan user: city-builder low poly jenuh berbayangan tegas; perangkat user punya RTX 3050 (Tinggi 41–60 fps terukur) dan iGPU AMD (Rendah tetap 30 fps); MSAA di target composer ditolak review: ±390 MB di 1080p×1,25 |
| 2026-11-20 | Grafis F2 (palet dan bentuk pohon): aspal PBR gelap (efektif ±#4a4d57), `GRASS_TINT` di terrain splat + lapangan, palet daun jenuh, tajuk kampus bergerombol (`clusterCrownGeometry`, 180 segitiga, dulu 240), pohon tile kota bergerombol 42 segitiga (anggaran 28 → 42) dan berbayangan | rujukan user: aspal gelap bermarka putih, rumput cerah, pohon bergumpal; uji A/B di RTX 3050: bayangan pohon tile tidak menurunkan fps secara terukur (variasi antar-jalan lebih besar daripada selisihnya) |
| 2026-11-20 | Grafis F3 (gedung dan tanah kota, tanpa bake ulang): shader fasad `city/facade.js` v6 (jendela berbingkai + ambang + bayangan ceruk, lis lantai, plint, kios berpintu gulung + kanopi belang di ±40% kelompok 3 bay, garis tipis dipudarkan 60–220 m), palet dinding jenuh, landuse 16 kelas + jalur pejalan kaki di-remap (`tilePalette.js`), tanah kota 0x7fb858, pohon tile 66 segitiga | rujukan user: gedung warna-warni berjendela dalam, trotoar krem, rumput cerah; semua lewat shader/remap byte supaya 314 GLB tile tidak dibake ulang; normal instans kota jauh diperbaiki (lereng atap pelana tadinya terbaca dinding) |
| 2026-10-27 | Dokumen ini jadi titik masuk; plan/spec lama tetap arsip | konteks proyek terlalu besar untuk dibaca ulang tiap sesi |
| 2026-10-26 | Batas FPS default 60 + preset kualitas Otomatis | laptop panas & GPU terintegrasi; `engine/frameCap.js`, `config/quality.js` |
| 2026-10-26 | Inventory gaya Minecraft (hotbar), kendaraan tetap ganti bebas | keputusan user; `sim/inventory.js` |
