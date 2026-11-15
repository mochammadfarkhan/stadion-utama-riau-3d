/**
 * Pintu-portal region Lembaga (kontrak indeks M4, dipindah ke gedung UKM blok biru): titik pemicu region-lokal
 * {lx, lz} 1 m di depan pintu D5 (ruang ERC, sisi barat sayap utara–selatan, menghadap halaman), yaw = arah hadap
 * orang yang KELUAR dari pintu (konvensi entitas: maju = (sin, cos)). Region mengembalikan daftar ini sebagai
 * field `portals`; src/app/interiorPortal.js + portalTrigger.js membacanya. Interior 'sekre' = ruang ERC (M5).
 */
import { UNRI_LEMBAGA_ID } from './placement.js';
import { UKM_DOORS, PLAYER_DOOR_ID, fromUkm } from './sekreUkm.data.js';

/** Jarak titik pemicu dari muka pintu ke arah halaman (m). */
export const PORTAL_STEP_OUT = 1.0;
export const PORTAL_RADIUS = 1.6;

/** Titik di depan pintu `d` sejauh `step` m dan yaw orang keluar. */
export function doorFront(d, step = PORTAL_STEP_OUT) {
  const p = fromUkm(d.x + d.normal[0] * step, d.z + d.normal[1] * step);
  return Object.freeze({ lx: p.x, lz: p.z, yaw: Math.atan2(d.normal[0], d.normal[1]) });
}

function ukmDoor(id, interiorId, prompt) {
  const d = UKM_DOORS.find((v) => v.id === id);
  const f = doorFront(d);
  return Object.freeze({
    id: 'sekre-pemain', interiorId, prompt, radius: PORTAL_RADIUS,
    pos: Object.freeze({ lx: f.lx, lz: f.lz }),
    yaw: f.yaw,
  });
}

export const PORTAL_DOORS = Object.freeze([ukmDoor(PLAYER_DOOR_ID, 'sekre', 'Masuk sekre ERC')]);

/** Jarak titik keluar dari muka pintu (m): di luar radius pemicu (1 + 1,6 + jarak aman 0,4), jadi keluar tidak langsung menawarkan masuk lagi. */
export const EXIT_STEP_OUT = PORTAL_STEP_OUT + PORTAL_RADIUS + 0.4; // 3 m: = titik mulai/tujuan perjalanan cepat

/** `exitTo` interior sekre (spec §4.8): depan pintu di luar radius pemicu, region-lokal, yaw keluar. */
export function sekreExitTo() {
  const f = doorFront(UKM_DOORS.find((v) => v.id === PLAYER_DOOR_ID), EXIT_STEP_OUT);
  return Object.freeze({ region: UNRI_LEMBAGA_ID, x: f.lx, z: f.lz, yaw: f.yaw });
}
