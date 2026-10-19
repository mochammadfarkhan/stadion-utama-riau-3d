import { describe, expect, it } from 'vitest';
import {
  ANGLED, angledOffset, clampDistance, decayYawOffset, pitchForDistance, shouldSnapAngled, smoothFactor, stepPosition, stepYaw, zoomDistance, wrap,
} from '../src/core/cameraAngled.js';

describe('cameraAngled', () => {
  it('pitch: landai di dekat, curam di jauh, default 52-58 derajat', () => {
    expect(pitchForDistance(ANGLED.minDistance)).toBeCloseTo(ANGLED.pitchNear);
    expect(pitchForDistance(ANGLED.maxDistance)).toBeCloseTo(ANGLED.pitchFar);
    const deg = (pitchForDistance(ANGLED.defaultDistance) * 180) / Math.PI;
    expect(deg).toBeGreaterThan(52);
    expect(deg).toBeLessThan(58);
  });
  it('klem jarak dan zoom, NaN aman', () => {
    expect(clampDistance(1)).toBe(10);
    expect(clampDistance(500)).toBe(45);
    expect(clampDistance(NaN)).toBe(24);
    expect(zoomDistance(24, 1e6)).toBe(45);
    expect(zoomDistance(24, -1e6)).toBe(10);
    expect(zoomDistance(24, 100)).toBeGreaterThan(24);
    expect(Number.isFinite(zoomDistance(NaN, NaN))).toBe(true);
  });
  it('offset: panjang = jarak, di belakang arah maju, tinggi ~19 m pada 24 m', () => {
    const o = angledOffset(0, 24);
    expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(24);
    expect(o.z).toBeLessThan(0);
    expect(o.y).toBeGreaterThan(17);
    expect(o.y).toBeLessThan(21);
    const r = angledOffset(Math.PI / 2, 24);
    expect(r.x).toBeLessThan(0);
    expect(r.z).toBeCloseTo(0, 5);
  });
  it('peredaman posisi: konvergen, tidak overshoot, bebas frame-rate', () => {
    let p = { x: 0, y: 0, z: 0 };
    const g = { x: 10, y: 5, z: -4 };
    for (let i = 0; i < 600; i += 1) p = stepPosition(p, g, 1 / 60);
    expect(p.x).toBeCloseTo(10, 3);
    expect(p.x).toBeLessThanOrEqual(10);
    const a = stepPosition({ x: 0, y: 0, z: 0 }, g, 1 / 30);
    const b = stepPosition(stepPosition({ x: 0, y: 0, z: 0 }, g, 1 / 60), g, 1 / 60);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(smoothFactor(0, 5)).toBe(0);
    expect(Number.isNaN(stepPosition({ x: 0, y: 0, z: 0 }, g, NaN).x)).toBe(false);
  });
  it('yaw: lag lambat (~2,5 s), sudut terpendek, tanpa NaN', () => {
    let y = 0;
    for (let i = 0; i < 60; i += 1) y = stepYaw(y, 1, 1 / 60); // 1 s
    expect(y).toBeGreaterThan(0.2);
    expect(y).toBeLessThan(0.8);
    for (let i = 0; i < 60 * 3; i += 1) y = stepYaw(y, 1, 1 / 60);
    expect(y).toBeGreaterThan(0.9);
    // melintasi ±π lewat jalur pendek
    const s = stepYaw(3.1, -3.1, 0.1);
    expect(s).toBeGreaterThan(3.1);
    expect(Number.isNaN(stepYaw(NaN, NaN, NaN))).toBe(false);
    expect(wrap(7)).toBeCloseTo(7 - 2 * Math.PI);
  });
  it('offset yaw manual meluruh hanya setelah idle', () => {
    expect(decayYawOffset(1, 0.1, 1)).toBe(1);
    expect(decayYawOffset(1, 0.1, 5)).toBeLessThan(1);
  });
  it('snap saat teleport', () => {
    expect(shouldSnapAngled(0, 0, 10)).toBe(false);
    expect(shouldSnapAngled(0, 0, 500)).toBe(true);
    expect(shouldSnapAngled(NaN, 0, 0)).toBe(true);
  });
});
