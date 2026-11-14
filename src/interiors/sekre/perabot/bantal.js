import { rbox, piece } from './bentuk.js';

export function buildBantal(m, color) {
  return piece([rbox(0.5, 0.1, 0.35, 0.04, color, { y: 0.05 })], m.prop, 'S23', false);
}
