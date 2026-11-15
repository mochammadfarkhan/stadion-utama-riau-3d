# Kit model bangunan Kota: 20 jenis × 3 variasi

Tujuan: mengganti kotak polos (dinding + atap datar/pelana) di mode Kota dengan bangunan khas Pekanbaru, supaya kota **terasa ditinggali**,
bukan sekadar terlihat padat. Daftar ini berbeda dari [landmark](../landmark/README.md): landmark = satu bangunan bernama dan unik, sedangkan kit = bangunan umum yang
dipakai berulang lewat instancing ribuan kali.

Status: **rencana, belum ada model** (2026-11-16). Yang menentukan urutan adalah kolom "Prioritas".

## Kenyataan data (jangan menjanjikan lebih)

Dari `data-src/overture-kota/bangunan.csv` (dihitung 2026-11-14, lihat [R06](../../rencana/R06-kota-bersiluet.md)):
- 420.728 bangunan, dan **98,8% tanpa kelas**. Kelas yang ada: `house 2114`, `terrace 932`, `retail 369`, `school 250`, `commercial 233`, `religious 216`,
  `industrial 114`, `residential 102`, `education 93`, `mosque 81`, `semidetached_house 77`, `warehouse 36`, `medical 31`, `hospital 30`, `civic 29`, `office 28`,
  `university 24`, `apartments 11`, `kiosk 11`, `hotel 10`, `church 6`, `temple 3`.
- Hampir tidak ada data tinggi (420.009 tanpa tinggi; hanya 12 bangunan ≥ 25 m).

Akibatnya, untuk **sebagian besar bangunan, jenis harus ditebak dari bentuk dan letak**: luas, rasio panjang/lebar, jarak ke jalan besar, dan apakah berderet dengan
tetangganya. Aturan tebakan di bawah ditandai `[INFERENSI]` dan **harus diukur** (berapa bangunan jatuh ke tiap jenis) sebelum dipercaya.
Bangunan yang berkelas di data selalu memakai kelasnya sendiri, bukan tebakan.

## Daftar 20 jenis

Ukuran = jejak tipikal (lebar × dalam, meter) dan jumlah lantai. Ketiga variasi harus berbeda **bentuk**. Variasi warna tidak dihitung sebagai variasi, karena
warna sudah diacak per instans (`FAR_CLASS_TINT` × variasi).

### Hunian (mayoritas kota)

| # | Jenis | Dipasang ke (data / tebakan) | Ukuran | Variasi A | Variasi B | Variasi C | Prioritas |
|---|---|---|---|---|---|---|---|
| 1 | **Rumah perumahan** (tipe 36/45) | `house`, `detached`, `semidetached_house`; tanpa kelas 30–110 m² di blok berpola grid `[INFERENSI]` | 6×9, 1 lt | atap pelana + teras kecil + pagar besi rendah | atap limas + carport | kopel (dua rumah satu atap) | ★★★ |
| 2 | **Rumah kampung lama** | tanpa kelas 50–150 m², pola tidak teratur, jauh dari jalan besar `[INFERENSI]` | 8×10, 1 lt | limas seng | pelana seng + teras kayu | pelana dengan tambahan dapur belakang (atap lebih rendah) | ★★★ |
| 3 | **Rumah 2 lantai** (rumah gedongan) | `residential`; tanpa kelas 150–400 m² di perumahan `[INFERENSI]` | 10×14, 2 lt | limas + balkon depan | pelana silang + jendela kotak | atap datar modern + kanopi | ★★ |
| 4 | **Rumah panggung Melayu** | **hanya** di kampung tepi Sungai Siak (zona yang ditandai manual, bukan tebakan otomatis) | 8×12, panggung 1,5 m | Selaso Jatuh Kembar (atap bertingkat) | Lipat Kajang (atap melengkung seperti perahu) | rumah panggung sederhana + tangga depan | ★ (khas, jumlah kecil) |
| 5 | **Kos-kosan / rumah petak** | `dormitory`, `terrace`; tanpa kelas memanjang (aspek > 3) di sekitar kampus (Panam/UNRI, Gobah) `[INFERENSI]` | 6×20, 1–2 lt | 1 lt, deret pintu + jemuran | 2 lt + selasar + tangga besi luar | 2 lt bentuk L + halaman parkir motor | ★★ (paling terasa di sekitar UNRI) |

### Niaga dan jalan

