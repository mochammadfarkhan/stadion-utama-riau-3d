import { describe, it, expect } from 'vitest';
import { isWalkable, createCollider, OBSTACLES } from '../src/core/Collider.js';

describe('collider', () => {
  it('tugu Lancang Kuning & tugu tanjak tidak bisa ditembus', () => {
    for (const o of OBSTACLES) {
      expect(isWalkable(o.x, o.z)).toBe(false);
      expect(isWalkable(o.x + o.r + 0.5, o.z)).toBe(true);
    }
  });
  it('lapangan, plaza, dan koridor gate utara tetap bisa dilalui', () => {
    expect(isWalkable(0, 0)).toBe(true);
    expect(isWalkable(40, -190)).toBe(true);
    expect(isWalkable(0, -150)).toBe(true);
  });
  it('collider mengembalikan posisi valid terakhir saat menabrak tugu', () => {
    const tugu = OBSTACLES[0];
    const start = { x: tugu.x, z: tugu.z - tugu.r - 1 };
    const collide = createCollider(start);
    expect(collide(start.x, start.z)).toEqual(start);
    expect(collide(tugu.x, tugu.z - tugu.r + 1)).toEqual(start);
  });
});
