# Landmark hero mode Kota (model Blender 3 tingkat LOD)

Daftar kandidat + sumber: [../DAFTAR-IKON.md](../DAFTAR-IKON.md). Rujukan foto lokal (tidak di-commit): `data-src/rujukan/kota/`.

## Resep satu landmark
1. Rujukan: foto (Commons / Maps dilihat saja), jejak + arah dari OSM (`way` landmark → pusat lat/lon, rect minimum, yaw). Proyeksi: `src/geo/projection.js` dengan `WORLD_ORIGIN` (`src/config/constants.js`).
2. Skrip Blender `assets-src/blender/landmark/<nama>.py` → `public/models/landmark/<nama>-lod{0,1,2}.glb` (warna per vertex, datar, depan = −Y Blender):
   `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\assets-src\blender\landmark\<nama>.py')['build']())"`
3. Daftarkan di `src/city/landmarks.js` (`LANDMARKS`: x, z, yaw, batas LOD). yaw: `rotation.y`; depan model (+Z three) → arah `(sin yaw, cos yaw)`.
4. Bidikan: `SIM_PORT=5193 node tools/shots/landmarkKota.mjs --zoom 0.4,0.9,1.6,3 --out <folder>` (mencetak LOD & jarak tiap zoom).

## LOD
Jarak kamera → landmark ≈ **1300 m × zoom kota** (zoom 0,4–9). Satu draw call per landmark (hanya satu tingkat yang tampil), histeresis 12%.
| Tingkat | Dipakai | An-Nur |
|---|---|---|
| LOD0 | dist ≤ 1300 m (zoom ≲ 1) | 5.961 segitiga, 409 KB (2026-11-24: portal runcing, pilaster, parapet bergerigi, balkon menara; mengikuti gambar rujukan Flow) |
| LOD1 | ≤ 2800 m (zoom ≲ 2,1) | 1.184, 88 KB |
| LOD2 | lebih jauh | 340, 26 KB |

## Jembatan Siak (✅ 2026-11-14)
Skrip: `assets-src/blender/landmark/jembatan.py` → 9 GLB (3 jembatan × 3 LOD). Beda dengan An-Nur: model memakai **koordinat dunia relatif ke titik tengah garis OSM** (yaw 0), garis geladak dari way OSM (Siak I `71286129`; Siak III `465906574`+`1529638955`+`1529638956`, berbelok; Siak IV = sumbu tengah dua jalur Jl. Jenderal Sudirman `313965178`/`38659704`). Posisi sungai dari titik potong garis tengah `public/far/rivers.bin` dengan geladak (s = 241 / 279 / 454 m). Permukaan geladak 6 cm di atas jalan agar mobil kota tetap terlihat berjalan di atasnya.
| Jembatan | Struktur (foto Commons) | LOD0 / LOD1 / LOD2 (segitiga) |
|---|---|---|
| Siak I, 401 m | balok datar, pagar kuning, pilar | 1.260 / 520 / 36 |
| Siak III, 372 m | dua busur baja oranye miring ke dalam, 3 palang, penggantung, pagar biru | 1.684 / 812 / 188 |
| Siak IV, 830 m | pilon beton putih bentuk A + palang, 40 kabel kuning, pagar abu | 2.804 / 1.220 / 196 |
`[INFERENSI]`: lebar geladak (Siak I 12 m, Siak III 16 m), tinggi busur 26 m, tinggi pilon 62 m, posisi pilon (450 m), jarak pilar. Foto "Tengku Agung Sultanah Latifah" di folder `jembatan-siak-3` (rujukan lokal) milik jembatan di Kabupaten Siak, bukan Pekanbaru.

