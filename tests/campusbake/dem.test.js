import { describe, it, expect, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHgt, parseHgtName, hgtPosition, HGT_VOID } from '../../tools/campusbake/dem/readHgt.js';
import { loadSrtm, sha256, srtmCachePath } from '../../tools/campusbake/dem/fetchSrtm.js';
import { cubicWeight, bicubicAt, resampleToGrid } from '../../tools/campusbake/dem/resample.js';
import { median2d, gaussian2d, gaussianKernel } from '../../tools/campusbake/dem/filters.js';
import { createProjection } from '../../src/geo/projection.js';

/** .hgt sintetis size × size, nilai = fn(baris, kolom), big-endian. */
function hgtBytes(size, fn) {
  const bytes = new Uint8Array(size * size * 2);
  const view = new DataView(bytes.buffer);
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) view.setInt16((r * size + c) * 2, fn(r, c), false);
  return bytes;
}

describe('readHgt', () => {
  it('nama ubin → sudut barat-daya', () => {
    expect(parseHgtName('N00E101')).toEqual({ lat0: 0, lon0: 101 });
    expect(parseHgtName('S01W060')).toEqual({ lat0: -1, lon0: -60 });
    expect(() => parseHgtName('X00E101')).toThrow(/tidak valid/);
  });

  it('1201² big-endian: sampel (0,0) = barat-laut, nilai negatif & void terbaca', () => {
    const dem = readHgt(hgtBytes(1201, (r, c) => (r === 0 && c === 1 ? -12 : r === 5 && c === 5 ? HGT_VOID : r * 2 + c)), 'N00E101');
    expect(dem.size).toBe(1201);
    expect(dem.data[1]).toBe(-12);
    expect(dem.data[1201 * 3 + 4]).toBe(10);
    expect(dem.data[1201 * 5 + 5]).toBe(HGT_VOID);
  });

  it('ukuran salah ditolak', () => {
    expect(() => readHgt(new Uint8Array(100), 'N00E101')).toThrow(/3601² atau 1201²/);
  });

  it('posisi pecahan: stadion (0,4835954; 101,3895277) di ubin 3601 = baris 1859,06, kolom 1402,30', () => {
    const p = hgtPosition({ lat0: 0, lon0: 101, size: 3601 }, 0.4835954, 101.3895277);
    expect(p.row).toBeCloseTo(1859.0566, 3);
    expect(p.col).toBeCloseTo(1402.2997, 3);
  });
});

describe('resample bikubik (Keys a = −0,5)', () => {
  it('bobot kernel: w(0) = 1, w(1) = w(2) = 0, jumlah 4 bobot = 1', () => {
    expect(cubicWeight(0)).toBe(1);
    expect(cubicWeight(1)).toBe(0);
    expect(cubicWeight(2)).toBe(0);
    const t = 0.37;
    expect(cubicWeight(1 + t) + cubicWeight(t) + cubicWeight(1 - t) + cubicWeight(2 - t)).toBeCloseTo(1, 12);
  });

  it('mereproduksi polinom derajat 2 tepat di posisi pecahan (jauh dari tepi)', () => {
    const f = (r, c) => 0.5 * r * r - 2 * r * c + 3 * c + 7;
    const dem = { size: 20, data: Float64Array.from({ length: 400 }, (_, i) => f(Math.floor(i / 20), i % 20)) };
    expect(bicubicAt(dem, 7.25, 9.6)).toBeCloseTo(f(7.25, 9.6), 9);
    expect(bicubicAt(dem, 10, 10)).toBeCloseTo(f(10, 10), 12);
  });

  it('void di jendela 4×4 → galat jelas', () => {
    const dem = { size: 8, data: new Int16Array(64).fill(5) };
    dem.data[3 * 8 + 3] = HGT_VOID;
    expect(() => bicubicAt(dem, 3.5, 3.5)).toThrow(/void SRTM/);
  });

  it('resampleToGrid: DEM linier lat/lon → grid dunia mengikuti proyeksi', () => {
    // ubin 1201 sintetis: h = kolom (naik ke timur 1 m per 3″) → di grid dunia h naik ±1 m per 92,6 m ke timur
    const dem = { ...readHgt(hgtBytes(1201, (r, c) => c), 'N00E101') };
    const proj = createProjection({ lat0: 0.4835954, lon0: 101.3895277 });
    const grid = { minX: 0, minZ: 0, step: 4, cols: 3, rows: 2 };
    const h = resampleToGrid(dem, grid, proj);
    const base = hgtPosition(dem, 0.4835954, 101.3895277).col;
    expect(h[0]).toBeCloseTo(base, 3);
    const perMeter = 1200 / (111319.49 * Math.cos(0.4835954 * Math.PI / 180));
    expect(h[2] - h[0]).toBeCloseTo(8 * perMeter, 3);
  });
});

