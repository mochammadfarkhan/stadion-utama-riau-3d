/**
 * Konstanta format chunk terrain distrik ("unri-terrain" v1, spec §4.1). Sumber tunggal untuk
 * tools/campusbake (penulis) dan klien (decodeChunk). Murni.
 *
 * Satu chunk = persegi CHUNK_SIZE m selaras grid tile kota (src/geo/tiles.js), sampel tiap STEP m,
 * N = CHUNK_SIZE / STEP + 1 sampel per sisi (tepi dipakai bersama chunk tetangga).
 * Nilai disimpan Uint16 little-endian: y_m = (u16 + BIAS) * UNIT → rentang −50 m … +605,35 m, presisi 1 cm.
 */
export const CHUNK_SIZE = 500;
export const STEP = 4;
export const N = 126;
export const UNIT = 0.01;
export const BIAS = -5000;
export const FORMAT = 'unri-terrain';
export const VERSION = 1;

/** Header chunk default (dipakai manifest distrik dan tes). */
export const TERRAIN_HEADER = Object.freeze({
  format: FORMAT, version: VERSION, size: CHUNK_SIZE, step: STEP, n: N, unit: UNIT, bias: BIAS,
});

/** u16 untuk y = 0 tepat (−BIAS). Chunk yang semua sampelnya bernilai ini tidak ditulis. */
export const ZERO_U16 = -BIAS;
