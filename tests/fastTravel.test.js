import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { travelDestinations, findWalkableNear, createFastTravel } from '../src/app/fastTravel.js';
import { createRegionFrame, IDENTITY_FRAME } from '../src/geo/regionTransform.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';

const manifest = JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));

describe('tujuan perjalanan cepat', () => {
  it('Stadion = spawn region (dunia); An-Nur = pusat area "pusat" manifest (±8,3 km timur laut)', () => {
    const frame = createRegionFrame({ x: 10, z: 0, yaw: 0 });
    const [stadion, annur] = travelDestinations({ manifest, frame, spawn: LAYOUT.spawn });
    expect(stadion).toMatchObject({ id: 'stadion', x: 10 + LAYOUT.spawn.x, z: LAYOUT.spawn.z });
    expect(annur.id).toBe('annur');
    expect(Math.hypot(annur.x, annur.z)).toBeGreaterThan(8000);
    expect(Math.hypot(annur.x, annur.z)).toBeLessThan(8600);
    expect(annur.x).toBeGreaterThan(0);
    expect(annur.z).toBeLessThan(0); // −Z = utara
  });

  it('tanpa manifest (mode hanya-region): hanya Stadion', () => {
    expect(travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn }).map((d) => d.id)).toEqual(['stadion']);
  });
});

describe('findWalkableNear', () => {
  it('pusat walkable → pusat; terhalang → titik walkable terdekat pada cincin', () => {
    expect(findWalkableNear(1, 2, () => true)).toEqual({ x: 1, z: 2 });
    const p = findWalkableNear(0, 0, (x, z) => Math.hypot(x, z) > 10);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(10);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(12.0001);
    expect(findWalkableNear(0, 0, () => false, { maxRadius: 8 })).toBeNull();
  });
});

describe('createFastTravel', () => {
  const setup = (settled = true) => {
    const log = [];
    const bike = { state: { x: 0, z: 0, yaw: 0, v: 5 }, setCollider: () => log.push('collider') };
    const screen = { show: (t) => log.push(`show:${t}`), hide: () => log.push('hide') };
    const city = { whenSettled: (x, z, r) => { log.push(`tunggu:${Math.round(x)},${Math.round(z)},${r}`); return Promise.resolve(settled); } };
    const colliders = { isWalkable: (x) => x > 6805 || x < 6000 }; // titik tujuan pas di bangunan
    const destinations = [{ id: 'annur', label: 'Masjid Raya An-Nur', x: 6800, z: -4750, yaw: 0 }];
    return { log, bike, ft: createFastTravel({ destinations, bike, colliders, city, screen }) };
  };

  it('tampilkan layar → pindah sepeda → tunggu tile (600 m) → muncul di titik walkable → tutup layar', async () => {
    const { log, bike, ft } = setup();
    const p = ft.go('annur');
    expect(ft.busy).toBe(true);
    expect(await p).toBe(true);
    expect(log).toEqual(['show:Menuju Masjid Raya An-Nur…', 'collider', 'tunggu:6800,-4750,600', 'collider', 'hide']);
    expect(bike.state.x).toBeGreaterThan(6805);
    expect(bike.state.v).toBe(0);
    expect(ft.busy).toBe(false);
  });

  it('tujuan tak dikenal / sedang berjalan → false; timeout streamer tetap menutup layar', async () => {
    const { log, ft } = setup(false);
    expect(await ft.go('tidak-ada')).toBe(false);
    const a = ft.go('annur');
    expect(await ft.go('annur')).toBe(false);
    expect(await a).toBe(false);
    expect(log.at(-1)).toBe('hide');
  });
});
