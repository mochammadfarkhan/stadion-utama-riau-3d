/**
 * Muka air badan air distrik (spec §5.2.8): tanah terendah sepanjang tepi (sampel tiap 2 m) − 0,4 m, dibulatkan
 * 0,01 m. Air dianggap "dipahat" terrain M1 bila sampel grid 4 m di dalamnya lebih rendah dari muka − 0,3 m;
 * air yang tidak dipahat tidak digambar (bidang air akan tenggelam di bawah tanah) dan dilaporkan.
 */
import { pointInPolygon, ringBounds } from '../../../src/geo/polygon.js';
import { WATER } from './constants.js';

export function waterLevel(rings, field, opts = WATER) {
  const outer = rings[0];
  let minEdge = Infinity;
  for (let i = 0; i < outer.length; i += 1) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / opts.edgeStep));
    for (let k = 0; k < n; k += 1) {
      const t = k / n;
      minEdge = Math.min(minEdge, field.heightAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    }
  }
  const level = Math.round((minEdge - opts.drop) * 100) / 100;
  const bb = ringBounds(outer);
  const g = opts.gridStep;
  let minInside = Infinity;
  for (let z = Math.ceil(bb.minZ / g) * g; z <= bb.maxZ; z += g) {
    for (let x = Math.ceil(bb.minX / g) * g; x <= bb.maxX; x += g) {
      if (pointInPolygon(x, z, outer) && !rings.slice(1).some((h) => pointInPolygon(x, z, h))) {
        minInside = Math.min(minInside, field.heightAt(x, z));
      }
    }
  }
  return { level, minEdge, minInside, carved: minInside < level - opts.carvedMin };
}

/** Salinan E dengan area air diberi `level`; air yang tidak dipahat dibuang. `water` = laporan per area. */
export function applyWaterLevels(E, field, opts = WATER) {
  const water = [];
  const areas = E.areas.flatMap((a) => {
    if (a.kind !== 'water') return [a];
    const r = waterLevel(a.rings, field, opts);
    water.push({ id: a.id, level: r.level, carved: r.carved });
    return r.carved ? [{ ...a, level: r.level }] : [];
  });
  return { E: { ...E, areas }, water };
}
