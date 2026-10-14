import { describe, it, expect } from 'vitest';
import { isGrassSpot } from '../src/world/Grass.placement.js';
import { SITE, STADIUM } from '../src/config/constants.js';

describe('isGrassSpot', () => {
  it('pusat stadion & dalam cangkang bukan rumput', () => {
    expect(isGrassSpot(0, 0)).toBe(false);
    expect(isGrassSpot(0, STADIUM.outerSemiZ + 2)).toBe(false);
  });
  it('plaza paving (0,-180) bukan rumput', () => {
    expect(isGrassSpot(0, -180)).toBe(false);
  });
  it('sabuk rumput utara (0,-250) adalah rumput', () => {
    expect(isGrassSpot(0, -250)).toBe(true);
  });
  it('danau dan parkir bukan rumput', () => {
    expect(isGrassSpot(SITE.lakeCenter.x, SITE.lakeCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.parkingCar.x, SITE.parkingCar.z)).toBe(false);
    expect(isGrassSpot(SITE.parkingMoto.x, SITE.parkingMoto.z)).toBe(false);
  });
  it('jalan lingkar, Naga Sakti, dan penghubung bukan rumput', () => {
    expect(isGrassSpot(0, -SITE.ringRoadSemiZ)).toBe(false);
    expect(isGrassSpot(SITE.ringRoadSemiX, 0)).toBe(false);
    expect(isGrassSpot(0, SITE.nagaSaktiZ)).toBe(false);
    expect(isGrassSpot(0, -345)).toBe(false);
    expect(isGrassSpot(140, -360)).toBe(false);
  });
  it('fasilitas lain bukan rumput; lapangan terbuka jauh adalah rumput', () => {
    expect(isGrassSpot(SITE.helipadCenter.x, SITE.helipadCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.amphitheaterCenter.x, SITE.amphitheaterCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.skateCenter.x, SITE.skateCenter.z)).toBe(false);
    expect(isGrassSpot(SITE.riverX, 50)).toBe(false);
    expect(isGrassSpot(-500, 100)).toBe(true);
    expect(isGrassSpot(100, 500)).toBe(true);
  });
  it('input tidak valid / di luar dunia → false', () => {
    expect(isGrassSpot(NaN, 0)).toBe(false);
    expect(isGrassSpot(5000, 0)).toBe(false);
  });
});
