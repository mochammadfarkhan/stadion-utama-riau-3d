/**
 * Cerita "Wisata Kuliner dan Budaya Riau": 5 chapter (data beku).
 * Koordinat tujuan memakai posisi dunia yang sama dengan world/layout.js.
 */
import { STADIUM, SITE } from '../config/constants.js';

const freezeDeep = (o) => {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') freezeDeep(v); });
  return Object.freeze(o);
};

/** NPC cerita: posisi dan nama (dipakai StoryNpcs + prompt E). */
export const STORY_NPCS = freezeDeep([
  { id: 'satpam', name: 'Pak Satpam', x: -16, z: SITE.gapuraZ + 8, yaw: Math.PI / 2 },
  { id: 'pelatih', name: 'Coach Dedi', x: 52, z: 12, yaw: -Math.PI / 2 },
]);

export const TUGU = freezeDeep({ x: 0, z: -(STADIUM.outerSemiZ + 45) });

export const CHAPTERS = freezeDeep([
  {
    id: 'selamat-datang', title: 'Selamat Datang di Pekanbaru', rank: 'Penjelajah',
    outro: ['Kamu sudah mengenal tugu Lancang Kuning, lambang semangat negeri Melayu.'],
    reward: { rupiah: 5000, badge: 'Tamu Bertuah' },
    steps: [
      {
        id: 'ke-tugu', text: 'Kayuh ke Tugu Lancang Kuning di depan stadion',
        say: ['Selamat datang di Stadion Utama Riau!', 'Mulailah dari tugu Lancang Kuning di plaza depan. Kayuh sepedamu ke sana.'],
        objective: { type: 'goto', target: TUGU, radius: 16 },
      },
    ],
  },
  {
    id: 'es-teh-bang-udin', title: 'Es Teh Bang Udin', rank: 'Kurir Jajanan',
    outro: ['Pak Satpam puas. Es teh Bang Udin memang juara.'],
    reward: { rupiah: 8000, badge: 'Kurir Es Teh' },
    steps: [
      {
        id: 'beli-es-teh', text: 'Beli Es Teh dari pedagang (tekan E di dekat gerobak)',
        say: ['Pak Satpam di gapura kehausan.', 'Belilah Es Teh dari pedagang keliling, lalu antar ke beliau.'],
        objective: { type: 'buy', itemId: 'es-teh' },
      },
      {
        id: 'antar-es-teh', text: 'Antar Es Teh ke Pak Satpam di gapura (tekan E)',
        objective: { type: 'deliver', npcId: 'satpam', itemId: 'es-teh', missingText: 'Es Teh-nya belum ada. Beli dulu dari pedagang.' },
        reward: { rupiah: 3000 },
      },
    ],
  },
  {
    id: 'rujak-pelatih', title: 'Rujak untuk Pelatih', rank: 'Kurir Andalan',
    outro: ['Coach Dedi bilang rujakmu bikin semangat latihan naik!'],
    reward: { rupiah: 10000, badge: 'Kurir Rujak' },
    steps: [
      {
        id: 'beli-rujak', text: 'Beli Rujak dari pedagang buah',
        say: ['Coach Dedi sedang melatih di lintasan.', 'Beliau ingin rujak. Belilah dari pedagang buah, lalu antar ke pinggir lintasan.'],
        objective: { type: 'buy', itemId: 'rujak' },
      },
      {
        id: 'antar-rujak', text: 'Antar Rujak ke Coach Dedi di pinggir lintasan, masuk lewat gerbang utara (tekan E)',
        objective: { type: 'deliver', npcId: 'pelatih', itemId: 'rujak', missingText: 'Rujaknya belum ada. Beli dulu dari pedagang buah.' },
        reward: { rupiah: 3000 },
      },
    ],
  },
  {
    id: 'keliling-lintasan', title: 'Keliling Lintasan', rank: 'Atlet Sepeda',
    outro: ['Tiga putaran! Kakimu kuat seperti pelari Riau sejati.'],
    reward: { rupiah: 15000, badge: 'Raja Lintasan' },
    steps: [
      {
        id: 'tiga-putaran', text: 'Kayuh 3 putaran lintasan sebelum waktu habis', timeLimit: 300,
        say: ['Saatnya uji stamina!', 'Kayuh tiga putaran penuh di lintasan atletik. Lewati semua penanda secara berurutan.'],
        objective: { type: 'laps', count: 3 },
      },
    ],
  },
  {
    id: 'jejak-air-molek', title: 'Jejak Air Molek', rank: 'Anak Bertuah',
    outro: ['Kamu menyatukan semua jejak. Kabarnya Air Molek ada di Indragiri Hulu, Riau; mungkin kapal ini dinamai untuk mengenang tempat itu.', 'Terima kasih sudah berkeliling. Kamu kini Anak Bertuah!'],
    reward: { rupiah: 20000, badge: 'Anak Bertuah' },
    steps: [
      {
        id: 'cari-jejak', text: 'Temukan 3 jejak Air Molek di sekitar kawasan',
        say: ['Di lambung replika kapal tertulis "AIR MOLEK", kemungkinan nama kapalnya. Apa artinya?', 'Cari tiga jejak: dekat gapura Jl. Naga Sakti, tepi danau utara, dan taman papan seluncur timur.'],
        objective: { type: 'find', ids: ['jejak-1', 'jejak-2', 'jejak-3'] },
      },
    ],
  },
]);
