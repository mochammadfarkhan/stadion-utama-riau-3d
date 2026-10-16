import { describe, it, expect } from 'vitest';
import { pointInPolygon, convexHull } from '../src/shared/polygon.js';

describe('pointInPolygon', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  it('titik di dalam/luar persegi; input tak valid = di luar', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
    expect(pointInPolygon(Number.NaN, 5, square)).toBe(false);
    expect(pointInPolygon(1, 1, [[0, 0], [1, 1]])).toBe(false);
    expect(pointInPolygon(1, 1, null)).toBe(false);
  });
  it('poligon cekung (bentuk L)', () => {
    const L = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
    expect(pointInPolygon(2, 8, L)).toBe(true);
    expect(pointInPolygon(8, 8, L)).toBe(false);
  });
});

describe('convexHull', () => {
  it('membuang titik dalam, kolinear, dan tak hingga; urutan berlawanan jarum jam', () => {
    expect(convexHull([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [5, 5], [Number.NaN, 1]]))
      .toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
  it('kurang dari 3 titik dikembalikan sebagai salinan', () => {
    const pts = [[1, 2]];
    const hull = convexHull(pts);
    expect(hull).toEqual([[1, 2]]);
    expect(hull[0]).not.toBe(pts[0]);
  });
});
