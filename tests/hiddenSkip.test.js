import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { hiddenInChain, shownIn, skipMatrixWhenHidden, createLabelList } from '../src/engine/hiddenSkip.js';

describe('hiddenInChain / shownIn', () => {
  it('melihat leluhur yang tersembunyi', () => {
    const scene = new THREE.Scene();
    const a = new THREE.Group();
    const b = new THREE.Object3D();
    scene.add(a);
    a.add(b);
    expect(hiddenInChain(b)).toBe(false);
    expect(shownIn(b, scene)).toBe(true);
    a.visible = false;
    expect(hiddenInChain(b)).toBe(true);
    expect(shownIn(b, scene)).toBe(false);
  });

  it('objek yang lepas dari scene tidak dianggap tampak', () => {
    const scene = new THREE.Scene();
    const orphan = new THREE.Group();
    const child = new THREE.Object3D();
    orphan.add(child);
    expect(shownIn(child, scene)).toBe(false);
  });
});

describe('skipMatrixWhenHidden', () => {
  it('melewati subpohon tersembunyi lalu menghitung ulang paksa saat tampak lagi', () => {
    const scene = new THREE.Scene();
    const holder = new THREE.Group();
    const root = skipMatrixWhenHidden(new THREE.Object3D());
    const bone = new THREE.Object3D();
    bone.position.set(0, 1, 0);
    scene.add(holder);
    holder.add(root);
    root.add(bone);
    scene.updateMatrixWorld();
    expect(bone.matrixWorld.elements[13]).toBe(1);

    holder.visible = false;
    holder.position.x = 5;
    holder.updateMatrix(); // matrixAutoUpdate tetap jalan di holder sendiri
    scene.updateMatrixWorld();
    expect(bone.matrixWorld.elements[12]).toBe(0); // dilewati selama tersembunyi

    holder.visible = true;
    scene.updateMatrixWorld();
    expect(bone.matrixWorld.elements[12]).toBe(5); // paksa sekali: perpindahan selama tersembunyi tidak hilang
  });
});

describe('createLabelList', () => {
  const label = () => {
    const o = new THREE.Object3D();
    o.isCSS2DObject = true;
    o.element = { style: { display: '' } };
    return o;
  };

  it('mengembalikan label tampak dan menyembunyikan elemen label yang leluhurnya tersembunyi', () => {
    const scene = new THREE.Scene();
    const shown = label();
    const group = new THREE.Group();
    const hidden = label();
    scene.add(shown, group);
    group.add(hidden);
    group.visible = false;
    const list = createLabelList(30);
    expect(list.refresh(scene)).toEqual([shown]);
    expect(hidden.element.style.display).toBe('none');
  });

  it('label baru baru terlihat setelah penyisiran berikutnya; scene baru disisir segera', () => {
    const scene = new THREE.Scene();
    const list = createLabelList(3);
    expect(list.refresh(scene)).toHaveLength(0);
    scene.add(label());
    expect(list.refresh(scene)).toHaveLength(0);
    expect(list.refresh(scene)).toHaveLength(0);
    expect(list.refresh(scene)).toHaveLength(1);
    const other = new THREE.Scene();
    other.add(label(), label());
    expect(list.refresh(other)).toHaveLength(2);
  });
});
