// tests/unri/rektoratMask.test.js
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { pointInPolygon } from '../../src/geo/polygon.js';
import { toWorld } from '../../src/geo/regionTransform.js';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { REKTORAT_MASK, rektoratMaskWorld } from '../../src/regions/unri-rektorat/mask.js';
import { REKTORAT_PADS, rektoratPadsWorld } from '../../src/regions/unri-rektorat/pads.js';
import { REKTORAT_RING, PERPUS_RING, DANAU_RING, PUTARAN, POROS, TITIAN } from '../../src/regions/unri-rektorat/site.data.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import * as lembagaModule from '../../src/regions/unri-lembaga/index.js';

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Dua segmen berpotongan (termasuk menyentuh). */
function segmentsCross(a, b, c, d) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0) !== (d2 > 0) || d1 === 0 || d2 === 0) && ((d3 > 0) !== (d4 > 0) || d3 === 0 || d4 === 0)
    && Math.min(a[0], b[0]) <= Math.max(c[0], d[0]) && Math.min(c[0], d[0]) <= Math.max(a[0], b[0])
    && Math.min(a[1], b[1]) <= Math.max(c[1], d[1]) && Math.min(c[1], d[1]) <= Math.max(a[1], b[1]);
}
/** Ring beririsan: ada sisi berpotongan atau satu titik di dalam ring lain. */
function ringsOverlap(r1, r2) {
  for (let i = 0; i < r1.length; i += 1) {
    for (let j = 0; j < r2.length; j += 1) {
      if (segmentsCross(r1[i], r1[(i + 1) % r1.length], r2[j], r2[(j + 1) % r2.length])) return true;
    }
  }
  return r1.some(([x, z]) => pointInPolygon(x, z, r2)) || r2.some(([x, z]) => pointInPolygon(x, z, r1));
}
const lembaga = Object.values(lembagaModule).find((v) => v?.id === 'unri-lembaga');
const lembagaWorld = lembaga.mask.map(([x, z]) => { const w = toWorld(lembaga.placement, x, z); return [w.x, w.z]; });

describe('mask unri-rektorat', () => {
  it('memuat Rektorat, perpustakaan, danau, putaran, poros, titian', () => {
    for (const ring of [REKTORAT_RING, PERPUS_RING, DANAU_RING, PUTARAN, POROS, TITIAN]) {
      for (const [x, z] of ring) expect(pointInPolygon(x, z, REKTORAT_MASK)).toBe(true);
    }
  });
  it('tidak beririsan dengan mask stadion maupun unri-lembaga (dunia)', () => {
    const mine = rektoratMaskWorld();
    expect(ringsOverlap(mine, stadionMaskWorld())).toBe(false);
    expect(ringsOverlap(mine, lembagaWorld)).toBe(false);
  });
  it('pad: ring ≥ 3 titik hingga, y median; versi dunia untuk campusbake (bentuk lembagaPadsWorld M4)', () => {
    expect(REKTORAT_PADS.map((p) => p.id)).toEqual(['rektorat', 'perpustakaan', 'papan-batu']);
    expect(rektoratPadsWorld()[0]).toEqual({ id: 'unri-rektorat:rektorat', y: 'median', ring: [[-999.8, 764], [-955.8, 764], [-955.8, 836], [-999.8, 836]] });
    for (const pad of REKTORAT_PADS) {
      expect(pad.ring.length).toBeGreaterThanOrEqual(3);
      expect(pad.ring.flat().every(Number.isFinite)).toBe(true);
      expect(pad.y).toBe('median');
    }
  });
});

const CACHE = 'data-src/osm/stadion.json';
describe.skipIf(!existsSync(CACHE))('mask vs OSM (cache)', () => {
  const els = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')).elements : [];
  const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
  const worldOf = (id) => els.find((e) => e.id === id).geometry.map((g) => { const p = proj.toWorld(g.lat, g.lon); return [p.x, p.z]; });
  it('seluruh titik mask di dalam poligon kampus way 938374562', () => {
    const campus = worldOf(938374562);
    for (const [x, z] of rektoratMaskWorld()) expect(pointInPolygon(x, z, campus)).toBe(true);
  });
  it('Area Parkir Perpustakaan (way 282225395, gedung OSM asing) di luar mask', () => {
    for (const [x, z] of worldOf(282225395)) expect(pointInPolygon(x, z, rektoratMaskWorld())).toBe(false);
  });
});
