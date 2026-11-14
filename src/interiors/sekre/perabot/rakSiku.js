import { box, piece, groupOf } from './bentuk.js';

/**
 * Rak besi siku hitam berlubang (foto sekre ERC, foto 8–9): 4 tiang profil L, 3 papan besi, berisi kotak & kabel.
 * 0,8 × 0,4 × 0,95 m; depan −Z lokal. [INFERENSI] isi rak.
 */
const HITAM = '#1c1d20';
const LUBANG = '#050506';

export function buildRakSiku(m) {
  const W = 0.8;
  const D = 0.4;
  const H = 0.95;
  const besi = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (W / 2 - 0.02);
      const z = sz * (D / 2 - 0.02);
      // profil L: dua sayap 4 cm
      besi.push(box(0.04, H, 0.004, HITAM, { x, y: H / 2, z: z + sz * 0.018 }));
      besi.push(box(0.004, H, 0.04, HITAM, { x: x + sx * 0.018, y: H / 2, z }));
      // lubang baut sepanjang tiang (sisi depan/belakang)
      for (let y = 0.06; y < H; y += 0.07) besi.push(box(0.012, 0.025, 0.002, LUBANG, { x, y, z: z + sz * 0.021 }));
    }
  }
  for (const y of [0.08, 0.48, 0.9]) besi.push(box(W, 0.015, D, HITAM, { y }));
  const isi = [
    box(0.3, 0.22, 0.28, '#b98b52', { x: -0.2, y: 0.2 }), // kardus
    box(0.26, 0.12, 0.3, '#2f6fb3', { x: 0.2, y: 0.15 }), // kotak komponen
    box(0.34, 0.08, 0.26, '#3b3f44', { x: -0.12, y: 0.53 }), // toolbox
    box(0.18, 0.16, 0.18, '#d8d2c4', { x: 0.24, y: 0.57 }),
    box(0.22, 0.05, 0.22, '#e04b2c', { x: 0.1, y: 0.935 }), // gulungan kabel [INFERENSI]
  ];
  return groupOf('rak-siku', piece(besi, m.catBesi, 'rangka-siku'), piece(isi, m.prop, 'isi-rak'));
}
