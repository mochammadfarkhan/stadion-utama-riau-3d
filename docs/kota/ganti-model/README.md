# Resep mengganti model/aset Kota

Semua bentuk kota dibuat prosedural/instans supaya mudah ditukar. Tabel: **apa → di mana → cara → bake ulang?**

| Bagian | Berkas | Cara ganti | Bake ulang? |
|---|---|---|---|
| Bentuk bangunan jauh (kotak, pelana) | `src/city/farCity.js` (`wallsGeometry`, `flatRoofGeometry`, `gableRoofGeometry`) | ganti geometri satuan (alas y=0, tinggi 1, footprint 1×1 pusat di origin; bubungan sepanjang x) | tidak |
| Warna bangunan jauh | `FAR_COLORS`, `FAR_CLASS_TINT` | ubah nilai | tidak |
| Aturan atap pelana jauh (kapan pelana) | `tools/citybake/farbake.mjs` (`gable`) | ubah ambang luas/aspek | ya: `node tools/citybake/farbake.mjs` (±15 dtk) |
| Pohon jauh | `crownGeometry` (`farCity.js`) | geometri satuan tinggi 1 (alas y≈0,15), warna per vertex | tidak |
| Kepadatan pohon jauh | `FAR.treeStep`, `FAR.treeKeep` (`farbake.mjs`) | ubah | ya |
| Pohon tile | `createTreeGeometry` (`src/city/tileDetail.js`), `TREES` | geometri satuan tinggi 1 | tidak |
| Marka jalan | `MARKING` (`tileDetail.js`) | ubah dash/gap/lebar | tidak |
| Fasad (jendela/kios/genteng) | `src/city/facade.js` | ubah konstanta shader | tidak |
| Tekstur/variasi tanah | `src/city/groundDetail.js`; peta jauh: warna di `farbake.mjs` (`COVER_COLOR`, `BASE_COLOR`) | ubah | peta jauh: ya |
| Bangunan tile (dinding/atap) | `tools/citybake/geometry/buildings.js` | ubah generator | ya: `npm run bake` (butuh jaringan/cache `data-src`) |
| Stadion pratinjau | `src/regions/stadion/proxy.js` | lihat [stadion-proxy](../stadion-proxy/README.md) | tidak |
| Landmark hero (Masjid, jembatan, dll.) | belum ada — lihat di bawah | | |

## Menambah landmark hero (model Blender) — rencana
Prasyarat fakta: koordinat + nama dari OSM/Overture (`[INFERENSI]` bila tidak). Langkah:
1. Model Blender `assets-src/blender/<nama>.py` → GLB ringan (< 2 rb segitiga, 1 material vertex color) di `public/models/`.
2. Daftar di data landmark (rencana: `src/city/landmarks.js`: `{id, glb, x, z, yaw, scale}`), dimuat oleh `farCity` (`setActive`) sebagai satu InstancedMesh per jenis.
3. Hilangkan kotak bangunan jauh yang menimpa (filter di `farbake.mjs` memakai daftar `id` landmark, atau gambar di atasnya).
4. Perbarui [PLAN.md](../PLAN.md) bagian Landmark + folder fitur ini.

## Anggaran model
Segitiga/instans ≤ 28 (pohon) · ≤ 14 (rumah) · landmark ≤ 2 rb · draw call tambahan ≤ 1 per jenis · GPU texture total ≤ 70 MB.
