import { describe, it, expect } from 'vitest';
import { parkingSlots, visibleOrder, assignVariants, seedOf, MOTOR_SLOT, VARIANT_WEIGHTS } from '../src/sim/parkingSlots.js';
import { pointInPolygon } from '../src/geo/polygon.js';

const rect = [[0, 0], [20, 0], [20, 10], [0, 10]];
const rotate = (ring, a) => ring.map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]);

/** Sudut jejak motor (lebar 2·halfW, panjang 2·halfL) di slot; moncong = −Z lokal. */
function corners(s) {
  const f = { x: -Math.sin(s.rotY), z: -Math.cos(s.rotY) };
  const r = { x: f.z, z: -f.x };
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [
    s.x + r.x * MOTOR_SLOT.halfW * a + f.x * MOTOR_SLOT.halfL * b,
    s.z + r.z * MOTOR_SLOT.halfW * a + f.z * MOTOR_SLOT.halfL * b,
  ]);
}

describe('parkingSlots', () => {
  it('persegi 20 × 10 m: 3 baris × 22 motor, semua jejak di dalam poligon', () => {
    const slots = parkingSlots(rect);
    expect(slots).toHaveLength(66);
    slots.forEach((s) => corners(s).forEach(([x, z]) => expect(pointInPolygon(x, z, rect)).toBe(true)));
  });
  it('baris pertama pasangan menghadap −v, baris kedua +v (moncong ke lorong)', () => {
    const slots = parkingSlots(rect);
    const rows = [...new Set(slots.map((s) => s.z))].sort((a, b) => a - b);
    expect(rows).toEqual([1.58, 3.63, 7.03]);
    expect(slots.find((s) => s.z === 1.58).rotY).toBe(0);
    expect(Math.abs(slots.find((s) => s.z === 3.63).rotY)).toBeCloseTo(Math.PI, 3);
    expect(slots.find((s) => s.z === 7.03).rotY).toBe(0);
  });
  it('poligon diputar 30°: jumlah sama, tetap di dalam', () => {
    const ring = rotate(rect, Math.PI / 6);
    const slots = parkingSlots(ring);
    expect(slots).toHaveLength(66);
    slots.forEach((s) => corners(s).forEach(([x, z]) => expect(pointInPolygon(x, z, ring)).toBe(true)));
  });
  it('kasus tepi: ring tidak valid/terlalu kecil → []; area besar dibatasi maxSlots; deterministik', () => {
    expect(parkingSlots([[0, 0], [1, 0]])).toEqual([]);
    expect(parkingSlots(null)).toEqual([]);
    expect(parkingSlots([[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([]);
    expect(parkingSlots([[0, 0], [200, 0], [200, 200], [0, 200]])).toHaveLength(MOTOR_SLOT.maxSlots);
    expect(parkingSlots(rect)).toEqual(parkingSlots(rect));
  });
});

describe('urutan tampil, varian, benih', () => {
  it('visibleOrder: permutasi deterministik; benih lain urutan lain', () => {
    const a = visibleOrder(50, 1);
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(visibleOrder(50, 1)).toEqual(a);
    expect(visibleOrder(50, 2)).not.toEqual(a);
    expect(visibleOrder(0, 1)).toEqual([]);
  });
  it('assignVariants mengikuti bobot ±0,03 untuk 4000 slot', () => {
    const v = assignVariants(4000, 7);
    for (const [id, w] of VARIANT_WEIGHTS) expect(Math.abs(v.filter((x) => x === id).length / 4000 - w)).toBeLessThan(0.03);
    expect(assignVariants(10, 7)).toEqual(assignVariants(10, 7));
  });
  it('seedOf stabil dan tak bertanda', () => {
    expect(seedOf(-969.2, 970.4)).toBe(seedOf(-969.2, 970.4));
    expect(seedOf(-969.2, 970.4)).toBeGreaterThanOrEqual(0);
    expect(seedOf(1, 2)).not.toBe(seedOf(2, 1));
  });
});
