import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjection } from '../../src/geo/projection.js';
import {
  bakeBuildingsData, dropDuplicates, levelsOf, nearestRoadFront, roadsFromGround, runBuildingsBake, serializeBuildings, summarize,
} from '../../tools/campusbake/buildings.js';
import { validateBuildingsData } from '../../src/districts/unri/buildingsFormat.js';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const OSM = JSON.parse(readFileSync(join(FIX, 'osm-buildings-mini.json'), 'utf8'));
const proj = createProjection({ lat0: 0.4835954, lon0: 101.3895277 });
const project = (lat, lon) => proj.toWorld(lat, lon);
const BOUNDARY = [[-300, -300], [300, -300], [300, 300], [-300, 300]];
const ROADS = [{ pts: [[-200, 30], [200, 30]] }];
const quiet = { info: () => {}, warn: () => {} };

describe('campusbake buildings (fixture mini)', () => {
  const data = bakeBuildingsData({ elements: OSM.elements, project, boundary: BOUNDARY, roads: ROADS });

  it('gedung: way, relation berlubang, tersirat; ganda/lapangan/kawasan/luar batas dibuang; urut id', () => {
    expect(data.buildings.map((b) => b.id)).toEqual(['r2001', 'w1001', 'w1002', 'w3001']);
    expect(validateBuildingsData(data)).toEqual([]);
    expect(summarize(data)).toEqual({ buildings: 4, clusters: 2, implied: 1, relations: 1, withoutFront: 1 });
  });

  it('w1001: ring terkuantisasi 0,1 m, level, cluster, luas, front ke jalan di z = 30', () => {
    expect(data.buildings[1]).toEqual({
      id: 'w1001', ring: [[-20, -6], [20, -6], [20, 6], [-20, 6]], levels: 1,
      tags: { name: 'Gedung A FKIP', building: 'yes', amenity: 'university', 'building:levels': '1' },
      cluster: '0_0', area: 480, front: [0, 1],
    });
  });

  it('rentang "4-7" → 4; relation simpan lubang & front ke selatan-utara; tersirat bertag building=implied', () => {
    expect(data.buildings[2].levels).toBe(4);
    expect(data.buildings[0]).toMatchObject({ cluster: '-1_0', area: 1600, front: [0, -1] });
    expect(data.buildings[0].holes).toHaveLength(1);
    expect(data.buildings[3]).toMatchObject({ tags: { building: 'implied', name: 'Integrated Classroom Uji', amenity: 'university' }, front: null, area: 600 });
  });

  it('serialisasi deterministik (bake dua kali → byte identik), satu gedung per baris', () => {
    const again = bakeBuildingsData({ elements: OSM.elements, project, boundary: BOUNDARY, roads: ROADS });
    const a = serializeBuildings(data);
    expect(serializeBuildings(again)).toBe(a);
    expect(a.split('\n')).toHaveLength(data.buildings.length + 3);
    expect(JSON.parse(a)).toEqual(data);
  });

  it('helper murni', () => {
    expect(levelsOf('4-7')).toBe(4);
    expect(levelsOf(undefined)).toBeNull();
    expect(nearestRoadFront(0, 0, ROADS)).toEqual([0, 1]);
    expect(nearestRoadFront(0, 200, ROADS)).toBeNull();
    const d = dropDuplicates([{ id: 'w5', ring: BOUNDARY, holes: [] }, { id: 'r1', ring: BOUNDARY, holes: [[[0, 0], [1, 0], [1, 1]]] }]);
    expect(d.dropped).toEqual(['w5']);
  });

  it('runBuildingsBake: baca cache OSM + ground (M2), tulis buildings.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'campusbake-gedung-'));
    try {
      await mkdir(join(root, 'data-src', 'osm'), { recursive: true });
      await writeFile(join(root, 'data-src', 'osm', 'stadion.json'), JSON.stringify(OSM));
      await mkdir(join(root, 'public', 'districts', 'unri'), { recursive: true });
      await cp(join(FIX, 'ground'), join(root, 'public', 'districts', 'unri', 'ground'), { recursive: true });
      expect(await roadsFromGround(join(root, 'public', 'districts', 'unri', 'ground'), quiet)).toEqual([{ pts: [[-200, 30], [200, 30]] }]);
      const res = await runBuildingsBake({ root, boundary: BOUNDARY, project, synthetic: [], log: quiet });
      const text = await readFile(join(root, 'public', 'districts', 'unri', 'buildings.json'), 'utf8');
      expect(text).toBe(serializeBuildings(data));
      expect(res.bytes).toBe(text.length);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('tanpa cache OSM → galat jelas berisi langkah', async () => {
    const root = await mkdtemp(join(tmpdir(), 'campusbake-kosong-'));
    try {
      await expect(runBuildingsBake({ root, boundary: BOUNDARY, project, log: quiet })).rejects.toThrow(/npm run bake -- --area stadion/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
