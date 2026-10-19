// tests/unri/rektoratData.test.js
/**
 * Data situs beku region unri-rektorat dicocokkan ulang dengan cache OSM (data-src/osm/stadion.json,
 * gitignore → dilewati bila tidak ada). Bila OSM berubah, tes gagal dan data beku ditinjau (fakta > gaya).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createProjection } from '../../src/geo/projection.js';
import { WORLD_ORIGIN } from '../../src/config/constants.js';
import { REKTORAT_PLACEMENT, REKTORAT_ACTIVATION, localToWorld, worldToLocal } from '../../src/regions/unri-rektorat/placement.js';
import * as SITE from '../../src/regions/unri-rektorat/site.data.js';

const CACHE = 'data-src/osm/stadion.json';
const HAS_CACHE = existsSync(CACHE);
const ways = HAS_CACHE
  ? new Map(JSON.parse(readFileSync(CACHE, 'utf8')).elements.filter((e) => e.type === 'way').map((e) => [e.id, e]))
  : new Map();
const proj = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });

/** Way OSM → titik lokal region (ring tertutup: titik penutup dibuang). */
function localOf(id) {
  const w = ways.get(id);
  const pts = w.geometry.map((g) => {
    const p = proj.toWorld(g.lat, g.lon);
    return [p.x - REKTORAT_PLACEMENT.x, p.z - REKTORAT_PLACEMENT.z];
  });
  return w.nodes[0] === w.nodes[w.nodes.length - 1] ? pts.slice(0, -1) : pts;
}

const CASES = [
  ['REKTORAT_RING', 'rektorat'], ['PERPUS_RING', 'perpustakaan'], ['DANAU_RING', 'danau'],
  ['PUTARAN', 'putaran'], ['POROS', 'poros'], ['PARKIR', 'parkir'], ['PULAU_PARKIR', 'pulauParkir'],
  ['JALAN_DEPAN', 'jalanDepan'], ['JALAN_UTARA_REKTORAT', 'jalanUtaraRektorat'], ['LOOP_REKTORAT', 'loopRektorat'],
  ['MUCHTAR_UTARA', 'muchtarUtara'], ['MUCHTAR_SELATAN', 'muchtarSelatan'], ['TERTIARY_US', 'tertiaryUS'],
  ['TITIAN', 'titian'],
];

describe.skipIf(!HAS_CACHE)('data situs beku unri-rektorat = cache OSM (±0,11 m)', () => {
  it.each(CASES)('%s cocok dengan way OSM', (name, key) => {
    const osm = localOf(SITE.OSM_IDS[key]);
    const frozen = SITE[name];
    expect(frozen).toHaveLength(osm.length);
    frozen.forEach(([x, z], i) => {
      expect(Math.abs(x - osm[i][0])).toBeLessThan(0.11);
      expect(Math.abs(z - osm[i][1])).toBeLessThan(0.11);
    });
  });
});

describe('placement & massa turunan', () => {
  it('yaw 0: lokal = dunia − titik acuan (seluruh modul region mengandalkan ini)', () => {
    expect(REKTORAT_PLACEMENT).toEqual({ x: -985.8, z: 800.0, yaw: 0 });
    expect(localToWorld(10, -5)).toEqual([-975.8, 795]);
    const [lx, lz] = worldToLocal(-984.0, 800.1);
    expect(lx).toBeCloseTo(1.8, 6);
    expect(lz).toBeCloseTo(0.1, 6);
  });
  it('aktivasi berpusat di poros taman, radius spec §4.3', () => {
    expect(REKTORAT_ACTIVATION).toEqual({ center: { x: -905.8, z: 805.0 }, mountRadius: 700, unmountRadius: 900 });
  });
  it('blok tengah Rektorat simetris terhadap z = 0 dan kanopi di depan blok tengah', () => {
    const { slab, tengah, kanopi } = SITE.REKTORAT_MASSA;
    expect(tengah.z0).toBe(-tengah.z1);
    expect(kanopi.z0).toBe(-kanopi.z1);
    expect(tengah.x0).toBe(slab.x1);
    expect(kanopi.x0).toBeGreaterThan(tengah.x1);
    expect(kanopi.x1 - kanopi.x0).toBeCloseTo(8.6, 6);
  });
  it('kuadran perpustakaan berada di dalam bbox ring OSM', () => {
    const xs = SITE.PERPUS_RING.map((p) => p[0]);
    const zs = SITE.PERPUS_RING.map((p) => p[1]);
    for (const ring of SITE.PERPUS_MASSA.kuadran) {
      for (const [x, z] of ring) {
        expect(x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
        expect(x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
        expect(z).toBeGreaterThanOrEqual(Math.min(...zs) - 1e-9);
        expect(z).toBeLessThanOrEqual(Math.max(...zs) + 1e-9);
      }
    }
    expect(SITE.PERPUS_MASSA.kuadran).toHaveLength(4);
  });
});
