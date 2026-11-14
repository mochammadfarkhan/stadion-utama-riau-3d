import { box, cyl, piece } from './bentuk.js';

export function buildStopkontak(m) {
  return piece([
    box(0.3, 0.04, 0.06, '#f5f5f5', { y: 0.02 }),
    ...[-0.1, -0.033, 0.033].map((x) => cyl(0.013, 0.013, 0.004, '#9e9e9e', { x, y: 0.041 })),
    box(0.03, 0.012, 0.02, '#e53935', { x: 0.125, y: 0.046 }),
  ], m.prop, 'S25', false);
}
