# Riset: Kampus Universitas Riau (UNRI) Bina Widya, Simpang Baru, Panam — Data untuk Simulator 3D

> Disusun 2026-10-17. Prinsip: **fakta mengalahkan gaya**. Setiap butir diberi sumber dan tingkat keyakinan
> **[T]** tinggi / **[S]** sedang / **[R]** rendah. Butir bertanda **[INF]** adalah **inferensi** (tafsiran
> peneliti dari data/foto), bukan pernyataan sumber. Butir bertanda **[POLA UMUM]** adalah pola umum Indonesia,
> bukan fakta khusus UNRI.
>
> Data OSM: cache repo `data-src/osm/stadion.json` (timestamp OSM 2026-10-16, cakupan lat 0,4641–0,5106,
> lon 101,3716–101,4068) + 2 kueri Overpass kecil 2026-10-17. OSM © kontributor OpenStreetMap, lisensi ODbL.
> Jarak/arah dihitung dari **pusat way Stadion Utama Riau** `way/327365495` (0,4835959; 101,3894825),
> ekuirektangular, presisi ±5 m. Catatan: riset stadion lama memakai koordinat Wikipedia 0,482019; 101,392429
> (±370 m dari pusat OSM) — untuk simulator pakai titik OSM.

---

## 1. Batas, luas, posisi relatif

| Item | Nilai | Sumber | Yakin |
|---|---|---|---|
| Poligon kampus | `way/938374562` `amenity=university`, name "Universitas Riau", `branch=Kampus Bina Widya`, `start_date=1962-09-01`, `wikidata=Q7322177`, 110 node | https://www.openstreetmap.org/way/938374562 | T |
| Bbox poligon | lat 0,46434 – 0,48775; lon 101,37495 – 101,39352 (±2,6 km U–S × ±2,07 km B–T) | dihitung dari OSM | T |
| Luas poligon OSM | **±244,6 ha** (2.446.086 m², hitung shoelace) | dihitung dari OSM | T (untuk poligon) |
| Luas resmi | **345,617 ha**, difungsikan sejak 1983, ±12,5 km dari pusat kota | https://unri.ac.id/sejarah-universitas-riau/ | T |
| Angka lain | "Luas Wilayah 1.526.541" & "Luas Bangunan 549.440" (tanpa satuan; diduga m² seluruh UNRI) | https://unri.ac.id/tentang-universitas-riau/ | R (tidak konsisten) |
| Selisih luas | Poligon OSM tidak memuat Stadion Utama Riau (titik stadion **di luar** poligon); kemungkinan sebagian lahan 345 ha tercatat terpisah (kawasan stadion/EcoEduPark/lahan sengketa) | [INF] dari uji titik-dalam-poligon | R |
| Alamat | Kampus Bina Widya Km 12,5, Simpang Baru, Kec. Tampan (kini Kec. Binawidya), Pekanbaru 28293 | https://unri.ac.id/peta-kampus-universitas-riau/ | T |
| Pusat kampus (centroid) | 0,47802; 101,38237 → **±1,0 km arah barat daya (232°)** dari pusat stadion | dihitung | T |
| Rektorat | **±1,27 km barat daya (231°)** dari stadion | dihitung | T |
| Fasilitas UNRI terdekat ke stadion | Gedung Grand Gasing Millenium ±430 m **SSE** (161°); Gedung FH ±610 m **S**; Rusunawa ±830 m S; Stadion Mini ±985 m SSW | dihitung | T |
| Batas jalan | **Selatan**: Jl. HR Soebrantas (primary, lat ±0,464, 2 lajur/arah tercatat `lanes=2`); **Timur**: Jl. SM Amin (primary, `lanes=3`, lon ±101,394); **Barat**: Jl. Bangau Sakti (lon ±101,375); **Utara**: kawasan stadion & Jl. Naga Sakti (primary, lat ±0,488) | OSM `way/30574539`, `way/38867644`, `way/327351919`, `way/195075394` | T |

### Gerbang
| Gerbang | Lokasi (OSM) | Jam operasional | Sumber | Yakin |
|---|---|---|---|---|
| **Gerbang Soebrantas** (selatan) | node `10097168495`/`10097168496` `barrier=gate` di 0,46441; 101,3798–101,3800, ujung Jl. Binawidya UNRI | **24 jam** (ada masjid & RS) | OSM; https://bahanamahasiswa.co/kampus/penutupan-gerbang-bangau-lebih-awal-untuk-apa/ | T |
| **Gerbang SM Amin** (timur, disebut "gerbang utama") | ujung timur Jl. Muchtar Lutfi ±0,4774; 101,3948 (tak ada node gate di OSM) | s.d. 20.00 | https://www.cakaplah.com/berita/baca/84501/2022/05/10/gerbang-utama-unri-tak-bisa-dilewati-terkait-sengketa-lahan-dengan-pt-htj ; Bahana (atas) | T (nama), S (posisi persis) |
| **Gerbang Binakrida** (selatan-tengah) | Jl. Bina Krida (E–W, lat ±0,4718); ada `lift_gate` 0,47186; 101,3798/101,3800 + "Pos Keamanan" `way/327534471` | s.d. 21.00 | Bahana (atas); OSM | S (posisi = [INF]) |
| **Gerbang Bangau Sakti / Gerbang FEB** (barat) | ujung barat Jl. UNRI ±0,4742; 101,3754 | 06.00–18.00 (SE Rektor No. 10/2023) | Bahana (atas) | T (nama), S (posisi) |
| Gerbang FISIP | swing gate node `12110111405` 0,47176; 101,37917 [INF cocok] | s.d. 17.00 | Bahana (atas); OSM | S |
| Gerbang utara (sisi Naga Sakti) | `barrier=gate` `access=no` node `13318540200`/`13318567305` 0,48773; 101,3784 | tertutup | OSM | S |
| Penghubung kampus ↔ stadion | Jl. Stadion Utama (`service`) dari Jl. Muchtar Lutfi (0,4777; 101,3895) ke bundaran stadion (0,4812; 101,3896); **2 swing gate** `access=private`, `motor_vehicle=no` di 0,47777; 101,38952/101,38974 | — | OSM node `6301727125`, `11590671180` | T |

