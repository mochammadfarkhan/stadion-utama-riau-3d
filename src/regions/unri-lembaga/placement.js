/**
 * Placement region "unri-lembaga" dan sub-frame bangunan hero (murni). Origin region = pusat Sekretariat
 * Lembaga Mahasiswa, yaw 0: koordinat region-lokal = dunia − origin (utara = −Z). Bangunan hero punya
 * sub-frame {x, z, yaw} region-lokal sendiri yang diturunkan dari footprint OSM saat modul dimuat.
 */
import { WORLD_ORIGIN } from '../../config/constants.js';
import { createProjection } from '../../geo/projection.js';
import { placementFromFootprint } from '../../geo/placement.js';
import { toLocal, toWorld } from '../../geo/regionTransform.js';
import { OSM_LATLON } from './footprints.js';

/** Id region (satu sumber; index.js, portalDoors.js, cerita). */
export const UNRI_LEMBAGA_ID = 'unri-lembaga';

const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });
const project = (ring) => Object.freeze(ring.map(([lat, lon]) => {
  const w = projection.toWorld(lat, lon);
  return Object.freeze([w.x, w.z]);
}));

/** Footprint OSM dalam koordinat DUNIA. */
export const FOOTPRINTS_WORLD = Object.freeze(Object.fromEntries(
  Object.entries(OSM_LATLON).map(([key, ring]) => [key, project(ring)]),
));

/** Placement region (beku, dibulatkan 1 cm; tes memastikan = pusat footprint sekretariat). */
export const LEMBAGA_PLACEMENT = Object.freeze({ x: -219.47, z: 1099.21, yaw: 0 });

/** Dunia → region-lokal [lx, lz]. */
export function toRegion(x, z) {
  const l = toLocal(LEMBAGA_PLACEMENT, x, z);
  return [Number(l.x.toFixed(6)) + 0, Number(l.z.toFixed(6)) + 0];
}

/** Region-lokal → dunia {x, z}. */
export const regionToWorld = (lx, lz) => toWorld(LEMBAGA_PLACEMENT, lx, lz);

const ringToRegion = (ring) => Object.freeze(ring.map(([x, z]) => Object.freeze(toRegion(x, z))));

/** Footprint OSM dalam koordinat REGION-LOKAL. */
export const FOOTPRINTS = Object.freeze(Object.fromEntries(
  Object.entries(FOOTPRINTS_WORLD).map(([key, ring]) => [key, ringToRegion(ring)]),
));

/**
 * Sub-frame sekretariat: sumbu panjang = rerata tepi AB & DC (+Z lokal-gedung), pusat = rerata 4 sudut.
 * @param {ReadonlyArray<readonly [number, number]>} ring region-lokal, urutan A,B,C,D OSM
 */
export function sekretariatFrame(ring = FOOTPRINTS.sekretariat) {
  const [a, b, c, d] = ring;
  const dx = (b[0] - a[0] + c[0] - d[0]) / 2;
  const dz = (b[1] - a[1] + c[1] - d[1]) / 2;
  const width = (Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(a[0] - d[0], a[1] - d[1])) / 2;
  return {
    frame: Object.freeze({ x: (a[0] + b[0] + c[0] + d[0]) / 4, z: (a[1] + b[1] + c[1] + d[1]) / 4, yaw: Math.atan2(dx, dz) }),
    size: Object.freeze({ length: Math.hypot(dx, dz), width }),
  };
}

const sek = sekretariatFrame();
/** Sub-frame sekretariat (region-lokal): +Z lokal-gedung = sumbu panjang (ESE), +X = NNE. */
export const SEKRE_FRAME = sek.frame;
/** Ukuran footprint OSM: length = sisi panjang (Z lokal-gedung), width = sisi pendek (X lokal-gedung). */
export const SEKRE_SIZE = sek.size;

/** Lokal-gedung sekretariat → region-lokal {x, z}. */
export const fromSekre = (bx, bz) => toWorld(SEKRE_FRAME, bx, bz);
/** Region-lokal → lokal-gedung sekretariat {x, z}. */
export const toSekre = (lx, lz) => toLocal(SEKRE_FRAME, lx, lz);

/** Sub-frame lapangan stadion mini (sumbu panjang = +Z, ±U–S). */
export const PITCH_FRAME = Object.freeze(placementFromFootprint(FOOTPRINTS.lapangan));

/** Jarak bertanda titik p dari garis a→b. */
const sideDistance = (p, a, b) => {
  const ux = b[0] - a[0];
  const uz = b[1] - a[1];
  const len = Math.hypot(ux, uz);
  return ((p[0] - a[0]) * uz - (p[1] - a[1]) * ux) / len;
};

/**
 * Tribun stadion mini (way 282225436): frame di tengah batang utama, +Z sepanjang muka timur (utara→selatan),
 * +X ke timur (lapangan). Muka barat batang OSM miring 0,5 m → dirata-rata menjadi x = −depth/2.
 * VIP = tonjolan barat (indeks 0,1 = muka barat VIP; menempel di x = −depth/2). Ukuran dalam frame tribun.
 * @param {ReadonlyArray<readonly [number, number]>} ring region-lokal
 */
export function deriveTribun(ring = FOOTPRINTS.tribun) {
  const [v0, v1, v2, v3, v4, v5, v6, v7] = ring;
  const depth = (Math.abs(sideDistance(v3, v4, v5)) + Math.abs(sideDistance(v6, v4, v5))) / 2;
  const cx = (v3[0] + v4[0] + v5[0] + v6[0]) / 4;
  const cz = (v3[1] + v4[1] + v5[1] + v6[1]) / 4;
  const frame = Object.freeze({ x: cx, z: cz, yaw: Math.atan2(v5[0] - v4[0], v5[1] - v4[1]) });
  const loc = (p) => toLocal(frame, p[0], p[1]);
  const west = [v0, v1].map(loc);
  const ends = [v0, v1, v2, v7].map(loc);
  return Object.freeze({
    frame,
    length: Math.hypot(v5[0] - v4[0], v5[1] - v4[1]),
    depth,
    vip: Object.freeze({
      x0: (west[0].x + west[1].x) / 2, x1: -depth / 2,
      z0: Math.min(...ends.map((p) => p.z)), z1: Math.max(...ends.map((p) => p.z)),
    }),
  });
}

export const TRIBUN = deriveTribun();
