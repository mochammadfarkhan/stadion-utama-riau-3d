import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { disposeTree } from '../src/engine/disposeTree.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';

const track = (res) => {
  let n = 0;
  res.addEventListener('dispose', () => { n += 1; });
  return () => n;
};

describe('disposeTree', () => {
  it('melepas geometri, material (termasuk array), tekstur material & uniform, sekali per sumber daya', () => {
    const root = new THREE.Group();
    const geo = new THREE.BoxGeometry();
    const map = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map });
    const uniformTex = new THREE.Texture();
    const shader = new THREE.ShaderMaterial({ uniforms: { uTex: { value: uniformTex } } });
    const matB = new THREE.MeshBasicMaterial();
    root.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, [mat, matB]));
    const child = new THREE.Group();
    child.add(new THREE.Points(new THREE.BufferGeometry(), shader));
    root.add(child);
    const counters = [geo, map, mat, uniformTex, shader, matB].map(track);
    const res = disposeTree(root);
    expect(counters.map((c) => c())).toEqual([1, 1, 1, 1, 1, 1]);
    expect(res).toEqual({ geometries: 2, materials: 3, textures: 2 });
    expect(root.children).toHaveLength(0);
  });

  it('InstancedMesh ikut di-dispose (atribut instans)', () => {
    const root = new THREE.Group();
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);
    root.add(mesh);
    const n = track(mesh);
    disposeTree(root);
    expect(n()).toBe(1);
  });

  it('sumber daya milik ResourceScope dilewati (dilepas scope, bukan pohon)', () => {
    const scope = createResourceScope('uji');
    const shared = scope.get('mat', () => new THREE.MeshBasicMaterial());
    const own = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(own, shared));
    const nShared = track(shared);
    const nOwn = track(own);
    disposeTree(root, { scope });
    expect(nShared()).toBe(0);
    expect(nOwn()).toBe(1);
    scope.dispose();
    expect(nShared()).toBe(1);
  });

  it('root null atau kosong aman', () => {
    expect(disposeTree(null)).toEqual({ geometries: 0, materials: 0, textures: 0 });
    expect(disposeTree(new THREE.Group())).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });
});
