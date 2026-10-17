import * as THREE from 'three';
import { instanceParts, localMatrix, groupFromParts, placeObject, colorizeInstances } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';
import { roundedBox, mergeAll } from '../siteutil/rounded.js';
import { currentScope } from '../../engine/ResourceScope.js';

/**
 * Kendaraan gaya cozy (proporsi mainan): mobil gemuk berkabin membulat & roda
 * tebal, motor sederhana membulat, angkot hijau, bus Trans Metro.
 * Versi parkir memakai InstancedMesh per material dengan warna body acak.
 */
export const VEHICLE_COLORS = Object.freeze({
  car: [0xf5f5f5, 0x455a64, 0x90a4ae, 0xef5350, 0x5c8dd6, 0xffd54f, 0x80cbc4],
  moto: [0x37474f, 0xef5350, 0x42a5f5, 0xffee58, 0x9e9e9e],
  angkot: 0x66bb6a,
  transMetro: { body: 0x4a8fe0, stripe: 0xfafafa },
  glass: 0x90caf9,
  tire: 0x37474f,
});
const EDGE = Object.freeze({ body: 0.1, cabin: 0.16, small: 0.04, bus: 0.2 });

const glassMat = () => currentScope().get('Vehicles:glassMat', () => new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.glass }));
const tireMat = () => currentScope().get('Vehicles:tireMat', () => new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.tire }));

/** Roda tebal: silinder + bola kecil sebagai velg, sumbu sepanjang Z. */
function wheel(r, width) {
  const tire = new THREE.CylinderGeometry(r, r, width, 12).rotateX(Math.PI / 2);
  const hub = new THREE.SphereGeometry(r * 0.45, 6, 4).scale(1, 1, width * 1.3 / r);
  return mergeAll([tire, hub]);
}

/** Gabungan beberapa roda pada posisi [x, z] (y = radius) jadi satu geometri. */
function wheelSet(r, width, spots) {
  return mergeAll(spots.map(([x, z]) => wheel(r, width).translate(x, r, z)));
}

const CAR_WHEELS = [[1.35, 0.92], [1.35, -0.92], [-1.35, 0.92], [-1.35, -0.92]];
const carWheelGeo = () => currentScope().get('Vehicles:carWheelGeo', () => wheelSet(0.38, 0.32, CAR_WHEELS));
const busWheelGeo = () => currentScope().get('Vehicles:busWheelGeo', () => wheelSet(0.55, 0.4, [[4.2, 1.25], [4.2, -1.25], [-3.6, 1.25], [-3.6, -1.25], [-2.4, 1.25], [-2.4, -1.25]]));

/** Part mobil penumpang gemuk (panjang di sumbu X): body + kabin membulat, kaca, roda. */
function carParts(bodyMat) {
  const body = roundedBox(4.1, 0.75, 1.85, EDGE.body).clone().translate(0, 0.72, 0);
  const cabin = roundedBox(2.3, 0.75, 1.65, EDGE.cabin).clone().translate(-0.2, 1.3, 0);
  return [
    { geometry: mergeAll([body, cabin]), material: bodyMat, castShadow: true, name: 'body' },
    { geometry: roundedBox(2.0, 0.42, 1.7, EDGE.cabin), material: glassMat(), matrix: localMatrix(-0.2, 1.38, 0), name: 'kaca' },
    { geometry: carWheelGeo(), material: tireMat(), name: 'roda' },
  ];
}

/** Part sepeda motor membulat: badan kapsul, jok, stang, roda tebal. */
function motorcycleParts(bodyMat) {
  const dark = mergeAll([
    roundedBox(0.6, 0.12, 0.34, EDGE.small).clone().translate(-0.15, 0.86, 0),
    new THREE.CapsuleGeometry(0.03, 0.56, 2, 6).rotateX(Math.PI / 2).translate(0.55, 1.02, 0),
    new THREE.CapsuleGeometry(0.035, 0.42, 2, 6).rotateZ(-0.35).translate(0.6, 0.6, 0),
    wheel(0.32, 0.14).translate(0.7, 0.32, 0),
    wheel(0.32, 0.14).translate(-0.65, 0.32, 0),
  ]);
  return [
    { geometry: new THREE.CapsuleGeometry(0.18, 0.75, 2, 8).rotateZ(Math.PI / 2).translate(0, 0.64, 0), material: bodyMat, castShadow: true, name: 'body' },
    { geometry: dark, material: tireMat(), name: 'rangka' },
  ];
}

/** Part angkot (minibus hijau membulat). */
function angkotParts() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.angkot });
  const glass = mergeAll([
    roundedBox(3.3, 0.6, 1.8, EDGE.small).clone().translate(-0.2, 1.75, 0),
    roundedBox(0.16, 0.6, 1.5, EDGE.small).clone().translate(2.1, 1.75, 0),
  ]);
  return [
    { geometry: roundedBox(4.2, 1.8, 1.75, EDGE.cabin), material: bodyMat, matrix: localMatrix(0, 1.3, 0), castShadow: true, name: 'body' },
    { geometry: glass, material: glassMat(), name: 'jendela' },
    { geometry: carWheelGeo(), material: tireMat(), name: 'roda' },
  ];
}

/** Part bus Trans Metro Pekanbaru (biru-putih, badan membulat, roda tebal). */
function transMetroParts() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.transMetro.body });
  const stripeMat = new THREE.MeshLambertMaterial({ color: VEHICLE_COLORS.transMetro.stripe });
  const glass = mergeAll([
    roundedBox(10.2, 1.0, 2.6, EDGE.small).clone().translate(0, 2.65, 0),
    roundedBox(0.16, 1.6, 2.2, EDGE.small).clone().translate(5.55, 2.2, 0),
  ]);
  return [
    { geometry: roundedBox(11, 2.7, 2.55, EDGE.bus), material: bodyMat, matrix: localMatrix(0, 2.05, 0), castShadow: true, name: 'body' },
    { geometry: roundedBox(11.04, 0.7, 2.6, EDGE.small), material: stripeMat, matrix: localMatrix(0, 1.2, 0), name: 'strip' },
    { geometry: glass, material: glassMat(), name: 'jendela' },
    { geometry: busWheelGeo(), material: tireMat(), name: 'roda' },
  ];
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

/** Instanced per material; mesh 'body' diberi warna per-instance dari palet. */
function instancedVehicles(parts, positions, palette, seed, name) {
  const g = instanceParts(parts, positions, name);
  if (!positions.length) return g;
  const rnd = createRandom(seed);
  const body = g.children.find((m) => m.isInstancedMesh && m.name.includes('body'));
  if (body) colorizeInstances(body, palette, rnd);
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
