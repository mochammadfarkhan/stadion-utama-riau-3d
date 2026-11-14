import { describe, it, expect } from 'vitest';
import { fogRange, fogForPreset } from '../src/world/TimeOfDay.js';

describe('fogRange (batas muat kota)', () => {
  it('tanpa batas / di bawah batas: tidak berubah', () => {
    expect(fogRange(220, 1100)).toEqual({ near: 220, far: 1100 });
    expect(fogRange(120, 700, 1000)).toEqual({ near: 120, far: 700 });
  });
  it('di atas batas: far = batas, near diskalakan proporsional', () => {
    const r = fogRange(220, 1100, 1000);
    expect(r.far).toBe(1000);
    expect(r.near).toBeCloseTo(200, 9);
  });
});

describe('fogForPreset (jarak dekat tidak ikut menyusut)', () => {
  it('Rendah sore: far 700, near ditahan di 300', () => {
    const r = fogForPreset(220, 1100, 700 / 1100, 1000);
    expect(r.far).toBeCloseTo(700, 6);
    expect(r.near).toBeCloseTo(300, 6);
  });
  it('malam Rendah: far pendek → near = setengah far', () => {
    const r = fogForPreset(120, 700, 700 / 1100, 1000);
    expect(r.far).toBeCloseTo(445.45, 1);
    expect(r.near).toBeCloseTo(222.73, 1);
  });
  it('skala 1 dengan batas muat: far = batas', () => {
    expect(fogForPreset(220, 1100, 1, 1000).far).toBe(1000);
  });
});
