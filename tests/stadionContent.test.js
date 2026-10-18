/**
 * Konten region stadion selaras dengan mask (Plan C, I4): semua posisi handmade berada di dalam mask
 * region (di luar mask berlaku TileCollider + fitur OSM), dan titik yang harus dilalui pemain walkable.
 */
import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/regions/stadion/layout.js';
import { SITE } from '../src/regions/stadion/site.js';
import { STADION_MASK, withNorthCorridor, NORTH_CORRIDOR } from '../src/regions/stadion/mask.js';
import { stadionColliders } from '../src/regions/stadion/collider.js';
import { STORY_NPCS } from '../src/story/chapters.js';
import { EASTER_EGGS } from '../src/story/easterEggs.js';
import { pointInPolygon, convexHull, signedArea } from '../src/geo/polygon.js';

const inside = (p) => pointInPolygon(p.x, p.z, STADION_MASK);
/** Sudut persegi diinset 0,5 m (sudut parkir = titik hull di tepi mask; titik tepi tidak dijamin pointInPolygon). */
const rectCorners = ({ x, z, w, d }) => {
  const hx = w / 2 - 0.5;
  const hz = d / 2 - 0.5;
  return [{ x: x - hx, z: z - hz }, { x: x + hx, z: z - hz }, { x: x + hx, z: z + hz }, { x: x - hx, z: z + hz }];
};
/** NPC & telur kampus (M7) hidup di region/distrik lain: NPC ber-`zone`, telur ber-`at.region` (mis. 'world'). */
const stadionNpcs = STORY_NPCS.filter((n) => !n.zone);
const stadionEggs = EASTER_EGGS.filter((e) => e.at && !e.at.region);
/** Telur yang sengaja di luar mask (di kota): id → alasan. */
const CITY_EGGS = Object.freeze({ 'jejak-3': 'Venue Baseball OSM (way 535214902)' });

describe('konten region stadion di dalam mask', () => {
  it('semua props & titik aktivitas LAYOUT di dalam mask', () => {
    const groups = {
      benches: LAYOUT.benches, trashBins: LAYOUT.trashBins, planters: LAYOUT.planters,
      plazaLamps: LAYOUT.plazaLamps, ringRoadLamps: LAYOUT.ringRoadLamps, guardPosts: LAYOUT.guardPosts,
      roadSigns: LAYOUT.roadSigns, banners: LAYOUT.banners, billboards: LAYOUT.billboards,
      blenderModels: LAYOUT.blenderModels, vendors: LAYOUT.vendors.flatMap((v) => v.waypoints),
      plaza: [LAYOUT.plazaCenter, LAYOUT.plazaSpots.exercise, LAYOUT.plazaSpots.badminton, LAYOUT.spawn],
    };
    const outside = Object.entries(groups).flatMap(([name, list]) => list.filter((p) => !inside(p)).map((p) => [name, p.x, p.z]));
    expect(outside).toEqual([]);
  });

  it('tugu, tanjak, gapura (±14 m), parkir, dan jalur pejalan keliling di dalam mask', () => {
    const pts = [
      SITE.tugu, SITE.tanjakMonument, { x: -14, z: SITE.gapuraZ }, { x: 14, z: SITE.gapuraZ },
      ...rectCorners(SITE.parkingCar), ...rectCorners(SITE.parkingMoto),
      ...LAYOUT.loopWalkers.flatMap((w) => [{ x: w.semiX, z: 0 }, { x: 0, z: -w.semiZ }, { x: -w.semiX, z: 0 }, { x: 0, z: w.semiZ }]),
    ];
    expect(pts.filter((p) => !inside(p))).toEqual([]);
  });

  it('NPC cerita & telur jarak di dalam mask, kecuali yang sengaja di kota', () => {
    expect(stadionNpcs.filter((n) => !inside(n)).map((n) => n.id)).toEqual([]);
    const out = stadionEggs.filter((e) => !inside(e.at)).map((e) => e.id);
    expect(out).toEqual(Object.keys(CITY_EGGS));
  });

  it('telur jejak-2 (antara dua danau OSM) berada di koridor utara mask, termasuk seluruh radius pemicunya', () => {
    const { at } = EASTER_EGGS.find((e) => e.id === 'jejak-2');
    const c = NORTH_CORRIDOR;
    expect(inside(at)).toBe(true);
    // di leher koridor: utara tepi parkir mobil (di luar hull lama) dan di antara tepi kedua danau
    expect(at.z).toBeLessThan(SITE.parkingCar.z - SITE.parkingCar.d / 2);
    expect(at.z).toBeGreaterThan(c.zNeck);
    expect(at.x).toBeGreaterThan(c.xWest);
    expect(at.x).toBeLessThan(c.xEast);
    // titik sejauh radius pemicu ke empat arah tetap di dalam mask (tidak menjangkau danau OSM)
    const rim = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dz]) => ({ x: at.x + dx * at.radius, z: at.z + dz * at.radius }));
    expect(rim.filter((p) => !inside(p))).toEqual([]);
    expect(stadionColliders.isWalkable(at.x, at.z)).toBe(true);
  });

  it('titik yang dilalui pemain walkable (collider region): spawn, waypoint pedagang, NPC, telur di mask', () => {
    const pts = [
      LAYOUT.spawn, ...LAYOUT.vendors.flatMap((v) => v.waypoints),
      ...stadionNpcs.map((n) => ({ x: n.x + 3, z: n.z })),
      ...stadionEggs.filter((e) => !CITY_EGGS[e.id]).map((e) => e.at),
    ];
    expect(pts.filter((p) => !stadionColliders.isWalkable(p.x, p.z))).toEqual([]);
  });
});

describe('mask: koridor sumbu utara', () => {
  it('disisipkan ke rantai utara hull: poligon tetap berorientasi positif, memuat leher & ujung koridor', () => {
    expect(signedArea(STADION_MASK)).toBeGreaterThan(0);
    const c = NORTH_CORRIDOR;
    expect(pointInPolygon(0, (c.zNeck + c.zTip) / 2, STADION_MASK)).toBe(true);
    expect(pointInPolygon(c.xWest - 1, -390, STADION_MASK)).toBe(false); // danau OSM barat
    expect(pointInPolygon(c.xEast + 1, -390, STADION_MASK)).toBe(false); // danau OSM timur
    expect(pointInPolygon(0, c.zTip - 1, STADION_MASK)).toBe(false);
  });

  it('hull dengan titik di leher: titik itu diganti jalur koridor', () => {
    const hull = convexHull([[-100, -50], [0, -60], [100, -50], [100, 50], [-100, 50]]);
    const out = withNorthCorridor(hull, { xWest: -10, xEast: 10, zNeck: -80, xWideWest: -20, xWideEast: 20, zTip: -100 });
    expect(out.some(([x, z]) => x === 0 && z === -60)).toBe(false);
    expect(pointInPolygon(0, -90, out)).toBe(true);
    expect(pointInPolygon(15, -70, out)).toBe(false);
    expect(() => withNorthCorridor(hull, { ...NORTH_CORRIDOR, xWest: -500 })).toThrow(RangeError);
  });
});
