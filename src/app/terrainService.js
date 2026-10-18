/**
 * Layanan terrain global (spec UNRI §4.1). M0: stub DATAR — `heightAt` = 0 di mana pun sehingga stadion
 * dan tile kota tidak berubah. Disuntikkan sebagai `ctx.terrain` ke region (mountRegion) lewat regionManager.
 * M1 mengganti isi `createTerrainService` dengan HeightField nyata (src/geo/terrain/heightfield.js) TANPA
 * mengubah ekspor: { field, heightAt, normalAt, gradeAlong, version }.
 */

/** Normal datar; menulis ke `out` bila diberikan (pola tanpa alokasi). */
function flatNormal(_x, _z, out) {
  if (!out) return { x: 0, y: 1, z: 0 };
  out.x = 0;
  out.y = 1;
  out.z = 0;
  return out;
}

/** Terrain datar (dipakai default mountRegion dan stub layanan). */
export const FLAT_TERRAIN = Object.freeze({
  heightAt: () => 0,
  normalAt: flatNormal,
  gradeAlong: () => 0,
  version: 0,
});

/**
 * @returns {{field: object, heightAt(x: number, z: number): number,
 *   normalAt(x: number, z: number, out?: {x: number, y: number, z: number}): {x: number, y: number, z: number},
 *   gradeAlong(x: number, z: number, yaw: number): number, readonly version: number}}
 */
export function createTerrainService() {
  const field = FLAT_TERRAIN;
  return Object.freeze({
    field,
    heightAt: (x, z) => field.heightAt(x, z),
    normalAt: (x, z, out) => field.normalAt(x, z, out),
    gradeAlong: (x, z, yaw) => field.gradeAlong(x, z, yaw),
    get version() { return field.version; },
  });
}
