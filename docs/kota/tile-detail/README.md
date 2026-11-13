# Tile terperinci (65 tile OSM: stadion, UNRI, pusat kota)

## Tujuan
Detail penuh di area inti; dipakai juga saat bermain biasa (LOD0 ≤ 600 m). Pratinjau memuat semua 65 tile LOD0 (284 rb segitiga).

## Status (2026-11-13)
✅ fasad jendela/kios/genteng (shader) ✅ jendela menyala malam ✅ marka jalan ✅ pohon instans ✅ variasi tanah (shader).
✅ cincin menengah (4 strip, ±1,5 → ±3 km; 157 tile total, 22,7 MB).
⬜ cincin kedua & lampu jalan nyata — [PLAN.md](../PLAN.md).

## Cara kerja
- Data bake: `tools/citybake` (OSM + Overture) → `public/tiles/{ix}_{iz}.lod{0,1}.glb` + `.data.json` + `manifest.json` (500 m/tile).
- Klien: `ChunkStreamer` (aksi muat/lepas, `setPreview` = semua tile LOD0) → `TileLoader` (GLB + `decorate`) → `TileCollider`.
- Material (`cityMaterials.js`): `buildings_walls/roofs` ← `facade.js`; `landuse/roads/ground` ← `groundDetail.js`; `road_markings`, `trees` ← `tileDetail.js`.
- `tileDetail.js` (murni+THREE): `markingQuads` (garis tengah putus-putus ≥ 5,5 m, garis tepi jalan besar), `treePoints` (deret tepi jalan + sebaran halaman, tolak bangunan/air/jalan/`reserved`).
- `reserved(x,z)` dari `main.js`: mask stadion + region hero → tanpa pohon/marka kota (isi region sendiri).

## Menambah/menyegarkan area (cincin)
- Area di `tools/citybake/config.js::AREAS`; area persegi panjang pakai `rect` (dunia, m), `skipAreas` membuang tile milik area lain.
- `node tools/citybake --area cincin` (4 strip) atau satu per satu `--area cincin-utara`. Cache OSM di `data-src/osm/<area>.json`, Overture di `data-src/overture/<area>.geojson`
  (di-.gitignore) → bake ulang berikutnya cepat dan dapat `--offline`.
- Overpass sering 502/timeout (retry 15→30→60→120 dtk); satu strip kecil per permintaan menjaga peluang berhasil. Overture ±5 menit/area.
- Setelah menambah tile: **jalankan `node tools/citybake/farbake.mjs`** agar bangunan kota jauh di zona itu dibuang (tidak dobel).

## Format data
Lihat "Format tile v1" (`src/city/tileData.js`): koordinat tile desimeter; `buildings[{h,ring}]`, `roads[{cls,w,pts,name?}]`, `water`, `waterways`.

## Cara mengganti model
- Bentuk bangunan = hasil bake (`tools/citybake/geometry/buildings.js`: dinding + atap datar/pelana). Ganti gaya atap/ukuran pelana di situ lalu `npm run bake`.
- Pohon: `createTreeGeometry()` di `tileDetail.js` (satu geometri ±28 segitiga, skala per instans).
- Rincian fasad: konstanta di `facade.js` (jarak jendela 3 m, lantai 3,2 m, warna kaca/kios).
Lihat [ganti-model](../ganti-model/README.md).

## Batas / anggaran
Pohon ≤ 420/tile; marka ≈ 24 rb quad total; draw call tile ≈ 5 mesh + marka + pohon per tile.

## Log
- 2026-11-13: marka, pohon, groundDetail, fasad, jendela malam masuk `main` (PR #24).
