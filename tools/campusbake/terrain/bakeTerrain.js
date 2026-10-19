/**
 * Pipeline terrain (spec §5.2): DEM → grid 4 m (bikubik) → median 5×5 → Gaussian σ 20 m → datum →
 * blend ke nol → jalan → pad → air → kuantisasi chunk. Murni: DEM, fitur, batas, mask masuk sebagai data.
 */
import { createProjection } from '../../../src/geo/projection.js';
import { TERRAIN_HEADER } from '../../../src/geo/terrain/format.js';
import { resampleToGrid } from '../dem/resample.js';
import { gaussian2d, median2d } from '../dem/filters.js';
import { applyDatum, boundaryReference } from './datum.js';
import { applyBlend, blendWeights } from './blend.js';
import { conditionRoads } from './roads.js';
import { applyPads } from './pads.js';
import { applyWater } from './water.js';
import { encodeChunks } from './writeChunks.js';
import { gridForRing } from './grid.js';

/**
 * @param {{dem:{lat0:number,lon0:number,size:number,data:Int16Array}, origin:{lat:number,lon:number},
 *   boundary:Array<[number,number]>, mask:Array<[number,number]>|null, roads:object[], pads:object[],
 *   lakes:object[], terrain:object, now?:() => number}} input
 * @returns {{grid:object, data:Float64Array, weights:Float32Array, chunks:Array<{key:string,ix:number,iz:number,buffer:Buffer}>,
 *   header:object, stats:object}}
 */
export function bakeTerrain({ dem, origin, boundary, mask, roads, pads, lakes, terrain, now = () => Date.now() }) {
  const t0 = now();
  const projection = createProjection({ lat0: origin.lat, lon0: origin.lon });
  const grid = gridForRing(boundary, terrain.margin);
  const raw = resampleToGrid(dem, grid, projection);
  const smooth = gaussian2d(median2d(raw, grid.cols, grid.rows, terrain.median), grid.cols, grid.rows, terrain.gaussSigma);
  const hRef = boundaryReference(grid, smooth, boundary, terrain.datumSpacing);
  const weights = blendWeights(grid, { boundary, mask, distance: terrain.blendDistance, maskMargin: terrain.maskBlendMargin });
  const blended = applyBlend(applyDatum(smooth, hRef), weights);
  const road = conditionRoads(grid, blended, weights, roads, {
    ...terrain.road, ditch: { ...terrain.ditch, classes: terrain.ditch.classes },
  });
  const padded = applyPads(grid, road.data, weights, pads, terrain.pad, road.core);
  const water = applyWater(grid, padded.data, weights, lakes, terrain.water);
  const data = water.data;
  for (let i = 0; i < data.length; i += 1) if (!(weights[i] > 0)) data[i] = 0; // di luar distrik: 0 tepat
  const chunks = encodeChunks(grid, data);
  return {
    grid, data, weights, chunks,
    header: { ...TERRAIN_HEADER, chunks: chunks.map((c) => c.key), hRef: Math.round(hRef * 100) / 100, water: water.levels },
    stats: { hRef, roads: road.stats, pads: padded.stats, water: water.levels, ms: now() - t0 },
  };
}
