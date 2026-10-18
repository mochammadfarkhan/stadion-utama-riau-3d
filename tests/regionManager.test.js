import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createRegionManager, MOUNT_INTERVAL_MS, MOUNT_RETRY_MS, MINIMAP_BAKE_MARGIN,
} from '../src/app/regionManager.js';
import { createDummyRegion, DUMMY_BOXES } from '../src/app/dummyRegion.js';
import { defineRegion, validateBuild } from '../src/regions/Region.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { createScheduler } from '../src/engine/scheduler.js';
import { createDynamicCompositeCollider } from '../src/core/Collider.js';

const quiet = { error() {}, warn() {} };
const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeApp() {
  const runner = createSystemRunner({ logger: quiet });
  const bakes = [];
  return {
    scene: new THREE.Scene(),
    runner,
    bakes,
    addSystem: (s) => runner.add(s),
    removeSystem: (id) => runner.remove(id),
    bakeMinimap: (half, center) => { bakes.push({ half, x: center.x, z: center.z }); return { width: 64 }; },
  };
}

/** Region kecil (satu mesh, satu sistem); `fail()` true → build melempar. */
function simpleRegion(id, { placement = { x: 0, z: 0, yaw: 0 }, activation = { persistent: true }, fail = () => false } = {}) {
  return defineRegion({
    id,
    placement,
    mask: square,
    activation,
    build: async ({ scope }) => {
      if (fail()) throw new Error(`build ${id} rusak`);
      const group = new THREE.Group();
      group.name = `region:${id}`;
      group.add(new THREE.Mesh(scope.get('g', () => new THREE.BoxGeometry()), scope.get('m', () => new THREE.MeshBasicMaterial())));
      return validateBuild({
        group,
        colliders: { isWalkable: () => false, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [{ id: `${id}.sistem`, phase: 'world', update() {} }],
        dispose() { group.removeFromParent(); scope.dispose(); },
      }, id);
    },
  });
}

/** Manager + jam palsu + scheduler yang menghabiskan antrean dalam satu update. */
function setup(opts = {}) {
  const app = fakeApp();
  const clock = { t: 0 };
  const scheduler = createScheduler({ now: () => 0, logger: quiet });
  const scopes = [];
  const createScope = (name) => {
    const s = createResourceScope(name, { logger: quiet });
    scopes.push(s);
    return s;
  };
  const rm = createRegionManager({ app, scheduler, createScope, now: () => clock.t, logger: quiet, ...opts });
  /** Satu "frame": majukan jam, update pada `focus`, tunggu mount, habiskan antrean scheduler. */
  const frame = async (focus, advanceMs = 0) => {
    clock.t += advanceMs;
    rm.update(focus);
    await rm.flush();
    scheduler.update();
    await tick();
  };
  return { app, clock, scheduler, scopes, rm, frame };
}

const ids = (rm) => rm.active().map((a) => a.def.id);

describe('regionManager: persistent', () => {
  it('register persistent langsung memasang; active/frameOf/regionAt/handleOf', async () => {
    const { rm, app } = setup();
    const handle = await rm.register(simpleRegion('tetap', { placement: { x: 100, z: 0, yaw: 0 } }));
    expect(handle.mounted).toBe(true);
    expect(ids(rm)).toEqual(['tetap']);
    expect(rm.active()[0].region).toBe(handle.region);
    expect(rm.handleOf('tetap')).toBe(handle);
    expect(rm.handleOf('hilang')).toBeNull();
    expect(rm.frameOf('tetap').toWorld(1, 0).x).toBeCloseTo(101, 9);
    expect(rm.frameOf('hilang')).toBeNull();
    expect(rm.regionAt(105, 0)).toBe('tetap');
    expect(rm.regionAt(0, 0)).toBeNull();
    expect(app.runner.ids).toEqual(['tetap.sistem']);
  });

  it('id ganda ditolak; region persistent tidak dilepas oleh update sejauh apa pun', async () => {
    const { rm, frame } = setup();
    await rm.register(simpleRegion('tetap'));
    expect(() => rm.register(simpleRegion('tetap'))).toThrow(/sudah terdaftar/);
    expect(() => rm.register({ id: 'mentah' })).toThrow(/defineRegion/);
    await frame({ x: 99999, z: 0 }, 10000);
    expect(ids(rm)).toEqual(['tetap']);
  });

  it('persistent yang gagal: register menolak (main.js menampilkan galat fatal seperti sebelumnya)', async () => {
    const { rm } = setup();
    await expect(rm.register(simpleRegion('rusak', { fail: () => true }))).rejects.toThrow(/build rusak rusak/);
    expect(ids(rm)).toEqual([]);
  });
});

describe('regionManager: streaming', () => {
  it('histeresis: pasang < mountRadius, tetap di antara radius, lepas > unmountRadius; proxy bergantian', async () => {
    const { rm, frame, app } = setup();
    await rm.register(createDummyRegion({ x: 0, z: 0 })); // 700 / 900
    const proxy = app.scene.getObjectByName('proxy:dummy');
    expect(proxy.visible).toBe(true);
    await frame({ x: 800, z: 0 });
    expect(ids(rm)).toEqual([]);
    await frame({ x: 600, z: 0 });
    expect(ids(rm)).toEqual(['dummy']);
    expect(proxy.visible).toBe(false);
    await frame({ x: 850, z: 0 }, 1000);
    expect(ids(rm)).toEqual(['dummy']); // 850 < 900: tetap
    await frame({ x: 950, z: 0 }, 1000);
    expect(ids(rm)).toEqual([]);
    expect(proxy.visible).toBe(true);
    await frame({ x: 800, z: 0 }, 1000);
    expect(ids(rm)).toEqual([]); // 800 > 700: tidak dipasang lagi
  });

  it('maksimal satu mount per 0,5 s; yang terdekat lebih dulu', async () => {
    const { rm, frame } = setup();
    await rm.register(createDummyRegion({ id: 'a', x: 100, z: 0 }));
    await rm.register(createDummyRegion({ id: 'b', x: -50, z: 0 }));
    await frame({ x: 0, z: 0 });
    expect(ids(rm)).toEqual(['b']);
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS - 1);
    expect(ids(rm)).toEqual(['b']);
    await frame({ x: 0, z: 0 }, 1);
    expect(ids(rm)).toEqual(['b', 'a']);
  });

  it('satu mount berjalan sekaligus: mount berikutnya menunggu yang sedang berjalan', async () => {
    const gates = [];
    const mount = (_app, def) => new Promise((resolve) => {
      gates.push(() => resolve({ def, region: { colliders: {} }, ready: Promise.resolve(), mounted: true, unmount() {} }));
    });
    const { rm, clock } = setup({ mount });
    await rm.register(createDummyRegion({ id: 'a', x: 0, z: 0 }));
    await rm.register(createDummyRegion({ id: 'b', x: 10, z: 0 }));
    rm.update({ x: 0, z: 0 });
    await tick();
    clock.t += 5000;
    rm.update({ x: 0, z: 0 });
    await tick();
    expect(gates).toHaveLength(1);
    gates[0]();
    await rm.flush();
    expect(ids(rm)).toEqual(['a']);
    clock.t += 5000;
    rm.update({ x: 0, z: 0 });
    await tick();
    expect(gates).toHaveLength(2);
  });

  it('LIFO: pelepasan terbalik dari urutan pemasangan (menjauh & dispose)', async () => {
    const { rm, frame } = setup();
    const log = [];
    rm.on('unmount', ({ def }) => log.push(def.id));
    await rm.register(simpleRegion('tetap', { placement: { x: 5000, z: 5000, yaw: 0 } }));
    await rm.register(createDummyRegion({ id: 'a', x: 0, z: 0 }));
    await rm.register(createDummyRegion({ id: 'b', x: 100, z: 0 }));
    await frame({ x: 0, z: 0 });
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS);
    expect(ids(rm)).toEqual(['tetap', 'a', 'b']);
    await frame({ x: -3000, z: 0 }, MOUNT_INTERVAL_MS);
    expect(log).toEqual(['b', 'a']);
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS);
    await frame({ x: 0, z: 0 }, MOUNT_INTERVAL_MS);
    expect(ids(rm)).toEqual(['tetap', 'a', 'b']);
    log.length = 0;
    rm.dispose();
    rm.dispose(); // idempoten
    expect(log).toEqual(['b', 'a', 'tetap']);
    expect(ids(rm)).toEqual([]);
  });

  it('mount streaming yang gagal dicatat, tidak melempar, dicoba lagi setelah MOUNT_RETRY_MS', async () => {
    let fail = true;
    const errors = [];
    const logger = { error: (...a) => errors.push(String(a[0])), warn() {} };
    const { rm, frame } = setup({ logger });
    await rm.register(simpleRegion('rapuh', { activation: { center: { x: 0, z: 0 } }, fail: () => fail }));
    await frame({ x: 0, z: 0 });
    expect(ids(rm)).toEqual([]);
    expect(errors.some((e) => e.includes('"rapuh"'))).toBe(true);
    fail = false;
    await frame({ x: 0, z: 0 }, MOUNT_RETRY_MS - 1);
    expect(ids(rm)).toEqual([]);
    await frame({ x: 0, z: 0 }, 1);
    expect(ids(rm)).toEqual(['rapuh']);
  });

  it('dispose saat mount berjalan: region dilepas begitu mount selesai', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const base = createDummyRegion({ x: 0, z: 0 });
    const slow = defineRegion({ ...base, build: async (ctx) => { await gate; return base.build(ctx); } });
    const { rm, app } = setup();
    await rm.register(slow);
    rm.update({ x: 0, z: 0 });
    await tick();
    rm.dispose();
    release();
    await rm.flush();
    expect(app.scene.children).toHaveLength(0);
    expect(ids(rm)).toEqual([]);
  });
});

