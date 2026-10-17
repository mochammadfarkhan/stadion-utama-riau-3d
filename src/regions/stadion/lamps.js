/**
 * Lampu malam region stadion (dipakai TimeOfDay.registerLamps): PJU yang menyala dan sorot floodlight.
 * Status rusak dibaca dari data layout (flag `broken`), bukan aturan salinan. Posisi region-lokal
 * diubah ke dunia dengan placement region.
 */
import { STADIUM } from './site.js';
import { toWorld } from '../../geo/regionTransform.js';

const FLOOD_INSET = 0.85; // posisi sorot = 85% semi-axis dalam tribun
const FLOOD_DROP = 2;     // m di bawah tinggi atap
const FLOOD_AIM = 0.25;   // titik bidik = 25% ke sisi seberang lapangan

/** PJU menyala, region-lokal. */
export function litLampPositions(layout) {
  return [...layout.plazaLamps, ...layout.ringRoadLamps]
    .filter((p) => !p.broken)
    .map((p) => ({ x: p.x, z: p.z }));
}

/** Empat sorot floodlight di sudut atap (region-lokal): posisi (x,y,z) dan titik bidik (tx,ty,tz). */
export function floodSpotsLocal(stadium = STADIUM) {
  const x = stadium.innerSemiX * FLOOD_INSET;
  const z = stadium.innerSemiZ * FLOOD_INSET;
  const y = stadium.roofHeight - FLOOD_DROP;
  return [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => ({
    x: sx * x, y, z: sz * z, tx: -sx * x * FLOOD_AIM, ty: 0, tz: -sz * z * FLOOD_AIM,
  }));
}

/**
 * Data TimeOfDay.registerLamps dalam koordinat DUNIA.
 * @param {object} layout LAYOUT region
 * @param {{x:number, z:number, yaw:number}} placement
 * @returns {{lamps: {x:number,z:number}[], floods: Array<{x:number,y:number,z:number,tx:number,ty:number,tz:number}>}}
 */
export function stadionNightLights(layout, placement) {
  const lamps = litLampPositions(layout).map((p) => toWorld(placement, p.x, p.z));
  const floods = floodSpotsLocal().map((f) => {
    const p = toWorld(placement, f.x, f.z);
    const t = toWorld(placement, f.tx, f.tz);
    return { x: p.x, y: f.y, z: p.z, tx: t.x, ty: f.ty, tz: t.z };
  });
  return { lamps, floods };
}
