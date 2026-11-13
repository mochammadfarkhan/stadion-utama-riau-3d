# Rencana kerja "Anak Bertuah" — indeks kartu (hidup)

Dokumen ini adalah **pintu masuk untuk siapa pun (manusia atau model) yang akan mengubah kode**. Kritik dan arahnya ada di `docs/KRITIK.md`;
di sini kritik itu sudah dipecah menjadi **kartu kerja** (`R01`…`R25`) yang masing-masing bisa dikerjakan tanpa membaca kartu lain.

Terakhir diperbarui: 2026-11-14. Angka dasar dan cara ukur: [`R00-alat-ukur.md`](R00-alat-ukur.md).

---

## 1. Cara memakai (untuk eksekutor)

1. Baca **berkas ini sampai habis**, lalu `AGENTS.md` (aturan proyek), lalu **satu** kartu yang akan dikerjakan. Jangan membaca semua kartu.
2. Cek prasyarat kartu di tabel bagian 4. Bila prasyaratnya belum ✅, kerjakan prasyaratnya dulu atau pilih kartu lain.
3. Buat branch dari `main` terbaru dengan nama yang tertulis di kartu.
4. Kerjakan **tugas demi tugas, langkah demi langkah**, sesuai urutan. Centang `- [ ]` menjadi `- [x]` di kartu saat langkah selesai (ikut di-commit).
5. Tiap tugas diakhiri commit kecil. Setelah semua tugas: jalankan bagian "Selesai bila", lalu push dan buka PR ke `main`. **Merge dilakukan user.**
6. Perbarui tabel status di bagian 4 dan butir terkait di `docs/KRITIK.md` (⬜ → ✅) dalam PR yang sama.
7. Lapor ≤ 8 baris: apa yang berubah, cara mencoba, apa yang **belum** diuji atau belum yakin.

**Satu kartu = satu PR.** Kartu besar boleh dipecah menjadi beberapa PR **di batas tugas** (bukan di tengah tugas).

## 2. Aturan yang tidak boleh dilanggar

Dari `AGENTS.md` dan keputusan user. Tiap kartu mengandaikan semua ini.

| Hal | Aturan |
|---|---|
| Bahasa | Indonesia untuk komentar, pesan commit, teks antarmuka, laporan. Nama simbol tetap seperti di kode. |
| Lapisan | `src/` berlapis; impor lintas lapisan dilarang ESLint (`eslint.config.js`). Ringkasnya: `config/`, `geo/` murni → `shared/` → `engine/` → `sim/` (hanya `engine`) → `story/` (tanpa `three`) → `world/` → `entities/` → `city/` → `regions/` → `districts/` → `interiors/` → `core/` → `ui/` → `app/` → `main.js`. Tabel lengkap: `docs/ARSITEKTUR.md`. **Logika baru yang bisa murni, tulis murni di `sim/`, `story/`, atau `config/`.** |
| Tes | Hanya untuk logika berisiko (matematika, data, collider, bake, penyimpanan). **Tidak ada tes visual/layout.** Tes ditulis **sebelum** implementasi dan harus terlihat gagal dulu. |
| Anggaran | Draw call region ≤ 250; tekstur GPU ≤ 70 MB; konten berulang lewat generator + instancing. Tiap kartu menyebut berapa draw call yang boleh ditambah. |
| Per frame | Tidak ada alokasi (`new THREE.Vector3`, objek/larik baru) di dalam `update`. Simpan scratch di closure. Kerja berat → `scheduler`. Tiap yang dibuat saat pasang punya `dispose`. |
| Fakta | Jangan mengarang nama tempat, orang, jarak, sejarah. Yang bukan dari sumber diberi tanda `[INFERENSI]`. UKM pemain = **ERC**, ruang **D5**. Tokoh cerita (Kak Nisa, Bang Raka, Pak Satpam, Coach Dedi) fiksi dan sudah ada. |
| Fitur baru | Langsung aktif (default), kecuali kartu berkata lain. Mode lama tetap bisa dipilih. |
| Arah seni | **Dikunci di preset Rendah** (D3). Semua bidikan pemeriksaan diambil di preset Rendah. Perubahan yang hanya bagus di Tinggi belum selesai. |
| Simpanan pemain | Kunci `localStorage` dan id (item, langkah cerita, tujuan) **tidak boleh diganti nama**. Format baru harus tetap bisa memuat format lama. |
| Git | Branch per kartu dari `main`. `git add <berkas>` dan `git commit -m "…"` sebagai **dua perintah terpisah** (hook menolak gabungan). Jangan `--no-verify`. Jangan menghapus worktree dengan `--force`. |
| Di luar kartu | Jangan "sekalian merapikan". Temuan di luar kartu ditulis di laporan dan ditambahkan sebagai butir baru di `docs/KRITIK.md`, bukan diperbaiki diam-diam. |

