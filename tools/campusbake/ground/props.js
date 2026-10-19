/**
 * Penempatan props kampus (bake, deterministik): P03 PJU di sisi kiri jalan per kelas (PROPS.lamp.spacing),
 * P04 bangku bergantian sisi trotoar, P05 tong sampah di samping tiap 2 bangku. yaw (derajat bulat, konvensi
 * atan2(dx, dz)) = arah hadap ke jalan/trotoar (lengan PJU, muka bangku).
 */
import { polylineLength } from '../../../src/geo/lineClip.js';
import { samplesAlong } from './spatial.js';
import { PROPS } from './constants.js';

const deg = (rad) => ((Math.round((rad * 180) / Math.PI) % 360) + 360) % 360;

function blocked(ctx, x, z, clear = PROPS.clear) {
  return !ctx.inside(x, z) || ctx.area(x, z) !== null || ctx.building(x, z) !== null
    || ctx.buildingEdge(x, z) < clear.building || ctx.roadEdge(x, z).d < clear.road
    || ctx.waterEdge(x, z) < clear.water;
}

/** @returns {{lamps: Array<{x,z,yaw}>, benches: Array<{x,z,yaw}>, bins: Array<{x,z}>}} */
export function placeProps(E, ctx) {
  const lamps = [];
  const benches = [];
  const bins = [];
  for (const r of E.roads) {
    const spacing = PROPS.lamp.spacing[r.cls];
    if (!spacing) continue;
    const d = r.w / 2 + PROPS.lamp.offset;
    for (const p of samplesAlong(r.line, spacing, spacing / 2)) {
      const nx = -p.tz;
      const nz = p.tx;
      const x = p.x + nx * d;
      const z = p.z + nz * d;
      if (blocked(ctx, x, z) || ctx.walkEdge(x, z).d < PROPS.clear.walk) continue;
      lamps.push({ x, z, yaw: deg(Math.atan2(-nx, -nz)) });
    }
  }
  for (const w of E.walks) {
    if (polylineLength(w.line) < PROPS.bench.minWalk) continue;
    samplesAlong(w.line, PROPS.bench.spacing, PROPS.bench.spacing / 2).forEach((p, k) => {
      const side = k % 2 === 0 ? 1 : -1;
      const nx = -p.tz * side;
      const nz = p.tx * side;
      const d = w.w / 2 + PROPS.bench.offset;
      const x = p.x + nx * d;
      const z = p.z + nz * d;
      if (blocked(ctx, x, z) || ctx.walkEdge(x, z).d < PROPS.bench.offset - 0.1) return;
      benches.push({ x, z, yaw: deg(Math.atan2(-nx, -nz)) });
      if ((benches.length - 1) % PROPS.bin.every !== 0) return;
      const bx = x + p.tx * PROPS.bin.along;
      const bz = z + p.tz * PROPS.bin.along;
      if (!blocked(ctx, bx, bz)) bins.push({ x: bx, z: bz });
    });
  }
  return { lamps, benches, bins };
}
