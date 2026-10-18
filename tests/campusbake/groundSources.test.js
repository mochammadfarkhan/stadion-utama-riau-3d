import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { N } from '../../src/geo/terrain/format.js';
import { chunkHeader, loadOsmSource, loadTerrainField, projectOsm } from '../../tools/campusbake/ground/sources.js';

const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
const LL = (x, z) => { const p = proj.toLatLon(x, z); return { lat: p.lat, lon: p.lon }; };

describe('chunkHeader', () => {
  it('header chunk dari kunci (spec §4.1)', () => {
    expect(chunkHeader('-2_1')).toEqual({
      key: '-2_1', ix: -2, iz: 1, origin: { x: -1000, z: 500 }, size: 500, step: 4, n: 126, unit: 0.01, bias: -5000,
    });
    expect(() => chunkHeader('x')).toThrow(/tidak valid/);
  });
});

describe('projectOsm', () => {
  it('fitur citybake terproyeksi + plaza dari highway=pedestrian area=yes', () => {
    const raw = {
      osm3s: { timestamp_osm_base: '2026-10-17T00:00:00Z' },
      elements: [
        { type: 'way', id: 1, tags: { highway: 'tertiary' }, geometry: [LL(0, 0), LL(100, 0)] },
        { type: 'way', id: 2, tags: { highway: 'pedestrian', area: 'yes' }, geometry: [LL(0, 0), LL(20, 0), LL(20, 20), LL(0, 20), LL(0, 0)] },
      ],
    };
    const { features, plazas, timestamp } = projectOsm(raw, proj);
    expect(timestamp).toBe('2026-10-17T00:00:00Z');
    expect(features.map((f) => f.id)).toEqual(['osm:way/1']);
    expect(features[0].line[1][0]).toBeCloseTo(100, 3);
    expect(plazas).toHaveLength(1);
    expect(plazas[0].id).toBe('osm:way/2');
    expect(plazas[0].rings[0]).toHaveLength(4);
  });
});

describe('loadOsmSource / loadTerrainField', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'campusbake-src-'));
    await mkdir(join(dir, 'terrain'), { recursive: true });
    const u16 = new Uint16Array(N * N).fill(5100); // y = (5100 − 5000) × 0,01 = 1 m
    await writeFile(join(dir, 'terrain', '0_0.bin'), Buffer.from(u16.buffer));
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ format: 'unri-district', version: 1, terrain: { chunks: ['0_0'] } }));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('heightfield dari berkas .bin + manifest', async () => {
    const { keys, field } = await loadTerrainField(dir);
    expect(keys).toEqual(['0_0']);
    expect(field.heightAt(250, 250)).toBeCloseTo(1, 6);
  });

  it('cache OSM tidak ada → galat berisi langkah perbaikan', async () => {
    await expect(loadOsmSource(join(dir, 'tidak-ada.json'))).rejects.toThrow(/npm run bake -- --area unri/);
  });

  it('manifest tanpa terrain.chunks → galat jelas', async () => {
    const d2 = await mkdtemp(join(tmpdir(), 'campusbake-src2-'));
    await writeFile(join(d2, 'manifest.json'), JSON.stringify({ terrain: { chunks: [] } }));
    await expect(loadTerrainField(d2)).rejects.toThrow(/terrain.chunks/);
    await rm(d2, { recursive: true, force: true });
  });
});
