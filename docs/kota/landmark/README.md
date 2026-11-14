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
| LOD0 | dist ≤ 1300 m (zoom ≲ 1) | 2.918 segitiga, 200 KB |
| LOD1 | ≤ 2800 m (zoom ≲ 2,1) | 1.051, 78 KB |
| LOD2 | lebih jauh | 330, 25 KB |

## Status
- ✅ An-Nur (2026-11-14): jejak 61×73 m dari OSM `way 465323008`, pusat (6823,0; −4760,1), depan ke plaza ESE (citra satelit). Bentuk detail `[INFERENSI]`: tinggi kubah ±38 m, menara ±54 m, 10 kubah = 1 utama + 1 depan + 4 samping + 4 puncak menara.
- Belum: bangunan tile/jauh di bawah jejak masih ada (tertutup model; tidak terlihat z-fighting di bidikan siang); malam belum dicek; warna dinding/atap belum dicocokkan dengan foto.
