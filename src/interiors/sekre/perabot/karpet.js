import * as THREE from 'three';
import { PI } from './bentuk.js';

export function buildKarpet(m, it) {
  const g = new THREE.Group();
  g.name = 'S22';
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4).rotateX(-PI / 2).translate(0, 0.006, 0), m.karpet);
  rug.receiveShadow = true;
  g.add(rug);
  g.position.set(it.x, it.y, it.z);
  return g;
}
