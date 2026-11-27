/**
 * "Kotak potongan" + "daftar belanja" landmark (lihat docs/model/POTONGAN.md).
 * - PART_FILES: nama potongan → berkas GLB di public/models/potongan/ (satu mesh, warna per vertex, alas di y=0,
 *   depan = +Z, satuan meter). Mengganti tampilan satu potongan = mengganti berkasnya; semua pemakai ikut berubah.
 * - PART_RECIPES: id landmark → { frame, rules }. `frame` = persegi panjang acuan model (denah: x timur, y UTARA = −z three;
 *   ang = sudut sumbu panjang dari +x, berlawanan jarum jam). Aturan memakai koordinat (u, v): u sepanjang sumbu panjang,
 *   v melintang, y tinggi (m). yaw (derajat) relatif ke sumbu panjang.
 *   - { part, at: [[u, v, y, yaw?, skala?], ...] }                      titik satu per satu
 *   - { part, line: { from: [u, v], to: [u, v], y, count, yaw?, skala? } } berjajar rata di satu garis (termasuk kedua ujung)
 *   - { part, ring: { step, ys: [...], offset?, margin?, minEdge?, maxEdge?, skala? } } berjajar mengikuti KELILING jejak,
 *     menghadap ke luar, di tiap ketinggian ys (mis. jendela per lantai). Butuh `ring: [[x, y], ...]` di resep = jejak gedung
 *     dalam denah model (x timur, y utara), bukan (u, v); cetak dari skrip Blender (fr.pts(way(...))).
 * Resep boleh punya `site: [[x, y], ...]` (denah model): tapak tertata; pohon/lampu acak tile tidak dibuat di dalamnya.
 * Murni data: tanpa impor.
 */
export const PART_FILES = Object.freeze({
  ac: 'ac.glb',
  pohon: 'pohon.glb',
  palem: 'palem.glb',
  lampu: 'lampu.glb',
  pot: 'pot.glb',
  kanopi: 'kanopi.glb',
  pintu: 'pintu.glb',
  jendela: 'jendela.glb',
  'jendela-lengkung': 'jendela-lengkung.glb',
  'air-mancur': 'air-mancur.glb',
  'lampu-taman': 'lampu-taman.glb',
});

/** Potongan yang melempar bayangan (yang besar saja; tiap jenis berbayangan = +1 draw call di lintasan bayangan). */
export const PART_SHADOW = Object.freeze(['pohon', 'palem', 'kanopi']);

