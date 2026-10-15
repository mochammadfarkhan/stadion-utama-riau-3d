import { describe, it, expect } from 'vitest';
import {
  createDayState, stepDay, setDayHour, sunFromHour, lightingPreset, presetNameForHour,
  nextPresetAfter, formatHour, hexToRgb, PRESETS, PRESET_HOURS,
} from '../src/sim/dayCycle.js';
import { deepFreeze, hasNaN } from './helpers.js';

const NUMBER_KEYS = ['sunIntensity', 'hemiIntensity', 'fogNear', 'fogFar', 'exposure', 'skyTurbidity', 'skyRayleigh'];
const COLOR_KEYS = ['sunColor', 'hemiSky', 'hemiGround', 'fogColor'];

describe('createDayState / stepDay', () => {
  it('default jam 16.5 dan speed 0', () => {
    expect(createDayState()).toEqual({ hour: 16.5, speed: 0 });
  });
  it('jam maju speed jam per detik dan wrap 24', () => {
    const s = deepFreeze(createDayState({ hour: 23.5, speed: 1 }));
    const n = stepDay(s, 1);
    expect(n.hour).toBeCloseTo(0.5, 6);
    expect(n).not.toBe(s);
    expect(s.hour).toBe(23.5);
  });
  it('dt tidak valid / negatif tidak mengubah jam', () => {
    const s = createDayState({ hour: 10, speed: 2 });
    expect(stepDay(s, NaN).hour).toBe(10);
    expect(stepDay(s, -5).hour).toBe(10);
    expect(hasNaN(stepDay(s, undefined))).toBe(false);
  });
  it('setDayHour wrap negatif', () => {
    expect(setDayHour(createDayState(), -1).hour).toBe(23);
    expect(setDayHour(createDayState(), 25).hour).toBe(1);
  });
});

describe('sunFromHour', () => {
  it('elevasi monoton naik dari terbit sampai tengah hari', () => {
    let prev = -Infinity;
    for (let h = 6; h <= 12; h += 0.25) {
      const { elevationDeg } = sunFromHour(h);
      expect(elevationDeg).toBeGreaterThan(prev);
      prev = elevationDeg;
    }
  });
  it('terbenam 18.3, malam di bawah horizon, siang tinggi', () => {
    expect(sunFromHour(18.3).elevationDeg).toBeCloseTo(0, 6);
    expect(sunFromHour(6).elevationDeg).toBeCloseTo(0, 6);
    expect(sunFromHour(22).elevationDeg).toBeLessThan(0);
    expect(sunFromHour(2).elevationDeg).toBeLessThan(0);
    expect(sunFromHour(12.15).elevationDeg).toBeGreaterThan(70);
  });
  it('azimut timur saat terbit, barat saat terbenam, kontinu melewati tengah malam', () => {
    expect(sunFromHour(6).azimuthDeg).toBeCloseTo(90, 6);
    expect(sunFromHour(18.3).azimuthDeg).toBeCloseTo(270, 6);
    const a = sunFromHour(23.99).azimuthDeg;
    const b = sunFromHour(0.01).azimuthDeg;
    expect(Math.abs(a - b)).toBeLessThan(1);
    expect(hasNaN(sunFromHour(NaN))).toBe(false);
  });
});

describe('lightingPreset', () => {
  it('lampsOn true pada 19.5, false pada 12', () => {
    expect(lightingPreset(19.5).lampsOn).toBe(true);
    expect(lightingPreset(12).lampsOn).toBe(false);
    expect(lightingPreset(3).lampsOn).toBe(true);
  });
  it('memiliki semua kunci dan tanpa NaN', () => {
    const p = lightingPreset(16.5);
    [...NUMBER_KEYS, ...COLOR_KEYS].forEach((k) => expect(p).toHaveProperty(k));
    expect(hasNaN(p)).toBe(false);
    expect(p.sunIntensity).toBeCloseTo(4.5, 6);
    expect(p.sunColor).toBe(0xfff1dc);
  });
  it('malam lebih gelap dari siang', () => {
    expect(lightingPreset(22).sunIntensity).toBeLessThan(lightingPreset(12).sunIntensity * 0.12); // "bulan" lemah
    expect(lightingPreset(22).hemiIntensity).toBeLessThan(lightingPreset(12).hemiIntensity * 0.5); // malam terbaca (stylized), bukan gelap total
  });
  it('interpolasi kontinu: tidak loncat >10% rentang per 0.1 jam (termasuk wrap 24→0)', () => {
    const samples = [];
    for (let h = 0; h <= 24.0001; h += 0.1) samples.push(lightingPreset(h));
    const ranges = {};
    const channel = (p, k, c) => hexToRgb(p[k])[c];
    NUMBER_KEYS.forEach((k) => {
      const vals = samples.map((p) => p[k]);
      ranges[k] = Math.max(...vals) - Math.min(...vals);
    });
    for (let i = 1; i < samples.length; i += 1) {
      NUMBER_KEYS.forEach((k) => {
        expect(Math.abs(samples[i][k] - samples[i - 1][k])).toBeLessThanOrEqual(ranges[k] * 0.1 + 1e-9);
      });
      COLOR_KEYS.forEach((k) => [0, 1, 2].forEach((c) => {
        expect(Math.abs(channel(samples[i], k, c) - channel(samples[i - 1], k, c))).toBeLessThanOrEqual(0.1);
      }));
    }
  });
});

describe('preset & format', () => {
  it('PRESETS dan jamnya', () => {
    expect(PRESETS).toEqual(['siang', 'sore', 'magrib', 'malam']);
    expect(PRESET_HOURS).toEqual({ siang: 12, sore: 16.5, magrib: 18.1, malam: 20 });
  });
  it('nextPresetAfter siklik', () => {
    expect(nextPresetAfter(12)).toBe('sore');
    expect(nextPresetAfter(16.5)).toBe('magrib');
    expect(nextPresetAfter(20)).toBe('siang');
    expect(nextPresetAfter(2)).toBe('siang');
  });
  it('presetNameForHour', () => {
    expect(presetNameForHour(12)).toBe('siang');
    expect(presetNameForHour(16.5)).toBe('sore');
    expect(presetNameForHour(18.1)).toBe('magrib');
    expect(presetNameForHour(20)).toBe('malam');
    expect(presetNameForHour(5)).toBe('subuh');
    expect(presetNameForHour(8)).toBe('pagi');
  });
  it('formatHour', () => {
    expect(formatHour(16.5)).toBe('16:30');
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(23.999)).toBe('23:59');
  });
});

describe('sunMoonWeight', () => {
  it('0 jauh di bawah horizon, 1 jauh di atas, 0,5 tepat di horizon', async () => {
    const { sunMoonWeight } = await import('../src/sim/dayCycle.js');
    expect(sunMoonWeight(-20)).toBe(0);
    expect(sunMoonWeight(20)).toBe(1);
    expect(sunMoonWeight(0)).toBeCloseTo(0.5, 6);
  });
  it('monoton naik dan kontinu (tanpa loncatan besar per 0,5 derajat)', async () => {
    const { sunMoonWeight } = await import('../src/sim/dayCycle.js');
    let prev = sunMoonWeight(-10);
    for (let e = -9.5; e <= 10; e += 0.5) {
      const w = sunMoonWeight(e);
      expect(w).toBeGreaterThanOrEqual(prev);
      expect(w - prev).toBeLessThan(0.1);
      prev = w;
    }
  });
});
