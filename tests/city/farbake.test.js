import { describe, it, expect } from 'vitest';
import { orientedBox, wktParts, splitCsv, hash2, riversBuffer, riverLines } from '../../tools/citybake/farbake.mjs';

const rot = (pts, a) => pts.map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]);

describe('farbake: kotak terorientasi', () => {
  const rect = [[-6, -3], [6, -3], [6, 3], [-6, 3], [-6, -3]]; // 12 × 6 m
  it('persegi panjang diputar 30° → θ=30°, w=12, d=6', () => {
    const b = orientedBox(rot(rect, (30 * Math.PI) / 180));
    expect(b.theta).toBeCloseTo((30 * Math.PI) / 180, 4);
    expect(b.w).toBeCloseTo(12, 3);
    expect(b.d).toBeCloseTo(6, 3);
  });
  it('θ selalu di (−45°, 45°]; 60° setara −30° dengan w/d tertukar', () => {
    const b = orientedBox(rot(rect, (60 * Math.PI) / 180));
    expect(Math.abs(b.theta)).toBeLessThanOrEqual(Math.PI / 4 + 1e-9);
    expect(b.theta).toBeCloseTo((-30 * Math.PI) / 180, 4);
    expect(b.w).toBeCloseTo(6, 3);
    expect(b.d).toBeCloseTo(12, 3);
  });
  it('cincin runtuh → null', () => {
    expect(orientedBox([[0, 0], [1, 1]])).toBeNull();
    expect(orientedBox([[0, 0], [0, 0], [0, 0]])).toBeNull();
  });
});

describe('farbake: parser', () => {
  it('wktParts membaca cincin polygon; splitCsv menjaga koma dalam tanda kutip', () => {
    expect(wktParts('POLYGON ((1 2, 3 4, 5 6, 1 2))')[0]).toEqual([[1, 2], [3, 4], [5, 6], [1, 2]]);
    expect(splitCsv('a,"POLYGON ((1 2, 3 4))",3')).toEqual(['a', 'POLYGON ((1 2, 3 4))', '3']);
  });
  it('hash2 deterministik di [0, 1)', () => {
    expect(hash2(3, 9)).toBe(hash2(3, 9));
    for (let i = 0; i < 100; i += 1) { const h = hash2(i, i * 7); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
  });
});

describe('jalur sungai', () => {
  it('riversBuffer: header + garis f32; riverLines memfilter jenis, panjang, dan non-garis', () => {
    const b = riversBuffer([[[1, 2], [3, 4]], [[5, 6], [7, 8], [9, 10]]]);
    expect(b.length).toBe(4 + (2 + 16) + (2 + 24));
    expect(b.readUInt32LE(0)).toBe(2);
    expect(b.readUInt16LE(4)).toBe(2);
    expect(b.readFloatLE(6)).toBe(1);
    const rows = [
      { subtype: 'pond', wkt: 'LINESTRING (101.4 0.5, 101.41 0.5)' },
      { subtype: 'river', wkt: 'POLYGON ((101.4 0.5, 101.41 0.5, 101.41 0.51, 101.4 0.5))' },
      { subtype: 'canal', wkt: 'LINESTRING (101.4 0.5, 101.4001 0.5)' }, // terlalu pendek
      { subtype: 'river', wkt: 'LINESTRING (101.4 0.5, 101.41 0.5)' },
    ];
    expect(riverLines(rows)).toHaveLength(1);
  });
});
