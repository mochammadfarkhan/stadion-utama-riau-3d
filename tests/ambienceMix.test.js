import { describe, it, expect } from 'vitest';
import { ambienceMix, bikeSoundLevels } from '../src/sim/ambienceMix.js';

describe('ambienceMix (R18)', () => {
  it('pagi kampus cerah: burung ±0,6; malam: 0; hujan: burung 0, angin 0,3', () => {
    expect(ambienceMix({ zone: 'kampus', hour: 7, raining: false }).birds).toBeCloseTo(0.6, 6);
    expect(ambienceMix({ zone: 'kampus', hour: 22, raining: false }).birds).toBe(0);
    const r = ambienceMix({ zone: 'kota', hour: 7, raining: true });
    expect(r.birds).toBe(0);
    expect(r.wind).toBe(0.3);
  });
  it('penonton hanya di stadion', () => {
    expect(ambienceMix({ zone: 'stadion', hour: 12, raining: false, crowd: 1 }).crowd).toBeCloseTo(0.4, 6);
    expect(ambienceMix({ zone: 'kampus', hour: 12, raining: false, crowd: 1 }).crowd).toBe(0);
  });
});

describe('bikeSoundLevels (R18)', () => {
  it('diam, mengayuh, meluncur, jalan kaki', () => {
    expect(bikeSoundLevels({ speed: 0, pedalling: false, mode: 'sepeda' })).toEqual({ tyre: 0, chain: 0 });
    expect(bikeSoundLevels({ speed: 9, pedalling: true, mode: 'sepeda' })).toEqual({ tyre: 0.1, chain: 0 });
    expect(bikeSoundLevels({ speed: 6, pedalling: false, mode: 'sepeda' }).chain).toBe(0.06);
    expect(bikeSoundLevels({ speed: 3, pedalling: true, mode: 'jalan' })).toEqual({ tyre: 0, chain: 0 });
  });
});
