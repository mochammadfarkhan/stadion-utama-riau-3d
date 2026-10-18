import { describe, it, expect } from 'vitest';
import { pointInPolygon } from '../../src/geo/polygon.js';
import { extractGround } from '../../tools/campusbake/ground/extract.js';
import { applyWaterLevels } from '../../tools/campusbake/ground/waterLevel.js';
import { createGroundContext } from '../../tools/campusbake/ground/context.js';
import { pickSpecies, placeVegetation } from '../../tools/campusbake/ground/vegetation.js';
import { placeProps } from '../../tools/campusbake/ground/props.js';
import { BOUNDARY, FEATURES, FIELD, PLAZAS } from './groundFixture.js';

const { E } = applyWaterLevels(extractGround({ features: FEATURES, plazas: PLAZAS }, BOUNDARY), FIELD);
const ctx = createGroundContext(E, { boundary: BOUNDARY, field: FIELD });
const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const inSq = (p, r) => pointInPolygon(p.x, p.z, r);

describe('pickSpecies', () => {
  it('campuran berbobot', () => {
    const mix = [['mahoni', 0.5], ['angsana', 0.3], ['saga', 0.2]];
    expect(pickSpecies(mix, 0.1)).toBe('mahoni');
    expect(pickSpecies(mix, 0.6)).toBe('angsana');
    expect(pickSpecies(mix, 0.95)).toBe('saga');
  });
});

describe('placeVegetation (fixture)', () => {
  const veg = placeVegetation(E, ctx);

  it('deterministik', () => expect(placeVegetation(E, ctx)).toEqual(veg));

  it('tidak ada pohon di luar distrik, di atas jalan/trotoar, di area keras/air, atau di gedung', () => {
    for (const p of veg) {
      expect(ctx.inside(p.x, p.z)).toBe(true);
      expect(ctx.area(p.x, p.z)).toBeNull();
      expect(ctx.building(p.x, p.z)).toBeNull();
      expect(ctx.roadEdge(p.x, p.z).d).toBeGreaterThanOrEqual(0.8);
      expect(ctx.walkEdge(p.x, p.z).d).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('hutan: peneduh mahoni/angsana/saga di dalam poligon hutan', () => {
    const forest = veg.filter((p) => inSq(p, sq(300, 20, 390, 120)));
    expect(forest.length).toBeGreaterThan(20);
    expect(forest.length).toBeLessThan(50);
    for (const p of forest) expect(['mahoni', 'angsana', 'saga']).toContain(p.sp);
  });

  it('kebun sawit: pola segitiga 9 m, hanya sawit', () => {
    const sawit = veg.filter((p) => p.sp === 'sawit');
    expect(sawit.length).toBeGreaterThan(100);
    expect(sawit.length).toBeLessThan(140);
    for (const p of sawit) expect(inSq(p, sq(20, 300, 120, 390))).toBe(true);
  });

  it('pohon tepi jalan 5 m dari tepi aspal (z 190 / 210); semak keliling parkir', () => {
    const street = veg.filter((p) => Math.abs(Math.abs(p.z - 200) - 10) < 1e-6);
    expect(street.length).toBeGreaterThan(40);
    const shrubs = veg.filter((p) => p.sp === 'semak');
    expect(shrubs.length).toBeGreaterThan(20);
  });
});

describe('placeProps (fixture)', () => {
  const props = placeProps(E, ctx);

  it('PJU tiap 35 m di sisi kiri jalan tersier, menghadap jalan (yaw 180°)', () => {
    expect(props.lamps).toHaveLength(12);
    expect(props.lamps[0].x).toBeCloseTo(10.5, 9);
    expect(props.lamps[0].z).toBeCloseTo(206, 9);
    expect(props.lamps[0].yaw).toBe(180);
  });

  it('bangku tiap 30 m bergantian sisi trotoar, menghadap trotoar; tong tiap 2 bangku', () => {
    expect(props.benches).toHaveLength(10);
    expect(props.benches[0].x).toBeCloseTo(97.4, 9);
    expect(props.benches[0].z).toBeCloseTo(65, 9);
    expect(props.benches[0].yaw).toBe(90);
    expect(props.benches[1].x).toBeCloseTo(102.6, 9);
    expect(props.benches[1].yaw).toBe(270);
    expect(props.bins).toHaveLength(5);
    expect(props.bins[0].z).toBeCloseTo(66.4, 9);
  });
});