## 3. Perintah baku

```bash
npm run lint
```
```bash
node node_modules/vitest/vitest.mjs run tests/<berkas>.test.js
```
```bash
node tools/shots/kritik.mjs --out renders/kritik/<nama> --hanya jalan
```
```bash
npm test
```
```bash
npm run build
```

- Dua yang terakhir (suite penuh + build) **hanya sebelum push**.
- Dev server: `npm run dev` (port 5173). Alat bidikan menyalakan server sendiri di port 5176; jangan jalankan dua alat bidikan sekaligus.
- Blender: `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build']())"`.
- Bake kota jauh: `node tools/citybake/farbake.mjs` (±15 detik; butuh `data-src/overture-kota/*.csv`). Ambil data: `node tools/citybake/farFetch.mjs <nama>` (±5 menit per query, butuh internet).

### Kapan berhenti dan melapor (jangan menebak)

- Nomor baris di kartu tidak cocok **dan** simbol yang disebut tidak ditemukan dengan `grep`.
- Sebuah langkah butuh mengubah berkas yang oleh kartu ditandai "jangan disentuh", atau butuh melanggar aturan lapisan.
- Tes lama gagal karena alasan yang tidak dijelaskan kartu.
- Hasil ukur berlawanan dengan harapan kartu (mis. draw call naik padahal seharusnya turun).
- Butuh nama/fakta/aset yang tidak ada di repo (lihat `R26-menunggu-user.md`).

Dalam kasus itu: kembalikan perubahan langkah tersebut, selesaikan langkah lain yang tidak bergantung padanya, dan tulis di laporan **apa yang ditemukan** (berkas, baris, keluaran perintah).

## 4. Daftar kartu, urutan, dan status

Status: ⬜ belum · 🔄 dikerjakan · ✅ selesai · ⏸ menunggu.
Jenis cek: **T** tes otomatis · **B** bidikan yang dibuka eksekutor · **M** uji main oleh manusia · **U** ukur angka.

### Tonggak T1 — Sepuluh menit pertama ("baru mulai sudah betah")

| Kartu | Isi | Prasyarat | Tugas | Cek | Status |
|---|---|---|---|---|---|
| [R01](R01-hud-rapi.md) | HUD rapi: dompet, menu bersih, prompt ganda, teks teknis, skor (U1–U5) | — | 5 | T B | ⬜ |
| [R02](R02-rendah-rapi.md) | Preset Rendah: bayangan kontak (cacat satu baris), kabut, FXAA (G1–G3) | — | 4 | T B U | ⬜ |
| [R13](R13-rasa-kendali-sepeda.md) | Rasa kendali sepeda: belok, meluncur, sprint, senggol dinding | — | 6 | T M | ⬜ |
| [R03](R03-mulai-dari-sekre.md) | Mulai di depan sekre ERC; jarak + arah tujuan (S1, U6, G4) | R01, R02 T1 | 5 | T B M | ⬜ |
| [R19](R19-simpan-muat.md) | Simpan/muat: dompet, posisi, kendaraan, mulai dari awal | — | 5 | T M | ⬜ |
| [R05](R05-draw-call-mode-jalan.md) | Draw call mode jalan 460–510 → ≤ 300 (M3 + baru) | — | 6 | T B U | ⬜ |
| [R14](R14-masukan-analog-jalan-kaki.md) | Gamepad/sentuh analog; jalan kaki relatif kamera | R13 | 6 | T M | ⬜ |
| [R15](R15-kamera.md) | Kamera: menyusul belokan, FOV kecepatan, orang pertama miring | R13 | 5 | T M | ⬜ |
| [R17](R17-animasi.md) | Animasi: tangan ke setang, lari, transisi pose (M6) | R13 T6 | 5 | T B M | ⬜ |
| [R16](R16-hp-sentuh.md) | HP landscape: jebakan mode foto, tombol Mode/Tas, tata letak | R01 | 7 | T B M | ⬜ |
| [R21](R21-keterbacaan-aksesibilitas.md) | Kontras toko/toast (cacat), aksen, teks ≥ 13 px, ARIA, daftar kontrol | — | 6 | T B | ⬜ |
| [R18](R18-audio.md) | Suara: jeda saat tab tersembunyi, hujan, sepeda, suasana kawasan | — | 6 | T M | ⬜ |
| [R22](R22-waktu-muat.md) | Waktu muat: alat ukur, label benar, Mulai tidak menunggu | R03 (T4) | 4 | U | ⬜ |
| [R04](R04-stadion-ikon.md) | Stadion ikon: proxy mode Kota + wajah malam (K4, G6) | — | 4 | T B | ⬜ |