- Kampus dipakai warga sebagai jalan pintas (Arengka ↔ Giant) → alasan pembatasan gerbang. Sumber Bahana (atas). [T]
- Spanduk kuning jadwal gerbang terikat di sisi kanan Gerbang Bangau. Sumber Bahana (atas). [T] — bagus untuk prop.
- Okt 2026: pelebaran Jl. HR Soebrantas 505 m sepanjang kawasan UNRI menjadi 16 m (satu sisi), target Des 2026. https://www.wartapku.com/artikel/ragam/2026/10/08/pemprov-riau-mulai-pelebaran-jalan-hr-soebrantas-dan-tuanku-tambusai-pekanbaru [S]

### Jalan internal (semua `highway=tertiary` kecuali disebut)
| Jalan | Geometri | Sumber | Yakin |
|---|---|---|---|
| **Jl. Binawidya UNRI** | Poros U–S dari Gerbang Soebrantas (0,4644) ke simpang 0,4746 (±1,1 km), **jalur ganda** (dua way `oneway=yes`, lon 101,37981 & 101,37997) | OSM `way/38870017`, `way/1568665013` | T |
| **Jl. Muchtar Lutfi** (nama rektor definitif pertama) | Dari simpang 0,4746/101,3814 ke timur laut → **putaran depan Rektorat** (`way/327363975`, 0,4759–0,4764; 101,3829–101,3834) → lurus ke timur ±1 km sampai Gerbang SM Amin; jalur ganda di segmen timur | OSM `way/38870021`, `way/535177996`, `way/653939050/51`; nama rektor: https://unri.ac.id/sejarah-universitas-riau/ | T |
| **Jl. UNRI** | Dari simpang 0,4746 ke barat (FISIP, FEB) lalu cabang utara ke FMIPA/Faperta/FT (lon 101,3776) dan ke Gerbang Bangau | OSM `way/372460496`, `way/1455439027` | T |
| Jl. Bina Krida | E–W di lat 0,4718 (lon 101,3782–101,3856) | OSM `way/282242561`, `way/783152931` | T |
| Jl. Kampus FISIP | loop `service` searah di FISIP | OSM `way/327699265` | T |
| Jl. Stadion Utama / Jl. Sehat Stadion Utama Riau | `service`, menghubungkan kampus–stadion–Naga Sakti; ada bundaran `service` tanpa nama di 0,4811; 101,3895 | OSM `way/327366060`, `way/535214878` | T |
| Lebar/lajur/permukaan | **Tidak ditag** di OSM untuk jalan internal | — | — |
| Foto 2016 (drone): jalan kampus di samping danau = aspal 2 lajur searah, marka putih putus-putus, kerb beton, **trotoar beton tinggi** di sisi danau | https://commons.wikimedia.org/wiki/File:Taman_Unri.jpg (CC BY-SA 4.0) | T (visual) |

### Air, hutan, lapangan
| Fitur | OSM | Lokasi / luas | Arah dari stadion | Yakin |
|---|---|---|---|---|
| **Danau Buatan Universitas Riau** | `way/373856980` `water=reservoir` | 0,47602; 101,38261; ±0,33 ha (memanjang ±128 × 97 m bbox) | 1,14 km SW | T |
| **Waduk UNRI** | `way/327366050` | 0,47933; 101,38396; ±1,13 ha | 780 m SW | T |
| 2 "Waduk" kecil dekat Integrated Classroom | `way/1313268660`, `way/1313268661` | ±0,10 ha & ±0,22 ha | ±1,3 km SW | T |
| Danau + **jalur batu loncatan (stepping stones)** beton di air, papan nama lengkung batu "UNIVERSITAS RIAU", poros taman menuju Rektorat | foto drone 2016 | sisi Jl. Muchtar Lutfi depan Rektorat | — | T (visual) |
| **Taman Hutan UNRI (TAHUNRI)** | `way/1452277697` `natural=wood` | ±17,0 ha, centroid 0,48303; 101,38335 | ±680 m **barat** | T |
| **Arboretum UNRI** | `way/1452277699` | ±11,1 ha | ±830 m SW | T |
| Hutan Campuran UNRI | `way/1313268657` | ±1,46 ha (selatan, dekat masjid) | 1,86 km SSW | T |
| RTH Masjid Arfa'unnas | `way/1313268656` `leisure=park` | ±1,6 ha | 1,73 km SSW | T |
| **EcoEduPark** | `way/638603089` `leisure=park` | ±59,7 ha antara kampus & stadion | ±610 m WSW | T |
| Kebun sawit kampus | `way/1504824364` `landuse=orchard` `trees=oil_palms` | ±4,2 ha, 0,48232; 101,38175 | 870 m W | T |
| Petak lahan pertanian (12 petak ±444 m², kebun percobaan) | `way/327530278`… | sekitar 0,4789–0,4793; 101,3824–101,3831 | ±900 m SW | T (petak) / [INF] fungsi percobaan |
| Rawa kecil | `way/1452903636` `wetland=swamp` | ±0,4 ha di sisi GGM | 550 m SSE | T |
| Parit/gorong-gorong | `waterway=ditch` (BRG Mapathon 2020), `tunnel=culvert` | tersebar | — | T |
| **Stadion Mini UNRI** | `way/327364388` `leisure=stadium`, `capacity:persons=5000`; tribun `way/282225436` (25 × 137 m) | 0,47498; 101,38741 | 985 m SSW | T |
| Jogging track Stadion Mini | `way/327363974`, `way/421734205` | keliling | — | T |
| Lapangan Olahraga FKIP | `way/282225404` sepak bola, ±0,48 ha | 0,47230; 101,38087 | — | T |
| Lapangan Bola, Lapangan Basket (FEB area) | `way/282230715`, `way/282230714` | 0,4754; 101,3773 / 0,4738; 101,3756 | — | T |
| Tribun "Open Space Panjat Tebing": undakan beton, kanopi rangka baja + atap metal, plaza paving blok, dinding krem | https://commons.wikimedia.org/wiki/File:Open_Space_Panjat_Tebing_Universitas_Riau.jpg (CC BY-SA 4.0, 2022) | dekat "Sekretariat Panjat Tebing" `way/282225370` (0,47612; 101,37826) [INF] | — | T (foto), S (lokasi) |
| Bundaran | Hanya "putaran depan Rektorat" (`way/327363975`) & bundaran service stadion. **Bundaran Songket Melayu** (Jl. SM Amin × Naga Sakti, 0,4973; 101,3945) di luar kampus | OSM `way/535177994` | T |

