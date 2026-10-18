/**
 * Layanan terrain global (spec §4.1): satu HeightField yang disuntikkan sebagai `ctx.terrain` ke sistem,
 * region, distrik, entitas. M0 membuat stub datar; M1 mengisi dengan HeightField nyata tanpa mengubah
 * ekspor. Di luar chunk distrik heightAt = 0 sehingga stadion & tile kota tidak berubah perilakunya.
 */
import { createHeightField } from '../geo/terrain/heightfield.js';

/** Terrain datar (default ctx region/tes): heightAt 0, normal +Y, grade 0. */
export const FLAT_TERRAIN = Object.freeze({
  heightAt: () => 0,
  normalAt: (x, z, out = { x: 0, y: 1, z: 0 }) => {
    out.x = 0;
    out.y = 1;
    out.z = 0;
    return out;
  },
  gradeAlong: () => 0,
  version: 0,
});

/**
 * @param {{field?: ReturnType<typeof createHeightField>}} [opts]
 * @returns {{field: ReturnType<typeof createHeightField>, heightAt(x:number, z:number):number,
 *   normalAt(x:number, z:number, out?:object):{x:number,y:number,z:number}, gradeAlong(x:number, z:number, yaw:number):number,
 *   readonly version:number}}
 */
export function createTerrainService({ field = createHeightField() } = {}) {
  return Object.freeze({
    field,
    heightAt: (x, z) => field.heightAt(x, z),
    normalAt: (x, z, out) => field.normalAt(x, z, out),
    gradeAlong: (x, z, yaw) => field.gradeAlong(x, z, yaw),
    get version() { return field.version; },
  });
}
