/**
 * P08 sandal menumpuk di depan pintu sekre [INFERENSI pola umum: alas kaki dilepas sebelum masuk]:
 * 6 pasang sandal jepit/selop warna-warni, sebagian menumpuk. Satu geometri berwarna (vertexColors),
 * satu draw call untuk semua tumpukan. Bbox 0,8 × 0,5 × ≤ 0,05.
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { boxAt, paint } from './geom.js';

export const SANDAL_TUMPUK = Object.freeze({ w: 0.8, d: 0.5, h: 0.05 });
const SOLE = Object.freeze({ w: 0.1, h: 0.015, l: 0.25 });
/**
 * Pasangan [x, z, yaw, tingkat, warna]: dua pasang terluar sejajar sumbu menentukan bbox 0,8 × 0,5;
 * empat pasang di dalam (jangkauan ≤ 0,166 m dari pusatnya) diputar dan sebagian menumpuk.
 */
const PAIRS = Object.freeze([
  [-0.29, -0.125, 0, 0, 0x1e88e5], [0.29, 0.125, 0, 0, 0x212121], [-0.05, 0.06, 0.5, 0, 0x43a047],
  [0.1, -0.06, -0.7, 0, 0xe53935], [-0.15, 0, 1.6, 1, 0xfdd835], [0.2, 0.05, 2.6, 1, 0x8d6e63],
]);

function sandalGeometry() {
  const geos = [];
  PAIRS.forEach(([cx, cz, yaw, level, color]) => {
    for (const off of [-0.06, 0.06]) {
      const sole = boxAt(SOLE.w, SOLE.h, SOLE.l, 0, 0, 0);
      const strap = boxAt(0.08, 0.008, 0.02, 0, SOLE.h, -0.06);
      const g = mergeAll([sole, strap]).rotateY(yaw).translate(cx + Math.cos(yaw) * off, level * 0.017, cz - Math.sin(yaw) * off);
      geos.push(paint(g, color));
    }
  });
  return mergeAll(geos);
}

const geo = () => currentScope().get('unri:sandal:geo', sandalGeometry);
const mat = () => currentScope().get('unri:sandal:mat', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));

export function createSandalTumpuk(positions = []) {
  return instanceParts([{ geometry: geo(), material: mat(), name: 'P08-sandal' }], positions, 'P08-sandal-tumpuk');
}
