import { describe, it, expect } from 'vitest';
import { createProjection } from '../../src/geo/projection.js';
import { pointInPolygon, signedArea } from '../../src/geo/polygon.js';
import {
  ORIGIN, AREAS, DISTRICTS, ROAD_CLASSES, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, REGION_MASKS, OVERTURE, OVERPASS_ENDPOINTS, USER_AGENT,
  areaRect, areaTiles, areaFetchBBox,
} from '../../tools/citybake/config.js';
import { stadionMaskWorld, STADION_MASK } from '../../src/regions/stadion/mask.js';
import { stadionRegion } from '../../src/regions/stadion/index.js';
import { regionContains } from '../../src/regions/Region.js';
import { UNRI_BOUNDARY } from '../../src/districts/unri/boundary.js';

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

  it('mask stadion: ring positif memuat stadion & parkir, tidak memuat Jl. Naga Sakti OSM (z ≈ −447)', () => {
    const m = REGION_MASKS.find((v) => v.id === 'stadion');
    expect(signedArea(m.ring)).toBeGreaterThan(0);
    expect(pointInPolygon(0, 0, m.ring)).toBe(true);
    expect(pointInPolygon(0, -340, m.ring)).toBe(true);
    expect(pointInPolygon(0, -447, m.ring)).toBe(false);
    expect(pointInPolygon(300, 0, m.ring)).toBe(false);
  });

  it('satu sumber mask: ring bake = mask region klien setelah placement; keputusan sama di seluruh grid', () => {
    const m = REGION_MASKS.find((v) => v.id === 'stadion');
    expect(m.ring).toEqual(stadionMaskWorld());
    expect(m.ring).toHaveLength(STADION_MASK.length);
    const mismatch = [];
    for (let x = -700; x <= 700; x += 17) {
      for (let z = -700; z <= 700; z += 17) {
        if (pointInPolygon(x, z, m.ring) !== regionContains(stadionRegion, x, z)) mismatch.push([x, z]);
      }
    }
    expect(mismatch).toEqual([]);
  });

  it('stadionMaskWorld menerapkan placement (rotasi + geser)', () => {
    const ring = stadionMaskWorld({ x: 10, z: 20, yaw: Math.PI / 2 }, [[1, 0], [0, 1], [-1, 0]]);
    expect(ring[0][0]).toBeCloseTo(10, 9);
    expect(ring[0][1]).toBeCloseTo(19, 9);
  });

  it('sumber data terkonfigurasi', () => {
    expect(OVERTURE.release).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(OVERPASS_ENDPOINTS.length).toBeGreaterThan(0);
    expect(USER_AGENT).toMatch(/citybake/);
  });

  it('area unri: 16 tile di luar area stadion, persegi memuat seluruh batas distrik', () => {
    const tiles = areaTiles(AREAS.unri, proj);
    expect(tiles).toHaveLength(16);
    const stadionKeys = new Set(areaTiles(AREAS.stadion, proj).map((t) => t.key));
    expect(tiles.some((t) => stadionKeys.has(t.key))).toBe(false);
    expect(tiles.map((t) => t.key)).toEqual(expect.arrayContaining(['-4_-1', '-4_4', '-3_4', '1_3']));
    const r = areaRect(AREAS.unri, proj);
    for (const [x, z] of UNRI_BOUNDARY) {
      expect(x).toBeGreaterThan(r.minX);
      expect(x).toBeLessThan(r.maxX);
      expect(z).toBeGreaterThan(r.minZ);
      expect(z).toBeLessThan(r.maxZ);
    }
  });

  it('bbox fetch unri memuat Gerbang Soebrantas (lat 0,46441) & tepi barat kampus (lon 101,37495)', () => {
    const b = areaFetchBBox(AREAS.unri, proj);
    expect(b.south).toBeLessThan(0.46434);
    expect(b.west).toBeLessThan(101.37495);
  });

  it('skipAreas tak dikenal → galat jelas', () => {
    expect(() => areaTiles({ ...AREAS.unri, skipAreas: ['bandara'] }, proj)).toThrow(/skipAreas/);
  });

  it('DISTRICTS: unri memakai UNRI_BOUNDARY + berkas buildings.json (M3)', () => {
    expect(DISTRICTS.map((d) => d.id)).toEqual(['unri']);
    expect(DISTRICTS[0].ring).toBe(UNRI_BOUNDARY);
    expect(DISTRICTS[0].buildingsFile).toBe('public/districts/unri/buildings.json');
  });
});
