import { describe, it, expect } from 'vitest';
import { createSettingsStore, STORAGE_KEY } from '../src/settings/store.js';
import { SETTINGS_SCHEMA, coerceValue, defaultSettings, formatValue, listFields } from '../src/settings/schema.js';

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}

describe('schema', () => {
  it('setiap field punya default valid terhadap dirinya sendiri', () => {
    for (const [, f] of listFields()) expect(coerceValue(f, f.default)).toEqual(f.default);
  });
  it('coerce: clamp, step, dan fallback default', () => {
    const hour = SETTINGS_SCHEMA.sky.sections.sun.fields.hour;
    expect(coerceValue(hour, 30)).toBe(24);
    expect(coerceValue(hour, -5)).toBe(0);
    expect(coerceValue(hour, 'abc')).toBe(hour.default);
    const sq = SETTINGS_SCHEMA.graphics.sections.quality.fields.shadowQuality;
    expect(coerceValue(sq, 'ultra')).toBe('sedang');
    const t = SETTINGS_SCHEMA.weather.sections.rain.fields.raining;
    expect(coerceValue(t, 'yes')).toBe(false);
  });
  it('format: jam, persen, satuan', () => {
    const hour = SETTINGS_SCHEMA.sky.sections.sun.fields.hour;
    expect(formatValue(hour, 16.5)).toBe('16:30');
    const cc = SETTINGS_SCHEMA.sky.sections.atmosphere.fields.cloudCover;
    expect(formatValue(cc, 0.49)).toBe('49%');
    const az = SETTINGS_SCHEMA.sky.sections.sun.fields.azimuthOffset;
    expect(formatValue(az, 12)).toBe('12 °');
  });
});

describe('store', () => {
  it('state awal = default, immutable', () => {
    const s = createSettingsStore();
    expect(s.state).toEqual(defaultSettings());
    expect(Object.isFrozen(s.state)).toBe(true);
    const before = s.state;
    s.set('sky.hour', 12);
    expect(before['sky.hour']).toBe(16.5);
    expect(s.get('sky.hour')).toBe(12);
  });
  it('set mengabaikan key tak dikenal dan nilai yang sama', () => {
    const s = createSettingsStore();
    expect(s.set('nope.x', 1)).toBe(false);
    expect(s.set('sky.hour', 16.5)).toBe(false);
  });
  it('subscribe per-key & global, unsubscribe bekerja', () => {
    const s = createSettingsStore();
    const got = [];
    const off = s.subscribe('weather.raining', (v, prev, k) => got.push([k, v, prev]));
    const all = [];
    s.subscribe('*', (v, p, k) => all.push(k));
    s.set('weather.raining', true);
    s.set('sky.hour', 1);
    off();
    s.set('weather.raining', false);
    expect(got).toEqual([['weather.raining', true, false]]);
    expect(all).toEqual(['weather.raining', 'sky.hour', 'weather.raining']);
  });
  it('bind memanggil segera dengan nilai saat ini', () => {
    const s = createSettingsStore();
    let seen;
    s.bind('camera.fov', (v) => { seen = v; });
    expect(seen).toBe(60);
  });
  it('persist hanya diff dari default; load mensanitasi', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ 'sky.hour': 99, 'junk.key': 1, 'camera.fov': 70 }) });
    const s = createSettingsStore({ storage });
    expect(s.get('sky.hour')).toBe(24);
    expect(s.get('camera.fov')).toBe(70);
    s.set('weather.raining', true);
    s.flush();
    const saved = JSON.parse(storage.dump()[STORAGE_KEY]);
    expect(saved).toEqual({ 'sky.hour': 24, 'camera.fov': 70, 'weather.raining': true });
  });
  it('reset per prefix dan total', () => {
    const s = createSettingsStore();
    s.set('sky.hour', 3);
    s.set('camera.fov', 90);
    s.reset('sky.');
    expect(s.get('sky.hour')).toBe(16.5);
    expect(s.get('camera.fov')).toBe(90);
    s.reset();
    expect(s.get('camera.fov')).toBe(60);
  });
  it('export/import round-trip, import json rusak aman', () => {
    const a = createSettingsStore();
    a.set('graphics.ao', true);
    const b = createSettingsStore();
    expect(b.import(a.export())).toBe(true);
    expect(b.get('graphics.ao')).toBe(true);
    expect(b.import('{bad')).toBe(false);
  });
});
