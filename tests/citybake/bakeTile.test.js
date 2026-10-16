import { describe, it, expect } from 'vitest';
import { bakeTile } from '../../tools/citybake/bakeTile.js';
import { rect } from './meshTestUtils.js';

const feature = (id, kind, cls, geom, extra = {}) => ({ id, source: 'osm', kind, cls, tags: {}, ...geom, ...extra });

/** Tile 0_0 (x, z ∈ [0, 500), pusat (250, 250)) dalam koordinat dunia. */
const TILE = {
  ix: 0,
  iz: 0,
  key: '0_0',
  buildings: [
    feature('b1', 'building', 'yes', { rings: [rect(100, 100, 20, 10)] }, { height: 9.6 }), // 200 m² → datar
    feature('b2', 'building', 'house', { rings: [rect(150, 60, 8, 6)] }, { height: 3.2 }), // 48 m² → pelana
    feature('b3', 'building', 'shed', { rings: [rect(300, 300, 5, 5)] }, { height: 3 }), // 25 m² → hilang di LOD1
  ],
  roads: [
    feature('r1', 'road', 'primary', { line: [[0, 20], [240, 20]] }, { tags: { name: 'Jalan Uji Raya' } }),
    feature('r2', 'road', 'footway', { line: [[60, 0], [60, 100]] }, { tags: { name: 'Gang Uji' } }),
  ],
  water: [feature('w1', 'water', 'water', { rings: [rect(400, 400, 50, 50)] })],
  waterways: [feature('s1', 'waterway', 'stream', { line: [[400, 100], [450, 100]] })],
  landuse: [feature('l1', 'landuse', 'grass', { rings: [rect(250, 480, 500, 40)] })],
};

describe('bakeTile', () => {
  const out = bakeTile(TILE);
  const tri = (lod, name) => (out.lods[lod].meshes[name] ? out.lods[lod].meshes[name].indices.length / 3 : 0);

  it('LOD0: jumlah segitiga per mesh', () => {
    expect(tri(0, 'buildings_walls')).toBe(8 + 10 + 10);
    expect(tri(0, 'buildings_roofs')).toBe(2 + 4 + 4);
    expect(tri(0, 'roads')).toBe(4);
    expect(tri(0, 'water')).toBe(4);
    expect(tri(0, 'landuse')).toBe(2);
    expect(out.lods[0].triangles).toBe(48);
    expect(out.empty).toBe(false);
  });

  it('LOD1: kotak tanpa pelana, bangunan < 40 m² & jalan minor dibuang', () => {
    expect(tri(1, 'buildings_walls')).toBe(16);
    expect(tri(1, 'buildings_roofs')).toBe(4);
    expect(tri(1, 'roads')).toBe(2);
    expect(out.lods[1].triangles).toBe(28);
  });

  it('koordinat tile-lokal: semua posisi dalam ±260 m dari pusat tile', () => {
    for (const lod of out.lods) for (const m of Object.values(lod.meshes)) {
      if (!m) continue;
      for (let i = 0; i < m.positions.length; i += 3) {
        expect(Math.abs(m.positions[i])).toBeLessThanOrEqual(260);
        expect(Math.abs(m.positions[i + 2])).toBeLessThanOrEqual(260);
      }
    }
  });

  it('data.json v1: satuan 0,1 m tile-lokal, nama hanya untuk jalan berlabel', () => {
    const d = out.data;
    expect(d).toMatchObject({ v: 1, key: '0_0', ix: 0, iz: 0, center: [250, 250], unit: 0.1 });
    expect(d.buildings).toHaveLength(3);
    expect(d.buildings[0]).toEqual({ h: 96, ring: [-1600, -1550, -1400, -1550, -1400, -1450, -1600, -1450] });
    expect(d.roads).toEqual([
      { cls: 'primary', w: 140, pts: [-2500, -2300, -100, -2300], name: 'Jalan Uji Raya' },
      { cls: 'footway', w: 20, pts: [-1900, -2500, -1900, -1500] },
    ]);
    expect(d.water).toEqual([{ rings: [[1250, 1250, 1750, 1250, 1750, 1750, 1250, 1750]] }]);
    expect(d.waterways).toEqual([{ cls: 'stream', w: 40, pts: [1500, -1500, 2000, -1500] }]);
    for (const b of d.buildings) for (const v of b.ring) expect(Number.isInteger(v)).toBe(true);
    // ring bangunan selalu positif (signedArea > 0) walau sumber berorientasi terbalik
    const flipped = bakeTile({ ...TILE, buildings: [{ ...TILE.buildings[0], rings: [[...TILE.buildings[0].rings[0]].reverse()] }] });
    expect(flipped.data.buildings[0].ring).toEqual(d.buildings[0].ring);
  });

  it('landuse tumpang tindih: kelas prioritas rendah digambar dulu & lebih rendah', () => {
    const t = bakeTile({
      ix: 0, iz: 0, key: '0_0', buildings: [], roads: [], water: [], waterways: [],
      landuse: [
        feature('a-park', 'landuse', 'park', { rings: [rect(250, 250, 50, 50)] }),
        feature('z-res', 'landuse', 'residential', { rings: [rect(250, 250, 400, 400)] }),
      ],
    });
    const m = t.lods[0].meshes.landuse;
    const yOfTri = (k) => m.positions[3 * m.indices[3 * k] + 1];
    expect(yOfTri(0)).toBeCloseTo(0.02, 5); // residential (indeks prioritas 0) dulu
    expect(yOfTri(3)).toBeCloseTo(0.02 + 13 * 0.002, 5); // park (indeks 13) terakhir & di atas
  });

  it('tile tanpa fitur → empty', () => {
    const e = bakeTile({ ix: 5, iz: 5, key: '5_5', buildings: [], roads: [], water: [], waterways: [], landuse: [] });
    expect(e.empty).toBe(true);
    expect(e.lods[0].meshes.roads).toBeNull();
  });
});
