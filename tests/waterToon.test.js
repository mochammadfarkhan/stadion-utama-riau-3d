import { describe, expect, it } from 'vitest';
import { heightToSlopeRGBA, tileableNoise, waterLook } from '../src/world/shaders/waterToon.js';

describe('waterToon', () => {
  it('tileableNoise: deterministik, 0..1, tepi menyambung (tilable)', () => {
    const n = 64;
    const a = tileableNoise(n, 3);
    const b = tileableNoise(n, 3);
    expect(Array.from(a.slice(0, 50))).toEqual(Array.from(b.slice(0, 50)));
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...a)).toBeLessThanOrEqual(1);
    let seam = 0;
    let inner = 0;
    for (let y = 0; y < n; y += 1) {
      seam += Math.abs(a[y * n] - a[y * n + n - 1]);
      inner += Math.abs(a[y * n + 31] - a[y * n + 30]);
    }
    expect(seam / n).toBeLessThan((inner / n) * 3 + 0.05);
  });

  it('heightToSlopeRGBA: bidang datar -> kemiringan 0,5 di semua tempat', () => {
    const n = 16;
    const rgba = heightToSlopeRGBA(new Float32Array(n * n).fill(0.4), n);
    for (let i = 0; i < n * n; i += 1) {
      expect(rgba[i * 4]).toBe(128);
      expect(rgba[i * 4 + 1]).toBe(128);
    }
  });

  it('waterLook: malam gelap kebiruan, siang terang, sore hangat, kilau siang > malam, tanpa NaN', () => {
    const noon = waterLook(11);
    const gold = waterLook(17.2);
    const night = waterLook(20.5);
    const lum = (t) => t[0] * 0.3 + t[1] * 0.6 + t[2] * 0.1;
    expect(lum(night.tint)).toBeLessThan(lum(noon.tint) * 0.5);
    expect(night.tint[2]).toBeGreaterThan(night.tint[0]);
    expect(gold.warm).toBeGreaterThan(noon.warm);
    expect(gold.tint[2]).toBeLessThan(gold.tint[0]);
    expect(noon.glint).toBeGreaterThan(night.glint);
    for (const h of [0, 6.5, 12, 24, -3, Number.NaN]) {
      const l = waterLook(h);
      for (const v of [...l.tint, l.glint, l.day, l.warm, l.foamLight]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
