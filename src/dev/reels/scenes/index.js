/** Daftar scene reels; tambah scene baru = satu berkas di folder ini + satu baris di sini. */
import sekreDuduk from './sekreDuduk.js';
import dramaUangKas from './dramaUangKas.js';

export const REEL_SCENES = Object.freeze({
  [sekreDuduk.id]: sekreDuduk,
  [dramaUangKas.id]: dramaUangKas,
});
