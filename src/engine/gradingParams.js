/**
 * Parameter grading efektif dari konfigurasi gaya, split per jam, dan kekuatan pengguna k (0..1). Murni:
 * k = 0 -> netral (saturasi/kontras 1, tanpa tint/vinyet); k = 1 -> konfigurasi penuh.
 */
export function gradingParams(cfg, split, k) {
  const kk = Math.min(1, Math.max(0, Number.isFinite(k) ? k : 1));
  return {
    ...cfg,
    saturation: 1 + (cfg.saturation - 1) * kk,
    contrast: 1 + (cfg.contrast - 1) * kk,
    strength: cfg.strength * (Number.isFinite(split) ? split : 1) * kk,
    vignette: (cfg.vignette ?? 0) * kk,
  };
}
