import { describe, it, expect, vi } from 'vitest';
import { createDistrictRegistries } from '../src/app/districtRegistries.js';

const fakeTime = () => {
  const live = new Set();
  return {
    live,
    registerEmissive: vi.fn((root) => { live.add(root); return () => live.delete(root); }),
    registerLamps: vi.fn((opts) => { live.add(opts); return () => live.delete(opts); }),
  };
};
const fakeWeather = () => {
  const live = new Set();
  return { live, registerWet: vi.fn((root) => { live.add(root); return () => live.delete(root); }) };
};

describe('createDistrictRegistries', () => {
  it('meneruskan ke time/weather; pencabut idempoten; dispose mencabut semua', () => {
    const time = fakeTime();
    const weather = fakeWeather();
    const r = createDistrictRegistries({ time, weather });
    const a = {};
    const b = {};
    const lamps = { lamps: [{ x: 1, z: 2 }] };
    const offA = r.registerWet(a);
    r.registerEmissive(b);
    r.registerLamps(lamps);
    expect(weather.live.has(a) && time.live.has(b) && time.live.has(lamps)).toBe(true);
    expect(r.size).toBe(3);
    expect(offA()).toBe(true);
    expect(offA()).toBe(false);
    expect(weather.live.has(a)).toBe(false);
    r.dispose();
    expect(time.live.size).toBe(0);
    expect(r.size).toBe(0);
  });

  it('tanpa time/weather → pencabut no-op', () => {
    const r = createDistrictRegistries();
    expect(r.registerWet({})()).toBe(false);
    expect(r.size).toBe(0);
  });

  it('galat pencabutan dicatat, tidak dilempar', () => {
    const logger = { error: vi.fn() };
    const r = createDistrictRegistries({ weather: { registerWet: () => () => { throw new Error('x'); } }, logger });
    r.registerWet({});
    expect(() => r.dispose()).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