**T1 selesai bila:** 3 teman ERC bermain 10 menit tanpa dibantu dan tidak ada yang berhenti atau bingung arah (protokol di `R26` bagian D); bidikan titik mulai preset Rendah layak jadi gambar README.
**Sengaja tidak dikerjakan di T1:** lapisan Kota baru, tanaman baru, region baru.

### Tonggak T2 — Ada alasan kembali ("besok main lagi")

| Kartu | Isi | Prasyarat | Tugas | Cek | Status |
|---|---|---|---|---|---|
| [R20](R20-kebun.md) | Kebun: tidur hanya malam, tumbuh per malam, harga, status petak | R19 T1 | 5 | T M | ⬜ |
| [R09](R09-ekonomi-stamina.md) | Saldo awal 15 rb, stamina, makan (X), perlengkapan (S2, S3) | R20 T2, R19 T1 | 5 | T M | ⬜ |
| [R10](R10-kurir-hari-pertandingan.md) | Kurir: pesanan antar berulang; kalender; hari pertandingan (S4, S6) | R03, R09 T5, R19 T1 | 4 | T M | ⬜ |
| [R24](R24-sekre-rumah.md) | Sekre rumah: cache interior, rebahan = tidur + simpan, papan, lemari | R19, R09 T5, R10 T4 | 5 | T M | ⬜ |
| [R23](R23-kehidupan-jalan.md) | Mahasiswa menepi + bel; mobil lewat di jalan besar | — | 3 | T U M | ⬜ |

**T2 selesai bila:** ada satu loop 5 menit yang bisa diulang (pesanan → uang → perlengkapan terasa) dan uang pernah kurang minimal sekali dalam 20 menit pertama.

### Tonggak T3 — Kota punya wajah ("itu masjidnya!") — berjalan **sejajar** dengan T1/T2

| Kartu | Isi | Prasyarat | Tugas | Cek | Status |
|---|---|---|---|---|---|
| [R08](R08-kinerja-kota.md) | Zoom penuh 1.399 → ≤ 600 draw call; blur maket; pojok putih (G7, G8) | — | 4 | T B U | ⬜ |
| [R06](R06-kota-bersiluet.md) | Kelas bangunan, warna kawasan, kubah (K1, K6) | R08 T1 (disarankan) | 4 | T B | ⬜ |
| [R07](R07-landmark-dari-data.md) | Nama dari Overture, `landmarks.json`, label bertingkat, HUD Kota (K2, K3, U9) | R06 T1 | 4 | T B M | ⬜ |
| [R11](R11-jelajah-paspor.md) | Paspor kota, "Ke sini" dari peta, jurnal (S5, S7, S8) | R07, R03 T1, R19 | 4 | T M | ⬜ |
| [R12](R12-sisa-putaran-1.md) | Sisa: gedung kit polos, minimap, arteri, guna lahan (G5, U8, K7, K8) | R08 (T3) | 4 | T B | ⬜ |

**T3 selesai bila:** user menyebut ≥ 5 tempat dari bidikan tanpa label, dan zoom penuh ≤ 600 draw call.

### Sesudah T2 ("beyond") dan yang menunggu

| Kartu | Isi | Status |
|---|---|---|
| [R25](R25-kendaraan-lain.md) | Motor sebagai pembelian besar; collider badan kendaraan | ⬜ dibuka setelah R09 + R10 lulus uji main |
| [R26](R26-menunggu-user.md) | Bahan dan keputusan dari user (rujukan manusia, foto stadion, isi sekre, landmark ikonik, …) | ⏸ |
| R27 (belum ditulis) | Model manusia: wajah, proporsi, siluet, hijab (M1, M2, M4, M5) | ⏸ sedang dikerjakan sesi lain di PR #39 (`feat/karakter-preset`); dinilai ulang setelah PR itu masuk (R26 A1) |
| R28 (belum ditulis) | Model landmark buatan tangan (K5) | ⏸ menunggu R07 + R26 A4 |

### Urutan yang disarankan (irama D2: satu PR mode jalan, satu PR Kota)

