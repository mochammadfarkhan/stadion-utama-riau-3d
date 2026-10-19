# Plan M8: Tampilan "Cozy Diorama" — tekstur PBR nyata, atmosfer, air, pohon, penataan

Tanggal: 2026-10-19 (revisi 2 setelah audit tekstur) · Acuan visual dari user: (1) game perahu top-down, (2) pulau heksagon diorama,
(3) game sepeda Canggu Bali (golden hour). Keluhan user: **"texture kita burik banget."** Plan ini memperbaiki akar masalahnya.

## 0. Diagnosis (fakta, dari audit kode dan acuan)

**Kenapa tekstur kita burik** (`src/world/textures/noise.js`, `surfaces.js`):
- Semua tekstur dibuat dari **noise prosedural**: peta warna 512², normal 256², "noise halus, kontras rendah" (komentar kode sendiri),
  hanya **7 jenis** (aspal, paving, beton, rumput, tartan, alur seng, kayu). Tidak ada foto/PBR, tidak ada roughness yang bervariasi,
  tidak ada AO, tidak ada variasi makro. Hasilnya rata dan seperti plastik.
- Tanah kampus: 3 bobot (rumput/tanah/basah) memakai tekstur noise yang sama berulang tiap 4 m → pola berulang terlihat.
- GLB hero (gedung, pohon, motor) hanya warna rata tanpa UV/tekstur; pohon = gumpalan polos; kit gedung = atlas jendela + warna rata.
- Pencahayaan datar: ambient rendah, tanpa hamburan atmosfer, sorotan tidak bercahaya.

**Kenapa ketiga acuan terlihat bagus** (dari pengamatan screenshot; bukan klaim tentang kode mereka):
- *Bali:* ±60% dampaknya dari **cahaya**: matahari rendah keemasan, bloom/silau di sekitar matahari, kabut hangat yang menebal ke jauh
  (warna kabut condong ke arah matahari), pasir basah **berkilau** (roughness rendah + pantulan matahari sudut rendah), busa ombak
  putih, siluet palem dengan daun alpha bertekstur nyata, tone mapping filmik. Tekstur pasir/tanah punya normal dan variasi makro.
- *Perahu:* palet terbatas, air bergradasi, tekstur kayu/batu **dilukis dengan variasi per papan**, bayangan kontak, benda kecil.
- *Pulau heksagon:* bentuk diorama bersih, air biru berlapis, cahaya hangat-sejuk, UI selaras.
Kesimpulan: bagusnya = **tekstur PBR berkualitas + variasi makro + cahaya/atmosfer + air + penataan**, bukan jumlah poligon.

## 1. Prinsip (mengikat)
- Semua fase aktif lewat `gayaGrafis` (agen kamera/gaya yang sedang berjalan: `asli | kartun | facet`); mode asli tidak berubah.
  Tekstur PBR baru dipakai di `kartun`; `facet` memakai versi tanpa normal/ORM.
- **Proses ringan** (preferensi user): satu implementer per fase, tanpa review per task, jangan berhenti bertanya, lapor di akhir. Tes hanya
  untuk logika berisiko (matematika, data, bake). **Gerbang visual** tiap fase: screenshot asli vs baru di titik yang sama, dibaca
  sendiri, perbaiki yang rusak, simpan `docs/screenshots/kartun/`.
- **Anggaran memori GPU:** total tekstur ≤ **70 MB** (cek `renderer.info.memory.textures` + hitungan byte); varian 256 untuk perangkat
  lemah (pilih otomatis lewat `adaptiveResolution`/pengaturan kualitas). **Anggaran waktu frame:** kartun ≤ +8% dari asli;
  fragment tanah ≤ 8 sampel tekstur rata-rata. Urutan pemangkasan bila melebihi: detail normal jauh → anti-tiling → bloom → tilt-shift
  → kartu daun.
- Lisensi: hanya **CC0** (ambientCG, Poly Haven); catat sumber di `public/textures/ATTRIBUTION.txt` dan README.

## 2. Urutan
**T1 → (T2 ∥ P1) → T3 → (T4 ∥ P2) → P5 → P6 → P7.** Perkiraan kerja agen mode ringan (kasar): T1 30–40 mnt, T2 35–50, P1 25–35, T3 35–50,
T4 35–50, P2 25–40, P5 30–45, P6 20–30, P7 15–20. **Dampak visual terbesar per menit: T1+T2+P1** (tanah, cahaya, warna).

