import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { instanceParts } from '../src/world/siteutil/instanceParts.js';

const part = (name = 'p') => ({ geometry: new THREE.BoxGeometry(1, 1, 1), material: new THREE.MeshBasicMaterial(), name });
const spots = [
  { x: 10, z: 10 }, { x: 20, z: 30 },        // sel (0,0)
  { x: 210, z: 10 },                          // sel (1,0)
  { x: -50, z: -50 }, { x: -60, z: -10 },     // sel (-1,-1)/( -1,-1)
];

describe('instanceParts dengan cellSize', () => {
  it('tanpa cellSize: perilaku lama, satu InstancedMesh per material', () => {
    const g = instanceParts([part()], spots, 'x');
    expect(g.children).toHaveLength(1);
    expect(g.children[0].count).toBe(spots.length);
  });

  it('dengan cellSize: satu InstancedMesh per sel, total instance tetap sama', () => {
    const g = instanceParts([part('tajuk')], spots, 'x', { cellSize: 100 });
    expect(g.children.length).toBe(3);
    expect(g.children.reduce((n, m) => n + m.count, 0)).toBe(spots.length);
    expect(g.children.every((m) => m.name === 'tajuk')).toBe(true);
  });

  it('bounding sphere tiap sel hanya melingkupi instansnya (culling per sel efektif)', () => {
    const g = instanceParts([part()], spots, 'x', { cellSize: 100 });
    for (const m of g.children) expect(m.boundingSphere.radius).toBeLessThan(80);
  });

  it('posisi kosong tetap menghasilkan group kosong', () => {
    expect(instanceParts([part()], [], 'x', { cellSize: 100 }).children).toHaveLength(0);
  });
});
