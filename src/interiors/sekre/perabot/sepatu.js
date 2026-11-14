import { box, rbox, piece } from './bentuk.js';

export function buildSepatu(m, color) {
  const geos = [];
  for (const z of [-0.065, 0.065]) {
    geos.push(box(0.3, 0.025, 0.11, '#f5f5f5', { y: 0.0125, z }));
    geos.push(rbox(0.27, 0.07, 0.1, 0.03, color, { x: 0.01, y: 0.06, z }));
  }
  return piece(geos, m.prop, 'S21', false);
}
