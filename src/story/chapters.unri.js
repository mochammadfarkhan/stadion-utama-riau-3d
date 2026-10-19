/**
 * Chapter 6 "Kampus Biru Langit" (spec UNRI §8.4): 4 misi di Kampus UNRI Bina Widya —
 * (1) antar nasi kotak konsumsi rapat dari Kantin FKIP ke sekre ERC (`deliver`), (2) minta tanda tangan Ketua BEM di depan
 * sekre BEM (`interact` NPC), (3) satu putaran Danau Buatan (`goto` berantai), (4) masuk sekre ERC dan nyalakan kipas
 * (`interact` barang interior). Sekre pemain = ERC di gedung UKM blok biru (pintu D5, halaman barat sayap utara–selatan);
 * Ketua BEM tetap di deretan Sekretariat Lembaga Mahasiswa. Titik memakai region 'world' (keputusan D2): koordinat dunia ENU dihitung dari OSM
 * (proyeksi WORLD_ORIGIN) dan dikunci terhadap data M3–M6 oleh tests/storyUnri.test.js.
 * Kak Nisa dan Bang Raka adalah tokoh fiksi permainan, bukan orang nyata.
 */
const freezeDeep = (o) => {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') freezeDeep(v); });
  return Object.freeze(o);
};
const world = (x, z) => ({ region: 'world', x, z });

/** Id interactable kipas di interior sekre (M5; diverifikasi Task 0 Step 5 dan tests/storyUnri.test.js). */
export const SEKRE_KIPAS_ID = 'kipas';

export const UNRI_POINTS = freezeDeep({
  /** Depan Kantin FKIP way/282225371 (tepi utara z 1142,8): posisi pedagang kantin. */
  kantinFkip: world(-790.0, 1140.8),
  /** Ujung barat selasar Sekretariat Lembaga Mahasiswa way/327530276 + 2,5 m (pusat − 10,9·u, u = sumbu panjang): sekre BEM. */
  sekreUjungBarat: world(-229.8, 1095.6),
  /** Titik pemicu pintu sekre pemain (ERC, pintu D5 gedung UKM blok biru) 1 m di depan pintu: penanda misi kipas. */
  sekrePintu: world(-94.65, 1005.52),
  /** Keliling Danau Buatan way/373856980, 10–14 m dari tepi air: timur, selatan, barat, utara. */
  danau: [world(-698.0, 806.0), world(-758.6, 859.8), world(-846.4, 894.3), world(-785.4, 820.2)],
});

/**
 * Kak Nisa berdiri di halaman beton di depan pintu D5 (ERC), 3,5 m dari titik pemicu pintu, menghadap pintu. Ketua BEM berdiri di rumput
 * di luar mulut barat selasar deretan Sekretariat Lembaga (sisi utara; sisi selatan terisi motor teras M4 dan rak sepatu).
 */
const KAK_NISA = world(-97.0, 1002.0);
const KETUA_BEM = world(-227.5, 1090.2);
const FACE_NISA = 0.59;   // atan2(dx, dz) ke titik depan pintu D5 (−94,65; 1005,52)
const FACE_BEM = -0.39;

/** NPC cerita kampus: `zone` = id region logis untuk target interact (D5); `look` = pakaian (StoryNpcs). */
export const UNRI_STORY_NPCS = freezeDeep([
  { id: 'ketua-bem', name: 'Bang Raka (Ketua BEM)', zone: 'unri-lembaga', look: 'almamater', ...KETUA_BEM, yaw: FACE_BEM },
  { id: 'kak-nisa', name: 'Kak Nisa (Sekum)', zone: 'unri-lembaga', look: 'almamater', ...KAK_NISA, yaw: FACE_NISA },
]);

/**
 * Pedagang kantin (D4). Koordinat frame region stadion (placement stadion ≈ identitas, geser < 2 cm; Plan C Task 18),
 * sama dengan koordinat dunia. Menghadap utara (yaw π) ke jalan servis di depan kantin.
 */
