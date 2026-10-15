import { describe, it, expect } from 'vitest';
import {
  createEllipseArcTable, ellipseAngleAtArc, ellipseArcAtAngle, ellipsePoint, mulberry32,
} from '../src/world/stadium/ovalMath.js';

/** Perkiraan keliling elips Ramanujan II (galat < 1e-5 untuk elips tidak ekstrem). */
const ramanujan = (a, b) => {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
};

describe('createEllipseArcTable', () => {
  it('lingkaran: keliling = 2πr', () => {
    expect(createEllipseArcTable(10, 10).total).toBeCloseTo(2 * Math.PI * 10, 1);
  });
  it('elips stadion (60×100): keliling mendekati rumus Ramanujan (< 0,05%)', () => {
    const t = createEllipseArcTable(60, 100);
    expect(Math.abs(t.total - ramanujan(60, 100)) / t.total).toBeLessThan(5e-4);
  });
  it('tabel monoton naik dan dibekukan', () => {
    const t = createEllipseArcTable(60, 100);
    for (let i = 1; i < t.lengths.length; i += 1) expect(t.lengths[i]).toBeGreaterThan(t.lengths[i - 1]);
    expect(Object.isFrozen(t)).toBe(true);
  });
});

describe('ellipseAngleAtArc / ellipseArcAtAngle', () => {
  const t = createEllipseArcTable(60, 100);
  it('bolak-balik busur → sudut → busur kembali ke nilai awal', () => {
    for (const f of [0, 0.1, 0.25, 0.5, 0.77, 0.999]) {
      const s = f * t.total;
      expect(ellipseArcAtAngle(t, ellipseAngleAtArc(t, s))).toBeCloseTo(s, 1);
    }
  });
  it('titik pada jarak busur sama = jarak sama (penempatan merata): selisih sudut tidak seragam tetapi busurnya seragam', () => {
    const step = t.total / 40;
    for (let i = 0; i < 40; i += 1) {
      const a0 = ellipseAngleAtArc(t, i * step);
      const a1 = ellipseAngleAtArc(t, (i + 1) * step);
      const p0 = ellipsePoint(60, 100, a0);
      const p1 = ellipsePoint(60, 100, a1);
      expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(step * 0.95);
      expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(step * 1.02);
    }
  });
  it('membungkus: s di luar [0,total) dan negatif setara sisa baginya', () => {
    const s = t.total * 0.3;
    const base = ellipseAngleAtArc(t, s);
    expect(ellipseAngleAtArc(t, s + t.total)).toBeCloseTo(base, 6);
    expect(ellipseAngleAtArc(t, s - t.total)).toBeCloseTo(base, 6);
    expect(ellipseArcAtAngle(t, base + Math.PI * 2)).toBeCloseTo(ellipseArcAtAngle(t, base), 6);
  });
  it('sudut meningkat monoton terhadap busur', () => {
    let prev = -1;
    for (let i = 0; i < 100; i += 1) {
      const a = ellipseAngleAtArc(t, (i / 100) * t.total);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });
});

describe('ellipsePoint', () => {
  it('konvensi x = a·cosθ, z = b·sinθ', () => {
    expect(ellipsePoint(60, 100, 0)).toEqual({ x: 60, z: 0 });
    const p = ellipsePoint(60, 100, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(100, 9);
  });
});

describe('mulberry32', () => {
  it('deterministik per seed, dalam [0,1), seed berbeda → urutan berbeda', () => {
    const a = mulberry32(42); const b = mulberry32(42); const c = mulberry32(43);
    const sa = Array.from({ length: 50 }, a);
    expect(sa).toEqual(Array.from({ length: 50 }, b));
    expect(sa).not.toEqual(Array.from({ length: 50 }, c));
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
  it('sebaran kira-kira merata (rata-rata ≈ 0,5)', () => {
    const r = mulberry32(7);
    const mean = Array.from({ length: 5000 }, r).reduce((s, v) => s + v, 0) / 5000;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
  });
});
