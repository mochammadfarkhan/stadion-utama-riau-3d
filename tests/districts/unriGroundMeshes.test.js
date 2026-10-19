import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { dashIntervals, mergedMesh, tintTerrainRoot } from '../../src/districts/unri/ground.js';
import { waterPlaneGeometry } from '../../src/districts/unri/water.js';
import { surfaceTints } from '../../src/districts/unri/surfaceTint.js';
import { drapePolyline } from '../../src/world/terrain/drape.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };

describe('ground runtime', () => {
  it('dashIntervals: 3 m garis / 5 m celah mulai 2,5 m', () => {
    expect(dashIntervals(20)).toEqual([[2.5, 5.5], [10.5, 13.5]]);
    expect(dashIntervals(4)).toEqual([]);
  });

  it('mergedMesh: gabung per material, buang geometri kosong, tandai milik chunk; semua kosong → null', () => {
    const mat = new THREE.MeshBasicMaterial();
    const a = drapePolyline([[0, 0], [10, 0]], 2, flat);
    const b = drapePolyline([[0, 5], [10, 5]], 2, flat);
    const count = a.index.count + b.index.count;
    const mesh = mergedMesh([a, drapePolyline([[0, 0]], 2, flat), b], mat, 'aspal+0_0');
    expect(mesh.name).toBe('aspal+0_0');
    expect(mesh.geometry.index.count).toBe(count);
    expect(mesh.userData.ownsGeometry).toBe(true);
    expect(mergedMesh([drapePolyline([[0, 0]], 2, flat)], mat, 'x')).toBeNull();
  });

  it('waterPlaneGeometry: datar di muka air, menghadap atas, lubang dihormati', () => {
    const g = waterPlaneGeometry([[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]], -0.4);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 1) expect(p.getY(i)).toBeCloseTo(-0.4, 6);
    let area = 0;
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const [a, b, c] = [ix[i], ix[i + 1], ix[i + 2]];
      const up = (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)) - (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a));
      expect(up).toBeGreaterThan(0);
      area += up / 2;
    }
    expect(area).toBeCloseTo(96, 4);
  });

  it('tintTerrainRoot: warna vertex dari posisi dunia, material diganti, ditandai permukaan basah', () => {
    const geo = new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    mesh.position.set(2, 0, 2);
    const root = new THREE.Group();
    root.add(mesh);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const tints = surfaceTints();
    const weights = { n: 2, grass: Uint8Array.from([255, 0, 255, 0]), soil: Uint8Array.from([0, 255, 0, 255]), wet: new Uint8Array(4) };
    tintTerrainRoot(root, weights, { x: 0, z: 0 }, mat, tints);
    expect(mesh.material).toBe(mat);
    expect(mesh.userData.wetSurface).toBe(true);
    const col = geo.getAttribute('color');
    const pos = geo.getAttribute('position');
    for (let i = 0; i < col.count; i += 1) {
      const worldX = pos.getX(i) + 2;
      expect(col.getX(i)).toBeCloseTo(worldX === 0 ? 1 : tints.soil[0], 5);
    }
  });
});
