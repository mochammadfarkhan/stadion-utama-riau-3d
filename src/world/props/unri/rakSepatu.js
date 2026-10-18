/**
 * P07 rak sepatu teras [INFERENSI pola umum]: rak kayu 3 susun terbuka ke −Z berisi sepatu warna-warni.
 * Instanced (2 draw call untuk semua rak). positions: [{x, y?, z, rotY?}].
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { createRandom } from '../../siteutil/rng.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { boxAt, paint } from './geom.js';

export const RAK_SEPATU = Object.freeze({ w: 1.2, d: 0.35, h: 0.9 });
const SHELVES = Object.freeze([0.06, 0.36, 0.66]);
const SHOE_COLORS = Object.freeze([0x1b1b1b, 0xf5f5f5, 0x6d4c41, 0x1565c0, 0x9e9e9e, 0xc62828, 0x2e7d32, 0x37474f]);

function rakGeometry() {
  const { w, d, h } = RAK_SEPATU;
  return mergeAll([
    boxAt(0.02, h, d, -(w / 2 - 0.01), 0, 0),
    boxAt(0.02, h, d, w / 2 - 0.01, 0, 0),
    ...SHELVES.map((y) => boxAt(w - 0.04, 0.02, d - 0.02, 0, y, 0.01)),
    boxAt(w, 0.02, d, 0, h - 0.02, 0),
    boxAt(w - 0.04, 0.06, 0.01, 0, 0.8, d / 2 - 0.005),
  ]);
}

function sepatuGeometry() {
  const rnd = createRandom(907);
  const pairs = [4, 3, 3];
  const geos = [];
  SHELVES.forEach((y, s) => {
    const n = pairs[s];
    for (let k = 0; k < n; k += 1) {
      const cx = -0.45 + (k * 0.9) / Math.max(1, n - 1) + rnd.range(-0.03, 0.03);
      const color = rnd.pick(SHOE_COLORS);
      for (const off of [-0.055, 0.055]) geos.push(paint(boxAt(0.09, 0.07, 0.25, cx + off, y + 0.02, -0.02), color));
    }
  });
  return mergeAll(geos);
}

const geoRak = () => currentScope().get('unri:rakSepatu:geo', rakGeometry);
const geoSepatu = () => currentScope().get('unri:rakSepatu:sepatu', sepatuGeometry);
const matRak = () => currentScope().get('unri:rakSepatu:mat', () => new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.85 }));
const matSepatu = () => currentScope().get('unri:rakSepatu:matSepatu', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));

export function createRakSepatu(positions = []) {
  return instanceParts([
    { geometry: geoRak(), material: matRak(), castShadow: true, name: 'P07-rak' },
    { geometry: geoSepatu(), material: matSepatu(), name: 'P07-sepatu' },
  ], positions, 'P07-rak-sepatu');
}
