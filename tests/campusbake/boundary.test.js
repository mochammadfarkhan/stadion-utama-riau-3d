import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import polygonClipping from 'polygon-clipping';
import {
  bufferRing, simplifyLine, simplifyRing, computeBoundary, boundaryModuleSource,
} from '../../tools/campusbake/boundary.js';
import { polygonArea, signedArea, pointInPolygon } from '../../src/geo/polygon.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const multiArea = (mp) => mp.reduce((s, poly) => s + polygonArea(poly[0].slice(0, -1)) - poly.slice(1).reduce((h, r) => h + polygonArea(r.slice(0, -1)), 0), 0);

describe('bufferRing (jumlah Minkowski, 16-gon yang mengelilingi lingkaran)', () => {
  it('persegi 10 m + 5 m: 100 + 4·10·5 + luas 16-gon keliling r 5 (16·25·tan(π/16) = 79,56) = 379,56 m²', () => {
    const area = multiArea(bufferRing(sq(0, 0, 10, 10), 5, 16));
    expect(area).toBeCloseTo(100 + 200 + 16 * 25 * Math.tan(Math.PI / 16), 3);
  });
  it('hasil bertipe MultiPolygon polygon-clipping (ring tertutup)', () => {
    const mp = bufferRing(sq(0, 0, 10, 10), 1);
    expect(mp).toHaveLength(1);
    const outer = mp[0][0];
    expect(outer[0]).toEqual(outer[outer.length - 1]);
    expect(typeof polygonClipping.union).toBe('function');
  });
});

describe('Douglas–Peucker', () => {
  it('garis: titik kolinear & simpangan < toleransi dibuang, ujung dipertahankan', () => {
    expect(simplifyLine([[0, 0], [5, 0.5], [10, 0]], 1)).toEqual([[0, 0], [10, 0]]);
    expect(simplifyLine([[0, 0], [5, 3], [10, 0]], 1)).toEqual([[0, 0], [5, 3], [10, 0]]);
  });
  it('ring: persegi bertitik tengah di tiap sisi → 4 sudut', () => {
    const ring = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]];
    const out = simplifyRing(ring, 5);
    expect(out).toHaveLength(4);
    expect(polygonArea(out)).toBe(10000);
  });
});

describe('computeBoundary', () => {
  it('kampus 1 km² dikurangi pojok mask ±100 m (+40 m): satu potongan, luas ≈ 1e6 − 19.273 (+DP 5 m)', () => {
    const r = computeBoundary({ campusRing: sq(0, 0, 1000, 1000), maskRing: sq(-100, -100, 100, 100), maskMargin: 40, tolerance: 5 });
    expect(r.pieces).toBe(1);
    expect(r.droppedArea).toBe(0);
    expect(signedArea(r.ring)).toBeGreaterThan(0);
    // buffer ∩ kuadran: 140² − (40² − ¼·16·40²·tan(π/16)) = 19.273; Douglas–Peucker 5 m memangkas sudut bulat (±50 m²)
    expect(r.area).toBeGreaterThan(1e6 - 19400);
    expect(r.area).toBeLessThan(1e6 - 19100);
    expect(pointInPolygon(120, 120, r.ring)).toBe(false); // 28 m dari pojok mask → di dalam buffer
    expect(pointInPolygon(130, 130, r.ring)).toBe(true); // 42 m dari pojok mask → di luar buffer
    expect(pointInPolygon(500, 500, r.ring)).toBe(true);
    expect(r.ring[0][0]).toBe(Math.min(...r.ring.map((p) => p[0]))); // mulai dari verteks paling barat
    expect(r.ring.flat().every((v) => Math.round(v * 100) / 100 === v)).toBe(true);
  });

  it('mask membelah kampus → potongan terluas dipakai, sisanya dilaporkan', () => {
    const r = computeBoundary({ campusRing: sq(0, 0, 1000, 200), maskRing: sq(300, -50, 320, 250), maskMargin: 40, tolerance: 5 });
    expect(r.pieces).toBe(2);
    expect(r.area).toBeCloseTo(640 * 200, -2); // x 360..1000
    expect(r.droppedArea).toBeCloseTo(260 * 200, -2); // x 0..260
  });

  it('mask menutup seluruh kampus → galat', () => {
    expect(() => computeBoundary({ campusRing: sq(0, 0, 10, 10), maskRing: sq(-50, -50, 60, 60), maskMargin: 40, tolerance: 5 })).toThrow(/kosong/);
  });
});

describe('boundaryModuleSource', () => {
  it('modul hasil dapat diimpor & bernilai sama (data beku)', async () => {
    const ring = [[0, 0], [10.5, 0], [10.5, 20.25], [0, 20.25]];
    const src = boundaryModuleSource({ ring, area: 212.625 }, { osmTimestamp: '2026-10-17T13:19:51Z', wayId: 938374562, maskMargin: 40, tolerance: 5 });
    expect(src).toContain('DIHASILKAN oleh');
    const dir = await mkdtemp(join(tmpdir(), 'batas-'));
    const file = join(dir, 'boundary.mjs');
    await writeFile(file, src);
    const mod = await import(pathToFileURL(file).href);
    expect(mod.UNRI_BOUNDARY).toEqual(ring);
    expect(Object.isFrozen(mod.UNRI_BOUNDARY)).toBe(true);
    expect(mod.UNRI_BOUNDARY_META).toEqual({ wayId: 938374562, osmTimestamp: '2026-10-17T13:19:51Z', maskMargin: 40, tolerance: 5, area: 213 });
    await rm(dir, { recursive: true, force: true });
  });
});
