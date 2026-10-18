import { describe, it, expect } from 'vitest';
import { createCompositeCollider, createDistrictCollider } from '../src/core/Collider.js';
import { defineRegion } from '../src/regions/Region.js';

const square = (x0, z0, s) => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]];
const bounds = (x0, z0, s) => ({ minX: x0, minZ: z0, maxX: x0 + s, maxZ: z0 + s });

describe('collider distrik berantai (region → distrik → tile)', () => {
  const tile = {
    isWalkable: (x) => x < 150, // "gedung kota" di x ≥ 150
    isCameraClear: () => true,
    penetration: (x) => (x >= 150 ? x - 150 : 0),
  };
  const district = {
    isWalkable: (x, z) => !(x > 100 && x < 120 && z > 100 && z < 120), // "danau" distrik
    isCameraClear: () => true,
    penetration: (x, z) => (x > 100 && x < 120 && z > 100 && z < 120 ? 5 : 0),
  };

  it('di dalam distrik: rantai (distrik DAN tile); di luar: tile saja; pencabut idempoten', () => {
    const dc = createDistrictCollider({ fallback: tile });
    const off = dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: district });
    expect(dc.isWalkable(50, 50)).toBe(true);
    expect(dc.isWalkable(110, 110)).toBe(false);
    expect(dc.isWalkable(160, 50)).toBe(false);
    expect(dc.penetration(110, 110)).toBe(5);
    expect(dc.penetration(170, 50)).toBe(20);
    expect(dc.isWalkable(300, 300)).toBe(false);
    expect(dc.isWalkable(Number.NaN, 0)).toBe(false);
    expect(dc.penetration(Number.NaN, 0)).toBe(Infinity);
    off();
    off();
    expect(dc.isWalkable(110, 110)).toBe(true);
  });

  it('sebagai fallback komposit: region menang di dalam mask region', () => {
    const region = defineRegion({ id: 'r', placement: { x: 110, z: 110, yaw: 0 }, mask: square(-5, -5, 10), build: async () => ({}) });
    const dc = createDistrictCollider({ fallback: tile });
    dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: district });
    const comp = createCompositeCollider({ regions: [{ region, colliders: { isWalkable: () => true, isCameraClear: () => true } }], fallback: dc });
    expect(comp.isWalkable(110, 110)).toBe(true);
    expect(comp.isWalkable(118, 118)).toBe(false);
  });

  it('id sama menggantikan; setFallback; colliders tak lengkap ditolak', () => {
    const dc = createDistrictCollider();
    dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: district });
    dc.addDistrict({ id: 'uji', boundary: square(0, 0, 200), bounds: bounds(0, 0, 200), colliders: { isWalkable: () => true, isCameraClear: () => true } });
    expect(dc.isWalkable(110, 110)).toBe(true);
    dc.setFallback(tile);
    expect(dc.isWalkable(160, 50)).toBe(false);
    expect(() => dc.addDistrict({ id: 'x', boundary: [], bounds: bounds(0, 0, 1), colliders: {} })).toThrow(TypeError);
  });
});
