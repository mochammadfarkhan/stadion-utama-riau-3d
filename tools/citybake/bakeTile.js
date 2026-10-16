/**
 * Satu tile (fitur dunia hasil partitionFeatures) → mesh LOD0 & LOD1 per material + data.json.
 * Semua koordinat di-re-center ke pusat tile (tile-lokal). Murni; penulisan GLB di glb.js.
 */
import { cleanRing, polygonArea, signedArea } from '../../src/geo/polygon.js';
import { tileCenter, TILE_SIZE } from '../../src/geo/tiles.js';
import { createMeshBuilder } from './geometry/meshBuilder.js';
import { addBuilding } from './geometry/buildings.js';
import { addRibbon } from './geometry/roads.js';
import { addFlatPolygon } from './geometry/areas.js';
import { hexToLinear } from './geometry/colors.js';
import { pickBySeed } from './random.js';
import {
  BUILDING_COLORS, FORMAT_VERSION, GABLE_MAX_AREA, LANDUSE_COLORS, LANDUSE_ORDER, LAYER_Y, LOD1_MIN_BUILDING_AREA,
  ROAD_CLASSES, WATER_COLOR, WATERWAY_WIDTHS,
} from './config.js';

const dm = (v) => Math.round(v * 10);
const PALETTE = {
  walls: BUILDING_COLORS.walls.map(hexToLinear),
  roofFlat: BUILDING_COLORS.roofFlat.map(hexToLinear),
  roofGable: BUILDING_COLORS.roofGable.map(hexToLinear),
};
const WATER_RGB = hexToLinear(WATER_COLOR);
const LANDUSE_RGB = Object.fromEntries(Object.entries(LANDUSE_COLORS).map(([k, v]) => [k, hexToLinear(v)]));
const ROAD_RGB = Object.fromEntries(Object.entries(ROAD_CLASSES).map(([k, v]) => [k, hexToLinear(v.color)]));

