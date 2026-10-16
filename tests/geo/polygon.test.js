import { describe, it, expect } from 'vitest';
import {
  cleanRing, signedArea, polygonArea, orientRing, polygonCentroid, pointInPolygon, ringBounds,
  boundsOverlap, clipPolygonToRect, clipPolylineToRect,
} from '../../src/geo/polygon.js';

const SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]];
const L_SHAPE = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
const RECT10 = { minX: 0, minZ: 0, maxX: 10, maxZ: 10 };

describe('polygon', () => {
  it('cleanRing membuang titik penutup & duplikat berurutan', () => {
    expect(cleanRing([[0, 0], [1, 0], [1, 0], [1, 1], [0, 0]])).toEqual([[0, 0], [1, 0], [1, 1]]);
  });

  it('signedArea / polygonArea / orientRing', () => {
    expect(signedArea(SQUARE)).toBe(100);
    expect(signedArea([...SQUARE].reverse())).toBe(-100);
    expect(polygonArea([...SQUARE].reverse())).toBe(100);
    expect(signedArea(orientRing([...SQUARE].reverse(), true))).toBe(100);
    expect(signedArea(orientRing(SQUARE, false))).toBe(-100);
    expect(polygonArea(L_SHAPE)).toBe(300);
  });

  it('polygonCentroid: persegi, bentuk L, degenerate', () => {
    expect(polygonCentroid(SQUARE)).toEqual({ x: 5, z: 5 });
    const c = polygonCentroid(L_SHAPE);
    expect(c.x).toBeCloseTo(25 / 3, 9);
    expect(c.z).toBeCloseTo(25 / 3, 9);
    expect(polygonCentroid([[0, 0], [2, 0], [4, 0]])).toEqual({ x: 2, z: 0 });
  });

  it('pointInPolygon', () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true);
    expect(pointInPolygon(15, 5, SQUARE)).toBe(false);
    expect(pointInPolygon(15, 15, L_SHAPE)).toBe(false);
    expect(pointInPolygon(5, 15, L_SHAPE)).toBe(true);
  });

  it('ringBounds & boundsOverlap', () => {
    expect(ringBounds(L_SHAPE)).toEqual({ minX: 0, minZ: 0, maxX: 20, maxZ: 20 });
    expect(boundsOverlap(RECT10, { minX: 10, minZ: 10, maxX: 20, maxZ: 20 })).toBe(true);
    expect(boundsOverlap(RECT10, { minX: 10.1, minZ: 0, maxX: 20, maxZ: 10 })).toBe(false);
  });

  it('clipPolygonToRect: potong separuh, di luar → [], di dalam → utuh', () => {
    const half = clipPolygonToRect(SQUARE, { minX: 5, minZ: -100, maxX: 100, maxZ: 100 });
    expect(polygonArea(half)).toBeCloseTo(50, 9);
    expect(ringBounds(half)).toEqual({ minX: 5, minZ: 0, maxX: 10, maxZ: 10 });
    expect(clipPolygonToRect(SQUARE, { minX: 20, minZ: 20, maxX: 30, maxZ: 30 })).toEqual([]);
    expect(polygonArea(clipPolygonToRect(L_SHAPE, { minX: -1, minZ: -1, maxX: 30, maxZ: 30 }))).toBe(300);
    expect(polygonArea(clipPolygonToRect(L_SHAPE, RECT10))).toBe(100);
  });

  it('clipPolylineToRect: masuk-keluar memecah polyline', () => {
    const line = [[-10, 5], [5, 5], [5, 20], [8, 20], [8, 5], [20, 5]];
    const parts = clipPolylineToRect(line, RECT10);
    expect(parts).toEqual([
      [[0, 5], [5, 5], [5, 10]],
      [[8, 10], [8, 5], [10, 5]],
    ]);
    expect(clipPolylineToRect([[20, 20], [30, 30]], RECT10)).toEqual([]);
    expect(clipPolylineToRect([[1, 1], [2, 2], [3, 1]], RECT10)).toEqual([[[1, 1], [2, 2], [3, 1]]]);
    // titik sudut tepat di tepi persegi: segmen luar yang hanya menyentuh tepi tidak menambah titik ganda
    expect(clipPolylineToRect([[-10, 5], [0, 5], [5, 5]], RECT10)).toEqual([[[0, 5], [5, 5]]]);
  });

  it('clipPolylineToRect: polyline tertutup (bundaran) di dalam persegi tetap utuh', () => {
    const loop = [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]];
    expect(clipPolylineToRect(loop, RECT10)).toEqual([loop]);
  });
});
