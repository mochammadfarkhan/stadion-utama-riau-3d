import { PI, box, cyl, piece, groupOf } from './bentuk.js';

export function buildKursi(m) {
  const seat = piece([
    box(0.42, 0.04, 0.4, '#8a5a2b', { y: 0.45 }),
    box(0.42, 0.34, 0.03, '#8a5a2b', { y: 0.78, z: 0.2 }),
    box(0.03, 0.2, 0.36, '#7a4c22', { x: -0.22, y: 0.58 }),
    box(0.03, 0.2, 0.36, '#7a4c22', { x: 0.22, y: 0.58 }),
  ], m.kayuHalus, 'dudukan');
  const legs = [];
  for (const x of [-0.19, 0.19]) {
    legs.push(cyl(0.011, 0.011, 0.45, '#9ea7ad', { x, y: 0.225, z: -0.17 }));
    legs.push(cyl(0.011, 0.011, 0.9, '#9ea7ad', { x, y: 0.45, z: 0.19 }));
  }
  legs.push(cyl(0.009, 0.009, 0.38, '#9ea7ad', { y: 0.2, z: -0.17, rz: PI / 2 }));
  return groupOf('kursi-lipat', seat, piece(legs, m.metal, 'kaki'));
}
