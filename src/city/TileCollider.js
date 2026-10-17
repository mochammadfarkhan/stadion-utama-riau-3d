/**
 * TileCollider: collider kota dari data tile (koordinat DUNIA). Spatial hash sel 25 m; tiap bentuk
 * didaftarkan ke semua sel yang dilalui bbox-nya (diperlebar jarak bebas), sehingga kueri cukup
 * memeriksa satu sel. Aturan:
 * - bangunan memblok sepeda (di dalam footprint atau < `clearance` dari dinding) dan kamera;
 * - air memblok sepeda kecuali di atas jalan (jembatan = jalan yang melintasi poligon air);
 * - tile yang belum dimuat = terbuka (spec §5: area tetap dapat dilalui);
 * - rintangan lingkaran (`addObstacles`, mis. kendaraan mangkal) memblok seperti bangunan, terpisah dari tile.
 * `penetration(x, z)` = kedalaman titik di zona terhalang (0 bila walkable), dipakai `createCollider`
 * agar sepeda yang terjebak (tile dimuat di bawahnya) hanya boleh bergerak keluar, tidak menembus.
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
  const obstacles = new Map(); // key → {cellKeys, shapes} (lingkaran; bukan tile)
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

  const nearBuilding = (x, z, gap) => shapesAt(x, z).some((s) => inBox(s, x, z) && (s.kind === 'building'
    ? pointInPolygon(x, z, s.ring) || distanceToRing(x, z, s.ring) < gap
    : s.kind === 'circle' && Math.hypot(x - s.x, z - s.z) < s.r + gap));
  const inWater = (x, z) => shapesAt(x, z).some((s) => s.kind === 'water' && inBox(s, x, z)
    && pointInPolygon(x, z, s.outer) && !s.holes.some((h) => pointInPolygon(x, z, h)));
  const onRoad = (x, z) => shapesAt(x, z).some((s) => s.kind === 'road' && inBox(s, x, z)
    && distanceToRing(x, z, s.pts, false) <= s.half);

  /** Kedalaman di zona terlarang bangunan (footprint + jarak bebas): naik terus ke arah dalam. */
  const buildingDepth = (s, x, z) => {
    const d = distanceToRing(x, z, s.ring);
    return pointInPolygon(x, z, s.ring) ? d + clearance : Math.max(0, clearance - d);
  };
  const waterDepth = (s, x, z) => {
    if (!pointInPolygon(x, z, s.outer) || s.holes.some((h) => pointInPolygon(x, z, h))) return 0;
    return s.holes.reduce((m, h) => Math.min(m, distanceToRing(x, z, h)), distanceToRing(x, z, s.outer));
  };
  const penetration = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return Infinity;
    const bridge = onRoad(x, z);
    let depth = 0;
    for (const s of shapesAt(x, z)) {
      if (!inBox(s, x, z)) continue;
      if (s.kind === 'building') depth = Math.max(depth, buildingDepth(s, x, z));
      else if (s.kind === 'circle') depth = Math.max(depth, s.r + clearance - Math.hypot(x - s.x, z - s.z));
      else if (s.kind === 'water' && !bridge) depth = Math.max(depth, waterDepth(s, x, z));
    }
    return depth;
  };

  const removeFrom = (map, key) => {
    const rec = map.get(key);
    if (!rec) return false;
    const owned = new Set(rec.shapes);
    for (const k of rec.cellKeys) {
      const rest = (cells.get(k) ?? []).filter((s) => !owned.has(s));
      if (rest.length) cells.set(k, rest);
      else cells.delete(k);
    }
    map.delete(key);
    return true;
  };
  const removeTile = (key) => removeFrom(tiles, key);
  const removeObstacles = (key) => removeFrom(obstacles, key);

  /** Rintangan lingkaran {x, z, r} (dunia) di bawah satu kunci; pendaftaran ulang kunci yang sama mengganti. */
  const addObstacles = (key, circles) => {
    if (obstacles.has(key)) removeObstacles(key);
    const rec = { cellKeys: new Set(), shapes: [] };
    for (const { x, z, r } of circles) {
      if (![x, z, r].every(Number.isFinite) || r <= 0) continue;
      insert(rec, { kind: 'circle', x, z, r, bbox: { minX: x - r - pad, minZ: z - r - pad, maxX: x + r + pad, maxZ: z + r + pad } });
    }
    obstacles.set(key, rec);
  };

  /** Daftarkan tile terdekode (decodeTileData); pendaftaran ulang kunci yang sama mengganti. */
  const addTile = (key, tile) => {
    if (tiles.has(key)) removeTile(key);
    const rec = { cellKeys: new Set(), shapes: [] };
    for (const b of tile.buildings) insert(rec, { kind: 'building', ring: b.ring, bbox: bboxOf(b.ring, pad) });
    for (const w of tile.water) insert(rec, { kind: 'water', outer: w.outer, holes: w.holes, bbox: bboxOf(w.outer, 0) });
    for (const r of tile.roads) insert(rec, { kind: 'road', pts: r.pts, half: r.width / 2, bbox: bboxOf(r.pts, r.width / 2) });
    tiles.set(key, rec);
  };

  return {
    addTile,
    removeTile,
    addObstacles,
    removeObstacles,
    penetration,
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
