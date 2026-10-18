/**
 * Mask region "unri-lembaga" (beku, koordinat DUNIA) — SATU sumber untuk collider komposit, regionManager,
 * dan tes. Batas: utara z 690 (Jl. Muchtar Lutfi lajur ganda z 694–733 ikut di dalam), taji FH x −112…−20
 * sampai z 568, timur x 110 (parkir rusunawa ≤ 103), selatan/tenggara = batas kampus OSM way 938374562
 * di-inset 6 m (di dalam UNRI_BOUNDARY yang disederhanakan 5 m), barat x −415 (jogging track ≥ −407,5).
 * Tidak beririsan dengan mask stadion (berakhir di z +322).
 */
import { toRegion } from './placement.js';

const freeze = (pts) => Object.freeze(pts.map((p) => Object.freeze(p)));

export const LEMBAGA_MASK_WORLD = freeze([
  [-415, 690], [-112, 690], [-112, 568], [-20, 568], [-20, 690], [110, 690], [110, 860.3],
  [-47.5, 896.2], [-43.3, 950.1], [-69.3, 958.5], [-67.6, 1020.9], [-122.5, 1026.6], [-114.4, 1090.3],
  [-132.6, 1093], [-130.5, 1106.2], [-243.8, 1125.7], [-324.1, 1137.7], [-415, 1131.3],
]);

/** Mask region-lokal (dipakai defineRegion). */
export const LEMBAGA_MASK = freeze(LEMBAGA_MASK_WORLD.map(([x, z]) => toRegion(x, z)));

/** Salinan dunia (untuk alat bake/diagnostik). */
export function lembagaMaskWorld() {
  return LEMBAGA_MASK_WORLD.map(([x, z]) => [x, z]);
}

/**
 * Aktivasi streaming region (spec §4.3): pusat dunia = pusat bbox mask; titik mask terjauh 383 m.
 * Spawn stadion (0, −275) berjarak 1.135 m → tidak terpasang saat mulai.
 */
export const LEMBAGA_ACTIVATION = Object.freeze({ center: Object.freeze({ x: -152, z: 853 }), mountRadius: 700, unmountRadius: 900 });
