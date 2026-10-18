/**
 * CLI campusbake:
 *   npm run bake:campus -- boundary [--offline]          → tulis src/districts/unri/boundary.js
 *   npm run bake:campus -- terrain|all [--offline]        → public/districts/unri/{manifest.json, terrain/*.bin, ATTRIBUTION.txt}
 *   npm run bake:campus -- ground|buildings              → dibuat di M2/M3 (sekarang: galat jelas, exit 2)
 * Opsi: --out <dir> (default public/districts/unri), --cache <dir> (default data-src).
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  BOUNDARY, BUDGET, CAMPUS_OSM, ORIGIN, PATHS, REGION_PADS, ROAD_WIDTHS, SRTM, STADION_MASK_WORLD, TERRAIN,
} from './config.js';
import { loadSrtm } from './dem/fetchSrtm.js';
import { readHgt } from './dem/readHgt.js';
import {
  campusBuildingPads, campusFeatures, campusLakes, campusRing, campusRoads, loadCampusOsm,
} from './osm.js';
import { boundaryModuleSource, computeBoundary } from './boundary.js';
import { bakeTerrain } from './terrain/bakeTerrain.js';
import { terrainReport } from './report.js';
import { ATTRIBUTION_FILE, MANIFEST_FILE, attributionText, withTerrain } from './manifest.js';

export const COMMANDS = Object.freeze(['boundary', 'terrain', 'ground', 'buildings', 'all']);
export const USAGE = `Pakai: npm run bake:campus -- <${COMMANDS.join('|')}> [--offline] [--out <dir>] [--cache <dir>]`;

/** @returns {{command:string, offline:boolean, outDir:string, cacheDir:string}} */
export function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      offline: { type: 'boolean', default: false },
      out: { type: 'string', default: PATHS.outDir },
      cache: { type: 'string', default: PATHS.cacheDir },
    },
    strict: true,
  });
  const [command] = positionals;
  if (!command || positionals.length !== 1 || !COMMANDS.includes(command)) {
    throw new Error(`perintah tidak dikenal: ${JSON.stringify(positionals.join(' '))}. ${USAGE}`);
  }
  return { command, offline: values.offline, outDir: values.out, cacheDir: values.cache };
}

const defaultLoaders = {
  dem: (opts) => loadSrtm(SRTM, opts),
  osm: (opts) => loadCampusOsm(CAMPUS_OSM, opts),
};

/** Batas distrik dari OSM (perintah `boundary`). @returns {Promise<{source:string, result:object}>} */
export async function runBoundary({ cacheDir, offline, log = console, loaders = defaultLoaders, mask = STADION_MASK_WORLD }) {
  const { timestamp, features } = campusFeatures(await loaders.osm({ cacheDir, offline, log }), ORIGIN);
  const result = computeBoundary({
    campusRing: campusRing(features, CAMPUS_OSM.wayId), maskRing: mask,
    maskMargin: BOUNDARY.maskMargin, tolerance: BOUNDARY.simplify, segments: BOUNDARY.circleSegments,
  });
  const source = boundaryModuleSource(result, {
    osmTimestamp: timestamp, wayId: CAMPUS_OSM.wayId, maskMargin: BOUNDARY.maskMargin, tolerance: BOUNDARY.simplify,
  });
  return { source, result };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`${path} rusak: ${err.message}`, { cause: err });
  }
}

/** Batas distrik default: modul hasil `boundary` (impor dinamis agar `boundary` tetap jalan sebelum file ada). */
async function defaultBoundary() {
  const url = pathToFileURL(resolve(PATHS.boundaryModule)).href;
  try {
    return (await import(url)).UNRI_BOUNDARY;
  } catch (err) {
    throw new Error(`${PATHS.boundaryModule} belum ada — jalankan dulu: npm run bake:campus -- boundary`, { cause: err });
  }
}

/**
 * Bake terrain → tulis chunk, manifest (bagian terrain), atribusi. Chunk lama yang tidak lagi dibuat dihapus.
 * @returns {Promise<{manifest:object, report:{lines:string[], warnings:string[], summary:object}}>}
 */
export async function runTerrain({
  outDir, cacheDir, offline, log = console, loaders = defaultLoaders, boundary = null, mask = STADION_MASK_WORLD,
  terrain = TERRAIN, regionPads = REGION_PADS, srtm = SRTM, now = () => Date.now(),
}) {
  const ring = boundary ?? await defaultBoundary();
  const dem = readHgt(await loaders.dem({ cacheDir, offline, log }), srtm.tile);
  const { timestamp, features } = campusFeatures(await loaders.osm({ cacheDir, offline, log }), ORIGIN);
  const roads = campusRoads(features, ring, ROAD_WIDTHS, terrain.road.skip);
  const pads = [...campusBuildingPads(features, ring), ...regionPads];
  const { lakes, missing } = campusLakes(features, terrain.water.lakes);
  const baked = bakeTerrain({ dem, origin: ORIGIN, boundary: ring, mask, roads, pads, lakes, terrain, now });
  const dir = join(outDir, 'terrain');
  await mkdir(dir, { recursive: true });
  const fresh = new Set(baked.chunks.map((c) => `${c.key}.bin`));
  for (const old of await readdir(dir)) if (old.endsWith('.bin') && !fresh.has(old)) await rm(join(dir, old));
  for (const c of baked.chunks) await writeFile(join(dir, `${c.key}.bin`), c.buffer);
  const manifest = withTerrain(await readJson(join(outDir, MANIFEST_FILE)), baked.header);
  await writeFile(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outDir, ATTRIBUTION_FILE), attributionText({ srtm, osmTimestamp: timestamp }));
  const report = terrainReport(baked, roads, { maxGrade: terrain.road.maxGrade, budgetBytes: BUDGET.terrainBytes });
  for (const id of missing) report.warnings.push(`danau ${id} tidak ada di cache OSM (dilewati)`);
  return { manifest, report };
}

/** Titik masuk CLI; mengembalikan exit code. */
export async function main(argv, log = console) {
  let opts;
  try {
    opts = parseCli(argv);
  } catch (err) {
    log.error(err.message);
    return 2;
  }
  if (opts.command === 'ground' || opts.command === 'buildings') {
    log.error(`perintah "${opts.command}" belum tersedia (dibuat di M2/M3). ${USAGE}`);
    return 2;
  }
  try {
    if (opts.command === 'boundary') {
      const { source, result } = await runBoundary({ ...opts, log });
      await mkdir(dirname(PATHS.boundaryModule), { recursive: true });
      await writeFile(PATHS.boundaryModule, source);
      log.info(`Batas distrik: ${result.ring.length} titik, ${Math.round(result.area)} m² (kampus ${Math.round(result.campusArea)} m², `
        + `${result.pieces} potongan, dibuang ${Math.round(result.droppedArea)} m²) → ${PATHS.boundaryModule}`);
      return 0;
    }
    const { report } = await runTerrain({ ...opts, log });
    for (const line of report.lines) log.info(line);
    for (const w of report.warnings) log.warn(`PERINGATAN: ${w}`);
    if (opts.command === 'all') log.info('Catatan: ground (M2) dan buildings (M3) belum tersedia; hanya terrain yang di-bake.');
    return 0;
  } catch (err) {
    log.error(`[campusbake] gagal: ${err.message}`);
    return 1;
  }
}
