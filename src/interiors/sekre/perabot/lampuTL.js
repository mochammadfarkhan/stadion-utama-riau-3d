import { PI, box, cyl, piece, groupOf } from './bentuk.js';
import { ASET } from '../data.js';

/** S24: rumah lampu (prop) + tabung TL (material emisif bersama, kedua lampu satu mesh). Koordinat ruang. */
export function buildTL(m) {
  const housing = [];
  const tubes = [];
  for (const it of ASET.S24.items) {
    housing.push(box(0.1, 0.05, 1.22, '#f2f2f2', { x: it.x, y: it.y - 0.025, z: it.z }));
    housing.push(box(0.12, 0.01, 1.24, '#e6e6e6', { x: it.x, y: it.y - 0.052, z: it.z }));
    tubes.push(cyl(0.016, 0.016, 1.2, '#ffffff', { x: it.x, y: it.y - 0.075, z: it.z, rx: PI / 2 }));
  }
  return groupOf('S24', piece(housing, m.prop, 'rumah-tl', false), piece(tubes, m.tl, 'tabung-tl', false));
}
