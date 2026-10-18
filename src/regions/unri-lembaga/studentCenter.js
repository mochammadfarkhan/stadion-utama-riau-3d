/**
 * H03 hero:student-center — Gedung Serba Guna / Student Center ADB. Fakta: fungsi & lokasi "di Jl. Muchtar
 * Lutfi antara asrama mahasiswa dan stadion mini" [T]; way 1480014538 (53,2 × 50,9 m) = kandidat [S].
 * Rupa = K03 adb-layar (foto gedung ADB lain [T]): massa putih/abu muda, layar perforasi oranye-terakota,
 * atap pelana lebar; 3 lt @ 4,2 m [INFERENSI dari catalog H03 16 m]. Tambahan hero: kanopi beton di muka
 * utara (menghadap jalan servis & Jl. Muchtar Lutfi), undakan, panel nama hitam huruf putih kapital berdiri.
 */
import * as THREE from 'three';
import { ringBounds } from '../../geo/polygon.js';
import { boxAt, facePlane } from '../../world/props/unri/geom.js';
import { FOOTPRINTS, FOOTPRINTS_WORLD } from './placement.js';
import { buildKitBuildingLocal } from './kitAdapter.js';
import { staged, meshesByMaterial } from './staged.js';

export const SC_SPEC = Object.freeze({
  id: 'w1480014538', levels: 3, archetype: 'K03',
  overrides: Object.freeze({ palette: 'putih', roof: 'pelana-lebar', motif: 'segitiga', sign: 'STUDENT CENTER' }),
});
const CANOPY = Object.freeze({ w: 10, d: 4.5, y: 4.2, t: 0.3 });

/**
 * @param {{heightAt:(lx:number,lz:number)=>number, heightAtWorld:(x:number,z:number)=>number, mats:object, atlas:object, scope:object}} opts
 */
export function createStudentCenterBuilder({ heightAt, heightAtWorld, mats, atlas, scope }) {
  const b = ringBounds(FOOTPRINTS.studentCenter);
  const cx = (b.minX + b.maxX) / 2;
  const front = b.minZ;
  const y = heightAt(cx, front);
  return staged('H03-student-center', [
    () => buildKitBuildingLocal({
      id: SC_SPEC.id, ringWorld: FOOTPRINTS_WORLD.studentCenter, levels: SC_SPEC.levels, archetype: SC_SPEC.archetype,
      overrides: SC_SPEC.overrides, groundYWorld: heightAtWorld, scope,
    }).group,
    () => {
      const putih = [
        boxAt(CANOPY.w, CANOPY.t, CANOPY.d, cx, y + CANOPY.y, front - CANOPY.d / 2),
        boxAt(0.4, CANOPY.y, 0.4, cx - CANOPY.w / 2 + 0.4, y, front - CANOPY.d + 0.3),
        boxAt(0.4, CANOPY.y, 0.4, cx + CANOPY.w / 2 - 0.4, y, front - CANOPY.d + 0.3),
        ...[0, 1, 2].map((k) => boxAt(CANOPY.w - k * 0.6, 0.15, 0.45, cx, y + k * 0.15, front - 0.25 - (2 - k) * 0.45)),
      ];
      const hitam = [boxAt(4.4, 1.5, 0.3, cx + 9, y, front - 6.5)];
      const g = meshesByMaterial('H03-hero', [[mats.putih, putih], [mats.gelap, hitam]], { cast: true });
      const sign = new THREE.Mesh(facePlane(4.2, 1.05, { x: cx + 9, y: y + 0.85, z: front - 6.5 - 0.151, cell: atlas.cell('nama:sc') }), mats.atlas);
      sign.name = 'H03-nama';
      g.add(sign);
      return g;
    },
  ]);
}
