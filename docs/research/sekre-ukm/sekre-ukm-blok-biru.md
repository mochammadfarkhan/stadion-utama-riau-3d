# Sekretariat UKM "Blok Biru" + kompleks lapangan (lokasi sekre sebenarnya)

Dikoreksi user 2026-10-19: sekre mereka **bukan** di deretan "Sekretariat Lembaga Mahasiswa" (OSM `way/327530276`),
melainkan gedung beratap biru di Jl. Prof. Aras Mulyadi (foto Street View Jan 2025, panorama `QeLVEK0QavhzInk-nfoTjw`),
dengan **lapangan voli dan tenis** di dekatnya. Dokumen ini adalah sumber kebenaran ukuran/posisi untuk integrasi.

Gambar rujukan di folder ini: `ref-streetview-user.webp` (foto dari user), `ref-streetview-zoom-fasad.png`
(fasad diperbesar), `ref-sat-overview-229m.jpg`, `ref-sat-gedung-115m.jpg`, `ref-sat-lapangan-115m.jpg`.

Konvensi koordinat dunia = sama dengan game (+X timur, **+Z selatan**, meter; origin `WORLD_ORIGIN`
0.4835954, 101.3895277). Region `unri-lembaga` memakai placement `(-219.47, 1099.21)` yaw 0 → koordinat
region-lokal = dunia − placement.

## 1. Cara pengukuran (bisa diulang)
Google Maps satelit, URL `…/@lat,lon,Nm/data=!3m1!1e3`. Setelah dimuat, N berubah ke nilai akhir (tampil di URL);
skala **piksel/meter = 602 / N** (dikalibrasi dengan klik kanan "koordinat" pada satu titik, selisih 0,01 px/m,
dan diverifikasi ke footprint Student Center OSM `way/1480014538` dengan selisih ≤ 7 m). Pusat peta = piksel (400,300).
Dunia: `x = x_pusat + (px−400)/s`, `z = z_pusat + (py−300)/s`. Dua tangkapan berbeda (gedung 115 m, lapangan 115 m)
saling cocok < 0,5 m pada gubuk panahan. Keyakinan posisi: sedang (±2 m); bentuk detail: lihat tag per butir.

## 2. Fakta yang terlihat
- **Gedung (L, 1 lantai)** — Google Maps menandai tiga sekretariat di dalamnya: **KSR PMI Unit Universitas Riau**,
  **UKM KOPMA UNRI**, **ERC** [T, label Google Maps]. Dinding putih keabu-abuan, **atap pelana seng biru kobalt**,
  pintu biru tua berbingkai putih, jendela tinggi berpanel vertikal berbingkai putih, halaman beton di sisi dalam L
  dengan bangku kayu, tong biru, motor parkir [T, Street View]. Detail: teras, tangga pintu, AC, lampu dinding,
  bentuk talang = [INFERENSI].
- **Lapangan** (tiga, berjajar timur–barat, sumbu panjang utara–selatan, dibatasi jalur hijau berpalem) [T, satelit]:
  voli (kiri/barat), **basket** (tengah; tidak disebut user tapi jelas dari marka busur/kunci), tenis (kanan/timur).
  Permukaan: voli biru-lavender, basket biru muda bermarka putih, tenis hijau bermarka putih; run-off ketiganya
  oranye-bata. Net/ring tidak terlihat dari atas [INFERENSI: net voli & tenis, ring basket di kedua ujung].
- **Lapangan memanah UNRI** (label Google): gubuk memanjang beratap merah + lapangan rumput di timurnya [T]. Ada ikon
  "P" (parkir) di rumput ±(−82, 988) [T, label].
- Pohon rimbun di barat (tepi Jl. Prof. Aras Mulyadi, parit beton di tepi jalan) dan hutan lebat di timur gedung [T].

## 3. Geometri dunia (meter)
### 3.1 Gedung L
Atap (dengan tritisan 0,9 m), poligon dunia: A(−117.9, 1018.2) → B(−94.4, 1018.2) → C(−94.4, 998.8) → D(−81.4, 998.8) →
E(−81.4, 1031.0) → F(−117.9, 1031.0). Dinding (inset 0,9): sayap barat–timur x −17.35…6.15 × z 4.2…15.2 (lokal),
sayap utara–selatan x 6.15…17.35 × z −15.2…15.2 (lokal). Pusat bbox (= origin GLB): **(−99.65, 1014.90)**.
Tinggi: lantai 0,45; plafon dinding 3,75; bubungan 5,77 (pitch ≈ 20°).
Keyakinan: tapak sedang (±2 m), tinggi [INFERENSI] dari proporsi foto (dinding ±3,3 m).
Pintu (koordinat game-lokal GLB, `h09-sekre-ukm.json` memuat angka persisnya):

