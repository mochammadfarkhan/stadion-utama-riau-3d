import { box, cyl, piece, groupOf } from './bentuk.js';

/**
 * Detail meja hitam depan [INFERENSI] (suasana rujukan visual user): tumpukan buku/map, mug, pot tanaman kecil,
 * lampu baca jepit. Koordinat lokal meja (tengah meja di 0, permukaan y = 0); depan −Z lokal.
 */
export function buildMejaDetail(m) {
  const buku = [
    box(0.24, 0.035, 0.32, '#2f5d8a', { x: -0.72, y: 0.018 }),
    box(0.23, 0.03, 0.31, '#b5462f', { x: -0.71, y: 0.05, ry: 0.08 }),
    box(0.22, 0.04, 0.3, '#e8dcc0', { x: -0.72, y: 0.085, ry: -0.05 }),
    box(0.21, 0.028, 0.29, '#3f6b3a', { x: -0.7, y: 0.119, ry: 0.12 }),
  ];
  const mug = [cyl(0.04, 0.04, 0.1, '#f3efe6', { x: -0.45, y: 0.05, z: -0.12 }, 12)];
  const pot = [cyl(0.06, 0.05, 0.1, '#b0643a', { x: 0.78, y: 0.05, z: 0.08 }, 10)];
  const daun = [];
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    daun.push(box(0.03, 0.16, 0.012, '#3d7a3a', { x: 0.78 + Math.cos(a) * 0.03, y: 0.17, z: 0.08 + Math.sin(a) * 0.03, ry: a, rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 }));
  }
  return groupOf('meja-detail', piece(buku, m.kain, 'buku-tumpuk'), piece([...mug, ...pot], m.plastik, 'mug-pot'), piece(daun, m.prop, 'tanaman-meja', false));
}
