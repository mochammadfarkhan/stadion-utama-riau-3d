import { describe, it, expect } from 'vitest';
import { createChunkStreamer, rectDistance, STREAM } from '../../src/city/ChunkStreamer.js';
import { tileKey } from '../../src/geo/tiles.js';

/** Grid tile persegi ix, iz ∈ [from, to]. */
const grid = (from, to) => {
  const out = [];
  for (let iz = from; iz <= to; iz += 1) for (let ix = from; ix <= to; ix += 1) out.push({ key: tileKey(ix, iz), ix, iz });
  return out;
};
/** Selesaikan semua aksi load/swap secara sinkron (loader palsu sukses). */
const settleAll = (s, actions) => actions.filter((a) => a.type === 'load' || a.type === 'swap').forEach((a) => s.loaded(a.key, a.lod, a.req));
/** Ulang update + selesaikan sampai tidak ada aksi baru. */
const pump = (s, focus, max = 100) => {
  for (let i = 0; i < max; i += 1) {
    const a = s.update(focus);
    if (a.length === 0) return;
    settleAll(s, a);
  }
};

describe('rectDistance', () => {
  it('0 di dalam persegi; jarak ke tepi/sudut di luar', () => {
    const b = { minX: 0, minZ: 0, maxX: 500, maxZ: 500 };
    expect(rectDistance(250, 250, b)).toBe(0);
    expect(rectDistance(-100, 250, b)).toBe(100);
    expect(rectDistance(800, 900, b)).toBe(500);
  });
});

