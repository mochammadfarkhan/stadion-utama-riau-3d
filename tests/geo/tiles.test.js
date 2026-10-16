import { describe, it, expect } from 'vitest';
import {
  TILE_SIZE, tileKey, parseTileKey, tileOf, tileCenter, tileBounds, tilesInRect, tilesInRadius,
} from '../../src/geo/tiles.js';

describe('tiles', () => {
  it('TILE_SIZE = 500', () => {
    expect(TILE_SIZE).toBe(500);
  });

  it('tileOf memakai floor (negatif ikut turun)', () => {
    expect(tileOf(0, 0)).toEqual({ ix: 0, iz: 0 });
    expect(tileOf(499.9, 500)).toEqual({ ix: 0, iz: 1 });
    expect(tileOf(-0.1, -500)).toEqual({ ix: -1, iz: -1 });
    expect(tileOf(-500.1, 1250)).toEqual({ ix: -2, iz: 2 });
  });

  it('tileCenter & tileBounds', () => {
    expect(tileCenter(0, 0)).toEqual({ x: 250, z: 250 });
    expect(tileCenter(-1, -2)).toEqual({ x: -250, z: -750 });
    expect(tileBounds(-1, 0)).toEqual({ minX: -500, minZ: 0, maxX: 0, maxZ: 500 });
  });

  it('tileKey ↔ parseTileKey', () => {
    expect(tileKey(-1, 3)).toBe('-1_3');
    expect(parseTileKey('-1_3')).toEqual({ ix: -1, iz: 3 });
    expect(parseTileKey('a_b')).toBeNull();
  });

  it('tilesInRect: maks eksklusif pada garis grid', () => {
    const t = tilesInRect({ minX: -1500, minZ: -1500, maxX: 1500, maxZ: 1500 });
    expect(t).toHaveLength(36);
    expect(t[0]).toEqual({ ix: -3, iz: -3, key: '-3_-3' });
    expect(t[35]).toEqual({ ix: 2, iz: 2, key: '2_2' });
    expect(tilesInRect({ minX: 10, minZ: 10, maxX: 20, maxZ: 20 })).toEqual([{ ix: 0, iz: 0, key: '0_0' }]);
  });

  it('tilesInRadius: urut jarak ke pusat tile, hanya yang beririsan lingkaran', () => {
    const t = tilesInRadius(250, 250, 300);
    expect(t[0]).toMatchObject({ key: '0_0', dist: 0 });
    expect(t.map((v) => v.key).slice(1, 5).sort()).toEqual(['-1_0', '0_-1', '0_1', '1_0']);
    expect(t.map((v) => v.key)).not.toContain('1_1'); // sudut terdekat berjarak √2·250 ≈ 354 > 300
    for (let i = 1; i < t.length; i += 1) expect(t[i].dist).toBeGreaterThanOrEqual(t[i - 1].dist);
  });

  it('tilesInRadius: radius 1000 m dari origin memuat 16 tile terdekat lebih dulu', () => {
    const t = tilesInRadius(0, 0, 1000);
    expect(t.slice(0, 4).map((v) => v.key).sort()).toEqual(['-1_-1', '-1_0', '0_-1', '0_0']);
    expect(t.every((v) => v.dist <= 1000 + 250 * Math.SQRT2)).toBe(true);
  });
});
