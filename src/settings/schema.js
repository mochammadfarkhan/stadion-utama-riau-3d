/**
 * Skema settings: sumber kebenaran tunggal untuk panel UI, validasi, dan default.
 * Tiap field: { type: 'range'|'toggle'|'select', default, min?, max?, step?, options?, label, unit?, format? }
 * Nilai disimpan datar dengan kunci "grup.field" (mis. "sky.hour").
 */

const range = (label, def, min, max, step, extra = {}) =>
  Object.freeze({ type: 'range', label, default: def, min, max, step, ...extra });
const toggle = (label, def, extra = {}) => Object.freeze({ type: 'toggle', label, default: def, ...extra });
const select = (label, def, options, extra = {}) =>
  Object.freeze({ type: 'select', label, default: def, options, ...extra });

export const SETTINGS_SCHEMA = Object.freeze({
  sky: Object.freeze({
    title: 'Langit',
    icon: 'sun',
    sections: Object.freeze({
      sun: Object.freeze({
        title: 'Matahari',
        fields: Object.freeze({
          hour: range('Waktu', 16.5, 0, 24, 1 / 60, { unit: 'jam', format: 'clock', widget: 'sunArc' }),
          azimuthOffset: range('Azimut matahari', 0, -180, 180, 1, { unit: '°' }),
          advanceTime: toggle('Jalankan waktu', false),
          timeSpeed: range('Kecepatan waktu', 0.25, 0.05, 2, 0.05, { unit: 'jam/detik' }),
        }),
      }),
      atmosphere: Object.freeze({
        title: 'Atmosfer',
        fields: Object.freeze({
          cloudCover: range('Tutupan awan', 0.35, 0, 1, 0.01, { format: 'percent' }),
          haze: range('Kabut tipis (turbidity)', 2.5, 1, 12, 0.1),
          exposure: range('Exposure', 0.9, 0.3, 2, 0.01),
          fogDistance: range('Jarak kabut', 1100, 300, 2000, 10, { unit: 'm' }),
        }),
      }),
    }),
  }),
  weather: Object.freeze({
    title: 'Cuaca',
    icon: 'cloud',
    sections: Object.freeze({
      rain: Object.freeze({
        title: 'Hujan',
        fields: Object.freeze({
          raining: toggle('Hujan', false),
          intensity: range('Intensitas', 0.7, 0.1, 1, 0.01, { format: 'percent' }),
          wetness: range('Permukaan basah', 1, 0, 1, 0.01, { format: 'percent' }),
          wind: range('Angin', 0.3, 0, 1, 0.01, { format: 'percent' }),
          sound: toggle('Suara hujan', true),
        }),
      }),
    }),
  }),
  graphics: Object.freeze({
    title: 'Grafik',
    icon: 'sparkle',
    sections: Object.freeze({
      quality: Object.freeze({
        title: 'Kualitas',
        fields: Object.freeze({
          shadowQuality: select('Kualitas bayangan', 'sedang', ['mati', 'rendah', 'sedang', 'tinggi']),
          pixelRatio: range('Resolusi render', 1.25, 0.5, 2, 0.05, { unit: '×' }),
          adaptiveResolution: toggle('Resolusi adaptif (jaga FPS)', true),
          ao: toggle('Ambient occlusion', false),
          vignette: toggle('Vignette', true),
          outline: toggle('Garis tepi', true),
          gayaGrafis: select('Gaya grafis', 'kartun', ['asli', 'kartun', 'facet'], {
            labels: { asli: 'Asli', kartun: 'Kartun (halus, hemat) — L', facet: 'Facet (low-poly bersegi)' },
          }),
          tanahPbr: select('Kualitas tekstur tanah (kartun)', 'auto', ['auto', 'tinggi', 'sedang', 'rendah'], {
            labels: { auto: 'Otomatis (ikut resolusi)', tinggi: 'Tinggi (5 lapisan + normal)', sedang: 'Sedang (3 lapisan + normal)', rendah: 'Rendah (albedo saja)' },
          }),
          kartuDaun: toggle('Pohon rimbun kartu daun (kartun)', true),
          bloom: toggle('Bloom (kartun/facet)', true),
          tiltShift: toggle('Efek maket (blur atas-bawah)', false),
          gradingStrength: range('Kekuatan grading', 1, 0, 1, 0.05, { format: 'percent' }),
          crowdDensity: range('Kepadatan penonton', 1, 0, 1, 0.05, { format: 'percent' }),
        }),
      }),
    }),
  }),
  camera: Object.freeze({
    title: 'Kamera',
    icon: 'camera',
    sections: Object.freeze({
      view: Object.freeze({
        title: 'Pandangan',
        fields: Object.freeze({
          mode: select('Mode', 'third', ['third', 'first', 'angled'], {
            labels: { third: 'Orang ketiga', first: 'Orang pertama', angled: '3/4 dari atas (C)' },
          }),
          angledLockYaw: toggle('Kunci arah kamera (3/4)', false),
          angledDistance: range('Jarak kamera 3/4', 24, 10, 45, 0.5, { unit: 'm' }),
          fov: range('Sudut pandang (FOV)', 60, 40, 100, 1, { unit: '°' }),
          sensitivity: range('Sensitivitas mouse', 1, 0.2, 3, 0.05, { unit: '×' }),
          followSmoothing: range('Kehalusan kamera', 6, 1, 15, 0.5),
        }),
      }),
    }),
  }),
  audio: Object.freeze({
    title: 'Audio',
    icon: 'speaker',
    sections: Object.freeze({
      mix: Object.freeze({
        title: 'Volume',
        fields: Object.freeze({
          master: range('Utama', 0.8, 0, 1, 0.01, { format: 'percent' }),
          bell: range('Bel sepeda', 1, 0, 1, 0.01, { format: 'percent' }),
          ambience: range('Suasana', 0.6, 0, 1, 0.01, { format: 'percent' }),
        }),
      }),
    }),
  }),
  performance: Object.freeze({
    title: 'Performa',
    icon: 'gauge',
    sections: Object.freeze({
      stats: Object.freeze({
        title: 'Statistik',
        fields: Object.freeze({
          showStats: toggle('Tampilkan FPS & draw call', true),
          minimap: toggle('Minimap', true),
          labels: toggle('Label pedagang', true),
        }),
      }),
    }),
  }),
});

