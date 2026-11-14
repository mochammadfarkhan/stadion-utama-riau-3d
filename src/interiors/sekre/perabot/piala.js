import { box, cyl, torus, ball, piece, groupOf } from './bentuk.js';

/** S07 piala 0,15 × 0,15 × 0,45 */
export function buildPiala(m) {
  const GOLD = '#d4a838';
  const gold = piece([
    cyl(0.012, 0.025, 0.1, GOLD, { y: 0.17 }),
    cyl(0.065, 0.03, 0.13, GOLD, { y: 0.285 }),
    torus(0.035, 0.007, GOLD, { x: 0.07, y: 0.29 }),
    torus(0.035, 0.007, GOLD, { x: -0.07, y: 0.29 }),
    cyl(0.068, 0.068, 0.012, GOLD, { y: 0.356 }),
    cyl(0.004, 0.01, 0.06, GOLD, { y: 0.392 }),
    ball(0.022, GOLD, { y: 0.428 }),
  ], m.metal, 'emas');
  const base = piece([
    box(0.15, 0.05, 0.15, '#3a2a1e', { y: 0.025 }),
    box(0.11, 0.07, 0.11, '#e8e2d6', { y: 0.085 }),
    box(0.06, 0.02, 0.003, '#c9b27a', { y: 0.07, z: -0.0565 }),
  ], m.prop, 'alas');
  return groupOf('S07-ph', gold, base);
}
