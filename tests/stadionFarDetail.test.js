import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { FAR_DETAIL, applyFarHidden, createFarGate, nextFarHidden } from '../src/regions/stadion/farDetail.js';

describe('detail stadion jauh', () => {
  it('menyembunyikan di atas hideAt dan menampilkan di bawah showAt (histeresis)', () => {
    expect(nextFarHidden(false, FAR_DETAIL.hideAt - 1)).toBe(false);
    expect(nextFarHidden(false, FAR_DETAIL.hideAt + 1)).toBe(true);
    expect(nextFarHidden(true, FAR_DETAIL.showAt + 1)).toBe(true); // di antara batas: tetap tersembunyi
    expect(nextFarHidden(true, FAR_DETAIL.showAt - 1)).toBe(false);
    expect(nextFarHidden(false, (FAR_DETAIL.hideAt + FAR_DETAIL.showAt) / 2)).toBe(false); // di antara batas: tetap tampil
  });
  it('jarak tak valid tidak mengubah status', () => {
    expect(nextFarHidden(true, Number.NaN)).toBe(true);
    expect(nextFarHidden(false, Infinity)).toBe(false);
  });
  it('applyFarHidden mematikan layer 0 pada seluruh turunan dan tidak menyentuh visible', () => {
    const root = new Object3D();
    const child = new Object3D();
    root.add(child);
    child.visible = false; // mis. objek prosedural yang digantikan model Blender (replaces)
    expect(applyFarHidden([root], true)).toBe(true);
    expect([root.layers.isEnabled(0), child.layers.isEnabled(0)]).toEqual([false, false]);
    expect(applyFarHidden([root], true)).toBe(false);
    expect(applyFarHidden([root], false)).toBe(true);
    expect([root.layers.isEnabled(0), child.layers.isEnabled(0)]).toEqual([true, true]);
    expect(child.visible).toBe(false); // tetap tersembunyi: bukan urusan penjaga
  });
  it('penjaga mengikuti fokus tanpa berkedip di batas', () => {
    const o = new Object3D();
    const gate = createFarGate([o]);
    gate.update({ x: 700, z: 0 });
    expect(o.layers.isEnabled(0)).toBe(false);
    gate.update({ x: 600, z: 0 }); // antara showAt dan hideAt
    expect(o.layers.isEnabled(0)).toBe(false);
    gate.update({ x: 300, z: 0 });
    expect(o.layers.isEnabled(0)).toBe(true);
    gate.update(null); // tanpa fokus: tidak mengubah apa pun
    expect(o.layers.isEnabled(0)).toBe(true);
  });
});
