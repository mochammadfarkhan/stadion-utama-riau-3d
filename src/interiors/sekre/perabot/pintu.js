import { PI, box, cyl, piece, groupOf } from './bentuk.js';
import { ASET, DOOR } from '../data.js';

/** S30 pintu ganda biru (foto): kusen + dua daun 0,85 m; kiri berengsel di x0 terbuka, kanan berengsel di x1 tertutup. Koordinat ruang. */
export function buildPintu(m) {
  const WOOD = '#d4d6da';
  const kusen = piece([
    box(0.06, DOOR.h + 0.06, 0.17, WOOD, { x: DOOR.x0 - 0.03, y: (DOOR.h + 0.06) / 2, z: -3.075 }),
    box(0.06, DOOR.h + 0.06, 0.17, WOOD, { x: DOOR.x1 + 0.03, y: (DOOR.h + 0.06) / 2, z: -3.075 }),
    box(DOOR.x1 - DOOR.x0 + 0.12, 0.06, 0.17, WOOD, { x: (DOOR.x0 + DOOR.x1) / 2, y: DOOR.h + 0.03, z: -3.075 }),
  ], m.prop, 'kusen');
  const W = DOOR.leaf;
  const H = DOOR.h - 0.02;
  /** Satu daun: panel navy berpanel + gagang tarik stainless vertikal panjang di sisi bebas (seperti foto). s = 1 / −1 (cermin). */
  const leaf = (it) => {
    const s = it.cermin ? -1 : 1;
    const panel = piece([
      box(W, H, 0.04, '#1f3768', { x: s * W / 2, y: H / 2, z: 0.02 }),
      ...[0.24, 0.61].flatMap((x) => [0.55, 1.2, 1.85].flatMap((y) => [
        box(0.28, 0.5, 0.008, '#182d58', { x: s * x, y, z: 0.042 }),
        box(0.28, 0.5, 0.008, '#182d58', { x: s * x, y, z: -0.002 }),
      ])),
    ], m.prop, 'daun');
    const hx = s * (W - 0.08);
    const handle = piece([
      cyl(0.012, 0.012, 0.6, '#cfd8dc', { x: hx, y: 1.05, z: 0.1 }),
      cyl(0.008, 0.008, 0.06, '#cfd8dc', { x: hx, y: 0.8, z: 0.07, rx: PI / 2 }),
      cyl(0.008, 0.008, 0.06, '#cfd8dc', { x: hx, y: 1.3, z: 0.07, rx: PI / 2 }),
      cyl(0.012, 0.012, 0.6, '#cfd8dc', { x: hx, y: 1.05, z: -0.06 }),
    ], m.metal, 'gagang');
    const hinge = groupOf('daun-pintu', panel, handle);
    hinge.position.set(it.x, 0, it.z);
    hinge.rotation.y = it.buka;
    return hinge;
  };
  return groupOf('S30', kusen, ...ASET.S30.items.map(leaf));
}
