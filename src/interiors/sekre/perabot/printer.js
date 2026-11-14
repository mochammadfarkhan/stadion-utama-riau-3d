import { box, piece, groupOf } from './bentuk.js';

/** S15 printer tua 0,45 × 0,4 × 0,25 */
export function buildPrinter(m) {
  return groupOf('S15-ph', piece([
    box(0.45, 0.2, 0.38, '#d6d0c2', { y: 0.1 }),
    box(0.42, 0.03, 0.2, '#c8c1b1', { y: 0.215, z: 0.05 }),
    box(0.3, 0.01, 0.15, '#bdb6a6', { y: 0.2, z: -0.24, rx: -0.3 }),
    box(0.28, 0.002, 0.12, '#ffffff', { y: 0.21, z: -0.24, rx: -0.3 }),
    box(0.1, 0.03, 0.005, '#424242', { x: 0.14, y: 0.15, z: -0.191 }),
    box(0.015, 0.015, 0.004, '#ff9800', { x: 0.17, y: 0.15, z: -0.194 }),
  ], m.prop, 'printer'));
}
