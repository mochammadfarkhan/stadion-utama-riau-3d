/**
 * Lapisan tanah distrik UNRI (M2). Menempel ke hook chunk terrain M1 (src/districts/terrainChunks.js):
 * onChunkMesh(key, {mesh, lod, chunk}) → muat ground/<key>.json → (scheduler, ≤ 4 ms/frame) warnai mesh terrain
 * dari bobot permukaan + renderOrder −5 (aturan jahitan: terrain digambar sebelum lapisan datar kota), bangun
 * permukaan keras + air + parit untuk LOD itu; sekali per chunk saat LOD0: vegetasi (sel 200 m), PJU, bangku, tong
 * + registry malam. Data collider (air, jalan, rintangan) didaftarkan begitu chunk pertama kali dibangun.
 * onChunkRelease(key) → semua dilepas, material terrain asli dipulihkan. Chunk ground gagal → dilewati
 * (peringatan sekali, spec §10). Visibilitas detail (vegetasi/props) per jarak 650 m dari fokus.
 */
import { Group } from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { parseTileKey, tileBounds } from '../../geo/tiles.js';
import { createChunkSurface } from '../../world/terrain/drape.js';
import { VEGETATION_CELL } from '../../world/Landscape.trees.js';
import { parseGroundChunk } from './groundData.js';
import { createUnriGroundMaterials } from './groundMaterials.js';
import { surfaceTints } from './surfaceTint.js';
import { buildGroundMeshes, tintTerrainRoot } from './ground.js';
import { buildWaterMeshes } from './water.js';
import { buildVegetationCells, createVegetationKit, vegetationInstances } from './vegetation.js';
import { buildLamps, lampHeads } from './lamps.js';
import { buildStreetProps } from './streetProps.js';
import { colliderDataFromGround } from './collider.js';

export const GROUND_LAYER = Object.freeze({
  owner: 'unri:ground',
  terrainRenderOrder: -5,
  lod1Stride: 4,
  detailRadius: 450,
  visibilityInterval: 0.5,
  chunkSize: 500,
});

const rectDistance = (x, z, b) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));

async function defaultFetchJson(url, retries = 2) {
  let last = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      last = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw last;
}

/** Lepas objek milik chunk: buffer InstancedMesh dan geometri bertanda ownsGeometry (kit bersama tidak). */
function disposeOwned(root) {
  if (!root) return;
  root.removeFromParent();
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    else if (o.isMesh && o.userData.ownsGeometry) o.geometry.dispose();
  });
}

/**
 * @param {{scope: object,
 *   scheduler: {schedule(task: Function, o: {owner: string}): {cancel(): void}, pending(owner?: string): number, whenIdle(owner?: string): Promise<void>},
 *   registries: {registerWet(root: object): () => boolean, registerEmissive(root: object): () => boolean, registerLamps(opts: object): () => boolean},
 *   collider: {addChunk(key: string, data: object): void, removeChunk(key: string): boolean},
 *   groundKeys: Set<string>, groundUrl: (key: string) => string, fetchJson?: (url: string) => Promise<unknown>,
 *   isReserved?: (x: number, z: number) => boolean, logger?: {warn: (...a: unknown[]) => void}}} opts
 */
