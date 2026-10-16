import { describe, it, expect } from 'vitest';
import { isCameraClear, OBSTACLES } from '../src/regions/stadion/collider.js';
import { STADIUM } from '../src/config/constants.js';

describe('isCameraClear', () => {
  it('ruang terbuka di dalam mangkuk (tengah lapangan) dan di plaza luar bebas', () => {
    expect(isCameraClear(0, 0)).toBe(true);
    expect(isCameraClear(0, -(STADIUM.outerSemiZ + 120))).toBe(true);
  });
  it('di dalam dinding tribun/cangkang (antara elips dalam dan luar) terhalang', () => {
    const x = (STADIUM.innerSemiX + STADIUM.outerSemiX) / 2;
    expect(isCameraClear(x, 0)).toBe(false);
  });
  it('di dalam tugu solid terhalang', () => {
    const o = OBSTACLES[0];
    expect(isCameraClear(o.x, o.z)).toBe(false);
  });
  it('koordinat tidak valid dianggap terhalang (aman: kamera ditarik mendekat)', () => {
    expect(isCameraClear(Number.NaN, 0)).toBe(false);
    expect(isCameraClear(0, undefined)).toBe(false);
  });
});
