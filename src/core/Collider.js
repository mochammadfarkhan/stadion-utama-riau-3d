/**
 * Collider komposit (menggantikan fungsi global lama): titik dunia → region yang mask-nya memuat
 * titik itu (koordinat diubah ke lokal region) → collider region; selain itu → `fallback`
 * (Fase 2: TileCollider). Tidak mengimpor modul geometri stadion: geometri datang dari region.
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../geo/polygon.js';

const OPEN = Object.freeze({ isWalkable: () => true, isCameraClear: () => true, penetration: () => 0 });
/** Kedalaman titik di zona terhalang; collider tanpa `penetration` dianggap 0 (perilaku lama). */
const depthOf = (colliders, x, z) => (typeof colliders.penetration === 'function' ? colliders.penetration(x, z) : 0);

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
    penetration(x, z) {
      const l = toLocal(region.placement, x, z);
      return depthOf(colliders, l.x, l.z);
    },
  });
}

/**
 * @param {{regions?: Array<{region:{placement:object, mask:Array<[number,number]>}, colliders:object}>,
 *   fallback?: {isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}} [opts]
 * @returns {{isWalkable(x:number, z:number):boolean, isCameraClear(x:number, z:number):boolean,
 *   penetration(x:number, z:number):number}} `penetration`: Infinity untuk koordinat tak hingga.
 */
export function createCompositeCollider({ regions = [], fallback = OPEN } = {}) {
  const list = regions.map(({ region, colliders }) => Object.freeze({ region, colliders }));
  const route = (x, z, query, invalid) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return invalid;
    for (const { region, colliders } of list) {
      const l = toLocal(region.placement, x, z);
      if (pointInPolygon(l.x, l.z, region.mask)) return query(colliders, l.x, l.z);
    }
    return query(fallback, x, z);
  };
  return Object.freeze({
    isWalkable: (x, z) => route(x, z, (c, px, pz) => c.isWalkable(px, pz), false),
    isCameraClear: (x, z) => route(x, z, (c, px, pz) => c.isCameraClear(px, pz), false),
    penetration: (x, z) => route(x, z, depthOf, Infinity),
  });
}

/**
 * Collider komposit DINAMIS (M0 multi-region): daftar region aktif dan fallback dapat diganti saat
 * region dipasang/dilepas (regionManager memanggil setRegions). Fungsi isWalkable/isCameraClear/penetration
 * stabil (aman disimpan CameraRig & collider sepeda) dan selalu membaca komposit terbaru.
 * @param {{fallback?: {isWalkable(x:number,z:number):boolean, isCameraClear(x:number,z:number):boolean}}} [opts]
 */
export function createDynamicCompositeCollider({ fallback = OPEN } = {}) {
  let regions = [];
  let fb = fallback;
  let inner = createCompositeCollider({ regions, fallback: fb });
  const rebuild = () => { inner = createCompositeCollider({ regions, fallback: fb }); };
  return Object.freeze({
    isWalkable: (x, z) => inner.isWalkable(x, z),
    isCameraClear: (x, z) => inner.isCameraClear(x, z),
    penetration: (x, z) => inner.penetration(x, z),
    /** @param {Array<{region:{placement:object, mask:Array<[number,number]>}, colliders:object}>} list */
    setRegions(list) {
      if (!Array.isArray(list)) throw new TypeError('setRegions: list harus array {region, colliders}');
      regions = [...list];
      rebuild();
    },
    setFallback(next) {
      if (typeof next?.isWalkable !== 'function' || typeof next?.isCameraClear !== 'function') {
        throw new TypeError('setFallback: collider butuh isWalkable(x,z) dan isCameraClear(x,z)');
      }
      fb = next;
      rebuild();
    },
  });
}

const TRAPPED_EPS = 1e-6;

/**
 * Collider stateful: mengembalikan posisi valid terakhir bila posisi baru menabrak.
 * Mencoba meluncur (slide) di sumbu X atau Z agar tidak "lengket". Bila posisi terakhir sendiri
 * menjadi tidak valid (tile kota baru dimuat di bawah sepeda), gerakan hanya diterima bila tidak
 * menambah kedalaman `penetration` (keluar lewat tepi terdekat, tidak bisa menembus bangunan/air).
 * Tanpa `penetration` (default 0 di mana-mana) setiap gerakan dari posisi terjebak dibebaskan.
 * @param {{x:number, z:number}} start
 * @param {(x:number, z:number) => boolean} isWalkable
 * @param {(x:number, z:number) => number} [penetration]
 */
export function createCollider(start = { x: 0, z: 0 }, isWalkable, penetration = () => 0) {
  if (typeof isWalkable !== 'function') throw new TypeError('createCollider: isWalkable(x, z) wajib');
  if (typeof penetration !== 'function') throw new TypeError('createCollider: penetration(x, z) harus fungsi');
  let last = { x: start.x, z: start.z };
  return (x, z) => {
    if (isWalkable(x, z)) return (last = { x, z });
    if (!isWalkable(last.x, last.z) && penetration(x, z) <= penetration(last.x, last.z) + TRAPPED_EPS) {
      return (last = { x, z }); // terjebak: hanya boleh keluar (kedalaman tidak bertambah)
    }
    if (isWalkable(x, last.z)) return (last = { x, z: last.z });
    if (isWalkable(last.x, z)) return (last = { x: last.x, z });
    return { ...last };
  };
}
