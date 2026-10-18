import { describe, it, expect, vi } from 'vitest';
import {
  CLUSTER, clusterBounds, clusterKeyOf, createBuildingClusters, desiredLod, groupByCluster, planEntry, rectDistance,
} from '../../src/districts/unri/buildingClusters.js';
import { createKitMaterials } from '../../src/world/kit/kitMaterials.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { appendPlanSteps } from '../../src/world/kit/buildBuilding.js';

/** Scheduler palsu: menyimpan tugas generator; run() menjalankan semua sampai habis. */
function fakeScheduler() {
  const tasks = [];
  return {
    tasks,
    schedule(fn, { owner }) {
      const t = { it: fn(), owner, cancelled: false, done: false, steps: 0 };
      tasks.push(t);
      return { cancel() { t.cancelled = true; } };
    },
    run() {
      for (const t of tasks) {
        while (!t.done && !t.cancelled) {
          t.steps += 1;
          if (t.it.next().done) t.done = true;
        }
      }
      tasks.length = 0;
    },
    /** Jalankan n langkah tugas pertama yang belum selesai (uji pembatalan di tengah). */
    step(n) {
      const t = tasks.find((x) => !x.done && !x.cancelled);
      for (let i = 0; i < n && t && !t.done; i += 1) if (t.it.next().done) t.done = true;
    },
  };
}

const rect = (cx, cz, w = 30, d = 12) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
const b = (id, cx, cz, tags = { name: 'Gedung A' }) => ({ id, ring: rect(cx, cz), levels: 1, tags, cluster: clusterKeyOf(cx, cz), area: 360, front: [0, 1] });
const BUILDINGS = [b('w1', 100, 100), b('w2', 140, 160), b('w3', 400, 100), b('w4', 1600, 100)];
const quiet = { warn: () => {}, error: () => {} };

function setup(over = {}) {
  const scheduler = fakeScheduler();
  const materials = createKitMaterials(createResourceScope('uji'));
  const registries = { registerEmissive: vi.fn(() => vi.fn()) };
  const collider = { addBuildings: vi.fn(), removeBuildings: vi.fn(() => true) };
  const clusters = createBuildingClusters({
    buildings: BUILDINGS, materials, scheduler, groundY: () => 0, registries, collider, logger: quiet, signAtlas: () => null, ...over,
  });
  return { scheduler, clusters, registries, collider, materials };
}

describe('fungsi murni klaster', () => {
  it('kunci & batas klaster 250 m (lantai untuk negatif)', () => {
    expect(clusterKeyOf(100, 100)).toBe('0_0');
    expect(clusterKeyOf(-0.1, 250)).toBe('-1_1');
    expect(clusterBounds('-5_4')).toEqual({ minX: -1250, minZ: 1000, maxX: -1000, maxZ: 1250 });
    expect(rectDistance(0, 0, clusterBounds('1_0'))).toBe(250);
    expect(rectDistance(100, 100, clusterBounds('0_0'))).toBe(0);
  });

  it('groupByCluster urut kunci', () => {
    expect([...groupByCluster(BUILDINGS).keys()]).toEqual(['0_0', '1_0', '6_0']);
  });

  it('desiredLod dengan histeresis 30 m', () => {
    expect(desiredLod(0, null)).toBe(0);
    expect(desiredLod(250, null)).toBe(0);
    expect(desiredLod(260, null)).toBe(1);
    expect(desiredLod(270, 0)).toBe(0); // masih dalam lod0 + h
    expect(desiredLod(281, 0)).toBe(1);
    expect(desiredLod(900, null)).toBe(1);
    expect(desiredLod(910, null)).toBeNull();
    expect(desiredLod(920, 1)).toBe(1); // ≤ lod1 + h
    expect(desiredLod(931, 1)).toBeNull();
    expect(CLUSTER.size).toBe(250);
  });

  it('planEntry: gagal plan → cadangan K12, gagal lagi → null', () => {
    const ok = planEntry(b('w9', 0, 0), {}, () => 0, quiet);
    expect(ok.plan.kit).toBe('K01');
    expect(planEntry({ id: 'w8', ring: [[0, 0], [0.1, 0], [0, 0.1]], tags: {}, levels: null }, {}, () => 0, quiet)).toBeNull();
  });
});

