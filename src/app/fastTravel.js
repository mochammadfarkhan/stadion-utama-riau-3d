/**
 * Perjalanan cepat (Fase 3): daftar tujuan (Stadion, Masjid Raya An-Nur) dan teleport yang
 * menunggu streamer kota memuat tile tujuan sebelum layar perjalanan ditutup.
 */
import { createCollider } from '../core/Collider.js';
import { STREAM } from '../city/ChunkStreamer.js';

/** Area manifest untuk An-Nur (tools/citybake/config.js AREAS.pusat; pusat area = node OSM masjid). */
export const ANNUR_AREA_ID = 'pusat';

/**
 * Tujuan perjalanan cepat (frame dunia). An-Nur hanya bila manifest memuat area "pusat".
 * @param {{manifest?: {areas?: Array<{id:string, bounds:{minX:number,minZ:number,maxX:number,maxZ:number}}>}|null,
 *   frame: {toWorld(x:number,z:number):{x:number,z:number}, yawToWorld(y:number):number}, spawn: {x:number,z:number,yaw:number}}} opts
 * @returns {Array<{id:string, label:string, x:number, z:number, yaw:number}>}
 */
export function travelDestinations({ manifest = null, frame, spawn }) {
  const s = frame.toWorld(spawn.x, spawn.z);
  const out = [{ id: 'stadion', label: 'Stadion Utama Riau', x: s.x, z: s.z, yaw: frame.yawToWorld(spawn.yaw) }];
  const area = manifest?.areas?.find((a) => a.id === ANNUR_AREA_ID);
  if (area) {
    const b = area.bounds;
    out.push({ id: 'annur', label: 'Masjid Raya An-Nur', x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, yaw: 0 });
  }
  return out;
}

/**
 * Titik walkable terdekat di sekitar (x, z): pusat dulu, lalu cincin 8 arah berjarak `step` m sampai
 * `maxRadius`. null bila tidak ada (mis. tile belum dimuat semua terhalang).
 */
export function findWalkableNear(x, z, isWalkable, { step = 4, maxRadius = 200, directions = 16 } = {}) {
  if (isWalkable(x, z)) return { x, z };
  for (let r = step; r <= maxRadius; r += step) {
    for (let i = 0; i < directions; i += 1) {
      const a = (i / directions) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (isWalkable(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

/**
 * @param {{destinations: ReturnType<typeof travelDestinations>, bike: {state: object, setCollider(c: Function): void},
 *   colliders: {isWalkable(x:number, z:number): boolean, penetration?(x:number, z:number): number}, city?: {whenSettled(x:number, z:number, r?:number): Promise<boolean>}|null,
 *   screen: {show(text:string): void, hide(): void}, settleRadius?: number}} opts
 */
export function createFastTravel({ destinations, bike, colliders, city = null, screen, settleRadius = STREAM.lod0Radius }) {
  let busy = false;
  const place = (x, z, yaw) => {
    bike.state = { ...bike.state, x, z, yaw, v: 0 };
    bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
  };
  return {
    destinations,
    get busy() { return busy; },
    /** @returns {Promise<boolean>} true bila tile tujuan selesai dimuat sebelum batas waktu */
    async go(id) {
      const d = destinations.find((v) => v.id === id);
      if (!d || busy) return false;
      busy = true;
      screen.show(`Menuju ${d.label}…`);
      try {
        place(d.x, d.z, d.yaw); // fokus streamer pindah ke tujuan
        const settled = city ? await city.whenSettled(d.x, d.z, settleRadius) : true;
        const spot = findWalkableNear(d.x, d.z, colliders.isWalkable) ?? d;
        place(spot.x, spot.z, d.yaw); // collider tile sudah ada: muncul di titik yang bisa dilalui
        return settled;
      } finally {
        screen.hide();
        busy = false;
      }
    },
  };
}
