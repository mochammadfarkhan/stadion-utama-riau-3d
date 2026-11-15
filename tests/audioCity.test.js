import { describe, it, expect } from 'vitest';
import { cityHumBuffer, windBuffer, rainHissBuffer } from '../src/core/audioSynth.js';
import { vi } from 'vitest';
import { createAudioBus } from '../src/core/AudioBus.js';

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

describe('desis hujan tanpa klik', () => {
  it('panjang = detik × sample rate, puncak ≤ 0,9, deterministik, sambungan halus', () => {
    const a = rainHissBuffer(SR);
    expect(a.length).toBe(SR * 6);
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThanOrEqual(0.9 + 1e-6);
    expect(rainHissBuffer(SR)).toEqual(a);
    let step = 0; // langkah rata-rata antar-sampel
    for (let i = 1; i < a.length; i += 1) step += Math.abs(a[i] - a[i - 1]);
    step /= a.length - 1;
    expect(Math.abs(a[0] - a[a.length - 1])).toBeLessThan(step * 6); // sambungan tak lebih kasar dari derau itu sendiri
  });
});

describe('AudioBus: tab tersembunyi', () => {
  const fakeCtx = (state) => {
    const ctx = {
      state, sampleRate: 8000, destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
      suspend: vi.fn(() => { ctx.state = 'suspended'; return Promise.resolve(); }),
      resume: vi.fn(() => { ctx.state = 'running'; return Promise.resolve(); }),
      close: vi.fn(() => Promise.resolve()),
    };
    return ctx;
  };
  it('suspend menghentikan konteks yang berjalan; resume melanjutkan, juga dari "interrupted" (iOS)', () => {
    const ctx = fakeCtx('running');
    const bus = createAudioBus({ target: null, createContext: () => ctx });
    bus.ensure();
    bus.suspend();
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    bus.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    const ios = fakeCtx('interrupted');
    const bus2 = createAudioBus({ target: null, createContext: () => ios });
    bus2.ensure();
    bus2.resume();
    expect(ios.resume).toHaveBeenCalledTimes(1);
    bus2.suspend(); // sudah running lagi → suspend dipanggil
    expect(ios.suspend).toHaveBeenCalledTimes(1);
  });
});

import * as SYNTH from '../src/core/audioSynth.js';

describe('suara dunia R18: loop', () => {
  for (const [name, seconds] of [['tyreRollBuffer', 4], ['chainTickBuffer', 1], ['birdsBuffer', 10], ['crowdRoarBuffer', 8], ['trafficBuffer', 10], ['riverBuffer', 8]]) {
    it(`${name}: panjang, puncak, deterministik, sambungan halus`, () => {
      const a = SYNTH[name](SR);
      expect(a.length).toBe(SR * seconds);
      let peak = 0;
      for (const v of a) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); }
      expect(peak).toBeLessThanOrEqual(0.7 + 1e-6);
      expect(peak).toBeGreaterThan(0.2);
      expect(SYNTH[name](SR)).toEqual(a);
      expect(Math.abs(a[a.length - 1] - a[0])).toBeLessThan(0.15);
    });
  }
});

describe('suara dunia R18: bunyi aksi', () => {
  for (const name of ['thudBuffer', 'splashBuffer', 'popBuffer', 'tickBuffer']) {
    it(`${name}: ≤ 0,3 s, puncak 0,8, deterministik`, () => {
      const a = SYNTH[name](SR);
      expect(a.length).toBeLessThanOrEqual(SR * 0.3);
      let peak = 0;
      for (const v of a) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeCloseTo(0.8, 3);
      expect(SYNTH[name](SR)).toEqual(a);
    });
  }
});
