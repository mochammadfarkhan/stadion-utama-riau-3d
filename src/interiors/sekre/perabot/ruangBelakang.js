import { PI, box, rbox, cyl, piece, groupOf } from './bentuk.js';
import { REAR } from '../data.js';

/** Daun pintu dalam navy berkaca tipis, terbuka ke ruang belakang (engsel di sisi x0). */
function buildPintuDalam(m, d, name, zc) {
  const NAVY = '#1f3768';
  const kusen = piece([
    box(0.05, 2.12, 0.16, '#cfd2d6', { x: d.x0 - 0.025, y: 1.06, z: zc }),
    box(0.05, 2.12, 0.16, '#cfd2d6', { x: d.x1 + 0.025, y: 1.06, z: zc }),
    box(d.x1 - d.x0 + 0.1, 0.05, 0.16, '#cfd2d6', { x: (d.x0 + d.x1) / 2, y: 2.125, z: zc }),
  ], m.prop, `kusen-${name}`);
  const w = d.x1 - d.x0;
  const leaf = piece([
    box(w, 2.05, 0.04, NAVY, { x: w / 2, y: 1.025, z: 0 }),
    box(0.1, 0.9, 0.012, '#e8efe0', { x: w * 0.75, y: 1.35, z: 0.026 }),
    cyl(0.012, 0.012, 0.11, '#cfd8dc', { x: w - 0.07, y: 1.0, z: 0.05, rz: PI / 2 }),
  ], m.prop, `daun-${name}`);
  const g = groupOf(name, kusen, leaf);
  leaf.position.set(d.x0, 0, zc);
  leaf.rotation.y = -1.48;
  return g;
}

/** Ruang Ketiga (barat, rak komponen), Ruang Kedua (tengah-timur, meja kerja), dan WC tersembunyi di pojok tenggara. [INFERENSI] isinya. */
export function buildRuangBelakang(m) {
  const rak = [];
  for (const y of [0.02, 0.55, 1.1, 1.65]) rak.push(box(1.5, 0.03, 0.45, '#9ea7ad', { x: -2.1, y, z: 5.72 }));
  for (const x of [-2.83, -1.37]) for (const z of [5.52, 5.92]) rak.push(box(0.04, 1.85, 0.04, '#7d868c', { x, y: 0.92, z }));
  const stuff = [];
  [[-2.5, 0.57, '#c9a46a'], [-2.0, 0.57, '#b58a50'], [-1.6, 0.57, '#d8b87c'], [-2.4, 1.12, '#e9e6dc'], [-1.8, 1.12, '#c9a46a'], [-1.7, 1.67, '#b58a50'], [-2.5, 1.67, '#2f3a46']]
    .forEach(([x, y, c], i) => stuff.push(box(0.36 + (i % 3) * 0.08, 0.28, 0.32, c, { x, y: y + 0.14, z: 5.72, ry: 0.05 * (i % 4) })));
  const meja = [
    box(0.7, 0.04, 1.5, '#2b2f36', { x: 2.55, y: 0.74, z: 3.95 }),
    ...[[-0.3, -0.7], [-0.3, 0.7], [0.3, -0.7], [0.3, 0.7]].map(([dx, dz]) => box(0.04, 0.72, 0.04, '#3a3f45', { x: 2.55 + dx, y: 0.36, z: 3.95 + dz })),
    box(0.3, 0.02, 0.22, '#c9ccd0', { x: 2.55, y: 0.77, z: 3.6, ry: 0.4 }),
    box(0.3, 0.2, 0.01, '#1a1e24', { x: 2.69, y: 0.88, z: 3.56, ry: 0.4 }),
  ];
  const robot = [
    rbox(0.22, 0.1, 0.16, 0.02, '#e9e6dc', { x: 2.5, y: 0.83, z: 4.2 }),
    cyl(0.04, 0.04, 0.03, '#212121', { x: 2.5, y: 0.8, z: 4.1, rx: PI / 2 }, 12),
    cyl(0.04, 0.04, 0.03, '#212121', { x: 2.5, y: 0.8, z: 4.3, rx: PI / 2 }, 12),
    box(0.06, 0.08, 0.06, '#2a9d8f', { x: 2.5, y: 0.93, z: 4.2 }),
  ];
  const kursi = [
    box(0.42, 0.04, 0.42, '#37474f', { x: 1.85, y: 0.46, z: 3.95 }),
    box(0.03, 0.4, 0.42, '#37474f', { x: 1.65, y: 0.7, z: 3.95 }),
    cyl(0.012, 0.012, 0.44, '#9ea7ad', { x: 1.85, y: 0.22, z: 3.95 }),
  ];
  const kardus = [box(0.5, 0.4, 0.4, '#c9a46a', { x: 0.3, y: 0.2, z: 5.7, ry: 0.2 }), box(0.45, 0.35, 0.35, '#b58a50', { x: 0.45, y: 0.575, z: 5.7, ry: -0.1 }), box(0.5, 0.4, 0.4, '#d8b87c', { x: -0.7, y: 0.2, z: 5.7 })];
  const wc = [
    cyl(0.22, 0.17, 0.4, '#f4f6f8', { x: 2.45, y: 0.2, z: 5.6 }, 16),
    box(0.4, 0.4, 0.16, '#f4f6f8', { x: 2.45, y: 0.6, z: 5.88 }),
    cyl(0.2, 0.2, 0.03, '#e9edf0', { x: 2.45, y: 0.42, z: 5.6 }, 16),
    box(0.4, 0.12, 0.5, '#f4f6f8', { x: 2.78, y: 0.88, z: 5.15 }),
    box(0.05, 0.8, 0.05, '#cfd8dc', { x: 2.78, y: 0.44, z: 5.15 }),
    box(0.02, 0.5, 0.6, '#d8eef7', { x: 2.97, y: 1.55, z: 5.15 }),
    cyl(0.16, 0.13, 0.28, '#2a7fd0', { x: 2.1, y: 0.14, z: 5.75 }, 12),
    cyl(0.07, 0.06, 0.1, '#e53935', { x: 2.1, y: 0.33, z: 5.55 }, 10),
  ];
  return groupOf('ruang-belakang',
    piece(rak, m.catBesi, 'rak-besi'), piece(stuff, m.prop, 'komponen-robot'), piece(meja, m.kayuHalus, 'meja-kerja'),
    piece(robot, m.prop, 'robot-mini'), piece(kursi, m.prop, 'kursi-kerja'), piece(kardus, m.prop, 'kardus-belakang'),
    piece(wc, m.prop, 'wc'),
    buildPintuDalam(m, REAR.doorRoom2, 'pintu-ruang-kedua', 3.075),
    buildPintuDalam(m, REAR.doorRoom3, 'pintu-ruang-ketiga', 3.075),
    buildPintuDalam(m, REAR.wc.door, 'pintu-wc', REAR.wc.z0 + 0.075));
}
