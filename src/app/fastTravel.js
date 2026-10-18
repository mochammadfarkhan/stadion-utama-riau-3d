/**
 * Perjalanan cepat (Fase 3): daftar tujuan (Stadion, Masjid Raya An-Nur) dan teleport yang
 * menunggu streamer kota memuat tile tujuan sebelum layar perjalanan ditutup.
 */
import { createCollider } from '../core/Collider.js';
import { STREAM } from '../city/ChunkStreamer.js';
import { thirdPersonOffset } from '../core/cameraMath.js';

/** Area manifest untuk An-Nur (tools/citybake/config.js AREAS.pusat; pusat area = node OSM masjid). */
export const ANNUR_AREA_ID = 'pusat';

/**
 * Tujuan perjalanan cepat (frame dunia). An-Nur hanya bila manifest memuat area "pusat".
 * `extra`: tujuan tambahan (frame dunia), mis. tujuan dev Kampus UNRI (M4) — M7 menjadikannya permanen.
 * @param {{manifest?: {areas?: Array<{id:string, bounds:{minX:number,minZ:number,maxX:number,maxZ:number}}>}|null,
 *   frame: {toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}, spawn: {x:number,z:number,yaw:number},
 *   extra?: Array<{id:string, label:string, x:number, z:number, yaw:number}>}} opts
 * @returns {Array<{id:string, label:string, x:number, z:number, yaw:number}>}
 */
export function travelDestinations({ manifest = null, frame, spawn, extra = [] }) {
  const s = frame.toWorld(spawn.x, spawn.z);
  const out = [{ id: 'stadion', label: 'Stadion Utama Riau', x: s.x, z: s.z, yaw: frame.yawToWorld(spawn.yaw) }];
  const area = manifest?.areas?.find((a) => a.id === ANNUR_AREA_ID);
  if (area) {
    const b = area.bounds;
    out.push({ id: 'annur', label: 'Masjid Raya An-Nur', x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, yaw: 0 });
  }
  return [...out, ...extra.map((d) => ({ id: d.id, label: d.label, x: d.x, z: d.z, yaw: d.yaw }))];
}

