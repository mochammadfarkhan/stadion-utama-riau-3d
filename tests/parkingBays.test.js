/**
 * Slot parkir tidak boleh bertumpuk dengan jalan penghubung sumbu utara (gapura → jalan lingkar):
 * mobil parkir dulu berdiri di aspal penghubung sekitar (0/2,5, −352,5).
 */
import { describe, it, expect } from 'vitest';
import { SITE } from '../src/config/constants.js';
import { parkingBays, createParkingLot, CONNECTOR_WIDTH, PARKING } from '../src/world/Ground.roads.js';

/** Setengah lebar pita terlarang: setengah jalan penghubung + setengah lebar bay (badan mobil). */
const BAND_HALF = CONNECTOR_WIDTH / 2 + PARKING.carBayW / 2;
const inConnectorBand = (b) => SITE.connectorXs.some((cx) => Math.abs(b.x - cx) < BAND_HALF);

describe('slot parkir vs jalan penghubung sumbu utara', () => {
  it.each(['car', 'moto'])('%s: tidak ada slot di dalam pita jalan penghubung', (kind) => {
    const bays = parkingBays(kind);
    expect(bays.length).toBeGreaterThan(0);
    expect(bays.filter(inConnectorBand)).toEqual([]);
  });

  it('slot di sekitar (0/2,5, −352,5) hilang, slot di luar pita tetap ada', () => {
    const bays = parkingBays('car');
    expect(bays.some((b) => Math.abs(b.x) < 3 && Math.abs(b.z + 352.5) < 0.01)).toBe(false);
    expect(bays.some((b) => Math.abs(b.x - 10) < 0.01 && Math.abs(b.z + 352.5) < 0.01)).toBe(true);
    expect(bays.some((b) => Math.abs(b.x + 10) < 0.01 && Math.abs(b.z + 307.5) < 0.01)).toBe(true);
  });

  it('createParkingLot memakai slot yang sama (garis bay & mobil parkir ikut tersaring)', () => {
    expect(createParkingLot('car').userData.bays).toEqual(parkingBays('car'));
  });
});
