/**
 * Konfigurasi gaya grafis 'kartun' / 'facet' (satu tempat untuk semua faktor; tanpa angka sihir tersebar).
 * Gaya: 'asli' (tanpa perubahan) | 'kartun' (shading halus + color grading + contact shadow) | 'facet' (flat shading bersegi).
 */
export const STYLES = Object.freeze(['asli', 'kartun', 'facet']);

/** Penghematan aktif hanya di mode kamera 3/4 + gaya bukan 'asli' (pandangan dari atas jauh lebih sempit). */
export const LOWPOLY_SAVINGS = Object.freeze({
  lodScale: 0.6,       // radius LOD humanoid, pohon, klaster gedung, detail tanah dikali ini (-40%)
  tileLoadScale: 0.45, // radius muat tile kota 1000 m -> 450 m
  tileLod0Scale: 0.6,
  densityScale: 0.6,   // kepadatan penonton
  shadowMapSize: 1024,
  pixelRatioCap: 1.25,
});

/** Frustum bayangan matahari di mode 3/4 (setengah lebar, m) vs. asli (200 m). */
export const ANGLED_SHADOW_EXTENT = 45;

/**
 * Color grading akhir (gaya kartun & facet). `satKnee`/`satCeil`: pembatas saturasi (HSV, ruang linear): saturasi di atas
 * `satKnee` dikompres halus menuju `satCeil` agar biru jenuh (atap sekre, kaca) tidak meledak.
 * Split-toning: sorotan #FFE2B8, bayangan #5A7BA8; kekuatan dasar x kekuatan per jam (LIGHT_BY_HOUR.split) x pengaturan.
 */
export const GRADING = Object.freeze({
  kartun: Object.freeze({
    saturation: 1.1, contrast: 1.05, highlight: 0xffe2b8, shadow: 0x5a7ba8, strength: 0.4, satKnee: 0.5, satCeil: 0.78, vignette: 0.16,
  }),
  facet: Object.freeze({
    saturation: 1.12, contrast: 1.08, highlight: 0xffe2b8, shadow: 0x5a7ba8, strength: 0.4, satKnee: 0.5, satCeil: 0.78, vignette: 0.16,
  }),
});

/** Atmosfer: kabut sedikit lebih dekat, hamburan kabut ke arah matahari, matahari lebih rendah, bayangan lembut. */
export const ATMOSPHERE = Object.freeze({
  fogScale: 0.8,
  fogColorMix: 0.75,       // warna kabut tabel jam vs. preset dasar
  sunElevationScale: 0.82, // elevasi matahari siang x ini (bayangan lebih panjang, cahaya lebih emas)
  shadowRadius: 2.2,       // VSM: >= 3 menghapus bayangan; 2.2 lebih lembut dari 1.5 tanpa hilang
  scatterPower: 4,         // eksponen dot(viewDir, sunDir)
  skyMie: 0.011,           // Mie langit (halo di sekitar matahari)
  auraBoost: 1.5,          // pengali aura/halo matahari
});

/**
 * Cahaya per jam untuk gaya kartun/facet (diinterpolasi, wrap 24 -> 0). Pengali dikenakan pada preset dasar (sim/dayCycle):
 * sunMul (intensitas matahari/bulan), hemiMul (ambient), expMul (eksposur); warna menggantikan (sunColor, hemiSky, hemiGround)
 * atau dicampur (fogColor). split = kekuatan split-toning; haze = kekuatan hamburan kabut ke matahari (0..1).
 */
