/**
 * Gedung distrik UNRI (M3): muat & validasi buildings.json → material kit (scope distrik) → klaster ber-LOD
 * (time-sliced, owner scheduler `unri:gedung:<klaster>`) → sistem `unri.gedung` (fase world). Footprint masuk
 * collider distrik M2 per klaster; emisif malam lewat `ctx.registries` (M2). Galat muat/format → distrik tetap
 * jalan tanpa gedung (console.error + toast sekali bila tersedia). DEV: `globalThis.__unriGedung` untuk ukur.
 */
import { createKitMaterials } from '../../world/kit/kitMaterials.js';
import { BUILDING_OVERRIDES } from './buildings.data.js';
import { createBuildingClusters, CLUSTER } from './buildingClusters.js';
import { drawFootprints } from './buildingFootprints.js';
import { validateBuildingsData } from './buildingsFormat.js';
import { validateOverrides } from './resolveBuilding.js';

const TERRAIN_CHUNK = 500;

/** Kunci chunk terrain 500 m yang beririsan dengan bounds. */
export function chunkKeysFor(b, size = TERRAIN_CHUNK) {
  const out = [];
  for (let ix = Math.floor(b.minX / size); ix <= Math.floor((b.maxX - 1e-6) / size); ix += 1) {
    for (let iz = Math.floor(b.minZ / size); iz <= Math.floor((b.maxZ - 1e-6) / size); iz += 1) out.push(`${ix}_${iz}`);
  }
  return out;
}

/** Klaster siap dirakit bila semua chunk terrain manifest yang menutupinya sudah dimuat (field.has). */
export function makeTerrainReady(field, manifestChunks) {
  const known = new Set(manifestChunks ?? []);
  return (bounds) => chunkKeysFor(bounds).every((k) => !known.has(k) || field.has(k));
}

async function defaultFetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {{url: string, scope: object, terrain: {heightAt(x:number,z:number):number, has(k:string):boolean},
 *   terrainChunks?: string[], scheduler: {schedule: Function}, registries?: object|null,
 *   collider?: {addBuildings: Function, removeBuildings: Function}|null, fetchJson?: (u:string) => Promise<object>,
 *   anisotropy?: number, toast?: (t:string, ok:boolean) => void, logger?: Console, overrides?: object, dev?: boolean}} ctx
 */
export async function mountBuildings(ctx) {
  const logger = ctx.logger ?? console;
  const overrides = ctx.overrides ?? BUILDING_OVERRIDES;
  const overrideErrors = validateOverrides(overrides);
  if (overrideErrors.length) logger.warn('buildings.data.js tidak valid (entri salah memakai aturan default):', overrideErrors);
  let data;
  try {
    data = await (ctx.fetchJson ?? defaultFetchJson)(ctx.url);
    const errs = validateBuildingsData(data);
    if (errs.length) throw new Error(`buildings.json tidak valid: ${errs.slice(0, 5).join('; ')}`);
  } catch (err) {
    logger.error('Gedung kampus gagal dimuat; distrik tanpa gedung:', err);
    ctx.toast?.('Gedung kampus gagal dimuat', false);
    return null;
  }
  const materials = createKitMaterials(ctx.scope, { anisotropy: ctx.anisotropy ?? 8 });
  const clusters = createBuildingClusters({
    buildings: data.buildings, overrides, materials, scheduler: ctx.scheduler,
    groundY: (x, z) => ctx.terrain.heightAt(x, z),
    terrainReady: makeTerrainReady(ctx.terrain, ctx.terrainChunks),
    registries: ctx.registries ?? null, collider: ctx.collider ?? null, logger,
  });
  let suppressed = new Set();
  const system = {
    id: 'unri.gedung',
    phase: 'world',
    update(dt, frame) {
      clusters.update(frame?.focus ?? frame?.bikePos ?? null);
    },
    dispose() {},
  };
  const api = {
    data,
    group: clusters.group,
    system,
    excludeIds: new Set(data.buildings.map((b) => b.id)),
    drawMinimap: (ctx2d, tx, tz) => drawFootprints(ctx2d, data.buildings.filter((b) => !suppressed.has(b.id)), tx, tz),
    /** Gedung yang diambil alih region (opsional; region-owned hero cukup lewat HERO_BUILDERS kosong). */
    setSuppressed(ids) {
      suppressed = new Set(ids);
      clusters.setSuppressed(suppressed);
    },
    settled: (x, z, r = CLUSTER.lod0) => clusters.settled(x, z, r),
    whenSettled(x, z, r = CLUSTER.lod0, timeoutMs = 30000) {
      const t0 = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          if (clusters.settled(x, z, r)) resolve(true);
          else if (Date.now() - t0 > timeoutMs) resolve(false);
          else setTimeout(tick, 100);
        };
        tick();
      });
    },
    stats: () => clusters.stats(),
    snapshot: () => clusters.snapshot(),
    dispose() {
      clusters.dispose();
      ctx.scope.release('kit:materials');
      if (globalThis.__unriGedung === api) delete globalThis.__unriGedung;
    },
  };
  if (ctx.dev) globalThis.__unriGedung = api;
  return api;
}
