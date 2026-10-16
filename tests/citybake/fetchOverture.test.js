import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildOvertureSql, rowsToGeoJSON, normalizeOverture, loadOverture, overtureCachePath,
} from '../../tools/citybake/fetchOverture.js';

const FC = JSON.parse(readFileSync(new URL('./fixtures/overture-mini.geojson', import.meta.url), 'utf8'));
const BBOX = { south: 0.47, west: 101.37, north: 0.49, east: 101.4 };
const quietLog = { info: () => {}, warn: vi.fn() };

describe('buildOvertureSql', () => {
  it('path rilis S3, predikat bbox irisan, kolom yang dibutuhkan', () => {
    const sql = buildOvertureSql(BBOX, '2026-09-23.1');
    expect(sql).toContain("s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building/*");
    expect(sql).toContain('bbox.xmin <= 101.4000000 AND bbox.xmax >= 101.3700000');
    expect(sql).toContain('bbox.ymin <= 0.4900000 AND bbox.ymax >= 0.4700000');
    for (const col of ['height', 'num_floors', 'subtype', 'class', 'ST_AsGeoJSON(geometry)', 'sources[1].dataset']) {
      expect(sql).toContain(col);
    }
  });
});

describe('rowsToGeoJSON', () => {
  it('mengurai kolom geojson string; baris rusak dilewati', () => {
    const fc = rowsToGeoJSON([
      { id: 'a', height: 5, geojson: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}' },
      { id: 'b', geojson: '{rusak' },
      { id: 'c', geojson: null },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties).toEqual({ id: 'a', height: 5 });
    expect(fc.features[0].geometry.type).toBe('Polygon');
  });
});

describe('normalizeOverture (fixture)', () => {
  const feats = normalizeOverture(FC);

  it('MultiPolygon dipecah, id berawalan overture:, urut', () => {
    expect(feats.map((f) => f.id)).toEqual(['overture:ov-a', 'overture:ov-b', 'overture:ov-c', 'overture:ov-d#0', 'overture:ov-d#1']);
  });

  it('properti → tag gaya OSM', () => {
    const b = feats.find((f) => f.id === 'overture:ov-b');
    expect(b).toMatchObject({ source: 'overture', kind: 'building', cls: 'house' });
    expect(b.tags).toMatchObject({ building: 'house', height: '7.5', 'overture:subtype': 'residential', 'overture:dataset': 'Google Open Buildings' });
    const d = feats.find((f) => f.id === 'overture:ov-d#1');
    expect(d.tags).toMatchObject({ building: 'yes', 'building:levels': '2', name: 'Ruko Uji' });
    expect(d.rings[0]).toHaveLength(4);
  });

  it('input tak valid → TypeError', () => {
    expect(() => normalizeOverture(null)).toThrow(TypeError);
  });
});

describe('loadOverture', () => {
  it('query via koneksi tiruan → cache; panggilan kedua dari cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-ov-'));
    try {
      const rows = [{ id: 'x', src: 'Microsoft ML Buildings', geojson: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}' }];
      const connection = { runAndReadAll: vi.fn(async () => ({ getRowObjectsJson: () => rows })), closeSync: vi.fn() };
      const connect = vi.fn(async () => connection);
      const a = await loadOverture('uji', BBOX, { cacheDir: dir, connect, log: quietLog });
      const b = await loadOverture('uji', BBOX, { cacheDir: dir, connect, log: quietLog });
      expect(a.features).toHaveLength(1);
      expect(b).toEqual(a);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(JSON.parse(await readFile(overtureCachePath(dir, 'uji'), 'utf8')).features).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('DuckDB gagal → null + peringatan (fallback OSM saja)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-ov-'));
    try {
      const warn = vi.fn();
      const fc = await loadOverture('uji', BBOX, {
        cacheDir: dir, connect: async () => { throw new Error('S3 timeout'); }, log: { info: () => {}, warn },
      });
      expect(fc).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Overture gagal \(S3 timeout\)/));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  const ROWS = [{ id: 'x', src: 'Microsoft ML Buildings', geojson: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}' }];
  const fakeConnection = () => ({ runAndReadAll: vi.fn(async () => ({ getRowObjectsJson: () => ROWS })), closeSync: vi.fn() });
  const withDir = async (fn) => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-ov-'));
    try {
      await fn(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
  const seedCache = async (dir, content) => {
    await mkdir(join(dir, 'overture'), { recursive: true });
    await writeFile(overtureCachePath(dir, 'uji'), JSON.stringify(content));
  };

  it('hasil query menyimpan release; koneksi ditutup', async () => {
    await withDir(async (dir) => {
      const connection = fakeConnection();
      const fc = await loadOverture('uji', BBOX, { cacheDir: dir, release: 'R1', connect: async () => connection, log: quietLog });
      expect(fc.release).toBe('R1');
      expect(connection.closeSync).toHaveBeenCalledTimes(1);
      expect(JSON.parse(await readFile(overtureCachePath(dir, 'uji'), 'utf8')).release).toBe('R1');
    });
  });

  it('cache rilis lain (online) → query ulang & cache ditimpa', async () => {
    await withDir(async (dir) => {
      await seedCache(dir, { type: 'FeatureCollection', features: [], release: 'LAMA' });
      const connect = vi.fn(async () => fakeConnection());
      const fc = await loadOverture('uji', BBOX, { cacheDir: dir, release: 'BARU', connect, log: quietLog });
      expect(connect).toHaveBeenCalledTimes(1);
      expect(fc).toMatchObject({ release: 'BARU' });
      expect(fc.features).toHaveLength(1);
      expect(JSON.parse(await readFile(overtureCachePath(dir, 'uji'), 'utf8')).release).toBe('BARU');
    });
  });

  it('cache rilis lain (offline) → null + peringatan, tanpa koneksi', async () => {
    await withDir(async (dir) => {
      await seedCache(dir, { type: 'FeatureCollection', features: [], release: 'LAMA' });
      const connect = vi.fn();
      const warn = vi.fn();
      const fc = await loadOverture('uji', BBOX, { cacheDir: dir, offline: true, release: 'BARU', connect, log: { info: () => {}, warn } });
      expect(fc).toBeNull();
      expect(connect).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/LAMA ≠ BARU/));
    });
  });

  it('cache tanpa "features" → peringatan (hapus file) & diperlakukan miss', async () => {
    await withDir(async (dir) => {
      await seedCache(dir, { type: 'FeatureCollection', release: 'R1' });
      const warn = vi.fn();
      const log = { info: () => {}, warn };
      expect(await loadOverture('uji', BBOX, { cacheDir: dir, offline: true, release: 'R1', log })).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/tidak valid.*hapus file/));
      const connect = vi.fn(async () => fakeConnection());
      const fc = await loadOverture('uji', BBOX, { cacheDir: dir, release: 'R1', connect, log });
      expect(connect).toHaveBeenCalledTimes(1);
      expect(fc.features).toHaveLength(1);
    });
  });

  it('runAndReadAll gagal → closeSync tetap dipanggil, null', async () => {
    await withDir(async (dir) => {
      const connection = { runAndReadAll: vi.fn(async () => { throw new Error('query gagal'); }), closeSync: vi.fn() };
      const fc = await loadOverture('uji', BBOX, { cacheDir: dir, connect: async () => connection, log: quietLog });
      expect(fc).toBeNull();
      expect(connection.closeSync).toHaveBeenCalledTimes(1);
    });
  });

  it('tulis cache gagal → peringatan, hasil query tetap dikembalikan', async () => {
    await withDir(async (dir) => {
      await writeFile(join(dir, 'overture'), 'bukan direktori');
      const warn = vi.fn();
      const fc = await loadOverture('uji', BBOX, { cacheDir: dir, connect: async () => fakeConnection(), log: { info: () => {}, warn } });
      expect(fc.features).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/gagal menyimpan cache Overture/));
    });
  });

  it('offline tanpa cache → null + peringatan, tanpa koneksi', async () => {
    const connect = vi.fn();
    const warn = vi.fn();
    const fc = await loadOverture('tidak-ada', BBOX, { cacheDir: tmpdir(), offline: true, connect, log: { info: () => {}, warn } });
    expect(fc).toBeNull();
    expect(connect).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
