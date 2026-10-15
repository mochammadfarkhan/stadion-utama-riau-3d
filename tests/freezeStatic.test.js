import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { freezeStatic } from '../src/world/util/freezeStatic.js';

/** Hitung berapa kali updateMatrix() dipanggil pada semua objek saat scene.updateMatrixWorld(). */
function countUpdateMatrix(scene, objects) {
  let calls = 0;
  for (const o of objects) {
    const orig = o.updateMatrix.bind(o);
    o.updateMatrix = () => { calls += 1; orig(); };
  }
  scene.updateMatrixWorld();
  return calls;
}

function build() {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const a = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  a.position.set(5, 0, 0);
  b.position.set(0, 2, 0);
  a.add(b);
  root.add(a, c);
  scene.add(root);
  return { scene, root, a, b, c };
}

describe('freezeStatic', () => {
  it('REGRESI: setelah dibekukan, updateMatrixWorld tidak lagi memanggil updateMatrix pada subpohon', () => {
    const { scene, root, a, b, c } = build();
    expect(countUpdateMatrix(scene, [a, b, c])).toBe(3); // sebelum: tiap frame dihitung ulang
    freezeStatic(root);
    expect(countUpdateMatrix(scene, [a, b, c])).toBe(0);
  });

  it('matriks dunia dihitung benar sekali sebelum dibekukan (posisi hierarki tetap)', () => {
    const { root, a, b } = build();
    freezeStatic(root);
    const p = new THREE.Vector3();
    b.getWorldPosition(p);
    expect(p.x).toBeCloseTo(5, 6);
    expect(p.y).toBeCloseTo(2, 6);
    expect(a.matrixAutoUpdate).toBe(false);
  });

  it('anak yang ditambahkan setelah pembekuan tetap diperbarui normal', () => {
    const { scene, root } = build();
    freezeStatic(root);
    const late = new THREE.Group();
    root.add(late);
    late.position.set(3, 0, 0);
    scene.updateMatrixWorld();
    expect(late.matrixWorld.elements[12]).toBeCloseTo(3, 6);
  });

  it('mengembalikan jumlah objek yang dibekukan', () => {
    const { root } = build();
    expect(freezeStatic(root)).toBe(3);
  });
});
