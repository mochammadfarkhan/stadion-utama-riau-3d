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
  // Swiss-Belinn SKA: menara 9 lantai (alas 10,5 m, tinggi lantai 3,6 m). Jendela = potongan di dua sisi panjang;
  // sisi pendek ditempati balkon dari skrip model.
  'swiss-belinn-ska': {
    ring: [[-22.0, 7.2], [-19.2, -13.0], [22.0, -7.9], [19.2, 13.0]],
    rules: [
      { part: 'jendela', ring: { step: 3.2, ys: [11.4, 15.0, 18.6, 22.2, 25.8, 29.4, 33.0, 36.6, 40.2], margin: 2.0, minEdge: 30, offset: 0 } },
    ],
  },
});
