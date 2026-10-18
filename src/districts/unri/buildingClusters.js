/**
 * Klaster gedung kampus (spec §7.4): sel 250 m; LOD0 ≤ 250 m (penuh), LOD1 ≤ 900 m (massa + atap + atlas),
 * lebih jauh tidak dirender. Perakitan time-sliced lewat scheduler (M0): satu tugas generator per klaster,
 * `yield` per gedung & per sisi; geometri semua gedung klaster ditulis ke SATU sink (penggabungan per
 * material: opak + potong + papan = ≤ 3 mesh/klaster). Tukar LOD tanpa lubang (lama tampil sampai baru siap).
 * Gedung gagal dirakit → K12 (spec §10). Footprint klaster didaftarkan ke collider distrik (M2
 * `addBuildings/removeBuildings`) selama klaster tampil; emisif malam lewat `registries` distrik (M2).
 * Nama grup berawalan `unri:` agar terhitung skrip ukur M2. Bagian murni diekspor untuk tes.
 */
import { Group, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { createKitSink } from '../../world/kit/kitBuilder.js';
import { appendPlanSteps, fallbackPlan } from '../../world/kit/buildBuilding.js';
import { appendBuilding } from '../../world/kit/kitAssemble.js';
import { planBuilding } from '../../world/kit/planBuilding.js';
import { appendSigns, collectSigns, createSignAtlas } from '../../world/kit/signs.js';
import { resolveBuilding } from './resolveBuilding.js';
import { footprintsOf } from './buildingFootprints.js';

export const CLUSTER = Object.freeze({
  size: 250, lod0: 250, lod1: 900, hysteresis: 30, maxJobs: 1, maxHeight: 40, owner: 'unri:gedung',
});

/** Kunci klaster "cx_cz" dari titik dunia. */
export function clusterKeyOf(x, z, size = CLUSTER.size) {
  return `${Math.floor(x / size)}_${Math.floor(z / size)}`;
}

/** Batas dunia klaster dari kunci. */
export function clusterBounds(key, size = CLUSTER.size) {
  const [cx, cz] = key.split('_').map(Number);
  return { minX: cx * size, minZ: cz * size, maxX: (cx + 1) * size, maxZ: (cz + 1) * size };
}

/** Jarak titik ke persegi (0 di dalam). */
export function rectDistance(x, z, b) {
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(dx, dz);
}

/** Kelompokkan gedung per `cluster` (buildings.json) → Map urut kunci. */
export function groupByCluster(buildings) {
  const map = new Map();
  for (const b of buildings) {
    if (!map.has(b.cluster)) map.set(b.cluster, []);
    map.get(b.cluster).push(b);
  }
  return new Map([...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * LOD yang diinginkan pada jarak `dist` bila LOD `current` sedang tampil (null = belum tampil):
 * masuk LOD0 di ≤ lod0, keluar di > lod0 + h; tampil di ≤ lod1, lepas di > lod1 + h.
 * @returns {0|1|null}
 */
export function desiredLod(dist, current, cfg = CLUSTER) {
  if (dist <= (current === 0 ? cfg.lod0 + cfg.hysteresis : cfg.lod0)) return 0;
  return dist <= (current === null ? cfg.lod1 : cfg.lod1 + cfg.hysteresis) ? 1 : null;
}

/** Plan satu gedung dari entri buildings.json (resolve + planBuilding); galat → K12; galat lagi → null. */
export function planEntry(b, overrides, groundY, logger = console) {
  const r = resolveBuilding(b, overrides[b.id], { logger });
  const input = { id: b.id, ring: b.ring, holes: b.holes ?? [], levels: r.levels, archetype: r.archetype, overrides: r, front: b.front ?? null, groundY };
  try {
    return { plan: planBuilding(input), input };
  } catch (err) {
    logger.error(`gedung ${b.id}: planBuilding gagal (${r.archetype}), jatuh ke K12:`, err);
    try {
      return { plan: planBuilding({ ...input, archetype: 'K12' }), input };
    } catch (err2) {
      logger.error(`gedung ${b.id}: K12 juga gagal, dilewati:`, err2);
      return null;
    }
  }
}

/**
 * Part hero non-kit (M6) → satu mesh per material + tata atribut. Geometri diklon & ditransformasi ke dunia
 * (milik klaster: dilepas `release` bersama mesh kit); geometri sumber milik cache scope hero tidak disentuh.
 */
export function extrasToMeshes(extra, name) {
  const groups = new Map();
  for (const p of extra) {
    const g = p.geometry.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    const key = [p.material.uuid, Object.keys(g.attributes).sort().join(','), g.index ? 'i' : 'n', p.castShadow === false ? 0 : 1].join('|');
    if (!groups.has(key)) groups.set(key, { material: p.material, castShadow: p.castShadow !== false, geoms: [] });
    groups.get(key).geoms.push(g);
  }
  const meshes = [];
  for (const { material, castShadow, geoms } of groups.values()) {
    const merged = geoms.length > 1 ? mergeGeometries(geoms, false) : geoms[0];
    if (merged && geoms.length > 1) geoms.forEach((g) => g.dispose());
    for (const geometry of merged ? [merged] : geoms) { // gagal gabung → mesh terpisah
      const mesh = new Mesh(geometry, material);
      mesh.name = `${name}:${material.name || 'hero'}`;
      mesh.castShadow = castShadow;
      meshes.push(mesh);
    }
  }
  return meshes;
}

/** Perkiraan verteks per kunci material untuk kapasitas awal sink. */
function estimateCapacity(plans, lod) {
  const bays = plans.reduce((s, p) => s + p.bays.length * p.floors, 0);
  return lod === 0 ? { opak: bays * 260 + 4096, potong: bays * 40 + 1024, papan: 256 } : { opak: bays * 30 + 2048, potong: 64, papan: 64 };
}

/**
 * @param {{buildings: object[], overrides?: Record<string, object>, materials: {opak:object, potong:object},
 *   scheduler: {schedule(task: Function, o: {owner: string}): {cancel(): void}}, groundY: (x:number, z:number) => number,
 *   terrainReady?: (bounds: object) => boolean, registries?: {registerEmissive(root: object): () => boolean}|null,
 *   collider?: {addBuildings(key: string, f: object[]): void, removeBuildings(key: string): boolean}|null,
 *   signAtlas?: typeof createSignAtlas, appendSteps?: typeof appendPlanSteps, logger?: Console, config?: typeof CLUSTER}} opts
 *   appendSteps dapat disuntik tes (mis. untuk memaksa galat perakitan).
 */
export function createBuildingClusters({
  buildings, overrides = {}, materials, scheduler, groundY, terrainReady = () => true, registries = null, collider = null,
  signAtlas = createSignAtlas, appendSteps = appendPlanSteps, logger = console, config = CLUSTER, scope = null,
}) {
  const group = new Group();
  group.name = 'unri:gedung';
  const clusters = [...groupByCluster(buildings)].map(([key, list]) => ({
    key, list, bounds: clusterBounds(key, config.size), dist: Infinity, shown: null, job: null, dirty: false,
  }));
  const plans = new Map(); // id → {plan, input}|null (tidak bergantung LOD)
  let suppressed = new Set();
  let disposed = false;

  const sphereOf = (c) => {
    const half = config.size / 2;
    return { center: [c.bounds.minX + half, 0, c.bounds.minZ + half], radius: Math.hypot(half, half, config.maxHeight) + 60 };
  };

  const release = (shown, c) => {
    if (!shown) return;
    if (c) collider?.removeBuildings(c.key);
    shown.offEmissive?.();
    shown.root.removeFromParent();
    for (const m of shown.root.children) m.geometry.dispose();
    shown.signs?.dispose();
  };

  /** Generator tugas scheduler: rencana → sink → papan → mesh → pasang (menggantikan LOD lama). */
  function* job(c, j) {
    const list = c.list.filter((b) => !suppressed.has(b.id));
    const ready = [];
    for (const b of list) {
      if (!plans.has(b.id)) plans.set(b.id, planEntry(b, overrides, groundY, logger));
      if (plans.get(b.id)) ready.push(plans.get(b.id));
      yield;
      if (j.cancelled) return;
    }
    const sink = createKitSink({ capacity: estimateCapacity(ready.map((e) => e.plan), j.lod) });
    for (const entry of ready) {
      const mark = sink.mark();
      try {
        yield* appendSteps(sink, entry.plan, materials, { lod: j.lod, ctx: { scope, groundY } });
      } catch (err) {
        sink.rewind(mark);
        logger.error(`gedung ${entry.plan.id}: perakitan gagal, jatuh ke K12:`, err);
        try {
          appendBuilding(sink, fallbackPlan(entry.plan, entry.input), { lod: j.lod });
        } catch (err2) {
          sink.rewind(mark);
          logger.error(`gedung ${entry.plan.id}: K12 juga gagal, dilewati:`, err2);
        }
      }
      if (j.cancelled) return;
      yield;
    }
    const signs = j.lod === 0 ? collectSigns(ready.map((e) => e.plan)) : [];
    const atlas = signs.length ? signAtlas(signs.map((s) => s.sign)) : null;
    if (atlas) appendSigns(sink, signs, atlas);
    yield;
    if (j.cancelled) {
      atlas?.dispose();
      return;
    }
    const parts = sink.toParts({ ...materials, papan: atlas?.material ?? null }, `gedung:${c.key}`, { copy: false, sphere: sphereOf(c) });
    const root = new Group();
    root.name = `unri:gedung:${c.key}:lod${j.lod}`;
    for (const p of parts) {
      const mesh = new Mesh(p.geometry, p.material);
      mesh.name = p.name;
      mesh.castShadow = p.castShadow && j.lod === 0;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    for (const mesh of extrasToMeshes(sink.extra, `gedung:${c.key}:hero`)) { // hero bermaterial sendiri (M6)
      mesh.castShadow = mesh.castShadow && j.lod === 0;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    group.add(root);
    freezeStatic(root);
    const offEmissive = registries ? registries.registerEmissive(root) : null;
    release(c.shown, null);
    collider?.addBuildings(c.key, footprintsOf(list));
    c.shown = { lod: j.lod, root, signs: atlas, offEmissive, triangles: sink.triangles, meshes: root.children.length };
    c.job = null;
  }

  const start = (c, lod) => {
    const j = { lod, cancelled: false, handle: null };
    c.job = j;
    c.dirty = false;
    j.handle = scheduler.schedule(function* clusterTask() { yield* job(c, j); }, { owner: `${config.owner}:${c.key}` });
  };

  const cancel = (c) => {
    if (!c.job) return;
    c.job.cancelled = true;
    c.job.handle?.cancel();
    c.job = null;
  };

  return {
    group,
    /** Tiap frame: pilih LOD per klaster, batalkan/lepaskan yang menjauh, mulai tugas terdekat (≤ maxJobs). */
    update(focus) {
      if (disposed || !focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.z)) return;
      const wanted = [];
      for (const c of clusters) {
        c.dist = rectDistance(focus.x, focus.z, c.bounds);
        const want = desiredLod(c.dist, c.shown?.lod ?? c.job?.lod ?? null, config);
        if (want === null) {
          cancel(c);
          release(c.shown, c);
          c.shown = null;
          continue;
        }
        if (c.job && c.job.lod !== want) cancel(c);
        if (!c.job && (c.shown?.lod !== want || c.dirty)) wanted.push({ c, want });
      }
      let running = clusters.filter((c) => c.job).length;
      wanted.sort((a, b) => a.c.dist - b.c.dist || (a.c.key < b.c.key ? -1 : 1));
      for (const { c, want } of wanted) {
        if (running >= config.maxJobs) break;
        if (!terrainReady(c.bounds)) continue;
        start(c, want);
        running += 1;
      }
    },
    /** Gedung yang dimiliki region hero aktif (M4/M6) tidak dirakit distrik; klaster terkait dirakit ulang. */
    setSuppressed(ids) {
      const next = new Set(ids);
      for (const c of clusters) {
        if (c.list.some((b) => next.has(b.id) !== suppressed.has(b.id))) c.dirty = true;
      }
      suppressed = next;
    },
    /** Semua klaster dalam radius r dari (x,z) tampil pada LOD yang diinginkan (tanpa tugas tertunda). */
    settled(x, z, r = config.lod0) {
      return clusters.every((c) => {
        const d = rectDistance(x, z, c.bounds);
        if (d > r) return true;
        const want = desiredLod(d, c.shown?.lod ?? null, config);
        return !c.job && !c.dirty && (c.shown?.lod ?? null) === want;
      });
    },
    stats() {
      const s = { clusters: clusters.length, lod0: 0, lod1: 0, jobs: 0, meshes: 0, triangles: 0 };
      for (const c of clusters) {
        if (c.job) s.jobs += 1;
        if (!c.shown) continue;
        s[c.shown.lod === 0 ? 'lod0' : 'lod1'] += 1;
        s.meshes += c.shown.meshes;
        s.triangles += c.shown.triangles;
      }
      return s;
    },
    /** Status per klaster (debug/E2E). */
    snapshot: () => clusters.map((c) => ({ key: c.key, buildings: c.list.length, lod: c.shown?.lod ?? null, job: c.job?.lod ?? null })),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const c of clusters) {
        cancel(c);
        release(c.shown, c);
        c.shown = null;
      }
      group.removeFromParent();
      plans.clear();
    },
  };
}