---

## T1. Pipeline tekstur PBR nyata (fondasi, wajib pertama)
**Sumber (CC0, ambientCG; ukuran zip 1K-JPG sudah dicek lewat API 2026-10-19):** kandidat per kategori. Implementer boleh menukar ID
dalam kategori yang sama setelah melihat pratinjau di ambientCG; hasil akhir dicatat di ATTRIBUTION.

| Kategori | Kandidat (ID, unduhan) | Dipakai untuk |
|---|---|---|
| Rumput | Grass004 (10,5 MB), Grass001 (10,2 MB) | lapisan rumput tanah/lapangan hijau |
| Tanah lembap/hutan | Ground037 (10,1 MB), Ground048 (10,2 MB) | lantai hutan, tepi jalan |
| Tanah kering/pasir | Ground054 (8,3 MB), Ground080 (6,6 MB) | tanah kosong, jalur tanah, tepi air |
| Kerikil | Gravel023 (9,4 MB) | tepi jalan, parit |
| Lumut | Moss002 (9,9 MB) | tambalan teduh lembap di dasar pohon |
| Plester dinding | Plaster001 (7,1 MB) | dinding gedung kit + ERC |
| Beton | Concrete034 (3,5 MB) | jalan beton, halaman, parit |
| Paving | PavingStones070 (8,6 MB) | plaza, teras |
| Aspal | Asphalt031 (8,3 MB) | jalan aspal |
| Atap seng | CorrugatedSteel005 (5,6 MB) | atap (diwarnai biru lewat tint) |
| Kayu | Planks021 (6,7 MB) | bangku, papan, perabot sekre |
| Ubin keramik | Tiles074 (3,5 MB) | lantai interior sekre |
| Kulit pohon | Bark001 (5,5 MB) | batang pohon |
**Total unduhan ±105 MB (zip, sementara); hasil akhir di repo ±6–10 MB.**
**Izin unduh:** daftar di atas dikirim ke user untuk disetujui sebelum eksekusi (aturan: sebutkan sumber, berkas, ukuran).

**Pipeline** (`tools/texbake/`, Node, devDependency `sharp`): unduh zip ke `data-src/textures/` (gitignore) → pilih peta Color, NormalGL,
Roughness, AmbientOcclusion → ubah ukuran 512² (dan 256² untuk varian lemah; 1024² hanya Plaster001, Bark001, CorrugatedSteel005,
Planks021 yang terlihat dekat), **pak ORM** (R=AO, G=Roughness, B=0) → simpan WebP kualitas 82 ke `public/textures/<nama>/{albedo,normal,orm}.{512,256}.webp`
+ `manifest.json` (ukuran tile meter nyata, nama, kategori, warna rata-rata untuk fallback). Tile mulus (seamless) bawaan ambientCG.
**Runtime** (`src/world/textures/pbr.js`): `loadPbr(name, {tier})` → `{map, normalMap, aoMap/roughnessMap}` dengan anisotropi 8, mipmap, sRGB benar,
cache per ResourceScope, dispose benar; pemuatan async dengan placeholder warna rata-rata (tanpa kedipan hitam); pemilihan tier
256/512 berdasarkan pengaturan. API lama `surfaceMaps()` tetap (mode asli).
**File:** `tools/texbake/*`, `public/textures/**`, `src/world/textures/pbr.js`, `package.json` (sharp), `.gitignore`, `README.md`.
**Selesai bila:** 13 set termuat tanpa galat di browser, memori GPU tercatat ≤ 45 MB untuk set ini, uji halaman galeri `?tekstur` menampilkan
semua set pada bola dan bidang untuk dibandingkan; atribusi lengkap.