/** Daftar datar [key, field] untuk semua field: key = "grup.field". */
export function listFields(schema = SETTINGS_SCHEMA) {
  const out = [];
  for (const [g, group] of Object.entries(schema)) {
    for (const section of Object.values(group.sections)) {
      for (const [f, field] of Object.entries(section.fields)) out.push([`${g}.${f}`, field]);
    }
  }
  return out;
}

export function defaultSettings(schema = SETTINGS_SCHEMA) {
  return Object.freeze(Object.fromEntries(listFields(schema).map(([k, f]) => [k, f.default])));
}

/** Validasi & normalisasi satu nilai terhadap field; nilai tak valid → default. */
export function coerceValue(field, value) {
  if (field.type === 'toggle') return typeof value === 'boolean' ? value : field.default;
  if (field.type === 'select') return field.options.includes(value) ? value : field.default;
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
  const n = isNumeric ? Number(value) : NaN;
  if (!Number.isFinite(n)) return field.default;
  const clamped = Math.min(field.max, Math.max(field.min, n));
  const stepped = Math.round((clamped - field.min) / field.step) * field.step + field.min;
  return Math.min(field.max, Number(stepped.toFixed(6)));
}

/** Format nilai untuk tampilan (jam, persen, satuan). */
export function formatValue(field, value) {
  if (field.type === 'toggle') return value ? 'Aktif' : 'Nonaktif';
  if (field.type === 'select') return field.labels?.[value] ?? value;
  if (field.format === 'clock') {
    const h = Math.floor(value) % 24;
    const m = Math.floor((value - Math.floor(value)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (field.format === 'percent') return `${Math.round(value * 100)}%`;
  const digits = field.step >= 1 ? 0 : field.step >= 0.1 ? 1 : 2;
  return `${value.toFixed(digits)}${field.unit ? ` ${field.unit}` : ''}`.trim();
}
