# Aturan kerja (Simulator Stadion Utama Riau + Kampus UNRI)

Proyek hobi: **cepat dan sederhana mengalahkan lengkap**. Bahasa: Indonesia.

## Workflow (6 langkah)
1. **Fable mengorkestrasi, Opus/Sonnet menulis** (keputusan user 2026-11-24, supaya murah). Sesi utama (Fable): memahami masalah, menulis brief, memeriksa hasil, bidikan, commit.
   Penulisan kode dioper ke agen: **Sonnet** untuk perubahan mekanis yang brief-nya sudah pasti (berkas, fungsi, tes), **Opus** untuk yang butuh rancangan atau lintas berkas; Opus juga untuk riset/audit hanya-baca.
   Satu agen penulis per kumpulan berkas, brief menyebut berkas:baris + perintah cek + larangan (jangan commit, jangan sentuh berkas user). Tanpa review per task dan tanpa dokumen plan; hasil agen selalu dicek sendiri (diff + lint + tes) sebelum commit.
   Perubahan di bawah ±10 baris atau dokumen: kerjakan langsung. Bila perkiraan > 30 menit, bilang di awal.
2. **Baca seperlunya:** `grep` dulu, buka hanya berkas terkait.
3. **Cek cepat:** `npm run lint` + tes berkas terkait (`node node_modules/vitest/vitest.mjs run <path>`). Suite penuh + `npm run build` hanya sebelum push.
4. **Lihat hasilnya** bila visual: 1–2 bidikan yang dibaca sendiri; lewati bila bukan visual.
5. **Git:** lihat bagian "Git: folder utama selalu di `main`" di bawah.
6. **Lapor ≤ 8 baris:** apa yang berubah, cara mencoba, yang belum yakin (jujur, termasuk yang belum diuji).

## Git: semua langsung di `main` (tanpa branch, tanpa PR)
User ingin folder proyek ini **selalu berada di `main` terbaru** dan semua pekerjaan langsung masuk ke `main` (keputusan user 2026-11-16).
**Jangan membuat branch, PR, worktree, atau folder salinan.**
- **Mulai sesi:** `git pull --ff-only` di `main`.
- **Semua perubahan** (dokumen, kode, aset, data, tes): commit kecil langsung di `main`, lalu push.
- **Sebelum push perubahan kode:** `npm run lint` + tes terkait wajib hijau; `npm run build` + suite penuh bila perubahannya besar atau menyentuh banyak lapisan.
  Push ke `main` langsung ter-deploy ke GitHub Pages, jadi jangan push kode yang belum dicek.
- Commit: `git add <file>` lalu `git commit -m "…"` sebagai **dua perintah terpisah** (hook memblokir gabungan). `git add` hanya berkas yang diubah sendiri.
- **Perubahan user yang belum di-commit jangan disentuh** dan jangan ikut di-commit. Jangan stash, reset, atau hapus berkas user.

## Aturan
- Fitur baru **langsung aktif** (default), kecuali diminta opt-in; mode lama tetap bisa dipilih.
- **Perubahan visual harus terlihat dari kamera game.** Sebelum mengerjakan "percantik": bidik *sebelum* dari kamera yang dipakai pemain, sebut apa yang akan beda (siluet, tinggi, warna ≥ 15–20%, cahaya), lalu bidik *sesudah* dengan kamera sama.
  Bila dua bidikan itu sulit dibedakan, itu **gagal**: jangan di-commit sebagai "percantik", lapor jujur. Rincian di `docs/model/RESEP.md` §0.
- `docs/superpowers/` = arsip rencana lama (±400 rb kata): **jangan dibaca**, kecualikan dari grep.
- Tes hanya untuk logika berisiko (matematika, data, collider, bake). Tidak ada tes visual/layout.
- Fakta mengalahkan gaya: tandai `[INFERENSI]` bila bukan dari sumber; jangan mengarang nama (UKM user = **ERC**, ruang D5).
- Anggaran: draw call region ≤ 250, tekstur GPU ≤ 70 MB, konten berulang lewat generator + instancing.

## Teknis singkat
- **Kartu kerja: `docs/rencana/README.md`** — baca dulu sebelum mengerjakan perbaikan dari kritik; satu kartu (R01…R25) = satu commit di `main`, berisi berkas, tes, perintah cek, dan angka lulus. Perbarui status kartu di commit yang sama.
- **Rencana Kota: `docs/kota/PLAN.md`** (+ README per fitur di `docs/kota/*/`) — perbarui di akhir tiap sesi yang menyentuh Kota; resep ganti model di `docs/kota/ganti-model/`.
- **Peta arsitektur: `docs/ARSITEKTUR.md`** — baca dulu sebelum menjelajah; perbarui (termasuk log keputusan) bila menambah lapisan/sistem/region.
- Koordinat dunia: +X timur, +Z selatan (meter). Lapisan ESLint tidak boleh saling impor lintas (lihat `eslint.config.js`).
- **Model 3D: `docs/model/RESEP.md`** — baca dulu sebelum membuat/memperbaiki model (sumber jadi dulu, maks 3 putaran, skor angka sebelum gambar, tanpa `generate_3d`).
- **Potongan (model bongkar pasang): `docs/model/POTONGAN.md`** — detail kecil landmark (AC, pohon, lampu, pintu, kanopi…) = GLB kecil di `public/models/potongan/`,
  disusun lewat daftar di `src/city/parts.data.js`. Menambah/mengganti detail: ubah potongan atau satu baris daftar, **jangan** menambahkannya ke mesh landmark.
- Blender: `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build']())"` (atau Blender MCP); skrip di `assets-src/blender/`.
- Bidikan: `tools/shots/*` (Playwright GPU, `--wait 9000` untuk malam). Port dev 5173.
- **Ruang uji** `/ruang-uji.html` (dev): cek satu model/karakter/animasi tanpa memuat dunia; bidik `node tools/shots/uji.mjs --q "orang=kasual-pria-g&anim=jalan-p"` atau `--q "model=models/…glb"`.
- **Galeri gedung** `/kit-gallery.html` (dev, `src/dev/kitGallery.js`): pratinjau gedung kit tanpa memuat dunia. Query: `kit=all|variasi|K01…K12|hero`, `lod=1`, `malam=1`,
  `seed=N`, `cam=atas`, `atlas=1`. Arketipe/varian baru: tambahkan spesimennya di `SPECIMENS` lalu lihat di sini **sebelum** dipasang di kota/kampus.
  Bidik semua: `node tests/e2e/kitGallery.shot.mjs --out renders/galeri-kit` (folder `renders/` diabaikan git; `--out` relatif ke root repo).
  Satu gedung dari dekat: `--q "kit=K14&fokus=0"` (boleh berulang; `fokus=N` = spesimen ke-N, tambah `&malam=1` untuk malam). Selalu cek dari dekat, bukan hanya bidikan jauh.
- Worktree lama (bila masih ada): jangan hapus dengan `--force` bila `node_modules` berupa junction; lepas junction dulu.
