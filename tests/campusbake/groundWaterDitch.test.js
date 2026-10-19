import { describe, it, expect } from 'vitest';
import { extractGround } from '../../tools/campusbake/ground/extract.js';
import { applyWaterLevels, waterLevel } from '../../tools/campusbake/ground/waterLevel.js';
import { createGroundContext } from '../../tools/campusbake/ground/context.js';
import { ditchRuns, inferredDitches, offsetPolyline, simplifyLine } from '../../tools/campusbake/ground/ditches.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };

describe('waterLevel', () => {
  it('muka = tepi terendah − 0,4; dipahat bila dasar < muka − 0,3', () => {
    const ring = [[40, 40], [80, 40], [80, 80], [40, 80]];
    expect(waterLevel([ring], FIELD)).toMatchObject({ level: -0.4, minEdge: 0, minInside: -1.5, carved: true });
    expect(waterLevel([ring], flat)).toMatchObject({ level: -0.4, carved: false });
  });

  it('applyWaterLevels: air dipahat diberi level, yang tidak dipahat dibuang + dilaporkan', () => {
    const E = extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY);
    const a = applyWaterLevels(E, FIELD);
    expect(a.E.areas.find((x) => x.kind === 'water').level).toBe(-0.4);
    expect(a.water).toEqual([{ id: 'osm:way/7', level: -0.4, carved: true }]);
    const b = applyWaterLevels(E, flat);
    expect(b.E.areas.some((x) => x.kind === 'water')).toBe(false);
    expect(b.water[0].carved).toBe(false);
    expect(E.areas.some((x) => x.kind === 'water')).toBe(true); // input tidak dimutasi
  });
});

describe('parit', () => {
  it('offsetPolyline: kiri = (−tz, tx); siku dimiter', () => {
    expect(offsetPolyline([[0, 0], [10, 0]], 2)).toEqual([[0, 2], [10, 2]]);
    const [, corner] = offsetPolyline([[0, 0], [10, 0], [10, 10]], 1);
    expect(corner[0]).toBeCloseTo(9, 9);
    expect(corner[1]).toBeCloseTo(1, 9);
  });

  it('simplifyLine: titik segaris dibuang, belokan dipertahankan', () => {
    expect(simplifyLine([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]])).toEqual([[0, 0], [3, 0], [3, 1]]);
  });

  it('ditchRuns: potong di titik terlarang, buang potongan < minRun', () => {
    const runs = ditchRuns([[0, 0], [20, 0]], (x) => x < 8 || x > 9, { step: 1, minRun: 4 });
    expect(runs).toEqual([[[0, 0], [7, 0]], [[10, 0], [20, 0]]]);
  });

  it('inferredDitches: dua sisi jalan tersier (z 192 & 208), terputus di trotoar x = 100, di dalam distrik', () => {
    const { E } = applyWaterLevels(extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY), FIELD);
    const ctx = createGroundContext(E, { boundary: BOUNDARY, field: FIELD });
    const ditches = inferredDitches(E.roads, ctx);
    expect(ditches).toHaveLength(4);
    for (const d of ditches) {
      expect(d.w).toBe(1);
      for (const [x, z] of d.line) {
        expect(Math.abs(z - 208) < 1e-9 || Math.abs(z - 192) < 1e-9).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0); // x = 0 tepat di tepi kiri dihitung "di dalam" oleh pointInPolygon
        expect(x).toBeLessThan(400);
        expect(Math.abs(x - 100)).toBeGreaterThan(1.5);
      }
    }
  });
});
