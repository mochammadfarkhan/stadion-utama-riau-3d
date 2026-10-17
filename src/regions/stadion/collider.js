/**
 * Collider region stadion (koordinat region-lokal): mangkuk & cangkang stadion, koridor gate utama,
 * tugu padat, dan batas tanah region. (Danau fiktif dihapus Plan C; air nyata = TileCollider.)
 */
import { SITE, STADIUM } from './site.js';
import { distanceToGateCorridor, inGateCorridor, GATE_HALF_WIDTH } from '../../world/stadium/gateCorridor.js';

const GROUND_MARGIN = 20;
const BIKE_CLEARANCE = 0.6;
const CAMERA_CLEARANCE = 0.8;  // kamera butuh jarak lebih lega dari dinding daripada sepeda
const TANJAK_R = 1.6;

/** Radius ternormalisasi terhadap elips (1 = tepat di tepi). */
const ellipseRadius = (x, z, a, b) => Math.sqrt((x / a) ** 2 + (z / b) ** 2);

/**
 * @param {{site?: object, stadium?: object}} [data]
 * @returns {{obstacles: ReadonlyArray<{name:string,x:number,z:number,r:number}>,
 *   isWalkable(lx:number, lz:number):boolean, isCameraClear(lx:number, lz:number):boolean}}
 */
export function createStadionColliders({ site = SITE, stadium = STADIUM } = {}) {
  const limit = site.groundSize / 2 - GROUND_MARGIN;
  /** Rintangan lingkaran padat di plaza/kawasan: kolam tugu Lancang Kuning & tugu tanjak. */
  const obstacles = Object.freeze([
    Object.freeze({ name: 'tuguLancangKuning', x: site.tugu.x, z: site.tugu.z, r: site.tugu.poolR + BIKE_CLEARANCE }),
    Object.freeze({ name: 'tuguTanjak', x: site.tanjakMonument.x, z: site.tanjakMonument.z, r: TANJAK_R + BIKE_CLEARANCE }),
  ]);
  // radiusOf: ekspresi radius dipertahankan persis seperti collider lama (paritas floating-point).
  const hitsObstacle = (x, z, radiusOf) => obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < radiusOf(o));
  const walkRadius = (o) => o.r;
  const cameraRadius = (o) => o.r - BIKE_CLEARANCE + CAMERA_CLEARANCE;
  const outsideWalls = (x, z, innerPad, outerPad) => (
    ellipseRadius(x, z, stadium.innerSemiX - innerPad, stadium.innerSemiZ - innerPad) < 1
    || ellipseRadius(x, z, stadium.outerSemiX + outerPad, stadium.outerSemiZ + outerPad) > 1
  );

  /** Posisi valid: di dalam mangkuk, di luar cangkang, atau di koridor gate; dalam batas tanah. */
  function isWalkable(lx, lz) {
    if (Math.abs(lx) > limit || Math.abs(lz) > limit) return false;
    if (hitsObstacle(lx, lz, walkRadius)) return false;
    if (inGateCorridor(lx, lz)) return true;
    return outsideWalls(lx, lz, 2, 1.5);
  }

  /** Bebas untuk KAMERA: di luar dinding tribun/cangkang (kecuali koridor gate) dan rintangan padat. */
  function isCameraClear(lx, lz) {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return false;
    if (hitsObstacle(lx, lz, cameraRadius)) return false;
    if (distanceToGateCorridor(lx, lz) < GATE_HALF_WIDTH - 0.6) return true;
    return outsideWalls(lx, lz, 1, 3);
  }

  return Object.freeze({ obstacles, isWalkable, isCameraClear });
}

export const stadionColliders = createStadionColliders();
export const OBSTACLES = stadionColliders.obstacles;
export const { isWalkable, isCameraClear } = stadionColliders;