| Id | Sisi | x lokal | z lokal | Menghadap | Papan nama default (sumber) |
|---|---|---|---|---|---|
| D1 | utara-H | −15.39 | 4.2 | utara | `KSR PMI` [T, label Google] |
| D2 | utara-H | −7.55 | 4.2 | utara | `KOPMA UNRI` [T, label Google] |
| D3 | utara-H | 0.28 | 4.2 | utara | **ruang pemain** — nama UKM menunggu user (`SEKRE_PEMAIN`) |
| D4 | barat-V | 6.15 | −1.62 | barat | `SEKRETARIAT` (tak berlabel) |
| D5 | barat-V | 6.15 | −9.38 | barat | `ERC` [T, label Google, posisi ±1 m] |
| B1 | selatan | belakang | – | selatan | pintu belakang, tanpa papan |

### 3.2 Halaman & jalan
Halaman beton (abu-abu di satelit): x −119.2…−99.2, z 998.2…1011.5; ditambah apron beton di depan sisi dalam L
(lebar ±3,5 m) [INFERENSI]. Gubuk panahan: x −116.6…−109.9, z 969.6…995.4 (6,7 × 25,8 m, atap merah).
Jl. Prof. Aras Mulyadi melengkung di barat (titik panorama user di (−137.1, 999.5)); parit beton di tepinya.

### 3.3 Kompleks lapangan
Kotak luar (jalur hijau + palem): x −122.4…−49.2, z 915.1…960.6. Lapangan bagian dalam (pusat; ukuran permukaan berwarna):

| Lapangan | Pusat dunia (x, z) | Permukaan (lebar × panjang) | Dengan run-off oranye | Standar |
|---|---|---|---|---|
| Voli | (−112.1, 945.4) | 10.1 × 18.5 | 13.8 × 27 | 9 × 18 m |
| Basket | (−86.4, 939.0) | 17.2 × 28.7 | 20.4 × 32.5 | 15 × 28 m |
| Tenis | (−59.5, 935.5) | 11.8 × 24.3 | 20 × 37 | 10.97 × 23.77 m |

Student Center (OSM `way/1480014538`) berada 30+ m di utara kompleks (z 832…883).

## 4. Kontrak aset Blender (sudah dibuat)
Skrip: `assets-src/blender/unri/h09_sekre_ukm.py`, `h10_ring_basket.py`. Jalankan lewat Blender MCP
(`runpy.run_path(...)["build"]()`) atau headless. Keluaran:

- `public/models/unri/h09-sekre-ukm.glb` (+ `.json` metadata: footprint dinding/atap lokal, pintu, anchor papan nama,
  statistik). ±6,9k segitiga, 16 material `unri:*`, satu mesh per material. Frame: origin = pusat bbox di tanah;
  +X timur, −Z utara (three.js), Y atas. Material `unri:lampu-emisif` (emissive 0; siapkan `nightEmissive`),
  `unri:kaca`, `unri:atap-biru`, dst. Papan nama = kotak `unri:papan-nama` kosong; teks digambar game (canvas) di
  anchor `sign` per pintu.
- `public/models/unri/h10-ring-basket.glb`: satu tiang ring basket, origin = dasar tiang, **depan (arah lapangan) =
  −Z three.js**; 528 segitiga. Pasang dua (satu tiap ujung, diputar 180°) 1,2 m di luar garis belakang.

## 5. Yang dikerjakan integrasi (lihat brief implementer)
Gedung + halaman + lapangan + gubuk panahan sebagai konten region `unri-lembaga` (mask harus memuat area ini);
pad terrain; collider; portal pintu pemain berpindah ke D3; papan nama pintu; tujuan perjalanan cepat; titik cerita
bab 6 dipindah ke halaman gedung; vegetasi sekitar (mahoni/angsana rimbun, palem antar lapangan); gerbang visual.
