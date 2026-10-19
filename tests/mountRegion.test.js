import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { mountRegion, applyPlacement } from '../src/app/mountRegion.js';
import { defineRegion, validateBuild } from '../src/regions/Region.js';
import { createSystemRunner } from '../src/engine/SystemRunner.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { createScheduler } from '../src/engine/scheduler.js';
import { FLAT_TERRAIN } from '../src/app/terrainService.js';

const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const quiet = { error() {} };

function fakeApp() {
  const runner = createSystemRunner({ logger: quiet });
  return {
    scene: new THREE.Scene(),
    runner,
    addSystem: (s) => runner.add(s),
    removeSystem: (id) => runner.remove(id),
  };
}

/** Registry palsu yang mencatat urutan daftar/cabut ke `log`. */
function fakeRegistries(log) {
  const reg = (name) => (root) => {
    log.push(`+${name}:${root.name}`);
    return () => { log.push(`-${name}:${root.name}`); return true; };
  };
  return {
    time: {
      registerEmissive: reg('emissive'),
      registerLamps: (o) => { log.push(`+lamps:${o.lamps.length}`); return () => { log.push('-lamps'); return true; }; },
    },
    weather: { registerWet: reg('wet') },
  };
}

function testRegion(log, { ready, fail = false } = {}) {
  return defineRegion({
    id: 'uji',
    placement: { x: 100, z: -50, yaw: 0.3 },
    mask: square,
    build: async ({ scope, placement }) => {
      if (fail) throw new Error('build rusak');
      scope.get('mat', () => new THREE.MeshBasicMaterial());
      const group = new THREE.Group();
      group.name = 'region-uji';
      const child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      child.position.set(10, 0, 0);
      group.add(child);
      const late = new THREE.Group();
      late.name = 'model-uji';
      group.add(late);
      log.push(`build:${placement.x}`);
      return validateBuild({
        group,
        colliders: { isWalkable: () => true, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [{ id: 'uji.sistem', phase: 'world', update() {}, dispose: () => log.push('sistem.dispose') }],
        nightLights: { lamps: [{ x: 1, z: 1 }], floods: [] },
        lateRoot: late,
        ready,
        dispose: () => { log.push('region.dispose'); group.removeFromParent(); scope.dispose(); },
      }, 'uji');
    },
  });
}

describe('applyPlacement', () => {
  it('titik lokal → dunia sama dengan regionTransform.toWorld', () => {
    const g = new THREE.Group();
    applyPlacement(g, { x: 100, z: -50, yaw: 0.3 });
    g.updateMatrixWorld(true);
    const p = new THREE.Vector3(10, 0, 0).applyMatrix4(g.matrixWorld);
    expect(p.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(p.z).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
  });
});

describe('mountRegion / unmount', () => {
  it('memasang grup bertransformasi, membekukan matriks, mendaftarkan registry & sistem', async () => {
    const log = [];
    const app = fakeApp();
    const { time, weather } = fakeRegistries(log);
    const m = await mountRegion(app, testRegion(log), { time, weather, logger: quiet });
    const g = m.region.group;
    expect(g.parent).toBe(app.scene);
    expect(g.position.toArray()).toEqual([100, 0, -50]);
    expect(g.rotation.y).toBe(0.3);
    expect(g.children[0].matrixAutoUpdate).toBe(false);
    const w = new THREE.Vector3().setFromMatrixPosition(g.children[0].matrixWorld);
    expect(w.x).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(app.runner.ids).toEqual(['uji.sistem']);
    expect(log.slice(0, 4)).toEqual(['build:100', '+emissive:region-uji', '+lamps:1', '+wet:region-uji']);
    await m.ready;
    expect(log.at(-1)).toBe('+emissive:model-uji');
  });

  it('unmount terbalik: konten belakangan → sistem (dispose) → registry → region.dispose; idempoten', async () => {
    const log = [];
    const app = fakeApp();
    const { time, weather } = fakeRegistries(log);
    const m = await mountRegion(app, testRegion(log), { time, weather, logger: quiet });
    await m.ready;
    log.length = 0;
    m.unmount();
    m.unmount();
    expect(log).toEqual(['-emissive:model-uji', 'sistem.dispose', '-wet:region-uji', '-lamps', '-emissive:region-uji', 'region.dispose']);
    expect(app.runner.ids).toEqual([]);
    expect(app.scene.children).toHaveLength(0);
    expect(m.mounted).toBe(false);
  });

  it('build yang melempar melepas scope region dan meneruskan galat', async () => {
    const scopes = [];
    const createScope = (name) => { const s = createResourceScope(name); scopes.push(s); return s; };
    await expect(mountRegion(fakeApp(), testRegion([], { fail: true }), { createScope })).rejects.toThrow(/build rusak/);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].disposed).toBe(true);
  });

  it('galat setelah build (id sistem ganda) menggulung balik: region.dispose dipanggil, grup lepas', async () => {
    const log = [];
    const app = fakeApp();
    app.addSystem({ id: 'uji.sistem', phase: 'ui', update() {} });
    await expect(mountRegion(app, testRegion(log), { logger: quiet })).rejects.toThrow(/sudah terdaftar/);
    expect(log).toContain('region.dispose');
    expect(app.scene.children).toHaveLength(0);
  });

  it('unmount sebelum konten belakangan siap: konten itu tidak didaftarkan', async () => {
    const log = [];
    let resolve;
    const ready = new Promise((r) => { resolve = r; });
    const { time } = fakeRegistries(log);
    const m = await mountRegion(fakeApp(), testRegion(log, { ready }), { time, logger: quiet });
    m.unmount();
    resolve({ failed: [] });
    await m.ready;
    expect(log.filter((l) => l.includes('model-uji'))).toEqual([]);
  });

  it('region stadion: mount → unmount 3× kembali ke scene kosong, scope dilepas', async () => {
    for (let i = 0; i < 3; i += 1) {
      const app = fakeApp();
      const scopes = [];
      const createScope = (name) => { const s = createResourceScope(name); scopes.push(s); return s; };
      const m = await mountRegion(app, stadionRegion, { createScope, logger: quiet });
      expect(app.runner.ids).toEqual(['stadion.world']);
      m.unmount();
      expect(app.scene.children).toHaveLength(0);
      expect(app.runner.ids).toEqual([]);
      expect(scopes[0].disposed).toBe(true);
      expect(scopes[0].size).toBe(0);
    }
  }, 60000);
});

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Region minimal sah (tanpa sistem) yang memanggil `onBuild(ctx)` saat build. */
function ctxRegion(id, onBuild = () => {}) {
  return defineRegion({
    id,
    placement: { x: 100, z: -50, yaw: 0.3 },
    mask: square,
    build: async (ctx) => {
      onBuild(ctx);
      const group = new THREE.Group();
      return validateBuild({
        group,
        colliders: { isWalkable: () => true, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [],
        dispose: () => { group.removeFromParent(); ctx.scope.dispose(); },
      }, id);
    },
  });
}

describe('mountRegion: ctx M0 (terrain, heightAtLocal, schedule)', () => {
  it('ctx.terrain default datar; heightAtLocal mengubah titik lokal ke dunia lewat placement', async () => {
    let seen = null;
    await mountRegion(fakeApp(), ctxRegion('datar', (ctx) => { seen = ctx; }), { logger: quiet });
    expect(seen.terrain).toBe(FLAT_TERRAIN);
    expect(seen.heightAtLocal(3, 4)).toBe(0);
    const calls = [];
    const terrain = { ...FLAT_TERRAIN, heightAt: (x, z) => { calls.push([x, z]); return 7; } };
    await mountRegion(fakeApp(), ctxRegion('miring', (ctx) => { seen = ctx; }), { terrain, logger: quiet });
    expect(seen.terrain).toBe(terrain);
    expect(seen.heightAtLocal(10, 0)).toBe(7);
    expect(calls[0][0]).toBeCloseTo(100 + Math.cos(0.3) * 10, 9);
    expect(calls[0][1]).toBeCloseTo(-50 - Math.sin(0.3) * 10, 9);
  });

  it('tanpa scheduler: ctx.schedule menjalankan task langsung (generator sampai habis)', async () => {
    const log = [];
    await mountRegion(fakeApp(), ctxRegion('langsung', (ctx) => {
      ctx.schedule(function* kerja() { log.push(1); yield; log.push(2); });
      log.push('build');
    }), { logger: quiet });
    expect(log).toEqual([1, 2, 'build']);
  });

  it('dengan scheduler: task milik "region:<id>", ready menunggu antrean habis', async () => {
    const scheduler = createScheduler({ now: () => 0 });
    const log = [];
    const m = await mountRegion(fakeApp(), ctxRegion('antre', (ctx) => {
      ctx.schedule(function* kerja() { log.push(1); yield; log.push(2); });
    }), { scheduler, logger: quiet });
    let ready = false;
    m.ready.then(() => { ready = true; });
    await tick();
    expect(scheduler.pending('region:antre')).toBe(1);
    expect(ready).toBe(false);
    scheduler.update();
    await tick();
    expect(log).toEqual([1, 2]);
    expect(ready).toBe(true);
  });

  it('unmount membatalkan antrean region; ready tetap selesai', async () => {
    const scheduler = createScheduler({ now: () => 0 });
    const log = [];
    const m = await mountRegion(fakeApp(), ctxRegion('batal', (ctx) => { ctx.schedule(() => log.push('jalan')); }), { scheduler, logger: quiet });
    m.unmount();
    expect(scheduler.pending()).toBe(0);
    scheduler.update();
    await m.ready;
    expect(log).toEqual([]);
  });

  it('build yang melempar membatalkan task yang sudah dijadwalkannya', async () => {
    const scheduler = createScheduler({ now: () => 0 });
    const def = defineRegion({
      id: 'rusak', placement: { x: 0, z: 0, yaw: 0 }, mask: square,
      build: async (ctx) => { ctx.schedule(() => {}); throw new Error('build rusak'); },
    });
    await expect(mountRegion(fakeApp(), def, { scheduler, logger: quiet })).rejects.toThrow(/build rusak/);
    expect(scheduler.pending()).toBe(0);
  });
});
