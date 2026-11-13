# Kota jauh (seluruh Pekanbaru di luar tile terperinci)

## Tujuan
Pratinjau (K) menampilkan **seluruh kota** tanpa bake tile GLB penuh (±130 MB). Bangunan kecil = instans; tanah = satu peta WebP.

## Status (2026-11-13)
v2 jalan: bangunan diputar + atap pelana, pohon, jalan semua kelas, peta tanah pekat. Kelancaran GPU asli belum terukur.
Zona cincin menengah (tile terperinci) dikecualikan otomatis (bake membaca `public/tiles/manifest.json`; 354 rb bangunan setelah cincin). Detail tersisa → [PLAN.md](../PLAN.md) (jendela di bangunan jauh, garis jalan, air, KTX2 per sel).

## Cara kerja
1. `node tools/citybake/farFetch.mjs [bangunan|jalan|air|lahan]` — DuckDB menarik Overture Maps (rilis di `config.js`) untuk kotak kota
   (`KOTA_BBOX`) → CSV di `data-src/overture-kota/` (di-.gitignore; ±5 menit/query; bangunan ±80 MB karena menyertakan geometri).
2. `node tools/citybake/farbake.mjs` (±15 dtk) — CSV → `public/far/` (di-commit):
   - bangunan: kotak terorientasi dari jejak (sisi dominan, ekstrem terputar, diskalakan ke luas asli), bangunan di dalam 65 tile terperinci dibuang;
   - jalan: polyline per sel; pohon: titik grid 44 m pada piksel hijau peta tanah; peta tanah: SVG → sharp → WebP.
3. Klien `src/city/farCity.js` dimuat malas saat K pertama (`city.setPreview(true)` di `src/city/index.js`), 6 unduhan paralel, sel terdekat stadion dulu.

## Format data (`public/far/`)
| Berkas | Isi |
|---|---|
| `manifest.json` | `version: 2`, `cell: 2000`, `bounds` (dunia, m), `ground`, `cells[{key,ix,iz,nb,nr,nt}]` |
| `b_{ix}_{iz}.bin` | 10 B/bangunan: u16 x, u16 z (dm dari sudut sel), u8 lebar, u8 dalam, u8 tinggi (0,5 m), u8 kelas, u8 rotasi `(θ+π/4)/(π/2)·255`, u8 bendera (bit0 = pelana) |
| `r_{ix}_{iz}.bin` | berurutan `[u8 kelas, u16 n, n×(i16 x, i16 z dm)]` |
| `t_{ix}_{iz}.bin` | 5 B/pohon: u16 x, u16 z (dm), u8 tinggi (0,5 m) |
| `ground.webp` | peta tanah 2048² untuk `bounds` (baris 0 = utara) |
Kelas bangunan: 0 lain · 1 niaga · 2 industri · 3 publik/ibadah · 4 hunian. Kelas jalan: `ROAD_INDEX` di `farbake.mjs`.
Koordinat dunia: +X timur, +Z selatan (meter); sel = lantai(x/2000), lantai(z/2000).

## Lampu malam (2026-11-13)
- `src/city/nightGlow.js`: emisi hangat × `uNight` (jam permainan → `nightFactor`, `facade.js`).
  - **Jalan jauh & jalan tile**: pendar rata (lampu jalan) — `strength` 0,55 (jauh) / 0,38 (tile) di `farCity.js` / `cityMaterials.js`.
  - **Peta tanah jauh**: `glow.webp` (512², 1 kanal, ±4 KB; kerapatan bangunan diburamkan) dibaca `uGlowMap` pada `vMapUv` → kawasan padat bersinar dari jauh (`strength` 2,0).
  - **Jendela bangunan jauh**: ikut shader fasad (`facade.js`), sebagian menyala; jauh pun tetap ≥ 60% (fade pola tidak mematikan cahaya).
- `manifest.glow` opsional: tanpa berkas → hanya pendar jalan/jendela.

## Alas diorama
`slabGeometry` (farCity.js): dinding irisan tanah berlapis (`SLAB_STRATA`: rumput 45 m, tanah 260, liat 560, batuan 900) di empat tepi `bounds`; 1 mesh, 16 quad. Ganti warna/ketebalan di `SLAB_STRATA`.

## Cara mengganti model
Lihat [ganti-model](../ganti-model/README.md). Ringkas: bentuk bangunan di `wallsGeometry/flatRoofGeometry/gableRoofGeometry` (`farCity.js`),
pohon di `crownGeometry`, warna di `FAR_COLORS`/`FAR_CLASS_TINT`/`FAR_ROAD_COLORS`. Data (rotasi, kelas) tidak perlu di-bake ulang bila hanya mengganti geometri/warna.

## Batas / anggaran
- ±380 rb bangunan (10 segitiga flat / ±14 pelana) + 185 rb pohon (8 segitiga) ≈ 5–6 jt segitiga bila SEMUA terlihat (zoom terjauh); per-sel frustum culling.
- GPU texture: peta tanah 2048² ≈ 22 MB (RGBA + mip). Anggaran total 70 MB.
- Bangunan < 18 m² dibuang; tinggi kosong ditebak dari luas `[INFERENSI]`.

## Log
- 2026-11-13 v1: kotak sejajar sumbu, jalan ≤ unclassified.
- 2026-11-13 v2.1: fasad jendela di bangunan jauh (`applyFacade` + dukungan `instanceMatrix`), tajuk pohon lebih gemuk.
- 2026-11-13 v2: rotasi, pelana, pohon, semua kelas jalan, peta lebih pekat; fog pratinjau 14×jarak.
