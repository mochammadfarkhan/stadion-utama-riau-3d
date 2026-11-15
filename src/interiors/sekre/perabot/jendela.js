import { PI, box, cyl, piece, groupOf } from './bentuk.js';
import { ASET } from '../data.js';

/** S29 jendela kiri & kanan pintu (kusen aluminium, bilah kaca nako, teralis luar). Koordinat ruang. */
export function buildJendela(m) {
  return groupOf('S29', ...ASET.S29.items.map((it) => buildSatuJendela(m, it)));
}

function buildSatuJendela(m, it) {
  const cx = it.x;
  const y0 = it.y;
  const zc = -3.075;
  const AL = '#c9ccd0';
  const W = ASET.S29.dim.w;
  const H = ASET.S29.dim.h;
  const frame = [
    box(0.04, H, 0.1, AL, { x: cx - W / 2 + 0.02, y: y0 + H / 2, z: zc }),
    box(0.04, H, 0.1, AL, { x: cx + W / 2 - 0.02, y: y0 + H / 2, z: zc }),
    box(W, 0.04, 0.1, AL, { x: cx, y: y0 + H - 0.02, z: zc }),
    box(W, 0.04, 0.1, AL, { x: cx, y: y0 + 0.02, z: zc }),
  ];
  const bars = Math.round(W / 0.26);
  for (let k = 0; k <= bars; k += 1) frame.push(cyl(0.008, 0.008, H, '#37474f', { x: cx - W / 2 + 0.08 + k * ((W - 0.16) / bars), y: y0 + H / 2, z: -3.17 }));
  for (const f of [0.25, 0.75]) frame.push(cyl(0.008, 0.008, W - 0.04, '#37474f', { x: cx, y: y0 + H * f, z: -3.17, rz: PI / 2 }));
  const sill = piece([box(W + 0.1, 0.03, 0.12, '#d9d4c7', { x: cx, y: y0 - 0.015, z: -2.96 })], m.prop, 'ambang');
  const glass = [];
  const slats = Math.floor(H / 0.15);
  for (let i = 0; i < slats; i += 1) glass.push(box(W - 0.1, 0.004, 0.155, '#ffffff', { x: cx, y: y0 + 0.075 + i * 0.15, z: -3.05, rx: 0.35 }));
  return groupOf('S29-jendela', piece(frame, m.metal, 'kusen'), sill, piece(glass, m.glass, 'bilah-kaca', false));
}