| # | Jenis | Dipasang ke (data / tebakan) | Ukuran | Variasi A | Variasi B | Variasi C | Prioritas |
|---|---|---|---|---|---|---|---|
| 6 | **Ruko 2 lantai** | `retail`, `commercial`; tanpa kelas 4–6 m lebar muka, berderet ≥ 3 dan menempel ke jalan kolektor/arteri `[INFERENSI]` | 4,5×15, 2 lt | rolling door + papan nama kosong | balkon kecil lantai 2 | kanopi seng depan + teras berlantai keramik | ★★★ (wajah jalan Pekanbaru) |
| 7 | **Ruko 3–4 lantai** | sama dengan #6 tetapi di arteri utama (Sudirman, Tuanku Tambusai, Riau, HR Soebrantas) `[INFERENSI]` | 5×18, 3–4 lt | fasad kaca + kolom | jendela berderet + atap datar | atap limas kecil di puncak | ★★★ |
| 8 | **Rumah walet** | tanpa kelas, tinggi/menjulang di zona ruko lama `[INFERENSI]`; jumlah dibatasi (±1 per sel) | 8×15, 3–5 lt | kotak beton tanpa jendela + lubang kecil | ruko yang lantai atasnya dijadikan walet | menara walet berdiri sendiri | ★★ (siluet khas Riau, murah dibuat) |
| 9 | **Usaha pinggir jalan** | `kiosk`; tanpa kelas < 40 m² menempel jalan `[INFERENSI]` | 4×5, 1 lt | warung + terpal | bengkel motor muka terbuka | kios pulsa/fotokopi + etalase | ★★★ (yang bikin "hidup") |
| 10 | **Minimarket** (tanpa merek) | tanpa kelas 80–200 m² di simpang jalan `[INFERENSI]`; dibatasi ±1 per 500 m | 10×15, 1 lt | muka kaca + kanopi + parkir depan | 2 lt (atas kantor) | menempel di ruko (muka kaca saja) | ★★ |
| 11 | **SPBU** (tanpa merek) | `amenity=fuel` dari OSM (perlu ditarik di bake; belum ada) | 30×40 | kanopi + 4 pompa + kios | kanopi panjang + bengkel kecil | SPBU mini (2 pompa) | ★★ (penanda arah di jalan besar) |
| 12 | **Gedung bertingkat** (kantor/hotel/apartemen) | `office`, `hotel`, `apartments`; tanpa kelas ≥ 1.500 m² di pusat kota `[INFERENSI]` | 25×40, 6–12 lt | menara kaca | blok beton + jendela deret (hotel) | rusunawa 5 lt + selasar terbuka | ★★ (siluet cakrawala) |
| 13 | **Pasar tradisional** | `marketplace` OSM; tanpa kelas besar dan rendah di pusat lama `[INFERENSI]` | 40×60, 1–2 lt | atap seng lebar bertingkat | los terbuka (tiang + atap) | gedung pasar 2 lt + kios luar | ★ |
| 14 | **Gudang / pabrik** | `industrial`, `warehouse`; tanpa kelas ≥ 1.500 m² di pinggir kota `[INFERENSI]` | 30×60, 1 lt tinggi | portal baja atap pelana landai | gudang + kantor kecil di depan | tangki/silo + atap gergaji | ★★ (kelas "besar" di R06) |

### Publik dan ibadah

| # | Jenis | Dipasang ke (data / tebakan) | Ukuran | Variasi A | Variasi B | Variasi C | Prioritas |
|---|---|---|---|---|---|---|---|
| 15 | **Masjid** | `mosque`, `religious` ≥ 120 m² (bendera kubah R06) | 20×20 | kubah tunggal + 1 menara | kubah + 2 menara | atap limas bertingkat (masjid lama) + kubah kecil | ★★★ (297 bangunan; siluet terkuat) |
| 16 | **Musala / langgar** | `religious`/`mosque` < 120 m² | 6×8 | atap limas + kubah mini | pelana + mimbar menonjol | panggung kayu (kampung tepi sungai) | ★★ |
| 17 | **Rumah ibadah lain** | `church` (6), `temple` (3) **saja**; tidak ditebak | 15×25 | gereja: pelana curam + menara lonceng | gereja kecil: pelana + salib | vihara/klenteng: atap merah melengkung | ★ (jumlah sangat kecil) |
| 18 | **Sekolah** | `school`, `education`, `kindergarten` | 10×40, 1–2 lt | blok memanjang 1 lt + selasar + tiang bendera | bentuk L 2 lt | bentuk U + lapangan di tengah | ★★★ (343 bangunan berkelas) |
| 19 | **Puskesmas / rumah sakit** | `medical`, `hospital`, `clinic` | 20×30 sampai 40×60 | puskesmas 1 lt + kanopi | RS 4–6 lt + lobi kanopi | klinik ruko | ★ |
| 20 | **Kantor pemerintah bergaya Melayu** | `civic`, `public`, `government` | 25×40, 2–3 lt | atap limas + selembayung di bubungan | atap limas bertingkat + teras berkolom | kantor kecil (kelurahan/camat) 1 lt | ★★ (ciri Riau) |

Gaya atap Melayu (Selaso Jatuh Kembar, Lipat Kajang, selembayung) memang dikenal sebagai arsitektur Melayu Riau. Bentuk persis yang mewakili Pekanbaru
masih `[INFERENSI]`: cocokkan dengan foto (Balai Adat, Kantor Gubernur sudah ada di [landmark](../landmark/README.md)) sebelum dimodelkan.

