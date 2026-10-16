import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildOverpassQuery, classify, landuseClassOf, joinSegments, normalizeOsm, fetchOverpass, loadOsm, osmCachePath,
} from '../../tools/citybake/fetchOsm.js';

const RAW = JSON.parse(readFileSync(new URL('./fixtures/osm-mini.json', import.meta.url), 'utf8'));
const BBOX = { south: 0.47, west: 101.37, north: 0.49, east: 101.4 };
const quietLog = { info: () => {}, warn: () => {} };

/** Respons fetch tiruan. */
const response = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => body,
});

describe('buildOverpassQuery', () => {
  it('memuat bbox (S,W,N,E), semua kelas fitur, dan out geom', () => {
    const q = buildOverpassQuery(BBOX);
    expect(q).toContain('(0.4700000,101.3700000,0.4900000,101.4000000)');
    for (const k of ['"building"', '"highway"', '"waterway"', '"natural"="water"', '"landuse"', 'leisure']) expect(q).toContain(k);
    expect(q.trim().endsWith('out geom;')).toBe(true);
  });
});

describe('classify', () => {
  it('prioritas & kondisi tertutup', () => {
    expect(classify({ building: 'yes' }, true)).toEqual({ kind: 'building', cls: 'yes' });
    expect(classify({ building: 'yes' }, false)).toBeNull();
    expect(classify({ building: 'no', landuse: 'grass' }, true)).toEqual({ kind: 'landuse', cls: 'grass' });
    expect(classify({ highway: 'residential', junction: 'roundabout' }, true)).toEqual({ kind: 'road', cls: 'residential' });
    expect(classify({ highway: 'pedestrian', area: 'yes' }, true)).toBeNull();
    expect(classify({ highway: 'construction' }, false)).toBeNull();
    expect(classify({ natural: 'water' }, true)).toEqual({ kind: 'water', cls: 'water' });
    expect(classify({ waterway: 'river' }, false)).toEqual({ kind: 'waterway', cls: 'river' });
    expect(classify({ waterway: 'dam' }, false)).toBeNull();
  });

  it('landuseClassOf memetakan landuse/leisure/natural/amenity', () => {
    expect(landuseClassOf({ landuse: 'meadow' })).toBe('grass');
    expect(landuseClassOf({ leisure: 'stadium' })).toBe('pitch');
    expect(landuseClassOf({ natural: 'wood' })).toBe('forest');
    expect(landuseClassOf({ amenity: 'parking' })).toBe('parking');
    expect(landuseClassOf({ landuse: 'military' })).toBeNull();
  });
});

describe('joinSegments', () => {
  it('menyambung potongan (termasuk yang terbalik) menjadi ring tertutup', () => {
    const rings = joinSegments([[[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]]]);
    expect(rings).toEqual([[[0, 0], [1, 0], [1, 1], [0, 1]]]);
  });
  it('potongan yang tidak menutup dibuang', () => {
    expect(joinSegments([[[0, 0], [1, 0]], [[5, 5], [6, 6]]])).toEqual([]);
  });
});

describe('normalizeOsm (fixture)', () => {
  const { timestamp, features } = normalizeOsm(RAW);
  const byId = Object.fromEntries(features.map((f) => [f.id, f]));

  it('timestamp & jumlah fitur (node, highway=construction diabaikan)', () => {
    expect(timestamp).toBe('2026-10-16T00:00:00Z');
    expect(features.map((f) => f.id)).toEqual([
      'osm:relation/5001#0', 'osm:way/1001', 'osm:way/1002', 'osm:way/1003', 'osm:way/1004',
      'osm:way/2001', 'osm:way/2002', 'osm:way/3001', 'osm:way/3002', 'osm:way/4001',
    ]);
  });

  it('bangunan: ring terbuka [lon, lat] 4 titik', () => {
    const b = byId['osm:way/1001'];
    expect(b).toMatchObject({ source: 'osm', kind: 'building', cls: 'yes' });
    expect(b.rings).toHaveLength(1);
    expect(b.rings[0]).toHaveLength(4);
    expect(b.rings[0][0][0]).toBeGreaterThan(101);
    expect(b.rings[0][0][1]).toBeLessThan(1);
  });

  it('jalan & waterway sebagai line; air & landuse sebagai rings', () => {
    expect(byId['osm:way/2001']).toMatchObject({ kind: 'road', cls: 'primary' });
    expect(byId['osm:way/2001'].line).toHaveLength(3);
    expect(byId['osm:way/3002']).toMatchObject({ kind: 'waterway', cls: 'stream' });
    expect(byId['osm:way/3001']).toMatchObject({ kind: 'water', cls: 'water' });
    expect(byId['osm:way/4001']).toMatchObject({ kind: 'landuse', cls: 'grass' });
  });

  it('multipolygon: dua way luar digabung + satu lubang', () => {
    const m = byId['osm:relation/5001#0'];
    expect(m).toMatchObject({ kind: 'building', cls: 'commercial' });
    expect(m.rings).toHaveLength(2);
    expect(m.rings[0]).toHaveLength(4);
    expect(m.rings[1]).toHaveLength(4);
  });

  it('multipolygon bersarang: tiap lubang milik ring luar terkecil yang memuatnya', () => {
    const sq = (a, b) => [[a, a], [a, b], [b, b], [b, a], [a, a]].map(([lat, lon]) => ({ lat, lon }));
    const member = (role, a, b) => ({ type: 'way', role, geometry: sq(a, b) });
    const raw = { elements: [{
      type: 'relation', id: 7, tags: { type: 'multipolygon', landuse: 'grass' },
      members: [member('outer', 0, 10), member('inner', 1, 9), member('outer', 2, 8), member('inner', 3, 7)],
    }] };
    const [a, b] = normalizeOsm(raw).features;
    expect(a.rings.map((r) => r[0])).toEqual([[0, 0], [1, 1]]);
    expect(b.rings.map((r) => r[0])).toEqual([[2, 2], [3, 3]]);
  });

  it('input tak valid → TypeError', () => {
    expect(() => normalizeOsm({})).toThrow(TypeError);
  });
});

