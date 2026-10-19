/**
 * Tingkat kualitas tekstur tanah PBR (murni, dites): otomatis dari resolusi render efektif dengan histeresis, manual menang,
 * facet = tanpa normal. Dipakai styleManager (engine) dan pbrCore (re-ekspor).
 */
export const TERRAIN_QUALITIES = Object.freeze(['tinggi', 'sedang', 'rendah']);
export const TERRAIN_SETTING = Object.freeze(['auto', ...TERRAIN_QUALITIES]);

/**
 * Kualitas tanah otomatis dari resolusi render efektif (pixel ratio, sudah memuat resolusi adaptif) dengan histeresis:
 * turun saat ratio < 0.8 (sedang) / < 0.62 (rendah); naik kembali hanya bila ratio melewati ambang + margin.
 */
export function autoTerrainQuality(prev, pixelRatio) {
  const order = { tinggi: 0, sedang: 1, rendah: 2 };
  let level = order[prev] ?? 0;
  const want = pixelRatio < 0.62 ? 2 : pixelRatio < 0.8 ? 1 : 0;
  if (want > level) level = want;
  else if (want < level) {
    const upRatio = level === 2 ? 0.72 : 0.9;
    if (pixelRatio >= upRatio) level -= 1;
  }
  return TERRAIN_QUALITIES[level];
}

/** Kualitas final: pengaturan manual menang; 'auto' memakai autoTerrainQuality. */
export function resolveTerrainQuality(setting, prev, pixelRatio) {
  if (TERRAIN_QUALITIES.includes(setting)) return setting;
  return autoTerrainQuality(prev, pixelRatio);
}

/** Kualitas efektif per gaya: facet memakai versi tanpa normal/ORM (albedo saja = 'rendah'); asli tidak memakai PBR. */
export function effectiveTerrainQuality(style, quality) {
  if (style === 'facet') return 'rendah';
  return TERRAIN_QUALITIES.includes(quality) ? quality : 'tinggi';
}
