import { describe, it, expect } from 'vitest';
import { createMeshBuilder, addFace } from '../../tools/citybake/geometry/meshBuilder.js';
import { hexToLinear, shade } from '../../tools/citybake/geometry/colors.js';
import { addFlatPolygon } from '../../tools/citybake/geometry/areas.js';
import { WHITE, rect, faces, bbox } from './meshTestUtils.js';

describe('colors', () => {
  it('hexToLinear: sRGB → linear', () => {
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2159, 3);
    expect(() => hexToLinear('merah')).toThrow(TypeError);
    expect(shade([0.5, 1, 0.2], 1.5)).toEqual([0.75, 1, 0.30000000000000004]);
  });
});

describe('meshBuilder', () => {
  it('addFace membalik urutan agar normal searah expected', () => {
    const b = createMeshBuilder();
    addFace(b, [[0, 0, 0], [1, 0, 0], [1, 0, 1]], WHITE, [0, -1, 0]);
    const a = b.toArrays();
    expect(faces(a)[0].n[1]).toBeLessThan(0);
    expect(Array.from(a.normals.slice(0, 3))).toEqual([0, -1, 0]);
    expect(createMeshBuilder().toArrays()).toBeNull();
  });
});

describe('addFlatPolygon', () => {
  it('persegi → 2 segitiga menghadap +Y pada y yang diminta', () => {
    const b = createMeshBuilder();
    expect(addFlatPolygon(b, [rect(0, 0, 10, 10)], 0.04, WHITE)).toBe(2);
    const a = b.toArrays();
    for (const f of faces(a)) expect(f.n[1]).toBeGreaterThan(0);
    expect(bbox(a)).toEqual({ min: [-5, 0.03999999910593033, -5], max: [5, 0.03999999910593033, 5] });
  });

  it('poligon dengan lubang: 8 segitiga, orientasi ring input tidak berpengaruh', () => {
    const b = createMeshBuilder();
    expect(addFlatPolygon(b, [[...rect(0, 0, 10, 10)].reverse(), rect(0, 0, 4, 4)], 0, WHITE)).toBe(8);
    for (const f of faces(b.toArrays())) expect(f.n[1]).toBeGreaterThan(0);
  });
});
