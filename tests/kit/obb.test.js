import { describe, it, expect } from 'vitest';
import { computeObb, dominantYaw, normalizeYaw, principalAngle, toLocal, toWorld, OBB_RECT_MIN } from '../../src/world/kit/obb.js';

const DEG = Math.PI / 180;

/** Persegi panjang w × d berpusat (cx, cz), sumbu panjang diputar `rot` (radian, arah (cos, sin) di x,z). */
function rotatedRect(cx, cz, w, d, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
}

describe('obb', () => {
  it('persegi panjang sejajar sumbu: w = sisi panjang, d = pendek, yaw 0, rasio 1', () => {
    const o = computeObb([[0, 0], [40, 0], [40, 12], [0, 12]]);
    expect(o.cx).toBeCloseTo(20, 6);
    expect(o.cz).toBeCloseTo(6, 6);
    expect(o.w).toBeCloseTo(40, 6);
    expect(o.d).toBeCloseTo(12, 6);
    expect(Math.abs(o.yaw)).toBeCloseTo(0, 6);
    expect(o.area).toBeCloseTo(480, 6);
    expect(o.rectangularity).toBeCloseTo(1, 6);
  });

  it('persegi panjang diputar 30°: yaw three.js = −30° (X lokal → (cos30, sin30) dunia)', () => {
    const o = computeObb(rotatedRect(-1000, 800, 46.4, 14.7, 30 * DEG));
    expect(o.w).toBeCloseTo(46.4, 5);
    expect(o.d).toBeCloseTo(14.7, 5);
    expect(o.yaw).toBeCloseTo(-30 * DEG, 6);
    const p = toWorld(o, o.w / 2, 0);
    expect(p.x).toBeCloseTo(-1000 + 23.2 * Math.cos(30 * DEG), 4);
    expect(p.z).toBeCloseTo(800 + 23.2 * Math.sin(30 * DEG), 4);
  });

  it('sisi panjang di sumbu Z dunia → diputar 90° agar w ≥ d', () => {
    const o = computeObb([[0, 0], [10, 0], [10, 50], [0, 50]]);
    expect(o.w).toBeCloseTo(50, 6);
    expect(o.d).toBeCloseTo(10, 6);
    expect(Math.abs(o.yaw)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('persegi sempurna diputar 37°: hull edge memperbaiki PCA (luas OBB = luas footprint)', () => {
    const o = computeObb(rotatedRect(5, 5, 20, 20, 37 * DEG));
    expect(o.w * o.d).toBeCloseTo(400, 3);
    expect(o.rectangularity).toBeCloseTo(1, 4);
  });

  it('bentuk L: rasio < 0,85 (memicu dekomposisi)', () => {
    const o = computeObb([[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]]);
    expect(o.rectangularity).toBeLessThan(OBB_RECT_MIN);
    expect(o.rectangularity).toBeCloseTo(500 / 900, 6);
  });

  it('toLocal ∘ toWorld = identitas', () => {
    const o = { cx: 12, cz: -7, yaw: 0.6 };
    const w = toWorld(o, 3.5, -2.25);
    const l = toLocal(o, w.x, w.z);
    expect(l.x).toBeCloseTo(3.5, 9);
    expect(l.z).toBeCloseTo(-2.25, 9);
  });

  it('normalizeYaw ke (−π/2, π/2]', () => {
    expect(normalizeYaw(Math.PI)).toBeCloseTo(0, 9);
    expect(normalizeYaw(-Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(normalizeYaw(2.5)).toBeCloseTo(2.5 - Math.PI, 9);
  });

  it('principalAngle persegi panjang miring 20° ≈ 20°; dominantYaw = −20°', () => {
    const r = rotatedRect(0, 0, 60, 10, 20 * DEG);
    expect(principalAngle(r)).toBeCloseTo(20 * DEG, 6);
    expect(dominantYaw(r)).toBeCloseTo(-20 * DEG, 3);
  });

  it('footprint rusak → RangeError', () => {
    expect(() => computeObb([[0, 0], [1, 0]])).toThrow(RangeError);
    expect(() => computeObb([[0, 0], [0.5, 0], [0.5, 0.5]])).toThrow(RangeError);
    expect(() => computeObb(null)).toThrow(RangeError);
  });
});
