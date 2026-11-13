# Vibes — membuat pandangan Kota terasa "ciamik"

## Tujuan
Dari "peta 3D yang benar" ke **"pemandangan yang bikin betah"**: hangat, hidup, punya suasana. Bukan menambah detail geometri
(itu sudah di [tile-detail](../tile-detail/README.md) & [kota-jauh](../kota-jauh/README.md)), tapi **cahaya, warna, kedalaman, gerak, suara**.

## Pilar rasa (urut pengaruh ke kesan)
1. **Cahaya & warna** — golden hour, bayangan panjang, warna hangat vs teduh (split-toning), kabut berwarna.
2. **Kedalaman** — kabut udara berlapis, tilt-shift "maket", vignette lembut, bayangan awan.
3. **Kehidupan** — kendaraan melaju, perahu di Sungai Siak, asap/bendera/pohon bergoyang, awan bergerak.
4. **Malam** — pendar kota, lampu jalan nyata, pantulan di air, bloom (sudah ada `BloomLitePass`).
5. **Suara** — dengung kota makin pelan makin tinggi, angin, burung; transisi siang→malam.
6. **Kamera & penyajian** — intro terbang, tur landmark otomatis, mode foto, label bergaya, jam/waktu mudah diganti.

## Yang SUDAH ada di mesin (pakai ulang, jangan bikin baru)
| Efek | Di mana | Catatan |
|---|---|---|
| Bloom murah, tilt-shift ("efek maket"), vignette, grading per jam | `core/postprocessing/efekLayar.js`, `engine/gradingParams.js`, `App.setBloom/setTiltShift/setVignette/setGrading` | di setelan: Bloom (kartun/facet), Efek maket (mati), Vignette (hanya gaya asli) |
| Gaya grafis asli/kartun/facet | `engine/styleManager.js` (tombol L) | kartun = atmosfer golden hour + kabut berwarna |
| Preset waktu (siang 12, sore 16,5, magrib 18,1, malam 20) | `sim/dayCycle.js` (tombol N) | |
| Mode foto (UI hilang, resolusi tinggi) | `ui/Screenshot.js` | |
| Awan stylized, bintang, bulan, hamburan kabut ke matahari | `world/StylizedClouds.js`, `TimeOfDay.js`, `engine/fogScatter.js` | awan disembunyikan di pratinjau (kubah 4,4 km menutupi kota) |
| Air kartun | `world/shaders/waterToon.js` | belum dipakai di bidang air kota jauh |

## Rencana kerja (usaha S/M/L · dampak ★)
### A. Paket "Sore emas" — kerja paling besar rasanya, murah (S–M)
- ⬜ **Preset pratinjau**: saat K aktif, set jam default 16:45 (bisa diganti), gaya `kartun`, bloom ON, vignette ringan ON, tilt-shift ringan ON (blur tepi atas/bawah ±15%), lalu pulihkan saat keluar. ★★★ S
- ⬜ **Kabut berwarna jarak jauh**: warna kabut = warna langit dekat cakrawala (matahari rendah → oranye-jingga), `FOG_PER_DISTANCE` dicocokkan agar cakrawala menyatu dengan langit, bukan tepi peta. ★★★ S
- ⬜ **Tepi peta halus**: bidang tanah jauh memudar ke warna kabut di batas `bounds` (bukan tepi tajam). ★★ S
- ⬜ **Bayangan panjang**: elevasi matahari preview ≈ 25° (sore) + bayangan sampai 700 m (sudah dinamis); kontak-AO murah pada dasar bangunan jauh (gradien vertex warna gelap di dasar). ★★ M

### B. Kehidupan (M)
- ⬜ **Lalu lintas jauh**: InstancedMesh kotak kecil bergerak sepanjang polyline jalan besar (data `r_*.bin`), kecepatan/kerapatan menurut jam (padat sore, jarang malam), lampu depan/belakang malam. ★★★ M
- ⬜ **Perahu di Sungai Siak** + riak/kilau matahari (shader air jauh memakai `waterToon`). ★★ M
- ⬜ **Bayangan awan bergerak** di tanah (tekstur noise bergeser × kekuatan matahari; awan kubah tetap mati). ★★ S
- ⬜ **Pohon/bendera bergoyang** (pakai `windState` yang ada; vertex shader pada tajuk instans). ★ S
- ⬜ **Burung/layang-layang** kawanan kecil melintas (sprite instans), muncul sore. ★ S

