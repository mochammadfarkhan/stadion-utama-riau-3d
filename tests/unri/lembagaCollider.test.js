import { describe, it, expect } from 'vitest';
import { lembagaColliders } from '../../src/regions/unri-lembaga/collider.js';
import { fromSekre, FOOTPRINTS, toRegion } from '../../src/regions/unri-lembaga/placement.js';
import { SEKRE_DIM, LEMBAGA_LAYOUT } from '../../src/regions/unri-lembaga/layout.js';
import { PORTAL_DOORS } from '../../src/regions/unri-lembaga/portalDoors.js';
import { polygonCentroid } from '../../src/geo/polygon.js';

const c = lembagaColliders;
const S = (bx, bz) => {
  const p = fromSekre(bx, bz);
  return [p.x, p.z];
};

describe('collider region Lembaga', () => {
  it('ruang sekretariat padat, selasar & titik portal bebas (sepeda & kamera)', () => {
    expect(c.isWalkable(...S(4.8, -2))).toBe(false);
    expect(c.isWalkable(...S(-4.8, 6))).toBe(false);
    expect(c.isCameraClear(...S(4.8, -2))).toBe(false);
    for (const bz of [-8, -3, 0, 3, 8]) {
      expect(c.isWalkable(...S(0, bz))).toBe(true);
      expect(c.isCameraClear(...S(0, bz))).toBe(true);
    }
    const d = PORTAL_DOORS[0];
    expect(c.isWalkable(d.pos.lx, d.pos.lz)).toBe(true);
    expect(c.isWalkable(...S(1.6, -3))).toBe(false); // menempel dinding selasar (pad 0,55)
  });

  it('gedung lain padat: tribun, student center, rusunawa, FH', () => {
    for (const key of ['tribun', 'studentCenter', 'rusunawa']) {
      const p = polygonCentroid(FOOTPRINTS[key]);
      expect(c.isWalkable(p.x, p.z), key).toBe(false);
      expect(c.isCameraClear(p.x, p.z), key).toBe(false);
    }
    expect(c.isWalkable(...toRegion(-95, 590))).toBe(false); // sayap barat FH
    expect(c.isWalkable(...toRegion(-68, 590))).toBe(true); // halaman U FH (terbuka ke utara)
  });

  it('lapangan, lintasan, jalan, dan halaman depan bebas', () => {
    expect(c.isWalkable(...toRegion(-232.8, 954))).toBe(true);
    expect(c.isWalkable(...toRegion(-190, 954))).toBe(true);
    expect(c.isWalkable(...toRegion(-100, 700))).toBe(true);
    expect(c.isWalkable(...S(0, -(SEKRE_DIM.hz + 5)))).toBe(true); // spawn dev
  });

  it('baris motor & pagar menghalangi sepeda, bukan kamera', () => {
    const m = LEMBAGA_LAYOUT.lots.stadionMini.motors[10];
    expect(c.isWalkable(m.x, m.z)).toBe(false);
    expect(c.isCameraClear(m.x, m.z)).toBe(true);
    const f = LEMBAGA_LAYOUT.teras.fenceSegments[0];
    const mid = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2];
    expect(c.isWalkable(...mid)).toBe(false);
    expect(c.isWalkable(...S(LEMBAGA_LAYOUT.teras.fence.x, 0))).toBe(true); // gerbang pagar
  });

  it('penetration: 0 di tempat bebas, > 0 di dalam gedung, Infinity utk koordinat tak hingga', () => {
    expect(c.penetration(...S(0, 0))).toBe(0);
    expect(c.penetration(...S(4.8, -2))).toBeGreaterThan(0.5);
    expect(c.penetration(Number.NaN, 0)).toBe(Infinity);
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
  });
});
