import { describe, it, expect } from 'vitest';
import { FLAT_TERRAIN, createTerrainService } from '../src/app/terrainService.js';

describe('terrainService (stub M0)', () => {
  it('FLAT_TERRAIN: tinggi 0, normal ke atas (menulis ke out bila ada), grade 0, versi 0, beku', () => {
    expect(FLAT_TERRAIN.heightAt(123, -456)).toBe(0);
    expect(FLAT_TERRAIN.normalAt(1, 2)).toEqual({ x: 0, y: 1, z: 0 });
    const out = { x: 9, y: 9, z: 9 };
    expect(FLAT_TERRAIN.normalAt(1, 2, out)).toBe(out);
    expect(out).toEqual({ x: 0, y: 1, z: 0 });
    expect(FLAT_TERRAIN.gradeAlong(0, 0, 1)).toBe(0);
    expect(FLAT_TERRAIN.version).toBe(0);
    expect(Object.isFrozen(FLAT_TERRAIN)).toBe(true);
  });

  it('createTerrainService meneruskan ke field (datar di M0)', () => {
    const t = createTerrainService();
    expect(typeof t.field.add).toBe('function'); // M1: HeightField nyata (kosong = datar)
    expect(t.heightAt(5, 5)).toBe(0);
    expect(t.normalAt(5, 5)).toMatchObject({ x: expect.closeTo(0, 12), y: 1, z: expect.closeTo(0, 12) }); // -0 dari HeightField
    expect(t.gradeAlong(5, 5, 0)).toBe(0);
    expect(t.version).toBe(0);
  });
});
