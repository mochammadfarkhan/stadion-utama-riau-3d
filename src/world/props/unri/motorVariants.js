/**
 * Varian motor parkir kampus (katalog A01–A04): dimensi (L × P × T, m), path GLB final (Blender `m7_motor.py`: model detail,
 * `-lod` ±1k segitiga, `-far` ±150 segitiga untuk parkir padat/jauh) dan
 * placeholder prosedural berukuran sama. Model menghadap −Z lokal, origin di tengah alas (aturan katalog).
 * Material bodi bernama `unri:bodi` (konvensi M4) berwarna putih: warna per instans dari MOTOR_BODY_COLORS.
 * `path: null` = belum ada GLB (placeholder langsung, tanpa permintaan HTTP yang gagal).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope } from '../../../engine/ResourceScope.js';

export const MOTOR_VARIANTS = Object.freeze({
  A01: Object.freeze({ id: 'A01', name: 'motor-bebek', path: 'models/unri/a01-motor-bebek.glb', pathLod: 'models/unri/a01-motor-bebek-lod.glb', pathFar: 'models/unri/a01-motor-bebek-far.glb', width: 0.7, length: 1.9, height: 1.05, wheelR: 0.29 }),
  A02: Object.freeze({ id: 'A02', name: 'motor-matic', path: 'models/unri/a02-motor-matic.glb', pathLod: 'models/unri/a02-motor-matic-lod.glb', pathFar: 'models/unri/a02-motor-matic-far.glb', width: 0.7, length: 1.85, height: 1.1, wheelR: 0.25 }),
  A03: Object.freeze({ id: 'A03', name: 'motor-sport', path: 'models/unri/a03-motor-sport.glb', pathLod: 'models/unri/a03-motor-sport-lod.glb', pathFar: 'models/unri/a03-motor-sport-far.glb', width: 0.75, length: 2.0, height: 1.1, wheelR: 0.3 }),
  A04: Object.freeze({ id: 'A04', name: 'motor-tua', path: 'models/unri/a04-motor-tua.glb', pathLod: 'models/unri/a04-motor-tua-lod.glb', pathFar: 'models/unri/a04-motor-tua-far.glb', width: 0.7, length: 1.9, height: 1.0, wheelR: 0.29 }),
});

export const MOTOR_BODY_MATERIAL = 'unri:bodi';
/** Warna cat motor umum [INFERENSI]: merah, biru, hitam, putih, abu, oranye, ungu, hijau. */
export const MOTOR_BODY_COLORS = Object.freeze([0xc62828, 0x1565c0, 0x212121, 0xeeeeee, 0x9e9e9e, 0xef6c00, 0x6a1b9a, 0x2e7d32]);

const placeholderMaterials = () => currentScope().get('unri:motor:placeholderMats', () => ({
  [MOTOR_BODY_MATERIAL]: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  'unri:hitam': new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
}));

/**
 * Placeholder (katalog: "kotak bodi + 2 silinder roda") sebagai sumber per material.
 * @returns {Array<{name:string, geometry:THREE.BufferGeometry, material:THREE.Material}>}
 */
export function motorPlaceholderSources(variant) {
  const mats = placeholderMaterials();
  const body = new THREE.BoxGeometry(variant.width * 0.5, variant.height * 0.45, variant.length * 0.72);
  body.translate(0, variant.height * 0.55, 0);
  const wheels = [-1, 1].map((s) => {
    const g = new THREE.CylinderGeometry(variant.wheelR, variant.wheelR, 0.09, 12);
    g.rotateZ(Math.PI / 2);
    g.translate(0, variant.wheelR, s * (variant.length / 2 - variant.wheelR));
    return g;
  });
  const tyres = mergeGeometries(wheels, false);
  wheels.forEach((g) => g.dispose());
  return [
    { name: MOTOR_BODY_MATERIAL, geometry: body, material: mats[MOTOR_BODY_MATERIAL] },
    { name: 'unri:hitam', geometry: tyres, material: mats['unri:hitam'] },
  ];
}
