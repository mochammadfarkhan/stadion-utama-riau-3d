# Rencana Kota (hidup — perbarui tiap sesi)

Legenda: ✅ selesai · 🔄 sedang/perlu cek · ⬜ belum · 🧊 ditunda (alasan ditulis)
Urutan = prioritas dampak ÷ usaha. Tiap item menunjuk folder fiturnya.

## Masukan user (kronologis, jangan dihapus)
| Tanggal | Masukan | Ditangani di |
|---|---|---|
| 2026-11-12 | Mode preview kota isometrik dari atas; model berat diganti model dasar (stadion) | pratinjau-kamera, stadion-proxy |
| 2026-11-12 | Rumah & ruko perlu dimodel sedikit; harus bisa load semua peta; kenapa buram | tile-detail, kota-jauh |
| 2026-11-13 | Tambah pohon dan marka jalan | tile-detail |
| 2026-11-13 | Tekstur belum merata, bisa dikompres karena dilihat dari jauh; belum seluruh Pekanbaru, bangunan kecil boleh di-instans | kota-jauh |
| 2026-11-13 | Detail baru sekitar stadion; di luar itu bangunan masih putih, jalan belum jelas; minta rencana .md per folder per fitur yang terus diperbarui | semua folder, PLAN ini |

## Sekarang (sprint 1: "luar stadion tidak boleh putih")
- ✅ Kota jauh v2: bangunan diputar mengikuti jejak asli, rumah kecil beratap pelana merah, atap datar abu, tint per kelas — [kota-jauh](kota-jauh/README.md)
- ✅ Pohon jauh 185 rb instans dari titik hijau peta tanah — [kota-jauh](kota-jauh/README.md)
- ✅ Jalan jauh semua kelas (termasuk residential), aspal gelap per kelas — [kota-jauh](kota-jauh/README.md)
- ✅ Peta tanah lebih pekat (saturasi +20%, dasar hijau, air biru tua) — [kota-jauh](kota-jauh/README.md)
- ✅ **Penyebab "putih" ditemukan**: kubah awan `awanStylized` (4,4 km, mengikuti kamera) menutup kota di luar radius 2,2 km dengan kerudung transparan → awan disembunyikan selama mode Kota — [pratinjau-kamera](pratinjau-kamera/README.md)
- ✅ Fasad jendela/kios di bangunan jauh (shader `facade.js` sadar instans; memudar 0,9–3,5 km) — [kota-jauh](kota-jauh/README.md)
- ✅ Tajuk pohon jauh lebih gemuk (tidak seperti berlian)
- 🔄 Cek visual di luar tile terperinci (butuh GPU asli untuk kelancaran)

## Berikutnya (dampak besar, mudah)
1. ⬜ **Cincin menengah**: bake tile terperinci (OSM penuh) di sekitar stadion→pusat sampai ±3 km (≈144 tile, ±20 MB) lewat `tools/citybake` — batas "detail hanya di sekitar stadion" bergeser jauh. [tile-detail]
2. ⬜ **Jendela menyala malam (lampu jalan jauh; jendela bangunan jauh sudah ikut `uNight`) di bangunan jauh** + lampu jalan jauh (titik emisif instans). [kota-jauh]
3. ⬜ **Garis tengah & tepi jalan jauh** untuk kelas ≤ tertiary (strip putih tipis, fade jarak). [kota-jauh]
4. ⬜ **Variasi pohon**: 3 jenis (tajuk bulat, palem, pohon peneduh) + batang; ganti geometri di `farCity.js`/`tileDetail.js`. [ganti-model]
5. ⬜ **Peta tanah 4096 dipecah per sel + KTX2 (Basis)** agar tajam saat zoom menengah tanpa melewati anggaran 70 MB; muat per sel terdekat. [kota-jauh]
6. ⬜ **Air**: shader air untuk Sungai Siak (riak + pantulan langit) di peta tanah/bidang air. [kota-jauh]

## Landmark (model Blender ringan, ganti lewat resep)
Syarat: lokasi & nama dari OSM/Overture (jangan mengarang), model < 2 rb segitiga, 1 draw call per jenis.
- ⬜ Masjid Raya An-Nur (kubah+menara) — proxy sederhana → model Blender
- ⬜ Jembatan (Siak) — rentang + pilar
- ⬜ Bandara, mal besar, gedung tertinggi — kandidat dari data tinggi Overture (cek dulu)
Lihat [ganti-model](ganti-model/README.md).

## Kinerja & kualitas (cek berkala)
- ⬜ Ukur di GPU asli (`?perf`): draw call target ≤ 600 di pratinjau penuh, segitiga ≤ 3 jt, GPU texture ≤ 70 MB.
- ⬜ LOD sel jauh: zoom jauh → sel > 6 km hanya footprint datar tanpa atap (kurangi segitiga).
- ⬜ Frustum/occlusion: bangunan di balik cakrawala dibuang per sel (sudah per-sel via bounding sphere).

## Ditunda
- 🧊 Bake seluruh kota sebagai tile GLB penuh (±130 MB, tidak muat repo/Pages) — diganti kota-jauh instans.
- 🧊 Rotasi/atap bangunan besar (gedung/ruko panjang): atap datar saja dulu.

## Log kerja
| Tanggal | Perubahan | Hasil ukur |
|---|---|---|
| 2026-11-13 | Kota jauh v1 (bangunan kotak sejajar sumbu, jalan kelas ≤5, peta tanah) | 380 rb bangunan, 4,7 MB |
| 2026-11-13 | Kota jauh v2 (rotasi, atap pelana, pohon, jalan semua kelas, peta pekat) | 7 MB, 185 rb pohon, 742 berkas |
| 2026-11-13 | Awan disembunyikan di mode Kota (penyebab kerudung putih); fasad di bangunan jauh | browser uji 20–30 fps (software) |
