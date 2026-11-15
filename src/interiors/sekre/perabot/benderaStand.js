import { box, cyl, ball, piece, groupOf } from './bentuk.js';

export function buildBenderaStand(m) {
  return groupOf('S08', piece([box(0.3, 0.03, 0.12, '#3e2723', { y: 0.015 })], m.prop, 'alas'), piece(
    [-0.1, 0, 0.1].flatMap((x) => [cyl(0.004, 0.004, 0.55, '#c9b27a', { x, y: 0.305 }), ball(0.01, '#c9b27a', { x, y: 0.585 })]),
    m.metal, 'tiang',
  ));
}
