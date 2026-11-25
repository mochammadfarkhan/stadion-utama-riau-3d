import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cullOrangByDistance } from '../src/entities/index.js';

/** Grup orang (induk berposisi) berisi root bernama `orang:*`, seperti hasil Orang.create. */
function orang(x, z, parent) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const root = new THREE.Group();
  root.name = 'orang:kasual-pria-g';
  group.add(root);
  parent.add(group);
  return root;
}

describe('cullOrangByDistance', () => {
  it('menyembunyikan orang di luar jarak dan menampilkan yang dekat (posisi dunia lewat induk ber-offset)', () => {
    const region = new THREE.Group();
    region.position.set(1000, 0, 0); // region ber-placement: posisi lokal ≠ dunia
    const dekat = orang(50, 0, region); // dunia x = 1050
    const jauh = orang(-900, 0, region); // dunia x = 100
    region.updateMatrixWorld(true);
    const r = cullOrangByDistance([region], new THREE.Vector3(1000, 2, 0), 160);
    expect(dekat.visible).toBe(true);
    expect(jauh.visible).toBe(false);
    expect(r).toEqual({ total: 2, visible: 1 });
  });

  it('histeresis 15%: yang sudah tampak bertahan sampai 1,15 × far, yang tersembunyi baru muncul di ≤ far', () => {
    const region = new THREE.Group();
    const a = orang(170, 0, region);
    region.updateMatrixWorld(true);
    const cam = new THREE.Vector3(0, 0, 0);
    cullOrangByDistance([region], cam, 160);
    expect(a.visible).toBe(true); // 170 ≤ 184 dan awalnya tampak
    a.visible = false;
    cullOrangByDistance([region], cam, 160);
    expect(a.visible).toBe(false); // 170 > 160
  });

  it('objek lain tidak disentuh', () => {
    const region = new THREE.Group();
    const lain = new THREE.Mesh();
    lain.name = 'bangku';
    lain.position.set(5000, 0, 0);
    region.add(lain);
    region.updateMatrixWorld(true);
    expect(cullOrangByDistance([region], new THREE.Vector3(), 160)).toEqual({ total: 0, visible: 0 });
    expect(lain.visible).toBe(true);
  });
});
