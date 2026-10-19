/**
 * Pad gedung & region hero (spec §5.2 langkah 7): footprint diratakan ke median tanah di dalamnya
 * (atau angka tetap `y`), blend linier `blend` m di luar footprint. Pad diproses urut id (yang belakangan
 * menimpa). Hanya simpul dengan w > 0 yang diubah; simpul `locked` (inti jalan) tidak diubah agar tanjakan
 * jalan tetap ≤ batas. Murni.
 */
import { distanceToRing, pointInPolygon, polygonCentroid, ringBounds } from '../../../src/geo/polygon.js';
import { median, nodeRange, sampleGrid } from './grid.js';

/**
 * @param {Array<{id:string, ring:Array<[number,number]>, y?:'median'|number}>} pads
 * @returns {{data: Float64Array, stats: Array<{id:string, target:number, nodes:number}>}}
 */
export function applyPads(grid, data, w, pads, { blend }, locked = null) {
  const out = Float64Array.from(data);
  const stats = [];
  for (const pad of [...pads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const b = ringBounds(pad.ring);
    const range = nodeRange(grid, { minX: b.minX - blend, maxX: b.maxX + blend, minZ: b.minZ - blend, maxZ: b.maxZ + blend });
    const insideVals = [];
    const touched = [];
    for (let r = range.r0; r <= range.r1; r += 1) {
      const z = grid.minZ + r * grid.step;
      for (let c = range.c0; c <= range.c1; c += 1) {
        const i = r * grid.cols + c;
        if (!(w[i] > 0)) continue;
        const x = grid.minX + c * grid.step;
        const inside = pointInPolygon(x, z, pad.ring);
        const d = inside ? 0 : distanceToRing(x, z, pad.ring);
        if (d > blend) continue;
        if (inside) insideVals.push(out[i]);
        touched.push([i, d]);
      }
    }
    if (touched.length === 0) continue;
    let target = pad.y;
    if (typeof target !== 'number') {
      const cen = polygonCentroid(pad.ring);
      target = insideVals.length ? median(insideVals) : sampleGrid(grid, out, cen.x, cen.z);
    }
    for (const [i, d] of touched) if (!locked?.[i]) out[i] = target + (out[i] - target) * (d / blend);
    stats.push({ id: pad.id, target, nodes: insideVals.length });
  }
  return { data: out, stats };
}