describe('regionManager: event, collider, minimap, remount', () => {
  it('event mount/unmount membawa {def, region, frame}; fungsi lepas berhenti mendengar; event tak dikenal ditolak', async () => {
    const { rm, frame } = setup();
    const seen = [];
    const off = rm.on('mount', (r) => seen.push(['mount', r.def.id, r.region.group.isObject3D, r.frame.placement.x]));
    rm.on('unmount', (r) => seen.push(['unmount', r.def.id]));
    await rm.register(createDummyRegion({ x: 300, z: 0 }));
    await frame({ x: 300, z: 0 });
    off();
    await frame({ x: 5000, z: 0 }, 1000);
    await frame({ x: 300, z: 0 }, 1000);
    expect(seen).toEqual([['mount', 'dummy', true, 300], ['unmount', 'dummy']]);
    expect(() => rm.on('lain', () => {})).toThrow(/tidak dikenal/);
  });

  it('collider komposit & base layer minimap mengikuti region aktif', async () => {
    const collider = createDynamicCompositeCollider({ fallback: { isWalkable: () => true, isCameraClear: () => true } });
    const layers = new Map();
    const minimap = { setBaseLayer: (id, _canvas, o) => layers.set(id, o), removeBaseLayer: (id) => layers.delete(id) };
    const { rm, frame, app } = setup({ collider });
    await rm.register(simpleRegion('tetap', { placement: { x: 100, z: 0, yaw: 0 } }));
    expect(collider.isWalkable(100, 0)).toBe(false); // dirutekan ke region (isWalkable false)
    expect(collider.isWalkable(0, 0)).toBe(true);
    rm.attachMinimap(minimap); // membake region aktif saat itu juga (paritas langkah "Menggambar peta")
    const half = Math.ceil(Math.hypot(10, 10)) + MINIMAP_BAKE_MARGIN;
    expect(layers.get('tetap')).toEqual({ center: { x: 100, z: 0 }, half, yaw: 0 });
    await rm.register(createDummyRegion({ x: 0, z: 1000 }));
    await frame({ x: 0, z: 1000 });
    await tick();
    expect([...layers.keys()]).toEqual(['tetap', 'dummy']); // dibake setelah region siap
    expect(collider.isWalkable(0, 1000)).toBe(true);
    await frame({ x: 0, z: -5000 }, 1000);
    expect([...layers.keys()]).toEqual(['tetap']);
    expect(app.bakes).toHaveLength(2);
    expect(() => rm.attachMinimap({})).toThrow(TypeError);
  });

  it('remount (dev/E2E): lepas lalu pasang ulang; region tak terdaftar ditolak', async () => {
    const { rm, app } = setup();
    const first = await rm.register(simpleRegion('tetap'));
    await rm.remount('tetap');
    expect(first.mounted).toBe(false);
    expect(rm.handleOf('tetap')).not.toBe(first);
    expect(rm.handleOf('tetap').mounted).toBe(true);
    expect(app.runner.ids).toEqual(['tetap.sistem']);
    await expect(rm.remount('hilang')).rejects.toThrow(/tidak terdaftar/);
  });
});

