/**
 * Alat verifikasi fakta OSM untuk keputusan konten region (Plan C, I4). Dua mode:
 * 1) Ringkas elemen OSM di sekitar titik DUNIA dari cache bake (data-src/osm/<area>.json, `out geom`):
 *      node tools/citybake/inspectOsm.js --area stadion --at -60,-480 --radius 150
 * 2) Cetak query Overpass untuk tag yang TIDAK diambil citybake (aeroway, barrier, man_made, historic,
 *    tourism, leisure/sport lain, nama), lalu jalankan sendiri dengan curl (butuh jaringan):
 *      node tools/citybake/inspectOsm.js --overpass --at 0,0 --radius 700
 * Fungsi murni diekspor untuk tes; I/O hanya di main().
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { createProjection } from '../../src/geo/projection.js';
import { polygonCentroid } from '../../src/geo/polygon.js';
import { ORIGIN, PATHS } from './config.js';

const SUMMARY_KEYS = Object.freeze([
  'name', 'highway', 'building', 'natural', 'water', 'waterway', 'landuse', 'leisure', 'sport', 'amenity',
  'aeroway', 'barrier', 'man_made', 'historic', 'tourism', 'area',
]);

/** Titik dunia sebuah elemen Overpass (`out geom` way/relation, node, atau `out center`). */
export function elementPoints(el, projection) {
  const ll = el.geometry ?? (el.members ?? []).flatMap((m) => m.geometry ?? []);
  const pts = ll.length ? ll : [el.center ?? (Number.isFinite(el.lat) ? { lat: el.lat, lon: el.lon } : null)].filter(Boolean);
  return pts.map((g) => {
    const w = projection.toWorld(g.lat, g.lon);
    return [w.x, w.z];
  });
}

/** Ringkasan satu elemen: id, tag penting, centroid (luas bila tertutup), batas. */
export function summarizeElement(el, projection) {
  const pts = elementPoints(el, projection);
  const tags = el.tags ?? {};
  const closed = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const c = closed ? polygonCentroid(pts.slice(0, -1)) : {
    x: pts.reduce((s, p) => s + p[0], 0) / Math.max(1, pts.length),
    z: pts.reduce((s, p) => s + p[1], 0) / Math.max(1, pts.length),
  };
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return {
    type: el.type,
    id: el.id,
    tags: SUMMARY_KEYS.filter((k) => tags[k] !== undefined).map((k) => `${k}=${tags[k]}`).join(','),
    centroid: { x: Math.round(c.x), z: Math.round(c.z) },
    bounds: pts.length
      ? { minX: Math.round(Math.min(...xs)), maxX: Math.round(Math.max(...xs)), minZ: Math.round(Math.min(...zs)), maxZ: Math.round(Math.max(...zs)) }
      : null,
  };
}

/** Elemen bertag yang punya titik dalam radius (m) dari (x, z), urut jarak centroid. */
export function featuresNear(raw, projection, { x, z, radius }) {
  const out = [];
  for (const el of raw.elements ?? []) {
    if (!el.tags) continue;
    const pts = elementPoints(el, projection);
    if (!pts.some(([px, pz]) => Math.hypot(px - x, pz - z) <= radius)) continue;
    const s = summarizeElement(el, projection);
    out.push({ ...s, distance: Math.round(Math.hypot(s.centroid.x - x, s.centroid.z - z)) });
  }
  return out.sort((a, b) => a.distance - b.distance || a.id - b.id);
}

/** Bbox lat/lon persegi ±radius di sekitar titik dunia. */
export function bboxAround(projection, x, z, radius) {
  const sw = projection.toLatLon(x - radius, z + radius); // z besar = selatan
  const ne = projection.toLatLon(x + radius, z - radius);
  return { south: sw.lat, west: sw.lon, north: ne.lat, east: ne.lon };
}

/** Query Overpass (out tags center) untuk tag yang tidak ada di cache bake. */
export function overpassCheckQuery({ south, west, north, east }) {
  const b = [south, west, north, east].map((v) => v.toFixed(7)).join(',');
  const lines = [
    '  nwr["aeroway"]', '  nwr["barrier"~"^(gate|entrance|lift_gate)$"]', '  nwr["man_made"]', '  nwr["historic"]',
    '  nwr["tourism"]', '  nwr["leisure"]', '  nwr["sport"]', '  nwr["entrance"]',
    '  nwr["name"~"[Gg]apura|[Gg]erbang|[Hh]elipad|[Ss]kate|[Aa]mfi|[Aa]mphi|[Dd]anau|[Ss]ungai|[Tt]ugu|[Ll]ancang"]',
  ].map((l) => `${l}(${b});`);
  return ['[out:json][timeout:60];', '(', ...lines, ');', 'out tags center;'].join('\n');
}

function parseAt(text) {
  const [x, z] = String(text ?? '').split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('--at harus "x,z" (meter dunia)');
  return { x, z };
}

/** CLI; mengembalikan exit code. */
export async function main(argv, log = console) {
  const { values } = parseArgs({
    args: argv,
    options: {
      area: { type: 'string', default: 'stadion' },
      at: { type: 'string' },
      radius: { type: 'string', default: '150' },
      overpass: { type: 'boolean', default: false },
      cache: { type: 'string', default: PATHS.cacheDir },
    },
    strict: true,
  });
  const projection = createProjection({ lat0: ORIGIN.lat, lon0: ORIGIN.lon });
  const { x, z } = parseAt(values.at);
  const radius = Number(values.radius);
  if (values.overpass) {
    log.info(overpassCheckQuery(bboxAround(projection, x, z, radius)));
    return 0;
  }
  const file = join(values.cache, 'osm', `${values.area}.json`);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  log.info(`# ${file} (OSM ${raw.osm3s?.timestamp_osm_base ?? '?'}) — sekitar (${x}, ${z}) r=${radius} m`);
  for (const f of featuresNear(raw, projection, { x, z, radius })) {
    log.info(`${f.type}/${f.id}\t${f.tags}\tc=(${f.centroid.x},${f.centroid.z})\td=${f.distance}`);
  }
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/citybake/inspectOsm.js')) {
  process.exitCode = await main(process.argv.slice(2)).catch((err) => {
    console.error(`[inspectOsm] gagal: ${err.message}`);
    return 1;
  });
}
