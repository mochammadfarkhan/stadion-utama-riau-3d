import { describe, it, expect } from 'vitest';
import { mergeBuildings } from '../../tools/citybake/merge.js';

const sq = (cx, cz, s) => [[cx - s / 2, cz - s / 2], [cx + s / 2, cz - s / 2], [cx + s / 2, cz + s / 2], [cx - s / 2, cz + s / 2]];
const osm = (id, ring) => ({ id: `osm:way/${id}`, source: 'osm', kind: 'building', cls: 'yes', tags: { building: 'yes' }, rings: [ring] });
const ov = (id, ring, dataset = 'Microsoft ML Buildings') => ({
  id: `overture:${id}`, source: 'overture', kind: 'building', cls: 'yes', tags: { building: 'yes', 'overture:dataset': dataset }, rings: [ring],
});

describe('mergeBuildings', () => {
  it('Overture yang centroid-nya di dalam OSM dibuang; yang terpisah dipertahankan', () => {
    const r = mergeBuildings([osm(1, sq(0, 0, 20))], [ov('a', sq(2, 2, 8)), ov('b', sq(100, 100, 8))]);
    expect(r.buildings.map((b) => b.id)).toEqual(['osm:way/1', 'overture:b']);
    expect(r.stats).toEqual({ osm: 1, overtureKept: 1, droppedOsmSource: 0, droppedOverlap: 1 });
  });

  it('Overture besar yang menutupi centroid OSM kecil juga dibuang', () => {
    const r = mergeBuildings([osm(1, sq(5, 5, 4))], [ov('big', sq(0, 0, 40))]);
    expect(r.buildings.map((b) => b.id)).toEqual(['osm:way/1']);
  });

  it('Overture bersumber OpenStreetMap selalu dibuang', () => {
    const r = mergeBuildings([], [ov('o', sq(0, 0, 10), 'OpenStreetMap')]);
    expect(r.buildings).toEqual([]);
    expect(r.stats.droppedOsmSource).toBe(1);
  });

  it('bersebelahan (bbox bersentuhan, tidak tumpang tindih) tetap dipertahankan', () => {
    const r = mergeBuildings([osm(1, sq(0, 0, 10))], [ov('n', sq(10, 0, 10))]);
    expect(r.buildings).toHaveLength(2);
  });

  it('tidak memutasi input', () => {
    const o = [osm(1, sq(0, 0, 10))];
    const v = [ov('a', sq(0, 0, 4))];
    mergeBuildings(o, v);
    expect(o).toHaveLength(1);
    expect(v).toHaveLength(1);
  });
});
