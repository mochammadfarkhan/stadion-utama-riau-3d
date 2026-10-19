import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AUTO_QUALITY, LIGHT_BY_HOUR } from '../src/config/lowpoly.js';
import { createAutoQuality, effectsAtLevel, stepAutoQuality } from '../src/engine/autoQuality.js';
import { decodeFogFar, encodeFogFar, installFogScatter } from '../src/engine/fogScatter.js';
import { lightByHour } from '../src/engine/lightByHour.js';
import { limitSaturation } from '../src/core/postprocessing/gradingShader.js';
import { gradingParams } from '../src/engine/gradingParams.js';

const NUMS = ['sunMul', 'hemiMul', 'expMul', 'split', 'haze'];
const COLORS = ['sunColor', 'hemiSky', 'hemiGround', 'fogColor'];

describe('lightByHour', () => {
  it('kontinu di 0/24 jam dan tanpa NaN', () => {
    const a = lightByHour(23.999);
    const b = lightByHour(0);
    const c = lightByHour(24);
    for (const k of NUMS) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.01);
    expect(b).toEqual(c);
    for (const h of [-5, 0, 3.3, 6.49, 12, 17.7, 23.5, 48.2, NaN, Infinity, undefined]) {
      const r = lightByHour(h);
      for (const k of NUMS) expect(Number.isFinite(r[k])).toBe(true);
      for (const k of COLORS) expect(Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 0xffffff).toBe(true);
    }
  });

  it('tepat di keyframe mengembalikan nilai tabel; tengah = rata-rata', () => {
    const k = LIGHT_BY_HOUR[4];
    const r = lightByHour(k.hour);
    for (const n of NUMS) expect(r[n]).toBeCloseTo(k[n], 6);
    const mid = lightByHour((LIGHT_BY_HOUR[4].hour + LIGHT_BY_HOUR[5].hour) / 2);
    expect(mid.hemiMul).toBeCloseTo((LIGHT_BY_HOUR[4].hemiMul + LIGHT_BY_HOUR[5].hemiMul) / 2, 6);
  });

  it('malam lebih terang dari preset gelap (hemiMul > 2) dan sore keemasan lebih hangat dari siang', () => {
    expect(lightByHour(21).hemiMul).toBeGreaterThan(2);
    const noon = lightByHour(12).sunColor;
    const gold = lightByHour(17.5).sunColor;
    expect((noon & 255) - (gold & 255)).toBeGreaterThan(40); // biru turun saat keemasan
  });
});

describe('limitSaturation', () => {
  it('identitas di bawah knee, monoton, tak pernah melewati ceil', () => {
    expect(limitSaturation(0.3, 0.5, 0.8)).toBe(0.3);
    expect(limitSaturation(0.5, 0.5, 0.8)).toBe(0.5);
    let prev = 0;
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const o = limitSaturation(s, 0.5, 0.8);
      expect(o).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(o).toBeLessThan(0.8);
      prev = o;
    }
    expect(limitSaturation(1, 0.5, 0.8)).toBeLessThan(0.76);
  });

  it('kontinu di knee dan aman untuk input tak valid', () => {
    expect(limitSaturation(0.5001, 0.5, 0.8) - 0.5).toBeLessThan(0.0002);
    expect(limitSaturation(NaN, 0.5, 0.8)).toBe(0);
    expect(limitSaturation(1, 0.8, 0.8)).toBeLessThanOrEqual(0.8001);
  });
});

describe('gradingParams', () => {
  const cfg = { saturation: 1.1, contrast: 1.05, strength: 0.4, vignette: 0.16, highlight: 1, shadow: 2 };
  it('k=0 netral, k=1 penuh, split mengalikan tint', () => {
    expect(gradingParams(cfg, 0.5, 0)).toMatchObject({ saturation: 1, contrast: 1, strength: 0, vignette: 0 });
    const full = gradingParams(cfg, 1, 1);
    expect(full.saturation).toBeCloseTo(1.1);
    expect(gradingParams(cfg, 0.5, 1).strength).toBeCloseTo(0.2);
    expect(gradingParams(cfg, NaN, NaN).saturation).toBeCloseTo(1.1);
  });
});

describe('autoQuality (histeresis)', () => {
  const run = (state, fps, secs) => {
    let s = state;
    const dt = 1 / fps;
    for (let t = 0; t < secs; t += dt) s = stepAutoQuality(s, dt);
    return s;
  };

  it('turun satu level per 3 dtk FPS < 45, berhenti di maxLevel', () => {
    let s = createAutoQuality();
    s = run(s, 30, 2);
    expect(s.level).toBe(0);
    s = run(s, 30, 3);
    expect(s.level).toBe(1);
    s = run(s, 30, 3.5);
    expect(s.level).toBe(2);
    s = run(s, 30, 10);
    expect(s.level).toBe(AUTO_QUALITY.maxLevel);
  });

  it('naik lagi hanya saat > 58 FPS cukup lama; pita 45-58 tidak mengubah', () => {
    let s = run(createAutoQuality(), 30, 12);
    expect(s.level).toBe(2);
    s = run(s, 52, 20);
    expect(s.level).toBe(2); // di pita histeresis
    s = run(s, 62, 40);
    expect(s.level).toBe(0);
  });

  it('syarat naik digandakan setelah turun (tidak berkedip)', () => {
    let s = run(createAutoQuality(), 30, 4); // level 1, highNeed 6
    expect(s.level).toBe(1);
    s = run(s, 62, 4);
    expect(s.level).toBe(1);
    s = run(s, 62, 6);
    expect(s.level).toBe(0);
  });

  it('mengabaikan dt tak valid / tab tersembunyi', () => {
    const s0 = createAutoQuality();
    expect(stepAutoQuality(s0, NaN)).toBe(s0);
    expect(stepAutoQuality(s0, 0)).toBe(s0);
    expect(stepAutoQuality(s0, 2)).toBe(s0);
  });

  it('effectsAtLevel: urutan tilt-shift lalu bloom', () => {
    const w = { tiltShift: true, bloom: true };
    expect(effectsAtLevel(0, w)).toEqual({ tiltShift: true, bloom: true });
    expect(effectsAtLevel(1, w)).toEqual({ tiltShift: false, bloom: true });
    expect(effectsAtLevel(2, w)).toEqual({ tiltShift: false, bloom: false });
    expect(effectsAtLevel(0, { tiltShift: false, bloom: false })).toEqual({ tiltShift: false, bloom: false });
  });
});

describe('fogScatter', () => {
  it('encode/decode far + haze', () => {
    const code = encodeFogFar(880.7, 0.5);
    expect(code).toBeLessThan(0);
    const d = decodeFogFar(code);
    expect(d.far).toBe(880);
    expect(d.haze).toBeCloseTo(0.5, 5);
    expect(d.scatter).toBe(true);
    expect(decodeFogFar(900).scatter).toBe(false);
    expect(encodeFogFar(500, 5)).toBeGreaterThan(-501); // haze dijepit < 1 (tidak menggeser far)
    expect(Number.isFinite(encodeFogFar(NaN, NaN))).toBe(true);
  });

  it('chunk fog_fragment ditambal sekali dan tetap berisi cabang bawaan', () => {
    installFogScatter();
    installFogScatter();
    const c = THREE.ShaderChunk.fog_fragment;
    expect(c.match(/\/\/ fogScatter/g)).toHaveLength(1);
    expect(c).toContain('FOG_EXP2');
    expect(c).toContain('smoothstep( fogNear, fogFarM, vFogDepth )');
  });
});
