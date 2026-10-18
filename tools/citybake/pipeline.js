/**
 * Orkestrasi bake: muat sumber → normalisasi → proyeksi → merge → tinggi → mask region → klip distrik → partisi → bake tile
 * → tulis file + manifest + atribusi. Loader dapat diinjeksi (golden test memakai fixture).
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProjection } from '../../src/geo/projection.js';
import { polygonCentroid } from '../../src/geo/polygon.js';
import {
  AREAS, BUDGET, DISTRICTS, ORIGIN, OVERTURE, PATHS, REGION_MASKS, TILE_SIZE, areaFetchBBox, areaRect, areaTiles,
} from './config.js';
import { loadOsm, normalizeOsm } from './fetchOsm.js';
import { loadOverture, normalizeOverture } from './fetchOverture.js';
import { projectFeatures } from './features.js';
import { mergeBuildings } from './merge.js';
import { estimateHeight } from './height.js';
import { createRoadLocator } from './roadLocator.js';
import { applyDistricts, applyMasks } from './mask.js';
import { partitionFeatures } from './partition.js';
import { bakeTile } from './bakeTile.js';
import { writeTileGlb } from './glb.js';
import {
  ATTRIBUTION_FILE, MANIFEST_FILE, assertCompatible, attributionText, createManifest, tileEntry, tileFiles, upsertArea,
} from './manifest.js';
import { summarize } from './report.js';

/**
 * Lengkapi excludeIds tiap distrik: pakai `excludeIds` bila sudah ada; selain itu baca `buildingsFile`
 * ({buildings:[{id:'w123'}]}, keluaran M3). Berkas tidak ada → Set kosong (hanya aturan centroid).
 * @param {Array<{id:string, ring:Array<[number,number]>, excludeIds?:Set<string>, buildingsFile?:string}>} districts
 * @param {(path: string) => Promise<string>} [read]
 */
export async function resolveDistricts(districts, read = (path) => readFile(path, 'utf8')) {
  const out = [];
  for (const d of districts) {
    if (d.excludeIds) {
      out.push(d);
      continue;
    }
    let excludeIds = new Set();
    if (d.buildingsFile) {
      try {
        const json = JSON.parse(await read(d.buildingsFile));
        excludeIds = new Set((json.buildings ?? []).map((b) => b.id));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw new Error(`buildings distrik "${d.id}" rusak (${d.buildingsFile}): ${err.message}`, { cause: err });
        }
      }
    }
    out.push({ ...d, excludeIds });
  }
  return out;
}

/**
 * Fitur dunia siap partisi untuk satu area.
 * @returns {{features: object[], osmTimestamp: string|null, mergeStats: object}}
 */
export function prepareFeatures({ rawOsm, overtureFc, projection, masks, districts = [] }) {
  const osm = normalizeOsm(rawOsm);
  const osmWorld = projectFeatures(osm.features, projection);
  const ovWorld = overtureFc ? projectFeatures(normalizeOverture(overtureFc), projection) : [];
  const { buildings, stats } = mergeBuildings(osmWorld.filter((f) => f.kind === 'building'), ovWorld);
  const others = osmWorld.filter((f) => f.kind !== 'building');
  const locate = createRoadLocator(others.filter((f) => f.kind === 'road'));
  const withHeight = buildings.map((b) => {
    const c = polygonCentroid(b.rings[0]);
    return { ...b, height: estimateHeight(b, { nearestRoadClass: locate(c.x, c.z) }) };
  });
  const masked = applyMasks([...withHeight, ...others], masks.map((m) => m.ring));
  const features = applyDistricts(masked, districts);
  return { features, osmTimestamp: osm.timestamp, mergeStats: stats };
}

/** Bake semua tile area → buffer siap tulis (tile kosong dilewati). */
export async function bakeAreaTiles(features, tiles, size) {
  const buckets = partitionFeatures(features, tiles, size);
  const out = [];
  for (const bucket of buckets.values()) {
    const baked = bakeTile(bucket, size);
    if (baked.empty) continue;
    out.push({
      key: baked.key,
      ix: baked.ix,
      iz: baked.iz,
      lod0: await writeTileGlb(baked.lods[0].meshes, `tile_${baked.key}_lod0`),
      lod1: await writeTileGlb(baked.lods[1].meshes, `tile_${baked.key}_lod1`),
      data: Buffer.from(JSON.stringify(baked.data)),
      triangles: [baked.lods[0].triangles, baked.lods[1].triangles],
    });
  }
  return out;
}

