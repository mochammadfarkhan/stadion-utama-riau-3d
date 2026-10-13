import * as THREE from 'three';
import { instanceParts, localMatrix, placeObject, groupFromParts } from '../siteutil/instanceParts.js';

/**
 * Tiang PJU 9 m: tiang galvanis, lengan lengkung, rumah lampu + bohlam emissive.
 * opts: { double: dua lengan, broken: lampu hilang (dicuri) }.
 */
export const LAMP_POST = Object.freeze({
  height: 9, radius: 0.1, baseH: 0.5, armLen: 1.8, armDrop: 0.4, headLen: 0.7,
  colors: { tiang: 0x8e949a, rumah: 0x3b3f44, bohlam: 0xfff2c2 },
});

const poleGeo = new THREE.CylinderGeometry(LAMP_POST.radius * 0.7, LAMP_POST.radius, LAMP_POST.height, 8).translate(0, LAMP_POST.height / 2, 0);
const baseGeo = new THREE.CylinderGeometry(0.25, 0.3, LAMP_POST.baseH, 8).translate(0, LAMP_POST.baseH / 2, 0);
const armGeo = new THREE.CylinderGeometry(0.05, 0.06, LAMP_POST.armLen, 6).rotateZ(Math.PI / 2);
const headGeo = new THREE.BoxGeometry(LAMP_POST.headLen, 0.16, 0.3);
const bulbGeo = new THREE.BoxGeometry(LAMP_POST.headLen * 0.8, 0.04, 0.22);
const poleMat = new THREE.MeshLambertMaterial({ color: LAMP_POST.colors.tiang });
const headMat = new THREE.MeshLambertMaterial({ color: LAMP_POST.colors.rumah });
const bulbMat = new THREE.MeshStandardMaterial({ color: LAMP_POST.colors.bohlam, emissive: LAMP_POST.colors.bohlam, emissiveIntensity: 1.2 });

/** Matriks lengan pada sisi s (+1 kanan, -1 kiri), sedikit naik ke ujung. */
function armMatrix(s) {
  return localMatrix(s * LAMP_POST.armLen * 0.5, LAMP_POST.height - LAMP_POST.armDrop, 0, 0, 0, -s * 0.18);
}

function headMatrix(s) {
  return localMatrix(s * (LAMP_POST.armLen - 0.1), LAMP_POST.height - LAMP_POST.armDrop + 0.2, 0);
}

function bulbMatrix(s) {
  return localMatrix(s * (LAMP_POST.armLen - 0.1), LAMP_POST.height - LAMP_POST.armDrop + 0.11, 0);
}

/** Part tiang + lengan sesuai konfigurasi (tanpa kepala lampu). */
function structureParts(double) {
  const sides = double ? [1, -1] : [1];
  return [
    { geometry: baseGeo, material: poleMat, name: 'pondasi' },
    { geometry: poleGeo, material: poleMat, castShadow: true, name: 'tiang' },
    ...sides.map((s) => ({ geometry: armGeo, material: poleMat, matrix: armMatrix(s), castShadow: true, name: 'lengan' })),
  ];
}

/** Part kepala lampu (rumah + bohlam) untuk sisi tertentu. */
function lampParts(double) {
  const sides = double ? [1, -1] : [1];
  return sides.flatMap((s) => [
    { geometry: headGeo, material: headMat, matrix: headMatrix(s), name: 'rumahLampu' },
    { geometry: bulbGeo, material: bulbMat, matrix: bulbMatrix(s), name: 'bohlam' },
  ]);
}

/** Satu tiang PJU. opts: { double, broken, x, z, rotY } */
export function createLampPost(opts = {}) {
  const parts = [...structureParts(!!opts.double), ...(opts.broken ? [] : lampParts(!!opts.double))];
  const g = groupFromParts(parts, 'tiangPJU');
  g.userData = { double: !!opts.double, broken: !!opts.broken };
  return placeObject(g, opts);
}

/** Banyak tiang PJU instanced. positions: [{x,z,rotY?,double?,broken?}] */
export function createLampPosts(positions = [], opts = {}) {
  const g = new THREE.Group();
  g.name = 'tiangPJU';
  const dbl = (p) => !!(p.double ?? opts.double);
  const brk = (p) => !!(p.broken ?? opts.broken);
  const sets = [
    ['single', positions.filter((p) => !dbl(p))],
    ['double', positions.filter((p) => dbl(p))],
  ];
  sets.forEach(([key, list]) => {
    if (!list.length) return;
    const isDouble = key === 'double';
    g.add(instanceParts(structureParts(isDouble), list, `struktur-${key}`));
    const lit = list.filter((p) => !brk(p));
    if (lit.length) g.add(instanceParts(lampParts(isDouble), lit, `lampu-${key}`));
  });
  g.userData.count = positions.length;
  g.userData.brokenCount = positions.filter(brk).length;
  return g;
}
