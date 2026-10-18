# Katalog aset: Kawasan Kampus UNRI (placeholder → final)

Tanggal: 2026-10-17 · Pasangan dari `2026-10-17-unri-kampus-design.md`

Setiap aset punya **placeholder prosedural berukuran persis** (dibuat di kode, pola `parts`/`groupFromParts`)
sehingga scene lengkap sejak awal. Versi **final** (Blender → GLB atau prosedural detail) menggantikan
placeholder lewat mekanisme `placeModels` + `replaces` yang sudah ada (`src/world/assets/models.js:73-91`):
placeholder diberi `name` = ID aset; GLB final berhasil dimuat → placeholder disembunyikan.

Kolom:
- **Dimensi**: L × P × T dalam meter (lebar X × panjang Z × tinggi Y), pusat alas di (0,0,0), menghadap −Z.
- **Segitiga**: budget LOD0 final (LOD1 = ±30% bila ada).
- **Final**: `B` = Blender GLB (`assets-src/blender/unri/<id>.blend` → `public/models/unri/<id>.glb`),
  `P` = prosedural detail di kode.
- **Prio**: 1 = wajib di tonggaknya, 2 = sebaiknya, 3 = nanti.
- **Keyakinan**: T/S/R/INF sesuai riset (`docs/research/kampus-unri-bina-widya.md`).

Aturan bersama aset Blender:
- Skala meter, Y-up saat ekspor (`export_glb.py` sudah `export_yup`), origin di tengah alas, menghadap −Z.
- Material bernama `unri:<nama>` (warna/tekstur) agar registry malam/basah bisa memilih; kaca → nama berisi
  `kaca`, lampu → `emisif`.
- Tanpa tekstur foto berlisensi; tekstur dicat/prosedural di Blender atau atlas kit.
- Gabung per material saat ekspor (perilaku `export_glb.py`), decimate sampai budget.
- Status awal semua aset: `placeholder`. Ubah ke `final` di tabel ini saat GLB/prosedural detail masuk.

---

## 1. Gedung (arketipe kit, `P`, M3)

Arketipe adalah aset parametrik, bukan model tetap. Budget per gedung tipikal (LOD0, termasuk ornamen).

| ID | Nama | Dimensi tipikal | Segitiga | Placeholder | Final | Prio | Keyakinan |
|---|---|---|---|---|---|---|---|
| K01 | kuliah-koridor | 40 × 12 × 4–8 | 6–12k | massa + atap pelana | P | 1 | T (lantai/atap), INF (warna) |
| K02 | dekanat | 35 × 14 × 8 | 10–15k | K01 + kotak teras | P | 1 | T/INF |
| K03 | adb-layar | 50 × 50 × 15 | 15–25k | massa putih + bidang oranye | P | 1 | T (foto) |
| K04 | lab-bengkel | 30 × 15 × 5–10 | 5–9k | massa + atap tinggi | P | 1 | INF |
| K05 | aula | 30 × 20 × 7 | 5–8k | massa tinggi | P | 1 | INF |
| K06 | musala | 10 × 10 × 6 | 3–6k | kotak + limas | P | 1 | INF |
| K07 | kantin | 20 × 10 × 4 | 4–7k | atap di atas kolom | P | 1 | T (ada), INF (bentuk) |
| K08 | pendopo-kayu | 12 × 12 × 6 | 3–5k | tiang + limas | P | 2 | T (dinding kayu OSM) |
| K09 | rusun | 69 × 23 × 17 | 15–20k | massa 5 lt | P | 1 | T |
| K10 | mangkrak | sesuai OSM | 8–15k | rangka kolom-balok | P | 1 | T |
| K11 | utilitas | ≤ 8 × 8 × 4 | 0,5–2k | kotak + atap | P | 1 | INF |
| K12 | ekstrusi-rapi | sesuai OSM | 1–4k | ekstrusi | P | 1 | — |

## 2. Hero building (handmade, M4/M6)