async function readManifest(outDir) {
  try {
    return JSON.parse(await readFile(join(outDir, MANIFEST_FILE), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`manifest.json rusak: ${err.message}`, { cause: err });
  }
}

/** Tulis file tile area & hapus file tile lama area itu yang kini kosong. Mengembalikan entri manifest. */
async function writeAreaFiles(outDir, previous, areaId, baked) {
  const entries = [];
  for (const t of baked) {
    const f = tileFiles(t.key);
    await writeFile(join(outDir, f.lod0), t.lod0);
    await writeFile(join(outDir, f.lod1), t.lod1);
    await writeFile(join(outDir, f.data), t.data);
    const bytes = { lod0: t.lod0.byteLength, lod1: t.lod1.byteLength, data: t.data.byteLength };
    entries.push(tileEntry({ key: t.key, ix: t.ix, iz: t.iz, area: areaId, bytes, triangles: t.triangles }));
  }
  const fresh = new Set(entries.map((e) => e.key));
  for (const old of previous.tiles.filter((t) => t.area === areaId && !fresh.has(t.key))) {
    for (const file of Object.values(tileFiles(old.key))) await rm(join(outDir, file), { force: true });
  }
  return entries;
}

/**
 * Jalankan bake untuk daftar area.
 * @param {{areaIds: string[], outDir?: string, cacheDir?: string, offline?: boolean, useOverture?: boolean,
 *   release?: string, areas?: object, masks?: Array<{id: string, ring: Array<[number, number]>}>,
 *   districts?: Array<{id: string, ring: Array<[number, number]>, excludeIds?: Set<string>, buildingsFile?: string}>,
 *   origin?: {lat: number, lon: number}, size?: number, log?: Console, loaders?: {osm: Function, overture: Function}}} opts
 * @returns {Promise<{manifest: object, report: {lines: string[], warnings: string[]}, stats: object}>}
 */
export async function runBake({
  areaIds, outDir = PATHS.outDir, cacheDir = PATHS.cacheDir, offline = false, useOverture = true,
  release = OVERTURE.release, areas = AREAS, masks = REGION_MASKS, districts = DISTRICTS, origin = ORIGIN,
  size = TILE_SIZE, log = console, loaders = { osm: loadOsm, overture: loadOverture },
}) {
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  await mkdir(outDir, { recursive: true });
  const fresh = createManifest({ origin, tileSize: size });
  const existing = await readManifest(outDir);
  if (existing) assertCompatible(existing, fresh);
  let manifest = existing ?? fresh;
  const resolved = await resolveDistricts(districts);
  const stats = {};
  for (const id of areaIds) {
    const area = areas[id];
    if (!area) throw new Error(`area tidak dikenal: "${id}" (pilihan: ${Object.keys(areas).join(', ')})`);
    const bbox = areaFetchBBox(area, projection, 60, size, areas);
    const rawOsm = await loaders.osm(id, bbox, { cacheDir, offline, log });
    const overtureFc = useOverture ? await loaders.overture(id, bbox, { cacheDir, offline, release, log }) : null;
    const prepared = prepareFeatures({ rawOsm, overtureFc, projection, masks, districts: resolved });
    const baked = await bakeAreaTiles(prepared.features, areaTiles(area, projection, size, areas), size);
    const entries = await writeAreaFiles(outDir, manifest, id, baked);
    manifest = upsertArea(manifest, {
      id, name: area.name, bounds: areaRect(area, projection), osmTimestamp: prepared.osmTimestamp,
      overtureRelease: overtureFc ? release : null, tiles: entries,
    });
    stats[id] = { ...prepared.mergeStats, tiles: entries.length };
  }
  await writeFile(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outDir, ATTRIBUTION_FILE), attributionText(manifest));
  return { manifest, report: summarize(manifest, areaIds, BUDGET), stats };
}
