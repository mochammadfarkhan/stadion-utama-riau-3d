import { describe, it, expect } from 'vitest';
import { ellipsePerimeter, ellipseTable, ellipsePointAtArc } from '../src/sim/ellipse.js';

describe('ellipsePerimeter', () => {
  it('lingkaran: keliling = 2πr', () => {
    expect(ellipsePerimeter(10, 10)).toBeCloseTo(2 * Math.PI * 10, 6);
  });
  it('elips 60x100 cocok dengan integrasi numerik halus (≈510.54)', () => {
    const numeric = ellipseTable(60, 100, 8192).total;
    expect(Math.abs(ellipsePerimeter(60, 100) - numeric)).toBeLessThan(0.01);
    expect(ellipsePerimeter(60, 100)).toBeCloseTo(510.54, 1);
  });
});

describe('ellipseTable', () => {
  it('kumulatif monoton naik, mulai 0, akhir ≈ keliling', () => {
    const t = ellipseTable(60, 100, 256);
    expect(t.cum[0]).toBe(0);
    for (let i = 1; i < t.cum.length; i += 1) expect(t.cum[i]).toBeGreaterThan(t.cum[i - 1]);
    expect(t.total).toBeCloseTo(ellipsePerimeter(60, 100), 0);
  });
});

describe('ellipsePointAtArc', () => {
  it('s=0 di (a,0), s=L/4 pada sumbu z (simetri)', () => {
    const p0 = ellipsePointAtArc(60, 100, 0);
    expect(p0.x).toBeCloseTo(60, 6);
    expect(p0.z).toBeCloseTo(0, 6);
    const L = ellipsePerimeter(60, 100);
    const pq = ellipsePointAtArc(60, 100, L / 4);
    expect(Math.abs(pq.x)).toBeLessThan(0.5);
    expect(pq.z).toBeCloseTo(100, 0);
    expect(pq.theta).toBeCloseTo(Math.PI / 2, 2);
  });
  it('titik merata: jarak antar titik berurutan hampir sama', () => {
    const L = ellipsePerimeter(60, 100);
    const n = 200;
    const table = ellipseTable(60, 100, 1024);
    const pts = Array.from({ length: n + 1 }, (_, i) => ellipsePointAtArc(60, 100, (L * i) / n, table));
    const d = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.z - pts[i].z));
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    d.forEach((v) => expect(Math.abs(v - avg) / avg).toBeLessThan(0.03));
  });
  it('s di luar [0,L) di-wrap', () => {
    const L = ellipsePerimeter(60, 100);
    const a = ellipsePointAtArc(60, 100, L + 10);
    const b = ellipsePointAtArc(60, 100, 10);
    expect(a.x).toBeCloseTo(b.x, 3);
    expect(a.z).toBeCloseTo(b.z, 3);
  });
});
