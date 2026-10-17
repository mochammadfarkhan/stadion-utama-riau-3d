import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createProjection } from '../../src/geo/projection.js';
import { featuresNear, summarizeElement, overpassCheckQuery, bboxAround } from '../../tools/citybake/inspectOsm.js';
import { ORIGIN } from '../../tools/citybake/config.js';

const proj = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });
const raw = JSON.parse(readFileSync('tests/citybake/fixtures/osm-mini.json', 'utf8'));

describe('inspectOsm (alat verifikasi fakta OSM)', () => {
  it('featuresNear: elemen bertag dalam radius, urut jarak centroid; node tanpa geometri tetap diringkas', () => {
    const near = featuresNear(raw, proj, { x: 0, z: 0, radius: 300 });
    expect(near.length).toBeGreaterThan(0);
    expect(near.map((f) => f.distance)).toEqual([...near.map((f) => f.distance)].sort((a, b) => a - b));
    const road = near.find((f) => f.tags.includes('name=Jalan Uji Raya'));
    expect(road.tags).toContain('highway=primary');
    expect(near.find((f) => f.type === 'node')).toBeTruthy();
    expect(featuresNear(raw, proj, { x: 50000, z: 0, radius: 10 })).toEqual([]);
  });

  it('summarizeElement: centroid luas untuk way tertutup', () => {
    const b = raw.elements.find((e) => e.id === 1001);
    const s = summarizeElement(b, proj);
    expect(s.tags).toContain('building=yes');
    expect(s.bounds.minX).toBeLessThanOrEqual(s.centroid.x);
    expect(s.bounds.maxX).toBeGreaterThanOrEqual(s.centroid.x);
  });

  it('query Overpass memuat tag di luar cache bake dan bbox yang benar', () => {
    const bb = bboxAround(proj, 0, 0, 700);
    expect(bb.south).toBeLessThan(ORIGIN.lat);
    expect(bb.north).toBeGreaterThan(ORIGIN.lat);
    const q = overpassCheckQuery(bb);
    for (const k of ['aeroway', 'barrier', 'man_made', 'historic', 'tourism', 'leisure', 'sport', '[Gg]apura']) expect(q).toContain(k);
    expect(q).toContain(bb.south.toFixed(7));
    expect(q.endsWith('out tags center;')).toBe(true);
  });
});
