/**
 * Warna vertex. glTF COLOR_0 berada di ruang LINEAR, jadi palet sRGB (#rrggbb) dikonversi di sini.
 */

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** '#rrggbb' (sRGB) → [r, g, b] linear 0..1. */
export function hexToLinear(hex) {
  const m = String(hex).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new TypeError(`warna tidak valid: ${hex}`);
  return [1, 2, 3].map((i) => srgbToLinear(parseInt(m[i], 16) / 255));
}

/** Kalikan warna linear dengan faktor (gelap < 1 < terang), dibatasi 0..1. */
export const shade = (rgb, factor) => rgb.map((c) => Math.min(1, Math.max(0, c * factor)));
