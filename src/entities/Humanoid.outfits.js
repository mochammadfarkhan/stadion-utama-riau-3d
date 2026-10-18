/**
 * Palet pakaian & generator penampilan acak (deterministik via rng) untuk
 * pelari, warga, penonton, pedagang, dan pemain. Mengembalikan opsi untuk
 * createHumanoid(); tidak menyentuh THREE.
 *
 * Field lama tetap ada (skin, shirt, pants, hair, hijab, hat, apron, height,
 * shoes). Field baru: hairColor, bottom ('shorts'|'pants'|'skirt'), vest,
 * badge, glasses, mustache, rng. `hair` kini berisi NAMA GAYA (string);
 * createHumanoid tetap menerima angka hex sebagai warna (legacy).
 */
import { pick, range } from './util.js';
import { HAIR_STYLES } from './Humanoid.hair.js';

export const SKIN_TONES = Object.freeze([0xf1c27d, 0xe0ac69, 0xc68642, 0xa9743f, 0x8d5524, 0x6b3f1d]);
/** Warna rambut cerah pastel-jenuh: merah, pink, hijau, ungu, biru, kuning, coklat, hitam. */
export const HAIR_COLORS = Object.freeze([0xe03e3e, 0xff7eb6, 0x4cc96a, 0x9b5de5, 0x3d8bff, 0xffd23f, 0x8b5a2b, 0x222222]);
export const HIJAB_COLORS = Object.freeze([0x222222, 0x8e44ad, 0x16a085, 0xc0392b, 0xf5f5f5, 0x2c3e50, 0xd4a017, 0xff8fb1]);
export const SHIRT_COLORS = Object.freeze([
  0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22,
  0xecf0f1, 0x34495e, 0xff6b81, 0x00a8ff, 0xfbc531, 0x4cd137, 0x273c75,
]);
export const RUN_SHIRT_COLORS = Object.freeze([0xff3b30, 0x00c2ff, 0x39ff14, 0xffd60a, 0xff2d95, 0xffffff, 0x111111, 0xff8c00]);
export const PANTS_COLORS = Object.freeze([0x1f2a44, 0x2b2b2b, 0x3d3d5c, 0x5d4037, 0x1b5e20, 0x263238, 0x8d6e63]);
export const SHORTS_COLORS = Object.freeze([0x111111, 0x1e3a8a, 0x7f1d1d, 0x14532d, 0x4a148c]);
export const SKIRT_COLORS = Object.freeze([0xff8fb1, 0x7c4dff, 0x26a69a, 0xffb74d, 0x5c6bc0]);
export const HAT_COLORS = Object.freeze([0xffffff, 0x111111, 0xd32f2f, 0x1565c0, 0xf9a825]);
export const CAPING_COLOR = 0xd9b36a;
export const HARDHAT_COLOR = 0xffc107;
export const VEST_COLOR = 0xff6f00;   // rompi satpam oranye
const SHOE_COLORS = Object.freeze([0xffffff, 0xff5722, 0x03a9f4, 0x222222]);
const VENDOR_SHIRTS = Object.freeze([0xffffff, 0x2e7d32, 0x1565c0, 0xef6c00]);

/** Pilihan rambut/penutup kepala umum: hijab ~30%, sisanya gaya rambut acak. */
function randomHead(rng, hijabChance = 0.3) {
  const hijab = rng() < hijabChance ? pick(rng, HIJAB_COLORS) : null;
  return {
    hair: hijab ? null : pick(rng, HAIR_STYLES),
    hairColor: pick(rng, HAIR_COLORS),
    hijab,
  };
}

/** Aksesoris wajah acak (jarang). */
function randomFace(rng) {
  return { glasses: rng() < 0.12, mustache: rng() < 0.08 };
}

/** Penampilan warga umum (pejalan, senam, penonton): kaos + celana / rok / pendek. */
export function randomCasualOutfit(rng) {
  const head = randomHead(rng, 0.3);
  const roll = rng();
  const bottom = roll < 0.45 ? 'pants' : roll < 0.75 ? 'shorts' : 'skirt';
  const special = rng();
  const caping = !head.hijab && special >= 0.12 && special < 0.17;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, SHIRT_COLORS),
    pants: bottom === 'skirt' ? pick(rng, SKIRT_COLORS) : pick(rng, PANTS_COLORS),
    hair: caping ? 'caping' : head.hair,
    hairColor: caping ? CAPING_COLOR : head.hairColor,
    hijab: head.hijab,
    ...randomFace(rng),
    hat: !head.hijab && special < 0.12 ? pick(rng, HAT_COLORS) : null,
    vest: special >= 0.17 && special < 0.21 ? VEST_COLOR : null,
    bottom,
    height: range(rng, 1.55, 1.82),
    shoes: pick(rng, SHOE_COLORS),
    rng,
  };
}

