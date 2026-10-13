import * as THREE from 'three';
import { instancePart, localMatrix, groupFromParts, placeObject, colorizeInstances } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';

/**
 * Kendaraan low-poly (box + silinder): mobil, motor, angkot hijau, bus Trans Metro.
 * Versi parkir memakai InstancedMesh per bagian dengan warna body acak.
 */
export const VEHICLE_COLORS = Object.freeze({
  car: [0xd9d9d9, 0x1c1c1c, 0x8a8f94, 0xb22222, 0x1f4e9c, 0xf2f2f2, 0x6b4f2a],
  moto: [0x1c1c1c, 0xc0392b, 0x2e86de, 0xf1c40f, 0x7f8c8d],
  angkot: 0x1f8a3b,
  transMetro: { body: 0x1e5aa8, stripe: 0xf4f4f4 },
  glass: 0x1f2a36,
  tire: 0x161616,
});

const glassMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.glass });
const tireMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.tire });
const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10).rotateX(Math.PI / 2);
const motoWheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10).rotateX(Math.PI / 2);

/** Part mobil penumpang (panjang di sumbu X). */
function carParts(bodyMat) {
  const parts = [
    { geometry: new THREE.BoxGeometry(4.2, 0.6, 1.8), material: bodyMat, matrix: localMatrix(0, 0.65, 0), castShadow: true, name: 'body' },
    { geometry: new THREE.BoxGeometry(2.2, 0.6, 1.6), material: glassMat, matrix: localMatrix(-0.2, 1.25, 0), castShadow: true, name: 'kabin' },
  ];
  [[1.4, 0.9], [1.4, -0.9], [-1.4, 0.9], [-1.4, -0.9]].forEach(([x, z]) => parts.push({
    geometry: wheelGeo, material: tireMat, matrix: localMatrix(x, 0.33, z), name: 'roda',
  }));
  return parts;
}

/** Part sepeda motor. */
function motorcycleParts(bodyMat) {
  return [
    { geometry: new THREE.BoxGeometry(1.1, 0.3, 0.3), material: bodyMat, matrix: localMatrix(0, 0.62, 0), castShadow: true, name: 'body' },
    { geometry: new THREE.BoxGeometry(0.65, 0.1, 0.32), material: tireMat, matrix: localMatrix(-0.15, 0.82, 0), name: 'jok' },
    { geometry: new THREE.BoxGeometry(0.05, 0.05, 0.6), material: tireMat, matrix: localMatrix(0.55, 1.0, 0), name: 'stang' },
    { geometry: new THREE.BoxGeometry(0.05, 0.5, 0.05), material: tireMat, matrix: localMatrix(0.6, 0.55, 0, 0, 0, -0.35), name: 'garpu' },
    { geometry: motoWheelGeo, material: tireMat, matrix: localMatrix(0.7, 0.3, 0), name: 'rodaDepan' },
    { geometry: motoWheelGeo, material: tireMat, matrix: localMatrix(-0.65, 0.3, 0), name: 'rodaBelakang' },
  ];
}

/** Part angkot (minibus hijau). */
function angkotParts() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.angkot });
  const parts = [
    { geometry: new THREE.BoxGeometry(4.2, 1.7, 1.7), material: bodyMat, matrix: localMatrix(0, 1.2, 0), castShadow: true, name: 'body' },
    { geometry: new THREE.BoxGeometry(3.4, 0.55, 1.74), material: glassMat, matrix: localMatrix(-0.2, 1.65, 0), name: 'jendela' },
    { geometry: new THREE.BoxGeometry(0.1, 0.5, 1.5), material: glassMat, matrix: localMatrix(2.12, 1.65, 0), name: 'kacaDepan' },
  ];
  [[1.4, 0.9], [1.4, -0.9], [-1.4, 0.9], [-1.4, -0.9]].forEach(([x, z]) => parts.push({
    geometry: wheelGeo, material: tireMat, matrix: localMatrix(x, 0.33, z), name: 'roda',
  }));
  return parts;
}

/** Part bus Trans Metro Pekanbaru (biru-putih). */
function transMetroParts() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.transMetro.body });
  const stripeMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.transMetro.stripe });
  const parts = [
    { geometry: new THREE.BoxGeometry(11, 2.6, 2.5), material: bodyMat, matrix: localMatrix(0, 1.9, 0), castShadow: true, name: 'body' },
    { geometry: new THREE.BoxGeometry(11.02, 0.7, 2.52), material: stripeMat, matrix: localMatrix(0, 1.1, 0), name: 'strip' },
    { geometry: new THREE.BoxGeometry(10.2, 0.9, 2.54), material: glassMat, matrix: localMatrix(0, 2.5, 0), name: 'jendela' },
    { geometry: new THREE.BoxGeometry(0.1, 1.6, 2.2), material: glassMat, matrix: localMatrix(5.52, 2.1, 0), name: 'kacaDepan' },
  ];
  [[4.2, 1.2], [4.2, -1.2], [-3.6, 1.2], [-3.6, -1.2], [-2.4, 1.2], [-2.4, -1.2]].forEach(([x, z]) => parts.push({
    geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateX(Math.PI / 2), material: tireMat, matrix: localMatrix(x, 0.5, z), name: 'roda',
  }));
  return parts;
}

/** Mobil tunggal. opts: { color, x, z, rotY } */
export function createCar(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: opts.color ?? VEHICLE_COLORS.car[0] });
  return placeObject(groupFromParts(carParts(mat), 'mobil'), opts);
}

/** Motor tunggal. opts: { color, x, z, rotY } */
export function createMotorcycle(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: opts.color ?? VEHICLE_COLORS.moto[0] });
  return placeObject(groupFromParts(motorcycleParts(mat), 'motor'), opts);
}

/** Angkot hijau. */
export function createAngkot(opts = {}) {
  return placeObject(groupFromParts(angkotParts(), 'angkot'), opts);
}

/** Bus Trans Metro biru-putih. */
export function createTransMetroBus(opts = {}) {
  return placeObject(groupFromParts(transMetroParts(), 'busTransMetro'), opts);
}

/** Instanced per bagian; part 'body' diberi warna per-instance dari palet. */
function instancedVehicles(parts, positions, palette, seed, name) {
  const g = new THREE.Group();
  g.name = name;
  if (!positions.length) return g;
  const rnd = createRandom(seed);
  parts.forEach((p) => {
    const mesh = instancePart(p, positions);
    if (p.name === 'body') colorizeInstances(mesh, palette, rnd);
    g.add(mesh);
  });
  g.userData.count = positions.length;
  return g;
}

/** Mobil parkir instanced. positions: [{x,z,rotY?}] */
export function createParkedCars(positions = [], opts = {}) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  return instancedVehicles(carParts(bodyMat), positions, VEHICLE_COLORS.car, opts.seed ?? 17, 'mobilParkir');
}

/** Motor parkir instanced. positions: [{x,z,rotY?}] */
export function createParkedMotorcycles(positions = [], opts = {}) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  return instancedVehicles(motorcycleParts(bodyMat), positions, VEHICLE_COLORS.moto, opts.seed ?? 19, 'motorParkir');
}

/** Helper: posisi bay parkir mobil dari userData.bays Ground (ambil sebagian acak). */
export function pickParkingSpots(bays, fraction = 0.6, seed = 21) {
  const rnd = createRandom(seed);
  return bays.filter(() => rnd.chance(fraction)).map((b) => ({ x: b.x, z: b.z, rotY: Math.PI / 2 }));
}
