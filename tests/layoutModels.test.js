import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { LAYOUT } from '../src/regions/stadion/layout.js';

describe('LAYOUT.blenderModels', () => {
  it('setiap path model GLB ada di public/ (tidak ada model hilang saat deploy)', () => {
    for (const m of LAYOUT.blenderModels) expect(existsSync(`public/${m.path}`), m.path).toBe(true);
  });
  it('posisi hingga dan rotasi valid', () => {
    for (const m of LAYOUT.blenderModels) {
      expect(Number.isFinite(m.x) && Number.isFinite(m.z)).toBe(true);
      expect(m.rotY === undefined || Number.isFinite(m.rotY)).toBe(true);
    }
  });
  it('angkot/bus bukan konten region (pindah ke prop kota Task 18b)', () => {
    expect(LAYOUT.blenderModels.filter((m) => m.path.includes('kendaraan'))).toEqual([]);
  });
});