---

## 2. Gedung penting

Catatan umum OSM: hampir semua gedung kampus ditag `building:roof=tin` (seng/metal), `building:walls=brick`,
`building:structure=reinforced_masonry`. **Tidak ada satu pun tag `roof:shape`, `roof:colour`, `building:colour`,
atau `height`** di dalam poligon kampus (208 gedung, 113 bernama). Jumlah lantai: 47 gedung 1 lt, 27 gedung 2 lt,
3 gedung 3 lt, 1 gedung 5 lt, 1 gedung 7 lt, 2 gedung "4-7", 127 tak bertag. [T, dihitung dari OSM]
→ **Warna fasad & bentuk atap harus dari foto/konfirmasi pengguna.**

| Gedung | OSM | Centroid | Tapak / lantai | Deskripsi fisik & sumber | Yakin |
|---|---|---|---|---|---|
| **Gedung Rektorat** | `way/282225347` | 0,47636; 101,38069 | ±1.700 m², bbox 38 × 65 m; OSM `levels=4-7`, `roof=concrete` | Foto drone 2016: **putih**, ±5 lantai, simetris; **blok tengah menonjol** berkaca biru vertikal + huruf nama di puncak; sayap kiri/kanan dengan pita horizontal (balkon/sunshade) berulang; **atap datar** dengan tepi/parapet gelap; di depan ada **kanopi/gazebo beratap merah bernada Melayu** dan pohon palem, tiang bendera. Ruang "Indragiri" dan "Siak Sri Indrapura/Indrapuri" ada di gedung ini. Foto: https://commons.wikimedia.org/wiki/File:Taman_Unri.jpg ; ruang: https://riaupos.co/pendidikan/14/10/2026/218910/raih-53-suara-di-sidang-senat-prof-ahmad-fadli-terpilih-jadi-rektor-unri-periode-2026-2030/ | T (putih, ±5 lt, atap datar); R (kanopi merah = selembayung? **tidak terkonfirmasi**) |
| Musholla Rektorat | `way/282225422` | 0,47572; 101,38098 | 1 lt | OSM | T |
| **Perpustakaan UNRI (lama)** | `way/282225374` | 0,47692; 101,37966 | ±1.434 m² | Pindah ke Bina Widya 1992; "empat gedung, masing-masing dua lantai" (ringkasan mesin cari dari situs lib) https://lib.unri.ac.id/sejarah-perpustakaan/ | S |
| Perpustakaan Utama baru (UML, ADB) | belum dipetakan | ? | ? | Paket CWR-02 (bersama ITC & UTC), kontraktor awal PT Totalindo diputus, dilanjut PT Nindya Karya, target 31 Juli 2025; status 2026 tak diketahui. https://hariantimes.com/read-14737-2025-03-25-tujuh-gedung-baru-unri-sudah-rampung-dikerjakantiga-lagi-ditargetkan-selesai-31-juli-2025.html | T (proyek), R (lokasi) |
| **Masjid Arfa'unnas** | `way/282230716` (OSM menulis "Ar-Faunas"), `levels=2`, `roof=concrete`, `capacity` >500 | 0,47117; 101,38046 (ujung selatan, dekat Gerbang Soebrantas) | denah 27 × 27 m (OSM bbox 40 × 42 m termasuk tangga), 2 lt: bawah kantor/ruang rapat/aula, atas ruang salat, ±1.000 jemaah. Dibangun 1989–1991 swadaya, nama awal **Masjid Nurul Fiqri**, resmi Arfa'unnas 12 Sept 2003 (Gub. Saleh Djasit) | https://arfaunnas.unri.ac.id/profile/sejarah-masjid-arfaunnas/ (via ringkasan) | T |
| ↳ fasad masjid | — | — | — | Foto 2023: dinding **krem/kuning gading** dengan list oker-emas, **lengkung runcing (ogee) berulang** di serambi atas & bawah, **tangga besar keramik putih** langsung ke lantai 2, **kubah bermozaik ubin putih-ungu/biru pola wajik**, mahkota bulan sabit, toa (pengeras suara), huruf timbul "MASJID ARFA' UNNAS UNIVERSITAS RIAU", motor parkir di pelataran aspal | https://commons.wikimedia.org/wiki/File:Masjid_Arfaunnas_unri.jpg (CC BY-SA 4.0) | T |
| **Gedung Grand Gasing Millenium (GGM)** = Auditorium PKM | `way/314450943`, `levels=4-7`, `roof=tin` | 0,47991; 101,39072 (±430 m SSE stadion) | tapak **melingkar ±82 m diameter**, ±5.100 m² | Bentuk terinspirasi **gasing** (permainan Melayu), dibangun 30 Ags 2008, rencana 5.000 kursi (2.800 main podium + 1.250 movable + 300 VIP). 2013: atap sudah terpasang, sisanya tiang & pondasi, tempat duduk undakan semen kasar, ilalang, coretan, jalan masuk batu & **tanah merah**. Wisuda Okt 2015 diadakan di sini. Terkendala dana & **sengketa lahan 17,6 ha dengan PT Hasrat Tata Jaya (HTJ)**; julukan "gedung mangkrak", konten horor TikTok. Status 2026 tidak jelas. | https://lovinasoenmi.wordpress.com/2013/04/02/gasing-tak-berputar/ ; https://unri.ac.id/acara-wisuda-ur-2015/ ; https://mediacenter.riau.go.id/read/61051/eco-edu-park-dan-gedung-grand-gassing-milleni.html ; https://www.goriau.com/berita/baca/miris-unri-sambut-8000-mahasiswa-baru-di-gedung-yang-tak-jadijadi.html | T (sejarah, bentuk), R (kondisi 2026) |
| **Gedung Serba Guna (Student Center, ADB)** | kandidat `way/1480014538` (tanpa nama) | 0,47589; 101,38891 | ±2.720 m², bbox 53 × 51 m | Resmi: di Jl. Muchtar Lutfi **antara asrama mahasiswa dan stadion mini**; dipakai wisuda (perdana 17–18 Feb 2025, 2.388 wisudawan), pengukuhan guru besar. Interior foto Des 2024: aula besar bentang lebar, **rangka atap baja (space truss) terekspos, plafon hitam**, dinding putih, lantai dilapis karpet hijau, kursi lipat biru, videotron. | https://unri.ac.id/unri-mulai-fungsikan-gedung-gedung-bantuan-adb/ ; https://unri.ac.id/unri-gelar-wisuda-perdana-di-gedung-baru/ | T (fungsi/lokasi teks, interior); S (way id = [INF] cocok lokasi) |
| **Integrated Classroom (IC, ADB)** | `way/1313268659` (`amenity=university`) | 0,47537; 101,37976 | ±4.550 m² | Di pertigaan FISIP–FKIP; daya tampung 5.000 mahasiswa. Foto: massa putih/abu muda 3–4 lt, **fasad layar logam perforasi oranye-terakota bermotif segitiga/zig-zag**, panel nama hitam huruf putih, selasar kolom putih, atap pelana lebar abu-abu. Parkiran motor baru ±0,5 ha paving blok, kapasitas 8.000 motor (dana TJSL BRI, 2026). | https://unri.ac.id/unri-mulai-fungsikan-gedung-gedung-bantuan-adb/ (foto Gambar-1); hariantimes (atas); https://pekanbaru.tribunnews.com/riau-region/1107843/setelah-area-parkir-integrated-classroom-unri-dibangun-tak-lagi-khawatir-becek ; https://bahanamahasiswa.co/kampus/integrated-classroom-unri-mulai-digunakan-parkiran-kurang-luas/ | T (foto), S (parkir, dari ringkasan) |
| Integrated Laboratory (ADB) | belum teridentifikasi | ? | 3 lt + | Foto: fasad **layar oranye** dengan perforasi vertikal, atap pelana besar, panel nama hitam | https://unri.ac.id/unri-mulai-fungsikan-gedung-gedung-bantuan-adb/ (Gambar-2) | T (foto) R (lokasi) |
| Health Studies Complex (ADB) | `way/1313268653` "Health Sciences Center" | 0,46924; 101,37935 (dekat Gerbang Soebrantas) | ±2.650 m² | Foto: 4 lt putih, **kisi diagonal oranye-krem pola wajik/pucuk rebung [INF motif]**, atap pelana putih dengan tritisan lebar | sumber sama (Gambar-4) | T (foto), S (way id) |
| 10 gedung ADB (AKSI) | — | — | total ±47.500 m² | IC, IL, HSC, SC, Boat House Marine Center, Food Science Center, ITC, UML, Postgraduate Center, UTC; anggaran US$58,7 juta (±Rp840 M) | https://unri.ac.id/unri-mulai-fungsikan-gedung-gedung-bantuan-adb/ | T |
| **Rusunawa mahasiswa** | `way/327366048` `building=apartments`, 5 lt, `roof=concrete` | 0,47612; 101,39009 | 69 × 23 m | Laporan 2014: 5 lt, ±96 kamar, putra; 2013 menyebut 4 lt/putri — tidak konsisten. **Wisma Binawidya** (2025): 5 lt, 90 kamar, tanpa lift, putra, AC | https://unri.ac.id/rumah-susun-mahasiswa-rusunawa-ur-dikhususkan-untuk-mahasiswa-putra/ ; https://bahanamahasiswa.co/kampus/wisma-binawidya-hunian-terjangkau-bagi-mahasiswa-universitas-riau/ | T (5 lt OSM), R (apakah Wisma = Rusunawa) |
| **Gedung Fakultas Hukum (Panam)** | `way/327366046` `building=college`, 3 lt | 0,47817; 101,38893 (±610 m S stadion) | 71 × 27 m | **Belum dipakai**: kuliah FH masih di Kampus Gobah; 2015 dinding & listrik belum selesai; berada di lahan sengketa HTJ | https://www.goriau.com/berita/baca/alumni-fh-unri-muhammad-rustam-berharap-rektor-terpilih-ahmad-fadli-tuntaskan-gedung-fakultas-hukum-di-panam.html | T |
| Balai Kesehatan UNRI (klinik) | `way/299211264` | 0,47133; 101,37946 | ±260 m² | OSM | T |
| UNRI Business Center | `way/299211269` | 0,47150; 101,37951 | — | OSM | T |
| RS Umum Universitas Riau (kelas D) | tidak ditemukan di poligon OSM | — | luas bangunan 4.688,93 (m²?) | alamat Kampus Bina Widya Jl. HR Soebrantas Km 12,5 | https://sirs.kemkes.go.id/fo/home/profile_rs/1471392 | T (ada), R (posisi) |
| UPT TIK / BPTIK | `way/282230719`, `way/282230760` | 0,4779; 101,3796–101,3802 | 2 lt | OSM | T |
| LPPM / LPPMP | `way/282225430`, `way/282225391` | 0,4764; 101,3795–101,3798 | — | OSM | T |
| Gedung Arsip | `way/842156476` | 0,47814; 101,38021 | — | OSM | T |
| UP2B (Pusat Bahasa) | `way/282225383` 1 lt, `roof=tile` | 0,47518; 101,38080 | — | OSM | T |
| Balai Bahasa Prov. Riau + Pendopo (dinding kayu) | `way/282225390`, `way/282225369` | 0,4728–0,4730; 101,3819 | 2 lt / 1 lt | OSM | T |
| TK Universitas Riau | `way/282225410` | 0,47201; 101,38120 | 1 lt | OSM | T |
| Kantin | Kantin FKIP `way/282225371` (`food_court`, 24/7, smoking=yes, wifi gratis); Kantin FT `way/282230754` (cafe, masakan daerah); Kantin Puskom `way/282225456` | lihat OSM | — | OSM | T |
| Kopmart (Koperasi Mahasiswa) | "Gedung Telkomsel", area panjat tebing (buka lagi Apr 2026) | — | — | https://bahanamahasiswa.co/kampus/kopmart-kembali-beroperasi-usai-vakum-tiga-tahun/ | S |

