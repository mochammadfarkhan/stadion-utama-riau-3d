// src/world/props/unri/palem.js
/**
 * V05 palem (taman depan Rektorat & poros) [T foto 2016]: batang ramping 7 m + 11 pelepah melengkung
 * terkulai (bidang meruncing, dua sisi) + bonggol. ±250 segitiga. Part untuk instanceParts.
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { mergeAll } from '../../siteutil/rounded.js';

export const PALEM = Object.freeze({
  trunkH: 7.0, fronds: 11, frondLen: 3.4, frondW: 0.55,
  colors: Object.freeze({ batang: 0x9b8c74, daun: 0x4e7a32 }),
});

/** Satu pelepah sepanjang +Z: meruncing, naik lalu terkulai. */
function frondGeometry() {
  const L = PALEM.frondLen;
  const g = new THREE.PlaneGeometry(PALEM.frondW, L, 1, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = (pos.getY(i) + L / 2) / L; // 0 pangkal … 1 ujung
    pos.setXYZ(i, pos.getX(i) * (1 - 0.7 * t), L * (0.35 * t - 0.55 * t * t), t * L);
  }
  g.computeVertexNormals();
  return g;
}

function crownGeometry() {
  const parts = [];
  for (let k = 0; k < PALEM.fronds; k += 1) {
    const f = frondGeometry();
    f.rotateX(-(0.15 + (k % 3) * 0.12));
    f.rotateY((k / PALEM.fronds) * Math.PI * 2 + (k % 2) * 0.2);
    f.translate(0, PALEM.trunkH, 0);
    parts.push(f);
  }
  parts.push(new THREE.SphereGeometry(0.35, 8, 6).translate(0, PALEM.trunkH, 0));
  return mergeAll(parts);
}

const trunkGeo = () => currentScope().get('V05:batang', () => new THREE.CylinderGeometry(0.16, 0.24, PALEM.trunkH, 8).translate(0, PALEM.trunkH / 2, 0));
const crownGeo = () => currentScope().get('V05:tajuk', crownGeometry);
const trunkMat = () => currentScope().get('V05:matBatang', () => Object.assign(new THREE.MeshLambertMaterial({ color: PALEM.colors.batang }), { name: 'V05:batang' }));
const leafMat = () => currentScope().get('V05:matDaun', () => Object.assign(new THREE.MeshLambertMaterial({ color: PALEM.colors.daun, side: THREE.DoubleSide }), { name: 'V05:daun' }));

/** Part V05 untuk instanceParts. */
export function palemParts() {
  return [
    { geometry: trunkGeo(), material: trunkMat(), castShadow: true, name: 'palemBatang' },
    { geometry: crownGeo(), material: leafMat(), castShadow: true, name: 'palemDaun' },
  ];
}
