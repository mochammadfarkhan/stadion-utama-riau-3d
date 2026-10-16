import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBake } from '../../tools/citybake/pipeline.js';
import { readGlbSummary } from '../../tools/citybake/glb.js';
import { validateManifest } from '../../tools/citybake/manifest.js';

const OSM = JSON.parse(readFileSync(new URL('./fixtures/osm-mini.json', import.meta.url), 'utf8'));
const OVERTURE = JSON.parse(readFileSync(new URL('./fixtures/overture-mini.geojson', import.meta.url), 'utf8'));
const ORIGIN = { lat: 0.4835954, lon: 101.3895277 };
const AREAS = { uji: { id: 'uji', name: 'Area uji', center: ORIGIN, halfSize: 250 } };
// Mask uji (koordinat dunia): persegi 30 m di (-200, -200) → bangunan way 1004 dibuang.
const MASKS = [{ id: 'uji', ring: [[-215, -215], [-185, -215], [-185, -185], [-215, -185]] }];
const quietLog = { info: () => {}, warn: () => {}, error: () => {} };

let dir;
let result;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'citybake-golden-'));
  result = await runBake({
    areaIds: ['uji'], outDir: dir, cacheDir: join(dir, 'cache'), areas: AREAS, masks: MASKS, origin: ORIGIN,
    release: '2026-09-23.1', log: quietLog,
    loaders: { osm: async () => OSM, overture: async () => OVERTURE },
  });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('golden citybake (fixture mini)', () => {
  it('manifest valid, 4 tile urut iz lalu ix, atribusi area', async () => {
    const m = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    expect(validateManifest(m)).toEqual([]);
    expect(m.tiles.map((t) => t.key)).toEqual(['-1_-1', '0_-1', '-1_0', '0_0']);
    expect(m.areas).toEqual([{
      id: 'uji', name: 'Area uji', bounds: { minX: -250, minZ: -250, maxX: 250, maxZ: 250 },
      osmTimestamp: '2026-10-16T00:00:00Z', overtureRelease: '2026-09-23.1', tiles: ['-1_-1', '0_-1', '-1_0', '0_0'],
    }]);
    expect(result.stats.uji).toEqual({ osm: 5, overtureKept: 3, droppedOsmSource: 1, droppedOverlap: 1, tiles: 4 });
    const attribution = await readFile(join(dir, 'ATTRIBUTION.txt'), 'utf8');
    expect(attribution).toContain('© OpenStreetMap contributors');
  });

  it('file per tile lengkap dan ukurannya cocok dengan manifest', async () => {
    const files = (await readdir(dir)).filter((f) => f !== 'cache').sort();
    expect(files).toEqual([
      '-1_-1.data.json', '-1_-1.lod0.glb', '-1_-1.lod1.glb', '-1_0.data.json', '-1_0.lod0.glb', '-1_0.lod1.glb',
      '0_-1.data.json', '0_-1.lod0.glb', '0_-1.lod1.glb', '0_0.data.json', '0_0.lod0.glb', '0_0.lod1.glb',
      'ATTRIBUTION.txt', 'manifest.json',
    ]);
    for (const t of result.manifest.tiles) {
      for (const l of t.lod) expect((await readFile(join(dir, l.file))).byteLength).toBe(l.bytes);
      expect((await readFile(join(dir, t.data.file))).byteLength).toBe(t.data.bytes);
    }
  });

  it('jumlah segitiga per tile/LOD stabil', () => {
    const tri = Object.fromEntries(result.manifest.tiles.map((t) => [t.key, t.lod.map((l) => l.triangles)]));
    // -1_-1: air 2 + landuse 2. -1_0: 1003 (144 m²) & ov-b (63 m²) pelana 14+14, primary 2;
    //   LOD1 kotak 10+10 + 2. 0_-1: relasi 5001 berlubang 16+8, footway 2, stream 2, landuse 2;
    //   LOD1 ring luar saja 8+2, tanpa footway. 0_0: lihat tes berikut.
    expect(tri).toEqual({ '-1_-1': [4, 4], '0_-1': [30, 14], '-1_0': [30, 22], '0_0': [56, 22] });
  });

  it('tile 0_0: node GLB & segitiga per mesh (dihitung tangan)', async () => {
    const lod0 = await readGlbSummary(await readFile(join(dir, '0_0.lod0.glb')));
    expect(lod0.scene).toBe('tile_0_0_lod0');
    // 1001 datar (8+2), 1002 pelana (10+4), ov-d#0/#1 pelana (10+4 masing-masing); jalan primary+footway (2+2)
    expect(lod0.nodes.map((n) => [n.name, n.triangles])).toEqual([
      ['roads', 4], ['buildings_walls', 38], ['buildings_roofs', 14],
    ]);
    const lod1 = await readGlbSummary(await readFile(join(dir, '0_0.lod1.glb')));
    // ov-d (36 m²) dibuang, 1002 jadi kotak; footway dibuang
    expect(lod1.nodes.map((n) => [n.name, n.triangles])).toEqual([
      ['roads', 2], ['buildings_walls', 16], ['buildings_roofs', 4],
    ]);
  });

  it('tile -1_-1: mask membuang bangunan 1004; air + landuse terpotong tile', async () => {
    const d = JSON.parse(await readFile(join(dir, '-1_-1.data.json'), 'utf8'));
    expect(d.buildings).toEqual([]);
    expect(d.water).toHaveLength(1);
    const lod0 = await readGlbSummary(await readFile(join(dir, '-1_-1.lod0.glb')));
    expect(lod0.nodes.map((n) => n.name)).toEqual(['landuse', 'water']);
  });

  it('data.json 0_0: tinggi dari building:levels, nama jalan utama, angka bulat 0,1 m', async () => {
    const d = JSON.parse(await readFile(join(dir, '0_0.data.json'), 'utf8'));
    expect(d).toMatchObject({ v: 1, key: '0_0', center: [250, 250], unit: 0.1 });
    expect(d.buildings.map((b) => b.h)).toContain(96);
    expect(d.roads.find((r) => r.cls === 'primary')).toMatchObject({ name: 'Jalan Uji Raya', w: 140 });
    expect(d.roads.find((r) => r.cls === 'footway').name).toBeUndefined();
    const nums = [...d.buildings.flatMap((b) => b.ring), ...d.roads.flatMap((r) => r.pts)];
    expect(nums.every(Number.isInteger)).toBe(true);
  });

  it('bake ulang deterministik: manifest identik', async () => {
    const again = await runBake({
      areaIds: ['uji'], outDir: dir, cacheDir: join(dir, 'cache'), areas: AREAS, masks: MASKS, origin: ORIGIN,
      release: '2026-09-23.1', log: quietLog, loaders: { osm: async () => OSM, overture: async () => OVERTURE },
    });
    expect(again.manifest).toEqual(result.manifest);
  });
});
