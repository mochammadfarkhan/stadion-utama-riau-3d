import * as THREE from 'three';
import { PI } from './bentuk.js';
import { ASET } from '../data.js';

const FAN_POS = new THREE.Vector3(ASET.S14.items[0].x, 1.05, ASET.S14.items[0].z);

export function buildKertas(m, it, i) {
  const pivot = new THREE.Group();
  pivot.name = `kertas-${i}`;
  pivot.position.set(it.x, it.y, it.z);
  pivot.rotation.y = it.hadap;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297).rotateX(-PI / 2).translate(0, 0, 0.1485), m.paper);
  sheet.receiveShadow = true;
  pivot.add(sheet);
  return { pivot, dist: Math.hypot(it.x - FAN_POS.x, it.z - FAN_POS.z), phase: i * 1.7 };
}
