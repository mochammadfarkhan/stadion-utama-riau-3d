import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync, existsSync } from 'node:fs';
import {
  computeParkedSlots, parkedTargets, tilesForTargets, vehicleFootprint, vehicleCircles, mountParkedVehicles,
  HALTE_NODE, VEHICLE_MODELS, SHOULDER_INSET, PARKED_GROUP_NAME,
} from '../src/city/parkedVehicles.js';
import { decodeTileData } from '../src/city/tileData.js';
import { createTileCollider } from '../src/city/TileCollider.js';
import { distanceToRing, distanceToSegment, pointInPolygon } from '../src/geo/polygon.js';

const quiet = { error() {} };
const tileFile = (key) => `public/tiles/${key}.data.json`;
const loadTile = (key) => decodeTileData(JSON.parse(readFileSync(tileFile(key), 'utf8')));
const TARGETS = parkedTargets();
const TILES = tilesForTargets(TARGETS).filter((k) => existsSync(tileFile(k))).map(loadTile);
const ROADS = TILES.flatMap((t) => t.roads);
const BUILDINGS = TILES.flatMap((t) => t.buildings);
const SLOTS = computeParkedSlots(ROADS, TARGETS);

const DEG = 180 / Math.PI;
/** Segmen terdekat dari jalan yang cocok dengan target (nama bila ada). */
function nearestSegment(slot, target) {
  let best = null;
  for (const r of ROADS) {
    if (target.road && r.name !== target.road) continue;
    for (let i = 0; i + 1 < r.pts.length; i += 1) {
      const d = distanceToSegment(slot.x, slot.z, r.pts[i], r.pts[i + 1]);
      if (!best || d < best.d) best = { d, a: r.pts[i], b: r.pts[i + 1], road: r };
    }
  }
  return best;
}
/** Selisih sudut garis (mod π) dalam derajat. */
const lineAngleDiff = (a, b) => {
  const d = Math.abs(((a - b) % Math.PI + Math.PI) % Math.PI);
  return Math.min(d, Math.PI - d) * DEG;
};

describe('computeParkedSlots — jalan sintetis', () => {
  const straight = [{ cls: 'primary', width: 14, name: 'Jalan Uji', pts: [[0, 0], [100, 0]] }];

  it('proyeksi ke segmen, geser ke bahu (lebar/2 − 1,2 m) di sisi titik target, yaw sejajar arah polyline', () => {
    const [s] = computeParkedSlots(straight, [{ model: 'angkot', x: 10, z: 3 }]);
    expect(s.model).toBe('angkot');
    expect(s.x).toBeCloseTo(10, 6);
    expect(s.z).toBeCloseTo(7 - SHOULDER_INSET, 6);
    expect(s.yaw).toBeCloseTo(Math.PI / 2, 3); // model menghadap +Z; yaw π/2 → +X (arah polyline)
    const [t] = computeParkedSlots(straight, [{ model: 'angkot', x: 10, z: -3 }]);
    expect(t.z).toBeCloseTo(-(7 - SHOULDER_INSET), 6);
  });

  it('`side` menentukan sisi bahu; `along` menggeser searah polyline; filter nama jalan', () => {
    const roads = [...straight, { cls: 'service', width: 4.5, name: null, pts: [[0, 2], [100, 2]] }];
    const [s] = computeParkedSlots(roads, [{ model: 'bus', x: 50, z: 1.5, road: 'Jalan Uji', side: { x: 0, z: -100 }, along: -8 }]);
    expect(s.x).toBeCloseTo(42, 6);
    expect(s.z).toBeCloseTo(-(7 - SHOULDER_INSET), 6);
  });

  it('jalan tanpa bahu (lebar ≤ 2 × inset) diabaikan; target tanpa jalan tidak menghasilkan slot', () => {
    const narrow = [{ cls: 'footway', width: 2, name: null, pts: [[0, 0], [100, 0]] }];
    expect(computeParkedSlots(narrow, [{ model: 'angkot', x: 10, z: 1 }])).toEqual([]);
    expect(computeParkedSlots(straight, [{ model: 'angkot', x: 10, z: 1, road: 'Jalan Lain' }])).toEqual([]);
  });

  it('deterministik dan tidak memutasi masukan', () => {
    const roads = Object.freeze(straight.map((r) => Object.freeze({ ...r, pts: Object.freeze(r.pts.map((p) => Object.freeze([...p]))) })));
    const targets = Object.freeze([Object.freeze({ model: 'angkot', x: 33.3, z: 2 })]);
    expect(computeParkedSlots(roads, targets)).toEqual(computeParkedSlots(roads, targets));
  });
});

