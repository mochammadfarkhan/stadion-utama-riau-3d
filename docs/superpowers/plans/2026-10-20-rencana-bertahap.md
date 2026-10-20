# Rencana bertahap (setelah semua agen M8 selesai) — dikerjakan langsung, tanpa agen

Aturan: ikuti `AGENTS.md` (6 langkah). Tiap tahap = satu atau beberapa fitur kecil, dikerjakan satu per satu: ubah → cek cepat → 1–2 bidikan → commit.
Branch per tahap dari `main` terbaru, push + PR bila hijau. Perkiraan waktu = kerja langsung (kasar, bukan janji).
Ukur dulu, baru optimasi: titik standar = halaman sekre ERC (3/4 dan mata), jalan kampus, stadion, Rektorat/danau; catat draw call, segitiga, waktu frame, memori tekstur.

## Tahap 0 — Penggabungan M8 (±20 mnt)
- Gabung `feat/m8-t3`, `feat/m8-air`, `feat/m8-t4` ke satu branch; selesaikan konflik (kemungkinan `styleManager.js`, `schema.js`).
- Jadikan **kartun gaya default** (tombol L kembali ke asli), kamera 3/4 tetap lewat C.
- Perbaiki CI: ambang coverage (lines 89,6% < 90%) — kecualikan berkas bergantung WebGL dari daftar coverage, jangan menurunkan ambang.
- Commit `AGENTS.md`, `CLAUDE.md`, dan rencana ini; push + satu PR.
- **Selesai bila:** lint, vitest, build hijau; CI hijau; bidikan gabungan sekre/danau dibaca dan tidak ada yang rusak.

## Tahap 1 — Sisa kualitas visual M8 (±40 mnt)
Dari kekurangan laporan T3/P2/T4:
- Interior sekre: lantai keramik, dinding plester, perabot kayu memakai tekstur PBR (pasang manual karena scene interior tidak dipindai styleManager).
- Lantai hutan masih kusam/kebiruan dan bercak tanah merah muda: setel `MOIST_TINT`/`DRY_TINT` dan proporsi rumput.
- Atap dari atas: pola garis putus-putus (tile 1,2 m) → perbesar tile/kurangi detail.
- Cek yang belum pernah dilihat: dinding kit di Rektorat/FKIP, air malam/hujan/Waduk, pohon kartu di hutan lebat, kartun saat hujan.
- **Selesai bila:** bidikan sekre (3/4, mata, interior), Rektorat, danau (siang, sore, malam, hujan) dibaca dan layak.

## Tahap 2 — Performa dunia terbuka (±60–90 mnt, ukur sebelum dan sesudah)
Urut dari dampak terbesar:
1. **Stadion jauh:** hilangkan detail di atas ±600 m (kursi, penonton, rib, props) atau gabung jadi mesh murah (HLOD); target −150 sampai −250 draw call saat jauh.
2. **Bayangan:** hanya objek dekat yang `castShadow`; bayangan tidak digambar untuk pohon LOD jauh dan props kecil.
3. **Pohon jauh:** billboard/impostor murah di luar LOD1 (kartu daun hanya di dekat).
4. **Tekstur:** konversi ke KTX2/Basis (periksa ketersediaan `toktx`/basisu; bila tidak ada, ukuran 256 untuk jauh) — target VRAM −50%.
5. **Hentakan saat memuat:** ukur p95 saat tile/region dimuat; pindahkan parsing GLB ke worker hanya bila terbukti > 50 ms di HP.
- **Selesai bila:** tabel sebelum/sesudah di titik standar menunjukkan draw call dan frame lebih ringan, tanpa regresi visual di bidikan kunci.

## Tahap 3 — Penataan dan polesan (±60 mnt)
- Penataan benda kecil lewat generator di halaman ERC, deret sekre, tepi lapangan, jalan (galon, karung, kursi plastik, jemuran, pot, sepeda; ≤ 400 instans per zona).
- Contact shadow untuk NPC, tiang, sepeda; fade pohon yang menutup pemain di kamera 3/4.
- Gedung yang masih sederhana: aula (K05), kantin (K07), jendela K01; motor sport.
- Dermaga: collider pejalan kaki bila perlu; sungai/kolam kecil lain.
- **Selesai bila:** halaman ERC dan kampus terasa "hidup" di bidikan, anggaran draw call tetap.

## Tahap 4 — UI dan efek opsional (±30–45 mnt)
- UI tema kartu perkamen (CSS) untuk HUD, jurnal, panel, prompt E; aktif di kartun.
- Tilt-shift/bloom: tuning bila FPS aman (default tetap).
- **Selesai bila:** HUD serasi di siang/malam dan ponsel; mode asli tidak berubah.

## Tahap 5 — Isi dan QA akhir (±30 mnt + masukan user)
- **Butuh user:** isi sekre ERC yang asli (pengurus, proker, piagam, foto ruang), kepanjangan ERC, konfirmasi letak ruang.
- Galeri 8 titik, tabel performa akhir, README, atribusi (tekstur CC0, SRTM, OSM), catatan fakta vs inferensi.
- **Selesai bila:** semua PR ter-merge, CI hijau, README mutakhir.

## Di luar rencana (tidak dikerjakan kecuali diminta)
Lalu lintas berjalan, interior lain selain sekre, terrain seluruh kota, WebGPU, multiplayer.

## Status (diperbarui 2026-10-20, dikerjakan langsung tanpa agen)
- **Tahap 0:** selesai (PR #12): gabungan M8, kartun default, coverage CI.
- **Tahap 1:** selesai kecuali pengecekan visual Rektorat (skrip bidik `m6Visual.mjs` gagal jalan; belum dilihat). Interior sekre: dinding plester PBR (lantai keramik PBR dibatalkan: Tiles074 berupa marmer hitam-putih). Atap dan tint tanah kering dikoreksi. Air malam dan hujan sudah dilihat.
- **Tahap 2:** stadion jauh selesai (detail kecil disembunyikan > 650 m lewat layer 0; saat 700 m segitiga −52%, draw call −13%; 1100 m segitiga −53%, draw call −31%); frustum bayangan kartun 130 m (titik dekat stadion: draw call −11%, segitiga −8%). **Dilewati:** KTX2 (alat `toktx` tidak ada; butuh izin unduh program), pohon jauh sebagai billboard (LOD1 sudah 116–232 segitiga), parsing GLB di worker (belum ada hentakan terukur).
