import { describe, it, expect } from 'vitest';
import { createProjection } from '../../src/geo/projection.js';
import { pointInPolygon, signedArea } from '../../src/geo/polygon.js';
import {
  ORIGIN, AREAS, ROAD_CLASSES, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, REGION_MASKS, OVERTURE, OVERPASS_ENDPOINTS, USER_AGENT,
  areaRect, areaTiles, areaFetchBBox, ellipseRing,
} from '../../tools/citybake/config.js';

const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });

describe('citybake config', () => {
  it('area stadion: persegi ±1500 m di origin → 36 tile (-3..2)', () => {
    const r = areaRect(AREAS.stadion, proj);
    expect(r.minX).toBeCloseTo(-1500, 6);
    expect(r.maxZ).toBeCloseTo(1500, 6);
    const tiles = areaTiles(AREAS.stadion, proj);
    expect(tiles).toHaveLength(36);
    expect(tiles[0].key).toBe('-3_-3');
  });

  it('area pusat: ±8,3 km timur-laut, 16 tile', () => {
    const tiles = areaTiles(AREAS.pusat, proj);
    expect(tiles).toHaveLength(16);
    expect(tiles.map((t) => t.key)).toContain('13_-10');
  });

  it('bbox fetch memuat pusat kawasan dan berorientasi benar', () => {
    for (const area of Object.values(AREAS)) {
      const b = areaFetchBBox(area, proj);
      expect(b.south).toBeLessThan(area.center.lat);
      expect(b.north).toBeGreaterThan(area.center.lat);
      expect(b.west).toBeLessThan(area.center.lon);
      expect(b.east).toBeGreaterThan(area.center.lon);
    }
  });

  it('kelas jalan: lebar positif & warna hex', () => {
    for (const [cls, v] of Object.entries(ROAD_CLASSES)) {
      expect(v.width, cls).toBeGreaterThan(0);
      expect(v.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const c of Object.values(LANDUSE_COLORS)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('prioritas landuse: permukiman paling bawah, parkir paling atas; lapisan datar berurutan', () => {
    expect(LANDUSE_ORDER[0]).toBe('residential');
    expect(LANDUSE_ORDER[LANDUSE_ORDER.length - 1]).toBe('parking');
    const topLanduse = LAYER_Y.landuse + (LANDUSE_ORDER.length - 1) * LAYER_Y.landuseStep;
    expect(topLanduse).toBeLessThan(LAYER_Y.water);
    expect(LAYER_Y.water).toBeLessThan(LAYER_Y.roadMinor);
    expect(LAYER_Y.roadMinor).toBeLessThan(LAYER_Y.roadMajor);
  });

  it('mask stadion: elips positif memuat stadion, tidak memuat Jl. Naga Sakti utara jauh', () => {
    const m = REGION_MASKS.find((v) => v.id === 'stadion');
    expect(signedArea(m.ring)).toBeGreaterThan(0);
    expect(pointInPolygon(0, 0, m.ring)).toBe(true);
    expect(pointInPolygon(0, -340, m.ring)).toBe(true);
    expect(pointInPolygon(0, -400, m.ring)).toBe(false);
    expect(pointInPolygon(300, 0, m.ring)).toBe(false);
  });

  it('ellipseRing: jumlah segmen & sumbu', () => {
    const r = ellipseRing(10, 20, 4);
    expect(r).toHaveLength(4);
    expect(r[0][0]).toBeCloseTo(10, 9);
    expect(r[1][1]).toBeCloseTo(20, 9);
  });

  it('sumber data terkonfigurasi', () => {
    expect(OVERTURE.release).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(OVERPASS_ENDPOINTS.length).toBeGreaterThan(0);
    expect(USER_AGENT).toMatch(/citybake/);
  });
});
