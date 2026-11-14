import { box, tube, piece, groupOf } from './bentuk.js';
import { ASET, kx } from '../data.js';

/** S25 kabel: dari stopkontak ke stop dinding & ke laptop (koordinat ruang). */
export function buildKabel(m) {
  const s = ASET.S25.items[0];
  const w = ASET.S25.stopDinding;
  return groupOf('S25-kabel', piece([
    tube([[s.x, 0.012, s.z], [kx(1.7), 0.012, 0.7], [kx(2.0), 0.012, 0.42], [kx(2.08), 0.05, 0.3], [w.x - 0.01, w.y, w.z]], 0.004, '#1a1a1a'),
    tube([[s.x + 0.05, 0.012, s.z + 0.05], [kx(1.47), 0.02, 1.12], [kx(1.47), 0.5, 1.18], [kx(1.5), 0.76, 1.24], [kx(1.62), 0.77, 1.3]], 0.004, '#1a1a1a'),
    box(0.012, 0.08, 0.08, '#f2f2f2', { x: w.x, y: w.y, z: w.z }),
  ], m.prop, 'kabel', false));
}