export const PART_RECIPES = Object.freeze({
  // Masjid Agung An-Nur (an_nur.py): model sejajar sumbu, DEPAN = −y denah; badan 54 × 65 m (dinding di x ±27, y ±32,5),
  // plaza 120 × 110 m di depan (y −36,5 … −146,5), empat kolam di (±28, −64,5) dan (±28, −118,5).
  'an-nur': {
    frame: { cx: 0, cy: 0, ang: 0, L: 1, W: 1 }, // identitas: u = x, v = y denah
    site: [[-60, -146.5], [60, -146.5], [60, -36.5], [30.5, -36.5], [30.5, 36.5], [-30.5, 36.5], [-30.5, -36.5], [-60, -36.5]],
    rules: [
      // jendela lengkung lantai bawah (y 2,4) dan jendela atas (y 9,6) di tiap ceruk antar-pilaster; portal & serambi dilewati
      { part: 'jendela-lengkung', line: { from: [-22.09, -32.5], to: [-17.18, -32.5], y: 2.4, count: 2 } },
      { part: 'jendela-lengkung', line: { from: [17.18, -32.5], to: [22.09, -32.5], y: 2.4, count: 2 } },
      { part: 'jendela-lengkung', line: { from: [-22.09, 32.5], to: [22.09, 32.5], y: 2.4, count: 10, yaw: 180 } },
      { part: 'jendela-lengkung', line: { from: [-27, -27.5], to: [-27, -7.5], y: 2.4, count: 5, yaw: -90 } },
      { part: 'jendela-lengkung', line: { from: [-27, 7.5], to: [-27, 27.5], y: 2.4, count: 5, yaw: -90 } },
      { part: 'jendela-lengkung', line: { from: [27, -27.5], to: [27, -7.5], y: 2.4, count: 5, yaw: 90 } },
      { part: 'jendela-lengkung', line: { from: [27, 7.5], to: [27, 27.5], y: 2.4, count: 5, yaw: 90 } },
      { part: 'jendela', line: { from: [-22.09, -32.5], to: [-17.18, -32.5], y: 9.6, count: 2 } },
      { part: 'jendela', line: { from: [17.18, -32.5], to: [22.09, -32.5], y: 9.6, count: 2 } },
      { part: 'jendela', line: { from: [-22.09, 32.5], to: [22.09, 32.5], y: 9.6, count: 10, yaw: 180 } },
      { part: 'jendela', line: { from: [-27, -27.5], to: [-27, -7.5], y: 9.6, count: 5, yaw: -90 } },
      { part: 'jendela', line: { from: [-27, 7.5], to: [-27, 27.5], y: 9.6, count: 5, yaw: -90 } },
      { part: 'jendela', line: { from: [27, -27.5], to: [27, -7.5], y: 9.6, count: 5, yaw: 90 } },
      { part: 'jendela', line: { from: [27, 7.5], to: [27, 27.5], y: 9.6, count: 5, yaw: 90 } },
      // plaza: air mancur di empat kolam, poros palem, lampu taman, pohon peneduh di tepi, pot di kaki tangga
      { part: 'air-mancur', at: [[-28, -64.5, 0.12], [28, -64.5, 0.12], [-28, -118.5, 0.12], [28, -118.5, 0.12]] },
      { part: 'palem', line: { from: [-9, -47], to: [-9, -141], y: 0.12, count: 9 } },
      { part: 'palem', line: { from: [9, -47], to: [9, -141], y: 0.12, count: 9 } },
      { part: 'lampu-taman', line: { from: [-45, -44], to: [-45, -140], y: 0.12, count: 7 } },
      { part: 'lampu-taman', line: { from: [45, -44], to: [45, -140], y: 0.12, count: 7 } },
      { part: 'pohon', line: { from: [-56, -42], to: [-56, -142], y: 0.12, count: 8 } },
      { part: 'pohon', line: { from: [56, -42], to: [56, -142], y: 0.12, count: 8 } },
      { part: 'pot', at: [[-21, -47, 0.12], [21, -47, 0.12]] },
    ],
  },
  // Mal SKA (acuan dari min_rect jejak OSM di bangunan.py: L 150,9 × W 111,6; atap di y 22,5; tepi fasad sisi +v di v ≈ 55,1)
  'mal-ska': {
    frame: { cx: -1.926, cy: 0.827, ang: 0.157, L: 150.899, W: 111.646 },
    rules: [
      // atap: 8 unit AC di dua lajur luar skylight (saluran udaranya masih dari skrip model)
      { part: 'ac', line: { from: [-49.8, 41.3], to: [49.8, 41.3], y: 22.5, count: 4 } },
      { part: 'ac', line: { from: [-49.8, -41.3], to: [49.8, -41.3], y: 22.5, count: 4 } },
      // parkiran sisi jalan (+v): deret pohon di kedua tepi, lampu di lorong tengah
      { part: 'pohon', line: { from: [-54.3, 58.8], to: [66.4, 58.8], y: 0.35, count: 9 } },
      { part: 'pohon', line: { from: [-54.3, 88.3], to: [66.4, 88.3], y: 0, count: 9, skala: 0.9 } },
      { part: 'lampu', line: { from: [-48, 73.8], to: [60, 73.8], y: 0.05, count: 6, yaw: 90 } },
      // pintu masuk kedua menghadap parkiran: pintu kaca + kanopi (yaw 180 = depan ke arah +v)
      { part: 'pintu', at: [[0, 55.2, 0.35, 180]] },
      { part: 'kanopi', at: [[0, 55.2, 0.35, 180]] },
      // pelataran depan (+u): pot tanaman, pohon, lampu di tepi jalur antar-jemput
      { part: 'pot', at: [[97.4, -40.2, 0.06, 90], [97.4, -20.1, 0.06, 90], [97.4, 20.1, 0.06, 90], [97.4, 40.2, 0.06, 90]] },
      { part: 'palem', at: [[102.4, -40.2, 0.06, 0], [102.4, -20.1, 0.06, 40], [102.4, 20.1, 0.06, 80], [102.4, 40.2, 0.06, 120]] },
      { part: 'lampu', line: { from: [92.6, -45], to: [92.6, 45], y: 0.06, count: 5 } },
    ],
  },
  // Perpustakaan Soeman Hs. (b_soeman di bangunan.py: min_rect jejak L 136,7 × W 44,1; ang ≈ π → +u barat, +v selatan).
  // Depan = sisi −v (utara): podium sampai v −24,6, tangga sampai v −27,6, muka kaca lobi di v −22,0 (y 1,0).
  'perpustakaan-soeman-hs': {
    frame: { cx: 0.05, cy: -0.05, ang: 3.1329, L: 136.724, W: 44.109 },
    // tapak (denah model): podium + halaman depan (+y); pohon acak tile di dalamnya tidak dibuat. Sisi belakang (−y) berbatas
    // langsung dengan bangunan tetangga dari OSM, jadi tidak ditanami.
    site: [[-75, -26], [75, -26], [75, 36], [-75, 36]],
    rules: [
      // pintu masuk + kanopi di muka lobi (yaw 0 = depan ke arah −v)
      { part: 'pintu', at: [[0, -22.05, 1.0, 0]] },
      { part: 'kanopi', at: [[0, -22.05, 1.0, 0]] },
      // halaman depan: palem kiri-kanan tangga, pot di kaki tangga, lampu taman berjajar
      { part: 'palem', line: { from: [-16, -27.5], to: [-46, -27.5], y: 0, count: 4 } },
      { part: 'palem', line: { from: [16, -27.5], to: [46, -27.5], y: 0, count: 4 } },
      { part: 'pot', at: [[-13, -28.6, 0], [13, -28.6, 0]] },
      { part: 'lampu-taman', line: { from: [-55, -31.5], to: [55, -31.5], y: 0, count: 6 } },
    ],
  },
  // Kantor Gubernur Riau (b_gubernur di bangunan.py: min_rect sayap kantor L 102,9 × W 25,3; ang ≈ π/2 → +u utara, +v barat).
  // Depan = sisi −v (TIMUR, halaman ke Jl. Sudirman): fasad v −12,65, teras paviliun tengah sampai v −25,35 (y 0,9),
  // tangga (u ±9) sampai v −28,55, muka paviliun tengah v −18,65. Menara di selatan (u < −55); pintunya di (u −108,1, v −37,9).
  'kantor-gubernur-riau': {
    frame: { cx: -11.5, cy: 46.65, ang: 1.5621, L: 102.925, W: 25.303 },
    // tapak (denah model): podium sayap + halaman depan 30 m; sisi barat berbatas gedung kantor lain, tidak ditanami
    site: [[-25.1, -6.7], [-24.2, 100.2], [31.6, 99.7], [30.7, -7.2]],
    rules: [
      // pintu utama + kanopi di muka paviliun tengah (di bawah beranda bertiang); pintu + kanopi kecil menara
      { part: 'pintu', at: [[0, -18.7, 0.9, 0], [-108.1, -37.9, 0, 0]] },
      { part: 'kanopi', at: [[0, -18.7, 0.9, 0]] },
      // halaman depan: palem kiri-kanan tangga, pot di kaki tangga, lampu taman di tepi halaman, pohon di sudut
      { part: 'palem', line: { from: [-14, -28], to: [-26, -28], y: 0, count: 3 } },
      { part: 'palem', line: { from: [14, -28], to: [26, -28], y: 0, count: 3 } },
      { part: 'pot', at: [[-10, -28, 0], [10, -28, 0]] },
      { part: 'lampu-taman', line: { from: [-48, -40], to: [48, -40], y: 0, count: 7 } },
      { part: 'pohon', at: [[-46, -36, 0], [-38, -40.5, 0, 0, 0.9], [46, -36, 0], [38, -40.5, 0, 0, 0.9]] },
    ],
  },
  // Mall Pekanbaru (b_mall_pekanbaru di bangunan.py: min_rect jejak L 82,5 × W 62,4; ang 0 → +u timur, +v utara; u = x + 0,05).
  // Muka utama = barat (Jl. Sudirman), fasad u −41,3 (v −4,3 … 16); drum kaca di sudut barat laut, pusat (u −35,25, v 25,2).
  // Atap podium y 23: atap mekanikal barat (skylight v 2…10, rumah mesin v 18…24). Blok padat: tanpa `site`, potongan ≤ 8 m dari jejak.
  'mall-pekanbaru': {
    frame: { cx: -0.05, cy: 0, ang: 0, L: 82.5, W: 62.4 },
    rules: [
      // unit AC dua lajur di atap mekanikal (di antara skylight, rumah mesin, dan tepi selatan blok utara)
      { part: 'ac', line: { from: [-21.95, 14], to: [-5.95, 14], y: 23, count: 5 } },
      { part: 'ac', line: { from: [-29.95, -1.5], to: [-7.95, -1.5], y: 23, count: 5 } },
      // pintu samping di muka barat, di bawah videotron (yaw −90 = depan ke arah −u / barat)
      { part: 'pintu', at: [[-41.3, 3.5, 0, -90]] },
      { part: 'kanopi', at: [[-41.3, 3.5, 0, -90]] },
      // trotoar muka barat: pot kiri-kanan kanopi, lampu (lengan ke arah gedung)
      { part: 'pot', at: [[-44.3, -6, 0, -90], [-44.3, 13, 0, -90]] },
      { part: 'lampu', line: { from: [-48.5, -3], to: [-48.5, 19], y: 0, count: 3, yaw: 90 } },
      // palem di kiri-kanan kanopi lengkung drum + dua di trotoar Jl. Teuku Umar
      { part: 'palem', at: [[-36.45, 39.13, 0], [-49.2, 26.42, 0, 40], [-26.95, 37, 0, 80], [-16.95, 37, 0, 120]] },
    ],
  },
  // Swiss-Belinn SKA: menara 9 lantai (alas 10,5 m, tinggi lantai 3,6 m). Jendela = potongan di dua sisi panjang;
  // sisi pendek ditempati balkon dari skrip model.
  'swiss-belinn-ska': {
    ring: [[-22.0, 7.2], [-19.2, -13.0], [22.0, -7.9], [19.2, 13.0]],
    rules: [
      { part: 'jendela', ring: { step: 3.2, ys: [11.4, 15.0, 18.6, 22.2, 25.8, 29.4, 33.0, 36.6, 40.2], margin: 2.0, minEdge: 30, offset: 0 } },
    ],
  },
});
