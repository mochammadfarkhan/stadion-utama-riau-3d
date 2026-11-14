import { box, piece } from './bentuk.js';

export function buildSaklar(m) {
  return piece([box(0.08, 0.12, 0.012, '#f2f2f2'), box(0.03, 0.05, 0.008, '#e0e0e0', { z: -0.008 })], m.prop, 'S27', false);
}
