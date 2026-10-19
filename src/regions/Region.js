/**
 * Kontrak region handmade (spec Pekanbaru §3.1, perluasan spec UNRI §4.3) + helper validasi.
 * Field opsional M0 dinormalisasi oleh defineRegion:
 * - activation: { persistent:true } (default) | { center:{x,z} dunia, mountRadius=700, unmountRadius=900 }
 * - proxy?(ctx) -> { group, dispose }: siluet murah saat region tidak terpasang (≤ 8 draw call)
 * - povs: [{ id, label, pose(frame, ctx) }] (default []): POV milik region, pose di koordinat DUNIA
 * - pads: [{ ring:[[lx,lz]...], y:'median'|number }] (default []): pad rata untuk campusbake (M1)
 */
import { toLocal } from '../geo/regionTransform.js';
import { pointInPolygon } from '../geo/polygon.js';

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
/**
 * ctx build. terrain/heightAtLocal/schedule (M0, mountRegion): build berat wajib inkremental lewat schedule.
 * @typedef {{scene?:object, renderer?:object, camera?:object, scope:object, store?:object, clock?:object,
 *   placement?:Placement, terrain?:{heightAt(x:number, z:number):number},
 *   heightAtLocal?:(lx:number, lz:number) => number, schedule?:(task:Function) => {cancel():void}}} RegionContext
 */
/** @typedef {{persistent:true}|{persistent:false, center:{x:number,z:number}, mountRadius:number, unmountRadius:number}} Activation */
/**
 * @typedef {{id:string, label:string, pose(frame:object, ctx:{time:number, bike:object}):
 *   ({px:number,py:number,pz:number,tx:number,ty:number,tz:number,fov?:number}|null)}} RegionPov
 */
/** @typedef {{ring:Array<[number,number]>, y:'median'|number}} RegionPad */

const finite = Number.isFinite;

export const DEFAULT_MOUNT_RADIUS = 700;
export const DEFAULT_UNMOUNT_RADIUS = 900;
const PERSISTENT = Object.freeze({ persistent: true });

/** @returns {Activation} */
function normalizeActivation(a, id) {
  if (a == null) return PERSISTENT; // region lama tanpa activation: selalu terpasang
  if (typeof a !== 'object') throw new TypeError(`Region "${id}": activation harus objek`);
  if (a.persistent === true) return PERSISTENT;
  const c = a.center;
  if (!c || !finite(c.x) || !finite(c.z)) {
    throw new TypeError(`Region "${id}": activation.center {x,z} harus angka hingga (atau persistent:true)`);
  }
  const mountRadius = a.mountRadius ?? DEFAULT_MOUNT_RADIUS;
  const unmountRadius = a.unmountRadius ?? DEFAULT_UNMOUNT_RADIUS;
  if (!finite(mountRadius) || mountRadius <= 0) throw new TypeError(`Region "${id}": activation.mountRadius harus > 0`);
  if (!finite(unmountRadius) || unmountRadius <= mountRadius) {
    throw new TypeError(`Region "${id}": activation.unmountRadius harus > mountRadius (histeresis)`);
  }
  return Object.freeze({ persistent: false, center: Object.freeze({ x: c.x, z: c.z }), mountRadius, unmountRadius });
}

/** @returns {ReadonlyArray<RegionPov>} */
function normalizePovs(povs, id) {
  if (povs == null) return Object.freeze([]);
  if (!Array.isArray(povs)) throw new TypeError(`Region "${id}": povs harus array`);
  const seen = new Set();
  return Object.freeze(povs.map((p, i) => {
    if (!p || typeof p.id !== 'string' || p.id === '') throw new TypeError(`Region "${id}": povs[${i}].id wajib string`);
    if (seen.has(p.id)) throw new TypeError(`Region "${id}": povs id "${p.id}" ganda`);
    seen.add(p.id);
    if (typeof p.label !== 'string' || p.label === '') throw new TypeError(`Region "${id}": povs[${i}].label wajib string`);
    if (typeof p.pose !== 'function') throw new TypeError(`Region "${id}": povs[${i}].pose(frame, ctx) wajib fungsi`);
    return Object.freeze({ ...p });
  }));
}

const ringOk = (r) => Array.isArray(r) && r.length >= 3 && r.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1]));

/** @returns {ReadonlyArray<RegionPad>} */
function normalizePads(pads, id) {
  if (pads == null) return Object.freeze([]);
  if (!Array.isArray(pads)) throw new TypeError(`Region "${id}": pads harus array`);
  return Object.freeze(pads.map((p, i) => {
    if (!p || !ringOk(p.ring)) throw new TypeError(`Region "${id}": pads[${i}].ring minimal 3 titik [lx,lz]`);
    const y = p.y ?? 'median';
    if (y !== 'median' && !finite(y)) throw new TypeError(`Region "${id}": pads[${i}].y harus 'median' atau angka`);
    return Object.freeze({ ring: Object.freeze(p.ring.map((q) => Object.freeze([q[0], q[1]]))), y });
  }));
}

/**
 * @param {{id:string, placement:Placement, mask:Array<[number, number]>, build:(ctx:RegionContext)=>Promise<RegionBuild>,
 *   activation?:object, proxy?:(ctx:{scope:object, placement:Placement, terrain:object}) => {group:object, dispose():void},
 *   povs?:RegionPov[], pads?:RegionPad[]}} spec
 */
export function defineRegion(spec) {
  if (!spec || typeof spec.id !== 'string' || spec.id === '') throw new TypeError('Region: id wajib string');
  const p = spec.placement;
  if (!p || ![p.x, p.z, p.yaw].every(finite)) throw new TypeError(`Region "${spec.id}": placement {x,z,yaw} harus angka hingga`);
  const maskOk = Array.isArray(spec.mask) && spec.mask.length >= 3
    && spec.mask.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1]));
  if (!maskOk) throw new TypeError(`Region "${spec.id}": mask minimal 3 titik [x,z]`);
  if (typeof spec.build !== 'function') throw new TypeError(`Region "${spec.id}": build(ctx) wajib`);
  if (spec.proxy != null && typeof spec.proxy !== 'function') throw new TypeError(`Region "${spec.id}": proxy(ctx) harus fungsi`);
  return Object.freeze({
    ...spec,
    placement: Object.freeze({ x: p.x, z: p.z, yaw: p.yaw }),
    activation: normalizeActivation(spec.activation, spec.id),
    povs: normalizePovs(spec.povs, spec.id),
    pads: normalizePads(spec.pads, spec.id),
  });
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

/**
 * Setengah sisi persegi berpusat placement yang memuat seluruh mask (m), mis. untuk bake minimap.
 * Memakai jarak radial terjauh (bukan max |x|, |z|) agar tetap memuat mask untuk yaw placement apa pun
 * (kamera bake sejajar sumbu dunia, utara di atas).
 */
export function maskHalfExtent(mask) {
  return Math.max(...mask.map(([x, z]) => Math.hypot(x, z)));
}

/** Salinan definisi region dengan placement lain (uji placement non-identitas, mode dev). */
export function withPlacement(region, placement) {
  return defineRegion({ ...region, placement });
}
