# Kritik game + rencana perbaikan dari sisi kode (hidup — perbarui tiap putaran)

Sudut pandang: kritikus game yang juga membaca sumbernya. Tiap temuan ditandai **[LIHAT]** (terlihat di bidikan),
**[UKUR]** (angka `renderer.info`), **[KODE]** (dibaca dari sumber), atau **[INFERENSI]** (dugaan, belum dibuktikan).
Status: ⬜ belum · 🔄 dikerjakan · ✅ selesai · ➖ dicabut (alasan ditulis).
Tiap baris berisi: masalah → **berkas** → perubahan konkret → cara cek. Nomor baris kode bisa bergeser; cari nama simbolnya.

## Putaran 1 — 2026-11-13

Cara uji: Chromium headless GPU (d3d11) 1600×900, 10 bidikan (stadion sore/pagi/malam, UNRI jalan/sekre/rektorat, mode Kota
dekat/menengah/penuh/malam) + `tools/shots/npcLineup.mjs`. Bukti: `docs/screenshots/kritik/`.
Bidikan berjalan di **preset Rendah** [INFERENSI: fps terkunci 30 = `performance.fpsCap` Rendah], yaitu preset yang juga
dipakai laptop user (iGPU). Jadi kritik grafis di bawah = pengalaman nyata user, bukan kualitas maksimum mesin.
**Belum diuji:** rasa kendali sepeda, animasi, audio, HP/sentuh, kebun, interior, alur misi sampai tamat (lihat Putaran 2).

### Vonis
Skala dan datanya luar biasa untuk proyek hobi, dan UI perkamen punya karakter. Tapi menit pertama belum menjualnya:
rumput kosong, stadion pastel bergerigi, orang tanpa wajah, dompet tertutup toolbar. Banyak perbaikannya **sudah ada di kode
tetapi dimatikan di preset Rendah atau gaya `asli`** (bayangan kontak, bayangan, rasio render). Itu kabar baik: murah.