/**
 * Jas almamater UNRI "biru langit" (riset §6: almamater biru langit [T]; nilai hex = [INFERENSI] warna umum
 * foto). Lencana kuning di dada mewakili lambang Lancang Kuning (bentuk disederhanakan).
 */
export const ALMAMATER_UNRI = 0x6fbfe8;
export const ALMAMATER_BADGE = 0xf2c200;

/** Mahasiswa berjas almamater (katalog C01): jas lengan panjang + lencana, tanpa topi, celana panjang/rok. */
export function randomAlmamaterOutfit(rng) {
  const base = randomCasualOutfit(rng);
  const bottom = base.bottom === 'shorts' ? 'pants' : base.bottom;
  const caping = base.hair === 'caping';
  return {
    ...base,
    shirt: ALMAMATER_UNRI,
    longSleeve: true,
    badge: ALMAMATER_BADGE,
    vest: null,
    hat: null,
    hair: caping ? pick(rng, HAIR_STYLES) : base.hair,
    hairColor: caping ? pick(rng, HAIR_COLORS) : base.hairColor,
    bottom,
    pants: bottom === 'skirt' ? base.pants : pick(rng, PANTS_COLORS),
  };
}

/** Penampilan pelari: kaos lari cerah, celana pendek, sebagian berhijab atau bertopi. */
export function randomRunnerOutfit(rng, { forceHat = false, forceHijab = false } = {}) {
  const head = randomHead(rng, forceHijab ? 1 : 0.3);
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, RUN_SHIRT_COLORS),
    pants: pick(rng, SHORTS_COLORS),
    ...head,
    hat: forceHat && !head.hijab ? pick(rng, HAT_COLORS) : null,
    bottom: 'shorts',
    height: range(rng, 1.58, 1.85),
    shoes: pick(rng, SHOE_COLORS),
    rng,
  };
}

/** Penampilan pedagang: celemek + topi pet / caping / hijab. */
export function randomVendorOutfit(rng, kind = 'minuman') {
  const head = randomHead(rng, 0.4);
  const caping = !head.hijab && rng() < 0.3;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, VENDOR_SHIRTS),
    pants: pick(rng, PANTS_COLORS),
    hair: caping ? 'caping' : head.hair,
    hairColor: caping ? CAPING_COLOR : head.hairColor,
    hijab: head.hijab,
    ...randomFace(rng),
    hat: head.hijab || caping ? null : (kind === 'buah' ? 0xf9a825 : 0xffffff),
    apron: kind === 'buah' ? 0x66bb6a : 0x42a5f5,
    bottom: 'pants',
    height: range(rng, 1.6, 1.78),
    rng,
  };
}

/** Penampilan satpam / petugas: rompi oranye + helm proyek atau topi. */
export function randomGuardOutfit(rng) {
  const hardhat = rng() < 0.5;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: 0x1f3a5f,
    pants: 0x1f2a44,
    hair: hardhat ? 'hardhat' : 'buzz',
    hairColor: hardhat ? HARDHAT_COLOR : pick(rng, HAIR_COLORS),
    hijab: null,
    hat: hardhat ? null : 0x111111,
    vest: VEST_COLOR,
    bottom: 'pants',
    longSleeve: true,
    height: range(rng, 1.62, 1.82),
    rng,
  };
}

const KITS = Object.freeze({
  // Tim A kuning-hijau (gaya PSPS Riau); kiper hitam
  a: { shirt: 0xf2c200, pants: 0x1f7a3a, badge: 0x1f7a3a, keeper: { shirt: 0x111111, pants: 0x111111, badge: 0xf2c200 } },
  // Tim B merah-putih; kiper biru muda
  b: { shirt: 0xd62828, pants: 0xffffff, badge: 0xffffff, keeper: { shirt: 0x00bcd4, pants: 0x004d5a, badge: 0xffffff } },
});

/** Jersey pemain bola (celana pendek, lencana warna tim, sepatu bola hitam); kiper berbeda. */
export function footballKit(team, isKeeper, rng) {
  const kit = KITS[team] ?? KITS.a;
  const colors = isKeeper ? kit.keeper : kit;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: colors.shirt,
    pants: colors.pants,
    badge: colors.badge,
    hair: pick(rng, HAIR_STYLES.filter((s) => s !== 'long' && s !== 'twintails')),
    hairColor: pick(rng, HAIR_COLORS),
    hijab: null,
    bottom: 'shorts',
    height: range(rng, 1.65, 1.85),
    shoes: 0x111111,
    rng,
  };
}
