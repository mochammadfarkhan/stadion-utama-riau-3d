import { describe, it, expect } from 'vitest';
import { PORTAL_DOORS, sekreExitTo } from '../../src/regions/unri-lembaga/portalDoors.js';
import { fromSekre, toSekre } from '../../src/regions/unri-lembaga/placement.js';
import { SEKRE_DIM, roomInfo } from '../../src/regions/unri-lembaga/layout.js';

describe('PORTAL_DOORS (kontrak indeks M4)', () => {
  it('satu pintu sekre-pemain → interior sekre, radius 1,6, prompt', () => {
    expect(PORTAL_DOORS).toHaveLength(1);
    const [d] = PORTAL_DOORS;
    expect(d).toMatchObject({ id: 'sekre-pemain', interiorId: 'sekre', radius: 1.6, prompt: 'Masuk sekre' });
    expect(d.pos.lx).toBeCloseTo(-2.7875, 3);
    expect(d.pos.lz).toBeCloseTo(-1.8632, 3);
    expect(d.yaw).toBeCloseTo(-0.33248, 4);
  });

  it('1 m ke dalam selasar di depan pintu ruang 1, tepat satu ruang dari pintu BEM', () => {
    const [d] = PORTAL_DOORS;
    const b = toSekre(d.pos.lx, d.pos.lz);
    expect(b.x).toBeCloseTo(0.85, 6);
    const bem = roomInfo(0);
    const bemFront = fromSekre(0.85, bem.doorZ);
    expect(Math.hypot(d.pos.lx - bemFront.x, d.pos.lz - bemFront.z)).toBeCloseTo(SEKRE_DIM.roomLen, 6);
  });

  it('sekreExitTo = depan pintu, yaw keluar, region unri-lembaga', () => {
    expect(sekreExitTo()).toEqual({ region: 'unri-lembaga', x: PORTAL_DOORS[0].pos.lx, z: PORTAL_DOORS[0].pos.lz, yaw: PORTAL_DOORS[0].yaw });
  });
});
