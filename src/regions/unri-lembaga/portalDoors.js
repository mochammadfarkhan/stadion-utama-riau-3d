/**
 * Pintu-portal region Lembaga (kontrak indeks M4): titik pemicu region-lokal {lx, lz} 1 m di depan pintu
 * (di dalam selasar), yaw = arah hadap orang yang KELUAR dari pintu (konvensi entitas: maju = (sin, cos)).
 * Region mengembalikan daftar ini sebagai field `portals`; src/app/interiorPortal.js + portalTrigger.js
 * membacanya. Interior 'sekre' = stub kotak abu di M4, penuh di M5.
 */
import { fromSekre, SEKRE_FRAME, UNRI_LEMBAGA_ID } from './placement.js';
import { roomInfo, SEKRE_DIM } from './layout.js';
import { PLAYER_ROOM_INDEX } from './sekre.data.js';

/** Jarak titik pemicu dari muka pintu ke arah selasar (m). */
export const PORTAL_STEP_IN = 1.0;
export const PORTAL_RADIUS = 1.6;

function sekreDoor(id, interiorId, roomIndex, prompt) {
  const r = roomInfo(roomIndex);
  const p = fromSekre(r.side * (SEKRE_DIM.corridorHalf - PORTAL_STEP_IN), r.doorZ);
  return Object.freeze({
    id, interiorId, roomIndex, prompt, radius: PORTAL_RADIUS,
    pos: Object.freeze({ lx: p.x, lz: p.z }),
    yaw: r.outYaw + SEKRE_FRAME.yaw,
  });
}

export const PORTAL_DOORS = Object.freeze([sekreDoor('sekre-pemain', 'sekre', PLAYER_ROOM_INDEX, 'Masuk sekre')]);

/** `exitTo` interior sekre (spec §4.8): depan pintu, region-lokal, yaw keluar. */
export function sekreExitTo(door = PORTAL_DOORS[0]) {
  return Object.freeze({ region: UNRI_LEMBAGA_ID, x: door.pos.lx, z: door.pos.lz, yaw: door.yaw });
}
