/**
 * Daftar easter egg dan petunjuk (data beku). `at` = pemicu jarak (x, z, radius);
 * `trigger` = pemicu khusus yang dievaluasi di story/eggTriggers.js.
 * Petunjuk `jejak-*` dipakai objective `find` pada chapter 5.
 */
import { SITE } from '../config/constants.js';

const egg = (e) => Object.freeze({ ...e, reward: Object.freeze(e.reward), at: e.at ? Object.freeze(e.at) : undefined });

export const EASTER_EGGS = Object.freeze([
  egg({ id: 'bel-satpam', title: 'Salam Pak Satpam', text: 'Pak Satpam membalas bel: "Tiin tiin, hati-hati di jalan, Dek!"', hint: 'Bunyikan bel sepeda di depan seseorang.', trigger: 'bell-satpam', reward: { rupiah: 3000 } }),
  egg({ id: 'bangku-keramat', title: 'Bangku Keramat', text: 'Bangku ini katanya tempat para legenda beristirahat. Kamu dapat berkahnya!', hint: 'Ada bangku yang tampak berbeda dari bangku lain.', at: { x: 7, z: -186, radius: 3 }, reward: { rupiah: 2000 } }),
  egg({ id: 'bola-tengah-malam', title: 'Bola Tengah Malam', text: 'Tepat tengah malam, sebuah bola bercahaya melayang di tengah lapangan.', hint: 'Datanglah ke tengah lapangan saat jam berganti hari.', trigger: 'midnight-center', reward: { rupiah: 5000 } }),
  egg({ id: 'pelanggan-setia', title: 'Pelanggan Setia', text: 'Bang Udin menyebutmu pelanggan setia dan mencatat namamu di buku kenangan.', hint: 'Es teh Bang Udin enak sekali, bukan?', trigger: 'es-teh-5', reward: { rupiah: 4000 } }),
  egg({ id: 'layar-hujan', title: 'Layar Lancang Kuning', text: 'Di bawah layar tugu saat hujan, terdengar bisikan lagu lama negeri Melayu.', hint: 'Layar tugu menyimpan cerita saat langit menangis.', trigger: 'rain-tugu', reward: { rupiah: 4000 } }),
  egg({ id: 'jejak-1', title: 'Jejak Pertama', text: 'Jejak pertama Air Molek: sebuah papan tua di dekat gerbang Jl. Naga Sakti.', hint: 'Dekat Gapura Jl. Naga Sakti.', at: { x: 0, z: SITE.gapuraZ + 14, radius: 9 }, reward: { rupiah: 1000 } }),
  egg({ id: 'jejak-2', title: 'Jejak Kedua', text: 'Jejak kedua: riak di tepi danau menyebut nama "Air Molek".', hint: 'Di tepi danau utara.', at: { x: SITE.lakeCenter.x, z: SITE.lakeCenter.z + 60, radius: 25 }, reward: { rupiah: 1000 } }),
  egg({ id: 'jejak-3', title: 'Jejak Ketiga', text: 'Jejak ketiga: anak-anak di taman papan seluncur bercerita tentang kampung Air Molek.', hint: 'Di taman papan seluncur sisi timur.', at: { x: SITE.skateCenter.x, z: SITE.skateCenter.z, radius: 20 }, reward: { rupiah: 1000 } }),
]);

export const EGG_IDS = Object.freeze(EASTER_EGGS.map((e) => e.id));
