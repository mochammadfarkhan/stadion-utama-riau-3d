/**
 * Collider komposit (menggantikan fungsi global lama): titik dunia → region yang mask-nya memuat
 * titik itu (koordinat diubah ke lokal region) → collider region; selain itu → `fallback`
 * (Fase 2: TileCollider). Tidak mengimpor modul geometri stadion: geometri datang dari region.
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../geo/polygon.js';

const OPEN = Object.freeze({ isWalkable: () => true, isCameraClear: () => true });

/** Bungkus collider region-lokal agar menerima koordinat dunia (dipakai sebagai fallback). */
export function localized(region, colliders) {
  return Object.freeze({
    isWalkable(x, z) {
      const l = toLocal(region.placement, x, z);
      return colliders.isWalkable(l.x, l.z);
    },
    isCameraClear(x, z) {
      const l = toLocal(region.placement, x, z);
      return colliders.isCameraClear(l.x, l.z);
    },
  });
}

/**
 * @param {{regions?: Array<{region:{placement:object, mask:Array<[number,number]>}, colliders:object}>,
 *   fallback?: {isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}} [opts]
 * @returns {{isWalkable(x:number, z:number):boolean, isCameraClear(x:number, z:number):boolean}}
 */
export function createCompositeCollider({ regions = [], fallback = OPEN } = {}) {
  const list = regions.map(({ region, colliders }) => Object.freeze({ region, colliders }));
  const route = (x, z, method) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    for (const { region, colliders } of list) {
      const l = toLocal(region.placement, x, z);
      if (pointInPolygon(l.x, l.z, region.mask)) return colliders[method](l.x, l.z);
    }
    return fallback[method](x, z);
  };
  return Object.freeze({
    isWalkable: (x, z) => route(x, z, 'isWalkable'),
    isCameraClear: (x, z) => route(x, z, 'isCameraClear'),
  });
}

/**
 * Collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
 * Mencoba meluncur (slide) di sumbu X atau Z agar tidak "lengket". Bila posisi terakhir sendiri
 * menjadi tidak valid (tile kota baru dimuat di bawah sepeda), gerakan dibebaskan agar tidak terkunci.
 * @param {{x:number, z:number}} start
 * @param {(x:number, z:number) => boolean} isWalkable
 */
export function createCollider(start = { x: 0, z: 0 }, isWalkable) {
  if (typeof isWalkable !== 'function') throw new TypeError('createCollider: isWalkable(x, z) wajib');
  let last = { x: start.x, z: start.z };
  return (x, z) => {
    if (isWalkable(x, z)) return (last = { x, z });
    if (!isWalkable(last.x, last.z)) return (last = { x, z }); // terjebak: biarkan keluar
    if (isWalkable(x, last.z)) return (last = { x, z: last.z });
    if (isWalkable(last.x, z)) return (last = { x: last.x, z });
    return { ...last };
  };
}
