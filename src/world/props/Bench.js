import * as THREE from 'three';
import { instanceParts, localMatrix, placeObject, groupFromParts } from '../siteutil/instanceParts.js';

/**
 * Bangku taman: 'semen' (balok beton retak) atau 'besi' (bilah + kaki besi).
 * createBench(opts) → Group tunggal; createBenches(positions) → InstancedMesh per material.
 * Bangku tidak memancarkan bayangan (kecil & banyak) demi performa shadow pass.
 */
export const BENCH = Object.freeze({
  length: 1.8, seatDepth: 0.5, seatH: 0.45, slatCount: 4, backH: 0.45,
  colors: { semen: 0x9d9a92, retak: 0x4a4740, bilah: 0x2c6e49, kaki: 0x3a3a3a },
});

const matSemen = new THREE.MeshLambertMaterial({ color: BENCH.colors.semen });
const matRetak = new THREE.MeshBasicMaterial({ color: BENCH.colors.retak });
const matBilah = new THREE.MeshLambertMaterial({ color: BENCH.colors.bilah });
const matKaki = new THREE.MeshLambertMaterial({ color: BENCH.colors.kaki });

/** Part bangku semen: dudukan tebal, dua kaki balok, garis retak gelap. */
function semenParts() {
  const seat = new THREE.BoxGeometry(BENCH.length, 0.12, BENCH.seatDepth);
  const leg = new THREE.BoxGeometry(0.3, BENCH.seatH, BENCH.seatDepth - 0.1);
  const crack = new THREE.BoxGeometry(0.02, 0.005, 0.3);
  const parts = [
    { geometry: seat, material: matSemen, matrix: localMatrix(0, BENCH.seatH + 0.06, 0), name: 'dudukan' },
    { geometry: leg, material: matSemen, matrix: localMatrix(-0.65, BENCH.seatH / 2, 0), name: 'kakiKiri' },
    { geometry: leg, material: matSemen, matrix: localMatrix(0.65, BENCH.seatH / 2, 0), name: 'kakiKanan' },
  ];
  [-0.4, 0.15, 0.55].forEach((x, i) => parts.push({
    geometry: crack, material: matRetak, matrix: localMatrix(x, BENCH.seatH + 0.125, (i - 1) * 0.08, 0, 0.5 + i * 0.4, 0), name: `retak-${i}`,
  }));
  return parts;
}

/** Part bangku besi: bilah dudukan & sandaran, dua kaki rangka. */
function besiParts() {
  const slat = new THREE.BoxGeometry(BENCH.length, 0.035, 0.09);
  const leg = new THREE.BoxGeometry(0.05, BENCH.seatH, BENCH.seatDepth);
  const backLeg = new THREE.BoxGeometry(0.05, BENCH.backH, 0.05);
  const parts = [];
  for (let i = 0; i < BENCH.slatCount; i += 1) {
    const z = -BENCH.seatDepth / 2 + 0.07 + i * (BENCH.seatDepth - 0.14) / (BENCH.slatCount - 1);
    parts.push({ geometry: slat, material: matBilah, matrix: localMatrix(0, BENCH.seatH, z), name: `bilah-${i}` });
  }
  for (let i = 0; i < 3; i += 1) {
    const y = BENCH.seatH + 0.12 + i * 0.14;
    parts.push({ geometry: slat, material: matBilah, matrix: localMatrix(0, y, -BENCH.seatDepth / 2 - 0.02, -0.15), name: `sandaran-${i}` });
  }
  [-0.75, 0.75].forEach((x) => {
    parts.push({ geometry: leg, material: matKaki, matrix: localMatrix(x, BENCH.seatH / 2, 0), name: 'kaki' });
    parts.push({ geometry: backLeg, material: matKaki, matrix: localMatrix(x, BENCH.seatH + BENCH.backH / 2, -BENCH.seatDepth / 2 - 0.03, -0.15), name: 'tiangSandaran' });
  });
  return parts;
}

/** Satu bangku. opts: { type: 'semen'|'besi', x, z, rotY } */
export function createBench(opts = {}) {
  const type = opts.type === 'besi' ? 'besi' : 'semen';
  const g = groupFromParts(type === 'besi' ? besiParts() : semenParts(), `bangku-${type}`);
  g.userData.type = type;
  return placeObject(g, opts);
}

/** Banyak bangku (instanced). positions: [{x, z, rotY?, type?}] */
export function createBenches(positions = [], opts = {}) {
  const g = new THREE.Group();
  g.name = 'bangku';
  const defaultType = opts.type ?? 'semen';
  const semen = positions.filter((p) => (p.type ?? defaultType) === 'semen');
  const besi = positions.filter((p) => (p.type ?? defaultType) === 'besi');
  if (semen.length) g.add(instanceParts(semenParts(), semen, 'bangkuSemen'));
  if (besi.length) g.add(instanceParts(besiParts(), besi, 'bangkuBesi'));
  g.userData.count = positions.length;
  return g;
}
