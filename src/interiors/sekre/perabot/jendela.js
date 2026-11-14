import { PI, box, cyl, piece, groupOf } from './bentuk.js';
import { ASET } from '../data.js';

/** S29 jendela nako (kusen aluminium, 8 bilah kaca terbuka, teralis luar). Koordinat ruang. */
export function buildJendela(m) {
  const it = ASET.S29.items[0];
  const cx = it.x;
  const y0 = it.y;
  const zc = -3.075;
  const AL = '#c9ccd0';
  const frame = [
    box(0.04, 1.2, 0.1, AL, { x: cx - 0.58, y: y0 + 0.6, z: zc }),
    box(0.04, 1.2, 0.1, AL, { x: cx + 0.58, y: y0 + 0.6, z: zc }),
    box(1.2, 0.04, 0.1, AL, { x: cx, y: y0 + 1.18, z: zc }),
    box(1.2, 0.04, 0.1, AL, { x: cx, y: y0 + 0.02, z: zc }),
    box(0.02, 1.12, 0.03, AL, { x: cx - 0.555, y: y0 + 0.6, z: -3.04 }),
    box(0.02, 1.12, 0.03, AL, { x: cx + 0.555, y: y0 + 0.6, z: -3.04 }),
  ];
  for (let k = 0; k < 5; k += 1) frame.push(cyl(0.008, 0.008, 1.2, '#37474f', { x: cx - 0.52 + k * 0.26, y: y0 + 0.6, z: -3.17 }));
  for (const yy of [0.3, 0.9]) frame.push(cyl(0.008, 0.008, 1.16, '#37474f', { x: cx, y: y0 + yy, z: -3.17, rz: PI / 2 }));
  const sill = piece([box(1.3, 0.03, 0.12, '#d9d4c7', { x: cx, y: y0 - 0.015, z: -2.96 })], m.prop, 'ambang');
  const glass = [];
  for (let i = 0; i < 8; i += 1) glass.push(box(1.1, 0.004, 0.155, '#ffffff', { x: cx, y: y0 + 0.075 + i * 0.15, z: -3.05, rx: 0.35 }));
  return groupOf('S29', piece(frame, m.metal, 'kusen'), sill, piece(glass, m.glass, 'bilah-kaca', false));
}
