/**
 * Daftar easter egg dan petunjuk (data beku). `at` = pemicu jarak (x, z, radius);
 * `trigger` = pemicu khusus yang dievaluasi di story/eggTriggers.js.
 * Petunjuk `jejak-*` dipakai objective `find` pada chapter 5.
 */
import { SITE } from '../config/constants.js';

const egg = (e) => Object.freeze({ ...e, reward: Object.freeze(e.reward), at: e.at ? Object.freeze(e.at) : undefined });

export const EASTER_EGGS = Object.freeze([
  egg({ id: 'bel-satpam', title: 'Salam Pak Satpam', text: 'Pak Satpam membalas bel: "Ting ting! Hati-hati di jalan, Dek!"', hint: 'Bunyikan bel sepeda 3 kali berturut-turut di dekat Pak Satpam.', trigger: 'bell-satpam', reward: { rupiah: 3000 } }),
  egg({ id: 'bangku-keramat', title: 'Bangku Keramat', text: 'Bangku ini katanya tempat para legenda beristirahat. Kamu dapat berkahnya!', hint: 'Ada bangku yang tampak berbeda dari bangku lain.', at: { x: 7, z: -186, radius: 3 }, reward: { rupiah: 2000 } }),
  egg({ id: 'bola-tengah-malam', title: 'Bola Tengah Malam', text: 'Tepat tengah malam, sebuah bola bercahaya melayang di tengah lapangan.', hint: 'Datanglah ke tengah lapangan antara pukul 23.30 dan 00.30.', trigger: 'midnight-center', reward: { rupiah: 5000 } }),
  egg({ id: 'pelanggan-setia', title: 'Pelanggan Setia', text: 'Bang Udin menyebutmu pelanggan setia dan mencatat namamu di buku kenangan.', hint: 'Es teh Bang Udin enak sekali, bukan?', trigger: 'es-teh-5', reward: { rupiah: 4000 } }),
  egg({ id: 'layar-hujan', title: 'Layar Lancang Kuning', text: 'Di bawah layar tugu saat hujan, terdengar bisikan lagu lama negeri Melayu.', hint: 'Layar tugu menyimpan cerita saat langit menangis.', trigger: 'rain-tugu', reward: { rupiah: 4000 } }),
  egg({ id: 'jejak-1', title: 'Jejak Pertama', text: 'Jejak pertama Air Molek: sebuah papan tua di dekat gerbang Jl. Naga Sakti.', hint: 'Dekat Gapura Jl. Naga Sakti.', at: { x: 0, z: SITE.gapuraZ + 14, radius: 9 }, reward: { rupiah: 1000 } }),
  // jejak-2 di sumbu pedestrian antara dua danau OSM (way 419836906 & 327378220); jejak-3 di Venue Baseball OSM (way 535214902).
  egg({ id: 'jejak-2', title: 'Jejak Kedua', text: 'Jejak kedua: riak di antara dua danau utara menyebut nama "Air Molek".', hint: 'Di antara dua danau utara stadion.', at: { x: -5, z: -385, radius: 12 }, reward: { rupiah: 1000 } }),
  egg({ id: 'jejak-3', title: 'Jejak Ketiga', text: 'Jejak ketiga: anak-anak di Venue Baseball bercerita tentang kota Air Molek.', hint: 'Di Venue Baseball sisi barat daya.', at: { x: -235, z: 227, radius: 20 }, reward: { rupiah: 1000 } }),
]);

export const EGG_IDS = Object.freeze(EASTER_EGGS.map((e) => e.id));
