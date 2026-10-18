/**
 * P10 galon air kosong (19 L) menumpuk di teras sekre [INFERENSI pola umum]: badan, bahu, leher;
 * plastik biru tembus. Instanced.
 */
import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';

export const GALON = Object.freeze({ r: 0.135, h: 0.5 });

function galonGeometry() {
  const seg = 14;
  return mergeAll([
    new THREE.CylinderGeometry(0.128, 0.128, 0.02, seg).translate(0, 0.01, 0),
    new THREE.CylinderGeometry(GALON.r, GALON.r, 0.38, seg).translate(0, 0.21, 0),
    new THREE.CylinderGeometry(0.06, GALON.r, 0.06, seg).translate(0, 0.43, 0),
    new THREE.CylinderGeometry(0.03, 0.035, 0.04, 10).translate(0, 0.48, 0),
  ]);
}

const geo = () => currentScope().get('unri:galon:geo', galonGeometry);
const mat = () => currentScope().get('unri:galon:mat', () => new THREE.MeshStandardMaterial({
  color: 0x6fb7e9, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.78, depthWrite: false,
}));

export function createGalon(positions = []) {
  return instanceParts([{ geometry: geo(), material: mat(), name: 'P10-galon' }], positions, 'P10-galon-kosong');
}
