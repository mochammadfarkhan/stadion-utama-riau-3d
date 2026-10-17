import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTileCollider } from '../../src/city/TileCollider.js';
import { decodeTileData } from '../../src/city/tileData.js';
import { createCollider, createCompositeCollider, localized } from '../../src/core/Collider.js';
import { stadionRegion } from '../../src/regions/stadion/index.js';
import { stadionColliders } from '../../src/regions/stadion/collider.js';

const square = (x0, z0, s) => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]];
const tile = (over = {}) => ({ key: '0_0', buildings: [], water: [], waterways: [], roads: [], ...over });

describe('TileCollider', () => {
  it('bangunan memblok di dalam & < 0,6 m dari dinding; terbuka di luar', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(10, 10, 10) }] }));
    expect(c.isWalkable(15, 15)).toBe(false);
    expect(c.isWalkable(9.6, 15)).toBe(false);
    expect(c.isWalkable(9.3, 15)).toBe(true);
    expect(c.isWalkable(40, 40)).toBe(true);
    expect(c.isCameraClear(9.3, 15)).toBe(false); // jarak bebas kamera 0,8 m
    expect(c.isCameraClear(9, 15)).toBe(true);
  });

  it('bangunan yang melintasi batas sel 25 m tetap terdeteksi di semua sel', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(20, 20, 40) }] }));
    for (const [x, z] of [[21, 21], [30, 30], [55, 55], [45, 26]]) expect(c.isWalkable(x, z)).toBe(false);
  });

  it('air memblok kecuali lubang dan jalan di atasnya (jembatan)', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({
      water: [{ outer: square(0, 0, 100), holes: [square(40, 40, 10)] }],
      roads: [{ cls: 'primary', width: 14, name: null, pts: [[-10, 80], [110, 80]] }],
    }));
    expect(c.isWalkable(20, 20)).toBe(false);
    expect(c.isWalkable(45, 45)).toBe(true);  // pulau
    expect(c.isWalkable(50, 85)).toBe(true);  // jembatan (≤ 7 m dari sumbu)
    expect(c.isWalkable(50, 88)).toBe(false);
    expect(c.isCameraClear(20, 20)).toBe(true); // kamera boleh di atas air
  });

  it('removeTile melepas semua bentuk tile itu saja; tile belum dimuat = terbuka', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(10, 10, 10) }] }));
    c.addTile('1_0', tile({ key: '1_0', buildings: [{ height: 6, ring: square(510, 10, 10) }] }));
    expect(c.tileCount).toBe(2);
    expect(c.removeTile('0_0')).toBe(true);
    expect(c.removeTile('0_0')).toBe(false);
    expect(c.isWalkable(15, 15)).toBe(true);
    expect(c.isWalkable(515, 15)).toBe(false);
    c.removeTile('1_0');
    expect(c.cellCount).toBe(0);
    expect(c.isWalkable(Number.NaN, 0)).toBe(false);
    expect(c.isCameraClear(0, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('data tile nyata: footprint bangunan pertama di tile 12_-10 memblok, pusat jalan utama terbuka', () => {
    const d = JSON.parse(readFileSync('public/tiles/12_-10.data.json', 'utf8'));
    const t = decodeTileData(d);
    const c = createTileCollider();
    c.addTile(t.key, t);
    const ring = t.buildings[0].ring;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    expect(c.isWalkable(cx, cz)).toBe(false);
    const major = t.roads.find((r) => r.name);
    expect(c.isWalkable(major.pts[0][0], major.pts[0][1])).toBe(true);
  });

  it('collider komposit: di dalam mask → region; di luar → TileCollider', () => {
    const city = createTileCollider();
    city.addTile('1_-1', tile({ key: '1_-1', buildings: [{ height: 6, ring: square(600, -300, 20) }] }));
    const comp = createCompositeCollider({ regions: [{ region: stadionRegion, colliders: stadionColliders }], fallback: city });
    const tugu = stadionColliders.obstacles[0];
    expect(comp.isWalkable(tugu.x, tugu.z)).toBe(false); // region
    expect(comp.isWalkable(610, -290)).toBe(false);       // bangunan kota
    expect(comp.isWalkable(700, -290)).toBe(true);
    expect(localized(stadionRegion, stadionColliders).isWalkable(610, -290)).toBe(true); // dulu: tanah region menutup dunia
  });
});

describe('TileCollider: sel diagonal & bangunan lintas batas tile', () => {
  it('sel luar diagonal bangunan lintas sel tetap memblok; di luar bbox terbuka', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(20, 20, 40) }] }));
    expect(c.isWalkable(21, 55)).toBe(false);
    expect(c.isWalkable(55, 21)).toBe(false);
    expect(c.isWalkable(18, 62)).toBe(true);
  });

  it('bangunan yang menjorok melewati batas tile ke koordinat negatif terdeteksi di sel negatif', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(-30, -12, 40) }] }));
    for (const [x, z] of [[-29, -11], [-1, -1], [-26, 5], [9, 27]]) expect(c.isWalkable(x, z)).toBe(false);
    expect(c.isWalkable(-31, -13)).toBe(true);
    c.removeTile('0_0');
    expect(c.cellCount).toBe(0);
  });

  it('addTile ulang dengan kunci sama mengganti bentuk lama (tetap benar bila method dilepas dari objek)', () => {
    const c = createTileCollider();
    const { addTile } = c;
    addTile('0_0', tile({ buildings: [{ height: 6, ring: square(10, 10, 10) }] }));
    addTile('0_0', tile({ buildings: [{ height: 6, ring: square(60, 60, 10) }] }));
    expect(c.tileCount).toBe(1);
    expect(c.isWalkable(15, 15)).toBe(true);
    expect(c.isWalkable(65, 65)).toBe(false);
  });
});

