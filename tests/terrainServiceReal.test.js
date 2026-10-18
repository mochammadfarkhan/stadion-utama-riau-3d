import { describe, it, expect } from 'vitest';
import { createTerrainService, FLAT_TERRAIN } from '../src/app/terrainService.js';
import { decodeChunk } from '../src/geo/terrain/heightfield.js';
import { TERRAIN_HEADER, N, BIAS, UNIT } from '../src/geo/terrain/format.js';

const chunk = (key, y) => {
  const buf = new ArrayBuffer(N * N * 2);
  const v = new DataView(buf);
  for (let i = 0; i < N * N; i += 1) v.setUint16(i * 2, Math.round(y / UNIT) - BIAS, true);
  return decodeChunk(buf, { ...TERRAIN_HEADER, key });
};

describe('terrainService nyata (M1)', () => {
  it('kosong = datar (paritas stub M0)', () => {
    const t = createTerrainService();
    expect(t.heightAt(0, 0)).toBe(0);
    expect(t.gradeAlong(0, 0, 1)).toBe(0);
    expect(t.normalAt(0, 0)).toEqual({ x: -0, y: 1, z: -0 });
    expect(t.version).toBe(0);
  });
  it('heightAt/version mengikuti HeightField field yang sama', () => {
    const t = createTerrainService();
    t.field.add(chunk('-1_2', 2.5));
    expect(t.heightAt(-250, 1250)).toBeCloseTo(2.5, 6);
    expect(t.version).toBe(1);
    t.field.remove('-1_2');
    expect(t.heightAt(-250, 1250)).toBe(0);
    expect(t.version).toBe(2);
  });
  it('FLAT_TERRAIN beku: normalAt menulis ke out', () => {
    const out = { x: 9, y: 9, z: 9 };
    expect(FLAT_TERRAIN.normalAt(1, 2, out)).toBe(out);
    expect(out).toEqual({ x: 0, y: 1, z: 0 });
    expect(Object.isFrozen(FLAT_TERRAIN)).toBe(true);
  });
});
