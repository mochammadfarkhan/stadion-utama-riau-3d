import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STADION_PLACEMENT, STADION_FOOTPRINT } from '../src/regions/stadion/placement.js';
import { STADION_FOOTPRINT_LATLON } from '../src/regions/stadion/footprint.js';
import { WORLD_ORIGIN } from '../src/config/constants.js';
import { ORIGIN } from '../tools/citybake/config.js';
import { polygonArea } from '../src/geo/polygon.js';
import { stadionRegion } from '../src/regions/stadion/index.js';

describe('placement stadion dari footprint OSM (Fase 3)', () => {
  it('origin dunia satu sumber: config klien = citybake = manifest', () => {
    const m = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
    expect(ORIGIN).toBe(WORLD_ORIGIN);
    expect(m.origin).toEqual({ lat: WORLD_ORIGIN.lat, lon: WORLD_ORIGIN.lon });
  });

  it('footprint 52 titik, luas ±52.900 m², ukuran ±222 × 296 m', () => {
    expect(STADION_FOOTPRINT_LATLON).toHaveLength(52);
    expect(polygonArea(STADION_FOOTPRINT)).toBeGreaterThan(52500);
    expect(polygonArea(STADION_FOOTPRINT)).toBeLessThan(53300);
    const xs = STADION_FOOTPRINT.map((p) => p[0]);
    const zs = STADION_FOOTPRINT.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(222, -1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(296, -1);
  });

  it('placement ≈ identitas (origin = centroid yang sama; sumbu panjang ≈ utara–selatan)', () => {
    expect(Math.abs(STADION_PLACEMENT.x)).toBeLessThan(0.05);
    expect(Math.abs(STADION_PLACEMENT.z)).toBeLessThan(0.05);
    expect(Math.abs(STADION_PLACEMENT.yaw)).toBeLessThan(1e-3);
    expect(stadionRegion.placement).toEqual(STADION_PLACEMENT);
  });
});
