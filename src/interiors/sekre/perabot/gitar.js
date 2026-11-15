import { PI, box, cyl, piece, groupOf } from './bentuk.js';

/** S19 gitar akustik 0,38 × 0,1 × 1,0 (tegak, depan −Z). */
export function buildGitar(m) {
  const BODY = '#c98b4b';
  const NECK = '#4a2e1c';
  const geos = [
    cyl(0.19, 0.19, 0.1, BODY, { y: 0.21, rx: PI / 2 }, 24),
    cyl(0.145, 0.145, 0.1, BODY, { y: 0.45, rx: PI / 2 }, 24),
    cyl(0.055, 0.055, 0.004, '#1b1b1b', { y: 0.4, z: -0.051, rx: PI / 2 }, 18),
    box(0.05, 0.42, 0.03, NECK, { y: 0.77 }),
    box(0.075, 0.13, 0.025, NECK, { y: 0.935 }),
    box(0.1, 0.012, 0.02, '#1b1b1b', { y: 0.12, z: -0.055 }),
  ];
  for (let i = 0; i < 6; i += 1) {
    geos.push(box(0.0015, 0.8, 0.0015, '#d7d7d7', { x: -0.0125 + i * 0.005, y: 0.52, z: -0.04 }));
    geos.push(cyl(0.006, 0.006, 0.03, '#c9b27a', { x: i < 3 ? -0.045 : 0.045, y: 0.9 + (i % 3) * 0.035, rz: PI / 2 }));
  }
  return groupOf('S19-ph', piece(geos, m.kayuHalus, 'gitar'));
}
