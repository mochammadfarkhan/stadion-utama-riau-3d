import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { watchWarmup } from '../src/app/warmGate.js';

const mesh = (cold) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  m.userData.cold = cold;
  return m;
};

function fakeApp() {
  const pending = [];
  return {
    pending,
    needsWarmup: (root) => { let n = false; root.traverse((o) => { if (o.userData.cold) n = true; }); return n; },
    warmup: () => new Promise((resolve) => pending.push(resolve)),
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('warmGate', () => {
  it('anak dingin disembunyikan sampai hangat; anak hangat tampil seketika', async () => {
    const root = new THREE.Group();
    const app = fakeApp();
    watchWarmup(root, app);
    const cold = new THREE.Group().add(mesh(true));
    const warm = new THREE.Group().add(mesh(false));
    root.add(cold, warm);
    expect(cold.visible).toBe(false);
    expect(warm.visible).toBe(true);
    app.pending.forEach((r) => r());
    await flush();
    expect(cold.visible).toBe(true);
  });

  it('kontainer kosong (lapisan baru) ikut diawasi; lepas pengawas menghentikan semuanya', async () => {
    const root = new THREE.Group();
    const app = fakeApp();
    const unwatch = watchWarmup(root, app);
    const layer = new THREE.Group();
    root.add(layer);
    const chunk = new THREE.Group().add(mesh(true));
    layer.add(chunk);
    expect(chunk.visible).toBe(false);
    unwatch();
    const later = new THREE.Group().add(mesh(true));
    layer.add(later);
    expect(later.visible).toBe(true);
  });

  it('kontainer yang sudah berisi juga diawasi (isi baru di dalamnya dihangatkan)', () => {
    const root = new THREE.Group();
    const life = new THREE.Group().add(mesh(false)); // lapisan kehidupan: sudah ada NPC
    root.add(life);
    const app = fakeApp();
    watchWarmup(root, app);
    const parking = new THREE.Group();
    life.add(parking);
    const area = new THREE.Group().add(mesh(true));
    parking.add(area);
    expect(area.visible).toBe(false);
  });

  it('anak yang dilepas sebelum hangat tidak ditampilkan kembali', async () => {
    const root = new THREE.Group();
    const app = fakeApp();
    watchWarmup(root, app);
    const c = new THREE.Group().add(mesh(true));
    root.add(c);
    root.remove(c);
    app.pending.forEach((r) => r());
    await flush();
    expect(c.visible).toBe(false);
  });
});
