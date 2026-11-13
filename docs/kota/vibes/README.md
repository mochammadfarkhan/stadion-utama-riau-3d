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
### A. Paket "Maket sore emas" — kerja paling besar rasanya, murah (S–M)
- ✅ **Preset pratinjau** (2026-11-13): saat K aktif → jam 16:45, bloom ON, tilt-shift KUAT (pita tajam `band 0,17`, `falloff 0,3`, radius ×1,6), lalu dipulihkan saat keluar. Sakelar: setelan Kamera "Pratinjau Kota (K): gaya maket sore emas" (default ON). `app/cityPreview.js::applyMaket`.
- ✅ **Alas diorama**: irisan tanah berlapis (rumput → tanah → liat → batuan, 900 m) di keempat tepi peta kota jauh (`farCity.js::slabGeometry`). Terlihat saat zoom jauh.
- ✅ **Suara ambient otomatis** (dibawa maju dari D): dengung kota + angin prosedural (`audioSynth.cityHumBuffer/windBuffer`, `AudioBus.startCityHum/startWind`), volume menurut ketinggian & malam, kanal 'ambience'. Sakelar: setelan Kamera "suara ambient".
- ⬜ Vignette ringan & warna lebih jenuh (grading dioverride styleManager; butuh hook) ★ S
- ✅ ~~Kabut berwarna jarak jauh~~ — dicek 2026-11-13: warna kabut = latar langit (`fogColor`) dan cakrawala tak pernah masuk bingkai di sudut 35°, tepi atas memudar mulus; tak perlu kode. (rencana lama: warna kabut = warna langit dekat cakrawala (matahari rendah → oranye-jingga), `FOG_PER_DISTANCE` dicocokkan agar cakrawala menyatu dengan langit, bukan tepi peta.)
- ✅ ~~Tepi peta halus~~ → digantikan alas diorama (gaya maket memang ingin tepi tegas).
- ⬜ **Bayangan panjang**: elevasi matahari preview ≈ 25° (sore) + bayangan sampai 700 m (sudah dinamis); kontak-AO murah pada dasar bangunan jauh ✅ (`farCity.js::baseShade`, ×0,72 di dasar; gradasi linear sampai puncak, jadi gedung tinggi ikut sedikit gelap [INFERENSI: perlu dilihat di GPU asli]). ★★ M

### B. Kehidupan (M)
- ✅ **Lalu lintas jauh** (2026-11-13, `src/city/farLife.js`): ≤ 4000 mobil kotak (10 segitiga) bergerak sepanjang polyline jalan ≤ tertiary dalam radius R dari fokus (R = 0,9 × jarak kamera, 450–3600 m); posisi = fungsi waktu murni (tanpa state), lajur kiri, kecepatan/kerapatan menurut jam (`trafficDensity`: puncak 07–09 & 16–19, malam 0,2), pendar hangat malam. Mobil ×1,8 dari ukuran asli agar terbaca dari udara (gaya maket). ⬜ lampu depan putih/belakang merah terpisah.
- ⬜ **Perahu di Sungai Siak** + riak/kilau matahari (shader air jauh memakai `waterToon`). ★★ M
- ✅ **Bayangan awan bergerak** (`groundDetail.js`, uniform `GROUND_UNIFORMS.uCloudT/uCloudAmt`): bercak ±1,4 km bergeser searah angin, gelap 20%, hilang malam & jauh > 9 km. Berlaku di tanah tile + kota jauh.
- ✅ **Pohon jauh bergoyang** (`city/treeSway.js`, vertex shader instans, fase dari posisi; waktu dari sistem `city.stream`). ⬜ pohon di tile terperinci, bendera, `windState` nyata.
- ⬜ **Burung/layang-layang** kawanan kecil melintas (sprite instans), muncul sore. ★ S

### C. Malam (M)
- ✅ **Lampu jalan nyata** (`farLife.js::lampSpots`): kepala lampu emisif tiap ±45 m bergantian kiri/kanan sepanjang jalan ≤ tertiary (≤ 5000), tampil hanya malam, ikut bloom. ⬜ lampu jalan di dalam tile terperinci (jalan OSM kecil), kerucut cahaya ke aspal.
- ⬜ **Pantulan kota di air** (kilau garis di Sungai Siak). ★★ S
- ⬜ **Kedip jendela/TV** (variasi `facadeHash` terhadap waktu, 1–2% jendela berkedip). ★ S

### D. Suara (M)
- ✅ (dasar) Ambient pratinjau — lihat paket A. ⬜ Variasi: jangkrik malam, burung sore, klakson jauh.
- ⬜ ~~Ambient pratinjau~~ (`core/AudioBus`, `audioSynth`): dengung kota + angin; volume/lowpass menurut ketinggian kamera (`cityDistance`), malam: jangkrik, siang: lalu lintas. ★★ M

### E. Kamera & penyajian (S–M)
- ✅ **Intro terbang** (`cityPreview.js::enter`): zoom 9 → 0,9 menukik ke stadion; setelan Kamera "intro terbang" (default ON); input apa pun membatalkan.
- ✅ **Tur landmark otomatis** (2026-11-13, tombol "Tur"): `tourRoute` (tetangga terdekat dari stadion, ≤ 9 perhentian) + `flyTo` tiap 5,5 dtk; bisa dipadukan dengan Putar waktu. Belum menghentikan diri saat user menggeser manual (matikan lewat tombol).
- ✅ **Slider waktu + "Putar waktu"** (bar di bawah layar, `ui/CityControls.js`; 1,2 jam/dtk). Jam asli dipulihkan saat keluar K (lewat `restoreMaket`).
- ⬜ **Label bergaya** (jam/cuaca kecil di sudut, kompas arah putar). ★ S
- ✅ **Mode foto Kota**: tombol Foto di bar → `captureScreenshot` ×2, label & bar disembunyikan (`body.is-photo`). ⬜ tanda air kecil.

### F. Varian gaya (L, opsional — butuh keputusan selera)
- ⬜ **"Maket"** (diorama): bingkai/alas kotak di tepi peta + tilt-shift kuat + warna jenuh.
- ⬜ **"Peta kartun"**: outline tebal (`OutlinePass` sudah ada) + warna datar.
- ⬜ **"Neon malam"**: grading ungu-biru + bloom kuat + pendar jalan magenta/cyan.

## Keputusan selera (2026-11-13, dijawab user)
1. **Arah utama: Maket/diorama** (bukan sore emas polos / neon). Sore emas tetap jadi pencahayaannya.
2. **Jam default pratinjau: 16:45** (jam permainan dipulihkan saat keluar).
3. **Suara ambient: otomatis** saat K (volume mengikuti slider "Suasana"; bisa dimatikan di setelan Kamera).
Dampak ke rencana: paket A diganti jadi **"Maket sore emas"** (tilt-shift kuat + alas diorama + warna), varian F-"Maket" naik jadi utama.

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
- 2026-11-13: dokumen dibuat dari permintaan "bikin view-nya ciamik vibes-nya".
- 2026-11-13: sprint 3b — lalu lintas jauh, lampu jalan nyata, bayangan awan (`farLife.js`, `groundDetail.js`).
- 2026-11-13: keputusan selera (maket / 16:45 / suara otomatis) → paket A diimplementasi: preset maket, alas diorama, suara ambient.
