import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { travelDestinations, findWalkableNear, findSpawnNear, createFastTravel, waitForRegion } from '../src/app/fastTravel.js';
import { thirdPersonOffset } from '../src/core/cameraMath.js';
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
  const setup = (settled = true, extra = {}) => {
    const log = [];
    const bike = { state: { x: 0, z: 0, yaw: 0, v: 5 }, setCollider: () => log.push('collider') };
    const screen = { show: (t) => log.push(`show:${t}`), hide: () => log.push('hide') };
    const city = { whenSettled: (x, z, r) => { log.push(`tunggu:${Math.round(x)},${Math.round(z)},${r}`); return Promise.resolve(settled); } };
    const colliders = { isWalkable: (x) => x > 6805 || x < 6000 }; // titik tujuan pas di bangunan
    const destinations = [{ id: 'annur', label: 'Masjid Raya An-Nur', x: 6800, z: -4750, yaw: 0 }];
    return { log, bike, ft: createFastTravel({ destinations, bike, colliders, city, screen, ...extra }) };
  };

  it('tampilkan layar → pindah sepeda → tunggu tile (600 m) → muncul di titik walkable → tutup layar', async () => {
    const { log, bike, ft } = setup();
    const p = ft.go('annur');
    expect(ft.busy).toBe(true);
    expect(await p).toBe('ok');
    expect(log).toEqual(['show:Menuju Masjid Raya An-Nur…', 'collider', 'tunggu:6800,-4750,600', 'collider', 'hide']);
    expect(bike.state.x).toBeGreaterThan(6805);
    expect(bike.state.v).toBe(0);
    expect(ft.busy).toBe(false);
  });

  it("status terpisah: 'unknown' / 'busy' / 'timeout' (timeout streamer tetap menutup layar)", async () => {
    const { log, ft } = setup(false);
    expect(await ft.go('tidak-ada')).toBe('unknown');
    const a = ft.go('annur');
    expect(await ft.go('annur')).toBe('busy');
    expect(await a).toBe('timeout');
    expect(log.at(-1)).toBe('hide');
  });

  it('POV aktif: keluar POV dulu agar fokus streamer kembali ke sepeda; tanpa POV tidak memanggil exitPov', async () => {
    const calls = [];
    const rig = { povId: 'orbit', exitPov(opts) { calls.push(`exitPov:${opts?.instant}`); this.povId = null; return true; } };
    const { log, ft } = setup(true, { rig });
    expect(await ft.go('annur')).toBe('ok');
    expect(calls).toEqual(['exitPov:true']); // instan: kamera tidak terbang 8 km setelah layar ditutup
    expect(log[0]).toBe('show:Menuju Masjid Raya An-Nur…');
    expect(await ft.go('annur')).toBe('ok');
    expect(calls).toEqual(['exitPov:true']); // instan: kamera tidak terbang 8 km setelah layar ditutup
    expect(await ft.go('tidak-ada')).toBe('unknown'); // tujuan tak dikenal: POV tidak diubah
  });

  it('isCameraClear: muncul dengan ruang kamera orang ketiga (dinding di belakang ditolak)', async () => {
    const wallX = 6812; // dinding di timur: kamera di x ≥ 6812 terhalang
    const isCameraClear = (x) => x < wallX && (x > 6805 || x < 6000);
    // Tanpa uji kamera: titik (6808, −4750) menghadap pusat → kamera di timur (x ≈ 6814,5) = di dalam dinding.
    const naive = thirdPersonOffset(Math.atan2(-8, 0), 0);
    expect(isCameraClear(6808 + naive.x, -4750 + naive.z)).toBe(false);
    const { bike, ft } = setup(true, { isCameraClear });
    expect(await ft.go('annur')).toBe('ok');
    const st = bike.state;
    const o = thirdPersonOffset(st.yaw, 0);
    for (const k of [1 / 3, 2 / 3, 1]) expect(isCameraClear(st.x + o.x * k, st.z + o.z * k)).toBe(true);
    expect(st.x).toBeGreaterThan(6805);
    expect(st.v).toBe(0);
  });
});

