import { describe, it, expect } from 'vitest';
import {
  createManifest, assertCompatible, tileEntry, tileFiles, upsertArea, validateManifest, attributionText,
} from '../../tools/citybake/manifest.js';
import { summarize } from '../../tools/citybake/report.js';

const ORIGIN = { lat: 0.4835954, lon: 101.3895277 };
const entry = (key, ix, iz, area, lod0 = 1000) =>
  tileEntry({ key, ix, iz, area, bytes: { lod0, lod1: 400, data: 100 }, triangles: [50, 20] });
const area = (id, tiles) => ({ id, name: `Area ${id}`, bounds: { minX: 0, minZ: 0, maxX: 1, maxZ: 1 }, osmTimestamp: '2026-10-16T00:00:00Z', overtureRelease: null, tiles });

describe('manifest', () => {
  it('createManifest & tileFiles', () => {
    const m = createManifest({ origin: ORIGIN, tileSize: 500 });
    expect(m).toMatchObject({ version: 1, tileSize: 500, unit: 0.1, origin: ORIGIN, areas: [], tiles: [] });
    expect(tileFiles('-1_2')).toEqual({ lod0: '-1_2.lod0.glb', lod1: '-1_2.lod1.glb', data: '-1_2.data.json' });
  });

  it('tileEntry: bytes = jumlah file, lod berurutan', () => {
    expect(entry('0_0', 0, 0, 'a')).toEqual({
      key: '0_0', ix: 0, iz: 0, area: 'a', bytes: 1500,
      lod: [
        { level: 0, file: '0_0.lod0.glb', bytes: 1000, triangles: 50 },
        { level: 1, file: '0_0.lod1.glb', bytes: 400, triangles: 20 },
      ],
      data: { file: '0_0.data.json', bytes: 100 },
    });
  });

  it('upsertArea mengganti tile area yang sama, mempertahankan area lain, urut iz lalu ix', () => {
    let m = createManifest({ origin: ORIGIN, tileSize: 500 });
    m = upsertArea(m, area('a', [entry('1_0', 1, 0, 'a'), entry('0_0', 0, 0, 'a')]));
    m = upsertArea(m, area('b', [entry('9_-9', 9, -9, 'b')]));
    m = upsertArea(m, area('a', [entry('0_0', 0, 0, 'a')]));
    expect(m.tiles.map((t) => t.key)).toEqual(['9_-9', '0_0']);
    expect(m.areas.map((a) => [a.id, a.tiles])).toEqual([['a', ['0_0']], ['b', ['9_-9']]]);
    expect(validateManifest(m)).toEqual([]);
  });

  it('validateManifest menangkap kesalahan', () => {
    const m = createManifest({ origin: ORIGIN, tileSize: 500 });
    const bad = { ...m, tiles: [{ ...entry('0_0', 0, 1, 'a'), bytes: 1 }] };
    expect(validateManifest(bad)).toEqual(['key 0_0 tidak cocok dengan ix/iz', '0_0: bytes 1 ≠ jumlah file 1500']);
  });

  it('assertCompatible menolak origin berbeda', () => {
    const a = createManifest({ origin: ORIGIN, tileSize: 500 });
    expect(() => assertCompatible(a, a)).not.toThrow();
    expect(() => assertCompatible(a, createManifest({ origin: { lat: 0, lon: 0 }, tileSize: 500 }))).toThrow(/hapus public\/tiles/);
  });

  it('attributionText menyebut OSM, Overture, ODbL, dan area', () => {
    const m = upsertArea(createManifest({ origin: ORIGIN, tileSize: 500 }), area('a', [entry('0_0', 0, 0, 'a')]));
    const t = attributionText(m);
    for (const s of ['© OpenStreetMap contributors', 'Overture Maps Foundation', 'ODbL', 'Area a (a)', 'tanpa Overture']) expect(t).toContain(s);
  });
});

describe('summarize', () => {
  it('baris per tile + peringatan anggaran', () => {
    let m = createManifest({ origin: ORIGIN, tileSize: 500 });
    m = upsertArea(m, area('a', [entry('0_0', 0, 0, 'a', 400 * 1024), entry('1_0', 1, 0, 'a')]));
    const r = summarize(m, ['a'], { tileBytes: 300 * 1024, totalBytes: 100 * 1024 });
    expect(r.lines[0]).toMatch(/^Area a: 2 tile/);
    expect(r.lines).toHaveLength(4);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/^tile 0_0: LOD0\+data/);
    expect(r.warnings[1]).toMatch(/^total/);
  });
});