### 1. Grafis
| # | Masalah | Akar di kode | Perubahan | Cek |
|---|---|---|---|---|
| G1 ⬜ | Sepeda, pohon, NPC melayang tanpa bayangan [LIHAT] | Preset Rendah: `graphics.shadowQuality: 'mati'` (`config/quality.js`). Bayangan kontak murah **sudah ada** (`engine/contactShadows.js`, 1 draw call) tetapi `styleManager.js` memanggil `contact.setEnabled(style !== 'asli')` | Ubah syarat jadi: aktif bila gaya ≠ asli **atau** bayangan nyata mati. Daftarkan pohon kota/tile sebagai sumber (`registerContactSource`) seperti yang sudah dilakukan `districts/unri/groundLayer.js` | bidikan stadion preset Rendah: ada cakram gelap di bawah sepeda/pohon; draw call +1 |
| G2 ⬜ | Gambar bergerigi, tulisan stadion pecah [LIHAT] | Rendah: `graphics.pixelRatio: 0.75`; renderer `antialias:false`, penghalusan hanya dari supersampling (`core/App.js` komentar dekat `new WebGLRenderer`), jadi di rasio < 1 **tidak ada AA sama sekali**. `adaptiveResolution.js` `floor = 0.6` | Tambah pass FXAA di ujung composer (`core/postprocessing/efekLayar.js`), aktif otomatis saat rasio ≤ 1. Biaya 1 lintasan layar penuh; ukur di iGPU. Alternatif tanpa pass: naikkan lantai adaptif ke 0,7 | bidikan sebelum/sesudah pada tulisan "STADION UTAMA RIAU"; `tools/shots/kualitas.mjs` untuk fps |
| G3 ⬜ | Siang pudar, stadion tenggelam kabut pada jarak 275 m [LIHAT] | `world/Lighting.js`: `FOG_NEAR = 220`, `FOG_FAR = 1100`; Rendah menurunkan `sky.fogDistance` ke 700 → near ikut turun proporsional (`world/TimeOfDay.js` `fogRange`) ≈ 140 m | Pisahkan near dari pengali jarak: near minimum ±300 m supaya objek hero di depan mata tetap jenuh; hanya far yang ikut preset. Warnai kabut ikut warna cakrawala langit per jam | bidikan sore dari titik awal: warna tribun terbaca |
| G4 ⬜ | 275 m rumput satu warna di depan pemain [LIHAT] | Titik awal `regions/stadion/layout.js` `spawn: {x:0, z:-275}`; variasi tanah Rendah = `graphics.tanahPbr: 'rendah'` | Lihat S1 (pindah titik awal) — lebih murah daripada mendandani lapangan. Lalu variasi warna petak di shader tanah (`city/groundDetail.js` sudah punya pola serupa) | bidikan titik awal |
| G5 ⬜ | Gedung kit UNRI kotak abu polos (x −206, z 1118) [LIHAT] | Gedung kit punya LOD 150/900 m (ARSITEKTUR); pada bidikan terlihat LOD jauh dipakai pada jarak ±40 m [INFERENSI: pergantian LOD belum selesai setelah teleport, atau gedung ini memang belum punya detail] | Reproduksi dulu dengan bersepeda (bukan teleport). Bila tetap polos: pasang shader `city/facade.js` di material kit LOD jauh | bidikan `unri-kotak-polos.jpg` diulang |
| G6 ⬜ | Malam: stadion gelap, papan nama mati [LIHAT] | Lampu sorot + pendar hanya ada di proxy (`regions/stadion/proxy.js` `floodlights`) | Emissive pada material papan nama + strip jendela tribun di `regions/stadion`, dikendalikan faktor malam yang sama dengan `city/nightGlow.js` | bidikan 20.30 dari titik awal |
| G7 ⬜ | Kota zoom penuh: 1.423 draw call / 4,98 jt segitiga / 12 fps; target ≤ 600 / ≤ 3 jt [UKUR] | `city/farCity.js`: InstancedMesh **per sel 2 km × per jenis** (datar, pelana, pohon) + jalan per sel; semua sel tampil sekaligus saat zoom maksimum | (a) saat `director.zoom` > ambang: sembunyikan mesh pohon dan atap pelana sel yang jauh dari titik pandang (toggle `mesh.visible`, tanpa bake); (b) gabung jalan per sel menjadi 1 geometri per kelas-besar; (c) `mesh.count` diturunkan (buang bangunan terkecil dulu, urutkan saat bake) | `?perf` di zoom maksimum: ≤ 600 call |
| G8 ⬜ | Pola kisi di area buram tilt-shift; pojok putih di zoom penuh [LIHAT] `kota-jauh.jpg` | Tilt-shift maket (`app/cityPreview.js` `tiltPass`); alas diorama `SLAB_STRATA` (`farCity.js`) tidak menutup latar | Tambah jitter/rotasi sampel per piksel di shader tilt; set `scene.background`/kabut ke warna langit maket; batasi `zoomMax` (`core/cameraPresets.js`, sekarang 14) sampai tepi tidak terlihat | bidikan zoom maksimum |

