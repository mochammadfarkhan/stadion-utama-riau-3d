import { describe, it, expect } from 'vitest';
import { celestialLook } from '../src/world/CelestialBodies.js';

describe('celestialLook', () => {
  it('siang cerah: matahari terlihat penuh, bulan tidak', () => {
    const l = celestialLook({ elevationDeg: 50, cloudCover: 0 });
    expect(l.sunOpacity).toBe(1);
    expect(l.moonOpacity).toBe(0);
  });
  it('malam cerah: bulan terlihat penuh, matahari tidak', () => {
    const l = celestialLook({ elevationDeg: -30, cloudCover: 0 });
    expect(l.sunOpacity).toBe(0);
    expect(l.moonOpacity).toBe(1);
  });
  it('transisi di horizon mulus: sebagian matahari dan bulan, tidak loncat', () => {
    let prevSun = celestialLook({ elevationDeg: -8 }).sunOpacity;
    let prevMoon = celestialLook({ elevationDeg: -8 }).moonOpacity;
    for (let e = -7.5; e <= 8; e += 0.5) {
      const l = celestialLook({ elevationDeg: e });
      expect(l.sunOpacity).toBeGreaterThanOrEqual(prevSun);
      expect(l.moonOpacity).toBeLessThanOrEqual(prevMoon);
      expect(l.sunOpacity - prevSun).toBeLessThan(0.2);
      prevSun = l.sunOpacity; prevMoon = l.moonOpacity;
    }
  });
  it('awan tebal meredupkan keduanya', () => {
    expect(celestialLook({ elevationDeg: 50, cloudCover: 1 }).sunOpacity).toBeLessThan(0.2);
    expect(celestialLook({ elevationDeg: -30, cloudCover: 1 }).moonOpacity).toBeLessThan(0.2);
  });
  it('halo membesar mendekati horizon (senja)', () => {
    expect(celestialLook({ elevationDeg: 2 }).glowScale).toBeGreaterThan(celestialLook({ elevationDeg: 60 }).glowScale);
  });
  it('input rusak tidak menghasilkan NaN', () => {
    const l = celestialLook({ elevationDeg: Number.NaN, cloudCover: Number.NaN });
    for (const v of Object.values(l)) expect(Number.isFinite(v)).toBe(true);
  });
});
