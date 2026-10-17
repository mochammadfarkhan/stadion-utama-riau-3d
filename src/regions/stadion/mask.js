/**
 * Mask region stadion (region-lokal): SATU sumber untuk klien (collider komposit, regionContains) dan
 * citybake (fitur kota di dalamnya dibuang saat bake, lewat stadionMaskWorld). Fallback: OSM tidak
 * memiliki poligon kompleks stadion (diperiksa 2026-10-16), jadi mask = hull cembung elips jalan
 * lingkar + jalur jogging (dengan margin) dan blok parkir mobil & motor.
 */
import { SITE } from './site.js';
import { STADION_PLACEMENT } from './placement.js';
import { convexHull } from '../../geo/polygon.js';
import { toWorld } from '../../geo/regionTransform.js';

const MASK_MARGIN = 8;        // m di luar sumbu jalur jogging
const ELLIPSE_SAMPLES = 48;

const ellipsePoints = (semiX, semiZ, n) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2;
  return [semiX * Math.cos(t), semiZ * Math.sin(t)];
});

const rectCorners = ({ x, z, w, d }) => [
  [x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2],
];

/** @returns {ReadonlyArray<readonly [number, number]>} */
export function createStadionMask(site = SITE) {
  const semiX = site.ringRoadSemiX + site.joggingTrackOffset + MASK_MARGIN;
  const semiZ = site.ringRoadSemiZ + site.joggingTrackOffset + MASK_MARGIN;
  const pts = [...ellipsePoints(semiX, semiZ, ELLIPSE_SAMPLES), ...rectCorners(site.parkingCar), ...rectCorners(site.parkingMoto)];
  return Object.freeze(convexHull(pts).map((p) => Object.freeze(p)));
}

export const STADION_MASK = createStadionMask();

/** Mask dalam koordinat DUNIA (dipakai citybake): ring region-lokal ditransformasi placement. */
export function stadionMaskWorld(placement = STADION_PLACEMENT, mask = STADION_MASK) {
  return mask.map(([x, z]) => {
    const w = toWorld(placement, x, z);
    return [w.x, w.z];
  });
}
