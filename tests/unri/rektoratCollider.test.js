// tests/unri/rektoratCollider.test.js
import { describe, it, expect } from 'vitest';
import { rektoratColliders, createRektoratColliders } from '../../src/regions/unri-rektorat/collider.js';

const { isWalkable, isCameraClear } = rektoratColliders;

describe('collider unri-rektorat (region-lokal)', () => {
  it.each([
    ['jalan setapak poros', 150, 4.2],
    ['parkir depan', 60, -25],
    ['jalan drop-off', 26.7, 20],
    ['drop-off di bawah kanopi', 24.5, 0],
    ['trotoar selatan danau', 200, 75],
    ['taman bundaran', 288.5, 19],
    ['jalan antara Rektorat & perpustakaan', -60, -38],
  ])('%s dapat dilalui', (_n, x, z) => expect(isWalkable(x, z)).toBe(true));

  it.each([
    ['massa utama Rektorat', 0, 0],
    ['blok tengah', 14, 0],
    ['teras lobi bertangga', 20, 0],
    ['perpustakaan', -100, -60],
    ['Danau Buatan', 230, 30],
    ['tiang kanopi', 25.6, 3.7],
    ['tiang bendera', 52.8, 0],
    ['lampu taman depan', 23.4, 9.2],
    ['papan batu N01', 285.5, 10],
    ['NaN', Number.NaN, 0],
  ])('%s tidak dapat dilalui', (_n, x, z) => expect(isWalkable(x, z)).toBe(false));

  it('kamera: tidak menembus gedung, boleh di atas air/teras', () => {
    expect(isCameraClear(0, 0)).toBe(false);
    expect(isCameraClear(-100, -60)).toBe(false);
    expect(isCameraClear(230, 30)).toBe(true);
    expect(isCameraClear(150, 4)).toBe(true);
    expect(isCameraClear(20, 0)).toBe(true);
    expect(isCameraClear(Number.NaN, 0)).toBe(false);
  });

  it('pabrik deterministik: dua instans sepakat', () => {
    const a = createRektoratColliders();
    expect(a.isWalkable(150, 4.2)).toBe(rektoratColliders.isWalkable(150, 4.2));
    expect(a.posts).toHaveLength(11); // 4 tiang kanopi + 1 bendera + 6 lampu taman
  });
});
