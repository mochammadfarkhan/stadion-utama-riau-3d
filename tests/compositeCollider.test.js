import { describe, it, expect } from 'vitest';
import { createCollider, createCompositeCollider, localized } from '../src/core/Collider.js';
import { stadionColliders, createStadionColliders } from '../src/regions/stadion/collider.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { defineRegion } from '../src/regions/Region.js';

const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];

describe('collider komposit', () => {
  it('titik di dalam mask region → collider region dengan koordinat lokal; di luar → fallback', () => {
    const calls = [];
    const region = defineRegion({ id: 'uji', placement: { x: 100, z: 0, yaw: Math.PI / 2 }, mask: square, build: async () => ({}) });
    const colliders = {
      isWalkable: (lx, lz) => { calls.push([lx, lz]); return false; },
      isCameraClear: () => false,
    };
    const comp = createCompositeCollider({ regions: [{ region, colliders }], fallback: { isWalkable: () => true, isCameraClear: () => true } });
    expect(comp.isWalkable(100, -5)).toBe(false);
    expect(calls[0][0]).toBeCloseTo(5, 9);
    expect(calls[0][1]).toBeCloseTo(0, 9);
    expect(comp.isCameraClear(100, 3)).toBe(false);
    expect(comp.isWalkable(200, 0)).toBe(true);
    expect(comp.isCameraClear(200, 0)).toBe(true);
  });

  it('tanpa fallback: di luar semua region terbuka; koordinat tak hingga selalu terhalang', () => {
    const comp = createCompositeCollider();
    expect(comp.isWalkable(5, 5)).toBe(true);
    expect(comp.isWalkable(Number.NaN, 0)).toBe(false);
    expect(comp.isCameraClear(0, undefined)).toBe(false);
  });

  it('localized mengubah koordinat dunia ke lokal region', () => {
    const region = defineRegion({ id: 'geser', placement: { x: 50, z: -20, yaw: 0 }, mask: square, build: async () => ({}) });
    const seen = [];
    const loc = localized(region, { isWalkable: (x, z) => { seen.push([x, z]); return true; }, isCameraClear: () => true });
    loc.isWalkable(55, -18);
    expect(seen).toEqual([[5, 2]]);
    expect(loc.isCameraClear(0, 0)).toBe(true);
  });

  it('paritas: komposit stadion = collider region pada koordinat lokal (placement OSM) di seluruh grid', () => {
    const comp = createCompositeCollider({
      regions: [{ region: stadionRegion, colliders: stadionColliders }],
      fallback: localized(stadionRegion, stadionColliders),
    });
    const loc = localized(stadionRegion, stadionColliders);
    const mismatch = [];
    for (let x = -700; x <= 700; x += 23) {
      for (let z = -700; z <= 700; z += 23) {
        if (comp.isWalkable(x, z) !== loc.isWalkable(x, z)) mismatch.push(['walk', x, z]);
        if (comp.isCameraClear(x, z) !== loc.isCameraClear(x, z)) mismatch.push(['cam', x, z]);
      }
    }
    expect(mismatch).toEqual([]);
  });
});

describe('createCollider & collider stadion', () => {
  it('createCollider wajib diberi isWalkable', () => {
    expect(() => createCollider({ x: 0, z: 0 })).toThrow(TypeError);
  });
  it('createStadionColliders dapat diinjeksi data site/stadium', () => {
    const c = createStadionColliders();
    expect(c.isWalkable(0, 0)).toBe(true);
    expect(c.obstacles.map((o) => o.name)).toEqual(['tuguLancangKuning', 'tuguTanjak']);
  });
});
