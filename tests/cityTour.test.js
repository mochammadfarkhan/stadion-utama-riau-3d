import { describe, it, expect } from 'vitest';
import { tourRoute, createTour, advanceHour, TOUR } from '../src/app/cityTour.js';
import { formatHour } from '../src/ui/CityControls.js';

const L = [
  { id: 'stadion', x: 0, z: 0 }, { id: 'a', x: 5000, z: 0 }, { id: 'b', x: 900, z: 0 }, { id: 'c', x: 2000, z: 100 },
  { id: 'bad', x: NaN, z: 0 },
];

describe('tourRoute', () => {
  it('mulai dari stadion lalu tetangga terdekat, buang koordinat tak valid', () => {
    expect(tourRoute(L).map((l) => l.id)).toEqual(['stadion', 'b', 'c', 'a']);
  });
  it('dibatasi maxStops dan aman untuk daftar kosong', () => {
    expect(tourRoute(L, 'stadion', 2)).toHaveLength(2);
    expect(tourRoute([])).toEqual([]);
  });
});

describe('createTour', () => {
  it('langsung ke perhentian pertama, lalu menunggu dwell, dan berputar', () => {
    const t = createTour([{ id: 1 }, { id: 2 }], 5);
    expect(t.step(0.016).id).toBe(1);
    expect(t.step(4)).toBeNull();
    expect(t.step(1.1).id).toBe(2);
    t.step(5.1);
    expect(t.index).toBe(0);
  });
  it('rute kosong tidak menghasilkan apa-apa', () => {
    expect(createTour([]).step(10)).toBeNull();
  });
});

describe('jam', () => {
  it('advanceHour melingkar 0..24', () => {
    expect(advanceHour(23.5, 1, 1)).toBeCloseTo(0.5, 6);
    expect(advanceHour(1, 1, -2)).toBeCloseTo(23, 6);
    expect(TOUR.hoursPerSecond).toBeGreaterThan(0);
  });
  it('formatHour', () => {
    expect(formatHour(16.75)).toBe('16:45');
    expect(formatHour(24)).toBe('00:00');
    expect(formatHour(23.999)).toBe('00:00');
  });
});