describe('createBuildingClusters', () => {
  it('fokus (100,100): 0_0 (jarak 0) & 1_0 (jarak 150) LOD0, 6_0 (jarak 1400) tidak dirakit', () => {
    const { scheduler, clusters, registries, collider } = setup({ config: { ...CLUSTER, maxJobs: 9 } });
    clusters.update({ x: 100, z: 100 });
    expect(scheduler.tasks.map((t) => t.owner)).toEqual(['unri:gedung:0_0', 'unri:gedung:1_0']);
    scheduler.run();
    const snap = Object.fromEntries(clusters.snapshot().map((s) => [s.key, s.lod]));
    expect(snap).toEqual({ '0_0': 0, '1_0': 0, '6_0': null });
    const s = clusters.stats();
    expect(s.lod0).toBe(2);
    expect(s.meshes).toBeLessThanOrEqual(2 * 3); // ≤ 3 mesh (opak/potong/papan) per klaster
    expect(s.triangles).toBeGreaterThan(0);
    expect(registries.registerEmissive).toHaveBeenCalledTimes(2);
    expect(clusters.group.name).toBe('unri:gedung');
    expect(clusters.group.children.map((g) => g.name).sort()).toEqual(['unri:gedung:0_0:lod0', 'unri:gedung:1_0:lod0']);
    expect(collider.addBuildings).toHaveBeenCalledWith('0_0', [{ ring: BUILDINGS[0].ring, holes: [] }, { ring: BUILDINGS[1].ring, holes: [] }]);
  });

  it('maxJobs = 1: klaster terdekat dulu, satu per satu', () => {
    const { scheduler, clusters } = setup();
    clusters.update({ x: 600, z: 100 });
    expect(scheduler.tasks.map((t) => t.owner)).toEqual(['unri:gedung:1_0']);
    scheduler.run();
    clusters.update({ x: 600, z: 100 });
    expect(scheduler.tasks.map((t) => t.owner)).toEqual(['unri:gedung:0_0']);
  });

  it('tukar LOD: LOD lama tetap tampil sampai LOD baru selesai (tanpa lubang)', () => {
    const { scheduler, clusters } = setup({ config: { ...CLUSTER, maxJobs: 9 } });
    clusters.update({ x: 1100, z: 100 }); // 0_0 jarak 850 → LOD1; 1_0 jarak 600 → LOD1
    scheduler.run();
    expect(clusters.snapshot().find((s) => s.key === '0_0').lod).toBe(1);
    clusters.update({ x: 100, z: 100 });
    expect(clusters.snapshot().find((s) => s.key === '0_0')).toMatchObject({ lod: 1, job: 0 });
    expect(clusters.group.children.map((g) => g.name).sort()).toEqual(['unri:gedung:0_0:lod1', 'unri:gedung:1_0:lod1']);
    scheduler.run();
    expect(clusters.snapshot().find((s) => s.key === '0_0')).toMatchObject({ lod: 0, job: null });
    expect(clusters.group.children.some((g) => g.name === 'unri:gedung:0_0:lod0')).toBe(true);
  });

  it('menjauh > lod1 + h: tugas berjalan dibatalkan, klaster tampil dilepas (geometri dispose)', () => {
    const { scheduler, clusters, collider } = setup();
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    const geo = clusters.group.children[0].children[0].geometry;
    const spy = vi.spyOn(geo, 'dispose');
    clusters.update({ x: 5000, z: 5000 });
    expect(spy).toHaveBeenCalled();
    expect(collider.removeBuildings).toHaveBeenCalledWith('0_0');
    expect(clusters.group.children).toHaveLength(0);
    clusters.update({ x: 100, z: 100 });
    scheduler.step(1);
    clusters.update({ x: 5000, z: 5000 });
    expect(scheduler.tasks[0].cancelled).toBe(true);
    expect(clusters.stats().jobs).toBe(0);
  });

  it('terrainReady false menunda perakitan', () => {
    let ready = false;
    const { scheduler, clusters } = setup({ terrainReady: () => ready });
    clusters.update({ x: 100, z: 100 });
    expect(scheduler.tasks).toHaveLength(0);
    ready = true;
    clusters.update({ x: 100, z: 100 });
    expect(scheduler.tasks).toHaveLength(1);
  });

  it('setSuppressed: klaster terkait dirakit ulang tanpa gedung itu; settled()', () => {
    const { scheduler, clusters } = setup();
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    const before = clusters.stats().triangles;
    expect(clusters.settled(100, 100, 10)).toBe(true);
    clusters.setSuppressed(['w1']);
    expect(clusters.settled(100, 100, 10)).toBe(false);
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    expect(clusters.stats().triangles).toBeLessThan(before);
    expect(clusters.settled(100, 100, 10)).toBe(true);
  });

  it('gedung yang gagal dirakit jatuh ke K12 (geometri parsial dibuang), klaster tetap tampil', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    function* appendSteps(sink, plan, mats, opts) {
      if (plan.id === 'w1') {
        sink.opak.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], { u0: 0, v0: 0, u1: 1, v1: 1 }); // sampah parsial
        throw new Error('rusak');
      }
      yield* appendPlanSteps(sink, plan, mats, opts);
    }
    const { scheduler, clusters } = setup({ logger, appendSteps });
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    expect(clusters.stats().lod0).toBeGreaterThanOrEqual(1);
    expect(logger.error.mock.calls.some(([m]) => /w1: perakitan gagal, jatuh ke K12/.test(m))).toBe(true);
    const pos = clusters.group.children.find((g) => g.name === 'unri:gedung:0_0:lod0').children[0].geometry.attributes.position;
    let hasJunk = false;
    for (let i = 0; i < pos.count; i += 1) if (pos.getX(i) === 0 && pos.getY(i) === 1 && pos.getZ(i) === 0) hasJunk = true;
    expect(hasJunk).toBe(false);
  });

  it('dispose: semua klaster dilepas, group dicabut, tugas dibatalkan', () => {
    const { scheduler, clusters } = setup();
    clusters.update({ x: 100, z: 100 });
    scheduler.run();
    clusters.update({ x: 1300, z: 100 });
    const pending = scheduler.tasks[0];
    clusters.dispose();
    expect(pending.cancelled).toBe(true);
    expect(clusters.group.children).toHaveLength(0);
    expect(clusters.stats()).toMatchObject({ lod0: 0, lod1: 0, jobs: 0 });
  });
});
