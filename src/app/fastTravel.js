/**
 * Perjalanan cepat (Fase 3 + M7): daftar tujuan (Stadion, Masjid Raya An-Nur, Kampus UNRI: Sekretariat Lembaga & Rektorat)
 * dan teleport yang menunggu streamer kota, distrik, dan region hero memuat tujuan sebelum layar perjalanan ditutup.
 */
import { createCollider } from '../core/Collider.js';
import { STREAM } from '../city/ChunkStreamer.js';
import { thirdPersonOffset } from '../core/cameraMath.js';
import { regionContains } from '../regions/Region.js';

/** Area manifest untuk An-Nur (tools/citybake/config.js AREAS.pusat; pusat area = node OSM masjid). */
export const ANNUR_AREA_ID = 'pusat';

/** Tujuan kampus (dunia; spec §8.4, titik ukur §9.2 sekre-luar & rektorat), menghadap gedung (yaw π = utara). */
export const CAMPUS_DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'unri-sekre', label: 'Kampus UNRI — Sekretariat Lembaga', x: -219, z: 1130, yaw: Math.PI }),
  Object.freeze({ id: 'unri-rektorat', label: 'Kampus UNRI — Rektorat', x: -979, z: 860, yaw: Math.PI }),
]);

/**
 * Tujuan perjalanan cepat (frame dunia). An-Nur hanya bila manifest memuat area "pusat"; tujuan kampus bila `campus`
 * (distrik UNRI terpasang). `extra`: tujuan tambahan (frame dunia).
 * @param {{manifest?: {areas?: Array<{id:string, bounds:{minX:number,minZ:number,maxX:number,maxZ:number}}>}|null,
 *   frame: {toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}, spawn: {x:number,z:number,yaw:number},
 *   extra?: Array<{id:string, label:string, x:number, z:number, yaw:number}>, campus?: boolean}} opts
 * @returns {Array<{id:string, label:string, x:number, z:number, yaw:number}>}
 */
export function travelDestinations({ manifest = null, frame, spawn, extra = [], campus = false }) {
  const s = frame.toWorld(spawn.x, spawn.z);
  const out = [{ id: 'stadion', label: 'Stadion Utama Riau', x: s.x, z: s.z, yaw: frame.yawToWorld(spawn.yaw) }];
  const area = manifest?.areas?.find((a) => a.id === ANNUR_AREA_ID);
  if (area) {
    const b = area.bounds;
    out.push({ id: 'annur', label: 'Masjid Raya An-Nur', x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, yaw: 0 });
  }
  if (campus) out.push(...CAMPUS_DESTINATIONS.map((d) => ({ ...d })));
  return [...out, ...extra.map((d) => ({ id: d.id, label: d.label, x: d.x, z: d.z, yaw: d.yaw }))];
}

/**
 * Tunggu region hero yang menaungi (x, z) terpasang (regionManager.update memasangnya saat fokus mendekat) dan
 * `ready`-nya selesai. true bila tidak ada region hero di titik itu atau sudah siap; false bila habis waktu.
 * Penolakan `ready` diteruskan ke pemanggil (perjalanan cepat mencatatnya).
 * @param {{active(): Array<{def:{id:string}, region?:{ready?:Promise<unknown>}}>}} regions
 * @param {ReadonlyArray<{id:string, placement:object, mask:Array<[number, number]>}>} defs definisi region hero
 */
export async function waitForRegion(regions, defs, x, z, {
  timeoutMs = 20000, pollMs = 100, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => performance.now(),
} = {}) {
  const def = defs.find((d) => regionContains(d, x, z));
  if (!def) return true;
  const t0 = now();
  for (;;) {
    const hit = regions.active().find((a) => a.def.id === def.id);
    if (hit) {
      await Promise.resolve(hit.region?.ready);
      return true;
    }
    if (now() - t0 >= timeoutMs) return false;
    await sleep(pollMs);
  }
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
 *   settle?: ((x:number, z:number) => Promise<boolean>)|null,
 *   isCameraClear?: ((x:number, z:number) => boolean)|null, rig?: {povId: string|null, exitPov(opts?: {instant?: boolean}): boolean}|null}} opts
 *   `isCameraClear`: titik muncul dipilih yang kamera orang ketiganya bebas; `rig`: POV aktif ditutup lebih dulu
 *   (fokus streamer = titik pandang POV, bukan sepeda). `settle(x, z) → Promise<boolean>`: tunggu tambahan, mis. distrik + region hero.
 */
export function createFastTravel({
  destinations, bike, colliders, city = null, screen, settleRadius = STREAM.lod0Radius, isCameraClear = null, rig = null, settle = null,
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
        const cityOk = city ? await city.whenSettled(d.x, d.z, settleRadius) : true;
        const extraOk = settle ? await settle(d.x, d.z) : true; // M7: distrik + region hero
        const settled = cityOk && extraOk;
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
