import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHumanoid } from '../src/entities/Humanoid.js';
import { lodLevelFor, createHumanoidLod, LOD_NEAR, LOD_FAR } from '../src/entities/Humanoid.lod.js';

describe('lodLevelFor', () => {
  it('0 dekat, 1 menengah, 2 (sembunyi) jauh; batas inklusif ke level lebih detail', () => {
    expect(lodLevelFor(0)).toBe(0);
    expect(lodLevelFor(LOD_NEAR * LOD_NEAR)).toBe(0);
    expect(lodLevelFor(LOD_NEAR * LOD_NEAR + 1)).toBe(1);
    expect(lodLevelFor(LOD_FAR * LOD_FAR)).toBe(1);
    expect(lodLevelFor(LOD_FAR * LOD_FAR + 1)).toBe(2);
  });
  it('ambang kustom (mahasiswa kampus: 30 / 220 m)', () => {
    expect(lodLevelFor(30 * 30, 30, 220)).toBe(0);
    expect(lodLevelFor(31 * 31, 30, 220)).toBe(1);
    expect(lodLevelFor(221 * 221, 30, 220)).toBe(2);
  });
  it('NaN diperlakukan sebagai terdekat (aman: jangan menghilangkan humanoid)', () => {
    expect(lodLevelFor(Number.NaN)).toBe(0);
  });
});

describe('createHumanoid: mesh LOD gabungan', () => {
  const h = createHumanoid({ shirt: 0xff0000, pants: 0x0000ff, skin: 0xffcc99, hairColor: 0x222222 });

  it('menyediakan lod.mesh satu draw call dengan warna per-vertex dan tanpa bayangan', () => {
    const { mesh } = h.group.userData.humanoidLod;
    expect(mesh.isMesh).toBe(true);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.geometry.attributes.color).toBeDefined();
    expect(mesh.geometry.attributes.position.count).toBe(mesh.geometry.attributes.color.count);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.visible).toBe(false); // awal: level 0 (detail penuh)
  });

  it('jumlah vertex gabungan = jumlah semua mesh bagian tubuh (tanpa bagian hilang)', () => {
    const { mesh } = h.group.userData.humanoidLod;
    const { body } = h.parts;
    let expected = 0;
    body.updateWorldMatrix(false, true);
    body.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      expected += g.attributes.position.count;
    });
    expect(mesh.geometry.attributes.position.count).toBe(expected);
  });

  it('warna kaos, celana, dan kulit semuanya hadir di atribut warna', () => {
    const { mesh } = h.group.userData.humanoidLod;
    const col = mesh.geometry.attributes.color;
    const c = new THREE.Color();
    const has = (hex) => {
      const target = new THREE.Color(hex);
      for (let i = 0; i < col.count; i += 1) {
        c.fromBufferAttribute(col, i);
        if (Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b) < 0.01) return true;
      }
      return false;
    };
    for (const hex of [0xff0000, 0x0000ff, 0xffcc99]) expect(has(hex)).toBe(true);
  });
});

describe('createHumanoidLod (pengelola)', () => {
  const makeAt = (x) => {
    const h = createHumanoid({});
    h.group.position.set(x, 0, 0);
    return h;
  };

  it('mengatur visibilitas body/lod/keduanya sesuai jarak ke kamera', () => {
    const root = new THREE.Group();
    const near = makeAt(10); const mid = makeAt(LOD_NEAR + 20); const far = makeAt(LOD_FAR + 50);
    root.add(near.group, mid.group, far.group);
    root.updateMatrixWorld(true);
    const lod = createHumanoidLod();
    expect(lod.addFrom(root)).toBe(3);
    lod.update(new THREE.Vector3(0, 0, 0));
    expect([near.parts.body.visible, near.group.userData.humanoidLod.mesh.visible]).toEqual([true, false]);
    expect([mid.parts.body.visible, mid.group.userData.humanoidLod.mesh.visible]).toEqual([false, true]);
    expect([far.parts.body.visible, far.group.userData.humanoidLod.mesh.visible]).toEqual([false, false]);
  });

  it('kembali ke detail penuh saat kamera mendekat lagi, tanpa duplikat registrasi', () => {
    const root = new THREE.Group();
    const h = makeAt(LOD_FAR + 50);
    root.add(h.group);
    root.updateMatrixWorld(true);
    const lod = createHumanoidLod();
    lod.addFrom(root);
    lod.addFrom(root); // idempoten
    expect(lod.size).toBe(1);
    lod.update(new THREE.Vector3(0, 0, 0));
    expect(h.parts.body.visible).toBe(false);
    lod.update(new THREE.Vector3(LOD_FAR + 50, 0, 3));
    expect(h.parts.body.visible).toBe(true);
    expect(h.group.userData.humanoidLod.mesh.visible).toBe(false);
  });
});
