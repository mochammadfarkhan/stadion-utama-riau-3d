/**
 * Fitur OSM kampus untuk bake: ring kampus, jalan, gedung, danau — dari cache Overpass
 * `data-src/osm/<areaId>.json` (loader & normalisasi citybake), koordinat dunia. Murni kecuali loadCampusOsm.
 */
import { createProjection } from '../../src/geo/projection.js';
import { pointInPolygon, polygonCentroid } from '../../src/geo/polygon.js';
import { loadOsm, normalizeOsm } from '../citybake/fetchOsm.js';
import { projectFeatures } from '../citybake/features.js';

/** 'osm:way/123' → 'w123'; 'osm:relation/9#0' → 'r9#0' (id gedung kontrak M3). */
export function shortId(id) {
  const m = String(id).match(/^osm:(way|relation)\/(\d+)(#\d+)?$/);
  return m ? `${m[1] === 'way' ? 'w' : 'r'}${m[2]}${m[3] ?? ''}` : String(id);
}

/** Muat JSON Overpass mentah kampus (cache/online). */
export function loadCampusOsm(campus, { cacheDir, offline, log }) {
  return loadOsm(campus.areaId, campus.bbox, { cacheDir, offline, log });
}

/**
 * @param {object} raw JSON Overpass mentah
 * @param {{lat:number, lon:number}} origin
 * @returns {{timestamp:string|null, features:object[]}} fitur dunia
 */
export function campusFeatures(raw, origin) {
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  const osm = normalizeOsm(raw);
  return { timestamp: osm.timestamp, features: projectFeatures(osm.features, projection) };
}

/** Ring dunia way kampus. @throws bila tidak ada di cache */
export function campusRing(features, wayId) {
  const f = features.find((g) => g.id === `osm:way/${wayId}` && g.rings);
  if (!f) throw new Error(`way ${wayId} (poligon kampus) tidak ada di cache OSM`);
  return f.rings[0];
}

const touches = (line, ring) => line.some(([x, z]) => pointInPolygon(x, z, ring));

/** Jalan (polyline) yang punya titik di dalam batas; lebar dari `widths`, kelas di `skip` dibuang. */
export function campusRoads(features, boundary, widths, skip = []) {
  return features
    .filter((f) => f.kind === 'road' && widths[f.cls] && !skip.includes(f.cls) && touches(f.line, boundary))
    .map((f) => ({ id: shortId(f.id), cls: f.cls, width: widths[f.cls], line: f.line }));
}

/** Gedung OSM dengan centroid di dalam batas → pad. */
export function campusBuildingPads(features, boundary) {
  return features
    .filter((f) => f.kind === 'building' && f.source === 'osm')
    .filter((f) => {
      const c = polygonCentroid(f.rings[0]);
      return pointInPolygon(c.x, c.z, boundary);
    })
    .map((f) => ({ id: shortId(f.id), ring: f.rings[0], y: 'median' }));
}

/** Danau dari daftar konfigurasi (id pendek 'w…'); yang tidak ditemukan dilaporkan. */
export function campusLakes(features, lakes) {
  const found = [];
  const missing = [];
  for (const lake of lakes) {
    const f = features.find((g) => shortId(g.id) === lake.id && g.kind === 'water' && g.rings);
    if (f) found.push({ id: lake.id, name: lake.name, ring: f.rings[0] });
    else missing.push(lake.id);
  }
  return { lakes: found, missing };
}
