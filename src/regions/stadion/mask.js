/**
 * Mask region stadion (region-lokal): fitur kota di dalamnya dibuang saat bake (Fase 1).
 * Fallback sampai poligon OSM tersedia (Fase 3): hull cembung elips jalan lingkar + jalur jogging
 * (dengan margin) dan blok parkir mobil & motor.
 */
import { SITE } from './site.js';
import { convexHull } from '../../shared/polygon.js';

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
