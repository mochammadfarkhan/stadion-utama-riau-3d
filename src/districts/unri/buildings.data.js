/**
 * Tabel override gedung kampus UNRI (spec §4.7). Kunci = id OSM ('w' way, 'r' relation) seperti di
 * public/districts/unri/buildings.json. Hanya gedung yang punya fakta di riset
 * (docs/research/kampus-unri-bina-widya.md) atau yang aturan nama-nya jelas salah sasaran.
 * Setiap entri WAJIB `sumber` + `keyakinan` ('tinggi'|'sedang'|'rendah'); bentuk yang tidak berfoto
 * ditandai [INF] di sumber. Divalidasi `validateOverrides` (tests/districts/resolveBuilding.test.js).
 */
export const BUILDING_OVERRIDES = Object.freeze({
  // ── Hero (handmade M4/M6; M3 memasang placeholder berukuran footprint) ─────────────────────────
  w282225347: Object.freeze({
    archetype: 'hero:rektorat', levels: 5, palette: 'putih', roof: 'datar-parapet', sign: 'REKTORAT UNIVERSITAS RIAU',
    sumber: 'foto drone 2016 Commons Taman_Unri.jpg (CC BY-SA 4.0; putih, ±5 lt, atap datar parapet gelap); OSM way/282225347 levels 4-7; dibangun region unri-rektorat (M6); teks papan [INF]',
    keyakinan: 'tinggi',
  }),
  w282230716: Object.freeze({
    archetype: 'hero:masjid-arfaunnas', levels: 2, roof: 'datar-parapet', sign: "MASJID ARFA' UNNAS UNIVERSITAS RIAU",
    sumber: 'foto 2023 Commons Masjid_Arfaunnas_unri.jpg (CC BY-SA 4.0; huruf timbul, 2 lt, krem); arfaunnas.unri.ac.id (ruang salat 27 × 27 m); OSM way/282230716',
    keyakinan: 'tinggi',
  }),
  w314450943: Object.freeze({
    archetype: 'hero:ggm', levels: 4, sign: null,
    sumber: 'lovinasoenmi 2013 (mangkrak), unri.ac.id wisuda 2015, mediacenter.riau.go.id; OSM way/314450943 (lingkaran Ø±82 m, levels 4-7); kondisi 2026 tidak diketahui',
    keyakinan: 'sedang',
  }),
  's-gerbang-sm-amin': Object.freeze({
    archetype: 'hero:gerbang-sm-amin', levels: 1, sign: 'UNIVERSITAS RIAU',
    sumber: 'nama, status gerbang utama, jam s.d. 20.00: Bahana Mahasiswa & cakaplah 2022; posisi: OSM node swing_gate 3031660118 & 12234023398 di dua jalur Jl. Muchtar Lutfi (Overpass 2026-10-18); desain: INFERENSI',
    keyakinan: 'sedang',
  }),
  w327530276: Object.freeze({
    archetype: 'hero:sekretariat-lembaga', levels: 1, sign: null,
    sumber: 'OSM way/327530276 "Sekretariat Lembaga Mahasiswa" (16,8 × 15,7 m); 1 lt & denah [INF] spec §8.1',
    keyakinan: 'sedang',
  }),
  w1480014538: Object.freeze({
    archetype: 'hero:student-center', levels: 3, sign: 'STUDENT CENTER',
    sumber: 'unri.ac.id gedung ADB: Gedung Serba Guna di Jl. Muchtar Lutfi antara asrama & stadion mini; way id cocok lokasi [S]; teks papan [INF]',
    keyakinan: 'sedang',
  }),
  w282225436: Object.freeze({
    archetype: 'hero:stadion-mini', levels: 2, sign: null,
    sumber: 'OSM way/282225436 "tribun stadion" (25 × 137 m) di Stadion Mini UNRI way/327364388; levels OSM 7 diragukan, bentuk tribun [INF]',
    keyakinan: 'rendah',
  }),
  // ── Gedung ADB berfoto (layar perforasi oranye) — footprint dari area amenity=university bernama ────
  w1313268659: Object.freeze({
    archetype: 'K03', variant: 'segitiga', levels: 4, palette: 'adb', roof: 'pelana-lebar', sign: 'INTEGRATED CLASSROOM',
    sumber: 'unri.ac.id "UNRI mulai fungsikan gedung-gedung bantuan ADB" Gambar-1 (putih, layar oranye motif segitiga, papan hitam huruf putih, 3–4 lt); OSM way/1313268659',
    keyakinan: 'tinggi',
  }),
  w1313268653: Object.freeze({
    archetype: 'K03', variant: 'wajik', levels: 4, palette: 'adb', roof: 'pelana-lebar', sign: 'HEALTH SCIENCES CENTER',
    sumber: 'unri.ac.id gedung ADB Gambar-4 (4 lt putih, kisi diagonal oranye-krem, atap pelana putih tritisan lebar); way id = nama OSM [S]; motif wajik [INF]',
    keyakinan: 'sedang',
  }),
  // ── Mangkrak ─────────────────────────────────────────────────────────────────────────────────
  w327366046: Object.freeze({
    archetype: 'K10', variant: 'beratap', levels: 3, palette: 'beton-mentah', roof: 'pelana', sign: null,
    sumber: 'goriau.com: Gedung FH Panam belum dipakai, 2015 dinding & listrik belum selesai, lahan sengketa HTJ; OSM way/327366046 3 lt, building:roof=tin; bentuk atap & rupa rangka [INF]',
    keyakinan: 'tinggi',
  }),
  w1313268658: Object.freeze({
    archetype: 'K10', variant: 'rangka', levels: 2, sign: null,
    sumber: 'OSM way/1313268658 nama "Gedung Mangkrak FISIP UNRI"; jumlah lantai & rupa [INF]',
    keyakinan: 'sedang',
  }),
  // ── Hunian & perpustakaan ─────────────────────────────────────────────────────────────────────
  w327366048: Object.freeze({
    archetype: 'K09', levels: 5, roof: 'datar-parapet', sign: null,
    sumber: 'OSM way/327366048 apartments 5 lt roof=concrete; unri.ac.id Rusunawa (±96 kamar, putra); Bahana: Wisma Binawidya 5 lt tanpa lift',
    keyakinan: 'tinggi',
  }),
  w282225374: Object.freeze({
    archetype: 'hero:perpustakaan-lama', levels: 2, sign: 'PERPUSTAKAAN UNIVERSITAS RIAU',
    sumber: 'lib.unri.ac.id sejarah (ringkasan): empat gedung masing-masing dua lantai, pindah 1992; OSM way/282225374; dibangun region unri-rektorat (M6); papan [INF]',
    keyakinan: 'sedang',
  }),
  // ── Aturan nama salah sasaran ──────────────────────────────────────────────────────────────────
  w282225390: Object.freeze({
    archetype: 'K01', levels: 2,
    sumber: 'OSM way/282225390 Balai Bahasa Provinsi Riau: building:walls=brick, 2 lt, office=government (bukan pendopo kayu); bentuk [INF]',
    keyakinan: 'sedang',
  }),
  w282225429: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/282225429 "Area Parkir Motor FKIP (Gedung F)" amenity=motorcycle_parking; bentuk naungan berkolom [INF]',
    keyakinan: 'sedang',
  }),
  w327698565: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/327698565 "Area Parkir Motor FKIP (Dekanat)" amenity=motorcycle_parking; bentuk naungan [INF]',
    keyakinan: 'sedang',
  }),
  w282225419: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/282225419 "Area Parkir Mobil FKIP (Dekanat)" amenity=parking_space; bentuk naungan [INF]',
    keyakinan: 'sedang',
  }),
  w282225395: Object.freeze({
    archetype: 'K07', variant: 'parkir', sign: null,
    sumber: 'OSM way/282225395 "Area Parkir Perpustakaan UNRI" (9,7 × 9,5 m); bentuk naungan [INF]',
    keyakinan: 'sedang',
  }),
});

/**
 * Bangunan sintetis (tidak ada di OSM) yang tetap dirakit distrik lewat override hero. Ring = tapak yang
 * menghalangi collider (hanya pos satpam; pilar gerbang tidak menghalangi agar jalan tetap terbuka) =
 * GERBANG.pos di bingkai GERBANG_SITE (src/world/kit/hero/gerbangSmAmin.js). Disisipkan ke buildings.json
 * oleh tools/campusbake/buildings.js.
 */
export const SYNTHETIC_BUILDINGS = Object.freeze([
  Object.freeze({
    id: 's-gerbang-sm-amin',
    ring: Object.freeze([[383.57, 679.41], [383.6, 682.41], [380.61, 682.45], [380.57, 679.45]].map((p) => Object.freeze(p))),
    levels: 1,
    tags: Object.freeze({ name: 'Gerbang SM Amin (pos satpam)', building: 'guardhouse', barrier: 'gate' }),
  }),
]);
