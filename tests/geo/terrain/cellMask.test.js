import { describe, it, expect } from 'vitest';
import { rasterizeRing } from '../../../src/geo/terrain/cellMask.js';
import { pointInPolygon } from '../../../src/geo/polygon.js';

describe('rasterizeRing', () => {
  it('persegi 10 × 8 m pada grid 4 m: sel berpusat di dalam saja', () => {
    // ring x 1..11, z 2..10; pusat sel x = 2, 6, 10, 14; z = 2, 6, 10 → kolom 0..2, baris: z=2 tepat di tepi
    const ring = [[1, 2], [11, 2], [11, 10], [1, 10]];
    const m = rasterizeRing(ring, { minX: 0, minZ: 0, cell: 4, cols: 4, rows: 3 });
    expect([...m]).toEqual([
      1, 1, 1, 0, // z = 2 (pusat tepat di tepi bawah 2: zi > zc salah untuk 2 → ikut aturan genap-ganjil)
      1, 1, 1, 0, // z = 6
      0, 0, 0, 0, // z = 10 (tepat di tepi atas: tidak masuk)
    ]);
  });

  it('cocok dengan pointInPolygon untuk poligon cekung (bentuk L) di 400 sel', () => {
    const ring = [[0, 0], [60, 0], [60, 20], [20, 20], [20, 70], [0, 70]];
    const grid = { minX: -6, minZ: -6, cell: 4, cols: 20, rows: 20 };
    const m = rasterizeRing(ring, grid);
    for (let r = 0; r < grid.rows; r += 1) {
      for (let c = 0; c < grid.cols; c += 1) {
        const x = grid.minX + (c + 0.5) * grid.cell;
        const z = grid.minZ + (r + 0.5) * grid.cell;
        expect(m[r * grid.cols + c]).toBe(pointInPolygon(x, z, ring) ? 1 : 0);
      }
    }
  });

  it('ring < 3 titik → semua 0; grid tak valid → RangeError', () => {
    expect([...rasterizeRing([[0, 0], [1, 1]], { minX: 0, minZ: 0, cell: 1, cols: 2, rows: 1 })]).toEqual([0, 0]);
    expect(() => rasterizeRing([], { minX: 0, minZ: 0, cell: 0, cols: 1, rows: 1 })).toThrow(RangeError);
  });
});
