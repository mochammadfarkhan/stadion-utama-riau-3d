// src/regions/unri-rektorat/pads.js
/**
 * Pad region (region-lokal) untuk campusbake (spec §4.3, §5.2 butir 7): terrain di dalam ring diratakan
 * ke median, blend 4 m. Murni (tanpa three) agar tools/campusbake dapat mengimpor. Field `id` diabaikan
 * normalisasi Region M0 (hanya ring & y), dipakai laporan bake. rektoratPadsWorld() = bentuk
 * lembagaPadsWorld() M4 untuk REGION_PADS di tools/campusbake/config.js.
 */
import { localToWorld } from './placement.js';

const rect = (x0, z0, x1, z1) => Object.freeze([[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map((p) => Object.freeze(p)));

export const REKTORAT_PADS = Object.freeze([
  Object.freeze({ id: 'rektorat', ring: rect(-14, -36, 30, 36), y: 'median' }),        // Rektorat + kanopi + taman depan s.d. as drop-off
  Object.freeze({ id: 'perpustakaan', ring: rect(-143.2, -79.8, -82.5, -44.6), y: 'median' }),
  Object.freeze({ id: 'papan-batu', ring: rect(282.5, 5.5, 288.5, 14.5), y: 'median' }), // papan batu N01
]);

/** Pad dalam koordinat DUNIA: [{ id:'unri-rektorat:<id>', y, ring:[[x,z]…] }]. */
export function rektoratPadsWorld(pads = REKTORAT_PADS) {
  return pads.map((p) => ({ id: `unri-rektorat:${p.id}`, y: p.y, ring: p.ring.map(([x, z]) => localToWorld(x, z)) }));
}
