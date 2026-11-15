# Bangunan kota dari kit: 20 jenis × 3 variasi

Tujuan: bangunan kota di sekitar pemain berwujud bangunan khas Pekanbaru (ruko, rumah, masjid, walet, …), bukan kotak bertekstur jendela, supaya kota
**terasa ditinggali**. Status: **rencana, belum ada kode** (dirombak 2026-11-16).

> **Rombakan 2026-11-16:** versi pertama dokumen ini mengusulkan 60 model Blender baru. Usulan itu melewatkan bahwa game **sudah punya kit gedung
> prosedural** (`src/world/kit/`, 12 arketipe) yang dipakai 221 gedung kampus UNRI. Rencana ini sekarang memperluas kit itu: **3 arketipe baru +
> varian/palet**, bukan model dari nol.

## Yang sudah ada (dicek di kode 2026-11-16)

| Lapisan | Cakupan | Bentuk bangunan |
|---|---|---|
| Kota jauh (`src/city/farCity.js`, data `public/far/`) | seluruh Pekanbaru, 353.917 bangunan, 261 sel 2 km | kotak atap datar / kotak atap pelana; 5 nada warna per kelas; jendela & kios dari shader `facade.js` |
| Tile terperinci (`tools/citybake/geometry/buildings.js`, `public/tiles/`) | 157 tile 500 m, **46.118 bangunan** (median 321, maks 659 per tile) | jejak asli OSM/Overture diekstrusi; tinggi dari data atau heuristik (`height.js`); pelana bila persegi panjang < 150 m², selain itu datar; 8 warna dinding, 4 atap datar, 4 genteng; fasad shader (pita lantai, jendela/3 m, kios + pintu gulung, genteng/seng, nyala malam) |
| Landmark (`src/city/landmarks*.js`) | 27 model Blender 3 LOD | An-Nur, 3 jembatan Siak, kantor gubernur, mal, tugu, bandara, … |
| **Kit gedung** (`src/world/kit/`) | hanya kampus UNRI: 221 gedung + 8 hero | 12 arketipe, 6 jenis atap, koridor, jendela nako/jalusi/kaca, roster, ornamen, papan nama, LOD0/LOD1, rakit bertahap per klaster |

Arketipe kit yang ada: K01 kuliah-koridor · K02 dekanat · K03 adb-layar · K04 lab-bengkel · K05 aula · K06 musala (varian `limas-tumpang`, `kubah-kecil`) ·
K07 kantin (varian `kantin`, `parkir` = atap berkolom tanpa dinding) · K08 pendopo-kayu (panggung) · K09 rusun · K10 mangkrak · K11 utilitas (`gudang`, `pos`, `toilet`) · K12 ekstrusi-rapi.
Atap: `pelana`, `limas`, `datar-parapet`, `pelana-lebar`, `limas-tumpang`, `datar`.

## Biaya kit (diukur 2026-11-16, `planBuilding` + `appendBuilding` di Node, rata-rata 50 kali rakit)

| Jejak | Arketipe | LOD0 segitiga | LOD1 segitiga | Waktu rakit LOD0 / LOD1 |
|---|---|---|---|---|
| ruko 4,5×15, 2 lt | K12 | 208 | 136 | 1,6 / 1,2 ms |
| ruko 4,5×15, 2 lt | K01 | 1.162 | 110 | 2,4 / 0,7 ms |
| rumah 6×9 | K11 | 444 | 70 | 1,4 / 0,9 ms |
| rumah 8×10 | K11 | 506 | 86 | 1,1 / 0,7 ms |
| rumah 2 lt 10×14 | K02 | 1.830 | 158 | 2,7 / 1,1 ms |
| musala 6×8 | K06 | 552 | 118 | 1,0 / 1,0 ms |
| gudang 30×60 | K04 | 3.188 | 890 | 3,3 / 1,0 ms |

**Akibatnya:**
- 46.118 bangunan × ±100 segitiga LOD1 = ±4,6 jt segitiga dan ±40 detik rakit. **Kit tidak bisa menggantikan seluruh tile terperinci.**
- Satu lingkungan 3×3 tile di sekitar pemain = ±3.000 bangunan: LOD1 ±0,3–0,4 jt segitiga, rakit ±2,5 detik yang dicicil per bingkai, ditambah LOD0 ≤ 150 m
  (±100–200 gedung, ±0,1–0,2 jt). Ini **masuk akal** `[INFERENSI: perlu diukur di GPU asli]`.
- Jadi: **kit untuk mode jalan di sekitar pemain**. Mode Kota (maket, zoom jauh) tetap memakai ekstrusi + shader fasad, karena dari jauh detail kit tidak terlihat.

## Daftar 20 jenis → kit

