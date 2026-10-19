import { describe, it, expect } from 'vitest';
import { UKM_CLEAR_BOXES, UKM_ROADS, plantable, ukmPlantPoints } from '../../src/regions/unri-lembaga/ukmVegetation.js';
import { UKM_ROOF, YARD_BOX, ukmToWorld } from '../../src/regions/unri-lembaga/sekreUkm.data.js';
import { ROAD_LAYOUT, ROAD_SPEC, ROAD_SURFACES } from '../../src/regions/unri-lembaga/ukmRoads.data.js';
import { regionToWorld } from '../../src/regions/unri-lembaga/placement.js';
import { UKM_LAYOUT } from '../../src/regions/unri-lembaga/ukmLayout.js';
import { lembagaColliders } from '../../src/regions/unri-lembaga/collider.js';
import { moundPoints, trashPoints } from '../../src/regions/unri-lembaga/ukmGroundDetail.js';
import { polylineLength, polylineOffset, polylineSteps } from '../../src/regions/unri-lembaga/generators.js';
import { pointInPolygon, distanceToRing } from '../../src/geo/polygon.js';

const roof = UKM_ROOF.map(([x, z]) => {
  const w = ukmToWorld(x, z);
  return [w.x, w.z];
});
const world = (p) => {
  const w = regionToWorld(p.x, p.z);
  return { ...p, x: w.x, z: w.z };
};
const inBox = (b, x, z) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
const roadDistance = (x, z) => Math.min(...UKM_ROADS.flatMap((r) => r.slice(0, -1).map((a, i) => {
  const b = r[i + 1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
  return Math.hypot(x - (a[0] + (b[0] - a[0]) * t), z - (a[1] + (b[1] - a[1]) * t));
})));

describe('titik tanam pohon area UKM', () => {
  const points = ukmPlantPoints().map(world);

  it('menghasilkan >200 titik dengan spesies GLB yang dikenal', () => {
    expect(points.length).toBeGreaterThan(200);
    expect(new Set(points.map((p) => p.sp))).toEqual(new Set(['v11', 'v12', 'v13', 'v14']));
  });

  it('tidak menembus gedung, halaman, kompleks lapangan, lapangan memanah, atau badan jalan', () => {
    for (const p of points) {
      expect(UKM_CLEAR_BOXES.some((b) => inBox(b, p.x, p.z))).toBe(false);
      expect(pointInPolygon(p.x, p.z, roof)).toBe(false);
      expect(distanceToRing(p.x, p.z, roof)).toBeGreaterThan(3);
      expect(roadDistance(p.x, p.z)).toBeGreaterThan(ROAD_SPEC.width / 2 + 0.5);
    }
  });

  it('plantable menolak titik di halaman dan di sumbu jalan', () => {
    expect(plantable(-100, 1005)).toBe(false);
    expect(plantable(-138, 998.3)).toBe(false);
    expect(plantable(-70, 1020)).toBe(true);
  });

  it('gundukan dan sampah hanya di tempat boleh ditanami; sampah 8-15+ buah', () => {
    for (const [x, z] of [...moundPoints(plantable), ...trashPoints(plantable)]) expect(plantable(x, z)).toBe(true);
    expect(trashPoints(plantable).length).toBeGreaterThanOrEqual(8);
  });
});

describe('jalan, parit, tiang, PJU area UKM', () => {
  const yard = { minX: YARD_BOX.minX, maxX: YARD_BOX.maxX, minZ: YARD_BOX.minZ, maxZ: YARD_BOX.maxZ };
  const outsideBuilding = (p) => !pointInPolygon(p.x, p.z, roof.map(([x, z]) => [x, z])) && distanceToRing(p.x, p.z, roof) > 1;
  const at = (arr) => arr.map((p) => world({ x: p[0] ?? p.x, z: p[1] ?? p.z }));

  it('polylineOffset menjaga jarak sejajar dan polylineSteps berjarak tetap', () => {
    const line = [[0, 0], [0, 10], [10, 10]];
    const off = polylineOffset(line, 2);
    expect(off[0][0]).toBeCloseTo(2);
    expect(off[0][1]).toBeCloseTo(0);
    const steps = polylineSteps(line, 4, { start: 0 });
    expect(steps.map((s) => s.s)).toEqual([0, 4, 8, 12, 16, 20]);
    expect(polylineLength(line)).toBeCloseTo(20);
  });

  it('jalur beton, parit, tiang, dan PJU tidak memotong gedung maupun halaman', () => {
    const all = [
      ...ROAD_SURFACES.flatMap((l) => at(l)),
      ...at(ROAD_LAYOUT.ditch), ...at(ROAD_LAYOUT.caps), ...at(ROAD_LAYOUT.poles), ...at(ROAD_LAYOUT.pju),
    ];
    for (const p of all) {
      expect(outsideBuilding(p)).toBe(true);
      expect(inBox(yard, p.x, p.z)).toBe(false);
    }
  });

  it('parit sejajar tepi jalan dengan 4 tiang listrik dan 4 PJU', () => {
    expect(ROAD_LAYOUT.poles).toHaveLength(4);
    expect(ROAD_LAYOUT.pju).toHaveLength(4);
    expect(ROAD_LAYOUT.caps.length).toBeGreaterThanOrEqual(5);
    // jarak ke sumbu ≈ tepi jalan + celah + setengah lebar parit
    for (const p of at(ROAD_LAYOUT.ditch)) {
      expect(roadDistance(p.x, p.z)).toBeGreaterThan(ROAD_SPEC.width / 2);
      expect(roadDistance(p.x, p.z)).toBeLessThan(ROAD_SPEC.width / 2 + ROAD_SPEC.ditch.gap + 1);
    }
  });

  it('collider menghalangi tiang listrik dan PJU tetapi badan jalan tetap bisa dilalui', () => {
    for (const o of ROAD_LAYOUT.obstacles) expect(lembagaColliders.isWalkable(o.x, o.z)).toBe(false);
    const mid = ROAD_SURFACES[0][2];
    expect(lembagaColliders.isWalkable(mid[0], mid[1])).toBe(true);
    expect(UKM_LAYOUT.yard).toBeTruthy();
  });
});
