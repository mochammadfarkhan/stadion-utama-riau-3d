// src/regions/unri-rektorat/mask.js
/**
 * Mask region unri-rektorat (region-lokal; satu sumber untuk collider komposit & citybake/campusbake).
 * Poligon 16 titik: Perpustakaan (blok barat-laut, takik di x −94…−24 untuk mengeluarkan "Area Parkir
 * Perpustakaan" way 282225395), Rektorat + parkir depan, poros taman, Danau Buatan + titian keluaran danau
 * (way 783152923), Putaran Jl. Mukhtar Luthfi (+11 m di timur), dan trotoar selatan danau. Tidak beririsan stadion/unri-lembaga (dites).
 */
import { localToWorld } from './placement.js';

export const REKTORAT_MASK = Object.freeze([
  [-149.2, -85], [-94.2, -85], [-80.2, -71.5], [-24.2, -85], [85.8, -88], [225.8, -35], [262, -33], [287, -29],
  [309.8, 0], [309.8, 30], [260.8, 62], [140.8, 105], [85.8, 58], [-44.2, 51], [-44.2, -32], [-149.2, -32],
].map((p) => Object.freeze(p)));

/** Mask dalam koordinat DUNIA [[x, z], ...]. */
export function rektoratMaskWorld(mask = REKTORAT_MASK) {
  return mask.map(([x, z]) => localToWorld(x, z));
}
