// src/regions/unri-rektorat/placement.js
/**
 * Placement region "unri-rektorat" (murni; dipakai klien & campusbake). Titik acuan = pusat massa utama
 * Gedung Rektorat (OSM way 282225347; cache data-src/osm/stadion.json diproyeksikan dengan WORLD_ORIGIN):
 * x −985,8, z 800,0. yaw 0 karena gedung praktis sejajar sumbu (tepi utara & selatan OSM dz = 0); seluruh
 * modul region mengandalkan yaw 0 (lokal = dunia − titik acuan) sehingga geometri dunia (drape, kit)
 * cukup ditranslasi.
 */
export const REKTORAT_ID = 'unri-rektorat';

export const REKTORAT_PLACEMENT = Object.freeze({ x: -985.8, z: 800.0, yaw: 0 });

/** Lokal → dunia [x, z] (yaw 0: translasi). */
export const localToWorld = (lx, lz) => [lx + REKTORAT_PLACEMENT.x, lz + REKTORAT_PLACEMENT.z];

/** Dunia → lokal [lx, lz]. */
export const worldToLocal = (x, z) => [x - REKTORAT_PLACEMENT.x, z - REKTORAT_PLACEMENT.z];

/** Aktivasi (spec §4.3): pusat = poros taman (lokal 80, 5) agar Rektorat, danau, dan perpustakaan tercakup. */
export const REKTORAT_ACTIVATION = Object.freeze({
  center: Object.freeze({ x: -905.8, z: 805.0 }),
  mountRadius: 700,
  unmountRadius: 900,
});