## T2. Tanah: splat PBR, variasi makro, anti-tiling
**Tujuan:** tanah kampus terlihat seperti foto Street View (rumput bertambal tanah dan serasah), tanpa pola berulang.
- Shader patch tunggal (`onBeforeCompile` pada MeshStandardMaterial) di `src/world/terrain/terrainSplat.js`: **5 lapisan** (rumput,
  tanah lembap/serasah, tanah kering, kerikil, lumut) dengan bobot dari data ground M2 (vertex weights; tambahkan kanal jika perlu).
  - **Blend berbasis tinggi** (pakai AO/luminansi sebagai peta tinggi) → transisi tajam seperti nyata, bukan kabur.
  - **Anti-tiling:** dua sampel albedo dengan rotasi/skala berbeda dicampur lewat noise makro (hanya albedo; normal satu sampel).
  - **Variasi makro:** noise frekuensi rendah (±12% kecerahan, geser warna hijau↔kuning) dengan periode 30–60 m.
  - **Basah:** bobot basah menurunkan roughness dan menggelapkan albedo (tepi air, parit, hujan), pasir basah berkilau.
  - Normal detail 1 m hanya dekat (< 25 m, fade), mip-bias jauh.
  - Tingkat kualitas: tinggi (5 lapisan + normal) / sedang (albedo + normal 3 lapisan) / rendah (albedo saja); dipilih otomatis.
- Terapkan pada tanah distrik (`src/districts/unri/ground.js`), lantai hutan region (`ukmGroundDetail.js`), dan tanah tile kota dasar bila murah.
- Jalan: `Asphalt031` dan `Concrete034` pada pita ter-drape (UV meter), marka cat di atas, noda ban dan bekas tambalan sebagai decal.
**Selesai bila:** halaman sekre dan jalan kampus dari kamera 3/4 dan mata tidak lagi berpola berulang, tanah punya tambalan rumput/tanah/serasah
nyata; biaya ≤ +6% waktu frame; fallback rendah bekerja.

## P1. Cahaya, atmosfer, warna (dampak terbesar, murah)
- **Matahari & ambient:** matahari sedikit lebih hangat dan rendah (sudut 30–50° bila gaya kartun), hemisphere ambient berwarna (langit→tanah),
  bayangan lembut. Tabel per jam (pagi emas, siang jernih, **sore keemasan**, malam biru) di `src/config/lowpoly.js`.
- **Hamburan kabut ala Bali:** warna kabut condong ke arah matahari (`mix(fogColor, sunColor, pow(max(dot(viewDir, sunDir),0), 4))`), kerapatan
  menebal ke jauh, sedikit kabut tinggi rendah; langit gradasi dengan cakram dan aura matahari.
