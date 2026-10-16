import { describe, it, expect } from 'vitest';
import { applyMasks, splitLineOutside } from '../../tools/citybake/mask.js';
import { partitionFeatures } from '../../tools/citybake/partition.js';
import { polygonArea } from '../../src/geo/polygon.js';

const sq = (cx, cz, s) => [[cx - s / 2, cz - s / 2], [cx + s / 2, cz - s / 2], [cx + s / 2, cz + s / 2], [cx - s / 2, cz + s / 2]];
const building = (id, cx, cz, s = 10) => ({ id, source: 'osm', kind: 'building', cls: 'yes', tags: {}, rings: [sq(cx, cz, s)] });
const road = (id, line) => ({ id, source: 'osm', kind: 'road', cls: 'primary', tags: {}, line });
const area = (id, kind, ring) => ({ id, source: 'osm', kind, cls: kind === 'water' ? 'water' : 'grass', tags: {}, rings: [ring] });

describe('applyMasks', () => {
  const mask = [sq(0, 0, 100)];

  it('bangunan/area dibuang bila centroid di dalam mask', () => {
    const out = applyMasks([building('in', 10, 10), building('out', 200, 0), area('w', 'water', sq(0, 0, 20))], mask);
    expect(out.map((f) => f.id)).toEqual(['out']);
  });

  it('jalan menembus mask dipecah dua; jalan di luar utuh (objek sama)', () => {
    const through = road('r', [[-200, 0], [-100, 0], [-25, 0], [25, 0], [100, 0], [200, 0]]);
    const outside = road('o', [[-200, 300], [200, 300]]);
    const out = applyMasks([through, outside], mask);
    expect(out.map((f) => f.id)).toEqual(['r~0', 'r~1', 'o']);
    expect(out[0].line).toEqual([[-200, 0], [-100, 0], [-25, 0]]);
    expect(out[1].line).toEqual([[25, 0], [100, 0], [200, 0]]);
    expect(out[2]).toBe(outside);
  });

  it('tanpa mask → salinan daftar', () => {
    const f = [building('a', 0, 0)];
    expect(applyMasks(f, [])).toEqual(f);
  });

  it('splitLineOutside: seluruhnya di dalam → []', () => {
    expect(splitLineOutside([[0, 0], [10, 0]], mask)).toEqual([]);
  });
});

describe('partitionFeatures', () => {
  const tiles = [{ ix: -1, iz: 0 }, { ix: 0, iz: 0 }];

  it('bangunan ke tile centroid (tidak dipotong); di luar daftar tile diabaikan', () => {
    const b = partitionFeatures([building('a', 498, 100, 10), building('far', 5000, 100)], tiles);
    expect(b.get('0_0').buildings.map((f) => f.id)).toEqual(['a']);
    expect(b.get('0_0').buildings[0].rings[0]).toEqual(sq(498, 100, 10));
    expect(b.get('-1_0').buildings).toEqual([]);
  });

  it('jalan melintas batas tile dipotong di x = 0', () => {
    const b = partitionFeatures([road('r', [[-100, 50], [100, 50]])], tiles);
    expect(b.get('-1_0').roads[0].line).toEqual([[-100, 50], [0, 50]]);
    expect(b.get('0_0').roads[0].line).toEqual([[0, 50], [100, 50]]);
  });

  it('landuse dipotong per tile, luas terbagi', () => {
    const b = partitionFeatures([area('g', 'landuse', [[-100, 0], [100, 0], [100, 50], [-100, 50]])], tiles);
    expect(polygonArea(b.get('-1_0').landuse[0].rings[0])).toBeCloseTo(5000, 6);
    expect(polygonArea(b.get('0_0').landuse[0].rings[0])).toBeCloseTo(5000, 6);
  });

  it('bundaran (polyline tertutup) di dalam satu tile tetap utuh lewat mask dan partisi', () => {
    const ring = [[200, 200], [220, 200], [220, 220], [200, 220], [200, 200]];
    const rb = road('rb', ring);
    const masked = applyMasks([rb], [sq(-1000, -1000, 100)]);
    expect(masked[0]).toBe(rb);
    const b = partitionFeatures(masked, tiles);
    expect(b.get('0_0').roads.map((f) => f.line)).toEqual([ring]);
    expect(b.get('-1_0').roads).toEqual([]);
  });
});
