import { STADIUM, SITE } from '../config/constants.js';
import { ZONES, onFacility } from './Landscape.zones.js';
import { insideEllipse } from './siteutil/ellipseGeo.js';

/**
 * Penentu titik berumput untuk bilah rumput instanced. Murni (tanpa three),
 * sehingga mudah diuji. Semua satuan meter, bidang XZ.
 *
 * Tidak memakai `onRoad` dari Landscape.zones karena koridor jalan penghubung
 * di sana memanjang sampai z=0 (menembus sabuk rumput plaza); di sini panjang
 * penghubung mengikuti geometri sebenarnya (gapura → tepi jalan lingkar).
 */
const STADIUM_MARGIN = 4;        // jarak dari cangkang stadion
const PLAZA_MARGIN = 1;          // jarak dari tepi paving plaza
const MONUMENT_RADIUS = 24;      // ruang tugu Lancang Kuning (selaras isFreeInPlazaBelt)
const KERB_SIDEWALK = 2.85;      // kerb 0,35 + trotoar 2,5 (Ground.roads)
const ROAD_MARGIN = 1;
const CONNECTOR_HALF = 4 + ROAD_MARGIN; // lebar penghubung 8 m

/** Z tepi utara jalan lingkar (negatif) pada x tertentu. */
function ringRoadZAt(x) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az } = SITE;
  const k = Math.max(0, 1 - (x * x) / (ax * ax));
  return -az * Math.sqrt(k);
}

/** Pita jalan lingkar + trotoar + jalur jogging. */
function onRingRoadBand(x, z) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, ringRoadWidth: w, joggingTrackOffset: off, joggingTrackWidth: jw } = SITE;
  const outerPad = off + jw / 2 + ROAD_MARGIN;
  const innerPad = w / 2 + KERB_SIDEWALK + ROAD_MARGIN;
  const outer = insideEllipse(x, z, ax + outerPad, az + outerPad);
  const inner = insideEllipse(x, z, ax - innerPad, az - innerPad);
  return outer && !inner;
}

/** Jalan penghubung sumbu utara (gapura → jalan lingkar). */
function onStraightRoads(x, z) {
  return SITE.connectorXs.some((cx) => {
    const zEnd = ringRoadZAt(cx) + SITE.ringRoadWidth / 2 + ROAD_MARGIN;
    return Math.abs(x - cx) < CONNECTOR_HALF && z > SITE.gapuraZ && z < zEnd;
  });
}

/** Di dalam stadion / plaza paving / tugu Lancang Kuning. */
function onStadiumOrPlaza(x, z) {
  if (insideEllipse(x, z, STADIUM.outerSemiX + STADIUM_MARGIN, STADIUM.outerSemiZ + STADIUM_MARGIN)) return true;
  if (insideEllipse(x, z, SITE.plazaSemiX + PLAZA_MARGIN, SITE.plazaSemiZ + PLAZA_MARGIN)) return true;
  const mz = -(SITE.plazaSemiZ + 5);
  return Math.hypot(x, z - mz) < MONUMENT_RADIUS;
}

/**
 * Apakah (x, z) titik berumput: di luar stadion, plaza, jalan, parkir, dan fasilitas.
 * (LAKE_RADIUS lama dihapus bersama danau fiktif, Plan C I4.)
 */
export function isGrassSpot(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > ZONES.groundHalf || Math.abs(z) > ZONES.groundHalf) return false;
  if (onStadiumOrPlaza(x, z)) return false;
  if (onRingRoadBand(x, z) || onStraightRoads(x, z)) return false;
  return !onFacility(x, z);
}
