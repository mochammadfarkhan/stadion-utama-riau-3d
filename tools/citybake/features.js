/**
 * Model fitur ternormalisasi citybake.
 *
 * @typedef {'building'|'road'|'water'|'waterway'|'landuse'} FeatureKind
 * @typedef {{
 *   id: string,                       // 'osm:way/123', 'osm:relation/9', 'overture:<gers-id>[#k]'
 *   source: 'osm'|'overture',
 *   kind: FeatureKind,
 *   cls: string,                      // building: nilai building; road: highway; water: 'water';
 *                                     // waterway: river|canal|...; landuse: kunci LANDUSE_COLORS
 *   tags: Record<string, string>,
 *   rings?: Array<Array<[number, number]>>,  // poligon: [luar, ...lubang], ring terbuka
 *   line?: Array<[number, number]>,          // polyline
 * }} Feature
 *
 * Koordinat: [lon, lat] (urutan GeoJSON) setelah normalisasi; [x, z] meter dunia setelah projectFeature.
 */
import { cleanRing } from '../../src/geo/polygon.js';

/** Proyeksikan satu fitur [lon, lat] → [x, z] dunia. Mengembalikan objek baru. */
export function projectFeature(feature, projection) {
  const pt = ([lon, lat]) => {
    const w = projection.toWorld(lat, lon);
    return [w.x, w.z];
  };
  const out = { ...feature };
  if (feature.rings) out.rings = feature.rings.map((r) => cleanRing(r.map(pt), 1e-3)).filter((r) => r.length >= 3);
  if (feature.line) out.line = feature.line.map(pt);
  return out;
}

/** Proyeksikan daftar fitur; fitur poligon yang ring luarnya hilang dibuang. */
export function projectFeatures(features, projection) {
  return features
    .map((f) => projectFeature(f, projection))
    .filter((f) => (f.rings ? f.rings.length > 0 : true) && (f.line ? f.line.length >= 2 : true));
}
