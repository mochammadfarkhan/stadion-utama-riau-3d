import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HERO_LOD, createHeroLodSystem, itemExtent, midLodTargets } from '../src/regions/heroLod.js';

const box = (w, h, d, name = '') => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  m.name = name;
  return m;
};

function instanced(size, count, spread) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial(), count);
  for (let i = 0; i < count; i += 1) m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * spread, 0, 0));
  return m;
}

describe('heroLod: klasifikasi detail', () => {
  it('instans dinilai per benda, bukan sebaran seluruh instans', () => {
    expect(itemExtent(instanced(1.9, 50, 4))).toBeCloseTo(1.9);
  });

  it('massa besar tetap, mesh kecil/instans kecil/material detail disembunyikan', () => {
    const root = new THREE.Group();
    const dinding = box(21, 7, 20, 'H01-dinding:dindingKrem');
    const papan = box(2, 0.4, 0.1, 'x');
    const nako = box(19, 1, 19, 'H01-bukaan:kacaNako+320');
    const motor = instanced(1.9, 40, 3);
    const pohon = instanced(12, 10, 20);
    root.add(dinding, papan, nako, motor, pohon);
    root.updateMatrixWorld(true);
    const t = midLodTargets(root);
    expect(t).toEqual(expect.arrayContaining([papan, nako, motor]));
    expect(t).not.toContain(dinding);
    expect(t).not.toContain(pohon);
  });
});

describe('heroLod: sistem histeresis per rakitan', () => {
  it('sembunyikan lewat layer 0 di luar hideAt, tampil lagi di bawah showAt, pulih saat dispose', () => {
    const root = new THREE.Group();
    const rakitan = new THREE.Group();
    const papan = box(1, 1, 1);
    rakitan.add(box(30, 6, 30), papan);
    root.add(rakitan);
    root.updateMatrixWorld(true);
    const sys = createHeroLodSystem({ id: 'uji', root });
    const at = (x) => sys.update(0.016, { focus: { x, z: 0 } });
    at(HERO_LOD.hideAt - 10);
    expect(papan.layers.isEnabled(0)).toBe(true);
    at(HERO_LOD.hideAt + 10);
    expect(papan.layers.isEnabled(0)).toBe(false);
    at((HERO_LOD.hideAt + HERO_LOD.showAt) / 2); // zona histeresis: tetap tersembunyi
    expect(papan.layers.isEnabled(0)).toBe(false);
    at(HERO_LOD.showAt - 10);
    expect(papan.layers.isEnabled(0)).toBe(true);
    at(HERO_LOD.hideAt + 10);
    sys.dispose();
    expect(papan.layers.isEnabled(0)).toBe(true);
  });
});
