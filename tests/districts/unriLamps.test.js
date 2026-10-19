import { describe, it, expect } from 'vitest';
import { lampHeads } from '../../src/districts/unri/lamps.js';
import { PJU_KAMPUS, pjuKampusParts } from '../../src/world/props/unri/pjuKampus.js';
import { LAMP_POST } from '../../src/world/props/LampPost.js';

describe('P03 PJU kampus', () => {
  it('kepala lampu setinggi LAMP_HEIGHT TimeOfDay (halo/PointLight tepat di kepala)', () => {
    expect(PJU_KAMPUS.headY).toBeCloseTo(LAMP_POST.height - LAMP_POST.armDrop, 9);
  });

  it('posisi kepala = tiang + lengan ke arah yaw (konvensi atan2(dx, dz))', () => {
    const [a, b] = lampHeads([{ x: 10, z: 20, yaw: 0 }, { x: 0, z: 0, yaw: Math.PI / 2 }]);
    expect(a.x).toBeCloseTo(10, 9);
    expect(a.z).toBeCloseTo(20 + PJU_KAMPUS.armReach, 9);
    expect(b.x).toBeCloseTo(PJU_KAMPUS.armReach, 9);
    expect(b.z).toBeCloseTo(0, 9);
  });

  it('dua part (struktur + lampu emisif bertanda malam) → ≤ 2 draw call per chunk', () => {
    const parts = pjuKampusParts();
    expect(parts).toHaveLength(2);
    expect(parts[1].material.userData.nightEmissive).toEqual({ on: 6, off: 0 });
  });
});
