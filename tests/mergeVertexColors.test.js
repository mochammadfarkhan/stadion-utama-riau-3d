import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { mergeVertexColors } from '../src/engine/mergeVertexColors.js';

const box = (mat, x) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  m.position.x = x;
  return m;
};

function sample(extra = []) {
  const g = new THREE.Group();
  g.add(
    box(new THREE.MeshStandardMaterial({ color: 0xff0000 }), 0),
    box(new THREE.MeshStandardMaterial({ color: 0x00ff00 }), 10),
    box(new THREE.MeshLambertMaterial({ color: 0x0000ff }), 20),
    box(new THREE.MeshLambertMaterial({ map: new THREE.Texture() }), 30),
    box(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 }), 40),
    ...extra,
  );
  return g;
}

describe('mergeVertexColors', () => {
  it('menggabung mesh polos jadi satu, sisanya tetap', () => {
    const src = sample();
    const texMat = src.children[3].material;
    const glass = src.children[4].material;
    const out = mergeVertexColors(src, { name: 'x' });
    expect(out.name).toBe('x');
    const merged = out.children.filter((c) => c.material.name === 'gabung:warna');
    expect(merged).toHaveLength(1);
    const geo = merged[0].geometry;
    expect(geo.index).toBeNull();
    expect(geo.attributes.position.count).toBe(3 * 36);
    const c = geo.attributes.color;
    const px = geo.attributes.position;
    const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    cols.forEach((rgb, k) => {
      for (let i = k * 36; i < (k + 1) * 36; i++) {
        const lin = new THREE.Color(rgb[0], rgb[1], rgb[2]);
        expect([c.getX(i), c.getY(i), c.getZ(i)]).toEqual([lin.r, lin.g, lin.b]);
        expect(Math.abs(px.getX(i) - k * 10)).toBeLessThanOrEqual(0.5 + 1e-6); // sudah ter-transform
      }
    });
    expect(out.children.some((m) => m.material === texMat)).toBe(true);
    expect(out.children.some((m) => m.material === glass)).toBe(true);
    expect(out.children).toHaveLength(3);
  });

  it('material gabungan dipakai bersama antar pemanggilan', () => {
    const a = mergeVertexColors(sample()).children.find((c) => c.material.name === 'gabung:warna');
    const b = mergeVertexColors(sample()).children.find((c) => c.material.name === 'gabung:warna');
    expect(a.material).toBe(b.material);
  });

  it('DoubleSide dipisah dari FrontSide', () => {
    const g = sample([box(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 50)]);
    const merged = mergeVertexColors(g).children.filter((c) => c.material.name === 'gabung:warna');
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((m) => m.material.side))).toEqual(new Set([THREE.FrontSide, THREE.DoubleSide]));
  });

  it('grup kosong menghasilkan grup kosong', () => {
    const out = mergeVertexColors(new THREE.Group());
    expect(out.isGroup).toBe(true);
    expect(out.children).toHaveLength(0);
  });
});