Kolom "Kit" berisi salah satu dari tiga: **ada** = arketipe yang sudah ada cukup diberi palet atau varian; **varian** = arketipe lama ditambah varian atau
atap baru; **BARU** = arketipe baru. Variasi A/B/C dipilih `hash(id) % 3` sehingga stabil di setiap pemuatan.

### Hunian

| # | Jenis | Dipasang ke (data / tebakan) | Kit | Variasi A / B / C |
|---|---|---|---|---|
| 1 | Rumah perumahan (tipe 36/45) | `house`, `detached`, `semidetached_house`; tanpa kelas 30–110 m² `[INFERENSI]` | **BARU K13 `rumah`** | pelana + teras + pagar rendah / limas + carport / kopel |
| 2 | Rumah kampung lama | tanpa kelas 50–150 m², jauh dari jalan besar `[INFERENSI]` | varian K13, palet `seng-kayu` | limas seng / pelana + teras kayu / pelana + dapur belakang |
| 3 | Rumah 2 lantai | `residential`; tanpa kelas 150–400 m² `[INFERENSI]` | varian K13 (`maxLevels 2`) | limas + balkon / pelana silang / datar modern + kanopi |
| 4 | Rumah panggung Melayu | zona tepi Siak yang **ditandai manual** | varian K08 (panggung sudah ada) + atap baru | Selaso Jatuh Kembar / Lipat Kajang / panggung sederhana |
| 5 | Kos-kosan / rumah petak | `dormitory`, `terrace`; memanjang (aspek > 3) dekat kampus `[INFERENSI]` | ada: K09 rusun 1–2 lt | 1 lt deret pintu / 2 lt + tangga luar / bentuk L |

### Niaga dan jalan

| # | Jenis | Dipasang ke (data / tebakan) | Kit | Variasi A / B / C |
|---|---|---|---|---|
| 6 | Ruko 2 lantai | `retail`, `commercial`; heuristik `ruko/komersial` di `height.js` | **BARU K14 `ruko`** | pintu gulung / balkon kecil lt 2 / kanopi seng depan |
| 7 | Ruko 3–4 lantai | sama, di jalan arteri (heuristik sudah memberi 3–4 lt) | K14 (`levels 3–4`) | fasad kaca + kolom / jendela deret / atap limas kecil di puncak |
| 8 | Rumah walet | tanpa kelas, menjulang di zona ruko lama `[INFERENSI]`, dibatasi ±1 per tile | **BARU K15 `walet`** (paling murah: kotak + lubang kecil) | kotak beton / ruko berlantai atas walet / menara walet |
| 9 | Usaha pinggir jalan | `kiosk`; tanpa kelas < 40 m² menempel jalan `[INFERENSI]` | ada: K07 `kantin` + K11 `pos` | warung + terpal / bengkel muka terbuka (varian baru) / kios etalase |
| 10 | Minimarket (tanpa merek) | tanpa kelas 80–200 m² di simpang `[INFERENSI]` | varian K14 | muka kaca + kanopi / 2 lt / menempel di ruko |
| 11 | SPBU (tanpa merek) | `amenity=fuel` OSM (**belum ditarik bake**) | ada: K07 `parkir` (kanopi berkolom) + K11 kios | 4 pompa / kanopi + bengkel / mini 2 pompa |
| 12 | Gedung bertingkat | `office`, `hotel`, `apartments`; ≥ 1.500 m² di pusat | ada: K12, K03 (kaca biru), K09 | menara kaca / blok jendela deret / rusunawa |
| 13 | Pasar tradisional | `marketplace` OSM; besar dan rendah di pusat lama | ada: K07 `parkir` (los) + K04 | atap seng bertingkat / los terbuka / gedung 2 lt |
| 14 | Gudang / pabrik | `industrial`, `warehouse`; ≥ 1.500 m² di pinggir | ada: K04 (clerestory, pintu gulung) | portal baja / + kantor depan / atap gergaji (varian) |

### Publik dan ibadah

| # | Jenis | Dipasang ke (data / tebakan) | Kit | Variasi A / B / C |
|---|---|---|---|---|
| 15 | Masjid | `mosque`, `religious` ≥ 120 m² | varian K06: **kubah besar + menara** (primitif tutup bola sudah ada di `kitBuilder`) | kubah + 1 menara / kubah + 2 menara / limas tumpang + kubah kecil |
| 16 | Musala / langgar | `religious`/`mosque` < 120 m² | ada: K06 | limas tumpang / kubah kecil / panggung kayu (K08) |
| 17 | Gereja / vihara | `church` (6), `temple` (3) saja | **ditunda** (9 bangunan); sementara K05 aula | — |
| 18 | Sekolah | `school`, `education` | ada: K01 kuliah-koridor + tiang bendera, palet `sekolah` baru | memanjang 1 lt / L 2 lt / U + lapangan |
| 19 | Puskesmas / RS | `medical`, `hospital`, `clinic` | ada: K02/K12 palet `putih-hijau` baru | puskesmas 1 lt / RS 4–6 lt / klinik ruko (K14) |
| 20 | Kantor pemerintah | `civic`, `public`, `government` | varian K02 + ornamen **selembayung** | limas + selembayung / limas bertingkat berkolom / kantor kelurahan 1 lt |

