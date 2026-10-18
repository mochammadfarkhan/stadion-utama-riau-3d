import { describe, it, expect } from 'vitest';
import { applyDistricts, osmShortId } from '../../tools/citybake/mask.js';
import { polygonArea, signedArea } from '../../src/geo/polygon.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const D = { id: 'uji', ring: sq(0, 0, 100, 100), excludeIds: new Set(['w7']) };
const bld = (id, cx, cz) => ({ id, source: 'osm', kind: 'building', cls: 'yes', tags: {}, rings: [sq(cx - 5, cz - 5, cx + 5, cz + 5)] });
const area = (id, kind, ring, holes = []) => ({
  id, source: 'osm', kind, cls: kind === 'water' ? 'water' : 'grass', tags: {}, rings: [ring, ...holes],
});
const road = (id, line) => ({ id, source: 'osm', kind: 'road', cls: 'tertiary', tags: {}, line });

describe('osmShortId', () => {
  it('way/relation OSM → w/r; Overture → null', () => {
    expect(osmShortId('osm:way/123')).toBe('w123');
    expect(osmShortId('osm:relation/9#0')).toBe('r9');
    expect(osmShortId('osm:way/5~0')).toBe('w5');
    expect(osmShortId('overture:abc')).toBeNull();
  });
});

describe('applyDistricts', () => {
  it('bangunan: centroid di dalam dibuang; id ∈ excludeIds dibuang walau centroid di luar', () => {
    const ov = { ...bld('overture:x', 20, 20), source: 'overture' };
    const out = applyDistricts([bld('osm:way/1', 50, 50), bld('osm:way/7', 150, 50), bld('osm:way/8', 150, 50), ov], [D]);
    expect(out.map((f) => f.id)).toEqual(['osm:way/8']);
  });

  it('landuse menyilang batas: selisih eksak, dua potongan ~c<k>, orientasi positif', () => {
    const out = applyDistricts([area('osm:way/2', 'landuse', sq(-50, 40, 150, 60))], [D]);
    expect(out.map((f) => f.id)).toEqual(['osm:way/2~c0', 'osm:way/2~c1']);
    expect(out.reduce((s, f) => s + polygonArea(f.rings[0]), 0)).toBeCloseTo(200 * 20 - 100 * 20, 6);
    for (const f of out) expect(signedArea(f.rings[0])).toBeGreaterThan(0);
  });

  it('air seluruhnya di dalam dibuang; fitur yang tak beririsan tetap objek yang sama', () => {
    const far = area('osm:way/4', 'water', sq(300, 300, 320, 320));
    const near = area('osm:way/5', 'water', sq(101, 0, 120, 20));
    const out = applyDistricts([area('osm:way/3', 'water', sq(10, 10, 20, 20)), far, near], [D]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(far);
    expect(out[1]).toBe(near);
  });

  it('lubang dipertahankan pada potongan (satu potongan → id tetap)', () => {
    const f = area('osm:way/6', 'landuse', sq(-100, -100, 50, 200), [sq(-80, -80, -60, -60)]);
    const out = applyDistricts([f], [D]);
    expect(out.map((p) => p.id)).toEqual(['osm:way/6']);
    expect(out[0].rings).toHaveLength(2);
    expect(polygonArea(out[0].rings[0]) - polygonArea(out[0].rings[1])).toBeCloseTo(150 * 300 - 50 * 100 - 400, 6);
  });

  it('jalan: bagian dalam dibuang, potong tepat di tepi; tak bersinggungan → objek sama', () => {
    const out = applyDistricts([road('osm:way/9', [[-50, 50], [150, 50]])], [D]);
    expect(out.map((f) => f.id)).toEqual(['osm:way/9~d0', 'osm:way/9~d1']);
    expect(out[0].line.at(-1)[0]).toBeCloseTo(0, 9);
    expect(out[1].line[0][0]).toBeCloseTo(100, 9);
    const away = road('osm:way/10', [[-50, 200], [150, 200]]);
    expect(applyDistricts([away], [D])[0]).toBe(away);
  });

  it('tanpa distrik → salinan daftar', () => {
    const f = [bld('osm:way/1', 50, 50)];
    const out = applyDistricts(f, []);
    expect(out).toEqual(f);
    expect(out).not.toBe(f);
  });
});
