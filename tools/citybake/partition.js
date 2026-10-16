/**
 * Bagi fitur dunia ke tile. Bangunan TIDAK dipotong: seluruh bangunan masuk tile yang memuat
 * centroid-nya (dinding palsu di tepi tile dihindari; bangunan boleh sedikit menjorok ke tetangga).
 * Air/landuse dipotong ke batas tile (Sutherland–Hodgman); jalan/sungai garis dipotong (Liang–Barsky).
 */
import {
  boundsOverlap, clipPolygonToRect, clipPolylineToRect, polygonCentroid, ringBounds,
} from '../../src/geo/polygon.js';
import { tileBounds, tileOf, tileKey, TILE_SIZE } from '../../src/geo/tiles.js';

/** @typedef {{ix: number, iz: number, key: string, buildings: object[], roads: object[], water: object[],
 *   waterways: object[], landuse: object[]}} TileBucket */

const LAYER_OF = { building: 'buildings', road: 'roads', water: 'water', waterway: 'waterways', landuse: 'landuse' };

function clipPolygonFeature(f, rect) {
  const outer = clipPolygonToRect(f.rings[0], rect);
  if (outer.length === 0) return null;
  const holes = f.rings.slice(1).map((h) => clipPolygonToRect(h, rect)).filter((h) => h.length >= 3);
  return { ...f, rings: [outer, ...holes] };
}

/**
 * @param {import('./features.js').Feature[]} features koordinat dunia, sudah di-merge & di-mask
 * @param {Array<{ix: number, iz: number}>} tiles tile yang di-bake
 * @returns {Map<string, TileBucket>}
 */
export function partitionFeatures(features, tiles, size = TILE_SIZE) {
  const buckets = new Map();
  for (const t of tiles) {
    const key = tileKey(t.ix, t.iz);
    buckets.set(key, { ix: t.ix, iz: t.iz, key, buildings: [], roads: [], water: [], waterways: [], landuse: [] });
  }
  const rects = [...buckets.values()].map((b) => ({ b, rect: tileBounds(b.ix, b.iz, size) }));
  for (const f of features) {
    const layer = LAYER_OF[f.kind];
    if (!layer) continue;
    if (f.kind === 'building') {
      const c = polygonCentroid(f.rings[0]);
      const t = tileOf(c.x, c.z, size);
      buckets.get(tileKey(t.ix, t.iz))?.buildings.push(f);
      continue;
    }
    const fb = ringBounds(f.rings ? f.rings[0] : f.line);
    for (const { b, rect } of rects) {
      if (!boundsOverlap(fb, rect)) continue;
      if (f.rings) {
        const clipped = clipPolygonFeature(f, rect);
        if (clipped) b[layer].push(clipped);
      } else {
        for (const line of clipPolylineToRect(f.line, rect)) b[layer].push({ ...f, line });
      }
    }
  }
  return buckets;
}
