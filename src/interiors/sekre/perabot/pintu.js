import { PI, box, cyl, piece, groupOf } from './bentuk.js';
import { ASET, DOOR } from '../data.js';

/** S30 pintu kayu + kusen, daun terbuka ke dalam (engsel di DOOR.x0). Koordinat ruang. */
export function buildPintu(m) {
  const it = ASET.S30.items[0];
  const WOOD = '#d4d6da';
  const kusen = piece([
    box(0.06, 2.16, 0.17, WOOD, { x: DOOR.x0 - 0.03, y: 1.08, z: -3.075 }),
    box(0.06, 2.16, 0.17, WOOD, { x: DOOR.x1 + 0.03, y: 1.08, z: -3.075 }),
    box(DOOR.x1 - DOOR.x0 + 0.12, 0.06, 0.17, WOOD, { x: (DOOR.x0 + DOOR.x1) / 2, y: 2.13, z: -3.075 }),
  ], m.prop, 'kusen');
  const panel = piece([
    box(0.9, 2.08, 0.04, '#1f3768', { x: 0.45, y: 1.04, z: 0.02 }),
    ...[0.25, 0.65].flatMap((x) => [0.6, 1.5].flatMap((y) => [
      box(0.3, 0.75, 0.008, '#182d58', { x, y, z: 0.042 }),
      box(0.3, 0.75, 0.008, '#182d58', { x, y, z: -0.002 }),
    ])),
  ], m.prop, 'daun');
  const handle = piece([
    cyl(0.01, 0.01, 0.12, '#cfd8dc', { x: 0.8, y: 1.0, z: 0.065, rz: PI / 2 }),
    cyl(0.025, 0.025, 0.01, '#cfd8dc', { x: 0.84, y: 1.0, z: 0.046, rx: PI / 2 }),
    cyl(0.01, 0.01, 0.12, '#cfd8dc', { x: 0.8, y: 1.0, z: -0.025, rz: PI / 2 }),
  ], m.metal, 'gagang');
  const hinge = groupOf('daun-pintu', panel, handle);
  hinge.position.set(it.x, 0, it.z);
  hinge.rotation.y = it.buka;
  return groupOf('S30', kusen, hinge);
}
