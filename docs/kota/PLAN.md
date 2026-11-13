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
| 2026-11-13 | Minta kritik ala kritikus game (grafis, manusia, UI, sistem) + peta harus lebih detail, gedung ikonik dibuat lebih rinci | [../KRITIK.md](../KRITIK.md), bagian Landmark di bawah |

> **Keputusan user 2026-11-13 (D2):** Kota dan mode jalan dikerjakan **seimbang, selang-seling** (1 PR mode jalan : 1 PR Kota).
> Urutan Kota: K4 proxy stadion → K1 bentuk atap → K2 + K3 landmark dan label → kinerja zoom penuh → K6 → K5.
> Usul (belum diputuskan): cincin kedua ditahan sampai kinerja zoom penuh lulus. Gerbang visual diambil di preset Rendah (D3).
> Rincian: [../KRITIK.md](../KRITIK.md) bagian Arah.

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
2. ✅ **Lalu lintas jauh** instans + **bayangan awan** bergerak — `farLife.js`, `groundDetail.js`.
3. ✅ **Lampu jalan nyata** (kota jauh) + bloom malam. ✅ lampu di tile terperinci (jalan kelas besar).
4. ✅ **Tur landmark + slider waktu + Putar waktu** (bar bawah layar saat K; `cityTour.js`, `CityControls.js`). ✅ intro terbang (zoom 9→0,9 ke stadion; setelan `camera.kotaIntro`) dan tombol **Foto** (×2, label & bar disembunyikan).
Keputusan selera sudah dijawab (maket / 16:45 / suara otomatis); lihat vibes/README.md.

## Berikutnya (dampak besar, mudah)
1. ⬜ **Cincin kedua** (±3 → ±6 km, ≈250 tile, ±40 MB?) — pertimbangkan hanya LOD1 + data untuk menghemat; Overpass sering 502/timeout (strip timur butuh 5 percobaan) → bake per strip kecil. [tile-detail]
2. ✅ Lampu jalan di tile terperinci (jalan besar) — ⬜ jalan kecil + kerucut cahaya ke aspal. [tile-detail]
3. ⬜ **Garis tengah & tepi jalan jauh** untuk kelas ≤ tertiary (strip putih tipis, fade jarak). [kota-jauh]
4. ⬜ **Variasi pohon**: 3 jenis (tajuk bulat, palem, pohon peneduh) + batang; ganti geometri di `farCity.js`/`tileDetail.js`. [ganti-model]
5. ⬜ **Peta tanah 4096 dipecah per sel + KTX2 (Basis)** agar tajam saat zoom menengah tanpa melewati anggaran 70 MB; muat per sel terdekat. [kota-jauh]
6. 🔄 **Air**: perahu ✅ (rivers.bin + farLife); ⬜ shader air (riak + pantulan langit). [kota-jauh]

## Landmark (model Blender ringan, ganti lewat resep)
Syarat: lokasi & nama dari OSM/Overture (jangan mengarang), 1 draw call per jenis.
Anggaran (usul kritik 2026-11-13, belum diputuskan user): hero ≤ 5 rb segitiga untuk maksimal 6 model (sebelumnya < 2 rb).
Rincian, akar masalah di kode, dan langkah K1–K8: [../KRITIK.md](../KRITIK.md) bagian 5.
**Urutan kerja dari sisi kode:** K4 proxy stadion (`regions/stadion/proxy.js`) → K1 enum bentuk atap di byte ke-8 rekaman
(`farbake.mjs` + `farCity.js`; bentuk langka = 1 InstancedMesh global) → K2 `far/landmarks.json` dari `names` Overture
(`farFetch.mjs`) → K3 label bertingkat (`CityLabels.js`) → K6 warna kelas → K5 hero Blender menurut peringkat K2.
Akar keterbatasan sekarang: `BUILDING_CLASS` melebur masjid/sekolah/RS/pemerintah ke satu kelas dan nama tidak diambil.

**Tingkat A — hero buatan tangan (urut prioritas)**
- ⬜ A1 **Proxy stadion lebih rinci**: rangka/lengkung atap, tingkat tribun, papan nama, menara lampu (sekarang donat polos) — [stadion-proxy](stadion-proxy/README.md)
- ⬜ A2 Masjid Raya An-Nur (kubah + menara + halaman) — proxy sederhana → model Blender
- ⬜ A3 Rektorat UNRI + gerbang: proxy LOD untuk mode Kota
- ⬜ A4 Jembatan (Siak) — rentang + pilar
- ⬜ A5 Bandara (landasan + terminal)
- ⬜ A6 1–2 gedung ikonik pusat kota — kandidat dari data tinggi Overture + nama OSM (cek dulu)
- ⬜ Identifikasi bangunan bundar berkubah di selatan stadion (tag OSM) sebelum diberi label

**Tingkat B — arketipe otomatis dari tag OSM (generator + instancing)**
- ⬜ Masjid/musala: kubah + menara instans di atas jejak
- ⬜ Gedung tinggi (> ±20 m): podium + menara menyusut, mahkota atap, lampu puncak malam
- ⬜ Mal/ruko besar: atap datar + kotak AC/skylight + papan nama menyala
- ⬜ Sekolah/kampus, rumah sakit, SPBU, pasar: warna atap khas + 1 penanda
- ⬜ Lapangan olahraga: garis lapangan di shader tanah

