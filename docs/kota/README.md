# Kota (pratinjau isometrik + peta seluruh Pekanbaru)

Indeks dokumentasi fitur "Kota". **Satu folder = satu fitur**, supaya model/aset tiap bagian bisa diganti tanpa membaca semuanya.
Rencana hidup ada di [PLAN.md](PLAN.md) — **perbarui di akhir setiap sesi kerja** (status, temuan, keputusan).

| Folder | Isi | Kode utama |
|---|---|---|
| [pratinjau-kamera/](pratinjau-kamera/README.md) | tombol K, kamera isometrik, kontrol, label landmark, HUD bersih, kabut/near-far/resolusi | `src/app/cityPreview.js`, `src/core/PovDirector.js`, `src/ui/CityLabels.js` |
| [tile-detail/](tile-detail/README.md) | 65 tile terperinci (stadion, UNRI, pusat kota): fasad, marka, pohon, tekstur tanah, malam | `src/city/*` (kecuali `farCity.js`), `tools/citybake/` |
| [kota-jauh/](kota-jauh/README.md) | seluruh Pekanbaru di luar tile terperinci: bangunan, jalan, pohon, peta tanah | `src/city/farCity.js`, `tools/citybake/farFetch.mjs`, `farbake.mjs`, `public/far/` |
| [stadion-proxy/](stadion-proxy/README.md) | stadion versi ringan untuk pratinjau | `src/regions/stadion/proxy.js` |
| [vibes/](vibes/README.md) | **suasana**: cahaya, kabut, lalu lintas, malam, suara, kamera sinematik; rencana sprint 3 | `engine/`, `core/postprocessing/`, `world/` (dipakai ulang), `app/cityPreview.js` |
| [ganti-model/](ganti-model/README.md) | **resep mengganti model/aset** per bagian (bangunan, pohon, stadion, landmark, material) | — |

## Aturan dokumen
1. Fakta dari sumber (OSM/Overture/foto) ditandai; tebakan ditandai `[INFERENSI]`. Jangan mengarang nama tempat.
2. Tiap folder fitur punya bagian: **Tujuan · Status · Cara kerja · Format data · Cara mengganti model · Batas/anggaran · Log**.
3. Selesai mengubah fitur → perbarui README fitur itu **dan** `PLAN.md` (centang/geser item, tulis temuan ukur).
4. Angka performa ditulis dengan lingkungan ukurnya (GPU asli vs browser uji software).

## Kondisi umum (2026-11-13)
- Mode Kota (K) jalan; 65 tile terperinci + seluruh kota lewat lapisan jauh (±380 rb bangunan instans).
- Browser uji di sesi AI hanya render software (1–30 fps): **kelancaran di GPU asli belum terukur**.