### 2. Model manusia
| # | Masalah | Akar di kode | Perubahan | Cek |
|---|---|---|---|---|
| M1 ⬜ | Wajah kosong dari jarak 3 m [LIHAT] `npc-dekat.jpg` | **Disengaja**: `Humanoid.kit.js` `avatarStyle = 'manekin'` ("manekin tanpa wajah") adalah default. Mata prosedural (`Humanoid.face.js` `eyes()`) hanya bola r = 0,032 pada kepala r = 0,30 | Keputusan user: (a) manekin diberi wajah minimal: mata r ±0,055 + alis garis, lewat `faceGeometry` jalur kit; atau (b) default kembali `chibi`. Saran: (a), karena tanpa wajah terbaca "belum selesai", bukan "gaya" | `npcLineup.mjs` |
| M2 ⬜ | Bahu lebar, tanpa leher, baju seperti ponco [LIHAT] | Bentuk dari `assets-src/blender/karakter/manekin_kit.py` + ukuran `Humanoid.dim.js` (`shoulderX 0.2`, `neckY 0.52`, `headLift 0.24`) | Di skrip Blender: sempitkan dada 10–15%, tambah segmen leher, lengan baju mengikuti lengan (bukan menggantung dari bahu). Ekspor ulang kit | lineup depan + samping |
| M3 ⬜ | 5.546 segitiga/orang [UKUR] dan **±15 Mesh = ±15 draw call per orang** di dalam 60 m (`Humanoid.lod.js` komentar + `LOD_NEAR = 60`) | LOD penuh dipakai terlalu jauh | Turunkan `LOD_NEAR` ke ±25 m (di luar itu mesh gabungan 1 draw call yang sudah ada); decimate kit ke ±2 rb segitiga | `renderer.info.calls` di plaza ramai sebelum/sesudah |
| M4 ⬜ | Siluet semua orang sama, hanya beda warna [LIHAT] | `Humanoid.dim.js` punya `slim/average/chubby/child` tetapi perbedaannya 10–20% | Perlebar rentang (tinggi 0,9–1,1), dan beri aksesori peran lewat `npcTypes.js` (ransel mahasiswa, topi satpam, celemek pedagang) dari kit | lineup |
| M5 ⬜ | Hijab menyatu dengan bahu baju [LIHAT] | Hijab dari kit chibi dipaskan ke kepala manekin (`Humanoid.manekin.js`) | Tambah bagian kerah hijab menutup dada di kit, atau potong baju di garis leher saat `hijab` aktif | lineup varian hijab |
| M6 ⬜ | Lengan pemain tidak ke setang [LIHAT] | Pose bersepeda di `Humanoid.poses.js` | Cek pose `bike`: sudut bahu/siku diarahkan ke posisi setang `Bicycle.mesh.js` | bidikan samping pemain |

### 3. UI
| # | Masalah | Akar di kode | Perubahan | Cek |
|---|---|---|---|---|
| U1 ⬜ | **Bug:** dompet tertutup rail kanan [LIHAT] | `ui/hud.css` `#hud-top-right { right: 16px }` vs `ui/panel.css` `.ui-rail { right: calc(var(--ui-u) * 3) }` di pojok yang sama. `ui/touch.css` sudah menggeser (`right: 56px`) tetapi hanya untuk layar sentuh | `#hud-top-right { right: calc(var(--ui-u) * 3 + <lebar rail> + 12px) }` di `hud.css` | bidikan 1600×900 dan 800×600 |
| U2 ⬜ | HUD lengkap + dialog tampil di belakang menu utama [LIHAT] | `ui/MainMenu.js` hanya mengatur `#overlay`; HUD tidak tahu menu terbuka | Kelas `body.is-menu` saat overlay tampil → `#hud, #minimap2d, #story-dialog { visibility: hidden }` (pola `body.is-photo` di `panel.css` sudah ada) | muat halaman |
| U3 ⬜ | Prompt ganda saat dialog [LIHAT] | `core/StoryDirector.js` `promptFor`: `if (this.state.dialog) return 'Tekan E — lanjut'`, padahal `ui/StoryHUD.js` sudah menulis "E / klik untuk lanjut" | Kembalikan `null` saat dialog aktif | dialog pembuka |
| U4 ⬜ | fps + "Kamera: orang ketiga (V)" di HUD utama [LIHAT] | `ui/HUD.js` `buildLayout`: `hud-cam`, `hud-fps` di `#hud-top-left` | Sembunyikan `hud-fps` kecuali `?perf`/setelan; `hud-cam` jadi toast saat ganti kamera | — |
| U5 ⬜ | "PSPS 0 – 0 TAMU" selalu tampil [LIHAT] | `ui/HUD.js` `hud-score`; diisi `main.js` `hud.setScore(ents.match.score)` | Tampilkan hanya bila pemain di dalam mask region stadion (`regionIdAt`) | bidikan UNRI: pil hilang |
| U6 ⬜ | Tujuan misi tanpa arah/jarak [LIHAT] | Kartu misi `ui/StoryHUD.js` (`goal`); titik tujuan sudah diketahui minimap (`GOAL_COLOR` di `ui/Minimap2D.js`) | Tambah `distance` ke view StoryDirector → "Tugu Lancang Kuning · 240 m"; suar tipis (tabung emissive) di titik tujuan | misi pertama |
| U7 ➖ | Rail tanpa label | Dicabut: tombol sudah punya `data-tip` + `aria-label` (`ui/Panel.js`) | — | — |
| U8 ⬜ | Minimap tidak senada tema perkamen [LIHAT] | `ui/Minimap2D.js`: `BG = '#2f5b32'`, warna keras di kode | Ambil warna dari variabel `theme.css` (`getComputedStyle`) sekali saat buat | — |
| U9 ⬜ | Mode Kota: "0 km/j" tetap tampil, hanya 2 label [LIHAT] | `ui/cityPreview.css` sudah menyembunyikan `#hud-top-right` saat `body.is-city-preview`, tetapi kiri tidak; label = `travel.destinations` saja (`main.js` → `createCityPreview`) | Saat `is-city-preview`: ganti isi kartu kiri dengan jam + petunjuk; label dari `far/landmarks.json` (lihat K2) dengan tingkat zoom di `ui/CityLabels.js` | bidikan Kota |

