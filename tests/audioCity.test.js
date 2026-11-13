import { describe, it, expect } from 'vitest';
import { cityHumBuffer, windBuffer } from '../src/core/audioSynth.js';

const SR = 8000;

describe('audio kota (prosedural)', () => {
  for (const [name, make, seconds] of [['cityHum', cityHumBuffer, 10], ['wind', windBuffer, 12]]) {
    it(`${name}: panjang = detik × sample rate, puncak ≤ 0,7, tanpa NaN, deterministik`, () => {
      const a = make(SR);
      expect(a.length).toBe(SR * seconds);
      let peak = 0;
      for (const v of a) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); }
      expect(peak).toBeLessThanOrEqual(0.7 + 1e-6);
      expect(peak).toBeGreaterThan(0.3);
      expect(make(SR)).toEqual(a);
    });
    it(`${name}: sambungan loop mulus (lompatan ujung→awal kecil)`, () => {
      const a = make(SR);
      const jump = Math.abs(a[a.length - 1] - a[0]);
      expect(jump).toBeLessThan(0.15);
    });
  }
});
