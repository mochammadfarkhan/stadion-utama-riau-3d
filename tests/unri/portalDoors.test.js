import { describe, it, expect } from 'vitest';
import { PORTAL_DOORS, sekreExitTo, PORTAL_STEP_OUT } from '../../src/regions/unri-lembaga/portalDoors.js';
import { UKM_DOORS, PLAYER_DOOR_ID, fromUkm } from '../../src/regions/unri-lembaga/sekreUkm.data.js';

describe('PORTAL_DOORS (pintu pemain = D5 gedung UKM blok biru, ERC)', () => {
  it('satu pintu sekre-pemain → interior sekre, radius 1,6, prompt ERC', () => {
    expect(PORTAL_DOORS).toHaveLength(1);
    const [d] = PORTAL_DOORS;
    expect(d).toMatchObject({ id: 'sekre-pemain', interiorId: 'sekre', radius: 1.6, prompt: 'Masuk sekre ERC' });
  });

  it('titik pemicu 1 m di depan pintu D5 (ke arah halaman, barat); yaw keluar menghadap barat', () => {
    const [d] = PORTAL_DOORS;
    const door = UKM_DOORS.find((v) => v.id === PLAYER_DOOR_ID);
    const p = fromUkm(door.x + door.normal[0] * PORTAL_STEP_OUT, door.z + door.normal[1] * PORTAL_STEP_OUT);
    expect(d.pos.lx).toBeCloseTo(p.x, 6);
    expect(d.pos.lz).toBeCloseTo(p.z, 6);
    const f = fromUkm(door.x, door.z);
    expect(Math.hypot(d.pos.lx - f.x, d.pos.lz - f.z)).toBeCloseTo(1, 6);
    expect(d.yaw).toBeCloseTo(-Math.PI / 2, 6); // konvensi entitas: maju = (sin yaw, cos yaw) → (−1, 0)
  });

  it('sekreExitTo = depan pintu, yaw keluar, region unri-lembaga', () => {
    expect(sekreExitTo()).toEqual({ region: 'unri-lembaga', x: PORTAL_DOORS[0].pos.lx, z: PORTAL_DOORS[0].pos.lz, yaw: PORTAL_DOORS[0].yaw });
  });
});
