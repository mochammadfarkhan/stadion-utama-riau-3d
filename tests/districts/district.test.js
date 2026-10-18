import { describe, it, expect } from 'vitest';
import { defineDistrict, validateDistrictBuild, districtContains } from '../../src/districts/District.js';
import { signedArea } from '../../src/geo/polygon.js';

const SQUARE_CW = [[0, 0], [0, 100], [100, 100], [100, 0]]; // luas bertanda negatif
const spec = (patch = {}) => ({ id: 'uji', boundary: SQUARE_CW, manifestUrl: 'districts/uji/manifest.json', build: async () => ({}), ...patch });

describe('defineDistrict', () => {
  it('membekukan definisi, boundary dibalik ke luas bertanda positif, bounds dihitung', () => {
    const d = defineDistrict(spec());
    expect(Object.isFrozen(d)).toBe(true);
    expect(signedArea(d.boundary)).toBeGreaterThan(0);
    expect(d.bounds).toEqual({ minX: 0, minZ: 0, maxX: 100, maxZ: 100 });
    expect(Object.isFrozen(d.boundary[0])).toBe(true);
  });

  it('menolak id, boundary, manifestUrl, build yang salah', () => {
    expect(() => defineDistrict(spec({ id: 'Uji Besar' }))).toThrow(/id/);
    expect(() => defineDistrict(spec({ boundary: [[0, 0], [1, 1]] }))).toThrow(/boundary/);
    expect(() => defineDistrict(spec({ boundary: [[0, 0], [1, 0], [2, 0]] }))).toThrow(/luas/);
    expect(() => defineDistrict(spec({ boundary: [[0, 0], [Number.NaN, 0], [1, 1]] }))).toThrow(/boundary/);
    expect(() => defineDistrict(spec({ manifestUrl: '' }))).toThrow(/manifestUrl/);
    expect(() => defineDistrict(spec({ build: null }))).toThrow(/build/);
  });
});

describe('validateDistrictBuild', () => {
  const ok = {
    group: { isObject3D: true }, systems: [], colliders: { isWalkable: () => true, isCameraClear: () => true },
    minimapLayer: () => {}, excludeIds: new Set(), whenSettled: async () => true, dispose: () => {},
  };
  it('lulus untuk hasil lengkap (field tambahan boleh)', () => {
    const r = { ...ok, groundHole: null };
    expect(validateDistrictBuild(r, 'uji')).toBe(r);
  });
  it('menyebut semua field yang hilang', () => {
    expect(() => validateDistrictBuild({ ...ok, excludeIds: [], whenSettled: null }, 'uji')).toThrow('(excludeIds, whenSettled)');
    expect(() => validateDistrictBuild(null, 'uji')).toThrow(/group, systems, colliders, minimapLayer, excludeIds, whenSettled, dispose/);
  });
});

describe('districtContains', () => {
  const d = defineDistrict(spec({ boundary: [[0, 0], [100, 0], [100, 100], [50, 50], [0, 100]] }));
  it('di dalam, di luar bbox, dan di cekungan', () => {
    expect(districtContains(d, 10, 10)).toBe(true);
    expect(districtContains(d, 150, 10)).toBe(false);
    expect(districtContains(d, 50, 90)).toBe(false); // takik segitiga
  });
});