/** Kandidat titik di sekitar (x, z): pusat dulu, lalu cincin `directions` arah berjarak `step` m sampai `maxRadius`. */
function* ringCandidates(x, z, { step = 4, maxRadius = 200, directions = 16 } = {}) {
  yield { x, z };
  for (let r = step; r <= maxRadius; r += step) {
    for (let i = 0; i < directions; i += 1) {
      const a = (i / directions) * Math.PI * 2;
      yield { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
    }
  }
}

/**
 * Titik walkable terdekat di sekitar (x, z): pusat dulu, lalu cincin 16 arah (bawaan) berjarak `step` m
 * sampai `maxRadius`. null bila tidak ada (mis. tile belum dimuat semua terhalang).
 */
export function findWalkableNear(x, z, isWalkable, opts = {}) {
  for (const p of ringCandidates(x, z, opts)) if (isWalkable(p.x, p.z)) return p;
  return null;
}

const CAMERA_SAMPLES = Object.freeze([1 / 3, 2 / 3, 1]); // titik uji di sepanjang lengan kamera orang ketiga
const YAW_TRIES = 8; // yaw dicoba per 45°, berselang-seling ± dari arah hadap pusat

/** Kamera orang ketiga di belakang sepeda (x, z, yaw) bebas pada semua titik sampel. */
function cameraClearAt(x, z, yaw, isCameraClear) {
  const o = thirdPersonOffset(yaw, 0);
  return CAMERA_SAMPLES.every((s) => isCameraClear(x + o.x * s, z + o.z * s));
}

/** Urutan yaw: `base`, base ± 45°, ± 90°, … , base + 180°. */
function yawCandidates(base) {
  const step = (Math.PI * 2) / YAW_TRIES;
  const out = [base];
  for (let i = 1; i <= YAW_TRIES / 2; i += 1) {
    out.push(base + i * step);
    if (i < YAW_TRIES / 2) out.push(base - i * step);
  }
  return out;
}

/**
 * Titik muncul: walkable DAN kamera orang ketiga punya ruang (tidak menempel dinding). Per kandidat
 * (urutan seperti findWalkableNear), yaw dicoba mulai dari yang menghadap (x, z) (pusat tujuan; di pusat
 * sendiri: `fallbackYaw`). Tanpa `isCameraClear` / tak ada kamera bebas: titik walkable pertama.
 * @returns {{x:number, z:number, yaw:number}|null}
 */
export function findSpawnNear(x, z, { isWalkable, isCameraClear = null, fallbackYaw = 0, ...ring } = {}) {
  const faceYaw = (p) => (Math.hypot(x - p.x, z - p.z) < 1e-6 ? fallbackYaw : Math.atan2(x - p.x, z - p.z));
  let first = null;
  for (const p of ringCandidates(x, z, ring)) {
    if (!isWalkable(p.x, p.z)) continue;
    const base = faceYaw(p);
    first ??= { ...p, yaw: base };
    if (!isCameraClear) return first;
    const yaw = yawCandidates(base).find((y) => cameraClearAt(p.x, p.z, y, isCameraClear));
    if (yaw !== undefined) return { ...p, yaw };
  }
  return first;
}

/** @typedef {'ok' | 'timeout' | 'busy' | 'unknown'} TravelStatus */

/**
 * @param {{destinations: ReturnType<typeof travelDestinations>, bike: {state: object, setCollider(c: Function): void},
 *   colliders: {isWalkable(x:number, z:number): boolean, penetration?(x:number, z:number): number}, city?: {whenSettled(x:number, z:number, r?:number): Promise<boolean>}|null,
 *   screen: {show(text:string): void, hide(): void}, settleRadius?: number,
 *   isCameraClear?: ((x:number, z:number) => boolean)|null, rig?: {povId: string|null, exitPov(opts?: {instant?: boolean}): boolean}|null}} opts
 *   `isCameraClear`: titik muncul dipilih yang kamera orang ketiganya bebas; `rig`: POV aktif ditutup lebih dulu
 *   (fokus streamer = titik pandang POV, bukan sepeda).
 */
export function createFastTravel({
  destinations, bike, colliders, city = null, screen, settleRadius = STREAM.lod0Radius, isCameraClear = null, rig = null,
}) {
  let busy = false;
  const place = (x, z, yaw) => {
    bike.state = { ...bike.state, x, z, yaw, v: 0 };
    bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
  };
  return {
    destinations,
    get busy() { return busy; },
    /**
     * @returns {Promise<TravelStatus>} 'ok' = tile tujuan dimuat; 'timeout' = batas waktu streamer (tetap tiba);
     *   'busy' = perjalanan lain sedang berjalan; 'unknown' = tujuan tak dikenal.
     */
    async go(id) {
      const d = destinations.find((v) => v.id === id);
      if (!d) return 'unknown';
      if (busy) return 'busy';
      busy = true;
      screen.show(`Menuju ${d.label}…`);
      try {
        if (rig?.povId) rig.exitPov({ instant: true }); // fokus streamer kembali ke sepeda; tanpa terbang ke tujuan
        place(d.x, d.z, d.yaw); // fokus streamer pindah ke tujuan
        const settled = city ? await city.whenSettled(d.x, d.z, settleRadius) : true;
        const spot = findSpawnNear(d.x, d.z, { isWalkable: colliders.isWalkable, isCameraClear, fallbackYaw: d.yaw }) ?? d;
        place(spot.x, spot.z, spot.yaw); // collider tile sudah ada: titik walkable dengan ruang kamera
        return settled ? 'ok' : 'timeout';
      } finally {
        screen.hide();
        busy = false;
      }
    },
  };
}
