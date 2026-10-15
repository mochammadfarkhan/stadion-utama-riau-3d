import { describe, it, expect } from 'vitest';
import { clampToRadius, joystickKeys, isTouchPrimary } from '../src/ui/touchMath.js';

describe('clampToRadius', () => {
  it('di dalam radius tidak berubah; di luar dijepit ke tepi dengan arah sama', () => {
    expect(clampToRadius(3, 4, 10)).toEqual({ x: 3, y: 4 });
    const c = clampToRadius(30, 40, 10);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(10, 6);
    expect(c.x / c.y).toBeCloseTo(0.75, 6);
  });
  it('nol atau NaN aman', () => {
    expect(clampToRadius(0, 0, 10)).toEqual({ x: 0, y: 0 });
    expect(clampToRadius(Number.NaN, 5, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe('joystickKeys', () => {
  const R = 50;
  it('di tengah (deadzone) tidak ada tombol', () => {
    expect(joystickKeys(5, -5, R)).toEqual({ KeyW: false, KeyS: false, KeyA: false, KeyD: false });
  });
  it('arah dasar: atas=W, bawah=S, kiri=A, kanan=D', () => {
    expect(joystickKeys(0, -50, R)).toMatchObject({ KeyW: true, KeyS: false });
    expect(joystickKeys(0, 50, R)).toMatchObject({ KeyS: true, KeyW: false });
    expect(joystickKeys(-50, 0, R)).toMatchObject({ KeyA: true, KeyD: false });
    expect(joystickKeys(50, 0, R)).toMatchObject({ KeyD: true, KeyA: false });
  });
  it('diagonal menyalakan dua tombol', () => {
    expect(joystickKeys(40, -40, R)).toMatchObject({ KeyW: true, KeyD: true });
  });
  it('sumbu dominan saja bila yang lain kecil (tidak ikut membelok saat lurus)', () => {
    expect(joystickKeys(8, -48, R)).toMatchObject({ KeyW: true, KeyD: false, KeyA: false });
  });
  it('radius 0 atau input rusak tidak melempar dan tidak menyalakan tombol', () => {
    expect(Object.values(joystickKeys(10, 10, 0)).some(Boolean)).toBe(false);
    expect(Object.values(joystickKeys(Number.NaN, 1, R)).some(Boolean)).toBe(false);
  });
});

describe('isTouchPrimary', () => {
  it('true hanya bila pointer utama kasar (jari) dan ada titik sentuh', () => {
    expect(isTouchPrimary({ maxTouchPoints: 5, matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isTouchPrimary({ maxTouchPoints: 5, matchMedia: () => ({ matches: false }) })).toBe(false); // laptop layar sentuh + mouse
    expect(isTouchPrimary({ maxTouchPoints: 0, matchMedia: () => ({ matches: true }) })).toBe(false);
    expect(isTouchPrimary(null)).toBe(false);
  });
});
