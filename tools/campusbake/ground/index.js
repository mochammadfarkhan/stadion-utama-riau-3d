/**
 * campusbake ground (M2): OSM kampus + heightfield M1 → public/districts/unri/ground/<key>.json.
 * bakeGroundChunks murni (golden test); bakeGround = I/O + laporan.
 */
import { join } from 'node:path';
import { createProjection } from '../../../src/geo/projection.js';
import { polylineLength } from '../../../src/geo/lineClip.js';
import { WORLD_ORIGIN } from '../../../src/config/constants.js';
import { UNRI_BOUNDARY } from '../../../src/districts/unri/boundary.js';
import { extractGround } from './extract.js';
import { applyWaterLevels } from './waterLevel.js';
import { createGroundContext } from './context.js';
import { inferredDitches } from './ditches.js';
import { createLineIndex } from './spatial.js';
import { placeVegetation } from './vegetation.js';
import { placeProps } from './props.js';
import { encodeWeights, surfaceWeights } from './surfaces.js';
import { assembleChunk, writeGround } from './writeGround.js';
import { loadOsmSource, loadTerrainField, projectOsm } from './sources.js';
import { GROUND_BUDGET_BYTES, GROUND_PATHS } from './constants.js';

const km = (list) => Math.round(list.reduce((s, r) => s + polylineLength(r.line), 0)) / 1000;
const countBy = (list, key) => {
  const out = {};
  for (const v of list) out[v[key]] = (out[v[key]] ?? 0) + 1;
  return out;
};

/**
 * @param {{features: object[], plazas?: object[], boundary: Array<[number,number]>,
 *   field: {heightAt: Function, normalAt: Function}, keys: string[]}} input
 * @returns {{chunks: Array<{key: string, json: string}>, stats: object}}
 */
export function bakeGroundChunks({ features, plazas = [], boundary, field, keys }) {
  const { E, water } = applyWaterLevels(extractGround({ features, plazas }, boundary), field);
  const ctx = createGroundContext(E, { boundary, field });
  const ditches = [...inferredDitches(E.roads, ctx), ...E.waterLines];
  const ditchIndex = createLineIndex(ditches, { reach: 3 });
  const veg = placeVegetation(E, ctx);
  const props = placeProps(E, ctx);
  const chunks = keys.map((key) => {
    const weights = encodeWeights(surfaceWeights(key, ctx, ditchIndex));
    const obj = assembleChunk(key, { roads: E.roads, walks: E.walks, areas: E.areas, ditches, veg, props, weights });
    return { key, json: JSON.stringify(obj) };
  });
  const stats = {
    roadsKm: km(E.roads), walksKm: km(E.walks), soilPathsKm: km(E.soilPaths), ditchesKm: km(ditches),
    areas: countBy(E.areas, 'kind'), water, veg: countBy(veg, 'sp'),
    props: { lamps: props.lamps.length, benches: props.benches.length, bins: props.bins.length },
  };
  return { chunks, stats };
}

/** Baris laporan bake ground (+ PERINGATAN bila melewati budget). */
export function groundReport({ stats, bytes, files, timestamp, ms }) {
  const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
  const list = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  const lines = [
    `[campusbake ground] OSM ${timestamp ?? '?'} · ${files} chunk · ${kb(bytes)} · ${ms} ms`,
    `  jalan ${stats.roadsKm} km · trotoar ${stats.walksKm} km · jalan tanah ${stats.soilPathsKm} km · parit ${stats.ditchesKm} km`,
    `  area: ${list(stats.areas)}`,
    ...stats.water.map((w) => `  air ${w.id}: muka ${w.level.toFixed(2)} m ${w.carved ? 'dipahat' : 'TIDAK dipahat → dilewati'}`),
    `  vegetasi: ${list(stats.veg)}`,
    `  props: PJU ${stats.props.lamps}, bangku ${stats.props.benches}, tong ${stats.props.bins}`,
  ];
  if (bytes > GROUND_BUDGET_BYTES) lines.push(`PERINGATAN: ground ${kb(bytes)} > ${kb(GROUND_BUDGET_BYTES)}`);
  return lines;
}

/** Bake ground dari cache (selalu offline: hanya membaca data-src & hasil bake terrain). */
export async function bakeGround({ log = console, paths = GROUND_PATHS, boundary = UNRI_BOUNDARY } = {}) {
  const t0 = Date.now();
  const raw = await loadOsmSource(paths.osmCache);
  const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
  const { features, plazas, timestamp } = projectOsm(raw, projection);
  const { keys, field } = await loadTerrainField(paths.districtDir);
  const { chunks, stats } = bakeGroundChunks({ features, plazas, boundary, field, keys });
  const { bytes, files } = await writeGround({ dir: paths.groundDir, manifestPath: join(paths.districtDir, 'manifest.json'), chunks });
  for (const line of groundReport({ stats, bytes, files, timestamp, ms: Date.now() - t0 })) log.info(line);
  return { stats, bytes, files };
}