**Ringkasnya:** 3 arketipe baru (K13 rumah, K14 ruko, K15 walet), 2 bentuk atap Melayu, kubah besar + menara untuk K06, ornamen selembayung, 3 palet baru
(`seng-kayu`, `sekolah`, `putih-hijau`), 1 varian bengkel. Sisanya memakai yang sudah ada. Gereja/vihara ditunda.

Gaya atap Melayu (Selaso Jatuh Kembar, Lipat Kajang, selembayung) dikenal sebagai arsitektur Melayu Riau, tetapi bentuk persisnya untuk Pekanbaru masih
`[INFERENSI]`: cocokkan dengan Balai Adat dan Kantor Gubernur (sudah jadi landmark) sebelum dimodelkan.

## Pipa yang harus berubah

1. **Bake tile** (`tools/citybake/pipeline.js`, `bakeTile.js`): `data.json` sekarang hanya menyimpan `buildings[{h, ring}]` untuk collider. Tambahkan
   `k` (jenis 1–20 dari `classifyKit`) dan `f` (arah muka ke jalan terdekat; `roadLocator.js` sudah menghitung jalan terdekat untuk `height.js`).
   `classifyKit(kelas, subtype, area, aspek, kelasJalan)` adalah **fungsi murni dengan tes**, memakai urutan yang sama dengan `HEURISTIC_RULES`.
   Naikkan versi format tile.
2. **Modul kit kota** mengikuti pola distrik UNRI (`src/districts/unri/buildings.js` + `buildingClusters.js`): klaster = tile 500 m, LOD0 ≤ 150 m,
   LOD1 untuk 3×3 tile di sekitar pemain, rakit dicicil lewat scheduler, satu sink per tile (≤ 3 mesh per tile).
   **Lapisan:** `src/city` tidak boleh mengimpor `src/world` (`eslint.config.js`), jadi modul ini tinggal di lapisan distrik
   (mis. `src/districts/kota-dekat/`) dan data tile disuntik oleh `app`, sama seperti distrik UNRI menerima `ChunkStreamer`.
3. **Tukar tanpa lubang:** setelah kit satu tile siap, mesh `walls`/`roofs` hasil panggang tile itu disembunyikan. Sebelum siap, ekstrusi lama tetap
   tampil. Tile di dalam distrik UNRI dilewati karena sudah dibuang saat bake.
4. **Mode Kota tidak berubah.** Kubah dan kelas warna di kota jauh dikerjakan oleh R06.

## Urutan kerja

1. **Tahap 0 — ukur dulu:** pasang kit kota memakai arketipe yang **sudah ada** saja (K11 untuk rumah kecil, K12 untuk lainnya, K06 untuk musala/masjid)
   di 3×3 tile sekitar pemain. Ukur draw call, segitiga, waktu rakit, dan fps (`?perf`) di mode jalan dekat stadion dan di pusat kota (tile terpadat, 659 bangunan).
   **Berhenti bila** fps turun > 5 atau draw call region > 250. Bila begitu, kecilkan cakupan menjadi 1 tile + tetangga terdekat.
2. **Tahap 1 — wajah jalan:** K14 ruko (#6, #7, #10), K13 rumah (#1–#3), K06 kubah besar (#15), K07/K11 usaha pinggir jalan (#9).
3. **Tahap 2:** K15 walet (#8), sekolah (#18), kantor Melayu (#20), kos (#5), gudang (#14), gedung bertingkat (#12).
4. **Tahap 3:** rumah panggung (#4), SPBU dan pasar (#11, #13; butuh tag OSM baru), puskesmas (#19), gereja/vihara (#17).

Tiap arketipe baru: aturan di `archetypes.js` + `planRules.js`, tes rencana (jumlah bukaan, atap, lantai), spesimen di `SPECIMENS`
(`src/dev/kitGallery.js`), lalu dilihat di **galeri gedung** `/kit-gallery.html?kit=K14` sebelum dipasang di kota.
Rujukan bentuk (atap, aksesori atap, fasad ruko, pagar, carport): lembar ilustrasi isometrik kiriman user 2026-11-16 `[belum disimpan di repo]`.

## Cek fakta yang masih terbuka

- Sebaran rumah walet di dalam kota Pekanbaru: `[INFERENSI]`. Cek Street View di Senapelan/Pasar Bawah.
- Zona rumah panggung tepi Siak: tandai manual dari foto/peta.
- SPBU/pasar butuh `amenity=fuel` / `amenity=marketplace` yang belum ditarik oleh bake.
- Tanpa merek dagang: minimarket, SPBU, dan bank generik, tanpa logo atau warna khas merek.
