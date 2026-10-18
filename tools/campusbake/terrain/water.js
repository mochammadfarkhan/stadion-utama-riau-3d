/**
 * Danau/waduk (spec §5.2 langkah 8): muka air = tanah terendah di tepi − shoreDrop; dasar = muka air −
 * depth; tanggul lereng 1 : bankRun dari titik tepi terendah ke bawah. Terrain hanya digali (tidak
 * ditimbun). Muka air dilaporkan ke manifest untuk mesh air M2. Murni.
 */
import { distanceToRing, pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';
import { densifyRing, nodeRange, sampleGrid } from './grid.js';

/** Profil dasar di jarak d (m) ke dalam dari tepi. */
export function lakeFloor(d, shore, { shoreDrop, depth, bankRun }) {
  const bed = shore - shoreDrop - depth;
  return Math.max(bed, shore - d / bankRun);
}

/**
 * @param {Array<{id:string, name?:string, ring:Array<[number,number]>}>} lakes
 * @returns {{data: Float64Array, levels: Array<{id:string, name:string|null, level:number, bed:number}>}}
 */
export function applyWater(grid, data, w, lakes, opts) {
  const out = Float64Array.from(data);
  const levels = [];
  for (const lake of lakes) {
    const shore = Math.min(...densifyRing(lake.ring, grid.step / 2).map(([x, z]) => sampleGrid(grid, out, x, z)));
    const level = shore - opts.shoreDrop;
    const bed = level - opts.depth;
    const range = nodeRange(grid, ringBounds(lake.ring));
    for (let r = range.r0; r <= range.r1; r += 1) {
      const z = grid.minZ + r * grid.step;
      for (let c = range.c0; c <= range.c1; c += 1) {
        const i = r * grid.cols + c;
        const x = grid.minX + c * grid.step;
        if (!(w[i] > 0) || !pointInPolygon(x, z, lake.ring)) continue;
        out[i] = Math.min(out[i], lakeFloor(distanceToRing(x, z, lake.ring), shore, opts));
      }
    }
    levels.push({ id: lake.id, name: lake.name ?? null, level: Math.round(level * 100) / 100, bed: Math.round(bed * 100) / 100 });
  }
  return { data: out, levels };
}
