/**
 * TileCollider: collider kota dari data tile (koordinat DUNIA). Spatial hash sel 25 m; tiap bentuk
 * didaftarkan ke semua sel yang dilalui bbox-nya (diperlebar jarak bebas), sehingga kueri cukup
 * memeriksa satu sel. Aturan:
 * - bangunan memblok sepeda (di dalam footprint atau < `clearance` dari dinding) dan kamera;
 * - air memblok sepeda kecuali di atas jalan (jembatan = jalan yang melintasi poligon air);
 * - tile yang belum dimuat = terbuka (spec §5: area tetap dapat dilalui).
 * Murni (tanpa three/DOM); memakai pointInPolygon/distanceToRing dari geo/polygon.js.
 */
import { pointInPolygon, distanceToRing } from '../geo/polygon.js';

export const TILE_COLLIDER = Object.freeze({ cellSize: 25, clearance: 0.6, cameraClearance: 0.8 });

const bboxOf = (pts, pad) => {
  let minX = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
};

/** @param {{cellSize?:number, clearance?:number, cameraClearance?:number}} [opts] */
export function createTileCollider({ cellSize = TILE_COLLIDER.cellSize, clearance = TILE_COLLIDER.clearance,
  cameraClearance = TILE_COLLIDER.cameraClearance } = {}) {
  const cells = new Map();  // "cx,cz" → shape[]
  const tiles = new Map();  // key → {cellKeys:Set<string>, shapes:shape[]}
  const pad = Math.max(clearance, cameraClearance);
  const cellOf = (v) => Math.floor(v / cellSize);
  const keyOf = (cx, cz) => `${cx},${cz}`;

  const insert = (tileRec, shape) => {
    const b = shape.bbox;
    for (let cz = cellOf(b.minZ); cz <= cellOf(b.maxZ); cz += 1) {
      for (let cx = cellOf(b.minX); cx <= cellOf(b.maxX); cx += 1) {
        const k = keyOf(cx, cz);
        let list = cells.get(k);
        if (!list) cells.set(k, (list = []));
        list.push(shape);
        tileRec.cellKeys.add(k);
      }
    }
    tileRec.shapes.push(shape);
  };

  const shapesAt = (x, z) => cells.get(keyOf(cellOf(x), cellOf(z))) ?? [];
  const inBox = (s, x, z) => x >= s.bbox.minX && x <= s.bbox.maxX && z >= s.bbox.minZ && z <= s.bbox.maxZ;

  const nearBuilding = (x, z, gap) => shapesAt(x, z).some((s) => s.kind === 'building' && inBox(s, x, z)
    && (pointInPolygon(x, z, s.ring) || distanceToRing(x, z, s.ring) < gap));
  const inWater = (x, z) => shapesAt(x, z).some((s) => s.kind === 'water' && inBox(s, x, z)
    && pointInPolygon(x, z, s.outer) && !s.holes.some((h) => pointInPolygon(x, z, h)));
  const onRoad = (x, z) => shapesAt(x, z).some((s) => s.kind === 'road' && inBox(s, x, z)
    && distanceToRing(x, z, s.pts, false) <= s.half);

  return {
    /** Daftarkan tile terdekode (decodeTileData); pendaftaran ulang kunci yang sama mengganti. */
    addTile(key, tile) {
      if (tiles.has(key)) this.removeTile(key);
      const rec = { cellKeys: new Set(), shapes: [] };
      for (const b of tile.buildings) insert(rec, { kind: 'building', ring: b.ring, bbox: bboxOf(b.ring, pad) });
      for (const w of tile.water) insert(rec, { kind: 'water', outer: w.outer, holes: w.holes, bbox: bboxOf(w.outer, 0) });
      for (const r of tile.roads) insert(rec, { kind: 'road', pts: r.pts, half: r.width / 2, bbox: bboxOf(r.pts, r.width / 2) });
      tiles.set(key, rec);
    },
    removeTile(key) {
      const rec = tiles.get(key);
      if (!rec) return false;
      const owned = new Set(rec.shapes);
      for (const k of rec.cellKeys) {
        const rest = (cells.get(k) ?? []).filter((s) => !owned.has(s));
        if (rest.length) cells.set(k, rest);
        else cells.delete(k);
      }
      tiles.delete(key);
      return true;
    },
    has: (key) => tiles.has(key),
    get tileCount() { return tiles.size; },
    get cellCount() { return cells.size; },
    isWalkable(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      if (nearBuilding(x, z, clearance)) return false;
      return !inWater(x, z) || onRoad(x, z);
    },
    isCameraClear(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      return !nearBuilding(x, z, cameraClearance);
    },
  };
}
