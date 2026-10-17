import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTileCollider } from '../../src/city/TileCollider.js';
import { decodeTileData } from '../../src/city/tileData.js';
import { createCompositeCollider, localized } from '../../src/core/Collider.js';
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
