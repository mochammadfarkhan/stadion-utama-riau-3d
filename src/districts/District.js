/**
 * Kontrak distrik (spec §4.2): lapisan antara region handmade dan tile kota, berkoordinat DUNIA (tanpa
 * placement). `defineDistrict` memvalidasi & membekukan definisi; `validateDistrictBuild` memeriksa hasil
 * build. Murni (tanpa three); objek three hanya dicek lewat flag `isObject3D`.
 */
import { cleanRing, orientRing, pointInPolygon, polygonArea, ringBounds } from '../geo/polygon.js';

const finite = Number.isFinite;

/**
 * @typedef {{id:string, phase:'input'|'sim'|'world'|'camera'|'ui', update(dt:number, ctx:object):void, dispose?():void}} System
 * @typedef {{isWalkable(x:number, z:number):boolean, isCameraClear(x:number, z:number):boolean,
 *   penetration?(x:number, z:number):number}} DistrictColliders koordinat dunia
 * @typedef {{group:object, systems:System[], colliders:DistrictColliders,
 *   minimapLayer(ctx2d:CanvasRenderingContext2D, view:{toCanvas(x:number, z:number):[number, number], scale:number}):void,
 *   excludeIds:Set<string>, whenSettled(x:number, z:number):Promise<boolean>, dispose():void,
 *   groundHole?:{minX:number, minZ:number, cell:number, cols:number, rows:number, data:Uint8Array}}} DistrictBuild
 */

/**
 * @param {{id:string, boundary:Array<[number,number]>, manifestUrl:string, build(ctx:object):Promise<DistrictBuild>}} spec
 * @returns {Readonly<{id:string, boundary:ReadonlyArray<readonly [number, number]>, bounds:object, manifestUrl:string,
 *   build(ctx:object):Promise<DistrictBuild>}>} boundary dibersihkan & berorientasi luas bertanda positif
 */
export function defineDistrict(spec) {
  if (!spec || typeof spec.id !== 'string' || !/^[a-z0-9-]+$/.test(spec.id)) {
    throw new TypeError('Distrik: id wajib string huruf kecil/angka/strip');
  }
  const ok = Array.isArray(spec.boundary) && spec.boundary.every((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]));
  const ring = ok ? cleanRing(spec.boundary) : [];
  if (ring.length < 3 || polygonArea(ring) < 1) throw new TypeError(`Distrik "${spec.id}": boundary minimal 3 titik dengan luas > 0`);
  if (typeof spec.manifestUrl !== 'string' || spec.manifestUrl === '') throw new TypeError(`Distrik "${spec.id}": manifestUrl wajib`);
  if (typeof spec.build !== 'function') throw new TypeError(`Distrik "${spec.id}": build(ctx) wajib`);
  const boundary = Object.freeze(orientRing(ring, true).map((p) => Object.freeze(p)));
  return Object.freeze({ ...spec, boundary, bounds: Object.freeze(ringBounds(boundary)) });
}

/** Hasil build lengkap? Mengembalikan apa adanya (boleh berisi field tambahan). @throws {TypeError} */
export function validateDistrictBuild(result, id) {
  const missing = [];
  if (!result?.group?.isObject3D) missing.push('group');
  if (!Array.isArray(result?.systems)) missing.push('systems');
  if (typeof result?.colliders?.isWalkable !== 'function' || typeof result?.colliders?.isCameraClear !== 'function') missing.push('colliders');
  if (typeof result?.minimapLayer !== 'function') missing.push('minimapLayer');
  if (!(result?.excludeIds instanceof Set)) missing.push('excludeIds');
  if (typeof result?.whenSettled !== 'function') missing.push('whenSettled');
  if (typeof result?.dispose !== 'function') missing.push('dispose');
  if (missing.length) throw new TypeError(`Distrik "${id}": hasil build tidak lengkap (${missing.join(', ')})`);
  return result;
}

/** Titik dunia (x, z) di dalam batas distrik (bbox dulu, lalu genap-ganjil). */
export function districtContains(def, x, z) {
  const b = def.bounds;
  if (!(x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) return false;
  return pointInPolygon(x, z, def.boundary);
}
