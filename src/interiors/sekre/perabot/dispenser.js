import { PI, box, cyl, piece, groupOf } from './bentuk.js';

/** S13 dispenser + galon terbalik (0,32 × 0,32 × 1,25); air tinggal seperempat galon. */
export function buildDispenser(m) {
  const body = piece([
    box(0.32, 0.9, 0.32, '#eceff1', { y: 0.45 }),
    box(0.26, 0.28, 0.01, '#cfd8dc', { y: 0.62, z: -0.165 }),
    cyl(0.012, 0.012, 0.05, '#d32f2f', { x: -0.05, y: 0.66, z: -0.19, rx: PI / 2 }),
    cyl(0.012, 0.012, 0.05, '#1e88e5', { x: 0.05, y: 0.66, z: -0.19, rx: PI / 2 }),
    box(0.2, 0.02, 0.1, '#90a4ae', { y: 0.5, z: -0.2 }),
    box(0.3, 0.04, 0.3, '#dfe3e6', { y: 0.92 }),
    box(0.03, 0.03, 0.005, '#43a047', { x: 0.1, y: 0.8, z: -0.163 }),
    cyl(0.128, 0.128, 0.07, '#5fa8d3', { y: 1.015 }, 20),
  ], m.plastik, 'badan');
  const galon = piece([
    cyl(0.135, 0.05, 0.04, '#ffffff', { y: 0.96 }, 20),
    cyl(0.135, 0.135, 0.27, '#ffffff', { y: 1.115 }, 20),
  ], m.galon, 'galon', false);
  return groupOf('S13-ph', body, galon);
}