**Sengaja tidak masuk 20** (kandidat berikutnya): GOR/gedung olahraga, halte bus kota, menara BTS, gerbang perumahan, tempat cuci motor, dan rumah makan Padang
(bisa menjadi variasi #6). Halte dan gerbang perumahan adalah properti, bukan bangunan, jadi masuk kit properti terpisah.

## Anggaran per model

| Lapis | Kapan tampil | Segitiga per variasi | Catatan |
|---|---|---|---|
| LOD0 | tile terperinci, ≤ ±400 m dari kamera | ≤ 300 (rumah, kios) · ≤ 800 (masjid, sekolah, gedung) | warna per vertex + `facade.js` untuk jendela; tanpa tekstur baru |
| LOD1 | tile terperinci, jauh | ≤ 40 | siluet atap saja (kubah, menara, walet, kanopi SPBU) |
| LOD2 | kota jauh (`farCity`) | ≤ 14 (aturan lama) | tetap kotak/pelana; hanya **kubah** (R06) dan **menara walet** yang layak dibawa ke sini |

- **Draw call:** 60 variasi × 2 LOD sebagai `InstancedMesh` terpisah = ±120 call. Itu terlalu banyak (mode Kota sekarang 197 call di zoom jauh).
  Pakai `THREE.BatchedMesh` (ada di r186): semua variasi dalam satu objek, sehingga **±2 call per LOD** `[INFERENSI: belum diukur]`.
- **Segitiga:** misalnya 60.000 bangunan di zona tile terperinci, 80% di LOD1 (40 segitiga) dan 20% di LOD0 (±300 segitiga), menjadi ±5,5 jt. **Terlalu banyak**,
  jadi LOD0 hanya untuk radius ±400 m atau dibatasi jumlahnya. Ukur dengan `?perf` sebelum menambah jenis.
- **Ukuran berkas:** 60 variasi × (300 + 40) segitiga sangat kecil (< 1 MB GLB total), aman untuk Pages.

## Yang harus berubah di pipa data (konsekuensi teknis)

1. Bangunan di **tile terperinci** sekarang sudah dipanggang menjadi mesh dinding/atap (`tools/citybake/geometry/buildings.js`). Kit butuh **rekaman per bangunan**
   (pusat, lebar, dalam, rotasi, kelas/jenis, variasi), seperti yang sudah ada di kota jauh (`farbake.mjs`, 10 byte). Jadi bake tile perlu keluaran baru
   (rekaman jenis) di samping mesh, dan bangunan yang mendapat model kit **dibuang dari mesh panggang** supaya tidak dobel.
2. Jejak yang tidak berbentuk kotak (L, U, poligon miring) tetap memakai mesh panggang lama. Kit hanya dipakai bila jejaknya kira-kira persegi panjang
   (luas jejak ≥ 85% luas kotak pembatasnya) `[INFERENSI: ambang perlu diukur]`.
3. Model diskalakan ke jejak (lebar × dalam), tetapi tinggi per lantai dikunci (±3,5 m) supaya jendela tidak melar. Lantai dipilih per jenis, bukan dari data
   tinggi karena datanya hampir kosong.
4. Pemilihan variasi: `hash(id bangunan) % 3`, jadi tetap stabil di setiap pemuatan.
5. Tebakan jenis (`classifyKit(kelas, area, aspek, jarakJalan, kelasJalan, tetanggaSejajar)`) adalah fungsi murni di bake, wajib dites (logika berisiko).

## Urutan kerja yang disarankan

1. **R06 dulu** (kelas diperkaya + bendera kubah di bake). Kit memakai kelas yang sama.
2. **Gelombang 1 (wajah jalan):** #6 ruko 2 lt, #7 ruko 3–4 lt, #9 usaha pinggir jalan, #1 rumah perumahan, #15 masjid. Lima jenis ini menutup bagian kota
   yang paling sering terlihat dari jalan besar.
3. Ukur draw call, segitiga, dan fps (`?perf`, zoom dekat/menengah/jauh) dibanding sebelum kit.
4. **Gelombang 2:** #2, #3, #5, #8, #18, #20. **Gelombang 3:** sisanya.
5. Tiap jenis = satu skrip Blender `assets-src/blender/kota-kit/<jenis>.py` yang mengeluarkan 3 variasi × LOD0/LOD1 dalam satu GLB, dibuka di ruang uji
   (`/ruang-uji.html`) sebelum dipasang di kota.

## Cek fakta yang masih terbuka

- Sebaran rumah walet di dalam kota Pekanbaru (bukan hanya kabupaten sekitar): `[INFERENSI]`. Cek foto Street View di pusat lama (Senapelan/Pasar Bawah) sebelum dibuat banyak.
- Zona rumah panggung Melayu tepi Siak: tandai manual dari foto/peta, jangan ditebak otomatis.
- SPBU dan pasar butuh tag OSM (`amenity=fuel`, `amenity=marketplace`) yang **belum** ditarik oleh bake.
- Tanpa merek dagang: minimarket, SPBU, dan bank dimodelkan generik, tanpa logo atau warna khas merek.
