import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { polygonArea } from '../../src/geo/polygon.js';
import { prepareFeatures, resolveDistricts, runBake } from '../../tools/citybake/pipeline.js';

const OSM = JSON.parse(readFileSync(new URL('./fixtures/osm-mini.json', import.meta.url), 'utf8'));
const OVERTURE = JSON.parse(readFileSync(new URL('./fixtures/overture-mini.geojson', import.meta.url), 'utf8'));
const ORIGIN = { lat: 0.4835954, lon: 101.3895277 };
const AREAS = { uji: { id: 'uji', name: 'Area uji', center: ORIGIN, halfSize: 250 } };
// Distrik uji (dunia) x −160…−40, z −245…160: air 3001, bangunan 1003, Overture ov-b di dalam; jalan 2001 (z 20)
// menyilang; bangunan 1004 (−200, −200) di luar tetapi masuk excludeIds.
const DISTRICT = { id: 'uji-distrik', ring: [[-160, -245], [-40, -245], [-40, 160], [-160, 160]], excludeIds: new Set(['w1004']) };
const quietLog = { info: () => {}, warn: () => {}, error: () => {} };
const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });

describe('prepareFeatures dengan distrik', () => {
  const base = prepareFeatures({ rawOsm: OSM, overtureFc: OVERTURE, projection: proj, masks: [], districts: [] }).features;
  const { features } = prepareFeatures({ rawOsm: OSM, overtureFc: OVERTURE, projection: proj, masks: [], districts: [DISTRICT] });

  it('bangunan: centroid di dalam (1003, ov-b) & excludeIds (1004) dibuang', () => {
    const ids = features.filter((f) => f.kind === 'building').map((f) => f.id).sort();
    expect(ids).toEqual(['osm:relation/5001#0', 'osm:way/1001', 'osm:way/1002', 'overture:ov-d#0', 'overture:ov-d#1']);
  });

  it('air 3001 hilang; landuse 4001 jadi dua potongan, luas = asli − 120 × 30 m²', () => {
    expect(features.map((f) => f.id)).not.toContain('osm:way/3001');
    const lu = features.filter((f) => f.kind === 'landuse');
    expect(lu.map((f) => f.id)).toEqual(['osm:way/4001~c0', 'osm:way/4001~c1']);
    const before = polygonArea(base.find((f) => f.id === 'osm:way/4001').rings[0]);
    const after = lu.reduce((s, f) => s + polygonArea(f.rings[0]), 0);
    expect(Math.abs(before - after - 120 * 30)).toBeLessThan(5);
  });

  it('jalan 2001 terpotong tepat di x = −160 dan x = −40', () => {
    const parts = features.filter((f) => f.id.startsWith('osm:way/2001'));
    expect(parts.map((f) => f.id)).toEqual(['osm:way/2001~d0', 'osm:way/2001~d1']);
    expect(parts[0].line.at(-1)[0]).toBeCloseTo(-160, 6);
    expect(parts[1].line[0][0]).toBeCloseTo(-40, 6);
  });
});

describe('resolveDistricts', () => {
  it('excludeIds dari buildings.json; berkas tidak ada → Set kosong; excludeIds eksplisit dipakai apa adanya', async () => {
    const files = { 'a.json': JSON.stringify({ v: 1, buildings: [{ id: 'w1' }, { id: 'w2' }] }) };
    const read = async (p) => {
      if (files[p]) return files[p];
      const e = new Error('tidak ada');
      e.code = 'ENOENT';
      throw e;
    };
    const [a, b, c] = await resolveDistricts([
      { id: 'a', ring: [], buildingsFile: 'a.json' }, { id: 'b', ring: [], buildingsFile: 'b.json' }, DISTRICT,
    ], read);
    expect([...a.excludeIds]).toEqual(['w1', 'w2']);
    expect(b.excludeIds.size).toBe(0);
    expect(c).toBe(DISTRICT);
  });

  it('berkas rusak → galat jelas', async () => {
    await expect(resolveDistricts([{ id: 'a', ring: [], buildingsFile: 'x.json' }], async () => '{rusak'))
      .rejects.toThrow(/buildings distrik "a" rusak/);
  });
});

describe('runBake dengan distrik (data.json)', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'citybake-distrik-'));
    await runBake({
      areaIds: ['uji'], outDir: dir, cacheDir: join(dir, 'cache'), areas: AREAS, masks: [], districts: [DISTRICT],
      origin: ORIGIN, release: '2026-09-23.1', log: quietLog, loaders: { osm: async () => OSM, overture: async () => OVERTURE },
    });
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('tile -1_0: jalan utama dua potongan berujung di batas distrik; bangunan 1003 & ov-b hilang', async () => {
    const d = JSON.parse(await readFile(join(dir, '-1_0.data.json'), 'utf8'));
    const primary = d.roads.filter((r) => r.cls === 'primary');
    // Pusat tile -1_0 = (−250, 250); x tile-lokal 0,1 m: −240 → 100, −160 → 900 | −40 → 2100, 0 → 2500.
    expect(primary.map((r) => [r.pts[0], r.pts.at(-2)])).toEqual([[100, 900], [2100, 2500]]);
    expect(d.buildings).toEqual([]);
  });

  it('tile -1_-1: air 3001 & bangunan 1004 hilang', async () => {
    const d = JSON.parse(await readFile(join(dir, '-1_-1.data.json'), 'utf8'));
    expect(d.water).toEqual([]);
    expect(d.buildings).toEqual([]);
  });
});
