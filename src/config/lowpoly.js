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

/** Color grading akhir (gaya kartun & facet): saturasi/kontras dan warna sorotan/bayangan. */
export const GRADING = Object.freeze({
  kartun: Object.freeze({ saturation: 1.2, contrast: 1.06, highlight: 0xffe2b8, shadow: 0x7f94b4, strength: 0.4 }),
  facet: Object.freeze({ saturation: 1.25, contrast: 1.1, highlight: 0xffe2b8, shadow: 0x7f94b4, strength: 0.4 }),
});

/** Atmosfer: kabut lebih dekat, ambient hemisphere lebih terang dan berwarna hangat/sejuk. */
export const ATMOSPHERE = Object.freeze({
  fogScale: 0.7,
  hemiBoost: 1.35,
  hemiSkyTint: 0x9fc4ff,    // langit sejuk
  hemiGroundTint: 0xffd9a0, // pantulan tanah hangat
  hemiTintMix: 0.35,
});

/** Contact shadow (blob gelap bundar di bawah pemain & objek). */
export const CONTACT_SHADOW = Object.freeze({ max: 96, opacity: 0.38, playerRadius: 1.0, y: 0.06 });

/** Nama material yang TIDAK di-flat-shade pada gaya 'facet' (kaca/air/kain halus tampak jelek bersegi). */
export const LOWPOLY_EXCLUDE = Object.freeze(['glass', 'kaca', 'water', 'air', 'jendela', 'window', 'sky', 'cloud', 'awan']);
