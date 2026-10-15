import { describe, it, expect } from 'vitest';
import { createAdaptiveResolution } from '../src/core/adaptiveResolution.js';

/** Jalankan `seconds` detik frame berdurasi `frameMs(ratio)`; kembalikan rasio akhir. */
function run(ctrl, seconds, frameMs) {
  let t = 0;
  while (t < seconds) {
    const ms = frameMs(ctrl.ratio);
    ctrl.sample(ms / 1000);
    t += ms / 1000;
  }
  return ctrl.ratio;
}

const make = (over = {}) => createAdaptiveResolution({ ceiling: 1.25, floor: 0.6, targetMs: 20, ...over });

describe('createAdaptiveResolution', () => {
  it('mulai di ceiling dan tetap bila frame sudah cepat', () => {
    const c = make();
    expect(c.ratio).toBe(1.25);
    expect(run(c, 10, () => 10)).toBe(1.25);
  });

  it('GPU-bound: frame lambat turun bertahap sampai cukup cepat (tidak di bawah floor)', () => {
    const c = make();
    // waktu frame sebanding luas piksel: 40 ms pada 1.25 → ±20 ms di ±0.88
    const ratio = run(c, 40, (r) => 40 * (r / 1.25) ** 2);
    expect(ratio).toBeLessThan(1.25);
    expect(ratio).toBeGreaterThanOrEqual(0.6);
    expect(40 * (ratio / 1.25) ** 2).toBeLessThanOrEqual(20 * 1.25);
  });

  it('naik lagi pelan-pelan saat frame kembali cepat, tidak melewati ceiling', () => {
    const c = make();
    run(c, 30, (r) => 40 * (r / 1.25) ** 2);
    const low = c.ratio;
    const after = run(c, 60, () => 8);
    expect(after).toBeGreaterThan(low);
    expect(after).toBeLessThanOrEqual(1.25);
  });

  it('CPU-bound: turun tidak membantu → dibatalkan dan tidak diulang terus', () => {
    const c = make();
    const changes = [];
    let t = 0;
    while (t < 60) { const r = c.sample(0.04); if (r != null) changes.push(r); t += 0.04; }
    expect(c.ratio).toBeGreaterThanOrEqual(1.15); // tidak terjun ke floor
    expect(changes.length).toBeLessThanOrEqual(4);
  });

  it('dt ekstrem (tab di-background) diabaikan', () => {
    const c = make();
    for (let i = 0; i < 20; i += 1) c.sample(5);
    expect(c.ratio).toBe(1.25);
  });

  it('frame sangat lambat berkelanjutan (bukan lonjakan tunggal) tetap memicu penurunan', () => {
    const c = make();
    const ratio = run(c, 60, (r) => 800 * (r / 1.25) ** 2); // GPU-bound, sangat lambat
    expect(ratio).toBeLessThan(1.25);
  });

  it('setCeiling menjepit rasio saat ini', () => {
    const c = make();
    c.setCeiling(0.9);
    expect(c.ratio).toBe(0.9);
    c.setCeiling(1.5);
    expect(c.ratio).toBe(0.9); // naik hanya lewat adaptasi
  });

  it('sample mengembalikan rasio baru hanya saat berubah', () => {
    const c = make();
    const seen = [];
    let t = 0;
    while (t < 5) { const r = c.sample(0.04); if (r != null) seen.push(r); t += 0.04; }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((r) => typeof r === 'number')).toBe(true);
  });
});
