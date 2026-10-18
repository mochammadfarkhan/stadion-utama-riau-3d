import { describe, it, expect } from 'vitest';
import { UNRI_COLLIDER, colliderDataFromGround, createUnriCollider } from '../../src/districts/unri/collider.js';

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const flat = { normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };
/** Lereng 40 % di x > 100, 30 % di 50 < x ≤ 100, datar selain itu. */
const steep = {
  normalAt: (x, z, out = {}) => {
    const g = x > 100 ? 0.4 : x > 50 ? 0.3 : 0;
    const l = Math.hypot(g, 1);
    return Object.assign(out, { x: -g / l, y: 1 / l, z: 0 });
  },
};

describe('collider distrik UNRI', () => {
  it('air tidak walkable (kedalaman = jarak ke tepi); titian/jalan di atas air & pulau walkable', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', {
      water: [{ rings: [sq(0, 0, 40, 40), sq(15, 15, 25, 25)] }],
      roads: [{ pts: [[-10, 5], [50, 5]], w: 2 }],
      circles: [],
    });
    expect(c.isWalkable(10, 30)).toBe(false);
    expect(c.penetration(10, 30)).toBeCloseTo(Math.hypot(5, 5), 9);
    expect(c.isWalkable(10, 5)).toBe(true);
    expect(c.isWalkable(20, 20)).toBe(true);
    expect(c.isWalkable(60, 30)).toBe(true);
  });

  it('rintangan lingkaran memblok sampai r + clearance', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', { circles: [{ x: 0, z: 0, r: 0.2 }] });
    expect(c.isWalkable(0.5, 0)).toBe(false);
    expect(c.penetration(0.5, 0)).toBeCloseTo(0.2 + UNRI_COLLIDER.clearance - 0.5, 9);
    expect(c.isWalkable(0.7, 0)).toBe(true);
  });

  it('lereng > 35 % tidak walkable; 30 % walkable', () => {
    const c = createUnriCollider({ terrain: steep });
    expect(c.gradeAt(120, 0)).toBeCloseTo(0.4, 9);
    expect(c.isWalkable(120, 0)).toBe(false);
    expect(c.penetration(120, 0)).toBe(UNRI_COLLIDER.steepPenetration);
    expect(c.isWalkable(80, 0)).toBe(true);
    expect(c.isWalkable(0, 0)).toBe(true);
  });

  it('removeChunk / chunk belum dimuat = terbuka; addChunk ulang mengganti; NaN tidak walkable; kamera 2D bebas', () => {
    const c = createUnriCollider({ terrain: flat });
    c.addChunk('0_0', { water: [{ rings: [sq(0, 0, 40, 40)] }] });
    expect(c.isWalkable(10, 10)).toBe(false);
    c.addChunk('0_0', { water: [{ rings: [sq(100, 100, 140, 140)] }] });
    expect(c.isWalkable(10, 10)).toBe(true);
    expect(c.isWalkable(110, 110)).toBe(false);
    expect(c.removeChunk('0_0')).toBe(true);
    expect(c.isWalkable(110, 110)).toBe(true);
    expect(c.removeChunk('0_0')).toBe(false);
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
    expect(c.penetration(Infinity, 0)).toBe(Infinity);
    expect(c.isCameraClear(10, 10)).toBe(true);
    expect(c.stats()).toEqual({ chunks: 0, cells: 0 });
  });

  it('colliderDataFromGround: air, jalan + trotoar, lingkaran PJU/bangku/tong (keep menyaring)', () => {
    const data = {
      areas: [{ kind: 'water', rings: [sq(0, 0, 1, 1)] }, { kind: 'parking', rings: [sq(0, 0, 1, 1)] }],
      roads: [{ pts: [[0, 0], [1, 0]], w: 7 }],
      walks: [{ pts: [[0, 0], [0, 1]], w: 2 }],
      props: { lamps: [{ x: 1, z: 1, yaw: 0 }], benches: [{ x: 5, z: 5, yaw: 0 }], bins: [{ x: 9, z: 9 }] },
    };
    const d = colliderDataFromGround(data, (p) => p.x < 8);
    expect(d.water).toHaveLength(1);
    expect(d.roads).toHaveLength(2);
    expect(d.circles.map((c) => c.r)).toEqual([UNRI_COLLIDER.circle.lamp, UNRI_COLLIDER.circle.bench]);
  });
});
