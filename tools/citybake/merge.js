/**
 * Gabung bangunan OSM + Overture (koordinat dunia [x, z]). OSM menang bila tumpang tindih:
 * bangunan Overture dibuang bila (a) sumbernya OpenStreetMap (sudah ada versi Overpass yang lebih
 * segar), (b) centroid-nya di dalam poligon OSM, atau (c) centroid sebuah bangunan OSM di dalam
 * poligon Overture (Overture besar menutupi OSM kecil). Uji bbox dulu agar murah.
 */
import { boundsOverlap, pointInPolygon, polygonCentroid, ringBounds } from '../../src/geo/polygon.js';

const OSM_DATASET = 'OpenStreetMap';

/** Ringkasan geometri ring luar untuk uji tumpang tindih. */
function footprintInfo(feature) {
  const outer = feature.rings[0];
  return { outer, bounds: ringBounds(outer), c: polygonCentroid(outer) };
}

/** True bila dua footprint dianggap bangunan yang sama. */
function overlaps(a, b) {
  if (!boundsOverlap(a.bounds, b.bounds)) return false;
  return pointInPolygon(a.c.x, a.c.z, b.outer) || pointInPolygon(b.c.x, b.c.z, a.outer);
}

/**
 * @param {import('./features.js').Feature[]} osmBuildings
 * @param {import('./features.js').Feature[]} overtureBuildings
 * @returns {{ buildings: import('./features.js').Feature[],
 *   stats: { osm: number, overtureKept: number, droppedOsmSource: number, droppedOverlap: number } }}
 */
export function mergeBuildings(osmBuildings, overtureBuildings) {
  const osmInfo = osmBuildings.map(footprintInfo);
  const kept = [];
  let droppedOsmSource = 0;
  let droppedOverlap = 0;
  for (const ov of overtureBuildings) {
    if (ov.tags?.['overture:dataset'] === OSM_DATASET) {
      droppedOsmSource += 1;
      continue;
    }
    const info = footprintInfo(ov);
    if (osmInfo.some((o) => overlaps(o, info))) {
      droppedOverlap += 1;
      continue;
    }
    kept.push(ov);
  }
  return {
    buildings: [...osmBuildings, ...kept],
    stats: { osm: osmBuildings.length, overtureKept: kept.length, droppedOsmSource, droppedOverlap },
  };
}