describe('regionManager: region kedua (dummy) dipasang-lepas 3× tanpa bocor', () => {
  it('scene, sistem, scope, dan seluruh geometri/material kembali bersih tiap siklus', async () => {
    const { rm, frame, app, scopes } = setup();
    await rm.register(simpleRegion('tetap', { placement: { x: 5000, z: 5000, yaw: 0 } }));
    await rm.register(createDummyRegion({ x: 0, z: 0 }));
    const baseline = app.scene.children.length; // region tetap + proxy dummy
    for (let i = 0; i < 3; i += 1) {
      await frame({ x: 0, z: 0 }, 1000);
      const handle = rm.handleOf('dummy');
      await handle.ready;
      expect(handle.region.group.children).toHaveLength(1 + DUMMY_BOXES);
      const resources = new Set();
      handle.region.group.traverse((o) => {
        if (o.geometry) resources.add(o.geometry);
        if (o.material) resources.add(o.material);
      });
      const released = new Set();
      for (const r of resources) r.addEventListener('dispose', () => released.add(r));
      await frame({ x: 5000, z: 0 }, 1000);
      expect(app.scene.children).toHaveLength(baseline);
      expect(app.runner.ids).toEqual(['tetap.sistem']);
      const regionScope = scopes.filter((s) => s.name === 'region:dummy').at(-1);
      expect(regionScope.disposed).toBe(true);
      expect(regionScope.size).toBe(0);
      expect(released.size).toBe(resources.size);
    }
    expect(scopes.filter((s) => s.name === 'region:dummy')).toHaveLength(3);
    rm.dispose();
    expect(app.scene.children).toHaveLength(0);
    expect(scopes.every((s) => s.disposed)).toBe(true);
  });
});