describe('TileCollider.penetration', () => {
  it('jarak ke tepi terdekat di dalam bangunan/air; 0 di luar dan di jembatan', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({
      buildings: [{ height: 6, ring: square(200, 0, 100) }],
      water: [{ outer: square(0, 0, 100), holes: [square(40, 40, 10)] }],
      roads: [{ cls: 'primary', width: 14, name: null, pts: [[-10, 80], [110, 80]] }],
    }));
    expect(c.penetration(202, 50)).toBeGreaterThan(c.penetration(201, 50));
    expect(c.penetration(250, 50)).toBeGreaterThan(c.penetration(220, 50));
    expect(c.penetration(320, 50)).toBe(0);
    expect(c.penetration(20, 20)).toBeCloseTo(20, 9);
    expect(c.penetration(45, 45)).toBe(0); // pulau
    expect(c.penetration(50, 85)).toBe(0); // jembatan
    expect(c.penetration(38, 45)).toBeCloseTo(2, 9); // tepi terdekat = lubang
    expect(c.penetration(Number.NaN, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('collider + TileCollider: sepeda terjebak hanya boleh bergerak keluar', () => {
  const walkOut = (c, start, dx, steps) => {
    const collide = createCollider(start, c.isWalkable, c.penetration);
    let p = start;
    for (let i = 1; i <= steps; i += 1) p = collide(p.x + dx, p.z); // langkah relatif posisi sekarang
    return p;
  };

  for (const [label, over] of [
    ['bangunan', { buildings: [{ height: 6, ring: square(0, 0, 100) }] }],
    ['air', { water: [{ outer: square(0, 0, 100), holes: [] }] }],
  ]) {
    it(`tidak bisa menembus seluruh ${label} 100 m (mulai 2 m di dalam, maju +x)`, () => {
      const c = createTileCollider();
      c.addTile('0_0', tile(over));
      const p = walkOut(c, { x: 2, z: 50 }, 1, 150);
      expect(p.x).toBeLessThan(50);
    });

    it(`sepeda terjebak di ${label} keluar lewat tepi terdekat (−x) dalam ≤ 3 langkah`, () => {
      const c = createTileCollider();
      c.addTile('0_0', tile(over));
      const collide = createCollider({ x: 2, z: 50 }, c.isWalkable, c.penetration);
      let p = { x: 2, z: 50 };
      for (let i = 1; i <= 3; i += 1) p = collide(p.x - 1, p.z);
      expect(c.isWalkable(p.x, p.z)).toBe(true);
      expect(p.x).toBe(-1);
      expect(collide(5, 50)).toEqual({ x: -1, z: 50 }); // sudah keluar: tabrakan normal lagi
    });
  }

  it('lewat collider komposit: penetration diteruskan ke fallback kota', () => {
    const city = createTileCollider();
    city.addTile('1_-1', tile({ key: '1_-1', buildings: [{ height: 6, ring: square(600, -300, 100) }] }));
    const comp = createCompositeCollider({ regions: [{ region: stadionRegion, colliders: stadionColliders }], fallback: city });
    expect(comp.penetration(602, -250)).toBeCloseTo(city.penetration(602, -250), 9);
    expect(comp.penetration(Number.NaN, 0)).toBe(Number.POSITIVE_INFINITY);
    const tugu = stadionColliders.obstacles[0];
    expect(comp.penetration(tugu.x, tugu.z)).toBe(0); // region tanpa penetration → 0
    const collide = createCollider({ x: 602, z: -250 }, comp.isWalkable, comp.penetration);
    let p = { x: 602, z: -250 };
    for (let i = 1; i <= 150; i += 1) p = collide(p.x + 1, p.z);
    expect(p.x).toBeLessThan(650);
  });
});

describe('TileCollider: rintangan lingkaran (kendaraan mangkal)', () => {
  it('memblok di dalam lingkaran + jarak bebas, penetration naik ke pusat; removeObstacles membuka lagi', () => {
    const c = createTileCollider();
    c.addObstacles('kendaraan', [{ x: 10, z: 10, r: 1 }, { x: 30, z: 10, r: 1 }]);
    expect(c.isWalkable(10, 10)).toBe(false);
    expect(c.isWalkable(11.5, 10)).toBe(false); // < r + 0,6
    expect(c.isWalkable(11.7, 10)).toBe(true);
    expect(c.isWalkable(30, 10.9)).toBe(false);
    expect(c.isCameraClear(11.7, 10)).toBe(false); // < r + 0,8
    expect(c.isCameraClear(11.9, 10)).toBe(true);
    expect(c.penetration(10, 10)).toBeCloseTo(1.6, 6);
    expect(c.penetration(10.5, 10)).toBeCloseTo(1.1, 6);
    expect(c.penetration(20, 10)).toBe(0);
    expect(c.tileCount).toBe(0); // rintangan bukan tile
    expect(c.removeObstacles('kendaraan')).toBe(true);
    expect(c.removeObstacles('kendaraan')).toBe(false);
    expect(c.isWalkable(10, 10)).toBe(true);
    expect(c.cellCount).toBe(0);
  });

  it('rintangan dan tile hidup berdampingan: melepas tile tidak melepas rintangan di sel yang sama', () => {
    const c = createTileCollider();
    c.addTile('0_0', tile({ buildings: [{ height: 6, ring: square(0, 0, 5) }] }));
    c.addObstacles('kendaraan', [{ x: 10, z: 10, r: 1 }]);
    c.removeTile('0_0');
    expect(c.isWalkable(2, 2)).toBe(true);
    expect(c.isWalkable(10, 10)).toBe(false);
  });
});
