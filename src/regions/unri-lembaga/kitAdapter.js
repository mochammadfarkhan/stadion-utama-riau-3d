/**
 * Adaptor kit gedung M3 (spec §4.6) untuk region Lembaga: planBuilding (koordinat DUNIA) → buildBuilding →
 * PartList → Group region-lokal (digeser −origin; yaw region 0). Material kit dibuat sekali per scope region.
 */
import { planBuilding } from '../../world/kit/planBuilding.js';
import { buildBuilding } from '../../world/kit/buildBuilding.js';
import { createKitMaterials } from '../../world/kit/kitMaterials.js';
import { groupFromParts } from '../../world/siteutil/instanceParts.js';
import { LEMBAGA_PLACEMENT } from './placement.js';

/** Seed stabil dari id OSM ('w1480014538' → bilangan 32-bit). */
export function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {{id:string, ringWorld:Array<[number,number]>, levels:number, archetype:string, overrides?:object,
 *   groundYWorld:(x:number, z:number)=>number, scope:object}} opts
 * @returns {{group: import('three').Group, plan: object}}
 */
export function buildKitBuildingLocal({ id, ringWorld, levels, archetype, overrides = {}, groundYWorld, scope }) {
  const mats = scope.get('lembaga:kitMaterials', () => createKitMaterials(scope));
  const plan = planBuilding({ id, ring: ringWorld.map(([x, z]) => [x, z]), levels, archetype, overrides, seed: seedFromId(id), groundY: groundYWorld });
  const group = groupFromParts(buildBuilding(plan, mats), `kit:${id}`);
  group.position.set(-LEMBAGA_PLACEMENT.x, 0, -LEMBAGA_PLACEMENT.z);
  return { group, plan };
}