describe('computeParkedSlots — data tile nyata', () => {
  it('halte OSM node 4561327395 terproyeksi di sekitar (558, −775)', () => {
    expect(HALTE_NODE.id).toBe(4561327395);
    const bus = TARGETS.find((t) => t.model === 'bus');
    expect(bus.x).toBeCloseTo(558.3, 0);
    expect(bus.z).toBeCloseTo(-774.5, 0);
  });

  it('1 bus kota + 3 angkot; bus ≤ 15 m dari halte', () => {
    expect(SLOTS.map((s) => s.model)).toEqual(['bus', 'angkot', 'angkot', 'angkot']);
    const bus = SLOTS[0];
    const halte = TARGETS[0];
    expect(Math.hypot(bus.x - halte.x, bus.z - halte.z)).toBeLessThan(15);
  });

  it('setiap slot 2–6 m dari sumbu jalannya dan yaw sejajar segmen ±5°', () => {
    SLOTS.forEach((s, i) => {
      const seg = nearestSegment(s, TARGETS[i]);
      expect(seg.d).toBeGreaterThanOrEqual(2);
      expect(seg.d).toBeLessThanOrEqual(6);
      const segYaw = Math.atan2(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
      expect(lineAngleDiff(s.yaw, segYaw)).toBeLessThanOrEqual(5);
    });
  });

  it('slot (titik dan jejak kendaraan) tidak berada di dalam footprint bangunan tile', () => {
    for (const s of SLOTS) {
      const corners = vehicleFootprint(s, VEHICLE_MODELS[s.model]);
      for (const b of BUILDINGS) {
        expect(pointInPolygon(s.x, s.z, b.ring)).toBe(false);
        for (const [x, z] of corners) expect(pointInPolygon(x, z, b.ring)).toBe(false);
        for (const [x, z] of b.ring) expect(pointInPolygon(x, z, corners)).toBe(false);
      }
    }
  });

  it('angkot di bahu Jl. Naga Sakti dekat gapura (x ∈ [−40, 40]), sisi stadion, berjarak 7–9 m (≥ 6 m)', () => {
    const angkot = SLOTS.filter((s) => s.model === 'angkot');
    for (const s of angkot) {
      expect(s.x).toBeGreaterThanOrEqual(-40);
      expect(s.x).toBeLessThanOrEqual(40);
      const naga = ROADS.filter((r) => r.name === 'Jalan Naga Sakti');
      const axis = Math.min(...naga.map((r) => distanceToRing(s.x, s.z, r.pts, false)));
      expect(axis).toBeLessThanOrEqual(6);
      expect(s.z).toBeGreaterThan(-447.4); // selatan jalur selatan = menghadap stadion (stadion di z ≈ 0)
    }
    for (let i = 0; i < angkot.length; i += 1) {
      for (let j = i + 1; j < angkot.length; j += 1) {
        expect(Math.hypot(angkot[i].x - angkot[j].x, angkot[i].z - angkot[j].z)).toBeGreaterThanOrEqual(6);
      }
      if (i > 0) {
        const gap = Math.hypot(angkot[i].x - angkot[i - 1].x, angkot[i].z - angkot[i - 1].z);
        expect(gap).toBeGreaterThanOrEqual(7);
        expect(gap).toBeLessThanOrEqual(9);
      }
    }
  });

  it('hasil deterministik (dua kali hitung identik)', () => {
    expect(computeParkedSlots(ROADS, parkedTargets())).toEqual(SLOTS);
  });
});

describe('vehicleCircles', () => {
  it('deretan lingkaran sepanjang badan kendaraan (jari-jari = setengah lebar), searah yaw', () => {
    const dims = VEHICLE_MODELS.bus;
    const circles = vehicleCircles({ model: 'bus', x: 10, z: 20, yaw: Math.PI / 2 }, dims);
    expect(circles.length).toBeGreaterThanOrEqual(3);
    for (const c of circles) {
      expect(c.r).toBeCloseTo(dims.width / 2, 6);
      expect(c.z).toBeCloseTo(20, 6);
      expect(Math.abs(c.x - 10) + c.r).toBeLessThanOrEqual(dims.length / 2 + 1e-6);
    }
    const xs = circles.map((c) => c.x);
    expect(Math.min(...xs) - dims.width / 2).toBeCloseTo(10 - dims.length / 2, 6);
    expect(Math.max(...xs) + dims.width / 2).toBeCloseTo(10 + dims.length / 2, 6);
  });
});

describe('mountParkedVehicles', () => {
  const realJson = (url) => Promise.resolve(JSON.parse(readFileSync(url.replace(/^\/tiles\//, 'public/tiles/'), 'utf8')));
  const manifest = () => JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
  const fakeGltf = () => {
    const scene = new THREE.Group();
    const lamp = new THREE.MeshStandardMaterial({ emissive: 0xffcc66, emissiveIntensity: 1.5 });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), lamp));
    return Promise.resolve({ scene });
  };
  const fakeTime = () => {
    const off = vi.fn(() => true);
    return { off, registerEmissive: vi.fn(() => off) };
  };

  it('memasang kendaraan di slot, collider lingkaran, emissive ke registry malam; dispose membalik semuanya', async () => {
    const parent = new THREE.Group();
    const collider = createTileCollider();
    const time = fakeTime();
    const urls = [];
    const v = mountParkedVehicles({
      parent, manifest: manifest(), fetchJson: realJson, loadGltf: (u) => { urls.push(u); return fakeGltf(); },
      collider, time, logger: quiet,
    });
    expect(v.group.name).toBe(PARKED_GROUP_NAME);
    const res = await v.ready;
    expect(res).toMatchObject({ placed: 4, cancelled: false });
    expect(v.group.children).toHaveLength(4);
    expect([...new Set(urls)].sort()).toEqual(['/models/kendaraan/angkot.glb', '/models/kendaraan/bus-kota.glb']);
    expect(urls).toHaveLength(2); // satu muatan per model, salinan per slot
    const bus = v.group.children[0];
    expect(bus.position.x).toBeCloseTo(res.slots[0].x, 6);
    expect(bus.rotation.y).toBeCloseTo(res.slots[0].yaw, 6);
    const s = res.slots[1];
    expect(collider.isWalkable(s.x, s.z)).toBe(false);
    expect(collider.penetration(s.x, s.z)).toBeGreaterThan(0);
    expect(time.registerEmissive).toHaveBeenCalledWith(v.group);
    v.dispose();
    expect(parent.children).toHaveLength(0);
    expect(collider.isWalkable(s.x, s.z)).toBe(true);
    expect(time.off).toHaveBeenCalledTimes(1);
    v.dispose(); // idempoten
    expect(time.off).toHaveBeenCalledTimes(1);
  });

  it('muatan yang selesai setelah dispose dibuang: tidak dipasang, tidak didaftarkan', async () => {
    const parent = new THREE.Group();
    const collider = createTileCollider();
    const time = fakeTime();
    let release;
    const gate = new Promise((r) => { release = r; });
    const v = mountParkedVehicles({
      parent, manifest: manifest(), fetchJson: realJson, loadGltf: () => gate.then(fakeGltf), collider, time, logger: quiet,
    });
    await new Promise((r) => setTimeout(r, 0));
    v.dispose();
    release();
    const res = await v.ready;
    expect(res.cancelled).toBe(true);
    expect(v.group.children).toHaveLength(0);
    expect(parent.children).toHaveLength(0);
    expect(time.registerEmissive).not.toHaveBeenCalled();
    expect(collider.isWalkable(res.slots?.[1]?.x ?? 24, res.slots?.[1]?.z ?? -441.6)).toBe(true);
  });

  it('model gagal dimuat → kendaraan itu dilewati dan dilaporkan; yang lain tetap', async () => {
    const v = mountParkedVehicles({
      parent: new THREE.Group(), manifest: manifest(), fetchJson: realJson, logger: quiet,
      loadGltf: (u) => (u.includes('bus') ? Promise.reject(new Error('404')) : fakeGltf()),
    });
    const res = await v.ready;
    expect(res.placed).toBe(3);
    expect(res.failed).toEqual([{ model: 'bus', error: '404' }]);
    v.dispose();
  });
});
