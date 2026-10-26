/**
 * Preset kualitas (pengaturan Grafik › Preset): tiap tier menulis nilai ke setelan yang SUDAH ADA, sehingga binding lama
 * yang menerapkannya ke renderer. Preset 'otomatis' memakai tier hasil deteksi (app/quality.js); mengubah salah satu kunci
 * di bawah secara manual menjadikan preset 'kustom'. Angka mengikuti rencana performa 2026-10-26 (Fase 1).
 */

export const QUALITY_PRESETS = Object.freeze({
  rendah: Object.freeze({
    'graphics.pixelRatio': 0.75,
    'graphics.shadowQuality': 'mati',
    'graphics.outline': false,
    'graphics.bloom': false,
    'graphics.kartuDaun': false,
    'graphics.tanahPbr': 'rendah',
    'graphics.crowdDensity': 0.4,
    'sky.fogDistance': 700,
    'performance.fpsCap': '30',
  }),
  sedang: Object.freeze({
    'graphics.pixelRatio': 1,
    'graphics.shadowQuality': 'rendah',
    'graphics.outline': true,
    'graphics.bloom': true,
    'graphics.kartuDaun': true,
    'graphics.tanahPbr': 'sedang',
    'graphics.crowdDensity': 0.7,
    'sky.fogDistance': 950,
    'performance.fpsCap': '60',
  }),
  tinggi: Object.freeze({
    'graphics.pixelRatio': 1.25,
    'graphics.shadowQuality': 'sedang',
    'graphics.outline': true,
    'graphics.bloom': true,
    'graphics.kartuDaun': true,
    'graphics.tanahPbr': 'auto',
    'graphics.crowdDensity': 1,
    'sky.fogDistance': 1100,
    'performance.fpsCap': '60',
  }),
});

/** Kunci setelan yang dikendalikan preset. */
export const PRESET_KEYS = Object.freeze(Object.keys(QUALITY_PRESETS.tinggi));

/** Batas FPS (nilai setelan) → angka FPS (0 = tanpa batas). */
export const FPS_CAP = Object.freeze({ 30: 30, 60: 60, 'tanpa batas': 0 });
