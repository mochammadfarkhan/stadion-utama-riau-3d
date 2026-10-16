import { describe, it, expect } from 'vitest';
import { createProjection } from '../../src/geo/projection.js';

const STADION = { lat0: 0.4835954, lon0: 101.3895277 };

describe('createProjection', () => {
  it('origin dipetakan ke (0, 0)', () => {
    const p = createProjection(STADION);
    const w = p.toWorld(STADION.lat0, STADION.lon0);
    expect(w.x).toBeCloseTo(0, 9);
    expect(w.z).toBeCloseTo(0, 9);
  });

  it('arah: utara → z negatif, timur → x positif', () => {
    const p = createProjection(STADION);
    const north = p.toWorld(STADION.lat0 + 0.01, STADION.lon0);
    const east = p.toWorld(STADION.lat0, STADION.lon0 + 0.01);
    expect(north.z).toBeLessThan(-1000);
    expect(Math.abs(north.x)).toBeLessThan(0.01);
    expect(east.x).toBeGreaterThan(1000);
    expect(Math.abs(east.z)).toBeLessThan(1);
  });

  it('1° lintang di ekuator ≈ 110,574 km (toleransi 50 m: tali busur vs busur)', () => {
    const p = createProjection({ lat0: 0, lon0: 0 });
    expect(Math.abs(p.toWorld(1, 0).z + 110574)).toBeLessThan(50);
  });

  it('0,001° bujur di ekuator ≈ 111,32 m', () => {
    const p = createProjection({ lat0: 0, lon0: 0 });
    expect(p.toWorld(0, 0.001).x).toBeCloseTo(111.32, 1);
  });

  it('round-trip < 1 cm untuk titik dalam radius 20 km', () => {
    const p = createProjection(STADION);
    const pts = [[20000, 0], [-20000, 0], [0, 20000], [0, -20000], [14142, -14142], [-9000, 17000], [6827, -4754]];
    for (const [x, z] of pts) {
      const ll = p.toLatLon(x, z);
      const back = p.toWorld(ll.lat, ll.lon);
      expect(Math.hypot(back.x - x, back.z - z)).toBeLessThan(0.01);
    }
  });

  it('jarak Stadion → Masjid Raya An-Nur ≈ 8,3 km (timur-laut)', () => {
    const p = createProjection(STADION);
    const w = p.toWorld(0.5265934, 101.4508552);
    expect(w.x).toBeGreaterThan(6700);
    expect(w.x).toBeLessThan(6950);
    expect(w.z).toBeLessThan(-4650);
    expect(w.z).toBeGreaterThan(-4850);
  });

  it('origin tak valid → RangeError', () => {
    expect(() => createProjection({ lat0: NaN, lon0: 0 })).toThrow(RangeError);
    expect(() => createProjection({ lat0: 90, lon0: 0 })).toThrow(RangeError);
  });
});