### Fakultas di Bina Widya (klaster OSM)
Resmi di Bina Widya: **FISIP, FEB, FMIPA, FPK (Perikanan & Kelautan), FKIP, Faperta, FT** (+ Rektorat, perpustakaan,
lembaga, UPT TIK, RS Pendidikan, masjid). **FK** di Jl. Diponegoro No. 1; **FH** & Pascasarjana di Kampus Pattimura (Gobah).
Sumber: https://unri.ac.id/sejarah-universitas-riau/ ; https://unri.ac.id/peta-kampus-universitas-riau/ [T].
Fakultas Keperawatan (berdiri 2017) — lokasi tidak disebut; [INF] kemungkinan di Health Studies Complex [R].

| Fakultas | Klaster OSM (pusat kira-kira) | Contoh gedung (way) | Lantai OSM |
|---|---|---|---|
| FKIP | 0,4720–0,4744; 101,3801–101,3828 (selatan-tengah) | Dekanat `327698566` (2 lt); Gedung A/C/D/E/F/H (1 lt); Lab PMIPA `327377611` (2 lt); Micro Teaching `282225473`; Perpustakaan FKIP | 1–2 |
| FISIP | 0,4720–0,4738; 101,3777–101,3796 | Dekanat `282225472` (2 lt, `roof=tile`); Gedung A–E; **Auditorium Sultan Balia** `282225372`; **Gelanggang Mahasiswa FISIP** `282225392` (2 lt); Pendopo FISIP (dinding kayu); Lab Ilmu Komunikasi (3 lt); **"Gedung Mangkrak FISIP"** `1313268658` | 1–3 |
| FEB | 0,4745–0,4756; 101,3756–101,3767 (barat, dekat Gerbang Bangau) | Biro & Dekanat `282230710` (2 lt), Gedung A–D, L; Pos Keamanan; Musholah | 1–2 |
| FMIPA | 0,4776–0,4785; 101,3757–101,3771 | Dekanat `282225385` (2 lt); Gedung Kuliah; Lab Fisika Bumi; Lab Kimia Terapan | 2 |
| Faperta | 0,4787–0,4798; 101,3778–101,3786 | Dekanat `282225400` (2 lt); Lab Pengolahan/Analisis Hasil Pertanian; Pascasarjana Faperta | 1–2 |
| FPK/Faperika | 0,4788; 101,3809 | Dekanat FAPERIKA `282225346` (2 lt) | 2 |
| FT | 0,4799–0,4826; 101,3760–101,3772 (barat laut) | Gedung C FT `282230721` (3 lt, 92 × 48 m); Lab Teknik Elektro (2 lt, ±3.480 m²); lab sipil/kimia/mesin (1–2 lt); **"Gedung Setengah Bundar FT"** (disebut sebagai alamat sekre Mapala Winnetou) | 1–3 |

