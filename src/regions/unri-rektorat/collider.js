// src/regions/unri-rektorat/collider.js
/**
 * Collider region unri-rektorat (region-lokal, murni). Komposit (spec §4.2) memberi region wewenang
 * penuh di dalam mask, jadi semua penghalang di dalam mask ada di sini: massa Rektorat (slab + blok tengah),
 * teras lobi bertangga, perpustakaan (ring OSM), Danau Buatan (air), tiang kanopi, tiang bendera, papan
 * batu N01. Pohon/PJU/bangku tidak menghalangi (sama dengan region stadion).
 */
import { pointInPolygon, distanceToRing } from '../../geo/polygon.js';
import { REKTORAT_MASSA, PERPUS_RING, DANAU_RING } from './site.data.js';
import { LAYOUT } from './layout.js';

export const BIKE_CLEARANCE = 0.6;
const CAMERA_CLEARANCE = 0.8;
const POST_R = 0.25;
const FLAG_R = 0.4;
const LAMP_R = 0.2;

const inRect = (x, z, r, pad) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
const solidRing = (x, z, ring, pad) => pointInPolygon(x, z, ring) || distanceToRing(x, z, ring) < pad;

/**
 * @param {{layout?: typeof LAYOUT}} [opts]
 * @returns {{blocks: ReadonlyArray<object>, posts: ReadonlyArray<{x:number,z:number,r:number}>,
 *   isWalkable(lx:number, lz:number):boolean, isCameraClear(lx:number, lz:number):boolean}}
 */
export function createRektoratColliders({ layout = LAYOUT } = {}) {
  const blocks = Object.freeze([REKTORAT_MASSA.slab, REKTORAT_MASSA.tengah]);
  const pb = layout.papanBatu;
  // papan menghadap timur (yaw −π/2): panjang 6 m sejajar sumbu Z lokal
  const papan = Object.freeze({ x0: pb.x - pb.d / 2, x1: pb.x + pb.d / 2, z0: pb.z - pb.w / 2, z1: pb.z + pb.w / 2 });
  const posts = Object.freeze([
    ...layout.kanopiTiang.map((p) => Object.freeze({ x: p.x, z: p.z, r: POST_R })),
    ...layout.lampuTaman.map((p) => Object.freeze({ x: p.x, z: p.z, r: LAMP_R })),
    Object.freeze({ x: layout.tiangBendera.x, z: layout.tiangBendera.z, r: FLAG_R }),
  ]);
  const hitsPost = (x, z, pad) => posts.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);

  function isWalkable(lx, lz) {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return false;
    if (blocks.some((b) => inRect(lx, lz, b, BIKE_CLEARANCE))) return false;
    if (inRect(lx, lz, layout.teras, BIKE_CLEARANCE)) return false;
    if (inRect(lx, lz, papan, BIKE_CLEARANCE)) return false;
    if (solidRing(lx, lz, PERPUS_RING, BIKE_CLEARANCE)) return false;
    if (solidRing(lx, lz, DANAU_RING, BIKE_CLEARANCE)) return false;
    return !hitsPost(lx, lz, BIKE_CLEARANCE);
  }

  function isCameraClear(lx, lz) {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return false;
    if (blocks.some((b) => inRect(lx, lz, b, CAMERA_CLEARANCE))) return false;
    return !solidRing(lx, lz, PERPUS_RING, CAMERA_CLEARANCE);
  }

  return Object.freeze({ blocks, posts, isWalkable, isCameraClear });
}

export const rektoratColliders = createRektoratColliders();
