/**
 * Palet pakaian & generator penampilan acak (deterministik via rng) untuk
 * pelari, warga, penonton, pedagang, dan pemain. Mengembalikan opsi untuk
 * createHumanoid(); tidak menyentuh THREE.
 */
import { pick, range } from './util.js';

export const SKIN_TONES = Object.freeze([0xf1c27d, 0xe0ac69, 0xc68642, 0xa9743f, 0x8d5524, 0x6b3f1d]);
export const HAIR_COLORS = Object.freeze([0x111111, 0x1c1410, 0x2a1b12, 0x3b2a1a]);
export const HIJAB_COLORS = Object.freeze([0x222222, 0x8e44ad, 0x16a085, 0xc0392b, 0xf5f5f5, 0x2c3e50, 0xd4a017]);
export const SHIRT_COLORS = Object.freeze([
  0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22,
  0xecf0f1, 0x34495e, 0xff6b81, 0x00a8ff, 0xfbc531, 0x4cd137, 0x273c75,
]);
export const RUN_SHIRT_COLORS = Object.freeze([0xff3b30, 0x00c2ff, 0x39ff14, 0xffd60a, 0xff2d95, 0xffffff, 0x111111, 0xff8c00]);
export const PANTS_COLORS = Object.freeze([0x1f2a44, 0x2b2b2b, 0x3d3d5c, 0x5d4037, 0x1b5e20, 0x263238, 0x8d6e63]);
export const SHORTS_COLORS = Object.freeze([0x111111, 0x1e3a8a, 0x7f1d1d, 0x14532d, 0x4a148c]);
export const HAT_COLORS = Object.freeze([0xffffff, 0x111111, 0xd32f2f, 0x1565c0, 0xf9a825]);
const SHOE_COLORS = Object.freeze([0xffffff, 0xff5722, 0x03a9f4, 0x222222]);

/** Penampilan warga umum (pejalan, senam, penonton). */
export function randomCasualOutfit(rng) {
  const hijab = rng() < 0.3 ? pick(rng, HIJAB_COLORS) : null;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, SHIRT_COLORS),
    pants: pick(rng, PANTS_COLORS),
    hair: hijab ? null : pick(rng, HAIR_COLORS),
    hijab,
    hat: !hijab && rng() < 0.12 ? pick(rng, HAT_COLORS) : null,
    height: range(rng, 1.55, 1.82),
  };
}

/** Penampilan pelari: kaos lari cerah, celana pendek, sebagian berhijab atau bertopi. */
export function randomRunnerOutfit(rng, { forceHat = false, forceHijab = false } = {}) {
  const hijab = forceHijab || rng() < 0.3 ? pick(rng, HIJAB_COLORS) : null;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, RUN_SHIRT_COLORS),
    pants: pick(rng, SHORTS_COLORS),
    hair: hijab ? null : pick(rng, HAIR_COLORS),
    hijab,
    hat: forceHat && !hijab ? pick(rng, HAT_COLORS) : null,
    height: range(rng, 1.58, 1.85),
    shoes: pick(rng, SHOE_COLORS),
  };
}

/** Penampilan pedagang: celemek + topi atau hijab. */
export function randomVendorOutfit(rng, kind = 'minuman') {
  const hijab = rng() < 0.4 ? pick(rng, HIJAB_COLORS) : null;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, [0xffffff, 0x2e7d32, 0x1565c0, 0xef6c00]),
    pants: pick(rng, PANTS_COLORS),
    hair: hijab ? null : pick(rng, HAIR_COLORS),
    hijab,
    hat: hijab ? null : (kind === 'buah' ? 0xf9a825 : 0xffffff),
    apron: kind === 'buah' ? 0x66bb6a : 0x42a5f5,
    height: range(rng, 1.6, 1.78),
  };
}

const KITS = Object.freeze({
  // Tim A kuning-hijau (gaya PSPS Riau); kiper hitam
  a: { shirt: 0xf2c200, pants: 0x1f7a3a, keeper: { shirt: 0x111111, pants: 0x111111 } },
  // Tim B merah-putih; kiper biru muda
  b: { shirt: 0xd62828, pants: 0xffffff, keeper: { shirt: 0x00bcd4, pants: 0x004d5a } },
});

/** Jersey pemain bola; kiper diberi warna berbeda. */
export function footballKit(team, isKeeper, rng) {
  const kit = KITS[team] ?? KITS.a;
  const colors = isKeeper ? kit.keeper : kit;
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: colors.shirt,
    pants: colors.pants,
    hair: pick(rng, HAIR_COLORS),
    height: range(rng, 1.65, 1.85),
    shoes: 0x111111,
  };
}
