import { describe, it, expect } from 'vitest';
import { createRunner, stepRunner } from '../src/sim/runnerSim.js';
import { laneLength } from '../src/sim/trackPath.js';
import { deepFreeze, hasNaN } from './helpers.js';

describe('createRunner', () => {
  it('field dasar', () => {
    const r = createRunner({ id: 'r1', lane: 2, speed: 4 });
    expect(r).toMatchObject({ id: 'r1', lane: 2, speed: 4, dist: 0 });
    expect(typeof r.phase).toBe('number');
  });
});

describe('stepRunner', () => {
  it('maju sesuai kecepatan (variasi ±10%)', () => {
    const r = createRunner({ id: 'a', lane: 1, speed: 4 });
    const n = stepRunner(r, 1);
    expect(n.dist).toBeGreaterThan(3.5);
    expect(n.dist).toBeLessThan(4.5);
    expect(n.v).toBeGreaterThanOrEqual(3.6 - 1e-6);
    expect(n.v).toBeLessThanOrEqual(4.4 + 1e-6);
  });
  it('wrap modulo panjang lane', () => {
    const L = laneLength(3);
    const r = createRunner({ id: 'b', lane: 3, speed: 5, dist: L - 1 });
    const n = stepRunner(r, 1);
    expect(n.dist).toBeGreaterThanOrEqual(0);
    expect(n.dist).toBeLessThan(L);
    expect(n.dist).toBeLessThan(10);
  });
  it('variasi halus: v berubah kecil antar langkah', () => {
    let r = createRunner({ id: 'c', lane: 1, speed: 4 });
    let prev = stepRunner(r, 1 / 60).v;
    for (let i = 0; i < 600; i += 1) {
      r = stepRunner(r, 1 / 60);
      expect(Math.abs(r.v - prev)).toBeLessThan(0.05);
      prev = r.v;
    }
  });
  it('immutability & dt tidak valid', () => {
    const r = deepFreeze(createRunner({ id: 'd', lane: 1, speed: 3 }));
    const n = stepRunner(r, 0.5);
    expect(n).not.toBe(r);
    expect(r.dist).toBe(0);
    expect(hasNaN(stepRunner(r, NaN))).toBe(false);
    expect(stepRunner(r, 0).dist).toBe(0);
  });
});
