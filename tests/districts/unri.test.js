import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { unriDistrict, validateDistrictManifest, SETTLE } from '../../src/districts/unri/index.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';
import { validateDistrictBuild, districtContains } from '../../src/districts/District.js';
import { createChunkStreamer } from '../../src/city/ChunkStreamer.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { createTerrainService } from '../../src/app/terrainService.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../../src/geo/terrain/format.js';
import { polygonArea, signedArea } from '../../src/geo/polygon.js';

const manifest = (chunks = ['-1_2']) => ({
  format: 'unri-district', version: 1, terrain: { ...TERRAIN_HEADER, chunks },
  ground: { chunks: [] }, buildings: 'buildings.json', attribution: 'ATTRIBUTION.txt',
});

describe('UNRI_BOUNDARY (hasil bake:campus -- boundary)', () => {
  it('ring tunggal ±2,4 km², luas bertanda positif, stadion di luar, sekre & rektorat di dalam', () => {
    expect(UNRI_BOUNDARY.length).toBeGreaterThanOrEqual(20);
    expect(signedArea(UNRI_BOUNDARY)).toBeGreaterThan(0);
    expect(polygonArea(UNRI_BOUNDARY)).toBeGreaterThan(2.3e6);
    expect(polygonArea(UNRI_BOUNDARY)).toBeLessThan(2.5e6);
    expect(districtContains(unriDistrict, 0, 0)).toBe(false);
    expect(districtContains(unriDistrict, -219, 1107)).toBe(true);
    expect(districtContains(unriDistrict, -979, 860)).toBe(true);
  });
});

describe('validateDistrictManifest', () => {
  it('menerima manifest valid (beku)', () => {
    const h = validateDistrictManifest(manifest(['-1_2', '0_2']));
    expect(h.chunks).toEqual(['-1_2', '0_2']);
    expect(Object.isFrozen(h.chunks)).toBe(true);
  });
  it('menolak format, kunci, dan duplikat', () => {
    expect(() => validateDistrictManifest({ ...manifest(), format: 'lain' })).toThrow(/bukan unri-district/);
    expect(() => validateDistrictManifest(manifest(['a_b']))).toThrow(/ix_iz/);
    expect(() => validateDistrictManifest(manifest(['01_2']))).toThrow(/ix_iz/);
    expect(() => validateDistrictManifest(manifest(['0_0', '0_0']))).toThrow(/ganda/);
    expect(() => validateDistrictManifest({ ...manifest(), terrain: { ...TERRAIN_HEADER, n: 3, chunks: [] } })).toThrow(/n 3/);
  });
});

describe('unriDistrict.build', () => {
  function chunkBin(y) {
    const buf = new ArrayBuffer(N * N * 2);
    const v = new DataView(buf);
    for (let i = 0; i < N * N; i += 1) v.setUint16(i * 2, Math.round(y / UNIT) - BIAS, true);
    return buf;
  }
  const queue = [];
  const scheduler = {
    schedule(task, { owner }) { const e = { task, owner, off: false }; queue.push(e); return { cancel() { e.off = true; } }; },
    cancelOwner(o) { for (const e of queue) if (e.owner === o) e.off = true; },
    pending(o) { return queue.filter((e) => !e.off && e.owner === o).length; },
    whenIdle: async () => {},
    run() { while (queue.length) { const e = queue.shift(); if (!e.off) { const it = e.task(); for (let s = it.next(); !s.done; s = it.next()); } } },
  };

  it('hasil build lengkap; chunk sekre termuat → heightAt nyata, whenSettled true, dispose bersih', async () => {
    const terrain = createTerrainService();
    const holeChanged = vi.fn();
    const result = await unriDistrict.build({
      scope: createResourceScope('uji'), terrain, scheduler, owner: 'district:unri', baseUrl: '/',
      fetchJson: async (url) => { expect(url).toBe('/districts/unri/manifest.json'); return manifest(); },
      fetchArrayBuffer: async (url) => { expect(url).toBe('/districts/unri/terrain/-1_2.bin'); return chunkBin(1.25); },
      createStreamer: (o) => createChunkStreamer(o), onTerrainFail: vi.fn(), groundHoleChanged: holeChanged, logger: { error() {} },
      setTimer: () => 0, clearTimer: () => {},
      registries: { registerWet: () => () => true, registerEmissive: () => () => true, registerLamps: () => () => true },
      isReserved: () => false,
    });
    validateDistrictBuild(result, 'unri');
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.groundHole).toMatchObject({ minX: -500, minZ: 1000, cell: 4, cols: 125, rows: 125 });
    const settled = result.whenSettled(-219, 1107);
    result.systems[0].update(1 / 60, { focus: { x: -219, z: 1107 } });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(terrain.heightAt(-219, 1107)).toBeCloseTo(1.25, 6);
    scheduler.run();
    result.systems[0].update(1 / 60, { focus: { x: -219, z: 1107 } });
    await expect(settled).resolves.toBe(true);
    expect(result.group.children).toHaveLength(3); // lapisan tanah M2 (kosong tanpa data ground) + kehidupan kampus M7 + mesh terrain chunk
    expect(result.life.group.name).toBe('kehidupanKampus');
    expect(holeChanged).toHaveBeenCalled();
    expect(result.groundHole.data.some((v) => v === 1)).toBe(true);
    expect(SETTLE.radius).toBe(600);
    const late = result.whenSettled(0, 0);
    result.dispose();
    await expect(late).resolves.toBe(false);
    expect(terrain.heightAt(-219, 1107)).toBe(0);
  });
});
