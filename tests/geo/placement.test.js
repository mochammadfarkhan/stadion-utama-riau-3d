import { describe, it, expect } from 'vitest';
import { placementFromFootprint, areaMoments } from '../../src/geo/placement.js';
import { toWorld } from '../../src/geo/regionTransform.js';

/** Persegi panjang 100 (lokal X) × 300 (lokal Z) di placement p, dalam koordinat dunia. */
const rect = (p) => [[-50, -150], [50, -150], [50, 150], [-50, 150]].map(([x, z]) => {
  const w = toWorld(p, x, z);
  return [w.x, w.z];
});

describe('placementFromFootprint', () => {
  it.each([0, 0.3, -0.7, 1.2])('memulihkan placement persegi panjang (yaw %f)', (yaw) => {
    const p = { x: 120, z: -40, yaw };
    const got = placementFromFootprint(rect(p));
    expect(got.x).toBeCloseTo(120, 9);
    expect(got.z).toBeCloseTo(-40, 9);
    expect(got.yaw).toBeCloseTo(yaw, 9);
  });

  it('sumbu tak berarah: footprint diputar π memberi yaw yang sama', () => {
    expect(placementFromFootprint(rect({ x: 0, z: 0, yaw: 0.4 + Math.PI })).yaw).toBeCloseTo(0.4, 9);
  });

  it('orientasi ring (CW/CCW) tidak berpengaruh; momen luas persegi panjang benar', () => {
    const r = rect({ x: 0, z: 0, yaw: 0 });
    expect(placementFromFootprint([...r].reverse()).yaw).toBeCloseTo(0, 9);
    const m = areaMoments(r);
    expect(m.area).toBeCloseTo(30000, 6);
    expect(m.sxx).toBeCloseTo((300 * 100 ** 3) / 12, 3);
    expect(m.szz).toBeCloseTo((100 * 300 ** 3) / 12, 3);
  });

  it('ring tak valid ditolak', () => {
    expect(() => placementFromFootprint([[0, 0], [1, 1]])).toThrow(RangeError);
    expect(() => placementFromFootprint([[0, 0], [1, 0], [2, 0]])).toThrow(RangeError);
  });
});
