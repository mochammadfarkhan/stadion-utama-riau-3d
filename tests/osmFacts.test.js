/**
 * Fakta OSM yang mendasari keputusan konten (dibaca dari tile yang di-commit, OSM 2026-10-16).
 * Bila bake baru mengubah fakta ini, tes gagal dan keputusan terkait harus ditinjau ulang (fakta mengalahkan gaya).
 * - Blok "kawasan stadion": dasar keputusan I4 (Plan C).
 * - Blok "klip distrik UNRI": DIPERBARUI SENGAJA di M2 (2026-10-17) — citybake kini mengklip kota terhadap
 *   UNRI_BOUNDARY (spec §6): gedung kampus, landuse/air, dan jalan di dalam distrik bukan lagi milik tile kota,
 *   melainkan distrik (public/districts/unri). Area bake baru `unri` menambah tile tepi barat/selatan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { distanceToRing, pointInPolygon, polygonCentroid } from '../src/geo/polygon.js';
import { UNRI_BOUNDARY } from '../src/districts/unri/boundary.js';

const manifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const load = (area) => manifest.tiles.filter((t) => t.area === area)
  .map((t) => JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8')));
const tiles = load('stadion');
const kampusTiles = [...tiles, ...load('unri')];

/** Array datar tile-lokal (0,1 m) → titik dunia. */
const toPoints = (d, flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([d.center[0] + flat[i] * d.unit, d.center[1] + flat[i + 1] * d.unit]);
  return out;
};
const roads = tiles.flatMap((d) => d.roads.map((r) => ({ ...r, pts: toPoints(d, r.pts) })));
const water = tiles.flatMap((d) => d.water.map((w) => toPoints(d, w.rings[0])));
const waterways = tiles.flatMap((d) => d.waterways.map((w) => toPoints(d, w.pts)));

describe('fakta OSM kawasan stadion (dasar keputusan I4)', () => {
  it('Jl. Naga Sakti nyata (primary) berada di z −475…−440 pada |x| ≤ 300 — bukan z −390 seperti versi handmade', () => {
    const pts = roads.filter((r) => r.name === 'Jalan Naga Sakti').flatMap((r) => r.pts).filter(([x]) => Math.abs(x) <= 300);
    expect(pts.length).toBeGreaterThan(4);
    for (const [, z] of pts) {
      expect(z).toBeGreaterThan(-475);
      expect(z).toBeLessThan(-440);
    }
  });

  it('dua danau OSM di utara stadion (way 419836906 ≈ (−192, −290), way 327378220 ≈ (119, −384))', () => {
    const cs = water.map((r) => polygonCentroid(r));
    for (const [x, z] of [[-192, -290], [119, -384]]) {
      expect(cs.some((c) => Math.hypot(c.x - x, c.z - z) < 15)).toBe(true);
    }
  });

  it('tidak ada air di posisi danau handmade (−60, −480)', () => {
    expect(water.some((r) => pointInPolygon(-60, -480, r))).toBe(false);
    expect(water.map((r) => polygonCentroid(r)).some((c) => Math.hypot(c.x + 60, c.z + 480) < 100)).toBe(false);
  });

  it('tidak ada sungai/parit di jalur sungai handmade (x 300…360, z −300…300)', () => {
    const hit = waterways.flatMap((l) => l).some(([x, z]) => x > 300 && x < 360 && z > -300 && z < 300);
    expect(hit).toBe(false);
  });
});

describe('fakta klip distrik UNRI (M2): kota tidak menimpa distrik', () => {
  /** Di dalam distrik dan > 0,25 m dari tepi (toleransi kuantisasi 0,1 m tile). */
  const strictlyInside = ([x, z]) => pointInPolygon(x, z, UNRI_BOUNDARY) && distanceToRing(x, z, UNRI_BOUNDARY) > 0.25;

  it('manifest memuat area unri yang tilenya tidak beririsan dengan area stadion', () => {
    const unri = manifest.areas.find((a) => a.id === 'unri');
    expect(unri).toBeDefined();
    const stadion = new Set(manifest.areas.find((a) => a.id === 'stadion').tiles);
    expect(unri.tiles.length).toBeGreaterThan(0);
    expect(unri.tiles.some((k) => stadion.has(k))).toBe(false);
  });

  it('tidak ada bangunan kota bercentroid di dalam distrik (Rektorat, Masjid Arfa\'unnas, GGM milik distrik)', () => {
    const hits = kampusTiles.flatMap((d) => d.buildings.map((b) => polygonCentroid(toPoints(d, b.ring))))
      .filter((c) => pointInPolygon(c.x, c.z, UNRI_BOUNDARY));
    expect(hits).toEqual([]);
  });

  it('tidak ada titik jalan / air / sungai kota di dalam distrik', () => {
    const pts = kampusTiles.flatMap((d) => [
      ...d.roads.flatMap((r) => toPoints(d, r.pts)),
      ...d.water.flatMap((w) => w.rings.flatMap((r) => toPoints(d, r))),
      ...d.waterways.flatMap((w) => toPoints(d, w.pts)),
    ]);
    expect(pts.filter(strictlyInside)).toEqual([]);
  });
});
