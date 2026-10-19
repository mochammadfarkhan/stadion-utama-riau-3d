import { describe, expect, it } from 'vitest';
import { distanceToRings, onRectEdge, pointSegmentDistance, refineTriangles } from '../../src/districts/unri/waterEdge.js';
import { waterPlaneGeometry } from '../../src/districts/unri/water.js';

const SQUARE = [[0, 0], [20, 0], [20, 20], [0, 20]];

describe('waterEdge', () => {
  it('pointSegmentDistance: tegak lurus, ujung, segmen nol', () => {
    expect(pointSegmentDistance(5, 3, [0, 0], [10, 0])).toBeCloseTo(3);
    expect(pointSegmentDistance(-3, 4, [0, 0], [10, 0])).toBeCloseTo(5);
    expect(pointSegmentDistance(3, 4, [0, 0], [0, 0])).toBeCloseTo(5);
  });

  it('distanceToRings: jarak ke tepi terdekat, lubang ikut dihitung', () => {
    expect(distanceToRings(10, 10, [SQUARE])).toBeCloseTo(10);
    expect(distanceToRings(2, 10, [SQUARE])).toBeCloseTo(2);
    const hole = [[8, 8], [12, 8], [12, 12], [8, 12]];
    expect(distanceToRings(10, 10, [SQUARE, hole])).toBeCloseTo(2);
  });

  it('distanceToRings: tepi pada garis potong chunk dilewati', () => {
    const rect = { minX: 0, minZ: -999, maxX: 999, maxZ: 999 };
    expect(onRectEdge([0, 3], [0, 9], rect)).toBe(true);
    expect(onRectEdge([0, 3], [4, 9], rect)).toBe(false);
    expect(distanceToRings(2, 10, [SQUARE])).toBeCloseTo(2, 5);
    expect(distanceToRings(2, 10, [SQUARE], rect)).toBeCloseTo(10, 5); // sisi x = 0 adalah garis potong
  });

  it('refineTriangles: semua tepi <= batas, luas sama, tanpa T-junction (tepi dipakai 1-2 segitiga)', () => {
    const verts = [[0, 0], [30, 0], [30, 9], [0, 3]];
    const faces = [[0, 1, 2], [0, 2, 3]];
    const r = refineTriangles(verts, faces, 4);
    const area = (f) => Math.abs((r.verts[f[1]][0] - r.verts[f[0]][0]) * (r.verts[f[2]][1] - r.verts[f[0]][1])
      - (r.verts[f[2]][0] - r.verts[f[0]][0]) * (r.verts[f[1]][1] - r.verts[f[0]][1])) / 2;
    const total = r.faces.reduce((s, f) => s + area(f), 0);
    expect(total).toBeCloseTo(30 * 6, 6);
    const count = new Map();
    for (const f of r.faces) {
      for (let i = 0; i < 3; i += 1) {
        const a = f[i];
        const b = f[(i + 1) % 3];
        const len = Math.hypot(r.verts[a][0] - r.verts[b][0], r.verts[a][1] - r.verts[b][1]);
        expect(len).toBeLessThanOrEqual(4 + 1e-9);
        const k = a < b ? `${a}_${b}` : `${b}_${a}`;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    for (const n of count.values()) expect(n).toBeLessThanOrEqual(2);
    expect(r.faces.length).toBeGreaterThan(faces.length);
  });

  it('refineTriangles: maxEdge 0 tidak mengubah apa pun', () => {
    const r = refineTriangles([[0, 0], [1, 0], [0, 1]], [[0, 1, 2]], 0);
    expect(r.faces).toEqual([[0, 1, 2]]);
  });

  it('waterPlaneGeometry: edgeDist = jarak ke tepi, tumbuh ke tengah, luas tetap, menghadap atas', () => {
    const g = waterPlaneGeometry([SQUARE], -1, { maxEdge: 5 });
    const p = g.getAttribute('position');
    const e = g.getAttribute('edgeDist');
    let max = 0;
    for (let i = 0; i < p.count; i += 1) {
      expect(e.getX(i)).toBeCloseTo(distanceToRings(p.getX(i), p.getZ(i), [SQUARE]), 4);
      max = Math.max(max, e.getX(i));
    }
    expect(max).toBeGreaterThan(8);
    let area = 0;
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const [a, b, c] = [ix[i], ix[i + 1], ix[i + 2]];
      const up = (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)) - (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a));
      expect(up).toBeGreaterThan(0);
      area += up / 2;
    }
    expect(area).toBeCloseTo(400, 3);
  });
});