| ID | Nama | Dimensi | Segitiga | Placeholder | Final | Prio | Keyakinan / rujukan |
|---|---|---|---|---|---|---|---|
| H01 | hero:sekretariat-lembaga | 16,8 × 15,7 × 4,2 | 25k | massa + selasar tengah | P + aset S/N | 1 (M4) | T footprint `way/327530276`; INF denah |
| H02 | hero:stadion-mini | ±123 × 203 (tapak OSM) | 40k | lapangan + tribun kotak | P | 1 (M4) | T kapasitas 5.000; INF tribun |
| H03 | hero:student-center | 53 × 51 × 16 | 25k | K03 | P | 1 (M4) | T fungsi/lokasi; S way id; interior foto (space truss, plafon hitam) |
| H04 | hero:rektorat | 38 × 65 × 22 | 40k | massa 5 lt putih | P + B (huruf nama, kanopi) | 1 (M6) | T foto drone 2016 (Commons Taman_Unri.jpg) |
| H05 | hero:masjid-arfaunnas | 40 × 42 × 22 | 40k | kotak 2 lt + kubah | P + B (kubah mozaik, mahkota) | 1 (M6) | T foto Commons Masjid_Arfaunnas_unri.jpg |
| H06 | hero:gerbang-sm-amin | ±20 × 4 × 8 | 10k | gapura kotak | P/B | 1 (M6) | S (posisi dari OSM di M6) |
| H07 | hero:ggm | Ø 82 × 25 | 35k | silinder + atap kerucut | P | 2 (M6) | T bentuk/sejarah; R kondisi 2026 |
| H08 | hero:perpustakaan-lama | 4 massa 2 lt | 20k | 4 × K01 | P | 2 (M6) | S |

## 3. Ornamen & penanda hero (`B`)

| ID | Nama | Dimensi | Segitiga | Placeholder | Final | Prio | Tonggak | Keyakinan |
|---|---|---|---|---|---|---|---|---|
| N01 | papan-batu-unri (lengkung "UNIVERSITAS RIAU") | 6 × 1,2 × 1,6 | 6k | kotak lengkung + teks canvas | B | 1 | M6 | T |
| N02 | huruf-nama-rektorat | 18 × 0,3 × 1,5 | 4k | teks canvas di bidang | B | 1 | M6 | T (ada huruf), INF (font) |
| N03 | kanopi-merah-rektorat | 8 × 8 × 5 | 3k | limas merah di 4 tiang | B | 1 | M6 | T (kanopi merah), R (bentuk) |
| N04 | kubah-mozaik-masjid | Ø 10 × 8 | 8k | setengah bola + tekstur wajik canvas | B | 1 | M6 | T |
| N05 | papan-nama-gedung (hitam, huruf putih) | 4 × 0,2 × 1 | 0,3k | panel + teks canvas | P | 1 | M3 | T (ADB), INF (gedung lama) |
| N06 | papan-nama-sekre (di atas pintu) | 1,6 × 0,05 × 0,4 | 0,1k | panel + teks canvas | P | 1 | M4 | INF pola umum |
| N07 | spanduk-ormawa | 4 × 0,02 × 1 | 0,1k | bidang + canvas | P | 1 | M4 | INF pola umum |
| N08 | spanduk-kuning-gerbang | 3 × 0,02 × 0,8 | 0,1k | bidang + canvas | P | 2 | M6 | T |
| N09 | papan-pengumuman | 1,5 × 0,1 × 1,8 | 0,5k | kotak + kertas canvas | P | 1 | M4 | INF |
| N10 | lambang-unri (Lancang Kuning, pentagon) | 1 × 0,05 × 1 | 2k | canvas di bidang | B | 2 | M7 | T (deskripsi), INF (gambar) |

## 4. Kendaraan & props kampus

