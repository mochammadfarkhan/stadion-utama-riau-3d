/**
 * Placeholder halte Trans Metro Pekanbaru (katalog P02: atap di 4 tiang + bangku, 6 × 2 × 3 m). Sisi terbuka = −Z
 * lokal. Dipakai hanya bila node halte OSM berada di dalam distrik (keputusan D6: saat ini tidak).
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { localMatrix } from '../../siteutil/instanceParts.js';

export const HALTE_MODEL_PATH = 'models/unri/p02-halte-tmp.glb';

export function halteParts() {
  const scope = currentScope();
  const metal = scope.get('unri:halte:logam', () => new THREE.MeshLambertMaterial({ color: 0x8a949c }));
  const roof = scope.get('unri:halte:atap', () => new THREE.MeshLambertMaterial({ color: 0x2f4f6f }));
  const post = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8);
  const posts = [[-2.8, -0.85], [2.8, -0.85], [-2.8, 0.85], [2.8, 0.85]]
    .map(([x, z], i) => ({ geometry: post, material: metal, matrix: localMatrix(x, 1.3, z), name: `tiang-${i}` }));
  return [
    ...posts,
    { geometry: new THREE.BoxGeometry(6.2, 0.08, 2.3), material: roof, matrix: localMatrix(0, 2.72, 0), castShadow: true, name: 'atap' },
    { geometry: new THREE.BoxGeometry(4, 0.06, 0.4), material: metal, matrix: localMatrix(0, 0.45, 0.6), name: 'bangku' },
  ];
}
