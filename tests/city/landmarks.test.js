import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LANDMARKS, LANDMARK_PASSABLE, LANDMARK_WALK_RANGE, createLandmarks, footprintRing, landmarkDistance, pickLod } from '../../src/city/landmarks.js';

describe('pickLod', () => {
  const lim = [260, 900];
  it('memilih tingkat menurut jarak', () => {
    expect(pickLod(50, 0, lim)).toBe(0);
    expect(pickLod(500, 0, lim)).toBe(1);
    expect(pickLod(2000, 0, lim)).toBe(2);
  });
  it('histeresis: tidak berkedip tepat di batas', () => {
    expect(pickLod(270, 0, lim)).toBe(0); // naik butuh > 260*1,12
    expect(pickLod(300, 0, lim)).toBe(1);
    expect(pickLod(250, 1, lim)).toBe(1); // turun butuh < 260*0,88
    expect(pickLod(220, 1, lim)).toBe(0);
  });
});

describe('landmarkDistance', () => {
  it('menambah jarak mendatar fokus → landmark', () => {
    const lm = { x: 300, z: 400 };
    expect(landmarkDistance(0, { x: 0, z: 0 }, lm)).toBeCloseTo(500);
    expect(landmarkDistance(100, { x: 300, z: 400 }, lm)).toBeCloseTo(100);
  });
});

describe('LANDMARKS (daftar)', () => {
  it('id unik, koordinat berhingga, berkas ada di public/models/landmark', async () => {
    const { existsSync } = await import('node:fs');
    const ids = new Set();
    for (const lm of LANDMARKS) {
      expect(ids.has(lm.id)).toBe(false);
      ids.add(lm.id);
      expect(Number.isFinite(lm.x) && Number.isFinite(lm.z)).toBe(true);
      for (const f of lm.files) expect(existsSync(new URL(`../../public/models/landmark/${f}`, import.meta.url))).toBe(true);
    }
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(26);
  });
});

describe('LANDMARKS', () => {
  it('tiap landmark punya 3 berkas LOD dan batas menaik', () => {
    for (const lm of LANDMARKS) {
      expect(lm.files).toHaveLength(3);
      expect(lm.lod[0]).toBeLessThan(lm.lod[1]);
    }
  });
});