| ID | Nama | Dimensi | Segitiga | Placeholder | Final | Prio | Tonggak | Keyakinan |
|---|---|---|---|---|---|---|---|---|
| A01 | motor-bebek | 0,7 × 1,9 × 1,05 | 3k | kotak bodi + 2 silinder roda | B (`a01-motor-bebek.glb`) | 1 | M4 | T (parkir padat) |
| A02 | motor-matic | 0,7 × 1,85 × 1,1 | 3k | sda | B (`a02-motor-matic.glb`) | 1 | M4 | T |
| A03 | motor-sport | 0,75 × 2,0 × 1,1 | 3,5k | sda | B | 2 | M7 | INF |
| A04 | motor-tua | 0,7 × 1,9 × 1,0 | 3k | sda | B | 3 | M7 | INF |
| P01 | pos-satpam-kampus | 2,5 × 2,5 × 3 | 2k | K11 | P | 1 | M4 | T (ada satpam) |
| P02 | halte-tmp | 6 × 2 × 3 | 3k | atap di 4 tiang + bangku | B | 2 | M7 | T (halte OSM) |
| P03 | pju-kampus | 0,3 × 1,5 × 7 | 0,8k | tiang + kepala | P | 1 | M2 | INF |
| P04 | bangku-beton-taman | 1,8 × 0,5 × 0,45 | 0,4k | reuse `Bench` | P | 1 | M2 | T (bangku diskusi) |
| P05 | tong-sampah-kampus | 0,5 × 0,5 × 0,9 | 0,3k | silinder | P | 2 | M2 | INF |
| P06 | tiang-bendera | 0,15 × 0,15 × 10 | 0,5k | reuse `Flagpole` | P | 1 | M6 | T (Rektorat) |
| P07 | rak-sepatu-teras | 1,2 × 0,35 × 0,9 | 0,8k | kotak rak | P | 1 | M4 | INF |
| P08 | sandal-tumpuk | 0,8 × 0,5 × 0,05 | 0,6k | pipih berwarna | P | 1 | M4 | INF |
| P09 | jemuran-almamater | 2 × 0,1 × 1,8 | 1,5k | tali + jaket biru langit | P | 2 | M4 | INF |
| P10 | galon-kosong | Ø 0,27 × 0,5 | 0,3k | silinder | P | 2 | M4 | INF |
| P11 | batu-pijakan-danau | 0,8 × 0,8 × 0,3 | 0,1k | kotak | P | 1 | M6 | T |
| P12 | gerobak-pkl-kampus | 1,8 × 0,8 × 1,8 | 3k | reuse gerobak stadion | P | 3 | M7 | GAP (PKL di kampus belum terkonfirmasi) |

## 5. Vegetasi (`P` instans; LOD via jarak)

| ID | Nama | Tinggi | Segitiga | Placeholder | Final | Prio | Tonggak | Keyakinan |
|---|---|---|---|---|---|---|---|---|
| V01 | mahoni | 12–18 m | 1,5k | batang + gumpalan tajuk lebar | P (gaya vegetasi yang ada) | 1 | M2 | T dominan |
| V02 | angsana | 10–15 m | 1,5k | tajuk payung | P | 1 | M2 | T |
| V03 | saga | 8–12 m | 1,2k | tajuk renggang | P | 2 | M2 | T |
| V04 | akasia-ramping | 15–20 m | 1k | tajuk sempit tinggi | P | 1 | M6 | INF spesies (visual T) |
| V05 | palem | 6–10 m | 1k | batang + daun pita | P | 1 | M6 | T |
| V06 | sawit | 6–9 m | 1,5k | pelepah radial | P | 2 | M2 | T (kebun 4,2 ha) |
| V07 | semak-pagar | 1 m | 0,3k | gumpalan | P | 1 | M2 | INF |
| V08 | ilalang | 0,8 m | instans bilah | rumput tinggi | P | 1 | M4 | T (GGM/FH mangkrak) |

## 6. Interior sekre (M5)

