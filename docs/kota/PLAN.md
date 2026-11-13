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

## Sprint 2 (selesai 2026-11-13): cincin menengah + lampu malam
- ✅ **Cincin menengah**: 92 tile OSM+Overture baru di sekeliling stadion (±1,5 → ±3 km; 4 strip `cincin-utara/selatan/barat/timur`), manifest 65 → 157 tile, 22,7 MB — [tile-detail](tile-detail/README.md)
- ✅ Bangunan kota jauh di zona cincin dibuang otomatis (bake far ulang: 380 rb → 354 rb bangunan) — [kota-jauh](kota-jauh/README.md)
- ✅ **Lampu malam**: pendar jalan (tile + jauh), peta pendar kota jauh (`glow.webp`), jendela lebih terang & tetap menyala dari jauh, lampu sorot proxy stadion — [kota-jauh](kota-jauh/README.md), [stadion-proxy](stadion-proxy/README.md)

## Sprint 3 (rencana): vibes "ciamik" — lihat [vibes/README.md](vibes/README.md)
1. ✅ Paket **Maket sore emas** (keputusan user: maket + 16:45 + suara otomatis): preset (jam, bloom, tilt-shift kuat), alas diorama berlapis, suara ambient — [vibes](vibes/README.md). ⬜ sisa: kabut berwarna menyatu dengan langit, kontak-AO dasar bangunan.
2. ⬜ **Lalu lintas jauh** instans + **bayangan awan** bergerak.
3. ⬜ **Lampu jalan nyata** + bloom malam.
4. ⬜ **Intro terbang + tur landmark + slider waktu**, lalu suara ambient.
Keputusan selera sudah dijawab (maket / 16:45 / suara otomatis); lihat vibes/README.md.

## Berikutnya (dampak besar, mudah)
1. ⬜ **Cincin kedua** (±3 → ±6 km, ≈250 tile, ±40 MB?) — pertimbangkan hanya LOD1 + data untuk menghemat; Overpass sering 502/timeout (strip timur butuh 5 percobaan) → bake per strip kecil. [tile-detail]
2. ⬜ **Lampu jalan nyata** (titik emisif instans tiap ±40 m di jalan ≥ tertiary) menggantikan pendar rata; bayangan lampu. [tile-detail, kota-jauh]
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
| 2026-11-13 | Cincin menengah: 4 strip (`tools/citybake --area cincin`) | +92 tile, 157 tile, 22,7 MB; bake 36 menit (Overpass 502, strip timur 5 percobaan; Overture ±5 mnt/area) |
| 2026-11-13 | Lampu malam (`nightGlow.js`, `glow.webp`, lampu sorot proxy) | `glow.webp` ±4 KB; kekuatan jalan 0,38 (tile) / 0,55 (jauh) setelah dicek terlalu terang di 0,6/0,9, peta 2,0, jendela ×2,6 |
| 2026-11-13 | Awan disembunyikan di mode Kota (penyebab kerudung putih); fasad di bangunan jauh | browser uji 20–30 fps (software) |
