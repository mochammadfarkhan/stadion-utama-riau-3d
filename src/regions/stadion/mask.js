/**
 * Mask region stadion (region-lokal): SATU sumber untuk klien (collider komposit, regionContains) dan
 * citybake (fitur kota di dalamnya dibuang saat bake, lewat stadionMaskWorld). Fallback: OSM tidak
 * memiliki poligon kompleks stadion (diperiksa 2026-10-16), jadi mask = hull cembung elips jalan
 * lingkar + jalur jogging (dengan margin) dan blok parkir mobil & motor.
 */
import { SITE } from './site.js';
import { STADION_PLACEMENT } from './placement.js';
import { convexHull, pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { toWorld } from '../../geo/regionTransform.js';

const MASK_MARGIN = 20;       // m di luar sumbu jalur jogging (memuat billboard x = ±250)
const ELLIPSE_SAMPLES = 48;
/**
 * Koridor sumbu utara (region-lokal): sumbu pedestrian OSM way 1452277714 (x ≈ −20…10) di antara dua
 * danau OSM (tepi: x ≈ −22,5 dan x ≈ 13 pada z −370…−390), melebar di ujung (z < −412, utara danau)
 * untuk gapura, pos jaga, dan rambu. Ujung z = −440 berhenti sebelum jalur Jl. Naga Sakti terdekat
 * (z ≈ −447) agar jalan OSM tidak terpotong mask.
 */
export const NORTH_CORRIDOR = Object.freeze({ xWest: -22, xEast: 12, zNeck: -412, xWideWest: -30, xWideEast: 30, zTip: -440 });

const ellipsePoints = (semiX, semiZ, n) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2;
  return [semiX * Math.cos(t), semiZ * Math.sin(t)];
});

const rectCorners = ({ x, z, w, d }) => [
  [x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2],
];

/**
 * Sisipkan koridor ke rantai utara (z kecil) hull cembung: titik hull di leher koridor diganti
 * jalur koridor. Hull = keluaran convexHull (mulai dari x terkecil, rantai utara x naik).
 */
export function withNorthCorridor(hull, c = NORTH_CORRIDOR) {
  const k = hull.reduce((best, p, i) => (p[0] > hull[best][0] ? i : best), 0);
  const zAt = (x) => {
    for (let i = 0; i < k; i += 1) {
      const a = hull[i];
      const b = hull[i + 1];
      if (a[0] <= x && x <= b[0] && b[0] > a[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
    throw new RangeError(`koridor utara: x = ${x} di luar rantai utara hull`);
  };
  const spur = [
    [c.xWest, zAt(c.xWest)], [c.xWest, c.zNeck], [c.xWideWest, c.zNeck], [c.xWideWest, c.zTip],
    [c.xWideEast, c.zTip], [c.xWideEast, c.zNeck], [c.xEast, c.zNeck], [c.xEast, zAt(c.xEast)],
  ];
  const out = [];
  let inserted = false;
  hull.forEach((p, i) => {
    const inNeck = i <= k && p[0] > c.xWest && p[0] < c.xEast;
    if (inNeck) {
      if (!inserted) out.push(...spur);
      inserted = true;
      return;
    }
    out.push(p);
    const next = hull[i + 1];
    if (!inserted && i < k && p[0] <= c.xWest && next[0] >= c.xEast) {
      out.push(...spur);
      inserted = true;
    }
  });
  return out;
}

/** @returns {ReadonlyArray<readonly [number, number]>} */
export function createStadionMask(site = SITE) {
  const semiX = site.ringRoadSemiX + site.joggingTrackOffset + MASK_MARGIN;
  const semiZ = site.ringRoadSemiZ + site.joggingTrackOffset + MASK_MARGIN;
  const pts = [...ellipsePoints(semiX, semiZ, ELLIPSE_SAMPLES), ...rectCorners(site.parkingCar), ...rectCorners(site.parkingMoto)];
  return Object.freeze(withNorthCorridor(convexHull(pts)).map((p) => Object.freeze(p)));
}

export const STADION_MASK = createStadionMask();

/** Jarak minimum batang pohon/semak dari tepi mask (m): tajuk trembesi ±6,5 m tidak menjorok ke tile kota. */
export const VEGETATION_EDGE_CLEARANCE = 10;

/**
 * Koridor gapura & sumbu pedestrian utara (region-lokal): pita x koridor lebar, utara tepi parkir mobil
 * (rantai utara hull di sana = tepi parkir). Bebas vegetasi: sumbu pejalan, gapura, angkot di bahu Naga Sakti.
 */
export function inNorthCorridor(x, z, c = NORTH_CORRIDOR, site = SITE) {
  return x >= c.xWideWest && x <= c.xWideEast && z < site.parkingCar.z - site.parkingCar.d / 2;
}

/** Titik boleh ditanami pohon/semak: di dalam mask, ≥ VEGETATION_EDGE_CLEARANCE dari tepi, di luar koridor utara. */
export function isVegetationSpot(x, z, mask = STADION_MASK) {
  return pointInPolygon(x, z, mask) && distanceToRing(x, z, mask) >= VEGETATION_EDGE_CLEARANCE && !inNorthCorridor(x, z);
}

/** Mask dalam koordinat DUNIA (dipakai citybake): ring region-lokal ditransformasi placement. */
export function stadionMaskWorld(placement = STADION_PLACEMENT, mask = STADION_MASK) {
  return mask.map(([x, z]) => {
    const w = toWorld(placement, x, z);
    return [w.x, w.z];
  });
}
