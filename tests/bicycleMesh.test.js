import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBicycleMesh } from '../src/entities/Bicycle.mesh.js';
import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';

const build = (opts) => withScope(createResourceScope(), () => createBicycleMesh(opts));
const countMeshes = (root) => { let n = 0; root.traverse((o) => { if (o.isMesh) n += 1; }); return n; };

describe('mesh sepeda digabung per pivot', () => {
  it('jauh lebih sedikit mesh, pivot bergerak tetap ada', () => {
    const a = build({ merge: false });
    const b = build({});
    expect(countMeshes(b.group)).toBeLessThanOrEqual(22);
    expect(countMeshes(b.group)).toBeLessThan(countMeshes(a.group) - 12);
    for (const k of ['frame', 'steer', 'wheelF', 'wheelR', 'crankL', 'crankR', 'saddleMount']) expect(b.parts[k].isObject3D).toBe(true);
    expect(b.parts.wheelF.parent).toBe(b.parts.steer);
    expect(b.parts.steer.parent).toBe(b.parts.frame);
  });

  it('kotak pembatas sama dengan sebelum digabung (1 mm), juga saat kemudi & pedal diputar', () => {
    const a = build({ merge: false });
    const b = build({});
    for (const m of [a, b]) {
      m.parts.steer.rotation.y = 0.4;
      m.parts.crankL.rotation.x = 1.1;
      m.group.updateMatrixWorld(true);
    }
    const ba = new THREE.Box3().setFromObject(a.group, true);
    const bb = new THREE.Box3().setFromObject(b.group, true);
    for (const k of ['x', 'y', 'z']) {
      expect(bb.min[k]).toBeCloseTo(ba.min[k], 3);
      expect(bb.max[k]).toBeCloseTo(ba.max[k], 3);
    }
  });
});