### C. Malam (M)
- ⬜ **Lampu jalan nyata** (titik emisif instans tiap ±40 m di jalan ≥ tertiary) + bloom; ganti pendar rata. ★★★ M  (juga di PLAN.md "Berikutnya" #2)
- ⬜ **Pantulan kota di air** (kilau garis di Sungai Siak). ★★ S
- ⬜ **Kedip jendela/TV** (variasi `facadeHash` terhadap waktu, 1–2% jendela berkedip). ★ S

### D. Suara (M)
- ⬜ **Ambient pratinjau** (`core/AudioBus`, `audioSynth`): dengung kota + angin; volume/lowpass menurut ketinggian kamera (`cityDistance`), malam: jangkrik, siang: lalu lintas. ★★ M

### E. Kamera & penyajian (S–M)
- ⬜ **Intro terbang**: masuk K dari ketinggian tinggi menukik ke stadion (bukan dari posisi pemain). ★★ S
- ⬜ **Tur landmark otomatis** (tombol "Tur"): urutan `travelDestinations` dengan `flyTo`, jeda 4 dtk, jam berganti halus siang→malam. ★★★ M
- ⬜ **Slider waktu** di panel pratinjau + tombol "Time-lapse" (jam berjalan cepat). ★★ S
- ⬜ **Label bergaya** (jam/cuaca kecil di sudut, kompas arah putar). ★ S
- ⬜ **Mode foto Kota**: sembunyikan label, resolusi ×2, tanda air kecil. ★★ S (`Screenshot.js` ada)

### F. Varian gaya (L, opsional — butuh keputusan selera)
- ⬜ **"Maket"** (diorama): bingkai/alas kotak di tepi peta + tilt-shift kuat + warna jenuh.
- ⬜ **"Peta kartun"**: outline tebal (`OutlinePass` sudah ada) + warna datar.
- ⬜ **"Neon malam"**: grading ungu-biru + bloom kuat + pendar jalan magenta/cyan.

## Keputusan selera yang dibutuhkan dari kamu
1. Arah utama: **Sore emas hangat** (rekomendasi), **Maket/diorama**, atau **Neon malam**?
2. Pratinjau default jam berapa? (rekomendasi 16:45; atau ikut jam permainan)
3. Boleh suara ambient otomatis menyala saat K? (ada tombol mute)

## Urutan kerja yang disarankan (sprint 3)
1. A (preset + kabut + tepi halus) → bidikan sebelum/sesudah di 4 jam (12, 16:45, 18:10, 21).
2. B-lalu lintas + bayangan awan → terasa hidup.
3. C-lampu jalan nyata (+ bloom) → malam memukau.
4. E-tur & intro → siap dipamerkan; lalu D suara.

## Kriteria jadi (acceptance)
- 4 bidikan (siang, sore, magrib, malam) dari 3 jarak (dekat 300 m, sedang 1,5 km, seluruh kota) dibaca & disetujui kamu.
- ≥ 30 fps di GPU kamu (laporan `?perf`), draw call ≤ 700 di pratinjau penuh, tekstur GPU ≤ 70 MB.
- Semua efek bisa dimatikan satu per satu (setelan) dan pulih bersih saat keluar K.

## Anggaran & risiko
- Post-efek (bloom, tilt-shift) memakan fill-rate: uji di resolusi 1,5× (pratinjau memaksanya); sediakan sakelar "Hemat" yang mematikannya.
- Lalu lintas: ≤ 3 rb instans aktif (pilih dari jalan sekitar kamera), bukan seluruh kota.
- Jangan menambah tekstur besar; semua pola prosedural/shader (pelajaran dari kerudung awan: **uji tiap lapisan transparan dari jarak jauh**).

## Log
- 2026-11-13: dokumen dibuat dari permintaan "bikin view-nya ciamik vibes-nya". Belum ada pekerjaan.