export const UNRI_VENDORS = freezeDeep([
  { id: 'kantin-fkip', kind: 'kantin', name: 'Kantin FKIP', banner: 'NASI KOTAK', waypoints: [{ x: -790.0, z: 1140.8 }], yaw: Math.PI },
]);

const danauStep = (n, where, extra = {}) => ({
  id: `danau-${n}`, mission: 3, text: `Keliling Danau Buatan: penanda ${n}/5 ${where}`,
  objective: { type: 'goto', target: UNRI_POINTS.danau[(n - 1) % 4], radius: 12 }, ...extra,
});

export const CHAPTER_KAMPUS = freezeDeep({
  id: 'kampus-biru-langit',
  title: 'Kampus Biru Langit',
  rank: 'Aktivis Kampus',
  outro: [
    'Kipas berputar, kertas proker berkibar, rapat malam dimulai. Kamu resmi jadi bagian Kampus Biru Langit!',
    'Jelajahi kampus, cari easter egg yang tersisa, dan jangan lupa LPJ, ya!',
  ],
  reward: { rupiah: 25000, badge: 'Anak Biru Langit' },
  steps: [
    {
      id: 'beli-nasi-kotak', mission: 1, text: 'Beli Nasi Kotak di Kantin FKIP (tekan E di dekat etalase)',
      say: [
        'Kak Nisa (chat): "Halo! Kami lagi rapat di sekre ERC, gedung atap biru di Jl. Prof. Aras Mulyadi. Konsumsinya belum datang nih."',
        'Kak Nisa (chat): "Tolong beliin nasi kotak di Kantin FKIP ya, nanti diganti uang kas. Aman!"',
      ],
      objective: { type: 'buy', itemId: 'nasi-kotak' },
    },
    {
      id: 'antar-nasi-kotak', mission: 1, text: 'Antar Nasi Kotak ke Kak Nisa di halaman depan sekre ERC (tekan E)',
      objective: { type: 'deliver', npcId: 'kak-nisa', itemId: 'nasi-kotak', missingText: 'Nasi kotaknya mana? Beli dulu di Kantin FKIP, ya.' },
      reward: { rupiah: 5000 },
    },
    {
      id: 'ttd-ketua-bem', mission: 2, text: 'Minta tanda tangan proposal ke Bang Raka (Ketua BEM) di depan sekre BEM (tekan E)',
      say: [
        'Kak Nisa: "Makasih banyak! Eh, sekalian ya, proposal kegiatan ini butuh tanda tangan Ketua BEM."',
        'Kak Nisa: "Bang Raka lagi di depan sekre BEM, deretan Sekretariat Lembaga Mahasiswa di selatan Stadion Mini. Samperin aja."',
      ],
      objective: { type: 'interact', target: 'unri-lembaga:ketua-bem', at: KETUA_BEM },
      reward: { rupiah: 3000 },
    },
    danauStep(1, 'di ujung timur', {
      say: [
        'Bang Raka: "Udah kuteken. Mukamu kusut amat, refreshing dulu sana keliling Danau Buatan depan Rektorat."',
        'Ikuti penanda satu per satu sampai satu putaran penuh.',
      ],
    }),
    danauStep(2, 'di sisi selatan'),
    danauStep(3, 'di ujung barat'),
    danauStep(4, 'di sisi utara'),
    danauStep(5, 'kembali ke ujung timur menutup putaran', { reward: { rupiah: 4000 } }),
    {
      id: 'nyalakan-kipas', mission: 4, text: 'Masuk sekre dan nyalakan kipas angin (tekan E)',
      say: [
        'Kak Nisa (chat): "Rapat lanjut malam ini di sekre. Gerah banget, tolong masuk duluan dan nyalain kipas ya!"',
        'Pintu sekre ERC ada di sisi barat gedung atap biru, menghadap halaman. Tekan E di depan pintu untuk masuk, lalu E di dekat kipas.',
      ],
      objective: { type: 'interact', target: `sekre:${SEKRE_KIPAS_ID}`, at: UNRI_POINTS.sekrePintu },
    },
  ],
});
