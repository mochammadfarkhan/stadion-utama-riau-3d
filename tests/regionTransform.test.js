import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { toLocal, toWorld } from '../src/geo/regionTransform.js';

describe('regionTransform', () => {
  it('placement identitas tidak mengubah koordinat', () => {
    const id = { x: 0, z: 0, yaw: 0 };
    expect(toWorld(id, 3, -4)).toEqual({ x: 3, z: -4 });
    expect(toLocal(id, 3, -4)).toEqual({ x: 3, z: -4 });
  });
  it('toWorld sama dengan transform Object3D (position + rotation.y)', () => {
    const p = { x: 120, z: -40, yaw: 0.7 };
    const obj = new THREE.Object3D();
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = p.yaw;
    obj.updateMatrixWorld(true);
    const v = obj.localToWorld(new THREE.Vector3(10, 0, -25));
    const w = toWorld(p, 10, -25);
    expect(w.x).toBeCloseTo(v.x, 9);
    expect(w.z).toBeCloseTo(v.z, 9);
  });
  it('toLocal kebalikan toWorld', () => {
    const p = { x: -500, z: 12000, yaw: -2.1 };
    const w = toWorld(p, 33.5, -71.25);
    const l = toLocal(p, w.x, w.z);
    expect(l.x).toBeCloseTo(33.5, 9);
    expect(l.z).toBeCloseTo(-71.25, 9);
  });
  it('placement tidak lengkap melempar', () => {
    expect(() => toLocal({ x: 0, z: 0 }, 1, 1)).toThrow(TypeError);
    expect(() => toWorld(null, 1, 1)).toThrow(TypeError);
  });
});
