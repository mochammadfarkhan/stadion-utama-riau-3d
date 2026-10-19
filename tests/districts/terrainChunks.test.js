import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createTerrainChunks, chunkCellGrid } from '../../src/districts/terrainChunks.js';
import { createChunkStreamer } from '../../src/city/ChunkStreamer.js';
import { createHeightField } from '../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../../src/geo/terrain/format.js';

const KEYS = ['0_0', '1_0'];
const header = { ...TERRAIN_HEADER, chunks: KEYS };

function binOf(y) {
  const buf = new ArrayBuffer(N * N * 2);
  const view = new DataView(buf);
  for (let i = 0; i < N * N; i += 1) view.setUint16(i * 2, Math.round(y / UNIT) - BIAS, true);
  return buf;
}

/** Scheduler palsu: antrean dijalankan penuh oleh runAll(); tugas generator diiterasi sampai selesai. */
function fakeScheduler() {
  const q = [];
  return {
    schedule(task, { owner }) {
      const e = { task, owner, cancelled: false };
      q.push(e);
      return { cancel() { e.cancelled = true; } };
    },
    cancelOwner(o) { for (const e of q) if (e.owner === o) e.cancelled = true; },
    pending(o) { return q.filter((e) => !e.cancelled && (o === undefined || e.owner === o)).length; },
    runAll() {
      while (q.length) {
        const e = q.shift();
        if (e.cancelled) continue;
        const it = e.task();
        if (it && typeof it.next === 'function') for (let s = it.next(); !s.done; s = it.next());
      }
    },
  };
}

const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); };

function setup({ fetchImpl, onFail = vi.fn(), onChunkMesh = vi.fn(), onChunkRelease = vi.fn() } = {}) {
  const field = createHeightField();
  const parent = new THREE.Group();
  const scheduler = fakeScheduler();
  const cellGrid = chunkCellGrid(KEYS);
  const cellMask = new Uint8Array(cellGrid.cols * cellGrid.rows).fill(1);
  const hole = new Uint8Array(cellMask.length);
  const onHoleChange = vi.fn();
  const chunks = createTerrainChunks({
    header, baseUrl: '/d/', field, parent, materials: { terrain: new THREE.MeshBasicMaterial() },
    cellGrid, cellMask, hole, onHoleChange, scheduler, owner: 'district:uji',
    createStreamer: (o) => createChunkStreamer({ ...o, config: { loadRadius: 600, unloadRadius: 800, lod0Radius: 50, lodHysteresis: 10, maxParallel: 2 } }),
    fetchArrayBuffer: fetchImpl ?? (async () => binOf(2)), sleep: async () => {}, onFail, logger: { error() {} },
    onChunkMesh, onChunkRelease,
  });
  return { field, parent, scheduler, chunks, hole, onHoleChange, onFail, cellGrid, onChunkMesh, onChunkRelease };
}

describe('chunkCellGrid', () => {
  it('persegi chunk -1_0 … 1_2 → 375 × 375 sel mulai (−500, 0)', () => {
    expect(chunkCellGrid(['-1_0', '1_2', '0_1'])).toMatchObject({ minX: -500, minZ: 0, cols: 375, rows: 375, ix0: -1, iz0: 0, per: 125 });
  });
});

describe('createTerrainChunks', () => {
  it('muat: field terisi sebelum mesh; mesh terpasang setelah scheduler; lubang terisi', async () => {
    const s = setup();
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    expect(s.field.heightAt(10, 10)).toBeCloseTo(2, 6);
    expect(s.parent.children).toHaveLength(0);
    expect(s.chunks.settled(10, 10, 50)).toBe(false);
    s.scheduler.runAll();
    expect(s.parent.children.map((m) => m.name).sort()).toEqual(['terrain:0_0:lod0', 'terrain:1_0:lod1']);
    expect(s.hole[0]).toBe(1);
    expect(s.hole[124]).toBe(1);
    expect(s.onHoleChange).toHaveBeenCalled();
    expect(s.chunks.settled(10, 10, 50)).toBe(true);
  });

  it('data rusak: tanpa retry, onFail sekali, heightAt 0, mesh datar tetap menutup lubang', async () => {
    const fetchImpl = vi.fn(async (url) => (url.endsWith('0_0.bin') ? new ArrayBuffer(8) : binOf(1)));
    const s = setup({ fetchImpl });
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.scheduler.runAll();
    expect(fetchImpl.mock.calls.filter(([u]) => u === '/d/terrain/0_0.bin')).toHaveLength(1);
    expect(s.onFail).toHaveBeenCalledTimes(1);
    expect(s.field.heightAt(10, 10)).toBe(0);
    expect(s.parent.children.some((m) => m.name === 'terrain:0_0:lod1')).toBe(true);
    expect(s.hole[0]).toBe(1);
  });

  it('galat jaringan dicoba ulang 2× lalu berhasil', async () => {
    let calls = 0;
    const s = setup({ fetchImpl: async () => { calls += 1; if (calls <= 2) throw new Error('offline'); return binOf(3); } });
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    expect(s.onFail).not.toHaveBeenCalled();
    expect(s.field.heightAt(10, 10)).toBeCloseTo(3, 6);
  });

  it('fokus menjauh > unloadRadius: mesh, field, dan lubang dilepas', async () => {
    const s = setup();
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.scheduler.runAll();
    s.chunks.update({ x: 5000, z: 5000 });
    expect(s.parent.children).toHaveLength(0);
    expect(s.field.size).toBe(0);
    expect(s.hole.every((v) => v === 0)).toBe(true);
  });

  it('hook onChunkMesh (muat & tukar LOD) dan onChunkRelease (unload); galat hook tidak memutus', async () => {
    const s = setup({ onChunkMesh: vi.fn(() => { throw new Error('hook rusak'); }) });
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.scheduler.runAll();
    expect(s.onChunkMesh).toHaveBeenCalledTimes(2);
    const [key, info] = s.onChunkMesh.mock.calls.find(([k]) => k === '0_0');
    expect(key).toBe('0_0');
    expect(info.lod).toBe(0);
    expect(info.chunk.key).toBe('0_0');
    expect(s.parent.children).toContain(info.mesh);
    s.chunks.update({ x: 5000, z: 5000 });
    expect(s.onChunkRelease.mock.calls.map(([k]) => k).sort()).toEqual(['0_0', '1_0']);
  });

  it('dispose membatalkan rakitan tertunda dan melepas semua', async () => {
    const s = setup();
    s.chunks.update({ x: 10, z: 10 });
    await flush();
    s.chunks.dispose();
    s.scheduler.runAll();
    expect(s.parent.children).toHaveLength(0);
    expect(s.field.size).toBe(0);
    expect(s.scheduler.pending('district:uji')).toBe(0);
  });
});
