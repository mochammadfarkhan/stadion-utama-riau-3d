import { describe, it, expect } from 'vitest';
import { createMeshBuilder } from '../../tools/citybake/geometry/meshBuilder.js';
import { addBuilding, rectangleFrame } from '../../tools/citybake/geometry/buildings.js';
import { WHITE, rect, faces, bbox } from './meshTestUtils.js';

describe('rectangleFrame', () => {
  it('persegi panjang → sisi pertama adalah sisi panjang', () => {
    const f = rectangleFrame(rect(0, 0, 6, 10));
    expect(f).toHaveLength(4);
    expect(Math.hypot(f[1][0] - f[0][0], f[1][1] - f[0][1])).toBeCloseTo(10, 9);
  });
  it('titik segaris dibuang; bentuk L & jajar genjang → null', () => {
    expect(rectangleFrame([[0, 0], [5, 0], [10, 0], [10, 6], [0, 6]])).toHaveLength(4);
    expect(rectangleFrame([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]])).toBeNull();
    expect(rectangleFrame([[0, 0], [10, 0], [14, 6], [4, 6]])).toBeNull();
  });
});

describe('addBuilding', () => {
  const build = (opts) => {
    const walls = createMeshBuilder();
    const roofs = createMeshBuilder();
    const kind = addBuilding({ walls, roofs }, { wallRgb: WHITE, roofRgb: [0.5, 0.2, 0.1], ...opts });
    return { kind, walls, roofs };
  };

  it('atap datar: 4 dinding (8 segitiga) + atap 2 segitiga; bbox = footprint × tinggi', () => {
    const { kind, walls, roofs } = build({ rings: [rect(0, 0, 20, 10)], height: 9.6 });
    expect(kind).toBe('flat');
    expect(walls.triangleCount).toBe(8);
    expect(roofs.triangleCount).toBe(2);
    const bw = bbox(walls.toArrays());
    expect(bw.min).toEqual([-10, 0, -5]);
    expect(bw.max[1]).toBeCloseTo(9.6, 5);
  });

  it('normal dinding menghadap keluar (menjauhi pusat footprint), atap ke atas', () => {
    const { walls, roofs } = build({ rings: [[...rect(0, 0, 20, 10)].reverse()], height: 6 });
    for (const f of faces(walls.toArrays())) {
      expect(f.n[0] * f.mid[0] + f.n[2] * f.mid[2]).toBeGreaterThan(0);
      expect(Math.abs(f.n[1])).toBeLessThan(1e-6);
    }
    for (const f of faces(roofs.toArrays())) expect(f.n[1]).toBeGreaterThan(0);
  });

  it('atap pelana: dinding 8 + 2 segitiga ujung, atap 4 segitiga; bubungan di sumbu panjang', () => {
    const { kind, walls, roofs } = build({ rings: [rect(0, 0, 8, 6)], height: 3.2, gable: true });
    expect(kind).toBe('gable');
    expect(walls.triangleCount).toBe(10);
    expect(roofs.triangleCount).toBe(4);
    const br = bbox(roofs.toArrays());
    expect(br.max[1]).toBeCloseTo(3.2 + 3 * Math.tan(Math.PI / 6), 4);
    for (const f of faces(roofs.toArrays())) expect(f.n[1]).toBeGreaterThan(0);
    for (const f of faces(walls.toArrays())) expect(f.n[0] * f.mid[0] + f.n[2] * f.mid[2]).toBeGreaterThan(0);
  });

  it('gable diminta tetapi bentuk L → atap datar', () => {
    const { kind } = build({ rings: [[[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]]], height: 3, gable: true });
    expect(kind).toBe('flat');
  });

  it('lubang (courtyard): dinding dalam menghadap ke lubang', () => {
    const { walls, roofs } = build({ rings: [rect(0, 0, 30, 30), rect(0, 0, 10, 10)], height: 9 });
    expect(walls.triangleCount).toBe(16);
    expect(roofs.triangleCount).toBe(8);
    const inner = faces(walls.toArrays()).filter((f) => Math.max(Math.abs(f.mid[0]), Math.abs(f.mid[2])) < 6);
    expect(inner).toHaveLength(8);
    for (const f of inner) expect(f.n[0] * f.mid[0] + f.n[2] * f.mid[2]).toBeLessThan(0);
  });
});
