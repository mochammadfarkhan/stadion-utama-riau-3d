/**
 * buildBuilding (spec §4.6): BuildingPlan → PartList (pola instanceParts: {geometry, material, matrix,
 * castShadow, name}; geometri koordinat dunia, matrix null). Hero ('hero:*') lewat HERO_BUILDERS. Klaster
 * memakai appendPlan langsung ke sink bersama (penggabungan per material tanpa clone). Gedung yang gagal
 * dirakit jatuh ke K12 (spec §10); bila K12 juga gagal → [] + console.error.
 */
import { createKitSink } from './kitBuilder.js';
import { appendBuilding, appendBuildingSteps } from './kitAssemble.js';
import { HERO_BUILDERS } from './hero/index.js';
import { planBuilding } from './planBuilding.js';

/** Salin geometri PartList ke sink (dipakai hero di dalam klaster). */
export function appendParts(sink, parts, materials) {
  for (const p of parts) {
    const key = p.material === materials.potong ? 'potong' : p.material === materials.opak ? 'opak' : null;
    if (!key) continue;
    const g = p.geometry;
    const pos = g.attributes.position.array;
    const uv = g.attributes.uv.array;
    const col = g.attributes.color.array;
    const b = sink[key];
    for (let i = 0; i < pos.length; i += 9) {
      const v = (k) => [pos[i + k * 3], pos[i + k * 3 + 1], pos[i + k * 3 + 2]];
      const t = (k) => [uv[(i / 3 + k) * 2], uv[(i / 3 + k) * 2 + 1]];
      b.tri(v(0), v(1), v(2), [t(0), t(1), t(2)], [col[i], col[i + 1], col[i + 2]]);
    }
    g.dispose();
  }
}

/** Rencana cadangan K12 dari plan yang gagal dirakit. */
export function fallbackPlan(plan, input) {
  return planBuilding({ ...input, archetype: 'K12', overrides: { palette: plan.palette, sign: plan.signs[0]?.text ?? null } });
}

/** Versi generator appendPlan (klaster): hero ditulis sekaligus, gedung kit per langkah. */
export function* appendPlanSteps(sink, plan, materials, { lod = 0, ctx = {} } = {}) {
  const hero = HERO_BUILDERS[plan.archetype];
  if (hero?.steps) {
    yield* hero.steps(sink, plan, materials, { ...ctx, lod });
    return;
  }
  if (hero) {
    appendParts(sink, hero(plan, materials, { ...ctx, lod }), materials);
    return;
  }
  yield* appendBuildingSteps(sink, plan, { lod });
}

/**
 * Tulis plan ke sink; hero memakai builder hero. Melempar bila perakitan gagal (pemanggil memakai fallbackPlan).
 * @returns {number} segitiga
 */
export function appendPlan(sink, plan, materials, { lod = 0, ctx = {} } = {}) {
  const hero = HERO_BUILDERS[plan.archetype];
  if (!hero) return appendBuilding(sink, plan, { lod });
  const before = sink.triangles;
  appendParts(sink, hero(plan, materials, { ...ctx, lod }), materials);
  return sink.triangles - before;
}

/**
 * @param {object} plan BuildingPlan (planBuilding)
 * @param {{opak: object, potong: object}} kitMaterials createKitMaterials(scope)
 * @param {{lod?: 0|1, input?: object, logger?: {error: Function}}} [opts] input = masukan planBuilding (untuk cadangan K12)
 * @returns {Array<{geometry: import('three').BufferGeometry, material: object, matrix: null, castShadow: boolean, name: string}>}
 */
export function buildBuilding(plan, kitMaterials, { lod = 0, input = null, logger = console } = {}) {
  const sink = createKitSink();
  try {
    appendPlan(sink, plan, kitMaterials, { lod });
  } catch (err) {
    if (!input) throw err;
    logger.error(`kit: gedung ${plan.id} gagal dirakit (${plan.kit}), jatuh ke K12:`, err);
    const fresh = createKitSink();
    try {
      appendBuilding(fresh, fallbackPlan(plan, input), { lod });
    } catch (err2) {
      logger.error(`kit: cadangan K12 ${plan.id} juga gagal:`, err2);
      return [];
    }
    return fresh.toParts(kitMaterials, plan.id);
  }
  return sink.toParts(kitMaterials, plan.id);
}
