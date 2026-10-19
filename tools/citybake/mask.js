/**
 * Buang/klip fitur kota terhadap (1) mask region handmade dan (2) batas distrik berelevasi.
 * Mask region (config.REGION_MASKS, ring DUNIA): poligon dibuang bila centroid ring luarnya di dalam mask;
 * polyline dipotong per segmen (titik tengah di dalam → dibuang), sisa bersambung menjadi `<id>~k`.
 * Distrik (config.DISTRICTS, spec §6): air/landuse = SELISIH eksak terhadap ring distrik (polygon-clipping,
 * potongan `<id>~c<k>`); bangunan dibuang bila id OSM ∈ excludeIds ATAU centroid di dalam distrik (Overture
 * tanpa id OSM); jalan/sungai dipotong eksak di tepi ring (lineClip), bagian dalam dibuang (`<id>~d<k>`).
 */
import polygonClipping from 'polygon-clipping';
import {
  boundsOverlap, cleanRing, pointInPolygon, polygonArea, polygonCentroid, ringBounds,
} from '../../src/geo/polygon.js';
import { splitPolylineByRing } from '../../src/geo/lineClip.js';

const insideAny = (x, z, rings) => rings.some((r) => pointInPolygon(x, z, r));

/** Pecah polyline menjadi bagian di luar semua mask. */
export function splitLineOutside(line, rings) {
  const parts = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    if (insideAny((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, rings)) {
      cur = null;
      continue;
    }
    if (!cur) {
      cur = [a];
      parts.push(cur);
    }
    cur.push(b);
  }
  return parts;
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia
 * @param {Array<Array<[number, number]>>} rings ring mask dunia
 * @returns {import('./features.js').Feature[]} fitur baru (input tidak dimutasi)
 */
export function applyMasks(features, rings) {
  if (rings.length === 0) return features.slice();
  const out = [];
  for (const f of features) {
    if (f.rings) {
      const c = polygonCentroid(f.rings[0]);
      if (!insideAny(c.x, c.z, rings)) out.push(f);
      continue;
    }
    const parts = splitLineOutside(f.line, rings);
    if (parts.length === 1 && parts[0].length === f.line.length) out.push(f);
    else parts.forEach((line, k) => out.push({ ...f, id: `${f.id}~${k}`, line }));
  }
  return out;
}

/** Serpihan hasil klip lebih kecil dari ini (m²) dibuang. */
const MIN_PIECE_AREA = 0.01;
const OSM_ID = /^osm:(way|relation)\/(\d+)/;

/** 'osm:way/123' → 'w123', 'osm:relation/9#0' → 'r9'; selain OSM → null. */
export function osmShortId(id) {
  const m = String(id).match(OSM_ID);
  return m ? `${m[1] === 'way' ? 'w' : 'r'}${m[2]}` : null;
}

/** Poligon dikurangi ring distrik; tanpa irisan → fitur asli (objek sama). */
function differencePolygon(f, ring) {
  if (polygonClipping.intersection(f.rings, [ring]).length === 0) return [f];
  const pieces = polygonClipping.difference(f.rings, [ring])
    .map((poly) => poly.map((r) => cleanRing(r, 1e-9)).filter((r) => r.length >= 3))
    .filter((rings) => rings.length > 0 && polygonArea(rings[0]) > MIN_PIECE_AREA);
  return pieces.map((rings, k) => ({ ...f, id: pieces.length === 1 ? f.id : `${f.id}~c${k}`, rings }));
}

/** Polyline tanpa bagian di dalam ring; tanpa irisan → fitur asli (objek sama). */
function splitLineFeature(f, ring) {
  const { inside, outside } = splitPolylineByRing(f.line, ring);
  if (inside.length === 0) return [f];
  return outside.map((line, k) => ({ ...f, id: `${f.id}~d${k}`, line }));
}

function applyDistrict(features, { ring, excludeIds = new Set() }) {
  const db = ringBounds(ring);
  const out = [];
  for (const f of features) {
    if (f.kind === 'building') {
      const sid = osmShortId(f.id);
      if (sid && excludeIds.has(sid)) continue;
      const c = polygonCentroid(f.rings[0]);
      if (!pointInPolygon(c.x, c.z, ring)) out.push(f);
      continue;
    }
    const fb = ringBounds(f.rings ? f.rings[0] : f.line);
    if (!boundsOverlap(fb, db)) out.push(f);
    else if (f.rings) out.push(...differencePolygon(f, ring));
    else out.push(...splitLineFeature(f, ring));
  }
  return out;
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia
 * @param {Array<{id: string, ring: Array<[number, number]>, excludeIds?: Set<string>}>} districts
 * @returns {import('./features.js').Feature[]} daftar baru (input tidak dimutasi)
 */
export function applyDistricts(features, districts) {
  let out = features.slice();
  for (const d of districts) out = applyDistrict(out, d);
  return out;
}
