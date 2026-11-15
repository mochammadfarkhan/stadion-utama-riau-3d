import { box, piece, groupOf } from './bentuk.js';

export function buildLemari(m) {
  const GREY = '#8d969e';
  const shell = piece([
    box(0.9, 1.8, 0.01, GREY, { y: 0.9, z: 0.22 }),
    box(0.01, 1.8, 0.45, GREY, { x: -0.445, y: 0.9 }),
    box(0.01, 1.8, 0.45, GREY, { x: 0.445, y: 0.9 }),
    box(0.9, 0.012, 0.45, GREY, { y: 1.794 }),
    box(0.9, 0.05, 0.45, '#6f777e', { y: 0.025 }),
    box(0.88, 0.02, 0.43, GREY, { y: 0.95 }),
    box(0.88, 0.012, 0.43, GREY, { y: 1.35 }),
    box(0.435, 0.86, 0.012, GREY, { x: -0.2225, y: 0.5, z: -0.219 }),
    box(0.435, 0.86, 0.012, GREY, { x: 0.2225, y: 0.5, z: -0.219 }),
    box(0.015, 0.1, 0.015, '#37474f', { x: -0.03, y: 0.75, z: -0.23 }),
    box(0.015, 0.1, 0.015, '#37474f', { x: 0.03, y: 0.75, z: -0.23 }),
    box(0.02, 0.03, 0.01, '#c9b27a', { y: 0.98, z: -0.228 }),
    ...[-0.2225, 0.2225].flatMap((x) => [
      box(0.02, 0.78, 0.015, GREY, { x: x - 0.2075, y: 1.36, z: -0.22 }),
      box(0.02, 0.78, 0.015, GREY, { x: x + 0.2075, y: 1.36, z: -0.22 }),
      box(0.435, 0.02, 0.015, GREY, { x, y: 0.98, z: -0.22 }),
      box(0.435, 0.02, 0.015, GREY, { x, y: 1.74, z: -0.22 }),
    ]),
  ], m.catBesi, 'lemari');
  const glass = piece([-0.2225, 0.2225].map((x) => box(0.395, 0.74, 0.004, '#ffffff', { x, y: 1.36, z: -0.219 })), m.glass, 'kaca', false);
  return groupOf('S09', shell, glass);
}
