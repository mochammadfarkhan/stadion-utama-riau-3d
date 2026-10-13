# Stadion Utama Riau — Simulator 3D

Simulator 3D interaktif kawasan **Stadion Utama Riau** (Jl. Naga Sakti, Panam, Pekanbaru) dibangun dengan [Three.js](https://threejs.org) 0.186 + Vite. Semua geometri prosedural, tanpa aset unduhan.

| Interior tribun | Plaza & gate utara |
|---|---|
| ![Interior](docs/screenshots/interior-tribun.jpg) | ![Plaza](docs/screenshots/plaza-gate-utara.jpg) |
| **Gapura Jl. Naga Sakti** | **Tugu Lancang Kuning** |
| ![Gapura](docs/screenshots/gapura-naga-sakti.jpg) | ![Tugu](docs/screenshots/tugu-lancang-kuning.jpg) |
| **Gaya stylized siang** | **Malam, PJU menyala** |
| ![Siang](docs/screenshots/siang-stylized-tugu.jpg) | ![Malam](docs/screenshots/malam-tugu-lancang-kuning.jpg) |
| **Tribun siang** | **Malam hujan** |
| ![Tribun](docs/screenshots/siang-tribun-stylized.jpg) | ![Hujan](docs/screenshots/malam-hujan-plaza.jpg) |

## Fitur
- **Bersepeda** keliling kawasan dan masuk ke dalam stadion lewat gate utama utara/barat (model kinematik sepeda: inersia, lean saat belok, roda & pedal berputar, bel).
- **Pedagang keliling** minuman (es teh, es jeruk, air mineral, kopi) dan buah (buah potong, jeruk, rujak) dengan gerobak PKL; dekati lalu tekan **E** untuk membeli dengan dompet Rp 50.000.
- **Pertandingan sepak bola NPC** 5 vs 5 dengan bola fisika ringan, skor di videotron dan HUD.
- **Pelari di tiap lane** lintasan atletik 400 m (8 lane) plus pejalan/pelari di jalan lingkar dan jogging track.
- **Siklus waktu & cuaca**: matahari bergerak, langit/kabut berubah, malam dengan PJU, floodlight, lampu depan sepeda, bintang; hujan dengan partikel, cipratan, permukaan basah dan genangan reflektif.
- **Gaya cozy stylized**: karakter chibi (12 gaya rambut, wajah, outfit), vegetasi gumpalan, props membulat, palet pastel, bayangan lembut, tekstur prosedural (aspal, paving, beton, rumput, tartan, metal, kayu).
- **Lingkungan detail** berbasis riset: rib putih miring + selembayung, atap Kalzip bergelombang, louvre coklat-emas, 12 gate, tribun 2 tier ±39.000 kursi "pixel" warna-warni (sebagian hilang di tribun utara), lapangan FIFA 105×68, lintasan merah bata, floodlight di lingkar atap, patung serindit, tunnel pemain, plaza paving, tiang bendera, bangku, tong sampah, PJU, pot bunga, pos jaga, pagar, gapura "Selamat Datang", tugu Lancang Kuning + kolam, tugu tanjak, parkir mobil/motor, Jl. Naga Sakti dengan lapak PKL (gerobak, tenda ceper, jagung bakar), danau, sungai + jembatan besi, venue baseball, helipad, amphitheater, lintasan sepatu roda, ±1.000 pohon termasuk pohon muda berajir.

## Kontrol
| Tombol | Aksi |
|---|---|
| W / S | kayuh / rem & mundur |
| A / D | belok kiri / kanan |
| Shift | sprint |
| Space | bel |
| Mouse | lihat sekeliling (klik kanvas untuk pointer lock) |
| V | ganti kamera orang pertama / ketiga |
| E | beli dari pedagang (saat prompt muncul) / tutup dialog |
| M | tampilkan / sembunyikan minimap |
| N | ganti waktu: siang / sore / magrib / malam |
| T | jalankan / hentikan jam (0,25 jam per detik) |
| [ / ] | mundur / maju 1 jam |
| R | hujan / cerah (jalan basah, genangan, kabut) |
| O | ambient occlusion on/off |

## Menjalankan
```bash
npm install
npm run dev
```
Buka `http://localhost:5173` di Chrome/Edge desktop.

Build produksi: `npm run build` (hasil di `dist/`). Deploy otomatis ke GitHub Pages lewat GitHub Actions saat push ke `main`.

## Test
```bash
npm test
```
Unit test (Vitest) mencakup semua logika murni di `src/sim/`: geometri lintasan, fisika sepeda, pelari, AI sepak bola & bola, pedagang & dompet.

## Struktur
```
src/
  core/        App (renderer, loop, minimap), Input, CameraRig, Collider
  config/      constants.js — seluruh dimensi & warna
  sim/         logika murni tanpa THREE.Mesh (unit-tested)
  world/       builder geometri statis: Ground, Landscape, stadium/*, props/*
  entities/    objek bergerak: Bicycle, Runner, Footballer, Vendor, Crowd, Humanoid
  ui/          HUD
docs/
  research/    riset fakta stadion & teknis Three.js
  superpowers/ spec desain & rencana implementasi
```

## Sumber riset
Lihat `docs/research/stadion-utama-riau.md` (Dispora Riau, StadiumDB, Wikipedia, liputan media lokal) dan `docs/research/threejs-teknis.md`.