---

## 3. Organisasi mahasiswa & sekretariat (BEM, UKM)

| Fakta | Sumber | Yakin |
|---|---|---|
| OSM memetakan: **"Sekretariat Lembaga Mahasiswa"** `way/327530276` di 0,47365; 101,38756 (selatan Stadion Mini, ±1,1 km SSW stadion) | https://www.openstreetmap.org/way/327530276 | T (tag ada); S (isi: BEM/UKM univ? tidak dirinci) |
| Sekretariat BEM FMIPA `way/327530275`; BEM Fakultas Ekonomi `way/327534465` (1 lt); Gedung BEM FKIP `way/327534467` (1 lt, ±213 m²); Sekretariat Panjat Tebing `way/282225370` | OSM | T |
| 2017: WR III menyebut rencana "bagian bawah gedung gasing bakal dibangun sekretariat kelembagaan" — rencana, bukan fakta terbangun | https://bahanamahasiswa.co/dia/syapsan-saya-ingin-kelembagaan-mahasiswa-bersinergi/ | T (pernyataan), R (realisasi) |
| Gedung PKM (Pusat Kegiatan Mahasiswa) "resmi" yang dipakai wisuda s.d. 2015 ada di **Kampus Pattimura Gobah**, bukan Panam | https://unri.ac.id/acara-wisuda-ur-2015/ | T |
| Mapala fakultas memakai gedung fakultas sebagai sekre (Suluh–FKIP, Humendala–FEB, Phylomina–FPK, Sakai–FISIP, EMC2–FMIPA, Brimapala Sungkai–Faperta, Winnetou–FT "Gedung Setengah Bundar Lt.1") | https://www.walhiriau.or.id/tentang-kami-2/organisasi-anggota/ ; http://phylominariau.blogspot.com/ ; http://genetika-fpuisu.blogspot.com/p/blog-page_14.html | S (data lama sebagian) |
| LPM **Bahana Mahasiswa** (pers mahasiswa, 1983) — lokasi sekre tidak ditemukan | https://issuu.com/bahana_mahasiswa | S |
| Kabinet BEM UNRI: "Lentera Bertuah" (2020/21, dilantik di Ruang Siak Sri Indrapuri), "Kreator Pergerakan" (2022); aksi AMUK di Kantor Gubernur 12 Ags 2026 berjas almamater biru langit | https://unri.ac.id/bem-adalah-wadah-pengembangan-kreatifitas/ ; https://m.liputanoke.com/read-69834-2026-08-12-aksi-bem-unri-di-kantor-gubri-ricuh-mahasiswa-saling-dorong-dengan-aparat.html | S |
| **Lokasi persis sekretariat BEM UNRI (tingkat universitas) — TIDAK DITEMUKAN** | — | GAP |

### Interior sekretariat organisasi mahasiswa — [POLA UMUM] Indonesia, bukan fakta UNRI
Keyakinan sedang sebagai pola, tanpa sumber spesifik UNRI:
- Ruang 3×4 s.d. 4×6 m, lantai keramik putih/krem dilapis **karpet/ambal** atau tikar; **rapat lesehan** melingkar; kadang satu meja panjang + kursi plastik/kursi lipat.
- Dinding: **papan struktur organisasi** (bagan kabinet + foto pengurus), **papan program kerja (proker)/timeline**, kalender, jadwal piket, whiteboard berisi coretan rapat, logo/bendera organisasi & bendera kampus/Merah Putih di tiang kecil, poster acara lama, sertifikat/piagam, **stiker** di pintu & lemari.
- Perabot: rak/lemari arsip besi atau kayu berisi map ordner, kardus properti acara, spanduk & banner tergulung, **dispenser galon**, **kipas angin** (berdiri/dinding; AC jarang), stopkontak sambungan, printer tua, laptop, gitar (UKM seni), tas & sepatu menumpuk di depan pintu (alas kaki dilepas).
- Luar: rak sepatu, papan pengumuman, motor parkir rapat, jemuran jaket/almamater.

---

