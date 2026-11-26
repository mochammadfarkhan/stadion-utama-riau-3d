import { describe, expect, it } from 'vitest';
import { aoProjScale } from '../src/core/postprocessing/CityAoPass.js';

describe('aoProjScale', () => {
  it('fov 90° → setengah tinggi piksel', () => {
    expect(aoProjScale(1000, 90)).toBeCloseTo(500, 6);
  });

  it('fov 20° pada 1080 px ≈ 3062 px/m pada 1 m', () => {
    expect(aoProjScale(1080, 20)).toBeCloseTo(1080 / (2 * Math.tan(Math.PI / 18)), 6);
    expect(aoProjScale(1080, 20)).toBeCloseTo(3062.5, 0);
  });
});
