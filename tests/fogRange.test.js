import { describe, it, expect } from 'vitest';
import { fogRange } from '../src/world/TimeOfDay.js';

describe('fogRange (batas muat kota)', () => {
  it('tanpa batas / di bawah batas: tidak berubah', () => {
    expect(fogRange(220, 1100)).toEqual({ near: 220, far: 1100 });
    expect(fogRange(120, 700, 1000)).toEqual({ near: 120, far: 700 });
  });
  it('di atas batas: far = batas, near diskalakan proporsional', () => {
    const r = fogRange(220, 1100, 1000);
    expect(r.far).toBe(1000);
    expect(r.near).toBeCloseTo(200, 9);
  });
});
