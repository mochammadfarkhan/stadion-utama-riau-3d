# Mission Manager & Cerita "Wisata Kuliner dan Budaya Riau" — Desain

Tanggal: 2026-10-14 · Status: menunggu persetujuan

## Keputusan dari pengguna
- Alur: **cerita berurutan (chapter)** dengan dialog singkat dari NPC.
- Jenis misi: **beli + antar makanan**, **balap/keliling lintasan**, **jelajah + cari benda tersembunyi (easter egg)**.
- Tema: **wisata kuliner dan budaya Riau** (jajanan, tugu Lancang Kuning, Air Molek).
- Progres **disimpan di browser** (localStorage), ada tombol "Mulai ulang cerita".

## Tujuan dan non-tujuan
Tujuan: simulator terasa seperti game: ada tujuan, imbalan, kemajuan, dan kejutan, memakai sistem yang sudah ada (dompet, pedagang, lintasan, sepeda).
Bukan tujuan sekarang: suara dialog, animasi cutscene, multipemain, misi di POV non-sepeda.

## Pendekatan yang dipilih
Mesin misi **data-driven + reducer murni**:
- Cerita ditulis sebagai data (chapter → langkah → objective), bukan kode per misi.
- State cerita immutable; hanya diubah oleh `reduce(state, event)`.
- Dunia (Three.js) hanya **mengirim event** dan **menggambar penanda**; logika tidak tahu soal THREE.

Alternatif yang ditolak: (1) skrip imperatif per misi, cepat tetapi sulit diuji dan disimpan; (2) pakai library quest/behavior-tree, berlebihan untuk 5 chapter.

## Arsitektur (file kecil, sesuai pola repo)
| Lapisan | File | Tugas |
|---|---|---|
| Data | `src/story/chapters.js` | Chapter, langkah, dialog, hadiah (beku/frozen) |
| Data | `src/story/easterEggs.js` | Daftar easter egg, pemicu, hadiah |
| Logika murni | `src/sim/story/objectives.js` | Evaluator tiap jenis objective |
| Logika murni | `src/sim/story/reducer.js` | `reduce(state, event) → {state, effects}` |
| Logika murni | `src/sim/story/lapTracker.js` | Checkpoint putaran lintasan + waktu |
| Penyimpanan | `src/story/storage.js` | Simpan/muat `sur3d.story.v1`, validasi + versi |
| Adaptor | `src/core/StoryDirector.js` | Menerjemahkan dunia → event (posisi sepeda, beli, E) |
| Dunia | `src/world/StoryMarkers.js` | Tiang cahaya tujuan + ikon NPC + titik di minimap |
| UI | `src/ui/StoryHUD.js`, `src/ui/StoryJournal.js` | Tujuan aktif, dialog, jurnal (tombol J), lencana |

Event: `arrived{id}`, `bought{itemId, vendorId}`, `delivered{npcId}`, `interacted{id}`, `lapDone{n, seconds}`, `bellRung{x,z}`, `tick{dt}`.
Efek keluaran reducer: `showDialog`, `reward{rupiah, badge}`, `unlock`, `toast`, `save`.

## Jenis objective
- `goto`: masuk radius titik tujuan.
- `buy`: beli item tertentu dari pedagang (memakai transaksi vendorSim yang ada).
- `deliver`: bawa item ke NPC, tekan E; item keluar dari dompet.
- `laps`: lewati checkpoint lintasan N putaran, opsional batas waktu.
- `find`: dekati/interaksi dengan benda tersembunyi.
Semua objective bisa berbatas waktu; gagal → ulang langkah, tanpa penalti besar.

## Cerita (5 chapter)
1. **Selamat Datang di Pekanbaru**: kayuh ke tugu Lancang Kuning, baca legendanya.
2. **Es Teh Bang Udin**: beli Es Teh, antar ke satpam di gapura (batas waktu longgar).
3. **Rujak untuk Pelatih**: beli Rujak, antar ke pelatih di pinggir lintasan.
4. **Keliling Lintasan**: 3 putaran lintasan, target waktu; hadiah untuk waktu bagus.
5. **Jejak Air Molek**: cari 3 petunjuk di kawasan; finale membuka lencana "Anak Bertuah".
Gelar naik tiap chapter: Pendatang → Kurir Jajanan → Atlet Sepeda → Anak Bertuah.

## Easter egg (usulan, bisa ditambah)
- Bunyikan bel 3× di depan satpam gapura → satpam membalas.
- Bangku uji Blender di plaza → toast "Bangku keramat" + lencana.
- Tengah lapangan jam 00:00 → bola bercahaya melayang.
- Beli Es Teh 5× dari Bang Udin → pesan pelanggan setia.
- Berdiri di bawah layar tugu saat hujan → petunjuk tersembunyi Air Molek.
Ditandai di jurnal sebagai "???" sampai ditemukan.

## Alur UI
- HUD kecil di kiri: judul chapter, tujuan aktif, hitung mundur bila ada waktu.
- Dialog: kotak teks bawah layar, dilanjutkan dengan E atau klik.
- Jurnal (J): chapter selesai, lencana, easter egg ditemukan, tombol mulai ulang.
- Panel pengaturan dan pembelian di pedagang tetap berfungsi; misi berhenti menerima event saat dialog terbuka.

## Penyimpanan
Kunci `sur3d.story.v1`: `{ version, chapterIndex, stepIndex, badges[], eggs[], bestLapSeconds }`. Dompet tetap per sesi kecuali hadiah, yang disimpan sebagai saldo tambahan. Data rusak atau versi tak dikenal → diabaikan dan mulai dari awal, tanpa crash.

## Penanganan error
Titik tujuan/NPC yang hilang di layout → langkah dilewati dan dicatat di console (dev). localStorage tidak tersedia → progres hanya di memori.

## Pengujian
- Unit test reducer untuk tiap objective, urutan chapter, gagal waktu, hadiah, easter egg.
- Test storage: round-trip, versi salah, data rusak.
- Test lapTracker: checkpoint berurutan, tidak bisa curang dengan memutar balik.
- Verifikasi manual di browser: tiap chapter bisa diselesaikan; reload mempertahankan progres.

## Risiko
- Penanda dunia mengganggu performa → satu instanced beam + satu mesh, nol lampu nyata baru.
- Penempatan NPC bentrok dengan collider → pakai titik dari `LAYOUT` dan uji jarak.
- Teks cerita terlalu panjang → dialog dibatasi 2–3 kalimat.

## Urutan pengerjaan (usulan)
1. Reducer + objective + storage dengan test (tanpa dunia).
2. StoryDirector + HUD + jurnal, chapter 1–2 bisa dimainkan.
3. Chapter 3–5, lapTracker, penanda dunia dan minimap.
4. Easter egg, lencana, polesan, README.
