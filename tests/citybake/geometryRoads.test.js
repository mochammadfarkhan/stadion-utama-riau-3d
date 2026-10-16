import { describe, it, expect } from 'vitest';
import { createMeshBuilder } from '../../tools/citybake/geometry/meshBuilder.js';
import { addRibbon } from '../../tools/citybake/geometry/roads.js';
import { WHITE, faces, bbox } from './meshTestUtils.js';

describe('addRibbon', () => {
  it('garis lurus 2 titik → 2 segitiga selebar width, menghadap atas', () => {
    const b = createMeshBuilder();
    expect(addRibbon(b, [[0, 0], [100, 0]], 14, 0.08, WHITE)).toBe(2);
    const a = b.toArrays();
    const bb = bbox(a);
    expect(bb.min[0]).toBe(0);
    expect(bb.max[0]).toBe(100);
    expect(bb.max[2] - bb.min[2]).toBeCloseTo(14, 6);
    for (const f of faces(a)) expect(f.n[1]).toBeGreaterThan(0);
  });

  it('tikungan 90°: miter = half·√2; titik duplikat diabaikan', () => {
    const b = createMeshBuilder();
    expect(addRibbon(b, [[0, 0], [10, 0], [10, 0], [10, 10]], 2, 0, WHITE)).toBe(4);
    const p = b.toArrays().positions;
    const corner = [[p[6], p[8]], [p[9], p[11]]];
    for (const [x, z] of corner) expect(Math.hypot(x - 10, z)).toBeCloseTo(Math.SQRT2, 6);
  });

  it('tikungan sangat tajam: miter dibatasi 2 × setengah lebar', () => {
    const b = createMeshBuilder();
    addRibbon(b, [[0, 0], [10, 0], [0, 0.5]], 2, 0, WHITE);
    const p = b.toArrays().positions;
    expect(Math.hypot(p[6] - 10, p[8])).toBeLessThanOrEqual(2 + 1e-5);
    for (const f of faces(b.toArrays())) expect(f.n[1]).toBeGreaterThanOrEqual(0);
  });

  it('kurang dari 2 titik unik → 0 segitiga', () => {
    expect(addRibbon(createMeshBuilder(), [[1, 1], [1, 1]], 4, 0, WHITE)).toBe(0);
  });

  it('polyline tertutup (bundaran): tanpa NaN, sambungan penutup ber-miter', () => {
    const b = createMeshBuilder();
    expect(addRibbon(b, [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 2, 0.1, WHITE)).toBe(8);
    const a = b.toArrays();
    expect(a.positions.every(Number.isFinite)).toBe(true);
    const p = a.positions;
    const last = p.length - 6;
    // Pasangan vertex terakhir = pasangan pertama (cincin rapat), dan miter di (0,0) = half·√2.
    for (let k = 0; k < 6; k += 1) expect(p[last + k]).toBeCloseTo(p[k], 6);
    for (const i of [0, 3]) expect(Math.hypot(p[i], p[i + 2])).toBeCloseTo(Math.SQRT2, 6);
    for (const f of faces(a)) expect(f.n[1]).toBeGreaterThan(0);
  });

  it('bolak-balik 2 titik unik (A→B→A) tidak dianggap cincin dan tetap terhingga', () => {
    const b = createMeshBuilder();
    expect(addRibbon(b, [[0, 0], [10, 0], [0, 0]], 2, 0, WHITE)).toBe(4);
    expect(b.toArrays().positions.every(Number.isFinite)).toBe(true);
  });
});
