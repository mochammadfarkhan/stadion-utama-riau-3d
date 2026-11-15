import { box, piece } from './bentuk.js';

export function buildKardus(m) {
  return piece([
    box(0.5, 0.35, 0.4, '#b88a55', { y: 0.175 }),
    box(0.06, 0.352, 0.402, '#d9c79c', { y: 0.175 }),
    box(0.5, 0.008, 0.2, '#a87a48', { y: 0.355, z: -0.1, rx: -0.25 }),
    box(0.2, 0.12, 0.002, '#efe6d0', { y: 0.2, z: -0.201 }),
  ], m.prop, 'S11');
}
