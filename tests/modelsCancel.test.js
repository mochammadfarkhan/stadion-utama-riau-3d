import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// GLTFLoader tiruan: setiap loadAsync ditahan sampai di-resolve manual dari tes.
const held = vi.hoisted(() => []);
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    loadAsync(url) {
      return new Promise((resolve, reject) => { held.push({ url, resolve, reject }); });
    }
  },
}));

const { placeModels } = await import('../src/world/assets/models.js');
const { withScope, createResourceScope } = await import('../src/engine/ResourceScope.js');
const { stadionRegion } = await import('../src/regions/stadion/index.js');
const { mountRegion } = await import('../src/app/mountRegion.js');
const { createSystemRunner } = await import('../src/engine/SystemRunner.js');

const quiet = { error() {} };
const fakeScene = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  return { scene };
};
const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); };

beforeEach(() => { held.length = 0; });

describe('placeModels: isCancelled', () => {
  it('berhenti sebelum group.add bila isCancelled() true saat muatan selesai', async () => {
    const scope = createResourceScope('uji');
    const group = new THREE.Group();
    let cancelled = false;
    const p = withScope(scope, () => placeModels(group, [{ path: 'models/a.glb' }], { isCancelled: () => cancelled }));
    expect(held).toHaveLength(1);
    cancelled = true;
    held[0].resolve(fakeScene());
    const res = await p;
    expect(group.children).toHaveLength(0);
    expect(res).toMatchObject({ placed: 0, failed: [], cancelled: true });
    scope.dispose();
  });

  it('tanpa pembatalan model tetap dipasang', async () => {
    const scope = createResourceScope('uji');
    const group = new THREE.Group();
    const p = withScope(scope, () => placeModels(group, [{ path: 'models/b.glb' }], { isCancelled: () => false }));
    held[0].resolve(fakeScene());
    const res = await p;
    expect(group.children).toHaveLength(1);
    expect(res.placed).toBe(1);
    scope.dispose();
  });
});

describe('region stadion: model GLB yang selesai setelah unmount', () => {
  const fakeApp = () => {
    const runner = createSystemRunner({ logger: quiet });
    return { scene: new THREE.Scene(), addSystem: (s) => runner.add(s), removeSystem: (id) => runner.remove(id) };
  };

  it('unmount sebelum muatan selesai → lateRoot tetap kosong', async () => {
    const m = await mountRegion(fakeApp(), stadionRegion, { logger: quiet });
    expect(held.length).toBeGreaterThan(0);
    const lateRoot = m.region.lateRoot;
    m.unmount();
    for (const h of held) h.resolve(fakeScene());
    const res = await m.ready;
    await flush();
    expect(lateRoot.children).toHaveLength(0);
    expect(res.failed).toEqual([]);
  }, 30000);

  it('muatan yang gagal setelah unmount tidak dilaporkan sebagai gagal', async () => {
    const m = await mountRegion(fakeApp(), stadionRegion, { logger: quiet });
    m.unmount();
    for (const h of held) h.reject(new Error('jaringan'));
    const res = await m.ready;
    expect(res.failed).toEqual([]);
    expect(res.cancelled).toBe(true);
  }, 30000);
});
