import { describe, it, expect } from 'vitest';
import { markingQuads, treePoints, streetLampPoints, hash01, TREES, MARKING, LAMPS } from '../../src/city/tileDetail.js';
import { pointInPolygon } from '../../src/geo/polygon.js';

const road = (cls, width, pts) => ({ cls, width, name: null, pts });
const tile = (over = {}) => ({
  key: '3_4', ix: 3, iz: 4, center: { x: 1750, z: 2250 },
  buildings: [{ height: 6, ring: [[1740, 2240], [1760, 2240], [1760, 2260], [1740, 2260]] }],
  water: [], waterways: [],
  roads: [road('residential', 6, [[1550, 2250], [1950, 2250]]), road('primary', 14, [[1750, 2050], [1750, 2450]])],
  ...over,
});

describe('markingQuads', () => {
  it('garis tengah putus-putus mengikuti periode dash+gap; jalan sempit/kecil dilewati', () => {
    const n = markingQuads([road('residential', 6, [[0, 0], [90, 0]])]).length / 8;
    expect(n).toBe(Math.ceil(90 / (MARKING.dash + MARKING.gap)));
    expect(markingQuads([road('residential', 4, [[0, 0], [90, 0]])])).toEqual([]);
    expect(markingQuads([road('footway', 8, [[0, 0], [90, 0]])])).toEqual([]);
  });
  it('kelas besar mendapat dua garis tepi menerus; reserved membuang segmen', () => {
    const r = road('primary', 14, [[0, 0], [90, 0]]);
    expect(markingQuads([r]).length / 8).toBe(Math.ceil(90 / 9) + 2);
    expect(markingQuads([r], () => true)).toEqual([]);
  });
});

describe('treePoints', () => {
  it('deterministik, di dalam tile, tidak di bangunan/jalan/reserved, dan dibatasi max', () => {
    const t = tile();
    const a = treePoints(t);
    expect(a.length).toBeGreaterThan(20);
    expect(treePoints(t)).toEqual(a);
    expect(a.length).toBeLessThanOrEqual(TREES.maxPerTile);
    for (const p of a) {
      expect(Math.abs(p.x - 1750)).toBeLessThanOrEqual(TREES.half);
      expect(pointInPolygon(p.x, p.z, t.buildings[0].ring)).toBe(false);
      if (Math.abs(p.x - 1750) < 190) expect(Math.abs(p.z - 2250)).toBeGreaterThan(3 + 1.4 - 0.01); // badan jalan residential (lebar 6; jalan berakhir di x=1950)
    }
    expect(treePoints(t, () => true)).toEqual([]);
    expect(treePoints(t, () => false, { max: 10 }).length).toBe(10);
  });
  it('hash01 ada di [0, 1)', () => {
    for (let i = 0; i < 200; i += 1) {
      const h = hash01(i, i * 3, 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('streetLampPoints', () => {
  const big = road('primary', 14, [[0, 0], [380, 0]]);
  it('jarak ≈ spacing, bergantian dua sisi, digeser dari tepi jalan', () => {
    const pts = streetLampPoints([big]);
    expect(pts.length).toBeGreaterThanOrEqual(Math.floor(380 / LAMPS.spacing));
    expect(pts.length).toBeLessThanOrEqual(Math.ceil(380 / LAMPS.spacing));
    for (const p of pts) expect(Math.abs(p.z)).toBeCloseTo(7 + LAMPS.offset, 6);
    expect(Math.sign(pts[0].z)).not.toBe(Math.sign(pts[1].z));
  });
  it('jalan kecil/sempit dan reserved dilewati; max membatasi', () => {
    expect(streetLampPoints([road('residential', 6, [[0, 0], [380, 0]])])).toEqual([]);
    expect(streetLampPoints([road('primary', 4, [[0, 0], [380, 0]])])).toEqual([]);
    expect(streetLampPoints([big], () => true)).toEqual([]);
    expect(streetLampPoints([big], () => false, { max: 3 })).toHaveLength(3);
  });
  it('deterministik', () => {
    expect(streetLampPoints([big])).toEqual(streetLampPoints([big]));
  });
});
