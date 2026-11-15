# R26 — Menunggu user: bahan dan keputusan yang tidak boleh dikarang

> Berkas ini **bukan** kartu kerja. Ini daftar hal yang menahan pekerjaan sampai user memberi bahan atau keputusan.
> Eksekutor: **jangan mengerjakan butir di sini dengan menebak.** Bila sebuah kartu menyentuh butir di bawah, kerjakan bagian lain dan tulis di laporan bahwa butir itu menunggu.

## A. Bahan dari user

| # | Yang dibutuhkan | Menahan | Bentuk yang paling berguna |
|---|---|---|---|
| A1 | ~~Contoh rujukan model manusia~~ (D5) — **sudah dikirim 2026-11-14**; sedang dikerjakan sesi lain di PR #39 (`feat/karakter-preset`: 3 karakter jadi ber-rig, `src/entities/Humanoid.preset.js`, alat `tools/shots/presetLineup.mjs`) | M1 wajah, M2 proporsi, M4 ragam siluet, M5 hijab | **Jangan sentuh** `src/entities/Humanoid.preset.js`, `Humanoid.kit.js`, `Humanoid.skinned.js`, dan `assets-src/blender/karakter/` dari kartu lain. Setelah PR #39 masuk `main`: jalankan `npcLineup.mjs` + `presetLineup.mjs`, nilai ulang M1/M2/M4/M5 di `docs/KRITIK.md`, baru tulis R27 bila masih ada yang kurang. |
| A2 | **Foto Stadion Utama Riau** (luar siang, luar malam, tribun, papan nama) | Warna proxy dan stadion (R04 masih `[INFERENSI]`) | 4–8 foto sendiri atau tautan berlisensi jelas; cukup untuk mencocokkan warna kursi, rusuk, fasad. |
| A3 | **Isi asli sekre ERC** (Tahap 5 rencana lama): struktur pengurus, proker, piagam, jadwal piket, poster | Isi papan di sekre (R24 hanya menambah fungsi) | Teks/foto papan. Nama orang sungguhan hanya dipakai bila pemiliknya setuju; kalau tidak, pakai jabatan saja. |
| A4 | **Daftar landmark yang benar-benar ikonik menurut orang Pekanbaru** | Urutan model buatan tangan (K5) | Setelah R07 menghasilkan 20 teratas dari data: user mencoret yang tidak ikonik dan menambah yang hilang (dengan nama persis di peta). |
| A5 | **Sapaan/dialek Melayu Riau untuk NPC** | Dialog berwarna lokal | Ditulis atau diperiksa penutur asli. Tanpa itu dialog tetap bahasa Indonesia baku. |
| A6 | **Sumber fakta per tempat** | Teks fakta di paspor kota (R11 hanya menampilkan nama + jenis) | Tautan sumber per tempat (situs resmi, papan informasi). Tiap fakta di game membawa tanda sumber. |

## B. Keputusan yang masih terbuka

| # | Pertanyaan | Asumsi yang dipakai sementara | Kartu yang terpengaruh |
|---|---|---|---|
| B1 | "Bebas ala GTA": apakah termasuk kekerasan, menabrak orang, kejar-kejaran polisi? | **Tidak** (nada game hangat). `[INFERENSI]`, belum dikonfirmasi. | R23 (orang menepi, bukan tertabrak), R25 (tanpa tilang) |
| B2 | Kebun: sampingan opsional atau bagian inti? | Sampingan: dirapikan dan diseimbangkan, tidak ditambah mekanik (R20). | R20, R10 Tugas 3 |
| B3 | Musik: ada atau tidak; disintesis atau rekaman berlisensi? | Tidak ada musik. | R18 |
| B4 | Subjudul "Dunia terbuka Pekanbaru, Riau" (sudah terpasang di PR #38) | Dipakai sampai ada keberatan. | — |
| B5 | Harga motor dan lama menabung yang diinginkan | Rp 150.000 ≈ 90 menit bermain. | R25 Tugas 4 |
| B6 | Traktor dibatasi 300 m dari kebun? | Ya (R25 Tugas 4). Bertentangan tipis dengan "ganti bebas"; mudah dicabut. | R25 |
| B7 | Cincin tile terperinci kedua (±6 km) | Ditahan sampai R08 lulus. | `docs/kota/PLAN.md` |

## C. Model buatan tangan (K5) — spesifikasi supaya siap dikerjakan begitu A4 terjawab

Resep ganti model sudah ada di `docs/kota/ganti-model/README.md`. Batas per model: ≤ 5.000 segitiga, warna per vertex (tanpa tekstur), 1–2 draw call, skrip Blender di `assets-src/blender/<nama>.py`
(`build()` mengembalikan ringkasan), keluaran `public/models/monumen/<nama>.glb`. Tempat pemasangannya di kode mengikuti resep ganti-model (berkas pemasang landmark Kota **belum ada**; dibuat saat model pertama dikerjakan, di lapisan `city/`). Jejak bangunan yang ditimpa dibuang dari lapisan jauh saat bake
(`farbake.mjs` menerima daftar "ditimpa": pusat + radius).

Kandidat yang **keberadaannya pasti dari data** (bukan urutan final): Masjid Raya An-Nur (area tile `pusat`), Rektorat UNRI (sudah region hero di mode jalan: tinggal proxy untuk mode Kota),
jembatan di atas Sungai Siak (sungai ada di `public/far/rivers.bin`; **nama jembatan tidak ada di data yang sudah diambil**, jangan dinamai sebelum R07), landasan bandara (poligon guna lahan, R12 Tugas 4).

Tiap model butuh sebelum dikerjakan: nama persis + koordinat dari `landmarks.json`, 2–3 foto rujukan (A2/A4), dan ukuran jejak dari data.

## D. Uji dengan orang (D6)

Tiga teman ERC yang belum pernah melihat proyek. Protokol (dari `docs/KRITIK.md`): 10 menit, tanpa penjelasan, layar direkam. Catat: detik pertama bergerak, tiap berhenti > 5 detik, kalimat pertama.
Jadwalkan **setelah** R01, R02, R03, R13, R19 masuk `main` (itulah isi tonggak T1). Hasil ditulis di `docs/KRITIK.md` bagian tonggak, lalu jadi bahan Putaran 3.
