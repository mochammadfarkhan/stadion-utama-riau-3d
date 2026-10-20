/**
 * Logika murni tekstur PBR (dites): pemilihan tier ukuran, tingkat kualitas tanah (otomatis + manual), hitungan memori,
 * ukuran tile (meter nyata, identik dengan public/textures/manifest.json — dijaga tes).
 */
export const PBR_TIERS = Object.freeze([256, 512, 1024]);
export const PBR_KINDS = Object.freeze(['albedo', 'normal', 'orm']);

export { TERRAIN_QUALITIES, TERRAIN_SETTING, autoTerrainQuality, effectiveTerrainQuality, resolveTerrainQuality } from '../../engine/terrainQuality.js';

/** Sisi satu tile (m) per set; cadangan sebelum manifest termuat (dan sumber UV shader tanah). */
export const TILE_M = Object.freeze({
  grass: 1.4, soilMoist: 1.4, soilDry: 3.5, gravel: 1.5, moss: 1.5, plaster: 2, concrete: 2.2,
  paving: 1.15, asphalt: 2.5, roofSteel: 1.2, wood: 1.4, tile: 2.1, bark: 1,
});

/** Tier ukuran tekstur dari tingkat kualitas: tinggi/sedang 512, rendah 256 (1024 hanya diminta eksplisit). */
export function tierForQuality(quality) {
  return quality === 'rendah' ? 256 : 512;
}

/** Tier valid terdekat (turun) yang tersedia untuk satu set (`sizes` dari manifest); null bila tak ada. */
export function resolveTier(want, sizes) {
  const ok = [...sizes].sort((a, b) => b - a).find((s) => s <= want);
  return ok ?? (sizes.length ? Math.min(...sizes) : null);
}

/** Byte GPU satu tekstur RGBA8 + rantai mip. */
export function textureBytes(w, h, mips = true) {
  return Math.round(w * h * 4 * (mips ? 4 / 3 : 1));
}

/** Perkiraan byte tekstur terkompresi GPU (BC7/ASTC 4x4 = 1 byte per piksel, ETC2 RGB = 0,5) beserta rantai mip. */
export function compressedBytes(w, h, bytesPerPixel = 1) {
  return Math.round(w * h * bytesPerPixel * (4 / 3));
}

/**
 * Lapisan yang dipakai shader tanah per kualitas (jumlah sampel albedo+normal dihitung dari sini, anggaran <= 8):
 * tinggi 5 lapisan + normal; sedang 3 lapisan + normal; rendah albedo saja.
 */
export const TERRAIN_LAYERS = Object.freeze({
  tinggi: Object.freeze({ layers: Object.freeze(['grass', 'soilMoist', 'soilDry', 'gravel', 'moss']), normal: true, dualGrass: true }),
  sedang: Object.freeze({ layers: Object.freeze(['grass', 'soilMoist', 'soilDry']), normal: true, dualGrass: false }),
  rendah: Object.freeze({ layers: Object.freeze(['grass', 'soilMoist', 'soilDry']), normal: false, dualGrass: false }),
});

/** Sampel tekstur maksimum per piksel untuk satu kualitas (albedo per lapisan + sampel anti-tiling + normal). */
export function maxTerrainSamples(quality) {
  const q = TERRAIN_LAYERS[quality];
  return q.layers.length + (q.dualGrass ? 1 : 0) + (q.normal ? 2 : 0);
}

