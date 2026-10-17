import { SITE } from '../config/constants.js';
import { insideEllipse } from './siteutil/ellipseGeo.js';

/**
 * Zona terlarang untuk penempatan vegetasi/props agar tidak menimpa jalan,
 * parkir, dan tugu. Semua angka dalam meter.
 */
export const ZONES = Object.freeze({
  roadMargin: 10,
  parkingMargin: 5,
  connectorHalfWidth: 7,
  groundHalf: SITE.groundSize / 2 - 20,
});

function inRect(x, z, cx, cz, w, d, margin) {
  return Math.abs(x - cx) < w / 2 + margin && Math.abs(z - cz) < d / 2 + margin;
}

function inCircle(x, z, cx, cz, r) {
  return Math.hypot(x - cx, z - cz) < r;
}

/** Terkena pita jalan (Naga Sakti, penghubung, jalan lingkar + jogging). */
export function onRoad(x, z) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, ringRoadWidth: w, joggingTrackOffset: off } = SITE;
  if (Math.abs(z - SITE.nagaSaktiZ) < ZONES.roadMargin) return true;
  const onConnector = SITE.connectorXs.some(
    (cx) => Math.abs(x - cx) < ZONES.connectorHalfWidth && z > SITE.nagaSaktiZ && z < 0,
  );
  if (onConnector) return true;
  const outer = insideEllipse(x, z, ax + off + 4, az + off + 4);
  const inner = insideEllipse(x, z, ax - w / 2 - 4, az - w / 2 - 4);
  return outer && !inner;
}

/** Terkena area fasilitas khusus (parkir, tugu tanjak). */
export function onFacility(x, z) {
  const pc = SITE.parkingCar;
  const pm = SITE.parkingMoto;
  if (inRect(x, z, pc.x, pc.z, pc.w, pc.d, ZONES.parkingMargin)) return true;
  if (inRect(x, z, pm.x, pm.z, pm.w, pm.d, ZONES.parkingMargin)) return true;
  return inCircle(x, z, SITE.tanjakMonument.x, SITE.tanjakMonument.z, 10);
}

/** Titik bebas untuk pohon besar: di luar jalan lingkar & semua fasilitas. */
export function isFreeForBigTree(x, z) {
  if (Math.abs(x) > ZONES.groundHalf || Math.abs(z) > ZONES.groundHalf) return false;
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, joggingTrackOffset: off } = SITE;
  if (insideEllipse(x, z, ax + off + 6, az + off + 6)) return false;
  return !onRoad(x, z) && !onFacility(x, z);
}

/** Titik bebas di sabuk antara plaza dan jalan lingkar (pohon muda, bangku). */
export function isFreeInPlazaBelt(x, z) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, ringRoadWidth: w, plazaSemiX: px, plazaSemiZ: pz } = SITE;
  if (!insideEllipse(x, z, ax - w / 2 - 5, az - w / 2 - 5)) return false;
  if (insideEllipse(x, z, px + 2, pz + 2)) return false;
  if (inCircle(x, z, SITE.tanjakMonument.x, SITE.tanjakMonument.z, 10)) return false;
  return !inCircle(x, z, 0, -(pz + 5), 24); // ruang tugu Lancang Kuning
}