describe('findSpawnNear', () => {
  const isWalkable = (x, z) => Math.hypot(x, z) > 10; // bangunan bundar di pusat
  const cameraOk = (p, isCameraClear) => {
    const o = thirdPersonOffset(p.yaw, 0);
    return [1 / 3, 2 / 3, 1].every((s) => isCameraClear(p.x + o.x * s, p.z + o.z * s));
  };

  it('tanpa penghalang kamera: titik walkable pertama, menghadap pusat', () => {
    const p = findSpawnNear(0, 0, { isWalkable, isCameraClear: isWalkable });
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(10);
    expect(Math.cos(p.yaw - Math.atan2(-p.x, -p.z))).toBeCloseTo(1, 6); // depan sepeda = (sin yaw, cos yaw)
  });

  it('dinding di belakang: yaw lain atau titik lain yang kameranya bebas', () => {
    const isCameraClear = (x, z) => isWalkable(x, z) && x < 14; // dinding di timur titik cincin pertama (12, 0)
    const p = findSpawnNear(0, 0, { isWalkable, isCameraClear });
    expect(isWalkable(p.x, p.z)).toBe(true);
    expect(cameraOk(p, isCameraClear)).toBe(true);
  });

  it('pusat walkable & kamera bebas: pusat dengan fallbackYaw; tak ada kamera bebas → titik walkable biasa', () => {
    expect(findSpawnNear(5, 6, { isWalkable: () => true, isCameraClear: () => true, fallbackYaw: 1.2 })).toEqual({ x: 5, z: 6, yaw: 1.2 });
    const p = findSpawnNear(0, 0, { isWalkable, isCameraClear: () => false, maxRadius: 20 });
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(10);
    expect(findSpawnNear(0, 0, { isWalkable: () => false, maxRadius: 8 })).toBeNull();
  });
});

describe('tujuan kampus (M7)', () => {
  it('campus:true menambah Sekre UKM (ERC) lebih dulu, lalu Sekretariat Lembaga & Rektorat (dunia)', () => {
    const d = travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn, campus: true });
    expect(d.map((v) => v.id)).toEqual(['stadion', 'unri-sekre-ukm', 'unri-sekre', 'unri-rektorat']);
    expect(d[1]).toMatchObject({ label: 'Kampus UNRI — Sekre UKM (ERC)', x: -96.65, z: 1005.5, yaw: Math.PI / 2 });
    expect(d[2]).toMatchObject({ label: 'Kampus UNRI — Sekretariat Lembaga', x: -219, z: 1130, yaw: Math.PI });
    expect(d[3]).toMatchObject({ label: 'Kampus UNRI — Rektorat', x: -979, z: 860, yaw: Math.PI });
    expect(travelDestinations({ manifest: null, frame: IDENTITY_FRAME, spawn: LAYOUT.spawn }).map((v) => v.id)).toEqual(['stadion']);
  });
  it('settle tambahan (distrik/region) ikut menentukan status', async () => {
    const bike = { state: { x: 0, z: 0, yaw: 0, v: 0 }, setCollider: () => {} };
    const screen = { show: () => {}, hide: () => {} };
    const t = createFastTravel({
      destinations: [{ id: 'a', label: 'A', x: 5, z: 5, yaw: 0 }], bike, colliders: { isWalkable: () => true }, screen, settle: async () => false,
    });
    expect(await t.go('a')).toBe('timeout');
  });
});

describe('waitForRegion', () => {
  const def = { id: 'r', placement: { x: 0, z: 0, yaw: 0 }, mask: [[-10, -10], [10, -10], [10, 10], [-10, 10]] };
  it('titik di luar region hero: langsung true', async () => {
    expect(await waitForRegion({ active: () => [] }, [def], 50, 50)).toBe(true);
  });
  it('menunggu region aktif lalu ready-nya', async () => {
    let polls = 0;
    const regions = { active: () => (polls++ >= 2 ? [{ def: { id: 'r' }, region: { ready: Promise.resolve() } }] : []) };
    expect(await waitForRegion(regions, [def], 0, 0, { sleep: async () => {} })).toBe(true);
    expect(polls).toBe(3);
  });
  it('habis waktu: false', async () => {
    let t = 0;
    const opts = { timeoutMs: 300, pollMs: 100, sleep: async (ms) => { t += ms; }, now: () => t };
    expect(await waitForRegion({ active: () => [] }, [def], 0, 0, opts)).toBe(false);
  });
});