`R01` → `R08` → `R02` → `R04` → `R13` → `R06` → `R19` → `R07` → `R03` → `R12` → `R05` → `R11` → lalu sisa T1 (`R21`, `R16`, `R14`, `R15`, `R17`, `R18`, `R22`) → T2 (`R20` → `R09` → `R10` → `R24` → `R23`).

Kartu **tanpa prasyarat** yang bisa dikerjakan kapan saja oleh sesi lain secara paralel (berkas tidak bertabrakan): `R01`, `R02`, `R13`, `R19`, `R08`, `R18`, `R21`, `R23`.
Yang **bertabrakan berkas** (jangan paralel): `R01`/`R16`/`R21` (`hud.css`, `HUD.js`); `R13`/`R14`/`R17`/`R25` (`Bicycle.js`, `bikePhysics.js`); `R06`/`R07`/`R08`/`R12` (`farCity.js`, `farbake.mjs`); `R03`/`R19`/`R22`/`R24` (`main.js`, `session.js`).

## 5. Yang berubah dari kritik Putaran 1 setelah kode dan data diperiksa ulang (2026-11-14)

| Butir lama | Koreksi | Bukti |
|---|---|---|
| G1 "bayangan kontak mati di preset Rendah / gaya asli" | **Salah akar.** Gaya default `kartun` → bayangan kontak **aktif**, tetapi tidak pernah terlihat karena teksturnya hitam (alphaMap dibaca dari kanal hijau). Perbaikan satu baris. | piksel tengah kanvas `[0,0,0,255]`; uji ganti tekstur → bayangan muncul (`docs/screenshots/kritik/dasar/bayangan-kontak-sesudah.jpg`) |
| "Bidikan berjalan di preset Rendah [INFERENSI]" | Kini **terukur**: alat memaksa preset dan mencatat setelan. | `ringkasan.json` → `setelan` |
| "UNRI 358 draw call" | Dengan preset dipaksa dan POV ditutup: 459–511. **Semua titik mode jalan hampir 2× anggaran 250.** Butir baru G9 → R05. | `ringkasan.json` |
| K1 "menara dari tinggi > 20 m", "ratusan masjid" | Data: 98,8% bangunan tanpa kelas, 99,8% tanpa tinggi; ≥ 25 m hanya 12; `religious` + `mosque` = 297. Menara dibuang; kubah tetap. | hitungan `bangunan.csv` di R06 |
| "Rekaman bangunan 8 byte" | 10 byte (8 nilai). | kepala `farbake.mjs` |
| U6 "tujuan tanpa arah" | Minimap **sudah** menjepit penanda tujuan ke tepi; yang kurang jarak, dan arah saat minimap mati (HP). | `Minimap2D.js:148–150` |
| S1 "pindah titik awal ke tepi plaza" | Diganti keputusan D1: mulai di **sekre ERC**. | R03 |

## 6. Yang belum diverifikasi (jujur)

- Kartu R13–R25 disusun dari pembacaan kode oleh tiga penjelajah + cek silang saya pada baris kunci (`bikePhysics.js`, `Bicycle.js`, `Collider.js`, `Input.js`, `fastTravel.js`, `chapters*.js`, `farbake.mjs`, `farCity.js`, `proxy.js`).
  **Baris yang tidak saya cek sendiri bisa bergeser**: kartu selalu menyebut nama simbol; cari dengan `grep` sebelum mengubah.
- Kode dibaca saat folder kerja berada di branch `feat/karakter-preset` (PR #39), yang berbeda dari `main` hanya di `src/entities/Humanoid*.js`, `src/interiors/sekre/npcs.js`,
  dan 6 baris `src/main.js`. Nomor baris `main.js` di kartu bisa bergeser ±6 baris terhadap `main`.
- R17 (animasi) bersinggungan dengan PR #39: karakter jadi memakai rangka 13 tulang yang namanya sama dengan pivot `Humanoid`, sehingga fungsi animasi lama tetap berlaku.
  Kerjakan R17 **setelah** PR #39 masuk, dan uji pose pada karakter kit **dan** karakter jadi.
- Tidak ada satu pun kartu yang sudah dijalankan. Angka "harapan" di kartu (mis. draw call turun ke < 60) adalah perkiraan dari hitungan, bukan hasil ukur.
- Rasa (kendali, kamera, suara, keseimbangan uang) hanya bisa dinilai dengan bermain. Kartu memberi rentang yang boleh disetel tanpa bertanya.
- `fps` dari alat headless tidak bisa dipercaya; kinerja nyata harus diukur di laptop user dengan `?perf`.
- HP belum pernah diuji di perangkat sungguhan; R16 disusun dari CSS dan satu bidikan 812×375.