- **Tone mapping & grading:** pastikan ACES/filmic dan eksposur per waktu; split-toning (sorotan #FFE2B8, bayangan #5A7BA8), saturasi/kontras,
  vinyet halus. **Bloom halus** (threshold tinggi, setengah resolusi) khusus sorotan terang (kaca, air, matahari).
- **Tilt-shift** opsional (default mati; blur dua pass setengah resolusi, bobot jarak vertikal layar).
**Selesai bila:** foto sekre pada pagi/sore/malam hangat-sejuk, ada aura matahari dan kabut hangat di jauh, tanpa banding warna/overbloom; ≤ +5% frame.

## T3. Gedung, atap, jalan, kayu: material PBR
- **Dinding kit K01–K12:** dasar `Plaster001` dengan UV dalam meter (sudah ada UV atlas; tambahkan UV dunia untuk bidang dinding polos, atlas hanya untuk
  jendela/pintu/roster), warna dinding ditentukan tint material (palet), noda "kotor/lumut" di sepertiga bawah dari AO + noise.
- **Atap:** `CorrugatedSteel005` bernada biru (tint) dengan roughness bervariasi; sambungan dan paku halus lewat normal; karat tipis di tepi.
- **GLB hero (gedung ERC dll.):** skrip Blender memberi UV (box/triplanar-ke-UV) dan material dengan referensi tekstur PBR; AO dipanggang ke vertex
  color (`bake_ao.py`); bevel kecil 1,5–2 cm; ekspor ulang. Tekstur dipakai bersama (tidak ditanam di GLB, dipasang runtime lewat nama material).
- **Kayu/perabot** (bangku, papan nama, tiang gubuk) `Planks021`; **lantai interior** `Tiles074`; **paving/teras** `PavingStones070`.
**Selesai bila:** dinding, atap, teras, jalan terlihat bertekstur nyata dari dekat (level mata) dan tetap bersih dari jauh; memori tekstur total ≤ 70 MB.

## T4. Pohon: kulit kayu PBR + daun berupa kartu bertekstur nyata
- Skrip Blender `v15_pohon_kartu.py`: batang dengan UV silinder (kulit `Bark001`), cabang halus; tajuk dari 8–14 **kartu daun melengkung** per gerombol
  dengan normal dibengkokkan ke pusat gerombol (shading seperti bola) dan tekstur daun alpha-test.
- **Tekstur daun dilukis prosedural kualitas tinggi** (`tools/texbake/leafAtlas.mjs`, canvas 1024², 3–4 varian: mahoni, akasia, palem pendek, semak): bentuk daun
  bertumpuk, gradasi hijau, urat, sorotan tepi hangat — bukan noise. Alternatif: foto daun CC0 bila ditemukan yang cocok.
- Instancing BatchedMesh per LOD tetap; **anggaran overdraw:** ≤ 55 pohon LOD0 dalam 40 m; alpha-to-coverage bila ada; fallback otomatis ke gumpalan halus.
**Selesai bila:** pohon sekitar sekre rimbun dan berlapis dari kamera 3/4 dan mata, batang berkulit nyata, ≤ +6% frame vs gumpalan.

## P2. Air (kolam, danau, waduk, sungai)
- Gradasi kedalaman/jarak-ke-tepi (atribut vertex, di-bake), busa tepi putih berdenyut pelan, dua normal-scroll prosedural + kilau matahari (sorotan rendah ala Bali),
  tepi basah (pasir/tanah menggelap dan berkilau lewat bobot basah T2), bayangan di dasar. Dermaga/titian kecil lewat generator di tepi Danau Buatan.
- Material air di `src/districts/unri/water.js` dan `src/city/cityMaterials.js`; ≤ 2 draw call per badan air; hujan dan malam tetap benar.
**Selesai bila:** Danau Buatan dan waduk bergradasi dengan busa dan kilau dari sudut 3/4 dan mata.

## P5. Penataan benda kecil (set dressing) lewat generator
- `dress(zone, rules, seed)` (template + parameter: jarak dari dinding, kelompok 2–4, hindari jalur) untuk teras/halaman ERC, deret sekre, tepi lapangan, tepi jalan,
  gubuk panahan, parkir. Katalog benda (satu skrip Blender `d01_dressing.py`, material PBR bersama): galon, karung, kursi plastik, sandal, jemuran, pot,
  papan tulis kaki tiga, tong, spanduk, sepeda, keranjang, kardus, tali bendera.
- Instancing per jenis; **≤ 400 instans per hero zone, ≤ 6 draw call tambahan**; zona kosong dijaga (tes).

## P6. UI kartun (CSS)
Tema perkamen krem untuk HUD, jurnal, panel, prompt E, kartu misi; font tebal untuk judul (self-host), ikon SVG; aktif otomatis di `gayaGrafis === 'kartun'`.

## P7. QA dan performa akhir
Galeri 8 titik (sekre ERC siang/sore/malam, lapangan, danau, Rektorat, masjid, stadion) asli vs kartun; tabel performa 3 konfigurasi × 3 titik (draw call,
segitiga, memori tekstur, waktu frame rata-rata/p95); uji auto-turun kualitas; lint + vitest + build sekali; PR dengan laporan jujur.

## Keputusan untuk user
1. **Izin unduh paket tekstur CC0 di atas** (13 set ambientCG, ±105 MB zip sementara, hasil ±6–10 MB di repo, sumber ambientCG.com, lisensi CC0).
2. Tilt-shift default mati; bloom halus hidup; palet: hijau segar + biru kobalt (atap sekre) + oranye hangat + toska air.
3. Urutan awal yang disarankan: **T1, lalu T2 dan P1 paralel**.

## Risiko
- Terlalu banyak sampel pada piksel tanah di GPU lemah → tingkat kualitas otomatis (tinggi/sedang/rendah) dan anggaran 8 sampel.
- Memori tekstur membengkak → ukuran 512/256, ORM berpak, anggaran 70 MB, dispose benar saat region/distrik dibongkar.
- Pemetaan tint pada material khusus (kaca, lampu, marka) → daftar kecuali `LOWPOLY_EXCLUDE`.
- Nama berkas/fungsi dari agen kamera-gaya mungkin berbeda dari yang disebut → Task 0 tiap fase memverifikasi dengan membaca kode.
