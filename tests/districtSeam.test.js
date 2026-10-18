/**
 * Jahitan batas distrik UNRI (M2, spec §12 "tidak ada z-fighting/celah di batas distrik"), dibaca dari data yang
 * di-commit (public/tiles + public/districts/unri). Celah = ujung jalan/trotoar kota di tepi distrik yang tidak
 * berlanjut sebagai pita distrik, atau sampel bobot yang tidak konsisten dengan batas. Z-fighting dicegah oleh
 * konstruksi (lapisan kota diklip habis di dalam distrik — tests/osmFacts.test.js; lift + polygonOffset berjenjang;
 * terrain renderOrder −5) dan diperiksa visual di tools/shots/unriM2.mjs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { distanceToRing, pointInPolygon } from '../src/geo/polygon.js';
import { UNRI_BOUNDARY } from '../src/districts/unri/boundary.js';
import { parseGroundChunk } from '../src/districts/unri/groundData.js';
import { VEHICLE_CLASSES, WALK_CLASSES } from '../tools/campusbake/ground/constants.js';

const tilesManifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const district = JSON.parse(readFileSync('public/districts/unri/manifest.json', 'utf8'));
const ground = district.ground.chunks.map((key) => parseGroundChunk(
  JSON.parse(readFileSync(`public/districts/unri/ground/${key}.json`, 'utf8')), key,
));
const toPoints = (d, flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([d.center[0] + flat[i] * d.unit, d.center[1] + flat[i + 1] * d.unit]);
  return out;
};
const cityRoads = tilesManifest.tiles.filter((t) => t.area === 'stadion' || t.area === 'unri')
  .map((t) => JSON.parse(readFileSync(`public/tiles/${t.data.file}`, 'utf8')))
  .flatMap((d) => d.roads.map((r) => ({ cls: r.cls, pts: toPoints(d, r.pts) })));
const SERVED = new Set([...VEHICLE_CLASSES, ...WALK_CLASSES]);
const ribbons = ground.flatMap((g) => [...g.roads, ...g.walks]);
const paved = ground.flatMap((g) => g.areas.filter((a) => a.kind === 'parking' || a.kind === 'plaza'));
/**
 * Ujung jalan kota yang memang BERHENTI di batas (buntu di pagar kampus, tanpa lanjutan di OSM): [x, z, 'way OSM + alasan'].
 * Kosong secara default; isi hanya setelah memeriksa OSM untuk koordinat yang dilaporkan tes di bawah.
 */
const NATURAL_ENDS = [];

describe('jahitan batas distrik UNRI', () => {
  it('setiap chunk terrain punya data tanah', () => {
    expect([...district.ground.chunks].sort()).toEqual([...district.terrain.chunks].sort());
  });

  it('setiap ujung jalan/trotoar kota di tepi distrik berlanjut sebagai pita distrik (di atas pita) atau paving', () => {
    const ends = cityRoads.filter((r) => SERVED.has(r.cls))
      .flatMap((r) => [r.pts[0], r.pts[r.pts.length - 1]])
      .filter(([x, z]) => distanceToRing(x, z, UNRI_BOUNDARY) <= 0.25)
      .filter(([x, z]) => !NATURAL_ENDS.some(([nx, nz]) => Math.hypot(nx - x, nz - z) < 1));
    expect(ends.length).toBeGreaterThan(0);
    // Toleransi = lebar pita/2 (min 0,3 m): cache OSM stadion.json (2026-10-16) dan unri.json (2026-10-18) bisa
    // berbeda beberapa meter di simpul yang diedit di OSM; ujung kota tetap harus berada DI ATAS pita distrik.
    const covered = ([x, z]) => ribbons.some((r) => distanceToRing(x, z, r.pts, false) <= Math.max(0.3, r.w / 2))
      || paved.some((a) => pointInPolygon(x, z, a.rings[0]));
    expect(ends.filter((p) => !covered(p))).toEqual([]);
  });

  it('bobot permukaan: penuh (255) di dalam distrik, nol di luar (> 0,25 m dari tepi)', () => {
    const bad = [];
    for (const g of ground) {
      const { n, grass, soil, wet } = g.weights;
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          const x = g.origin.x + i * 4;
          const z = g.origin.z + j * 4;
          if (distanceToRing(x, z, UNRI_BOUNDARY) <= 0.25) continue;
          const k = j * n + i;
          const sum = grass[k] + soil[k] + wet[k];
          if (sum !== (pointInPolygon(x, z, UNRI_BOUNDARY) ? 255 : 0)) bad.push([g.key, x, z, sum]);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  }, 180000);
});