### 4. Desain sistem game
Yang ada [KODE]: misi beli-antar + putaran berwaktu + jejak (`story/chapters.js`), bab UNRI, dompet & pedagang
(`sim/vendorSim.js`), kebun tanam-siram-panen-kirim-tidur (`sim/farm.js`, `config/kebun.js`), hotbar (`sim/inventory.js`).

| # | Masalah | Akar di kode | Perubahan |
|---|---|---|---|
| S1 ⬜ | Menit pertama: menghadap rumput kosong | `regions/stadion/layout.js` `spawn: {x:0, z:-275, yaw:0}` | Pindah ke tepi plaza dekat tugu/pedagang (±60 m dari tugu). Pembuka: pakai mekanisme intro terbang yang sudah ada di Kota (`camera.kotaIntro`) versi pendek untuk mode jalan |
| S2 ⬜ | Uang tidak pernah kurang | `config/constants.js` `startBalance: 50000`; jajanan Rp 4–15 rb; hadiah misi Rp 3–25 rb; `story/funds.js` menambal dengan uang saku | `startBalance` ±10.000. Tambah **tujuan belanja** di satu tabel `config/upgrade.js`: gir (kecepatan puncak di `sim/bikePhysics.js`), lampu, keranjang (kapasitas antar), kostum (`Humanoid.outfits.js`) |
| S3 ⬜ | Makanan hanya barang misi | Tidak ada stamina di `sim/bikePhysics.js` | `sim/stamina.js` murni (+tes): sprint menguras, habis = melambat (tanpa mati); item `VENDOR_CATALOG` diberi `restore`. Tombol pakai dari hotbar |
| S4 ⬜ | Kurir, kebun, jelajah tidak terhubung | Hasil kebun dijual ke kotak kiriman abstrak (`inventory.boxValue`) | `sim/orders.js` murni (+tes): pesanan acak berwaktu dari NPC/pedagang (asal, tujuan, item, tenggat, upah ∝ jarak). Pedagang rujak membeli hasil kebun dengan harga lebih baik dari kotak |
| S5 ⬜ | Dunia luas, alasan menjelajah sedikit | 1 bab stadion + 1 bab UNRI; `story/easterEggs.js` | "Paspor kota": tiap landmark di `far/landmarks.json` (K2) = satu cap saat didekati + fakta bersumber; tersimpan lewat `story/storage.js` |
| S6 ⬜ | Stadion tanpa acara | `ents.match.score` berjalan terus tanpa jadwal | Jadwal di `sim/activitySchedule.js`: hari pertandingan → `graphics.crowdDensity` naik sementara, pesanan (S4) melonjak, skor diumumkan lewat toast |
| S7 ⬜ | Kota (K) dan Perjalanan cepat (G) terpisah | `ui/CityLabels.js` `onSelect` hanya `flyTo`; `app/fastTravel.js` punya `go(id)` | Klik label kedua kali / tombol "Ke sini" → `fastTravel` ke landmark itu. Menu G tetap ada |
| S8 ⬜ | Kemajuan tidak terlihat | Gelar di `chapters.js` (`rank`) | `ui/StoryJournal.js`: gelar berikutnya + syarat, cap paspor terkumpul |

