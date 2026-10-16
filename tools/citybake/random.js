/**
 * Acak deterministik untuk bake: hasil sama untuk id yang sama di setiap mesin/jalankan.
 */

/** FNV-1a 32-bit dari string → uint32. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** PRNG mulberry32 → fungsi () => [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Satu bilangan [0, 1) dari id + salt. */
export const seededUnit = (id, salt = '') => mulberry32(hashString(`${id}|${salt}`))();

/** Pilih elemen array secara deterministik dari id + salt. */
export const pickBySeed = (items, id, salt = '') => items[Math.floor(seededUnit(id, salt) * items.length) % items.length];
