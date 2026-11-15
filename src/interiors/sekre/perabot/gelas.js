import { cyl, torus, piece } from './bentuk.js';

export function buildGelas(m, isi) {
  const geos = isi === 'plastik'
    ? [
      cyl(0.04, 0.032, 0.1, '#e3f2fd', { y: 0.05 }),
      cyl(0.037, 0.037, 0.003, '#c5e1a5', { y: 0.08 }),
      cyl(0.003, 0.003, 0.16, '#e53935', { x: 0.01, y: 0.12, rz: 0.2 }),
    ]
    : [
      cyl(0.04, 0.033, 0.1, '#f5f5f5', { y: 0.05 }),
      cyl(0.036, 0.036, 0.004, '#4e342e', { y: 0.088 }),
      torus(0.025, 0.006, '#f5f5f5', { x: 0.045, y: 0.05 }),
    ];
  return piece(geos, m.prop, 'S18', false);
}