## Bangunan, tugu, bandara (✅ 2026-11-15)
Skrip: `assets-src/blender/landmark/bangunan.py` (+ pustaka `lm_common.py`) → 23 landmark × 3 LOD, dari **jejak OSM** (`osm/footprints.json`, diambil Overpass; bisa dibangun ulang tanpa internet). Skrip juga menulis `src/city/landmarks.data.js` (posisi; jangan sunting tangan) yang dimuat `landmarks.js`. Seperti jembatan: koordinat dunia relatif ke titik tengah, yaw 0.
| Kelompok | Landmark | Cara |
|---|---|---|
| Pemerintahan/budaya | Kantor Gubernur Riau + Menara Lancang Kuning (depan = timur ke halaman/Jl. Sudirman; sayap 4 lantai: podium + tangga, serambi bertiang, pilaster, atap limas panjang + tiga paviliun menonjol berpelana melintang dengan lisplang emas & selembayung, beranda di paviliun tengah; menara 9 lantai: podium 2 lantai ikut jejak, badan kaca berpilar sudut + rusuk tegak, lantai puncak mundur, mahkota Melayu dua tingkat; selasar penghubung) `[INFERENSI]` bentuk, Perpustakaan Soeman Hs. (rehal + buku terbuka: fasad kaca condong keluar, atap V berujung lancip, X putih di dinding ujung), Balai Adat Melayu Riau, Anjung Seni Idrus Tintin, Museum Sang Nila Utama | ekstrusi jejak + atap Melayu/selembayung |
| Mal & hotel | Mal SKA, Living World (`b_living_world`; fakta: dibuka 2018, Kawan Lama Group + Sinarmas Land, 5 lantai. Muka utama = sisi utara-barat laut ke Jl. Tuanku Tambusai, dari jalan primer `data-src/overture-kota/jalan.csv` + nama OSM `cincin-utara.json`; rel layang MRT/LRT lewat di depannya, jadi kanopi depan hanya 7–11 m (dibatasi tepi jalan & pilar). Podium 5 × 4,4 m: etalase kaca + kanopi pelat, panel putih-abu bernat, bidang sirip kayu (muka utama + muka barat), pita hijau; curtain wall toska 34 m + kanopi besar berplafon kayu + pelataran; sisi lain: etalase + kanopi gelap, modul ±18 m bergantian (2 pita jendela / sirip kayu / panel abu) beralur gelap, papan hijau kedua di muka barat, tanjakan parkir dua lajur di luar sisi belakang; pilon hijau di ujung barat muka utama; atap: skylight pelana memanjang, dek parkir ±40 %, dua teras taman, rumah mesin. `[INFERENSI]` semua bentuk/warna/letak), Ciputra Seraya, Mall Pekanbaru (`b_mall_pekanbaru`; fakta: simpang Jl. Sudirman × Jl. Teuku Umar, hotel 8 lantai di atas mal. Muka utama = barat ke Sudirman, sudut pintu = barat laut ke simpang, dari jalan bernama `data-src/osm/pusat.json`. Podium 5 lantai: etalase kaca + kanopi pelat di sisi jalan, panel bernat, pita jingga, papan iklan + videotron di muka barat, drum kaca 12 sisi bertopi cakram + kanopi lengkung di sudut, dek parkir berpetak + atap mekanikal ber-skylight; menara hotel 8 lantai di tenggara, mundur 6 m. `[INFERENSI]` semua bentuk/warna/letak), Plaza Suka Ramai, Plaza Citra, Pasar Bawah, Hotel Furaya, Swiss-Belinn SKA | ekstrusi per lantai (pita kaca gelap = menyala malam), parapet warna merek, plang, kotak AC |
| Ibadah | Masjid Raya Senapelan | kubah hijau + 1 menara |
| Tugu | Selais Tiga Sepadan, Zapin 0 KM, Keris, Perjuangan, Bambu Runcing, Pesawat Skyhawk | model kecil di titik node OSM |
| Bandara | Terminal (terminal + gedung VVIP Lancang Kuning), Landasan (landasan 2,6 km + marka, taxiway, apron, hangar; batas LOD 3200/6400 m) | jejak/garis OSM |
`[INFERENSI]`: tinggi per lantai, warna merek, atap Balai Adat/Anjung Seni/Museum (gaya atap Melayu umum), kubah Senapelan, bentuk semua tugu kecuali Selais (foto), tinggi terminal/hangar. **Tidak ada di OSM / tidak dibuat:** Transmart, Bandar Serai, Rumah Singgah Tuan Kadi, Taman Budaya Riau Khatulistiwa (hanya poligon area, belum jadi model).
Pohon instans kota kadang tumbuh di atas landasan (pohon dibuat dari peta tanah, belum disaring).

## Status
- ✅ An-Nur (2026-11-14): jejak 61×73 m dari OSM `way 465323008`, pusat (6823,0; −4760,1), depan ke plaza ESE (citra satelit). Bentuk detail `[INFERENSI]`: tinggi kubah ±38 m, menara ±54 m, 10 kubah = 1 utama + 1 depan + 4 samping + 4 puncak menara.
- Poles (2026-11-14): plaza putih ±120×110 m + 4 kolam bintang di depan (dari citra satelit); malam: ceruk/jendela menyala hangat + sorot lembut lewat `applyLandmarkNight` (memakai `uNight` fasad kota). Bangunan tile di bawah masjid = satu poligon U (masjid + sayap) berbentuk kompleks; model menutup bagian tengahnya, tidak dihapus.
- Belum: warna dinding/atap belum dicocokkan ketat dengan foto; ukuran/ketinggian detail masih `[INFERENSI]`; plaza dibuat sebagai bagian model (bukan data OSM).
