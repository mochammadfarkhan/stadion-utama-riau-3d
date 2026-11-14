import { PI, box, cyl, piece, groupOf } from './bentuk.js';

export function buildMeja(m) {
  const top = piece([
    box(1.8, 0.03, 0.6, '#d8cbb0', { y: 0.735 }),
    box(1.8, 0.035, 0.012, '#7a6f5d', { y: 0.72, z: -0.3 }),
    box(1.8, 0.035, 0.012, '#7a6f5d', { y: 0.72, z: 0.3 }),
  ], m.prop, 'meja');
  const legs = [];
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.24, 0.24]) legs.push(cyl(0.012, 0.012, 0.72, '#9ea7ad', { x, y: 0.36, z, rx: z > 0 ? 0.06 : -0.06 }));
    legs.push(cyl(0.01, 0.01, 0.5, '#9ea7ad', { x, y: 0.12, rx: PI / 2 }));
  }
  legs.push(cyl(0.01, 0.01, 1.6, '#9ea7ad', { y: 0.12, rz: PI / 2 }));
  return groupOf('S16', top, piece(legs, m.metal, 'kaki'));
}
