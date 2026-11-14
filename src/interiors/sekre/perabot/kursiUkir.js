import { box, rbox, cyl, torus, piece, groupOf } from './bentuk.js';

/**
 * Kursi tamu kayu jati ukir (foto sekre ERC): rangka kayu cokelat madu, sandaran panel berlubang-lubang dengan medali ukiran
 * bunga di tengah, sandaran lengan melengkung, dudukan berbantal kain motif. 0,62 × 0,58 × 0,95 m; depan −Z lokal.
 */
const KAYU = '#a8662f';
const KAYU_GELAP = '#7a4520';
const PANEL = '#9a5a28';

export function buildKursiUkir(m) {
  const W = 0.62;
  const D = 0.58;
  const kayu = [
    // kaki
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.06, 0.45, 0.06, KAYU_GELAP, { x: sx * (W / 2 - 0.04), y: 0.225, z: sz * (D / 2 - 0.04) }))),
    // rangka dudukan
    box(W, 0.06, D, KAYU, { y: 0.42 }),
    // tiang & panel sandaran (belakang = +Z)
    box(0.07, 0.55, 0.07, KAYU, { x: -(W / 2 - 0.04), y: 0.72, z: D / 2 - 0.04 }),
    box(0.07, 0.55, 0.07, KAYU, { x: W / 2 - 0.04, y: 0.72, z: D / 2 - 0.04 }),
    rbox(W, 0.08, 0.07, 0.02, KAYU, { y: 0.98, z: D / 2 - 0.04 }),
    box(W - 0.12, 0.42, 0.025, PANEL, { y: 0.72, z: D / 2 - 0.035 }),
    // sandaran lengan
    ...[-1, 1].flatMap((sx) => [
      rbox(0.07, 0.05, D, 0.02, KAYU, { x: sx * (W / 2 - 0.035), y: 0.66, z: 0.02 }),
      box(0.05, 0.22, 0.05, KAYU, { x: sx * (W / 2 - 0.035), y: 0.55, z: -(D / 2 - 0.06) }),
      box(0.025, 0.18, D - 0.12, PANEL, { x: sx * (W / 2 - 0.035), y: 0.54, z: 0.02 }),
    ]),
    // medali ukiran bunga di tengah sandaran
    torus(0.09, 0.012, KAYU_GELAP, { y: 0.72, z: D / 2 - 0.05 }),
    cyl(0.05, 0.05, 0.015, KAYU_GELAP, { y: 0.72, z: D / 2 - 0.052, rx: Math.PI / 2 }, 8),
  ];
  // lubang-lubang ukiran: bintik gelap rapat di panel sandaran (kesan panel berlubang di foto)
  for (let i = 0; i < 7; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      const x = -0.21 + i * 0.07 + (j % 2) * 0.035;
      const y = 0.55 + j * 0.08;
      if (Math.hypot(x, y - 0.72) < 0.11) continue; // medali di tengah
      kayu.push(cyl(0.012, 0.012, 0.01, '#4a2810', { x, y, z: D / 2 - 0.05, rx: Math.PI / 2 }, 6));
    }
  }
  const bantal = [rbox(W - 0.1, 0.07, D - 0.08, 0.025, '#6f7f9a', { y: 0.485 })];
  return groupOf('kursi-ukir', piece(kayu, m.kayuHalus, 'rangka-ukir'), piece(bantal, m.kain, 'bantal-duduk', false));
}