describe('createLandmarks (muat malas)', () => {
  const list = [
    { id: 'dekat', x: 500, z: 0, yaw: 0, files: ['a0.glb', 'a1.glb', 'a2.glb'], lod: [1300, 2800] },
    { id: 'jauh', x: 5000, z: 0, yaw: 0, files: ['b0.glb', 'b1.glb', 'b2.glb'], lod: [1300, 2800] },
  ];
  const make = () => {
    const urls = [];
    const loadGltf = async (url) => {
      urls.push(url);
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      return { scene };
    };
    const lm = createLandmarks({ parent: new THREE.Group(), loadGltf, list, logger: { error() {} } });
    return { lm, urls, root: (id) => lm.group.children.find((c) => c.name === `landmark:${id}`) };
  };
  const focus = { x: 0, z: 0 };

  it('tanpa update, loader belum dipanggil', () => {
    const { lm, urls } = make();
    expect(urls).toHaveLength(0);
    expect(lm.stats().loaded).toBe(0);
    expect(LANDMARK_WALK_RANGE).toBeGreaterThan(500);
  });

  it('update memuat hanya landmark dalam jangkauan; yang jauh tersembunyi', async () => {
    const { lm, urls, root } = make();
    lm.update({ focus, distance: 10 });
    await lm.ready;
    lm.update({ focus, distance: 10 });
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.includes('/a'))).toBe(true);
    expect(root('dekat').visible).toBe(true);
    expect(root('dekat').children.some((m) => m.visible)).toBe(true);
    expect(root('jauh')).toBeUndefined(); // tak dimuat → belum masuk grup
    expect(lm.stats().loaded).toBe(1);
  });

  it('setPreview(true) memuat & menampilkan landmark jauh; kembali ke jangkauan jalan menyembunyikannya', async () => {
    const { lm, urls, root } = make();
    lm.setPreview(true);
    lm.update({ focus, distance: 10 });
    await lm.ready;
    lm.update({ focus, distance: 10 });
    expect(urls).toHaveLength(6);
    expect(root('jauh').visible).toBe(true);
    lm.setPreview(false);
    lm.update({ focus, distance: 10 });
    expect(root('jauh').visible).toBe(false);
    expect(root('dekat').visible).toBe(true);
  });

  it('partRecipes: root mendapat anak `potongan` yang tampak hanya saat LOD0', async () => {
    const urls = [];
    const loadGltf = async (url) => {
      urls.push(url);
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      return { scene };
    };
    const partRecipes = { dekat: { frame: { cx: 0, cy: 0, ang: 0 }, rules: [{ part: 'ac', at: [[0, 0, 5], [1, 0, 5]] }] } };
    const lm = createLandmarks({ parent: new THREE.Group(), loadGltf, list, logger: { error() {} }, partRecipes, partFiles: { ac: 'ac.glb' } });
    lm.update({ focus, distance: 10 });
    await lm.ready;
    lm.update({ focus, distance: 10 });
    const r = lm.group.children.find((c) => c.name === 'landmark:dekat');
    const parts = r.children.find((c) => c.name === 'potongan');
    expect(parts).toBeDefined();
    expect(urls.filter((u) => u.includes('/potongan/'))).toHaveLength(1);
    expect(parts.visible).toBe(true);
    lm.update({ focus, distance: 2000 }); // ±2060 m → LOD1
    expect(parts.visible).toBe(false);
    lm.update({ focus, distance: 5000 }); // LOD2
    expect(parts.visible).toBe(false);
    lm.update({ focus, distance: 10 });
    expect(parts.visible).toBe(true);
    expect(lm.stats().parts).toEqual({ types: 1, instances: 2 });
    lm.dispose();
    expect(r.children.includes(parts)).toBe(false);
  });
});

describe('footprintRing', () => {
  it('hull: 4 sudut persegi, titik dalam dibuang', () => {
    const ring = footprintRing([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5], [3, 7]]);
    expect(ring).toHaveLength(4);
    expect(ring.map((p) => p.join()).sort()).toEqual(['0,0', '0,10', '10,0', '10,10']);
  });
  it('kurang dari 3 titik → []', () => {
    expect(footprintRing([[0, 0], [1, 1]])).toEqual([]);
    expect(footprintRing([])).toEqual([]);
  });
});

describe('createLandmarks + collider', () => {
  const list = [
    { id: 'gedung', x: 500, z: 100, yaw: 0, files: ['a0.glb', 'a1.glb', 'a2.glb'], lod: [1300, 2800] },
    { id: 'flyover-ska', x: 600, z: 100, yaw: 0, files: ['b0.glb', 'b1.glb', 'b2.glb'], lod: [1300, 2800] },
  ];
  it('mendaftarkan jejak landmark biasa, melewati yang PASSABLE, dan dispose menghapus', async () => {
    const calls = { add: [], remove: [] };
    const collider = { addBuildings: (k, r) => calls.add.push([k, r]), removeObstacles: (k) => calls.remove.push(k) };
    const loadGltf = async () => {
      const geo = new THREE.BoxGeometry(20, 10, 30);
      geo.translate(0, 5, 0);
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(geo));
      return { scene };
    };
    const lm = createLandmarks({ parent: new THREE.Group(), loadGltf, list, logger: { error() {} }, collider });
    expect(LANDMARK_PASSABLE.has('flyover-ska')).toBe(true);
    lm.setPreview(true);
    lm.update({ focus: { x: 500, z: 100 }, distance: 10 });
    await lm.ready;
    expect(calls.add).toHaveLength(1);
    const [key, rings] = calls.add[0];
    expect(key).toBe('landmark:gedung');
    const xs = rings[0].map((p) => p[0]);
    const zs = rings[0].map((p) => p[1]);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([490, 510]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([85, 115]);
    expect(lm.stats().colliders).toBe(1);
    lm.dispose();
    expect(calls.remove).toEqual(['landmark:gedung']);
  });
});
