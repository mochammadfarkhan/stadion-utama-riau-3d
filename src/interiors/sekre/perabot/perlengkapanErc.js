import { box, ball, piece, groupOf } from './bentuk.js';
import { ASET, kx } from '../data.js';

/** Perlengkapan khas sekre ERC (dari foto): tirai vertikal krem, ventilasi kotak, AC split, boks plastik, bola futsal. */
export function buildPerlengkapanErc(m) {
  const it = ASET.S29.items[0];
  const blinds = [];
  for (let k = 0; k < 13; k += 1) blinds.push(box(0.1, 1.55, 0.012, k % 2 ? '#e8e1c9' : '#f1ecda', { x: it.x - 0.66 + k * 0.11, y: it.y + 0.55, z: -2.93 }));
  blinds.push(box(1.5, 0.06, 0.05, '#cfc8b0', { x: it.x, y: it.y + 1.35, z: -2.93 }));
  const vents = [];
  const ventFrames = [];
  for (let k = 0; k < 10; k += 1) {
    const x = -2.75 + k * 0.6;
    vents.push(box(0.15, 0.27, 0.01, '#f4f8ff', { x, y: 3.35, z: -2.985 }));
    ventFrames.push(box(0.19, 0.31, 0.008, '#c9cdd0', { x, y: 3.35, z: -2.99 }));
  }
  for (let k = 0; k < 7; k += 1) {
    vents.push(box(0.01, 0.27, 0.15, '#f4f8ff', { x: -2.985, y: 3.35, z: -2.2 + k * 0.6 }));
    ventFrames.push(box(0.008, 0.31, 0.19, '#c9cdd0', { x: -2.99, y: 3.35, z: -2.2 + k * 0.6 }));
  }
  const ac = [
    box(0.22, 0.28, 0.92, '#f2f3f4', { x: 2.9, y: 3.3, z: 1.3 }),
    box(0.02, 0.05, 0.8, '#3a3f45', { x: 2.79, y: 3.23, z: 1.3 }),
    box(0.02, 0.03, 0.9, '#d9dcdf', { x: 2.79, y: 3.38, z: 1.3 }),
  ];
  const bins = [];
  for (const [x, z, r] of [[kx(0.95), -0.4, 0.1], [kx(-0.95), -0.75, -0.25]]) {
    bins.push(box(0.5, 0.3, 0.36, '#d9ecef', { x, y: 0.15, z, ry: r }));
    bins.push(box(0.52, 0.05, 0.38, '#43a047', { x, y: 0.325, z, ry: r }));
    bins.push(box(0.12, 0.03, 0.02, '#f2c230', { x, y: 0.31, z: z - 0.19, ry: r }));
  }
  const ballG = [ball(0.11, '#ef6c1a', { x: kx(-1.7), y: 0.11, z: 0.15 })];
  return groupOf('perlengkapan-erc',
    piece(blinds, m.prop, 'tirai-vertikal', false), piece(vents, m.tl, 'ventilasi-kotak', false),
    piece(ventFrames, m.prop, 'bingkai-ventilasi', false), piece(ac, m.plastik, 'ac-split', false),
    piece(bins, m.plastik, 'boks-plastik'), piece(ballG, m.prop, 'bola', false));
}
