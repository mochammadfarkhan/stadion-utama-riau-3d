/**
 * Collider distrik UNRI (M2, spec §5.4): air tidak walkable kecuali di atas jalan/trotoar (titian, jalan di atas
 * gorong-gorong), lereng > 35 % tidak walkable (tanggul curam), rintangan lingkaran (PJU, bangku, tong).
 * Chunk ground yang belum dimuat = terbuka (sama dengan TileCollider kota). penetration(x, z) = kedalaman di zona
 * terhalang (createCollider memakainya agar sepeda yang terjebak hanya bisa keluar). Kamera: uji 2D tetap bebas
 * (terrain ditangani CameraRig M1). Koordinat dunia; murni (tanpa three). M3 menambah footprint gedung.
 */
import { distanceToRing, distanceToSegment, pointInPolygon } from '../../geo/polygon.js';

export const UNRI_COLLIDER = Object.freeze({
  cellSize: 25,
  maxGrade: 0.35,
  clearance: 0.4,
  steepPenetration: 0.25,
  circle: Object.freeze({ lamp: 0.2, bench: 0.95, bin: 0.3 }),
});

const bboxOf = (pts, pad) => {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
};

/** Data collider satu chunk dari data ground ter-parse (parseGroundChunk); `keep` menyaring props (region hero). */
export function colliderDataFromGround(data, keep = () => true) {
  const C = UNRI_COLLIDER.circle;
  return {
    water: data.areas.filter((a) => a.kind === 'water').map((a) => ({ rings: a.rings })),
    roads: [...data.roads, ...data.walks].map((r) => ({ pts: r.pts, w: r.w })),
    circles: [
      ...data.props.lamps.filter(keep).map((p) => ({ x: p.x, z: p.z, r: C.lamp })),
      ...data.props.benches.filter(keep).map((p) => ({ x: p.x, z: p.z, r: C.bench })),
      ...data.props.bins.filter(keep).map((p) => ({ x: p.x, z: p.z, r: C.bin })),
    ],
  };
}

/**
 * @param {{terrain?: {normalAt(x:number, z:number, out?:object): {x:number,y:number,z:number}}|null,
 *   cellSize?: number, maxGrade?: number, clearance?: number}} [opts]
 */
export function createUnriCollider({
  terrain = null, cellSize = UNRI_COLLIDER.cellSize, maxGrade = UNRI_COLLIDER.maxGrade, clearance = UNRI_COLLIDER.clearance,
} = {}) {
  const cells = new Map();
  const chunks = new Map();
  const keyOf = (cx, cz) => `${cx},${cz}`;
  const n = { x: 0, y: 1, z: 0 };

  const insert = (rec, shape) => {
    const b = shape.bbox;
    for (let cz = Math.floor(b.minZ / cellSize); cz <= Math.floor(b.maxZ / cellSize); cz += 1) {
      for (let cx = Math.floor(b.minX / cellSize); cx <= Math.floor(b.maxX / cellSize); cx += 1) {
        const k = keyOf(cx, cz);
        let list = cells.get(k);
        if (!list) cells.set(k, (list = []));
        list.push(shape);
        rec.cellKeys.add(k);
      }
    }
    rec.shapes.add(shape);
  };
  const at = (x, z) => cells.get(keyOf(Math.floor(x / cellSize), Math.floor(z / cellSize))) ?? [];
  const inBox = (s, x, z) => x >= s.bbox.minX && x <= s.bbox.maxX && z >= s.bbox.minZ && z <= s.bbox.maxZ;

  const onRoad = (x, z) => at(x, z).some((s) => s.kind === 'road' && inBox(s, x, z)
    && s.pts.some((p, i) => i > 0 && distanceToSegment(x, z, s.pts[i - 1], p) <= s.half));
  const waterDepth = (x, z) => {
    let depth = 0;
    for (const s of at(x, z)) {
      if (s.kind !== 'water' || !inBox(s, x, z) || !pointInPolygon(x, z, s.outer)) continue;
      if (s.holes.some((h) => pointInPolygon(x, z, h))) continue;
      depth = Math.max(depth, Math.min(distanceToRing(x, z, s.outer), ...s.holes.map((h) => distanceToRing(x, z, h))));
    }
    return depth;
  };
  const circleDepth = (x, z) => {
    let d = 0;
    for (const s of at(x, z)) if (s.kind === 'circle') d = Math.max(d, s.r + clearance - Math.hypot(x - s.x, z - s.z));
    return d;
  };
  const gradeAt = (x, z) => {
    if (!terrain?.normalAt) return 0;
    const v = terrain.normalAt(x, z, n);
    return v.y > 0 ? Math.hypot(v.x, v.z) / v.y : Infinity;
  };
  const penetration = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return Infinity;
    const c = circleDepth(x, z);
    if (c > 0) return c;
    const w = waterDepth(x, z);
    if (w > 0 && !onRoad(x, z)) return w;
    return gradeAt(x, z) > maxGrade ? UNRI_COLLIDER.steepPenetration : 0;
  };

  function removeChunk(key) {
    const rec = chunks.get(key);
    if (!rec) return false;
    for (const k of rec.cellKeys) {
      const list = cells.get(k).filter((s) => !rec.shapes.has(s));
      if (list.length) cells.set(k, list);
      else cells.delete(k);
    }
    chunks.delete(key);
    return true;
  }

  function addChunk(key, { water = [], roads = [], circles = [] } = {}) {
    removeChunk(key);
    const rec = { cellKeys: new Set(), shapes: new Set() };
    for (const w of water) {
      const [outer, ...holes] = w.rings;
      insert(rec, { kind: 'water', outer, holes, bbox: bboxOf(outer, 0) });
    }
    for (const r of roads) insert(rec, { kind: 'road', pts: r.pts, half: r.w / 2, bbox: bboxOf(r.pts, r.w / 2) });
    for (const c of circles) {
      insert(rec, { kind: 'circle', x: c.x, z: c.z, r: c.r, bbox: bboxOf([[c.x, c.z]], c.r + clearance) });
    }
    chunks.set(key, rec);
  }

  return Object.freeze({
    addChunk,
    removeChunk,
    isWalkable: (x, z) => penetration(x, z) === 0,
    isCameraClear: (x, z) => Number.isFinite(x) && Number.isFinite(z),
    penetration,
    gradeAt,
    stats: () => ({ chunks: chunks.size, cells: cells.size }),
  });
}
