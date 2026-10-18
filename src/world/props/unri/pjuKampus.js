import * as THREE from 'three';
import { groupFromParts, instanceParts, placeObject } from '../../siteutil/instanceParts.js';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { LAMP_POST } from '../LampPost.js';

/**
 * P03 pju-kampus (katalog aset): tiang galvanis satu lengan + kepala LED pipih (placeholder prosedural, bentuk
 * [INFERENSI]). Kepala lampu di LAMP_POST.height − LAMP_POST.armDrop (8,6 m) = LAMP_HEIGHT TimeOfDay agar
 * PointLight/halo malam tepat di kepala lampu (katalog menulis ±7 m berlabel INF — disesuaikan, plan M2).
 * Lengan mengarah ke +Z lokal: rotY = arah ke jalan. Dua material: struktur abu (Lambert) + muka lampu emisif.
 */
export const PJU_KAMPUS = Object.freeze({
  headY: LAMP_POST.height - LAMP_POST.armDrop,
  armReach: 1.5,
  poleR: 0.075,
  baseR: 0.15,
  head: Object.freeze({ w: 0.3, h: 0.1, d: 0.6 }),
  colors: Object.freeze({ tiang: 0x9aa3a8, lampu: 0xfff1cf }),
});

function structureGeometry() {
  const { headY, armReach, poleR, baseR, head } = PJU_KAMPUS;
  const poleH = headY + 0.25;
  return mergeAll([
    new THREE.CylinderGeometry(poleR * 0.7, poleR, poleH, 8).translate(0, poleH / 2, 0),
    new THREE.CylinderGeometry(baseR, baseR * 1.15, 0.5, 8).translate(0, 0.25, 0),
    new THREE.CylinderGeometry(0.035, 0.035, armReach, 6).rotateX(Math.PI / 2).translate(0, headY + 0.15, armReach / 2),
    new THREE.BoxGeometry(head.w, head.h, head.d).translate(0, headY + 0.07, armReach),
  ]);
}

const structureGeo = () => currentScope().get('pjuKampus:structureGeo', structureGeometry);
const faceGeo = () => currentScope().get('pjuKampus:faceGeo', () => new THREE.PlaneGeometry(PJU_KAMPUS.head.w * 0.85, PJU_KAMPUS.head.d * 0.85)
  .rotateX(Math.PI / 2).translate(0, PJU_KAMPUS.headY + 0.015, PJU_KAMPUS.armReach));
const poleMat = () => currentScope().get('pjuKampus:poleMat', () => new THREE.MeshLambertMaterial({ color: PJU_KAMPUS.colors.tiang }));
const faceMat = () => currentScope().get('pjuKampus:faceMat', () => {
  const m = new THREE.MeshStandardMaterial({
    color: PJU_KAMPUS.colors.lampu, emissive: PJU_KAMPUS.colors.lampu, emissiveIntensity: 0, side: THREE.DoubleSide,
  });
  m.name = 'bohlamPJUKampus';
  // Dibaca registry malam TimeOfDay: emissiveIntensity naik ke `on` saat lampu menyala.
  m.userData.nightEmissive = { on: 6, off: 0 };
  return m;
});

/** Part PJU kampus (pola parts: geometry, material, castShadow, name). Panggil di dalam ResourceScope pemilik. */
export function pjuKampusParts() {
  return [
    { geometry: structureGeo(), material: poleMat(), castShadow: true, name: 'tiangPJUKampus' },
    { geometry: faceGeo(), material: faceMat(), name: 'lampuPJUKampus' },
  ];
}

/** Satu PJU kampus. opts: { x, z, y?, rotY } */
export function createPjuKampus(opts = {}) {
  return placeObject(groupFromParts(pjuKampusParts(), 'pjuKampus'), opts);
}

/** Banyak PJU kampus instanced. positions: [{x, y, z, rotY}] */
export function createPjuKampusInstances(positions) {
  return instanceParts(pjuKampusParts(), positions, 'unri:pju');
}
