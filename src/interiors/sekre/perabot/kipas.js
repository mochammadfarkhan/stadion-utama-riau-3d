import * as THREE from 'three';
import { PI, box, cyl, torus, piece, groupOf } from './bentuk.js';
import { tint } from '../canvas.js';

/** S14 kipas berdiri (0,45 × 0,45 × 1,3): badan statis + kepala (menoleh) + baling (berputar). */
export function buildKipas(m) {
  const base = piece([
    cyl(0.2, 0.22, 0.04, '#e8e8e8', { y: 0.02 }, 24),
    cyl(0.018, 0.018, 0.98, '#cfcfcf', { y: 0.53 }),
    box(0.06, 0.08, 0.05, '#e8e8e8', { y: 0.32, z: -0.03 }),
    box(0.012, 0.012, 0.012, '#2e7d32', { x: -0.015, y: 0.34, z: -0.058 }),
    box(0.012, 0.012, 0.012, '#c62828', { x: 0.015, y: 0.34, z: -0.058 }),
  ], m.prop, 'badan');
  const head = new THREE.Group();
  head.name = 'kepala';
  head.position.y = 1.05;
  const cage = [
    cyl(0.07, 0.08, 0.14, '#e8e8e8', { z: 0.09, rx: PI / 2 }),
    torus(0.21, 0.006, '#d0d0d0', { z: -0.03 }),
    torus(0.21, 0.006, '#d0d0d0', { z: -0.1 }),
    cyl(0.03, 0.03, 0.02, '#4fc3f7', { z: -0.105, rx: PI / 2 }),
  ];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * PI * 2;
    cage.push(box(0.005, 0.21, 0.005, '#d0d0d0', { x: Math.cos(a) * 0.105, y: Math.sin(a) * 0.105, z: -0.1, rz: a - PI / 2 }));
  }
  head.add(piece(cage, m.prop, 'kepala-ph'));
  const bladeGeos = [cyl(0.03, 0.03, 0.03, '#4fc3f7', { rx: PI / 2 })];
  for (let i = 0; i < 3; i += 1) {
    bladeGeos.push(tint(new THREE.BoxGeometry(0.075, 0.17, 0.008).rotateY(0.3).translate(0, 0.1, 0).rotateZ((i * 2 * PI) / 3), '#4fc3f7'));
  }
  const blades = piece(bladeGeos, m.prop, 'baling');
  blades.position.z = -0.065;
  head.add(blades);
  return { group: groupOf('S14-ph', base, head), head, blades };
}
