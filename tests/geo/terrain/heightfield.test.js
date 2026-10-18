import { describe, it, expect } from 'vitest';
import {
  decodeChunk, sampleChunk, createHeightField, TerrainDataError, validateTerrainHeader,
} from '../../../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, STEP, BIAS, UNIT } from '../../../src/geo/terrain/format.js';

/** Buffer chunk Uint16 LE dari fungsi tinggi (r, c) → meter (dibulatkan ke 1 cm). */
function chunkBuffer(fn) {
  const buf = new ArrayBuffer(N * N * 2);
  const view = new DataView(buf);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) view.setUint16((r * N + c) * 2, Math.round(fn(r, c) / UNIT) - BIAS, true);
  }
  return buf;
}
const header = (key) => ({ ...TERRAIN_HEADER, key });

describe('format terrain', () => {
  it('N = 500/4 + 1 dan y = (u16 + bias)·unit', () => {
    expect(N).toBe(126);
    expect(STEP).toBe(4);
    expect((5000 + BIAS) * UNIT).toBe(0);
    expect((6234 + BIAS) * UNIT).toBeCloseTo(12.34, 10);
  });
});

describe('decodeChunk', () => {
  it('membaca Uint16 little-endian, origin = sudut barat-laut chunk', () => {
    const chunk = decodeChunk(chunkBuffer((r, c) => r * 0.01 + c * 0.1), header('-2_3'));
    expect(chunk).toMatchObject({ key: '-2_3', ix: -2, iz: 3, origin: { x: -1000, z: 1500 }, n: 126, step: 4 });
    expect(chunk.data[0]).toBe(5000);
    expect(chunk.data[1]).toBe(5010); // c = 1 → 0,10 m
    expect(chunk.data[N]).toBe(5001); // r = 1 → 0,01 m
  });

  it('panjang salah, kunci salah, header salah → TerrainDataError', () => {
    expect(() => decodeChunk(new ArrayBuffer(10), header('0_0'))).toThrow(TerrainDataError);
    expect(() => decodeChunk(chunkBuffer(() => 0), header('x_y'))).toThrow(/kunci chunk/);
    expect(() => decodeChunk(chunkBuffer(() => 0), { ...header('0_0'), n: 125 })).toThrow(/n 125/);
    expect(() => decodeChunk(chunkBuffer(() => 0), { ...header('0_0'), format: 'lain' })).toThrow(/format/);
    expect(() => decodeChunk(new Uint8Array(N * N * 2), header('0_0'))).toThrow(/ArrayBuffer/);
  });

  it('validateTerrainHeader menolak size ≠ 500', () => {
    expect(() => validateTerrainHeader({ ...TERRAIN_HEADER, size: 250 })).toThrow(/size 250/);
    expect(validateTerrainHeader(TERRAIN_HEADER)).toEqual({ size: 500, step: 4, n: 126, unit: 0.01, bias: -5000 });
  });
});

describe('sampleChunk (bilinear)', () => {
  // y = 0,02·x_lokal + 0,01·z_lokal (bidang miring; bilinear harus tepat)
  const chunk = decodeChunk(chunkBuffer((r, c) => 0.02 * c * STEP + 0.01 * r * STEP), header('0_0'));
  it('tepat di sampel dan di antara sampel', () => {
    expect(sampleChunk(chunk, 0, 0)).toBeCloseTo(0, 6);
    expect(sampleChunk(chunk, 8, 4)).toBeCloseTo(0.2, 6);
    expect(sampleChunk(chunk, 10, 6)).toBeCloseTo(0.26, 6);
    expect(sampleChunk(chunk, 500, 500)).toBeCloseTo(15, 6);
  });
  it('di luar persegi di-clamp ke tepi', () => {
    expect(sampleChunk(chunk, -20, 0)).toBeCloseTo(0, 6);
    expect(sampleChunk(chunk, 520, 0)).toBeCloseTo(10, 6);
  });
});

describe('createHeightField', () => {
  const flat = (v) => chunkBuffer(() => v);
  it('0 di luar chunk, version naik tiap add/remove', () => {
    const f = createHeightField();
    expect(f.heightAt(123, 456)).toBe(0);
    expect(f.version).toBe(0);
    f.add(decodeChunk(flat(3), header('0_0')));
    expect(f.version).toBe(1);
    expect(f.heightAt(250, 250)).toBeCloseTo(3, 6);
    expect(f.heightAt(-1, 250)).toBe(0); // chunk -1_0 tidak ada
    expect(f.remove('0_0')).toBe(true);
    expect(f.remove('0_0')).toBe(false);
    expect(f.version).toBe(2);
    expect(f.heightAt(250, 250)).toBe(0);
    expect(f.heightAt(Number.NaN, 0)).toBe(0);
  });

  it('tepi bersama dua chunk kontinu (x = 500 milik chunk 1_0)', () => {
    const f = createHeightField();
    // chunk 0_0: y = 0,01·x_lokal; chunk 1_0: y = 5 + 0,01·x_lokal → di x = 500 keduanya 5
    f.add(decodeChunk(chunkBuffer((r, c) => 0.01 * c * STEP), header('0_0')));
    f.add(decodeChunk(chunkBuffer((r, c) => 5 + 0.01 * c * STEP), header('1_0')));
    expect(f.heightAt(499.999, 10)).toBeCloseTo(5, 4);
    expect(f.heightAt(500, 10)).toBeCloseTo(5, 6);
    expect(f.heightAt(504, 10)).toBeCloseTo(5.04, 6);
  });

  it('normalAt bidang miring 10% ke timur: (−0,0995, 0,995, 0)', () => {
    const f = createHeightField();
    f.add(decodeChunk(chunkBuffer((r, c) => 0.1 * c * STEP), header('0_0')));
    const n = f.normalAt(200, 200);
    expect(n.x).toBeCloseTo(-0.1 / Math.hypot(0.1, 1), 4);
    expect(n.y).toBeCloseTo(1 / Math.hypot(0.1, 1), 4);
    expect(n.z).toBeCloseTo(0, 6);
    const out = { x: 0, y: 0, z: 0 };
    expect(f.normalAt(200, 200, out)).toBe(out);
  });

  it('gradeAlong: yaw π/2 (timur) = +0,1; yaw −π/2 = −0,1; yaw 0 (selatan) = 0', () => {
    const f = createHeightField();
    f.add(decodeChunk(chunkBuffer((r, c) => 0.1 * c * STEP), header('0_0')));
    expect(f.gradeAlong(200, 200, Math.PI / 2)).toBeCloseTo(0.1, 6);
    expect(f.gradeAlong(200, 200, -Math.PI / 2)).toBeCloseTo(-0.1, 6);
    expect(f.gradeAlong(200, 200, 0)).toBeCloseTo(0, 6);
    expect(f.gradeAlong(200, 200, Number.NaN)).toBe(0);
  });

  it('add menolak objek bukan chunk', () => {
    expect(() => createHeightField().add({})).toThrow(TypeError);
  });
});
