import { describe, it, expect } from 'vitest';
import { sourceRect, projectToView, clampToEdge, flipRowsInPlace, snapRect } from '../src/shared/minimapMath.js';

const WORLD_HALF = 700;
const BASE_PX = 1400; // 1 px = 1 m agar angkanya mudah dicek

describe('sourceRect', () => {
  it('jendela di tengah dunia: sisi 2×halfExtent, berpusat di titik fokus (utara = atas)', () => {
    const r = sourceRect({ x: 0, z: 0 }, 160, WORLD_HALF, BASE_PX);
    expect(r).toEqual({ sx: 540, sy: 540, sw: 320, sh: 320 });
  });
  it('fokus bergeser: x ke kanan menambah sx, z ke selatan menambah sy', () => {
    const r = sourceRect({ x: 100, z: -50 }, 160, WORLD_HALF, BASE_PX);
    expect(r.sx).toBe(640);
    expect(r.sy).toBe(490);
  });
  it('input rusak jatuh ke tengah (tanpa NaN)', () => {
    const r = sourceRect({ x: Number.NaN, z: undefined }, 160, WORLD_HALF, BASE_PX);
    expect(Number.isFinite(r.sx) && Number.isFinite(r.sy)).toBe(true);
  });
});

describe('projectToView', () => {
  it('titik fokus di tengah tampilan; +x ke kanan, +z ke bawah', () => {
    expect(projectToView({ x: 10, z: 10 }, { x: 10, z: 10 }, 160, 200)).toMatchObject({ x: 100, y: 100, inside: true });
    const p = projectToView({ x: 90, z: 40 }, { x: 10, z: 10 }, 160, 200);
    expect(p.x).toBeCloseTo(100 + 80 * (200 / 320), 6);
    expect(p.y).toBeCloseTo(100 + 30 * (200 / 320), 6);
  });
  it('di luar jendela: inside=false', () => {
    expect(projectToView({ x: 400, z: 0 }, { x: 0, z: 0 }, 160, 200).inside).toBe(false);
  });
});

describe('clampToEdge', () => {
  it('titik di dalam tidak berubah; di luar dijepit ke tepi (dengan margin) sepanjang arah dari pusat', () => {
    expect(clampToEdge(50, 60, 200, 10)).toEqual({ x: 50, y: 60, angle: expect.any(Number) });
    const c = clampToEdge(500, 100, 200, 10);
    expect(c.x).toBeCloseTo(190, 6);
    expect(c.y).toBeCloseTo(100, 6);
    expect(c.angle).toBeCloseTo(0, 6);
    const d = clampToEdge(100, -300, 200, 10);
    expect(d.y).toBeCloseTo(10, 6);
    expect(d.angle).toBeCloseTo(-Math.PI / 2, 6);
  });
});

describe('flipRowsInPlace', () => {
  it('membalik urutan baris (readPixels berasal dari kiri-bawah)', () => {
    const w = 2; const h = 3;
    const px = new Uint8ClampedArray([
      1, 1, 1, 1, 2, 2, 2, 2, // baris 0
      3, 3, 3, 3, 4, 4, 4, 4, // baris 1
      5, 5, 5, 5, 6, 6, 6, 6, // baris 2
    ]);
    flipRowsInPlace(px, w, h);
    expect(Array.from(px.slice(0, 4))).toEqual([5, 5, 5, 5]);
    expect(Array.from(px.slice(16, 20))).toEqual([1, 1, 1, 1]); // baris 2 = baris 0 lama
    expect(Array.from(px.slice(8, 12))).toEqual([3, 3, 3, 3]); // baris tengah tetap
    expect(Array.from(px.slice(4, 8))).toEqual([6, 6, 6, 6]);
  });
});

describe('snapRect (drawImage tile tanpa garis sambungan)', () => {
  it('membulatkan tepi, bukan lebar: dua tile bersebelahan berbagi tepi piksel yang sama', () => {
    const a = snapRect({ x: 10.4, y: 20.6, w: 99.3, h: 99.3 });
    const b = snapRect({ x: 10.4 + 99.3, y: 20.6, w: 99.3, h: 99.3 });
    expect(a).toEqual({ x: 10, y: 21, w: 100, h: 99 });
    expect(b.x).toBe(a.x + a.w);
    for (const v of [...Object.values(a), ...Object.values(b)]) expect(Number.isInteger(v)).toBe(true);
  });
});
