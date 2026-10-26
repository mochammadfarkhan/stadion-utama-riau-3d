import { describe, it, expect } from 'vitest';
import { frameInterval, shouldRenderFrame } from '../src/engine/frameCap.js';
import { guessTierFromGpu, percentile, tierAfterBenchmark } from '../src/engine/qualityTier.js';
import { QUALITY_PRESETS, PRESET_KEYS } from '../src/config/quality.js';
import { SETTINGS_SCHEMA, listFields, coerceValue } from '../src/settings/schema.js';

/** Hitung frame yang dirender selama `ms` pada layar `hz` dengan batas `fps`. */
function renderedFrames(hz, fps, ms = 1000) {
  const gate = { next: 0 };
  let n = 0;
  for (let t = 0; t <= ms; t += 1000 / hz) if (shouldRenderFrame(gate, t, frameInterval(fps))) n += 1;
  return n;
}

describe('frameCap', () => {
  it('batas 60 di layar 144 Hz ≈ 60 FPS (bukan 48); 30 di 60 Hz = tiap frame kedua; tanpa batas = semua', () => {
    expect(renderedFrames(144, 60)).toBeGreaterThanOrEqual(58);
    expect(renderedFrames(144, 60)).toBeLessThanOrEqual(62);
    expect(renderedFrames(60, 30)).toBeGreaterThanOrEqual(30);
    expect(renderedFrames(60, 30)).toBeLessThanOrEqual(32);
    expect(renderedFrames(60, 60)).toBeGreaterThanOrEqual(60);
    expect(renderedFrames(144, 0)).toBe(renderedFrames(144, 1000));
  });

  it('tertinggal jauh (tab di-background) tidak mengejar dengan rentetan frame', () => {
    const gate = { next: 0 };
    const iv = frameInterval(60);
    shouldRenderFrame(gate, 0, iv);
    expect(shouldRenderFrame(gate, 5000, iv)).toBe(true);
    expect(shouldRenderFrame(gate, 5007, iv)).toBe(false);
  });
});

describe('qualityTier', () => {
  it('tebakan dari nama GPU', () => {
    const cases = [
      ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)', 'tinggi'],
      ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11)', 'sedang'],
      ['ANGLE (NVIDIA, NVIDIA GeForce MX350 Direct3D11)', 'rendah'],
      ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rendah'],
      ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', 'rendah'],
      ['ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)', 'rendah'],
      ['ANGLE (AMD, AMD Radeon 780M Graphics Direct3D11)', 'sedang'],
      ['ANGLE (AMD, AMD Radeon RX 6600 Direct3D11)', 'tinggi'],
      ['Google SwiftShader', 'rendah'],
      ['Mali-G78', 'rendah'],
      ['Apple M2', 'sedang'],
      [null, 'sedang'],
    ];
    for (const [gpu, tier] of cases) expect(guessTierFromGpu(gpu), String(gpu)).toBe(tier);
    expect(guessTierFromGpu('ANGLE (NVIDIA, RTX 4090)', { mobile: true })).toBe('rendah');
  });

  it('p95 dan keputusan uji: hanya turun satu tingkat bila melebihi anggaran', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 0.95)).toBe(95);
    expect(percentile([], 0.95)).toBeNaN();
    expect(tierAfterBenchmark('tinggi', 18)).toBe('tinggi');
    expect(tierAfterBenchmark('tinggi', 40)).toBe('sedang');
    expect(tierAfterBenchmark('sedang', 40)).toBe('rendah');
    expect(tierAfterBenchmark('rendah', 200)).toBe('rendah');
    expect(tierAfterBenchmark('tinggi', NaN)).toBe('tinggi');
    expect(tierAfterBenchmark('aneh', 10)).toBe('sedang');
  });
});

describe('preset kualitas', () => {
  it('setiap nilai preset valid menurut skema setelan', () => {
    const fields = new Map(listFields(SETTINGS_SCHEMA));
    for (const [tier, values] of Object.entries(QUALITY_PRESETS)) {
      expect(Object.keys(values).sort(), tier).toEqual([...PRESET_KEYS].sort());
      for (const [key, value] of Object.entries(values)) {
        expect(fields.has(key), key).toBe(true);
        expect(coerceValue(fields.get(key), value), `${tier} ${key}`).toEqual(value);
      }
    }
  });
});
