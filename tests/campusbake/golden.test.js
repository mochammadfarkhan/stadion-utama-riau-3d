import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTerrain, parseCli, main } from '../../tools/campusbake/cli.js';
import { SRTM, TERRAIN, ORIGIN } from '../../tools/campusbake/config.js';
import { createProjection } from '../../src/geo/projection.js';
import { decodeChunk, createHeightField } from '../../src/geo/terrain/heightfield.js';
import { pointInPolygon } from '../../src/geo/polygon.js';

/** DEM sintetis 1201² (3″): bukit & lembah bilangan bulat meter (seperti SRTM). */
function demBytes() {
  const size = 1201;
  const bytes = new Uint8Array(size * size * 2);
  const view = new DataView(bytes.buffer);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) view.setInt16((r * size + c) * 2, Math.round(30 + 4 * Math.sin(c / 9) + 3 * Math.cos(r / 13)), false);
  }
  return bytes;
}

const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });
const geom = (pts) => pts.map(([x, z]) => {
  const p = proj.toLatLon(x, z);
  return { lat: p.lat, lon: p.lon };
});
const closed = (pts) => [...pts, pts[0]];
/** Batas uji 600 × 600 m di area kampus (dunia). */
const BOUNDARY = [[-900, 600], [-300, 600], [-300, 1200], [-900, 1200]];
const OSM = {
  osm3s: { timestamp_osm_base: '2026-10-17T00:00:00Z' },
  elements: [
    { type: 'way', id: 11, tags: { highway: 'tertiary', name: 'Jalan Uji' }, geometry: geom([[-950, 900], [-600, 880], [-250, 920]]) },
    { type: 'way', id: 12, tags: { highway: 'service' }, geometry: geom([[-600, 880], [-610, 700]]) },
    { type: 'way', id: 13, tags: { building: 'university', name: 'Gedung Uji' }, geometry: geom(closed([[-500, 1000], [-460, 1000], [-460, 1030], [-500, 1030]])) },
    { type: 'way', id: 373856980, tags: { natural: 'water', water: 'reservoir' }, geometry: geom(closed([[-800, 700], [-720, 700], [-720, 780], [-800, 780]])) },
  ],
};
const quiet = { info() {}, warn() {}, error() {} };
const opts = (outDir) => ({
  outDir, cacheDir: join(outDir, 'cache'), offline: true, log: quiet, boundary: BOUNDARY, mask: null, srtm: SRTM,
  loaders: { dem: async () => demBytes(), osm: async () => OSM }, now: () => 0,
});

async function hashes(dir) {
  const out = {};
  for (const sub of ['', 'terrain']) {
    for (const f of (await readdir(join(dir, sub), { withFileTypes: true })).filter((e) => e.isFile())) {
      out[join(sub, f.name)] = createHash('sha256').update(await readFile(join(dir, sub, f.name))).digest('hex');
    }
  }
  return out;
}

let dirA;
let dirB;
let first;

beforeAll(async () => {
  dirA = await mkdtemp(join(tmpdir(), 'campus-a-'));
  dirB = await mkdtemp(join(tmpdir(), 'campus-b-'));
  first = await runTerrain(opts(dirA));
  await runTerrain(opts(dirB));
}, 120000);

afterAll(async () => {
  await rm(dirA, { recursive: true, force: true });
  await rm(dirB, { recursive: true, force: true });
});

describe('golden campusbake terrain (DEM & OSM sintetis, --offline)', () => {
  it('dua kali bake → byte identik (hash semua file)', async () => {
    const a = await hashes(dirA);
    expect(Object.keys(a).sort()).toEqual(['ATTRIBUTION.txt', 'manifest.json', ...first.manifest.terrain.chunks.map((k) => join('terrain', `${k}.bin`))].sort());
    expect(await hashes(dirB)).toEqual(a);
  });

  it('manifest: format distrik, header terrain, chunk urut iz lalu ix, muka air danau', () => {
    const t = first.manifest.terrain;
    expect(first.manifest).toMatchObject({ format: 'unri-district', version: 1, ground: { chunks: [] }, buildings: 'buildings.json', attribution: 'ATTRIBUTION.txt' });
    expect(t).toMatchObject({ format: 'unri-terrain', version: 1, size: 500, step: 4, n: 126, unit: 0.01, bias: -5000 });
    expect(t.chunks).toEqual(['-2_1', '-1_1', '-2_2', '-1_2']);
    expect(t.water).toHaveLength(1);
    expect(t.water[0].id).toBe('w373856980');
    expect(t.water[0].bed).toBeCloseTo(t.water[0].level - TERRAIN.water.depth, 6);
  });

  it('heightfield hasil: 0 tepat di luar batas, bervariasi di dalam, tanjakan jalan ≤ 7% (laporan)', async () => {
    const field = createHeightField();
    for (const key of first.manifest.terrain.chunks) {
      const b = await readFile(join(dirA, 'terrain', `${key}.bin`));
      field.add(decodeChunk(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { ...first.manifest.terrain, key }));
    }
    let outside = 0;
    let inside = 0;
    for (let x = -1000; x <= -200; x += 10) {
      for (let z = 500; z <= 1300; z += 10) {
        if (!pointInPolygon(x, z, BOUNDARY)) {
          expect(field.heightAt(x, z)).toBe(0);
          outside += 1;
        } else if (Math.abs(field.heightAt(x, z)) > 0.05) inside += 1;
      }
    }
    expect(outside).toBeGreaterThan(1000);
    expect(inside).toBeGreaterThan(500);
    expect(first.report.summary.steep).toBe(0);
    expect(first.report.summary.roads).toBe(2);
  });

  it('ATTRIBUTION menyebut SRTM & OSM', async () => {
    const text = await readFile(join(dirA, 'ATTRIBUTION.txt'), 'utf8');
    expect(text).toContain('SRTM');
    expect(text).toContain('© OpenStreetMap contributors');
  });
});

describe('CLI campusbake', () => {
  it('parseCli: perintah & opsi', () => {
    expect(parseCli(['terrain', '--offline'])).toEqual({ command: 'terrain', offline: true, outDir: 'public/districts/unri', cacheDir: 'data-src' });
    expect(() => parseCli([])).toThrow(/perintah tidak dikenal/);
    expect(() => parseCli(['peta'])).toThrow(/perintah tidak dikenal/);
  });
  it('ground/buildings belum tersedia → exit 2; argumen salah → exit 2', async () => {
    const errors = [];
    const log = { info() {}, warn() {}, error: (m) => errors.push(m) };
    expect(await main(['ground'], log)).toBe(2);
    expect(await main(['--offline'], log)).toBe(2);
    expect(errors[0]).toMatch(/M2\/M3/);
  });
});