## 4. Karakter visual & suasana

| Fakta | Sumber | Yakin |
|---|---|---|
| Julukan **"Kampus Biru Langit"** (warna almamater) | https://bahanamahasiswa.co/kampus/penutupan-gerbang-bangau-lebih-awal-untuk-apa/ ; TikTok @mahasiswa_unri | T |
| Konsep "University in a Park"/**Eco-Edu-Campus**: taman ramai warga & mahasiswa hampir tiap sore, jogging track, taman olahraga, **"butterfly bridge"**, bangku diskusi di bawah pohon, science park dengan ayunan anak; waduk & arboretum direncanakan dikelola (perahu) | https://unri.ac.id/kampus-dalam-taman/ (2015) | T (2015), S (kondisi kini) |
| Pohon peneduh dominan: **mahoni (Swietenia mahagoni)**, **angsana (Pterocarpus indicus)**, **saga (Adenanthera pavonina)**; 40 spesies; studi 2013: 30 spesies, mahoni dominan | https://semnas.biologi.fmipa.unp.ac.id/index.php/prosiding/article/view/1093 ; https://jom.unri.ac.id/index.php/JOMFKIP/article/download/21781/21077 | T |
| Penanaman 2026: cempedak, nangka madu, mangga, petai, jengkol, pulai, bunga tanjung, mahoni | https://unri.ac.id/gerakan-penanaman-pohon-penghijauan-unri-dukung-pelestarian-lingkungan-berkelanjutan/ | S |
| Foto 2016: poros menuju Rektorat diapit **barisan pohon tinggi ramping bertajuk sempit** (tampak seperti Acacia mangium/eukaliptus) + palem, rumput luas, jalan setapak beton | Commons Taman_Unri.jpg | T (visual), **R (identifikasi spesies = [INF])** |
| Ada kebun sawit (4,2 ha) & lahan pertanian di dalam kampus | OSM (bagian 1) | T |
| Gedung lama fakultas: OSM dominan 1–2 lt, atap seng, dinding bata plester; ([INF]: blok koridor tipikal kampus negeri 1980–90-an, cat krem/putih) | OSM; warna = [INF] | T (lantai/atap), R (warna) |
| Gedung ADB baru (2024–25): **putih/abu muda + layar fasad oranye-terakota bermotif**, atap pelana lebar abu-abu muda, papan nama hitam huruf putih kapital | foto unri.ac.id (bagian 2) | T |
| Parkir motor sangat padat (IC: dulu parkir dialihkan ke UPT Bahasa dijaga 4 satpam; becek saat hujan; kini paving 8.000 motor) | Bahana & Tribun (bagian 2) | S |
| Transportasi: **Trans Metro Pekanbaru Koridor 03** (Awal Bros–UIN Panam) lewat Jl. HR Soebrantas; OSM: 2 node "Halte TMP" (beratap, ada bangku) di 0,4641; 101,3730 & 0,4644; 101,3742 (±600 m barat Gerbang Soebrantas); "Halte" bangku di Jl. Naga Sakti dekat SM Amin (0,4906; 101,3945). Koridor "FA" dgn halte "Gerbang UNRI" hanya disebut satu blog | https://id.wikipedia.org/wiki/Trans_Metro_Pekanbaru ; OSM node `4559431711`, `4559433677`, `4561327395` ; https://www.escapeswithandrew.com/trans-metro-pekanbaru/ | T (koridor 3, halte OSM), R (koridor FA) |
| Sekitar gerbang: kos-kosan padat di Jl. Bangau Sakti (dekat Gerbang FEB), kafe di Jl. SM Amin depan gerbang, jalan Bangau "jelek", mahasiswa cari makan ke Jl. Binakrida/Merpati | Bahana (gerbang); https://www.lemon8-app.com/@aqssshhh/7536876633081381377?region=id | S |
| Spanduk kuning pemberitahuan di gerbang; satpam UNRI berjaga di pos | Bahana (gerbang) | T |
| Pedagang kaki lima di dalam kampus, halte bus kampus internal | tidak ditemukan sumber | GAP |

---

## 5. Topografi & elevasi

### Titik sampel (m, di atas geoid)
| Titik | Koordinat | SRTM 30 m (opentopodata `srtm30m`) | ASTER 30 m (`aster30m`) | Copernicus GLO-90 (Open-Meteo) |
|---|---|---|---|---|
| Rektorat | 0,47636; 101,38069 | 32 | 32 | 34 |
| **Stadion Utama (pusat)** | 0,48360; 101,38948 | **33** | 26 | **72** ← atap stadion (DSM) |
| Gerbang Soebrantas | 0,46440; 101,37990 | 30 | 23 | 29 |
| Danau Buatan | 0,47602; 101,38261 | 34 | 25 | 31 |
| Waduk UNRI | 0,47933; 101,38396 | 32 | 32 | 29 |
| Masjid Arfa'unnas | 0,47120; 101,38046 | 35 | 25 | 33 |
| FT Gedung C | 0,48008; 101,37674 | 36 | 27 | 36 |
| Gedung FH | 0,47817; 101,38893 | 32 | 29 | 35 |
| Stadion Mini | 0,47498; 101,38741 | 31 | 28 | 31 |
| GGM | 0,47991; 101,39072 | 33 | 22 | 35 |
| Gerbang SM Amin | 0,47750; 101,39450 | 28 | 23 | 28 |
| Gerbang utara | 0,48773; 101,37840 | 34 | 23 | 31 |
| TAHUNRI | 0,48303; 101,38335 | 34 | 23 | 32 |
| Dekanat FISIP | 0,47340; 101,37869 | 40 | 25 | 33 |
| Dekanat FKIP | 0,47414; 101,38081 | 33 | 24 | 33 |
| Health Studies Complex | 0,46924; 101,37935 | 39 | 22 | 33 |
| Perpustakaan | 0,47692; 101,37966 | 37 | 32 | 33 |

Sumber: https://api.opentopodata.org/v1/srtm30m , https://api.opentopodata.org/v1/aster30m ,
https://api.open-meteo.com/v1/elevation (kueri 2026-10-17). [T untuk nilai yang dikembalikan API]

**Grid SRTM 8×8** (lat 0,4645–0,4876 × lon 101,3752–101,3934, jarak ±370 × 290 m): min **19 m**, maks **38 m**,
rerata **32,1 m**. Titik terendah 19–23 m di timur laut (0,4876; 101,3908–101,3934 = dekat Jl. Naga Sakti utara stadion). [T]

**Kesimpulan [INF, keyakinan S]:** kampus **datar hingga bergelombang landai**, inti kampus ±31–37 m; relief lokal
±3–6 m; cekungan drainase dangkal (danau, waduk, parit, rawa kecil); turun ke ±28 m di Gerbang SM Amin (timur) dan
±19–23 m di lembah kecil timur laut. **Selisih Rektorat–Stadion (SRTM): ±1 m (32 vs 33)** → praktis setara.
Saran simulator: medan dasar datar ±32 m dengan undulasi halus 2–4 m; permukaan danau/waduk 1–3 m di bawah tepian.
Angka 40/39 m di FISIP & HSC kemungkinan efek kanopi/gedung (lihat keterbatasan).

### Lisensi & keterbatasan
| DEM | Resolusi | Jenis | Lisensi | Sumber | Yakin |
|---|---|---|---|---|---|
| SRTM GL1 (Feb 2000) | 1″ ≈ 30 m | **DSM** (radar C-band, tidak tembus kanopi penuh) | **Domain publik** (NASA/USGS) | https://www.opentopodata.org/datasets/srtm/ | T |
| ASTER GDEM v3 | 1″ ≈ 30 m | DSM optik stereo, berderau di tropis berawan | Bebas pakai (NASA/METI), atribusi | https://www.opentopodata.org/datasets/aster/ | S |
| Copernicus DEM GLO-30 / GLO-90 (TanDEM-X 2011–2015) | 30 m / 90 m | **DSM** (termasuk gedung & vegetasi) | Lisensi "COP-DEM-GLO-30-F Full, Free & Open" (gratis, global; atribusi wajib: "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"); penggunaan komersial menurut pihak ketiga diperbolehkan — **cek teks resmi** | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM ; https://open-meteo.com/en/docs/elevation-api | T (atribusi), S (komersial) |

Keterbatasan: (1) Ketiganya **DSM, bukan DTM** — pohon (hutan TAHUNRI/arboretum tinggi 15–25 m [INF]) dan gedung
menaikkan nilai; contoh nyata: GLO-90 = **72 m** di stadion (atap, dibangun 2009–2012), SRTM 2000 = 33 m (sebelum
stadion ada). (2) Resolusi 30–90 m tidak menangkap parit, kerb, tanggul danau. (3) Akurasi vertikal SRTM ±5–10 m
di tropis. (4) Nilai opentopodata diinterpolasi. (5) DEMNAS BIG (8 m) tidak dicek — kandidat lebih baik bila lisensinya sesuai.

---

## 6. Sejarah singkat & identitas (bahan easter egg / papan nama)

| Fakta | Sumber | Yakin |
|---|---|---|
| Berdiri **1 Oktober 1962** (SK Yayasan 02/KPTS/JUR/62; ada pula tanggal 25 Sept 1962; OSM/Wikidata 1 Sept 1962) — sumber resmi UNRI memakai 1 Okt | https://unri.ac.id/sejarah-universitas-riau/ | T (1 Okt resmi) |
| Pelopor: Kol. Kaharuddin Nasution, Datuk Wan Abdurrahman, Soesman Hs., **Drs. Sutan Balia** (→ nama Auditorium Sultan Balia FISIP [INF tautan nama]) | https://unri.ac.id/tentang-universitas-riau/ | T |
| Kampus lama Jl. Pattimura No. 9 (Gobah); Bina Widya difungsikan 1983; Rektorat & perpustakaan pindah 1992 | sejarah UNRI; lib.unri | T |
| Rektor definitif pertama **Prof. Dr. Muchtar Lutfi** (1980–1989) → nama jalan utama kampus | sejarah UNRI | T |
| Rektor 2022–2026 Prof. Dr. Sri Indarti; **Prof. Ahmad Fadli ST MT PhD** (Dekan FT) terpilih 13 Okt 2026 (53 suara), dilantik direncanakan 20 Des 2026 | https://riaupos.co/pendidikan/14/10/2026/218910/raih-53-suara-di-sidang-senat-prof-ahmad-fadli-terpilih-jadi-rektor-unri-periode-2026-2030/ | T |
| **Lambang**: **Lancang Kuning dalam segi lima**; segi lima = Pancasila; dasar **hijau lumut**; **kuning emas**; pohon hayat (1 daun kecil = tgl 1, 10 daun besar = Oktober); teratai putih (6 daun besar + 2 kecil = 62); perahu & tiang layar kuning; laut & gelombang = fakultas | https://unri.ac.id/lambang/ ; https://riaureview.com/news/detail/17091/kukerta-unri-desa-kota-lama-melakukan-renovasi-lambang-universitas-riau | T |
| Tautan tematik: Stadion Utama Riau juga berkonsep Lancang Kuning (lihat `stadion-utama-riau.md`) | [INF] | — |
| **Almamater biru langit** | https://id.wikipedia.org/wiki/Universitas_Riau ; https://www.goodnewsfromindonesia.id/2021/12/31/melihat-warna-warni-jas-almamater-kampus-di-indonesia | T |
| Tagline Milad 60: **"Unri, Unggul dan Bermartabat"**; warna logo milad hijau-kuning-merah (warna Riau) + biru | https://www.parasriau.com/2022/09/rangkaian-milad-ke-60-unri-dimulai-ini.html | S |
| Visi: "universitas riset unggul bermartabat di bidang sains dan teknologi di kawasan Asia Tenggara tahun 2035"; budaya kerja **ASRI** (Amanah, Santun, Responsif, Inovatif) | https://unri.ac.id/tentang-universitas-riau/ | T |
| Mars UNRI: syair Emel, lagu Jimmy Hartoyo, tempo di marcia; identitas diatur Statuta (Permenristekdikti 81/2017) | sama | T |
| Angka: 49.079 mahasiswa, 10 fakultas, 116 prodi, 136 guru besar | sama | T |
| Masjid lama kampus: **Akramunnas** ("manusia mulia") — pasangan nama Arfa'unnas ("manusia bermanfaat") | arfaunnas.unri.ac.id (via ringkasan) | S |
| Ide easter egg [INF]: tugu/papan "Gedung Gasing" setengah jadi, spanduk kuning jadwal gerbang, stepping stones danau, "Gedung Setengah Bundar FT", "Gedung Mangkrak FISIP" (nama OSM), plang sengketa PT HTJ (7 plang dipasang 2018: https://m.suarasindo.com/read-1526-2018-09-11-pt-htj-memasang-tujuh-plang-pengumuman-atas-kepemilikan-lahan-di-unri.html) | — | — |

---

## 7. Gap — perlu konfirmasi pengguna / survei
1. **Lokasi persis sekretariat BEM UNRI** dan UKM tingkat universitas (apakah di "Sekretariat Lembaga Mahasiswa" `way/327530276` dekat Stadion Mini? Gelanggang Mahasiswa? lantai bawah GGM?).
2. Status fisik **GGM 2026** (masih mangkrak/terbengkalai, atau sudah direvitalisasi?), material & warna atap/dinding.
3. Apakah `way/1480014538` benar **Student Center**; lokasi Integrated Lab, Food Science Center, Postgraduate Center, ITC, UTC, Perpustakaan Utama baru.
4. **Warna cat dominan gedung fakultas lama** & bentuk atap (limas/pelana/lontik/selembayung?) — OSM tak punya tag warna/bentuk atap; tidak ada foto bebas lisensi selain Rektorat & masjid.
5. Ada/tidaknya **selembayung** atau ornamen Melayu pada Rektorat (kanopi merah di depan = ?) dan gerbang-gerbang (desain gapura Soebrantas & SM Amin tidak ditemukan).
6. Posisi tepat Gerbang Binakrida, Bangau, FISIP; jalur ganda/lebar jalan internal; trotoar.
7. Lokasi RS UNRI, Wisma Binawidya vs Rusunawa (bangunan sama?), lokasi Fakultas Keperawatan.
8. Spesies pohon pada poros Rektorat (akasia vs eukaliptus); ada/tidaknya PKL & halte/bus kampus internal.
9. Luas resmi (345,6 ha) vs poligon OSM (244,6 ha) — bagian mana yang tidak terpetakan.
10. Elevasi: verifikasi dengan DEMNAS (BIG, 8 m) bila diperlukan detail parit/tanggul.

---

## 8. Tambahan riset 2026-10-19 — Stadion Mini, Rektorat, Danau, Jembatan Kupu-Kupu
Pencarian lanjutan untuk detail stadion mini, Rektorat, danau, dan jembatan. Label keyakinan sama seperti bagian lain.

### Jembatan Kupu-Kupu (baru; belum ada di kode)
| Fakta | Sumber | Yakin |
|---|---|---|
| Jembatan Kupu-Kupu UNRI ada di sisi danau, **di depan Gedung Rektorat**; "desain terinspirasi dari bentuk kupu-kupu yang anggun"; menghubungkan dua area kampus yang dipisahkan danau buatan | https://www.indonesia.travel/id/id/destination/sumatra/riau/jembatan-kupu-kupu ; https://www.quipper.com/id/blog/quipper-campus/campus-life/10-tempat-favorit-mahasiswa-universitas-riau-yang-perlu-kamu-ketahui/ | S (teks populer; lokasi "depan Rektorat" dari ringkasan pencarian, belum diverifikasi di halaman sumber) |
| Jadi ikon kampus bersama halaman Rektorat dan tulisan UNRI di tepi danau; ramai sore–malam (foto, nongkrong, belajar, olahraga) | quipper (di atas); https://rri.co.id/lain-lain/951803/danau-unri-tempat-nongkrong-diskusi-dan-olahraga-mahasiswa (ringkasan pencarian; halaman 403 saat di-fetch) | S |
| Ada motif batik "Jembatan Kupu-Kupu Universitas Riau" (penelitian LPPM) → bentuk jembatan dikenal luas sebagai identitas visual | https://unri.ac.id/batik-unri-itu-bernama-batik-riau-prestasi/ (hanya nama; tanpa uraian bentuk) | T (nama), tanpa rincian bentuk |
| Di area jembatan diresmikan **POLIDAN** (Pojok Literasi Danau) dan **GAMA** (Gerai Aksi Mahasiswa, UMKM mahasiswa) — "Ruang Kolaboratif Tepian Danau" | https://unri.ac.id/unri-resmikan-polidan-dan-gama-prof-hermandra-tingkatkan-minat-baca-dan-jiwa-wirausaha/ | T (ada & di tepian danau); bentuk fisik tidak diuraikan |
| **Bukan** Jembatan Kupu-kupu Siak (500 m, dekat Istana Siak) | https://www.goriau.com/berita/baca/ingin-nikmati-kecantikan-jembatan-kupukupu-yang-satusatunya-di-indonesia-datanglah-ke-negeri-istana.html | T (jangan tertukar) |
| **Tidak ditemukan**: dimensi, bahan, warna, bentuk lengkung/sayap, pagar, lampu, tahun bangun, perancang; tidak ada foto bebas lisensi di Commons; OSM way jembatan belum bisa di-query (Overpass 503) | — | **Gap** |

### Stadion Mini
- Dipakai sepak bola, tenis, futsal, basket, badminton; mahasiswa berolahraga hampir tiap hari terutama sore; **jogging track di luar area stadion** [S] — https://www.quipper.com/id/blog/quipper-campus/campus-info/5-fasilitas-di-universitas-riau-paling-populer/
- Tidak ditemukan sumber untuk bentuk tribun, permukaan lintasan, atau lampu. Model saat ini (lintasan 6 lajur tanah merah, tribun 16 undakan, atap VIP) tetap [INF].

### Rektorat & Danau
- Tidak ada sumber baru untuk fasad/kanopi Rektorat; rujukan visual tetap foto Commons `Taman_Unri.jpg`.
- Waduk dekat Rektorat berfungsi sebagai cadangan air saat kemarau [S] (quipper, ringkasan pencarian).
- Aktivitas sekitar danau: foto, bermain, belajar sore, olahraga [S].

### Gap baru
11. **Bentuk fisik Jembatan Kupu-Kupu** (sayap/lengkung, lebar, bahan, pagar, lampu) dan koordinatnya — butuh foto/survei dari pengguna atau way OSM.
12. Bentuk fisik POLIDAN dan GAMA di tepian danau.
13. Tribun, lintasan, dan lampu Stadion Mini — butuh foto.