describe('filter grid', () => {
  it('median 5×5 menghapus paku tunggal, mempertahankan bidang', () => {
    const cols = 9;
    const rows = 9;
    const src = Float64Array.from({ length: 81 }, (_, i) => (i === 40 ? 100 : 3));
    const out = median2d(src, cols, rows, 5);
    expect(out[40]).toBe(3);
    expect(() => median2d(src, cols, rows, 4)).toThrow(RangeError);
  });

  it('kernel Gaussian σ 5: radius 15, ternormalisasi, simetris', () => {
    const k = gaussianKernel(5);
    expect(k.length).toBe(31);
    expect(k.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(k[0]).toBeCloseTo(k[30], 15);
  });

  it('Gaussian mempertahankan konstanta & bidang miring (jauh dari tepi), meratakan undak', () => {
    const cols = 61;
    const rows = 61;
    const plane = Float64Array.from({ length: cols * rows }, (_, i) => 0.25 * (i % cols) + 2);
    const g = gaussian2d(plane, cols, rows, 5);
    expect(g[30 * cols + 30]).toBeCloseTo(plane[30 * cols + 30], 9);
    const step = Float64Array.from({ length: cols * rows }, (_, i) => (i % cols < 30 ? 0 : 10));
    const s = gaussian2d(step, cols, rows, 5);
    expect(s[30 * cols + 29]).toBeGreaterThan(3);
    expect(s[30 * cols + 29]).toBeLessThan(5);
  });
});

describe('loadSrtm (cache, unduh, offline)', () => {
  const raw = hgtBytes(1201, () => 7);
  const srtm = { tile: 'N00E101', url: 'https://contoh.invalid/N00E101.hgt.gz', sha256: sha256(raw) };

  it('unduh gzip → dekompresi → verifikasi sha256 → cache; kedua kali dari cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'srtm-'));
    const gz = gzipSync(raw);
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) }));
    const a = await loadSrtm(srtm, { cacheDir: dir, fetchImpl, log: { info() {}, warn() {} } });
    expect(a.byteLength).toBe(raw.byteLength);
    expect(sha256(await readFile(srtmCachePath(dir, 'N00E101')))).toBe(sha256(raw)); // toEqual 2,9 MB terlalu lambat
    await loadSrtm(srtm, { cacheDir: dir, fetchImpl, offline: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await rm(dir, { recursive: true, force: true });
  });

  it('offline tanpa cache → galat berisi URL & langkah unduh', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'srtm-'));
    await expect(loadSrtm(srtm, { cacheDir: dir, offline: true })).rejects.toThrow(/--offline.*curl -L -o .*https:\/\/contoh\.invalid/);
    await rm(dir, { recursive: true, force: true });
  });

  it('sha256 cache tidak cocok → galat; 404 tidak dicoba ulang', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'srtm-'));
    await mkdir(join(dir, 'dem', 'srtm'), { recursive: true });
    await writeFile(srtmCachePath(dir, 'N00E101'), new Uint8Array(8));
    await expect(loadSrtm(srtm, { cacheDir: dir })).rejects.toThrow(/sha256 tidak cocok/);
    await rm(dir, { recursive: true, force: true });
    const dir2 = await mkdtemp(join(tmpdir(), 'srtm-'));
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(loadSrtm(srtm, { cacheDir: dir2, fetchImpl, sleep: async () => {}, log: { info() {}, warn() {} } })).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await rm(dir2, { recursive: true, force: true });
  });
});