Urutan: S1 → S2 + S3 → S4 → S6 → S5/S7/S8. Jangan menambah sistem lain sebelum S2 beres.
Semua logika baru di `sim/` (murni, bertes) sesuai aturan lapisan; UI hanya membaca.

### 5. Peta Kota: detail gedung, dari data bukan dari tangan
Kondisi [LIHAT]: dari zoom menengah, kota = karpet kotak abu + titik merah + pohon; tidak ada siluet yang dikenali selain
cincin stadion; hanya 2 label.
Kenapa [KODE]: rekaman bangunan jauh hanya 8 byte (`farbake.mjs`: x, z, lebar, dalam, tinggi, kelas, rotasi, pelana).
`BUILDING_CLASS` **meleburkan** `religious/mosque/civic/education/school/medical` ke satu kelas 3, dan `farFetch.mjs` tidak
mengambil nama (`names`). Jadi klien tidak tahu mana masjid, mana kampus, mana gedung bernama. Perbaikannya di jalur bake.

| # | Langkah | Berkas | Perubahan | Biaya |
|---|---|---|---|---|
| K1 ⬜ | **Bentuk atap per jenis** | `tools/citybake/farbake.mjs`, `src/city/farCity.js` | Byte ke-8 (`gable`, sekarang 0/1) jadi enum bentuk: 0 datar, 1 pelana, 2 kubah (mosque/religious), 3 menara (h > ±20 m), 4 kotak besar (retail/commercial luas > ±2.000 m²), 5 industri (atap gergaji). Klien: geometri satuan baru per bentuk (pola `flatRoofGeometry`/`gableRoofGeometry`). Bentuk langka (2, 3, 4) **satu InstancedMesh global**, bukan per sel, agar draw call hanya +3 | bake ulang ±15 dtk; ukuran berkas tetap; +3 draw call |
| K2 ⬜ | **Daftar landmark dari data** | `tools/citybake/farFetch.mjs`, `farbake.mjs` → `public/far/landmarks.json` | Query Overture tambah `names.primary`; ekspor bangunan bernama dengan tinggi > ambang atau kelas ibadah/pendidikan/medis/pemerintah/transportasi dan luas besar: `{nama, x, z, h, kelas, luas}` diurutkan skor (tinggi × luas). Ini menjawab "gedung ikonik yang mana" tanpa mengarang nama | jaringan/cache `data-src`; berkas kecil (< 50 KB) |
| K3 ⬜ | **Label bertingkat** | `src/ui/CityLabels.js`, `app/cityPreview.js` | Label dari `landmarks.json`: N teratas menurut skor sesuai `director.zoom` (jauh 5, menengah 15, dekat 40); tolak label yang bertumpuk di layar | DOM saja |
| K4 ⬜ | **Proxy stadion** | `src/regions/stadion/proxy.js` (`bowl`, `floodlights`) | Tambah `roofRibs()`: lengkung rangka atap instans mengelilingi elips (parameter elips sudah ada di `regions/stadion`), `tiers()`: 2–3 cincin tribun berwarna, papan nama. Tetap 1–3 draw call | tanpa bake |
| K5 ⬜ | **Hero buatan tangan** (maks 6, ≤ 5 rb segitiga, vertex color) | `assets-src/blender/<nama>.py` → `public/models/monumen/`, `src/city/landmarks.js` (resep di `kota/ganti-model/README.md`) | Urutan diambil dari peringkat K2, bukan tebakan. Kandidat yang sudah pasti ada di data: Masjid Raya An-Nur (area `annur`), Rektorat UNRI, jembatan Sungai Siak (`rivers.bin`), bandara (poligon landasan). `farbake` membuang kotak yang ditimpa | per model ±1 jam Blender |
| K6 ⬜ | **Warna kawasan terbaca** | `farCity.js` `FAR_CLASS_TINT` | Rentang sekarang 0,78–1,1 (hampir seragam). Perlebar: niaga hangat, industri biru-abu, publik krem terang, hunian genteng; atap datar ikut kelas | tanpa bake |
| K7 ⬜ | **Jalan arteri terbaca dari jauh** | `farCity.js` (jalan per kelas), PLAN "Berikutnya" no. 3 | Lebar minimum dalam piksel untuk kelas 0–2 (skala ikut zoom) + garis tengah | tanpa bake |
| K8 ⬜ | **Lapangan, sekolah, RS** | `farFetch.mjs` (tema `base/land_use`), peta tanah di `farbake.mjs` | Gambar poligon `pitch`/`school`/`hospital`/`cemetery` ke SVG peta tanah dengan warna khas (pola `COVER_COLOR`) | bake ulang |