describe('ChunkStreamer', () => {
  it('maks 2 muat paralel, terdekat dulu; LOD0 < 600 m, LOD1 600–1000 m', () => {
    const s = createChunkStreamer({ tiles: grid(-3, 2) });
    const first = s.update({ x: 10, z: 10 });
    expect(first).toEqual([{ type: 'load', key: '0_0', lod: 0, req: 1 }, { type: 'load', key: '-1_0', lod: 0, req: 2 }]);
    expect(s.update({ x: 10, z: 10 })).toEqual([]); // slot penuh
    settleAll(s, first);
    pump(s, { x: 10, z: 10 });
    expect(s.stats().loading).toBe(0);
    expect(s.lodOf('0_0')).toBe(0);
    expect(s.lodOf('-2_0')).toBe(0);   // x ∈ [-1000, -500): 510 m → LOD0
    expect(s.lodOf('2_0')).toBe(1);    // x ∈ [1000, 1500): 990 m → LOD1
    expect(s.status('-3_0')).toBe('idle'); // 1010 m: di luar radius muat
  });

  it('semua tile yang persegi-nya ≤ 1000 m dimuat, sisanya tidak', () => {
    const s = createChunkStreamer({ tiles: grid(-4, 3) });
    pump(s, { x: 0, z: 0 });
    for (const key of s.keys('loaded')) {
      const [ix, iz] = key.split('_').map(Number);
      expect(rectDistance(0, 0, { minX: ix * 500, minZ: iz * 500, maxX: (ix + 1) * 500, maxZ: (iz + 1) * 500 })).toBeLessThanOrEqual(1000);
    }
    expect(s.keys('loaded').length).toBe(grid(-4, 3).filter((t) => rectDistance(0, 0, {
      minX: t.ix * 500, minZ: t.iz * 500, maxX: (t.ix + 1) * 500, maxZ: (t.iz + 1) * 500,
    }) <= 1000).length);
  });

  it('histeresis: dilepas hanya setelah > 1300 m; masuk lagi → dimuat ulang', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: 250, z: 250 });
    expect(s.status('0_0')).toBe('loaded');
    expect(s.update({ x: 250 + 250 + 1200, z: 250 })).toEqual([]); // 1200 m: masih
    expect(s.update({ x: 250 + 250 + 1301, z: 250 })).toEqual([{ type: 'unload', key: '0_0' }]);
    expect(s.status('0_0')).toBe('idle');
    expect(s.update({ x: 250, z: 250 })[0]).toMatchObject({ type: 'load', key: '0_0', lod: 0 });
  });

  it('tukar LOD saat mendekat/menjauh dengan histeresis 50 m; LOD lama tetap sampai swap selesai', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -800, z: 250 }); // 800 m → LOD1
    expect(s.lodOf('0_0')).toBe(1);
    const swap = s.update({ x: -550, z: 250 }); // 550 m < 600 → LOD0
    expect(swap).toEqual([{ type: 'swap', key: '0_0', lod: 0, req: 2 }]);
    expect(s.status('0_0')).toBe('loaded');
    expect(s.lodOf('0_0')).toBe(1);
    s.loaded('0_0', 0, 2);
    expect(s.update({ x: -640, z: 250 })).toEqual([]); // 640 ≤ 650: tetap LOD0
    expect(s.update({ x: -660, z: 250 })[0]).toMatchObject({ type: 'swap', lod: 1 });
  });

  it('batal bila keluar radius lepas (> 1300 m) sebelum selesai; hasil basi ditolak', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    const [load] = s.update({ x: -900, z: 250 });
    expect(load.type).toBe('load');
    expect(s.update({ x: -1100, z: 250 })).toEqual([]); // 1100 m: histeresis, muatan berjalan terus
    expect(s.update({ x: -1400, z: 250 })).toEqual([{ type: 'cancel', key: '0_0', req: load.req }]);
    expect(s.loaded('0_0', load.lod, load.req)).toBe(false);
    expect(s.status('0_0')).toBe('idle');
  });

  it('muatan berjalan tidak thrash di batas 1000 m (999↔1001 m): tepat 1 load, 0 cancel', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    const actions = [];
    for (let i = 0; i < 10; i += 1) actions.push(...s.update({ x: i % 2 === 0 ? -999 : -1001, z: 250 }));
    expect(actions.filter((a) => a.type === 'load')).toHaveLength(1);
    expect(actions.filter((a) => a.type === 'cancel')).toHaveLength(0);
    expect(s.status('0_0')).toBe('loading');
  });

  it('key tile ganda ditolak di konstruktor', () => {
    const t = { key: '0_0', ix: 0, iz: 0 };
    expect(() => createChunkStreamer({ tiles: [t, { ...t }] })).toThrow(/ganda.*0_0/);
  });

  it('swap LOD usang dibatalkan bila fokus berbalik (histeresis 50 m, tanpa thrash di 600 m)', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -800, z: 250 }); // LOD1
    const [swap] = s.update({ x: -590, z: 250 });
    expect(swap).toMatchObject({ type: 'swap', lod: 0 });
    expect(s.update({ x: -610, z: 250 })).toEqual([]); // 610 ≤ 650: swap tetap berjalan
    expect(s.update({ x: -700, z: 250 })).toEqual([{ type: 'cancel', key: '0_0', req: swap.req }]);
    expect(s.loaded('0_0', 0, swap.req)).toBe(false);
    expect(s.lodOf('0_0')).toBe(1);
    expect(s.stats().inFlight).toBe(0);
  });

  it('swap LOD di rentang 1000–1300 m dibatalkan; tile tetap tampil dengan LOD lama', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -500, z: 250 }); // LOD0
    const [swap] = s.update({ x: -700, z: 250 });
    expect(swap).toMatchObject({ type: 'swap', lod: 1 });
    expect(s.update({ x: -1100, z: 250 })).toEqual([{ type: 'cancel', key: '0_0', req: swap.req }]);
    expect(s.status('0_0')).toBe('loaded');
    expect(s.lodOf('0_0')).toBe(0);
    expect(s.update({ x: -1100, z: 250 })).toEqual([]);
  });

  it('noSwap direset saat keluar radius muat: tukar LOD dicoba lagi tanpa harus dilepas', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -800, z: 250 });
    const [swap] = s.update({ x: -500, z: 250 });
    s.failed('0_0', swap.req);
    expect(s.update({ x: -500, z: 250 })).toEqual([]);
    expect(s.update({ x: -1100, z: 250 })).toEqual([]);
    expect(s.status('0_0')).toBe('loaded');
    expect(s.update({ x: -500, z: 250 })[0]).toMatchObject({ type: 'swap', key: '0_0', lod: 0 });
  });

  it('teleport 8 km dengan banyak tile: semua dilepas/dibatalkan, tanpa sisa', () => {
    const s = createChunkStreamer({ tiles: grid(-4, 3) });
    pump(s, { x: 0, z: 0 });
    s.update({ x: 1600, z: 0 }); // beberapa muatan/swap baru sedang berjalan
    const before = s.stats();
    expect(before.inFlight).toBeGreaterThan(0);
    const out = s.update({ x: 8000, z: 8000 });
    expect(out.filter((a) => a.type === 'unload')).toHaveLength(before.loaded);
    expect(out.filter((a) => a.type === 'cancel')).toHaveLength(before.inFlight);
    expect(out.filter((a) => a.type === 'load' || a.type === 'swap')).toHaveLength(0);
    expect(s.stats()).toEqual({ idle: grid(-4, 3).length, loading: 0, loaded: 0, failed: 0, inFlight: 0 });
  });

  it('gagal: tile ditandai gagal, tidak dicoba lagi sampai keluar >1300 m; settled menghitung gagal sebagai selesai', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    const [load] = s.update({ x: 250, z: 250 });
    expect(s.settled(250, 250, 600)).toBe(false);
    expect(s.failed('0_0', load.req)).toBe(true);
    expect(s.failed('0_0', load.req)).toBe(false);
    expect(s.status('0_0')).toBe('failed');
    expect(s.update({ x: 250, z: 250 })).toEqual([]);
    expect(s.settled(250, 250, 600)).toBe(true);
    s.update({ x: 5000, z: 250 });
    expect(s.status('0_0')).toBe('idle');
  });

  it('tukar LOD gagal: LOD lama dipertahankan, tidak dicoba ulang', () => {
    const s = createChunkStreamer({ tiles: [{ key: '0_0', ix: 0, iz: 0 }] });
    pump(s, { x: -800, z: 250 });
    const [swap] = s.update({ x: -500, z: 250 });
    s.failed('0_0', swap.req);
    expect(s.lodOf('0_0')).toBe(1);
    expect(s.update({ x: -500, z: 250 })).toEqual([]);
  });

  it('fokus tak valid → tanpa aksi; konfigurasi radius tak masuk akal ditolak', () => {
    const s = createChunkStreamer({ tiles: grid(0, 0) });
    expect(s.update({ x: Number.NaN, z: 0 })).toEqual([]);
    expect(s.update(null)).toEqual([]);
    expect(() => createChunkStreamer({ tiles: [], config: { ...STREAM, unloadRadius: 900 } })).toThrow(RangeError);
  });
});
