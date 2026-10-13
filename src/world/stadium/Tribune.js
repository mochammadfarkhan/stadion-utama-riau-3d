/**
 * Tribun beton 2 tier mengelilingi oval + kursi instanced per sektor,
 * VIP box barat, railing, tangga vomitory, dinding belakang.
 * Lihat Tribune.layout.js (tata letak), Tribune.concrete.js, Tribune.seats.js, Tribune.extras.js.
 */
import * as THREE from 'three';
import { createTierLayout, createSectorInfo, SECTOR_COUNT } from './Tribune.layout.js';
import { createTribuneConcrete } from './Tribune.concrete.js';
import { createTribuneSeats, SEAT_PITCH, DEFAULT_PALETTE } from './Tribune.seats.js';
import { createVomitoryStairs, createRailings, createVipBox } from './Tribune.extras.js';

/**
 * Bangun tribun lengkap.
 * @param {{seed?: number, seatPitch?: number, palette?: number[]}} opts
 * @returns {THREE.Group} group dengan userData: { sectors, tiers, seatCount, vipSeatCount, seatsPerSector }
 */
export function createTribune(opts = {}) {
  const layout = createTierLayout();
  const sectors = createSectorInfo();
  const seats = createTribuneSeats(layout, sectors, {
    seed: opts.seed, seatPitch: opts.seatPitch ?? SEAT_PITCH, palette: opts.palette ?? DEFAULT_PALETTE,
  });
  const group = new THREE.Group();
  group.name = 'tribune';
  group.add(
    createTribuneConcrete(layout), createVomitoryStairs(layout), createRailings(layout),
    createVipBox(layout), seats.group,
  );
  group.userData.sectors = sectors;
  group.userData.sectorCount = SECTOR_COUNT;
  group.userData.tiers = layout.tiers;
  group.userData.concourseY = layout.concourseY;
  group.userData.seatCount = seats.total;
  group.userData.vipSeatCount = seats.vip;
  group.userData.seatsPerSector = seats.perSector;
  return group;
}
