import { describe, it, expect } from 'vitest';
import { createCollider } from '../src/core/Collider.js';
import { isWalkable, OBSTACLES } from '../src/regions/stadion/collider.js';

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
    const collide = createCollider(start, isWalkable);
    expect(collide(start.x, start.z)).toEqual(start);
    expect(collide(tugu.x, tugu.z - tugu.r + 1)).toEqual(start);
  });
});

describe('collider: tidak terkunci bila tanah di bawah sepeda menjadi terhalang (Plan C)', () => {
  it('posisi terakhir kini tidak walkable (tile baru dimuat) → gerakan berikut dibebaskan', () => {
    let blocked = false;
    const collide = createCollider({ x: 0, z: 0 }, (x) => !(blocked && x < 5));
    expect(collide(1, 0)).toEqual({ x: 1, z: 0 });
    blocked = true; // bangunan muncul di bawah sepeda
    expect(collide(2, 0)).toEqual({ x: 2, z: 0 });
    expect(collide(6, 0)).toEqual({ x: 6, z: 0 });
    expect(collide(4, 0)).toEqual({ x: 6, z: 0 }); // sudah keluar: tabrakan normal lagi
  });
});
