import * as THREE from 'three';
import { box, rbox, torus, piece, groupOf } from './bentuk.js';

/** S20 tas ransel 0,3 × 0,2 × 0,45 */
export function buildTas(m, color) {
  const c = new THREE.Color(color);
  const dark = `#${c.clone().multiplyScalar(0.7).getHexString()}`;
  return groupOf('S20-ph', piece([
    rbox(0.3, 0.42, 0.18, 0.06, color, { y: 0.21 }),
    rbox(0.22, 0.18, 0.06, 0.03, dark, { y: 0.14, z: -0.1 }),
    torus(0.04, 0.008, dark, { y: 0.43 }),
    box(0.04, 0.36, 0.02, dark, { x: -0.08, y: 0.24, z: 0.095 }),
    box(0.04, 0.36, 0.02, dark, { x: 0.08, y: 0.24, z: 0.095 }),
    box(0.2, 0.006, 0.004, '#cfd8dc', { y: 0.22, z: -0.131 }),
  ], m.kain, 'tas'));
}