/** Geser fitur ke koordinat tile-lokal (objek baru). */
function toLocal(f, cx, cz) {
  const mv = (pts) => pts.map(([x, z]) => [x - cx, z - cz]);
  return { ...f, ...(f.rings ? { rings: f.rings.map(mv) } : {}), ...(f.line ? { line: mv(f.line) } : {}) };
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Landuse menurut prioritas kelas (LANDUSE_ORDER), lalu id. */
const landuseOrder = (a, b) => LANDUSE_ORDER.indexOf(a.cls) - LANDUSE_ORDER.indexOf(b.cls) || byId(a, b);
const landuseY = (cls) => LAYER_Y.landuse + LANDUSE_ORDER.indexOf(cls) * LAYER_Y.landuseStep;

/** Jalan kecil dulu (y lebih rendah), lalu besar, agar urutan stabil. */
const roadOrder = (a, b) => Number(ROAD_CLASSES[a.cls].minor === false) - Number(ROAD_CLASSES[b.cls].minor === false) || byId(a, b);

function addBuildings(builders, buildings, lod) {
  for (const b of buildings) {
    const area = polygonArea(b.rings[0]);
    if (lod === 1 && area < LOD1_MIN_BUILDING_AREA) continue;
    addBuilding(builders, {
      rings: lod === 1 ? [b.rings[0]] : b.rings,
      height: b.height,
      gable: lod === 0 && area < GABLE_MAX_AREA,
      wallRgb: pickBySeed(PALETTE.walls, b.id, 'wall'),
      roofRgb: pickBySeed(PALETTE.roofFlat, b.id, 'roof'),
      gableRoofRgb: pickBySeed(PALETTE.roofGable, b.id, 'roof'),
    });
  }
}

function addRoads(builder, roads, lod) {
  for (const r of [...roads].sort(roadOrder)) {
    const cls = ROAD_CLASSES[r.cls];
    if (lod === 1 && cls.minor) continue;
    addRibbon(builder, r.line, cls.width, cls.minor ? LAYER_Y.roadMinor : LAYER_Y.roadMajor, ROAD_RGB[r.cls]);
  }
}

/** Bangun lima mesh untuk satu LOD. */
function buildLod(local, lod) {
  const b = Object.fromEntries(['landuse', 'water', 'roads', 'walls', 'roofs'].map((k) => [k, createMeshBuilder()]));
  for (const f of [...local.landuse].sort(landuseOrder)) addFlatPolygon(b.landuse, f.rings, landuseY(f.cls), LANDUSE_RGB[f.cls]);
  for (const f of local.water) addFlatPolygon(b.water, f.rings, LAYER_Y.water, WATER_RGB);
  for (const f of local.waterways) addRibbon(b.water, f.line, WATERWAY_WIDTHS[f.cls], LAYER_Y.water, WATER_RGB);
  addRoads(b.roads, local.roads, lod);
  addBuildings({ walls: b.walls, roofs: b.roofs }, local.buildings, lod);
  const meshes = {
    landuse: b.landuse.toArrays(), water: b.water.toArrays(), roads: b.roads.toArrays(),
    buildings_walls: b.walls.toArrays(), buildings_roofs: b.roofs.toArrays(),
  };
  const triangles = Object.values(b).reduce((s, v) => s + v.triangleCount, 0);
  return { meshes, triangles };
}

const roundPts = (pts) => pts.map(([x, z]) => [dm(x), dm(z)]);
const flat = (pts) => pts.flat();

/**
 * Ring → array datar 0,1 m: dibulatkan DULU, lalu dibersihkan (duplikat berurutan & penutup) dan
 * diorientasikan positif. null bila runtuh (< 3 titik atau luas 0) setelah pembulatan.
 */
function dataRing(ring) {
  const r = cleanRing(roundPts(ring), 0);
  if (r.length < 3) return null;
  const area = signedArea(r);
  if (area === 0) return null;
  return flat(area > 0 ? r : r.reverse());
}

/** Polyline → array datar 0,1 m tanpa titik berurutan kembar; null bila < 2 titik. */
function dataLine(line) {
  const pts = roundPts(line).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  return pts.length >= 2 ? flat(pts) : null;
}

/** Map lalu buang hasil null. */
const mapDefined = (list, fn) => list.map(fn).filter((v) => v !== null);

function dataWater(w) {
  const [outer, ...holes] = w.rings.map(dataRing);
  return outer ? { rings: [outer, ...holes.filter((h) => h !== null)] } : null;
}

function dataRoad(r) {
  const pts = dataLine(r.line);
  if (!pts) return null;
  const cls = ROAD_CLASSES[r.cls];
  const entry = { cls: r.cls, w: dm(cls.width), pts };
  return cls.label && r.tags?.name ? { ...entry, name: r.tags.name } : entry;
}

/** data.json v1 (lihat "Format tile v1"). */
function buildData(tile, local, center) {
  return {
    v: FORMAT_VERSION,
    key: tile.key,
    ix: tile.ix,
    iz: tile.iz,
    center: [center.x, center.z],
    unit: 0.1,
    buildings: mapDefined(local.buildings, (b) => {
      const ring = dataRing(b.rings[0]);
      return ring ? { h: dm(b.height), ring } : null;
    }),
    water: mapDefined(local.water, dataWater),
    waterways: mapDefined(local.waterways, (w) => {
      const pts = dataLine(w.line);
      return pts ? { cls: w.cls, w: dm(WATERWAY_WIDTHS[w.cls]), pts } : null;
    }),
    roads: mapDefined(local.roads, dataRoad),
  };
}

/**
 * @param {import('./partition.js').TileBucket} tile bangunan sudah memiliki `height` (m)
 * @returns {{key: string, ix: number, iz: number, empty: boolean,
 *   lods: Array<{meshes: object, triangles: number}>, data: object}}
 */
export function bakeTile(tile, size = TILE_SIZE) {
  const center = tileCenter(tile.ix, tile.iz, size);
  const sorted = (list) => [...list].sort(byId).map((f) => toLocal(f, center.x, center.z));
  const local = {
    buildings: sorted(tile.buildings), roads: sorted(tile.roads), water: sorted(tile.water),
    waterways: sorted(tile.waterways), landuse: sorted(tile.landuse),
  };
  const lods = [buildLod(local, 0), buildLod(local, 1)];
  return { key: tile.key, ix: tile.ix, iz: tile.iz, empty: lods[0].triangles === 0, lods, data: buildData(tile, local, center) };
}
