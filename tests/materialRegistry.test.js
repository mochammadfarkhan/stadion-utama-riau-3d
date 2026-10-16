import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMaterialRegistry } from '../src/engine/materialRegistry.js';

const meshWith = (mat, name = '') => Object.assign(new THREE.Mesh(new THREE.BoxGeometry(), mat), { name });
const groupOf = (...children) => {
  const g = new THREE.Group();
  g.add(...children);
  return g;
};
const red = () => new THREE.MeshBasicMaterial({ color: 0xff0000 });
const selectRed = (mat) => (mat.color?.getHex() === 0xff0000 ? { mat } : null);

describe('createMaterialRegistry', () => {
  it('mendaftarkan material terpilih sekali per uuid; material array dilewati', () => {
    const r = red();
    const blue = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const reg = createMaterialRegistry(selectRed);
    reg.register(groupOf(meshWith(r), meshWith(r), meshWith(blue), meshWith([r, blue])));
    expect(reg.size).toBe(1);
    expect(reg.entries.map((e) => e.mat)).toEqual([r]);
    reg.clear();
    expect(reg.size).toBe(0);
  });

  it('material bersama dua root: onRemove hanya saat root terakhir dilepas', () => {
    const r = red();
    const removed = [];
    const reg = createMaterialRegistry(selectRed, { onRemove: (e) => removed.push(e.mat) });
    const a = groupOf(meshWith(r));
    const b = groupOf(meshWith(r));
    const offA = reg.register(a);
    reg.register(b);
    expect(offA()).toBe(true);
    expect(reg.size).toBe(1);
    expect(removed).toEqual([]);
    expect(reg.unregister(b)).toBe(true);
    expect(reg.size).toBe(0);
    expect(removed).toEqual([r]);
    expect(reg.unregister(b)).toBe(false);
  });

  it('register root yang sama dua kali idempoten; clear memanggil onRemove sekali', () => {
    const removed = [];
    const reg = createMaterialRegistry(selectRed, { onRemove: (e) => removed.push(e) });
    const root = groupOf(meshWith(red()));
    reg.register(root);
    reg.register(root);
    expect(reg.size).toBe(1);
    reg.clear();
    expect(removed).toHaveLength(1);
  });

  it('select menerima objek pemilik (mis. filter nama mesh)', () => {
    const mat = new THREE.MeshBasicMaterial();
    const reg = createMaterialRegistry((m, o) => (o.name === 'aspal' ? { m } : null));
    reg.register(groupOf(meshWith(mat, 'lain')));
    expect(reg.size).toBe(0);
    reg.register(groupOf(meshWith(mat, 'aspal')));
    expect(reg.size).toBe(1);
  });

  it('select dan root tidak valid melempar', () => {
    expect(() => createMaterialRegistry(null)).toThrow(TypeError);
    expect(() => createMaterialRegistry(selectRed).register({})).toThrow(TypeError);
  });
});