export function createUnriGroundLayer({
  scope, scheduler, registries, collider, groundKeys, groundUrl, fetchJson = defaultFetchJson,
  isReserved = () => false, logger = console,
}) {
  const root = new Group();
  root.name = 'unri:tanah-root';
  const materials = withScope(scope, () => createUnriGroundMaterials());
  const vegKit = withScope(scope, () => createVegetationKit());
  const tints = surfaceTints();
  const chunks = new Map();
  const inflight = new Set();
  let disposed = false;
  let warned = false;
  let timer = 0;
  let focus = null;

  const warnOnce = (msg, err) => {
    if (warned) return;
    warned = true;
    logger.warn(msg, err);
  };
  const keep = (p) => !isReserved(p.x, p.z);

  const recOf = (key) => {
    let rec = chunks.get(key);
    if (!rec) {
      const t = parseTileKey(key);
      rec = {
        key, rect: tileBounds(t.ix, t.iz, GROUND_LAYER.chunkSize), data: null, token: 0, task: null,
        terrain: null, terrainOff: null, surface: null, surfaceOff: null, detail: null, vegCells: [], offs: [], collided: false,
      };
      chunks.set(key, rec);
    }
    return rec;
  };

  /** Pulihkan material asli mesh terrain (M1) dan cabut registry basahnya. */
  const restoreTerrain = (rec) => {
    rec.terrainOff?.();
    rec.terrainOff = null;
    if (!rec.terrain) return;
    for (const [mesh, mat] of rec.terrain.originals) {
      mesh.material = mat;
      mesh.userData.wetSurface = false;
    }
    rec.terrain = null;
  };

  const applyVisibility = (rec) => {
    if (!rec.detail || !focus) return;
    const near = rectDistance(focus.x, focus.z, rec.rect) <= GROUND_LAYER.detailRadius;
    rec.detail.visible = near;
    if (!near) return;
    const reach = GROUND_LAYER.detailRadius + VEGETATION_CELL * 0.71;
    for (const c of rec.vegCells) c.group.visible = Math.hypot(c.x - focus.x, c.z - focus.z) <= reach;
  };

  function buildDetail(rec, data, surface) {
    const h = (x, z) => surface.heightAt(x, z);
    const detail = new Group();
    detail.name = `unri:detail:${rec.key}`;
    const cells = buildVegetationCells(vegetationInstances(data.veg.filter(keep), h), vegKit);
    for (const c of cells) detail.add(c.group);
    const lamps = data.props.lamps.filter(keep);
    withScope(scope, () => {
      if (lamps.length) detail.add(buildLamps(lamps, h));
      detail.add(buildStreetProps({ benches: data.props.benches.filter(keep), bins: data.props.bins.filter(keep) }, h));
    });
    freezeStatic(detail);
    root.add(detail);
    rec.detail = detail;
    rec.vegCells = cells;
    rec.offs.push(registries.registerEmissive(detail));
    if (lamps.length) rec.offs.push(registries.registerLamps({ lamps: lampHeads(lamps) }));
    applyVisibility(rec);
  }

  function* buildChunk(rec, data, terrainRoot, lod, chunk) {
    restoreTerrain(rec);
    const originals = new Map();
    terrainRoot.traverse((o) => {
      if (o.isMesh) originals.set(o, o.material);
    });
    tintTerrainRoot(terrainRoot, data.weights, data.origin, materials.terrain, tints);
    terrainRoot.traverse((o) => {
      if (o.isMesh) o.renderOrder = GROUND_LAYER.terrainRenderOrder;
    });
    rec.terrain = { root: terrainRoot, originals };
    rec.terrainOff = registries.registerWet(terrainRoot);
    yield;
    const surface = createChunkSurface(chunk, { stride: lod === 0 ? 1 : GROUND_LAYER.lod1Stride });
    const opts = { lod, materials, rect: rec.rect, key: rec.key };
    const hard = yield* buildGroundMeshes(data, surface, opts);
    const water = yield* buildWaterMeshes(data, surface, opts);
    const group = new Group();
    group.name = `unri:tanah:${rec.key}`;
    group.add(hard, water);
    freezeStatic(group);
    rec.surfaceOff?.();
    disposeOwned(rec.surface);
    root.add(group);
    rec.surface = group;
    rec.surfaceOff = registries.registerWet(group);
    if (!rec.collided) {
      collider.addChunk(rec.key, colliderDataFromGround(data, keep));
      rec.collided = true;
    }
    if (lod === 0 && !rec.detail) {
      yield;
      buildDetail(rec, data, surface);
    }
  }

  function onChunkMesh(key, { mesh, lod, chunk }) {
    if (disposed || !mesh || !groundKeys.has(key)) return; // M1: mesh null = chunk tanpa sel di dalam batas
    const rec = recOf(key);
    rec.token += 1;
    const token = rec.token;
    rec.task?.cancel();
    rec.task = null;
    if (!rec.data) rec.data = fetchJson(groundUrl(key)).then((json) => parseGroundChunk(json, key));
    const pending = rec.data
      .then((data) => {
        if (disposed || rec.token !== token) return;
        rec.task = scheduler.schedule(function* buildTask() {
          try {
            yield* buildChunk(rec, data, mesh, lod, chunk);
          } catch (err) {
            warnOnce(`Tanah distrik: chunk ${key} gagal dibangun (dilewati)`, err);
          }
        }, { owner: GROUND_LAYER.owner });
      })
      .catch((err) => {
        rec.data = null;
        warnOnce(`Tanah distrik: chunk ${key} dilewati`, err);
      })
      .finally(() => inflight.delete(pending));
    inflight.add(pending);
  }

  function onChunkRelease(key) {
    const rec = chunks.get(key);
    if (!rec) return;
    rec.token += 1;
    rec.task?.cancel();
    restoreTerrain(rec);
    rec.surfaceOff?.();
    for (const off of rec.offs) off();
    disposeOwned(rec.surface);
    disposeOwned(rec.detail);
    if (rec.collided) collider.removeChunk(key);
    chunks.delete(key);
  }

  async function whenIdle() {
    while (inflight.size > 0) await Promise.allSettled([...inflight]);
    await scheduler.whenIdle(GROUND_LAYER.owner);
  }

  const stats = () => {
    let surfaces = 0;
    let details = 0;
    for (const rec of chunks.values()) {
      if (rec.surface) surfaces += 1;
      if (rec.detail) details += 1;
    }
    return { chunks: chunks.size, surfaces, details, loading: inflight.size, pending: scheduler.pending(GROUND_LAYER.owner) };
  };
  root.userData.stats = stats;
  root.userData.whenIdle = whenIdle;

  const system = {
    id: 'unri.ground',
    phase: 'world',
    update(dt, ctx) {
      const f = ctx.focus ?? ctx.bikePos;
      if (!f) return;
      timer -= dt;
      if (timer > 0) return;
      timer = GROUND_LAYER.visibilityInterval;
      focus = { x: f.x, z: f.z };
      for (const rec of chunks.values()) applyVisibility(rec);
    },
    dispose() {},
  };

  return {
    group: root,
    system,
    onChunkMesh,
    onChunkRelease,
    whenIdle,
    stats,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const key of [...chunks.keys()]) onChunkRelease(key);
      root.removeFromParent();
    },
  };
}
