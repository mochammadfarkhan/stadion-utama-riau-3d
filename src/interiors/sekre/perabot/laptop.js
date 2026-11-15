import * as THREE from 'three';
import { PI, box, piece, groupOf } from './bentuk.js';
import { tint } from '../canvas.js';

/** S17 laptop 0,34 × 0,24 × 0,23 terbuka ±105°; layar = material emisif bersama. */
export function buildLaptop(m) {
  const lid = (geo) => geo.translate(0, 0.11, 0).rotateX(0.26).translate(0, 0.018, 0.12);
  const body = piece([
    box(0.34, 0.018, 0.24, '#3a3d42', { y: 0.009 }),
    box(0.3, 0.002, 0.12, '#202225', { y: 0.019, z: 0.03 }),
    box(0.09, 0.001, 0.06, '#4a4d52', { y: 0.019, z: -0.075 }),
    tint(lid(new THREE.BoxGeometry(0.34, 0.22, 0.008)), '#3a3d42'),
  ], m.prop, 'badan');
  const screen = new THREE.Mesh(lid(new THREE.PlaneGeometry(0.3, 0.18).rotateY(PI).translate(0, 0, -0.0045)), m.screen);
  screen.name = 'layar';
  return groupOf('S17-ph', body, screen);
}
