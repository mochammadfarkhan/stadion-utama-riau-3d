import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateManifest, validateTileData, decodeTileData } from '../../src/city/tileData.js';

const sample = () => ({
  v: 1, key: '0_-1', ix: 0, iz: -1, center: [250, -250], unit: 0.1,
  buildings: [{ h: 64, ring: [-1600, -1550, -1400, -1550, -1400, -1450, -1600, -1450] }],
  water: [{ rings: [[1250, 1250, 1750, 1250, 1750, 1750], [1400, 1400, 1450, 1400, 1450, 1450]] }],
  waterways: [{ cls: 'stream', w: 40, pts: [1500, -1500, 2000, -1500] }],
  roads: [{ cls: 'primary', w: 140, pts: [-2500, -2300, -100, -2300], name: 'Jalan Uji Raya' }, { cls: 'footway', w: 20, pts: [0, 0, 10, 10] }],
});

describe('validateTileData', () => {
  it('contoh kontrak Format tile v1 lolos', () => {
    expect(validateTileData(sample(), '0_-1')).toEqual({ ok: true });
  });

  it.each([
    ['versi', (d) => { d.v = 2; }, /versi/],
    ['kunci berbeda', (d) => { d.key = '1_-1'; }, /kunci|konsisten/],
    ['center salah', (d) => { d.center = [0, 0]; }, /center/],
    ['angka bukan bulat', (d) => { d.buildings[0].ring[0] = 1.5; }, /bangunan/],
    ['ring terlalu pendek', (d) => { d.buildings[0].ring = [0, 0, 1, 1]; }, /bangunan/],
    ['ring ganjil', (d) => { d.water[0].rings[0] = [0, 0, 1, 1, 2]; }, /air/],
    ['polyline pendek', (d) => { d.roads[0].pts = [0, 0]; }, /polyline/],
    ['lebar nol', (d) => { d.waterways[0].w = 0; }, /polyline/],
    ['array hilang', (d) => { delete d.roads; }, /roads/],
    ['unit 0,01', (d) => { d.unit = 0.01; }, /unit/],
    ['unit NaN', (d) => { d.unit = NaN; }, /unit/],
    ['tinggi NaN', (d) => { d.buildings[0].h = NaN; }, /bangunan/],
    ['koordinat NaN', (d) => { d.roads[0].pts[1] = NaN; }, /polyline/],
    ['bangunan null', (d) => { d.buildings.push(null); }, /bangunan/],
    ['air null', (d) => { d.water.push(null); }, /air/],
    ['jalan null', (d) => { d.roads.push(null); }, /polyline/],
    ['nama jalan angka', (d) => { d.roads[0].name = 42; }, /nama jalan/],
    ['nama jalan null', (d) => { d.roads[0].name = null; }, /nama jalan/],
  ])('%s → ditolak', (_, mutate, re) => {
    const d = sample();
    mutate(d);
    const r = validateTileData(d, '0_-1');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(re);
  });

  it('bukan objek → ditolak', () => {
    expect(validateTileData(null).ok).toBe(false);
  });

  it('pesan galat versi/unit memperlihatkan tipe nilai (JSON)', () => {
    expect(validateTileData({ ...sample(), v: '1' }).error).toContain('"1"');
    expect(validateTileData({ ...sample(), unit: '0.1' }).error).toContain('"0.1"');
  });

  it('semua data.json hasil bake di public/tiles lolos validasi', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    for (const t of m.tiles) {
      const d = JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8'));
      expect(validateTileData(d, t.key), t.key).toEqual({ ok: true });
    }
  });
});

describe('decodeTileData', () => {
  it('tile-lokal 0,1 m → dunia (meter); lubang air dipisah; nama jalan opsional', () => {
    const t = decodeTileData(sample());
    expect(t.center).toEqual({ x: 250, z: -250 });
    expect(t.buildings[0].height).toBeCloseTo(6.4, 9);
    expect(t.buildings[0].ring[0]).toEqual([250 - 160, -250 - 155]);
    expect(t.water[0].outer).toHaveLength(3);
    expect(t.water[0].holes).toHaveLength(1);
    expect(t.roads[0]).toMatchObject({ cls: 'primary', name: 'Jalan Uji Raya' });
    expect(t.roads[0].width).toBeCloseTo(14, 9);
    expect(t.roads[1].name).toBeNull();
    expect(t.waterways[0].pts[1]).toEqual([250 + 200, -250 - 150]);
  });
});

describe('validateManifest', () => {
  it('manifest hasil bake lolos; versi/format/ukuran/entri salah ditolak', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(validateManifest(m)).toEqual({ ok: true });
    expect(validateManifest({ ...m, version: 2 }).ok).toBe(false);
    expect(validateManifest({ ...m, format: 'x' }).ok).toBe(false);
    expect(validateManifest({ ...m, tileSize: 250 }).ok).toBe(false);
    expect(validateManifest({ ...m, tiles: [{ ...m.tiles[0], key: '9_9' }] }).error).toMatch(/entri tile/);
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest({ ...m, tiles: null }).ok).toBe(false);
  });

  it('unit ≠ 0,1, unit NaN, dan entri null ditolak', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(validateManifest({ ...m, unit: 1 }).error).toMatch(/unit/);
    expect(validateManifest({ ...m, unit: NaN }).error).toMatch(/unit/);
    expect(validateManifest({ ...m, tiles: [...m.tiles, null] }).error).toMatch(/entri tile/);
  });

  it('pesan galat versi/unit memperlihatkan tipe nilai (JSON)', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(validateManifest({ ...m, version: '1' }).error).toContain('"1"');
    expect(validateManifest({ ...m, unit: '0.1' }).error).toContain('"0.1"');
  });

  it('key tile ganda ditolak', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(validateManifest({ ...m, tiles: [...m.tiles, m.tiles[0]] }).error).toMatch(/ganda/);
  });

  it('nama file yang tidak cocok dengan key ditolak (cegah path traversal)', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    const t = m.tiles[0];
    const withTile = (patch) => ({ ...m, tiles: [{ ...t, ...patch }, ...m.tiles.slice(1)] });
    expect(validateManifest(withTile({ data: { ...t.data, file: '../../x' } })).error).toMatch(/entri tile/);
    expect(validateManifest(withTile({ data: { ...t.data, file: `${m.tiles[1].key}.data.json` } })).error).toMatch(/entri tile/);
    expect(validateManifest(withTile({ lod: [t.lod[0], { ...t.lod[1], file: `${t.key}.lod0.glb` }] })).error).toMatch(/entri tile/);
    expect(validateManifest(withTile({ lod: [{ ...t.lod[0], file: '../../x.glb' }, t.lod[1]] })).error).toMatch(/entri tile/);
  });
});