| ID | Nama | Dimensi | Segitiga | Placeholder | Final | Prio | Interaksi |
|---|---|---|---|---|---|---|---|
| S01 | papan-struktur-kabinet | 1,8 × 0,03 × 1,2 | 0,2k | panel + canvas bagan dari data | P | 1 | E: lihat nama pengurus |
| S02 | papan-proker | 1,5 × 0,03 × 1 | 0,2k | panel + canvas timeline | P | 1 | E: baca proker |
| S03 | whiteboard | 1,2 × 0,05 × 0,9 | 0,3k | panel + canvas coretan | P | 1 | E: catatan rapat |
| S04 | kalender-dinding | 0,4 × 0,01 × 0,6 | 0,05k | bidang + canvas | P | 2 | — |
| S05 | jadwal-piket | 0,3 × 0,01 × 0,42 | 0,05k | bidang + canvas | P | 2 | — |
| S06 | piagam-bingkai (×4) | 0,4 × 0,02 × 0,3 | 0,1k | bingkai + canvas | P | 1 | E: lihat piagam |
| S07 | piala (×3 varian) | 0,15 × 0,15 × 0,45 | 2k | silinder + cangkir | B | 1 | (bagian E piagam) |
| S08 | bendera-meja (org, UNRI, Merah Putih) | 0,3 × 0,3 × 0,6 | 0,8k | tiang + bidang canvas | P | 1 | — |
| S09 | lemari-arsip-besi | 0,9 × 0,45 × 1,8 | 2k | kotak + pintu kaca | P | 1 | E: easter egg LPJ |
| S10 | map-ordner (instans, label tahun) | 0,08 × 0,3 × 0,32 | 0,05k | kotak warna | P | 1 | — |
| S11 | kardus-properti | 0,5 × 0,4 × 0,35 | 0,1k | kotak + flap | P | 2 | — |
| S12 | spanduk-tergulung | Ø 0,1 × 2 | 0,2k | silinder | P | 2 | — |
| S13 | dispenser-galon | 0,32 × 0,32 × 1,25 | 3k | kotak + silinder galon | B | 1 | E: isi gelas |
| S14 | kipas-berdiri | 0,45 × 0,45 × 1,3 | 4k | tiang + cakram berputar | B | 1 | E: toggle (suara + kertas berkibar) |
| S15 | printer-tua | 0,45 × 0,4 × 0,25 | 2k | kotak | B | 2 | — |
| S16 | meja-lipat-panjang | 1,8 × 0,6 × 0,75 | 0,8k | kotak + kaki | P | 1 | — |
| S17 | laptop (×2) | 0,34 × 0,24 × 0,23 | 1,5k | dua bidang + layar emisif | B | 1 | — |
| S18 | gelas-kopi / gelas plastik | Ø 0,08 × 0,1 | 0,2k | silinder | P | 2 | — |
| S19 | gitar-akustik | 0,38 × 0,1 × 1,0 | 4k | badan pipih + leher | B | 1 | E: genjrengan |
| S20 | tas-ransel (×3) | 0,3 × 0,2 × 0,45 | 1k | kotak membulat | B | 2 | — |
| S21 | sepatu-pasang (×4) | 0,3 × 0,12 × 0,1 | 0,4k | kotak pipih | P | 2 | — |
| S22 | karpet-ambal-marun | 3 × 4 × 0,01 | 0,1k | bidang + canvas motif | P | 1 | — |
| S23 | bantal-tikar | 0,5 × 0,35 × 0,1 | 0,3k | kotak membulat | P | 2 | — |
| S24 | lampu-tl-plafon (×2) | 1,2 × 0,1 × 0,08 | 0,2k | kotak emisif | P | 1 | — (dikendalikan S27) |
| S25 | stopkontak-sambungan + kabel | 0,3 × 0,06 × 0,04 | 0,5k | kotak + tabung | P | 2 | — |
| S26 | poster-acara (×4) | 0,42 × 0,01 × 0,6 | 0,05k | bidang + canvas | P | 1 | — |
| S27 | saklar-lampu | 0,08 × 0,02 × 0,12 | 0,05k | kotak | P | 1 | E: toggle TL |
| S28 | stiker-lemari/pintu (decal) | variasi | decal | canvas decal | P | 2 | — |
| S29 | jendela-nako-interior | 1,2 × 0,1 × 1,2 | 1k | bingkai + bilah kaca | P | 1 | E: lihat selasar |
| S30 | pintu-sekre | 0,9 × 0,05 × 2,1 | 0,8k | panel kayu + gagang | P | 1 | E: keluar |

## 7. NPC & animasi (M5/M7)

| ID | Nama | Placeholder | Final | Prio |
|---|---|---|---|---|
| C01 | mahasiswa-almamater (jaket biru langit) | Humanoid + warna outfit | P (outfit baru di `Humanoid`) | 1 |
| C02 | mahasiswa-kasual | Humanoid varian yang ada | P | 1 |
| C03 | pose sitCrossLegged | — | P (`Humanoid.poses.js`) | 1 |
| C04 | pose sitChairTyping | — | P | 1 |
| C05 | pose guitarStrum | — | P | 1 |
| C06 | pose lieDown | — | P | 1 |
| C07 | pose writeBoard | — | P | 2 |
| C08 | pose standTalk | — | P | 1 |
| C09 | pose drinkCup | — | P | 2 |
| C10 | satpam-kampus | Humanoid + seragam | P | 2 |

## 8. Ringkasan budget aset

- GLB baru (B): A01–A04, P02, N01–N04, N10, S07, S13, S14, S15, S17, S19, S20 → target total ≤ 6 MB.
- Prioritas 1 untuk M5 (interior siap tampil): S01–S03, S06, S07, S08, S09, S10, S13, S14, S16, S17, S19, S22,
  S24, S26, S27, S29, S30, C01, C03–C06, C08.
