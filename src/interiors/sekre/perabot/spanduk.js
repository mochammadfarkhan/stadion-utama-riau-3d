import { cyl, piece } from './bentuk.js';

export function buildSpanduk(m) {
  return piece([
    cyl(0.05, 0.05, 2, '#f2efe6', { y: 1 }),
    cyl(0.052, 0.052, 0.12, '#d9661f', { y: 0.1 }),
    cyl(0.052, 0.052, 0.12, '#d9661f', { y: 1.9 }),
  ], m.prop, 'S12');
}
