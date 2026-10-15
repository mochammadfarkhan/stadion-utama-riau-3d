import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { floodLensPositions, haloLevel } from '../src/world/NightHalos.js';

function sceneWithLens() {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial();
  mat.name = 'lensaFloodlight';
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.05), mat, 2);
  mesh.name = 'floodLens';
  const m = new THREE.Matrix4();
  mesh.setMatrixAt(0, m.makeTranslation(10, 30, -5));
  mesh.setMatrixAt(1, m.makeTranslation(-20, 31, 8));
  mesh.instanceMatrix.needsUpdate = true;
  const root = new THREE.Group();
  root.position.set(100, 0, 0); // induk bergeser: posisi harus dalam koordinat DUNIA
  root.add(mesh);
  scene.add(root);
  scene.updateMatrixWorld(true);
  return scene;
}

describe('floodLensPositions', () => {
  it('mengambil posisi dunia tiap instans lensa (termasuk transform induk)', () => {
    const p = floodLensPositions(sceneWithLens());
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ x: 110, y: 30, z: -5 });
    expect(p[1]).toMatchObject({ x: 80, y: 31, z: 8 });
  });
  it('scene tanpa lensa: daftar kosong (tidak melempar)', () => {
    expect(floodLensPositions(new THREE.Scene())).toEqual([]);
  });
});

describe('haloLevel', () => {
  it('0 di siang hari, 1 saat lampu penuh, terjepit 0..1, NaN aman', () => {
    expect(haloLevel(0)).toBe(0);
    expect(haloLevel(1)).toBe(1);
    expect(haloLevel(2)).toBe(1);
    expect(haloLevel(-1)).toBe(0);
    expect(haloLevel(Number.NaN)).toBe(0);
  });
  it('kurva halus: di tengah transisi kurang dari linear (halo muncul belakangan agar tidak mencolok saat senja)', () => {
    expect(haloLevel(0.5)).toBeLessThan(0.5);
    expect(haloLevel(0.5)).toBeGreaterThan(0);
  });
});