**Tingkat C — keterbacaan**
- ⬜ Label bertingkat (kawasan → landmark → jalan besar); sekarang hanya 2 label
- ⬜ Warna kelas bangunan lebih berani; tutup tepi peta yang terlihat putih di zoom penuh
- ⬜ Kartu kecepatan diganti nama kawasan + skala selama mode Kota

Lihat [ganti-model](ganti-model/README.md).

## Kinerja & kualitas (cek berkala)
- 🔄 Ukur di GPU asli (`?perf`): draw call target ≤ 600 di pratinjau penuh, segitiga ≤ 3 jt, GPU texture ≤ 70 MB. **Terukur 2026-11-13 (headless d3d11, zoom maksimum): 1.423 draw call, 4,98 jt segitiga, 12 fps → melewati target**; zoom dekat stadion 157 call / 0,43 jt / 30 fps. Tekstur belum diukur.
- ⬜ LOD sel jauh: zoom jauh → sel > 6 km hanya footprint datar tanpa atap (kurangi segitiga).
- ⬜ Frustum/occlusion: bangunan di balik cakrawala dibuang per sel (sudah per-sel via bounding sphere).

## Ditunda
- 🧊 Bake seluruh kota sebagai tile GLB penuh (±130 MB, tidak muat repo/Pages) — diganti kota-jauh instans.
- 🧊 Rotasi/atap bangunan besar (gedung/ruko panjang): atap datar saja dulu.

## Log kerja
| Tanggal | Perubahan | Hasil ukur |
|---|---|---|
| 2026-11-13 | Putaran kritik 1 (tanpa perubahan kode): 10 bidikan GPU + barisan NPC, hasil di `docs/KRITIK.md` (tiap temuan: berkas + perubahan + cara cek, 12 paket kerja); bagian Landmark dipecah jadi tingkat A/B/C + urutan K1–K8 | zoom penuh 1.423 call / 4,98 jt segitiga / 12 fps; titik awal 466 call / 2,17 jt; humanoid 5.546 segitiga |
| 2026-11-13 | Kota jauh v1 (bangunan kotak sejajar sumbu, jalan kelas ≤5, peta tanah) | 380 rb bangunan, 4,7 MB |
| 2026-11-13 | Kota jauh v2 (rotasi, atap pelana, pohon, jalan semua kelas, peta pekat) | 7 MB, 185 rb pohon, 742 berkas |
| 2026-11-13 | Bar kendali Kota: slider jam, Putar waktu (1,2 jam/dtk), Tur (rute tetangga-terdekat, 5,5 dtk/perhentian) | 5 tes murni (`cityTour`); dicek di browser uji, belum di GPU asli |
| 2026-11-13 | **Ukur GPU asli** (user, Radeon iGPU, layar 1396×663 dpr 1,375, tier rendah, batas 30 fps), `?perf`, K aktif [KONTEKS belum tercatat saat itu] | 620 draw call, 1,69 jt segitiga, tekstur 99, 17,7 fps, p50 53 ms, CPU p50 21 ms → **terikat GPU (piksel/efek)**, bukan geometri. Sebelum K: 307 draw call, 633 rb segitiga, 22,7 fps. Tindakan: K di tier rendah memakai rasio render 1,0 (dulu ≤ 1,5); laporan `?perf` kini memuat `konteks` {pov, zoom, jam}. Belum diukur ulang setelahnya |
| 2026-11-13 | Perahu di sungai/kanal (`rivers.bin` 66 KB, 631 jalur; ≤ 300 perahu) | 4 tes murni; satu perahu terlihat di kanal timur laut di browser uji, tanpa galat |
| 2026-11-13 | Lampu jalan tile terperinci (tiang+kepala instans, ≤ 170/tile) | 3 tes murni; dicek malam di browser uji, tanpa galat; draw call +2 per tile berjalan |
| 2026-11-13 | Lampu depan putih/belakang merah mobil jauh (malam) | 1 tes murni; render tanpa galat, warna belum terbedakan di bidikan uji |
| 2026-11-13 | Kontak-AO dasar bangunan jauh (×0,72 di y=0) + pohon jauh bergoyang (`treeSway.js`) | 3 tes murni; shader terkompilasi di browser uji, efek halus (belum dibandingkan sebelum/sesudah) |
| 2026-11-13 | Intro terbang + tombol Foto di bar Kota | dicek di browser uji (intro ya; unduhan PNG tidak terlihat dari sana) |
| 2026-11-13 | Mobil berjalan, lampu jalan nyata, bayangan awan | ≤ 4000 mobil + ≤ 5000 lampu instans; 5 tes murni (`farLife`) |
| 2026-11-13 | Cincin menengah: 4 strip (`tools/citybake --area cincin`) | +92 tile, 157 tile, 22,7 MB; bake 36 menit (Overpass 502, strip timur 5 percobaan; Overture ±5 mnt/area) |
| 2026-11-13 | Lampu malam (`nightGlow.js`, `glow.webp`, lampu sorot proxy) | `glow.webp` ±4 KB; kekuatan jalan 0,38 (tile) / 0,55 (jauh) setelah dicek terlalu terang di 0,6/0,9, peta 2,0, jendela ×2,6 |
| 2026-11-13 | Awan disembunyikan di mode Kota (penyebab kerudung putih); fasad di bangunan jauh | browser uji 20–30 fps (software) |