export const LIGHT_BY_HOUR = Object.freeze([
  { hour: 0, sunColor: 0x8fa6e6, sunMul: 2.4, hemiSky: 0x5a78c0, hemiGround: 0x38426a, hemiMul: 3.2, fogColor: 0x20305c, expMul: 1.4, split: 0.45, haze: 0.1 },
  { hour: 5, sunColor: 0xb9b0f0, sunMul: 2.2, hemiSky: 0x7488c8, hemiGround: 0x4a4a68, hemiMul: 2.6, fogColor: 0x5c6a9a, expMul: 1.3, split: 0.5, haze: 0.3 },
  { hour: 6.5, sunColor: 0xffc890, sunMul: 1.1, hemiSky: 0xa0b4e0, hemiGround: 0xe8c898, hemiMul: 1.5, fogColor: 0xf0c8a4, expMul: 1.05, split: 0.6, haze: 0.8 },
  { hour: 7.5, sunColor: 0xffd9a0, sunMul: 1.0, hemiSky: 0xa8c4ee, hemiGround: 0xf0cf9a, hemiMul: 1.35, fogColor: 0xf3dcc0, expMul: 1.0, split: 0.5, haze: 0.7 },
  { hour: 12, sunColor: 0xfff4e6, sunMul: 0.95, hemiSky: 0x9cc8ff, hemiGround: 0xe0d4a8, hemiMul: 1.3, fogColor: 0xcfe0f0, expMul: 0.97, split: 0.3, haze: 0.35 },
  { hour: 16, sunColor: 0xffcf8a, sunMul: 1.05, hemiSky: 0xa4bce8, hemiGround: 0xf0c488, hemiMul: 1.35, fogColor: 0xf6d3a2, expMul: 1.0, split: 0.7, haze: 0.9 },
  { hour: 17.5, sunColor: 0xff9d55, sunMul: 1.25, hemiSky: 0x9a8cc4, hemiGround: 0xd8946a, hemiMul: 1.5, fogColor: 0xf0a878, expMul: 1.05, split: 0.85, haze: 1.0 },
  { hour: 18.5, sunColor: 0xff7a50, sunMul: 1.5, hemiSky: 0x7280c4, hemiGround: 0x8a5a70, hemiMul: 1.8, fogColor: 0xc87a8a, expMul: 1.2, split: 0.8, haze: 0.8 },
  { hour: 19.5, sunColor: 0x7f92d6, sunMul: 2.2, hemiSky: 0x5068b0, hemiGround: 0x30365a, hemiMul: 2.5, fogColor: 0x2e3e70, expMul: 1.32, split: 0.5, haze: 0.3 },
  { hour: 21, sunColor: 0x8fa6e6, sunMul: 2.4, hemiSky: 0x5a78c0, hemiGround: 0x38426a, hemiMul: 3.2, fogColor: 0x20305c, expMul: 1.4, split: 0.45, haze: 0.1 },
]);

/** Bloom halus: setengah resolusi, ambang tinggi (luma HDR linear) -> hanya matahari, kaca, air, lampu. */
export const BLOOM = Object.freeze({ threshold: 1.25, knee: 0.5, intensity: 0.32, scale: 0.5, radius: 1.0 });

/** Efek maket (tilt-shift): blur dua pass setengah resolusi; bobot dari jarak vertikal layar ke tengah. */
export const TILT_SHIFT = Object.freeze({ focus: 0.5, band: 0.2, falloff: 0.28, radius: 1.8, scale: 0.5 });

/** Auto-turun kualitas efek (urutan: tilt-shift -> bloom); histeresis: turun < lowFps selama lowSecs, naik > highFps selama highSecs. */
export const AUTO_QUALITY = Object.freeze({ lowFps: 45, highFps: 58, lowSecs: 3, highSecs: 3, maxHighSecs: 24, smoothing: 1.0, maxLevel: 2 });

/** Contact shadow (blob gelap bundar di bawah pemain & objek). */
export const CONTACT_SHADOW = Object.freeze({ max: 96, opacity: 0.38, playerRadius: 1.0, y: 0.06 });

/** Nama material yang TIDAK di-flat-shade pada gaya 'facet' (kaca/air/kain halus tampak jelek bersegi). */
export const LOWPOLY_EXCLUDE = Object.freeze(['glass', 'kaca', 'water', 'air', 'jendela', 'window', 'sky', 'cloud', 'awan']);
