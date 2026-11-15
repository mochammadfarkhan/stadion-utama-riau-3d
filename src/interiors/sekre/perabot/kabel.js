import { box, tube, piece, groupOf } from './bentuk.js';
import { ASET } from '../data.js';

/** S25 kabel: dari stopkontak ke stop dinding & ke laptop (koordinat ruang). */
export function buildKabel(m) {
  const s = ASET.S25.items[0];
  const w = ASET.S25.stopDinding;
  return groupOf('S25-kabel', piece([
    tube([[s.x, 0.012, s.z], [s.x + 0.25, 0.012, s.z - 0.35], [w.x, 0.012, -2.9], [w.x, 0.05, w.z + 0.01], [w.x, w.y, w.z + 0.01]], 0.004, '#1a1a1a'),
    tube([[s.x - 0.05, 0.012, s.z - 0.05], [-1.6, 0.02, -2.32], [-1.6, 0.5, -2.31], [-1.62, 0.76, -2.4], [-1.65, 0.77, -2.5]], 0.004, '#1a1a1a'),
    box(0.08, 0.08, 0.012, '#f2f2f2', { x: w.x, y: w.y, z: w.z }),
  ], m.prop, 'kabel', false));
}