Urutan: K4 → K1 → K2 + K3 → K6 → K5 → K7 → K8. K1 + K2 adalah intinya: sekali bake, ratusan masjid dan semua gedung
tinggi berubah sekaligus, dan daftar hero berikutnya keluar dari data.
Bangunan bundar berkubah di selatan stadion [LIHAT]: identitasnya akan muncul dari K2; jangan diberi nama sebelum itu.

### Paket kerja (1 paket = 1 branch/PR kecil)
| Paket | Isi | Jenis | Tes |
|---|---|---|---|
| P1 Perbaikan 1 jam | U1, U2, U3, U4, U5 | CSS + 3 baris JS | lihat bidikan |
| P2 Rendah tapi rapi | G1, G3, G2 (FXAA) | setelan + 1 pass | bidikan + fps iGPU |
| P3 Orang | M1 (keputusan user), M3 (`LOD_NEAR`), M6 | kode + kit | lineup, draw call |
| P4 Stadion ikon | K4, G6 | geometri prosedural | bidikan Kota + malam |
| P5 Kota bersiluet | K1, K6 | bake + klien | tes murni enum bentuk di `farbake` |
| P6 Landmark dari data | K2, K3, U9 | bake + UI | tes murni skor/pemilihan label |
| P7 Menit pertama | S1, U6 | data + UI | main dari awal |
| P8 Ekonomi | S2, S3 | `sim/` murni | tes stamina + harga |
| P9 Kurir | S4, S6 | `sim/` murni | tes pesanan |
| P10 Kinerja Kota | G7, G8 | klien | `?perf` zoom maksimum |
| P11 Hero Blender | K5, M2, M4, M5 | aset | lineup, bidikan |
| P12 Jelajah | S5, S7, S8 | UI + simpan | tes penyimpanan |

## Putaran 2 — belum dijelajahi (jujur: belum saya buka)
Untuk "perbaiki semuanya", area ini masih perlu dikritik dengan cara yang sama (main + baca kode):
- ⬜ **Rasa kendali**: `sim/bikePhysics.js`, `sim/walkPhysics.js`, kamera (`core/CameraRig.js`, `cameraAngled.js`): akselerasi, belok, tabrakan, guncangan kamera.
- ⬜ **Animasi**: `entities/Humanoid.anim.js`, `Humanoid.poses.js`: kayuh, jalan, diam; transisi.
- ⬜ **Audio**: `core/AudioBus.js`, `audioSynth.js`: semua disintesis? ambience per kawasan, langkah, bel, kerumunan.
- ⬜ **HP/sentuh**: `ui/TouchControls.js`, `touch.css`, orientasi; belum ada satu bidikan pun dari viewport HP.
- ⬜ **Kebun + interior**: `app/farm.js` (296 baris), `interiors/`: keterbacaan petak, umpan balik aksi.
- ⬜ **Simpan/muat**: `story/storage.js`, `app/session.js`: apa yang hilang saat muat ulang.
- ⬜ **Waktu muat**: distrik UNRI dipasang penuh saat boot (titik lemah no. 4 di ARSITEKTUR).
- ⬜ **Lalu lintas dan kehidupan jalan** di mode jalan (bukan hanya Kota): `city/parkedVehicles.js`, `sim/campusLife.js`.
- ⬜ **Aksesibilitas**: kontras teks perkamen, ukuran font, `prefers-reduced-motion` (sebagian sudah ada di `hud.css`).
