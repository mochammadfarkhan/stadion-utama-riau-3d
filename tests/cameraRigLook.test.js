// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';

const make = () => new CameraRig(new THREE.PerspectiveCamera(60, 1, 0.1, 100), document.createElement('canvas'));

describe('CameraRig.lookBy', () => {
  it('geser horizontal mengubah yaw (kanan = yawOffset berkurang) sebanding sensitivitas', () => {
    const rig = make();
    rig.lookBy(100, 0);
    const base = rig.yawOffset;
    expect(base).toBeLessThan(0);
    rig.yawOffset = 0;
    rig.sensitivity = 2;
    rig.lookBy(100, 0);
    expect(rig.yawOffset).toBeCloseTo(base * 2, 6);
  });

  it('geser vertikal mengubah pitch dan dijepit di batas', () => {
    const rig = make();
    const before = rig.pitch;
    rig.lookBy(0, 50);
    expect(rig.pitch).toBeGreaterThan(before);
    rig.lookBy(0, 1e9);
    const max = rig.pitch;
    rig.lookBy(0, 1e9);
    expect(rig.pitch).toBe(max);
    rig.lookBy(0, -1e12);
    expect(rig.pitch).toBeLessThan(0);
    expect(rig.pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it('parameter scale melipatgandakan (drag sentuh lebih peka)', () => {
    const a = make(); const b = make();
    a.lookBy(40, 0);
    b.lookBy(40, 0, 2);
    expect(b.yawOffset).toBeCloseTo(a.yawOffset * 2, 6);
  });

  it('nilai non-hingga diabaikan', () => {
    const rig = make();
    rig.lookBy(Number.NaN, Number.POSITIVE_INFINITY);
    expect(Number.isFinite(rig.yawOffset)).toBe(true);
    expect(Number.isFinite(rig.pitch)).toBe(true);
  });
});
