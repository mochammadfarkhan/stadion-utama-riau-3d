/**
 * Kontrak region handmade (spec §3.1) + helper validasi.
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../shared/polygon.js';

/** @typedef {'input'|'sim'|'world'|'camera'|'ui'} Phase */
/** @typedef {{id:string, phase:Phase, update(dt:number, ctx:object):void, dispose?():void}} System */
/** @typedef {{x:number, z:number, yaw:number}} Placement */
/**
 * Collider region-lokal. Fase 0 memakai (lx, lz); parameter `clear`/`ly` di spec ditunda ke Fase 2.
 * @typedef {{isWalkable(lx:number, lz:number):boolean, isCameraClear(lx:number, lz:number):boolean}} RegionColliders
 */
/**
 * @typedef {{group: import('three').Group, colliders: RegionColliders,
 *   minimapLayer: (ctx2d: CanvasRenderingContext2D, view: object) => void, systems: System[], dispose(): void}} RegionBuild
 */
/** @typedef {{scene?:object, renderer?:object, camera?:object, scope:object, store?:object, clock?:object}} RegionContext */

const finite = Number.isFinite;

/**
 * @param {{id:string, placement:Placement, mask:Array<[number, number]>, build:(ctx:RegionContext)=>Promise<RegionBuild>}} spec
 */
export function defineRegion(spec) {
  if (!spec || typeof spec.id !== 'string' || spec.id === '') throw new TypeError('Region: id wajib string');
  const p = spec.placement;
  if (!p || ![p.x, p.z, p.yaw].every(finite)) throw new TypeError(`Region "${spec.id}": placement {x,z,yaw} harus angka hingga`);
  const maskOk = Array.isArray(spec.mask) && spec.mask.length >= 3
    && spec.mask.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1]));
  if (!maskOk) throw new TypeError(`Region "${spec.id}": mask minimal 3 titik [x,z]`);
  if (typeof spec.build !== 'function') throw new TypeError(`Region "${spec.id}": build(ctx) wajib`);
  return Object.freeze({ ...spec, placement: Object.freeze({ x: p.x, z: p.z, yaw: p.yaw }) });
}

/** Pastikan hasil build memenuhi kontrak; kembalikan apa adanya (boleh berisi field tambahan). */
export function validateBuild(result, id) {
  const missing = [];
  if (!result?.group?.isObject3D) missing.push('group');
  if (typeof result?.colliders?.isWalkable !== 'function' || typeof result?.colliders?.isCameraClear !== 'function') missing.push('colliders');
  if (typeof result?.minimapLayer !== 'function') missing.push('minimapLayer');
  if (!Array.isArray(result?.systems)) missing.push('systems');
  if (typeof result?.dispose !== 'function') missing.push('dispose');
  if (missing.length) throw new TypeError(`Region "${id}": hasil build tidak lengkap (${missing.join(', ')})`);
  return result;
}

/** Apakah titik dunia (x, z) berada di dalam mask region (setelah transform placement). */
export function regionContains(region, x, z) {
  const l = toLocal(region.placement, x, z);
  return pointInPolygon(l.x, l.z, region.mask);
}
