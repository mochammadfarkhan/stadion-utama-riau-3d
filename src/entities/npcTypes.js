/**
 * Katalog tipe NPC (opsi createHumanoid per peran) + campuran peluang per lokasi. Murni data/rng, tanpa THREE.
 *
 *   jogger      pelari: kaos lari cerah, celana pendek, sebagian berhijab/bertopi
 *   mahasiswa   kasual/almamater biru langit, ransel
 *   dosen       kemeja lengan panjang/batik, celana bahan atau rok panjang, kacamata, sebagian beruban
 *   pengunjung  orang luar kampus/warga: kasual, topi pet, tas
 *   anak        tinggi 1.0–1.3 m, warna cerah, kuncir/bob, sebagian berhijab, ransel sekolah
 *   satpam      seragam satpam kampus (krem/coklat, pet)
 *
 * Warna seragam/batik = [INFERENSI] pola umum, bukan dari foto UNRI.
 */
import { pick, range } from './util.js';
import {
  BACKPACK_COLORS, HAIR_COLORS, HAT_COLORS, HIJAB_COLORS, PANTS_COLORS, SKIN_TONES, SKIRT_COLORS,
  campusGuardOutfit, randomCasualOutfit, randomRunnerOutfit, randomStudentOutfit,
} from './Humanoid.outfits.js';

export const NPC_TYPES = Object.freeze(['jogger', 'mahasiswa', 'dosen', 'pengunjung', 'anak', 'satpam']);

export const NPC_TYPE_LABELS = Object.freeze({
  jogger: 'Jogger', mahasiswa: 'Mahasiswa', dosen: 'Dosen', pengunjung: 'Orang luar', anak: 'Anak-anak', satpam: 'Satpam',
});

/** Kemeja dosen: putih, biru muda, abu, dan warna dasar batik (coklat sogan, biru indigo, merah marun). */
const LECTURER_SHIRTS = Object.freeze([0xf5f5f5, 0xbcd7ef, 0xb0b7bf, 0x8a5a2b, 0x2f3e74, 0x7b2d26]);
const GREY_HAIR = 0x9e9e9e;
const KID_SHIRTS = Object.freeze([0xff5a5f, 0xffc93c, 0x4cd964, 0x5ac8fa, 0xff8fd8, 0xaf7bff, 0xff9500]);
const KID_HAIR = Object.freeze(['twintails', 'bob', 'helmet', 'bun', 'helmet']);
const KID_HIJAB = Object.freeze([0xff8fb1, 0xffffff, 0x7fd1ff, 0xffd23f, 0xb39ddb]);

/** Dosen: rapi, lengan panjang, kacamata ±45%, hijab ±40%, kumis/uban sebagian. */
export function randomLecturerOutfit(rng) {
  const hijab = rng() < 0.4 ? pick(rng, HIJAB_COLORS) : null;
  const skirt = hijab != null && rng() < 0.6;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, LECTURER_SHIRTS),
    pants: skirt ? pick(rng, [0x2b2b2b, 0x3e2f22, 0x1f2a44]) : pick(rng, [0x2b2b2b, 0x1f2a44, 0x3d3d5c, 0x4e3b2a]),
    hair: hijab ? null : pick(rng, ['buzz', 'helmet', 'buzz']),
    hairColor: rng() < 0.3 ? GREY_HAIR : 0x222222,
    hijab,
    glasses: rng() < 0.45,
    mustache: !hijab && rng() < 0.25,
    hat: null,
    vest: null,
    badge: 0xffffff,          // kartu identitas pegawai
    bottom: skirt ? 'skirt' : 'pants',
    longSleeve: true,
    shoes: 0x1a1a1a,
    height: range(rng, 1.58, 1.78),
    rng,
  };
}

/** Orang luar/warga: kasual, topi pet ±35%, tas ±25%, tanpa rompi/caping. */
export function randomVisitorOutfit(rng) {
  const base = randomCasualOutfit(rng);
  const capped = base.hijab == null && rng() < 0.35;
  return {
    ...base,
    hair: base.hair === 'caping' ? 'helmet' : base.hair,
    hat: capped ? pick(rng, HAT_COLORS) : null,
    vest: null,
    backpack: rng() < 0.25 ? pick(rng, BACKPACK_COLORS) : null,
  };
}

/** Anak-anak: kecil, warna cerah, rambut kuncir/bob, hijab ±20%, ransel sekolah ±30%. */
export function randomChildOutfit(rng) {
  const hijab = rng() < 0.2 ? pick(rng, KID_HIJAB) : null;
  const roll = rng();
  const bottom = roll < 0.55 ? 'shorts' : roll < 0.8 ? 'skirt' : 'pants';
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, KID_SHIRTS),
    pants: bottom === 'skirt' ? pick(rng, SKIRT_COLORS) : pick(rng, PANTS_COLORS),
    hair: hijab ? null : pick(rng, KID_HAIR),
    hairColor: pick(rng, [0x222222, 0x222222, 0x5d4037, ...HAIR_COLORS]),
    hijab,
    hat: null,
    bottom,
    backpack: rng() < 0.3 ? pick(rng, BACKPACK_COLORS) : null,
    shoes: pick(rng, [0xffffff, 0xff5722, 0x03a9f4]),
    height: range(rng, 1.0, 1.3),
    rng,
  };
}

const BUILDERS = Object.freeze({
  jogger: (rng) => randomRunnerOutfit(rng),
  mahasiswa: (rng, o) => randomStudentOutfit(rng, o),
  dosen: randomLecturerOutfit,
  pengunjung: randomVisitorOutfit,
  anak: randomChildOutfit,
  satpam: campusGuardOutfit,
});

/**
 * Opsi createHumanoid untuk satu tipe NPC (tipe tak dikenal → pengunjung).
 * @param {string} type salah satu NPC_TYPES
 * @param {() => number} rng
 * @param {object} [opts] diteruskan ke generator (mis. {almamaterChance} untuk mahasiswa)
 */
export function outfitForNpcType(type, rng, opts) {
  return { ...(BUILDERS[type] ?? BUILDERS.pengunjung)(rng, opts), npcType: BUILDERS[type] ? type : 'pengunjung' };
}

/** Campuran peluang per lokasi (bobot relatif; tidak harus berjumlah 1). */
export const NPC_MIX = Object.freeze({
  kampus: Object.freeze({ mahasiswa: 78, dosen: 12, pengunjung: 7, anak: 3 }),
  plaza: Object.freeze({ pengunjung: 55, anak: 20, jogger: 15, mahasiswa: 10 }),
});

/**
 * Pilih tipe dari campuran berbobot. Bobot ≤ 0/bukan angka diabaikan; campuran kosong → 'pengunjung'.
 * @param {Record<string, number>} mix
 * @param {() => number} rng
 */
export function pickNpcType(mix, rng) {
  const entries = Object.entries(mix).filter(([, w]) => Number.isFinite(w) && w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'pengunjung';
  let r = rng() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r < 0) return type;
  }
  return entries[entries.length - 1][0];
}

/** Opsi createHumanoid dari campuran lokasi (pilih tipe lalu buat pakaiannya). */
export function outfitFromMix(mix, rng, opts) {
  return outfitForNpcType(pickNpcType(mix, rng), rng, opts);
}
