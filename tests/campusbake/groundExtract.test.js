import { describe, it, expect } from 'vitest';
import { createAreaIndex, createLineIndex, samplesAlong } from '../../tools/campusbake/ground/spatial.js';
import { extractGround, landcoverKind, roadWidth } from '../../tools/campusbake/ground/extract.js';
import { BOUNDARY, FEATURES, PLAZAS } from './groundFixture.js';

describe('spatial', () => {
  it('nearest: jarak ke tepi pita (negatif di atas pita); di luar reach → Infinity', () => {
    const idx = createLineIndex([{ id: 'a', w: 10, line: [[0, 0], [100, 0]] }], { reach: 5 });
    expect(idx.nearest(50, 8).d).toBeCloseTo(3, 9);
    expect(idx.nearest(50, 2).d).toBeCloseTo(-3, 9);
    expect(idx.nearest(50, 30).d).toBe(Infinity);
  });

  it('contains: lubang dihormati, urutan penyisipan = prioritas; edgeDistance', () => {
    const a = { id: 'a', rings: [[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]] };
    const b = { id: 'b', rings: [[[0, 0], [20, 0], [20, 20], [0, 20]]] };
    const idx = createAreaIndex([a, b], { reach: 5 });
    expect(idx.contains(2, 2).id).toBe('a');
    expect(idx.contains(5, 5).id).toBe('b');
    expect(idx.contains(30, 30)).toBeNull();
    expect(idx.edgeDistance(22, 10, (it) => it.id === 'b')).toBeCloseTo(2, 9);
  });

  it('samplesAlong: spasi & fase melewati simpul', () => {
    const pts = samplesAlong([[0, 0], [10, 0], [10, 10]], 4, 2);
    expect(pts.map((p) => [p.x, p.z])).toEqual([[2, 0], [6, 0], [10, 0], [10, 4], [10, 8]]);
    expect(pts[3]).toMatchObject({ tx: 0, tz: 1 });
  });
});

describe('roadWidth / landcoverKind', () => {
  it('lebar: tabel citybake; searah kelas besar × 0,7; tag width menang', () => {
    expect(roadWidth('tertiary', {})).toBe(10);
    expect(roadWidth('tertiary', { oneway: 'yes' })).toBeCloseTo(7, 9);
    expect(roadWidth('service', { oneway: 'yes' })).toBe(4.5);
    expect(roadWidth('tertiary', { width: '6,5' })).toBe(6.5);
  });

  it('sawit dari trees/genus/nama; kebun; hutan; tak dikenal → null', () => {
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'orchard', trees: 'oil_palms' } })).toBe('sawit');
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'farmland', genus: 'Elaeis' } })).toBe('sawit');
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'orchard', name: 'Kebun Sawit' } })).toBe('sawit');
    expect(landcoverKind({ cls: 'farmland', tags: { landuse: 'orchard' } })).toBe('orchard');
    expect(landcoverKind({ cls: 'forest', tags: { natural: 'wood' } })).toBe('forest');
    expect(landcoverKind({ cls: 'construction', tags: { landuse: 'brownfield' } })).toBe('bare');
    expect(landcoverKind({ cls: 'education', tags: { amenity: 'university' } })).toBeNull();
  });
});

describe('extractGround (fixture)', () => {
  const E = extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY);

  it('jalan kendaraan: bagian dalam + tumpang w/2 + 2 = 7 m; parking_aisle dilewati', () => {
    expect(E.roads).toHaveLength(1);
    expect(E.roads[0]).toMatchObject({ id: 'osm:way/1', cls: 'tertiary', w: 10 });
    expect(E.roads[0].line[0][0]).toBeCloseTo(-7, 9);
    expect(E.roads[0].line.at(-1)[0]).toBeCloseTo(407, 9);
  });

  it('trotoar (jembatan dilewati), jalan tanah, parit OSM', () => {
    expect(E.walks.map((w) => w.id)).toEqual(['osm:way/2']);
    expect(E.walks[0].line).toEqual([[100, 50], [100, 350]]);
    expect(E.soilPaths.map((w) => [w.id, w.cls])).toEqual([['osm:way/5', 'path']]);
    expect(E.waterLines.map((w) => [w.id, w.w])).toEqual([['osm:way/13', 1.5]]);
  });

  it('area: parkir, air, lapangan (bukan stadium), plaza; landcover di dalam distrik saja', () => {
    expect(E.areas.map((a) => [a.id, a.kind])).toEqual([
      ['osm:way/6', 'parking'], ['osm:way/7', 'water'], ['osm:way/8', 'pitch'], ['osm:way/15', 'plaza'],
    ]);
    expect(E.landcover.map((c) => [c.id, c.kind])).toEqual([['osm:way/10', 'forest'], ['osm:way/11', 'sawit']]);
    expect(E.buildings.map((b) => b.id)).toEqual(['osm:way/12']);
  });
});
