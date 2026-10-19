import { describe, it, expect } from 'vitest';
import { drawFootprints, footprintsOf } from '../../src/districts/unri/buildingFootprints.js';
import { validateBuildingsData, clusterKey } from '../../src/districts/unri/buildingsFormat.js';
import { chunkKeysFor, makeTerrainReady } from '../../src/districts/unri/buildings.js';
import { createUnriCollider } from '../../src/districts/unri/collider.js';

const A = { id: 'w1', ring: [[0, 0], [40, 0], [40, 12], [0, 12]] };
const B = { id: 'r2', ring: [[100, 100], [140, 100], [140, 140], [100, 140]], holes: [[[112, 112], [128, 112], [128, 128], [112, 128]]] };

describe('footprint gedung', () => {
  it('footprintsOf → [{ring, holes}]', () => {
    expect(footprintsOf([A, B])).toEqual([{ ring: A.ring, holes: [] }, { ring: B.ring, holes: B.holes }]);
  });
  it('drawFootprints memanggil path per gedung', () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (typeof k === 'string' && ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].includes(k) ? () => calls.push(k) : undefined), set: () => true });
    drawFootprints(ctx, [A], (x) => x, (z) => z);
    expect(calls.filter((c) => c === 'fill')).toHaveLength(1);
    expect(calls.filter((c) => c === 'lineTo')).toHaveLength(3);
  });
});

describe('collider distrik: addBuildings/removeBuildings (M3 atas createUnriCollider M2)', () => {
  const flat = { normalAt: () => ({ x: 0, y: 1, z: 0 }) };
  it('di dalam footprint & dalam jarak bebas 0,4 m tidak walkable; halaman dalam & luar walkable; kamera terhalang', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addBuildings('0_0', footprintsOf([A, B]));
    expect(c.isWalkable(20, 6)).toBe(false);
    expect(c.penetration(20, 6)).toBeCloseTo(6 + 0.4, 6);
    expect(c.isWalkable(20, -0.2)).toBe(false);
    expect(c.isWalkable(20, -1)).toBe(true);
    expect(c.isWalkable(120, 120)).toBe(true);
    expect(c.isCameraClear(20, 6)).toBe(false);
    expect(c.isCameraClear(20, -1)).toBe(true);
    expect(c.stats().buildingClusters).toBe(1);
  });
  it('removeBuildings membuka kembali; addBuildings ulang mengganti; chunk ground tidak terpengaruh', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', { circles: [{ x: 60, z: 60, r: 0.2 }] });
    c.addBuildings('0_0', footprintsOf([A]));
    c.addBuildings('0_0', footprintsOf([B]));
    expect(c.isWalkable(20, 6)).toBe(true);
    expect(c.isWalkable(105, 105)).toBe(false);
    expect(c.removeBuildings('0_0')).toBe(true);
    expect(c.isWalkable(105, 105)).toBe(true);
    expect(c.isWalkable(60, 60)).toBe(false);
  });
});

describe('buildingsFormat', () => {
  const ok = { v: 1, buildings: [{ id: 'w1', ring: A.ring, levels: 1, tags: {}, cluster: '0_0', area: 480, front: [0, 1] }] };
  it('valid', () => expect(validateBuildingsData(ok)).toEqual([]));
  it('menangkap versi, id, ring, cluster, ganda', () => {
    expect(validateBuildingsData({ v: 2, buildings: [] })[0]).toMatch(/versi/);
    const bad = { v: 1, buildings: [{ ...ok.buildings[0], id: 'x' }, { ...ok.buildings[0], ring: [[0, 0]] }, { ...ok.buildings[0], cluster: 'a' }, ok.buildings[0], ok.buildings[0]] };
    const errs = validateBuildingsData(bad);
    expect(errs.some((e) => /id harus/.test(e))).toBe(true);
    expect(errs.some((e) => /ring/.test(e))).toBe(true);
    expect(errs.some((e) => /cluster/.test(e))).toBe(true);
    expect(errs.some((e) => /ganda/.test(e))).toBe(true);
  });
  it('clusterKey lantai', () => expect(clusterKey(-1, 251)).toBe('-1_1'));
});

describe('kesiapan terrain', () => {
  it('chunkKeysFor klaster 250 m → chunk 500 m', () => {
    expect(chunkKeysFor({ minX: -1250, minZ: 1000, maxX: -1000, maxZ: 1250 })).toEqual(['-3_2']);
    expect(chunkKeysFor({ minX: 250, minZ: 0, maxX: 750, maxZ: 250 })).toEqual(['0_0', '1_0']);
  });
  it('makeTerrainReady: chunk manifest harus dimuat; chunk di luar manifest diabaikan (y = 0)', () => {
    const loaded = new Set();
    const ready = makeTerrainReady({ has: (k) => loaded.has(k) }, ['-3_2']);
    const b = { minX: -1250, minZ: 1000, maxX: -1000, maxZ: 1250 };
    expect(ready(b)).toBe(false);
    loaded.add('-3_2');
    expect(ready(b)).toBe(true);
    expect(ready({ minX: 5000, minZ: 5000, maxX: 5250, maxZ: 5250 })).toBe(true);
  });
});
