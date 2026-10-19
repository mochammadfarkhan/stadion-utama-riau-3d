/**
 * Logika murni material PBR dunia (M8-T3, dites): pemetaan nama material GLB -> resep set PBR, proyeksi UV sumbu-dominan
 * di ruang dunia (meter; tanpa UV pada GLB), kompres kejenuhan lembut (tint atap kobalt agar tidak meledak), dan batas
 * sel atlas kit yang dianggap "dinding polos"/"atap seng" (UV dunia menggantikan atlas hanya di sel-sel itu).
 * Salinan GLSL dari proyeksi + kompres ada di pbrWorld.shader.js — dijaga tes agar identik.
 */

/** Resep per nama material hero/GLB. set = nama set di manifest; opsi lain dibaca installWorldPbr. */
export const WORLD_RECIPES = Object.freeze({
  'unri:dinding': Object.freeze({ set: 'plaster', detail: 0.85, maxSat: 0.45, lift: 1.0, stain: true, rough: 1.0 }),
  'unri:plint': Object.freeze({ set: 'concrete', detail: 0.85, maxSat: 0.4, lift: 1.0, stain: true, rough: 1.0 }),
  'unri:beton': Object.freeze({ set: 'concrete', detail: 0.85, maxSat: 0.4, lift: 1.0, stain: true, rough: 1.0 }),
  'unri:atap-biru': Object.freeze({ set: 'roofSteel', detail: 0.5, maxSat: 0.42, lift: 1.18, rust: true, rough: 1.0, metal: 0.55 }),
  'unri:atap-bubungan': Object.freeze({ set: 'roofSteel', detail: 0.5, maxSat: 0.42, lift: 1.1, rust: true, rough: 1.0, metal: 0.55 }),
  'unri:kayu': Object.freeze({ set: 'wood', detail: 0.9, maxSat: 0.7, lift: 1.0, rough: 1.0 }),
});

/** Resep untuk nama material (huruf besar/kecil diabaikan) atau null bila tak dipetakan. */
export function recipeForMaterial(name) {
  if (typeof name !== 'string') return null;
  return WORLD_RECIPES[name.toLowerCase()] ?? null;
}

/** Sumbu paling sejajar dengan normal: 'x' | 'y' | 'z' (seri: y menang, lalu x). */
export function dominantAxis(nx, ny, nz) {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ay >= ax && ay >= az) return 'y';
  return ax >= az ? 'x' : 'z';
}

/**
 * UV meter dunia (satu proyeksi) untuk titik p dengan normal n. Tangan-kanan terhadap normal (u x v searah n) agar
 * normal map tidak terbalik pada sisi menghadap berlawanan. y: (x, -z) untuk menghadap atas, (x, z) bawah;
 * x: (-z*s, y) dengan s = tanda nx (nx >= 0 -> -z); z: (x*s, y) dengan s = tanda nz.
 * @returns {[number, number]}
 */
export function projectUv(n, p) {
  const axis = dominantAxis(n[0], n[1], n[2]);
  if (axis === 'y') return [p[0], n[1] >= 0 ? -p[2] : p[2]];
  if (axis === 'x') return [n[0] >= 0 ? -p[2] : p[2], p[1]];
  return [n[2] >= 0 ? p[0] : -p[0], p[1]];
}

/** Arah u dan v (vektor dunia) yang dipakai projectUv untuk normal n — untuk tes tangan-kanan. */
export function projectBasis(n) {
  const axis = dominantAxis(n[0], n[1], n[2]);
  if (axis === 'y') return n[1] >= 0 ? { u: [1, 0, 0], v: [0, 0, -1] } : { u: [1, 0, 0], v: [0, 0, 1] };
  if (axis === 'x') return n[0] >= 0 ? { u: [0, 0, -1], v: [0, 1, 0] } : { u: [0, 0, 1], v: [0, 1, 0] };
  return n[2] >= 0 ? { u: [1, 0, 0], v: [0, 1, 0] } : { u: [-1, 0, 0], v: [0, 1, 0] };
}

const LUMA = Object.freeze([0.2126, 0.7152, 0.0722]);

/**
 * Kompres kejenuhan lembut (HSV) pada warna linear: kejenuhan <= maxSat tidak berubah; di atasnya hanya 35% selisih
 * yang dipertahankan; kecerahan (luminans) dipertahankan. Identik dengan wpCompress di GLSL.
 * @param {[number, number, number]} c
 */
export function compressSaturation(c, maxSat) {
  const mx = Math.max(c[0], c[1], c[2]);
  const mn = Math.min(c[0], c[1], c[2]);
  const s = mx > 1e-4 ? (mx - mn) / mx : 0;
  if (s <= maxSat) return [c[0], c[1], c[2]];
  const k = (maxSat + (s - maxSat) * 0.35) / s;
  const l = LUMA[0] * c[0] + LUMA[1] * c[1] + LUMA[2] * c[2];
  return c.map((v) => Math.max(l + (v - l) * k, 0));
}

/**
 * Sel atlas kit (UV atlas 2048): dinding polos baris 0 x < 1280 (plester, plester-kusam, beton, beton-mentah, beton-coret),
 * atap seng baris 1 x < 512 (seng, seng-karat). Mengembalikan 'dinding' | 'atap' | null.
 */
export function kitCellRole(u, v) {
  if (v >= 0.875 && u < 0.625) return 'dinding';
  if (v >= 0.75 && v < 0.875 && u < 0.25) return 'atap';
  return null;
}

/** Konstanta batas sel kit untuk GLSL (sumber tunggal dengan kitCellRole). */
export const KIT_CELL_BOUNDS = Object.freeze({ wallV: 0.875, wallU: 0.625, roofV0: 0.75, roofV1: 0.875, roofU: 0.25 });
