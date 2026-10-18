import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWetSurfaces } from '../src/world/Weather.wet.js';
import { WEATHER } from '../src/config/constants.js';

describe('Weather.wet bendera userData.wetSurface', () => {
  it('mesh bertanda ikut basah walau namanya bukan nama registry; mesh lain tidak', () => {
    const wet = createWetSurfaces(new THREE.Group());
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.name = 'terrain:-2_1';
    mesh.userData.wetSurface = true;
    const plain = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    plain.name = 'lain';
    const root = new THREE.Group();
    root.add(mesh, plain);
    wet.register(root);
    expect(wet.count).toBe(1);
    wet.update(0, 1);
    expect(mat.color.r).toBeCloseTo(WEATHER.wetDarken, 6);
    expect(mat.roughness).toBeCloseTo(WEATHER.wetRoughness, 6);
  });
});
