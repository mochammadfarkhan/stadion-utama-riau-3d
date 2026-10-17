import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createCity, groundAnchor } from '../../src/city/index.js';
import { createSystemRunner } from '../../src/engine/SystemRunner.js';

const quiet = { error() {} };
const realManifest = () => JSON.parse(readFileSync('public/tiles/manifest.json', 'utf8'));
const realJson = (url) => {
  const file = url.replace(/^\/tiles\//, 'public/tiles/');
  return Promise.resolve(JSON.parse(readFileSync(file, 'utf8')));
};
const fakeGltf = () => {
  const scene = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  m.name = 'buildings_walls';
  scene.add(m);
  return Promise.resolve({ scene });
};
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) });

function fakeApp() {
  const runner = createSystemRunner({ logger: quiet });
  return { scene: new THREE.Scene(), runner, addSystem: (s) => runner.add(s), removeSystem: (id) => runner.remove(id) };
}

/** Jalankan frame sampai streamer tenang (muatan palsu selesai di microtask). */
async function frames(app, focus, n = 40) {
  for (let i = 0; i < n; i += 1) {
    app.runner.update(0.016, { focus });
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('createCity', () => {
  it('manifest gagal → null + toast (mode hanya-region), tanpa sistem/grup', async () => {
    const app = fakeApp();
    const toasts = [];
    const city = await createCity({ app, fetchJson: () => Promise.reject(new Error('404')), toast: (t, ok) => toasts.push([t, ok]), logger: quiet });
    expect(city).toBeNull();
    expect(toasts).toEqual([['Peta kota gagal dimuat — hanya kawasan stadion', false]]);
    expect(app.runner.ids).toEqual([]);
    expect(app.scene.children).toHaveLength(0);
  });

  it('manifest tak valid juga → null', async () => {
    const city = await createCity({ app: fakeApp(), fetchJson: () => Promise.resolve({ version: 9 }), logger: quiet });
    expect(city).toBeNull();
  });

  it('streaming dari manifest nyata: tile ≤ 1000 m dari stadion termuat, collider aktif, whenSettled selesai; dispose bersih', async () => {
    const app = fakeApp();
    const city = await createCity({
      app, fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: fakeGltf, createCanvas: fakeCanvas, logger: quiet,
    });
    expect(app.runner.ids).toEqual(['city.stream']);
    const settled = city.whenSettled(0, -275, 600, 5000);
    await frames(app, { x: 0, z: -275 });
    expect(await settled).toBe(true);
    const s = city.stats();
    expect(s.loading).toBe(0);
    expect(s.loaded).toBeGreaterThan(10);
    expect(s.tiles).toBe(s.loaded);
    expect(city.minimap.size).toBe(s.loaded);
    expect(city.collider.tileCount).toBe(s.loaded);
    expect(city.group.getObjectByName('tanahKota').position.toArray()).toEqual([0, -0.05, -250]); // Math.round(−5,5) = −5
    city.dispose();
    expect(app.runner.ids).toEqual([]);
    expect(app.scene.children).toHaveLength(0);
    expect(city.collider.tileCount).toBe(0);
  });

  it('whenSettled habis waktu → false', async () => {
    let fire;
    const city = await createCity({
      app: fakeApp(), fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: fakeGltf, createCanvas: fakeCanvas, logger: quiet, setTimer: (fn) => { fire = fn; },
    });
    const p = city.whenSettled(6800, -4750, 600, 1);
    fire();
    expect(await p).toBe(false);
  });

  it('muatan yang masih berjalan saat dispose dibuang: tanpa attach/registerWet/collider/minimap, geometri dilepas', async () => {
    const app = fakeApp();
    const held = [];
    const wet = [];
    const city = await createCity({
      app, fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: () => new Promise((r) => { held.push(r); }), createCanvas: fakeCanvas, logger: quiet,
      weather: { registerWet: (root) => { wet.push(root.name); return () => true; } },
    });
    app.runner.update(0.016, { focus: { x: 0, z: -275 } });
    expect(held.length).toBeGreaterThan(0);
    const addTile = vi.spyOn(city.collider, 'addTile');
    const minimapAdd = vi.spyOn(city.minimap, 'add');
    city.dispose();
    const geos = [];
    for (const resolve of held) {
      const scene = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      m.name = 'buildings_walls';
      scene.add(m);
      let disposed = false;
      m.geometry.addEventListener('dispose', () => { disposed = true; });
      geos.push(() => disposed);
      resolve({ scene });
    }
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    expect(wet).toEqual([]);
    expect(addTile).not.toHaveBeenCalled();
    expect(minimapAdd).not.toHaveBeenCalled();
    expect(city.collider.tileCount).toBe(0);
    expect(city.minimap.size).toBe(0);
    expect(city.group.children.filter((c) => c.name.startsWith('tile:'))).toHaveLength(0);
    expect(geos.every((d) => d())).toBe(true);
  });

  it('whenSettled yang selesai membersihkan timer habis-waktunya', async () => {
    const app = fakeApp();
    const cleared = [];
    const city = await createCity({
      app, fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: fakeGltf, createCanvas: fakeCanvas, logger: quiet,
      setTimer: () => 'timer-1', clearTimer: (h) => cleared.push(h),
    });
    const p = city.whenSettled(0, -275, 300, 5000);
    await frames(app, { x: 0, z: -275 });
    expect(await p).toBe(true);
    expect(cleared).toEqual(['timer-1']);
    city.dispose();
  });

  it('kendaraan mangkal dipasang di grup kota (emissive ke registry malam, collider kota); dispose melepas', async () => {
    const app = fakeApp();
    const off = vi.fn(() => true);
    const time = { registerEmissive: vi.fn(() => off) };
    const city = await createCity({
      app, fetchJson: (u) => (u.endsWith('manifest.json') ? Promise.resolve(realManifest()) : realJson(u)),
      loadGltf: fakeGltf, createCanvas: fakeCanvas, logger: quiet, time,
    });
    const res = await city.vehicles.ready;
    expect(res.placed).toBe(4);
    const group = city.group.getObjectByName('kendaraanMangkal');
    expect(group.children).toHaveLength(4);
    expect(time.registerEmissive).toHaveBeenCalledWith(group);
    const s = res.slots[1];
    expect(city.collider.isWalkable(s.x, s.z)).toBe(false);
    city.dispose();
    expect(off).toHaveBeenCalledTimes(1);
    expect(city.collider.isWalkable(s.x, s.z)).toBe(true);
    expect(app.scene.children).toHaveLength(0);
  });

  it('groundAnchor membulatkan ke grid 50 m', () => {
    expect(groundAnchor({ x: 26, z: -74 })).toEqual({ x: 50, z: -50 });
  });
});