describe('fetchOverpass', () => {
  it('retry pada 429 lalu sukses; User-Agent dikirim; endpoint bergiliran', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, ua: init.headers['User-Agent'] });
      return calls.length === 1 ? response(429, 'busy', { 'retry-after': '1' }) : response(200, '{"elements":[]}');
    });
    const sleep = vi.fn(async () => {});
    const json = await fetchOverpass('q', { endpoints: ['https://a/api', 'https://b/api'], fetchImpl, sleep, log: quietLog });
    expect(json).toEqual({ elements: [] });
    expect(calls.map((c) => c.url)).toEqual(['https://a/api', 'https://b/api']);
    expect(calls[0].ua).toMatch(/citybake/);
    expect(sleep).toHaveBeenCalledWith(15000);
  });

  it('Retry-After dibatasi 300 s', async () => {
    const bodies = [response(429, 'busy', { 'retry-after': '3600' }), response(200, '{"elements":[]}')];
    const sleep = vi.fn(async () => {});
    await fetchOverpass('q', { endpoints: ['https://a/api'], fetchImpl: async () => bodies.shift(), sleep, log: quietLog });
    expect(sleep).toHaveBeenCalledWith(300000);
  });

  it('timeout/abort dianggap galat jaringan dan dicoba ulang; signal dikirim', async () => {
    const signals = [];
    const fetchImpl = vi.fn(async (url, init) => {
      signals.push(init.signal);
      if (signals.length === 1) throw new DOMException('waktu habis', 'TimeoutError');
      return response(200, '{"elements":[2]}');
    });
    const json = await fetchOverpass('q', { endpoints: ['https://a/api'], fetchImpl, sleep: async () => {}, log: quietLog });
    expect(json).toEqual({ elements: [2] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it('balasan 200 berisi HTML / remark runtime error dianggap sibuk', async () => {
    const bodies = ['<html>busy</html>', '{"elements":[],"remark":"runtime error: Query timed out"}', '{"elements":[1]}'];
    const fetchImpl = vi.fn(async () => response(200, bodies.shift()));
    const json = await fetchOverpass('q', { endpoints: ['https://a/api'], fetchImpl, sleep: async () => {}, log: quietLog });
    expect(json).toEqual({ elements: [1] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('HTTP 400 tidak dicoba ulang; 5xx dicoba ulang sampai habis → galat', async () => {
    await expect(fetchOverpass('q', { fetchImpl: async () => response(400, 'bad'), sleep: async () => {}, log: quietLog }))
      .rejects.toThrow(/HTTP 400/);
    await expect(fetchOverpass('q', { fetchImpl: async () => response(500, ''), sleep: async () => {}, retries: 1, log: quietLog }))
      .rejects.toThrow(/gagal setelah 2 percobaan/);
  });
});

describe('loadOsm', () => {
  it('fetch sekali lalu memakai cache; offline tanpa cache → galat', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'citybake-osm-'));
    try {
      const fetchImpl = vi.fn(async () => response(200, JSON.stringify(RAW)));
      const opts = { cacheDir: dir, fetchOptions: { fetchImpl, sleep: async () => {} }, log: quietLog };
      const a = await loadOsm('uji', BBOX, opts);
      const b = await loadOsm('uji', BBOX, opts);
      expect(a.elements).toHaveLength(RAW.elements.length);
      expect(b).toEqual(a);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(JSON.parse(await readFile(osmCachePath(dir, 'uji'), 'utf8')).elements).toHaveLength(RAW.elements.length);
      await expect(loadOsm('lain', BBOX, { cacheDir: dir, offline: true, log: quietLog })).rejects.toThrow(/--offline/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
