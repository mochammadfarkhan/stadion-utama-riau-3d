import * as THREE from 'three';
import { instanceParts, localMatrix, placeObject, groupFromParts } from '../siteutil/instanceParts.js';
import { roundedBox } from '../siteutil/rounded.js';

/**
 * Bangku taman gaya cozy: 'semen' (dudukan tebal membulat + dua kaki gemuk)
 * atau 'besi' (bilah tebal membulat + rangka kaki membulat).
 * createBench(opts) -> Group tunggal; createBenches(positions) -> InstancedMesh per material.
 * Bangku tidak memancarkan bayangan (kecil & banyak) demi performa shadow pass.
 */
export const BENCH = Object.freeze({
  length: 1.8, seatDepth: 0.5, seatH: 0.45, slatCount: 3, backH: 0.45,
  colors: { semen: 0xd7d2c8, bilah: 0x81c784, kaki: 0x6d7a86 },
});
const EDGE = Object.freeze({ seat: 0.06, leg: 0.05, slat: 0.03 });
const SLAT = Object.freeze({ thick: 0.07, width: 0.13 });

const matSemen = new THREE.MeshLambertMaterial({ color: BENCH.colors.semen });
const matBilah = new THREE.MeshLambertMaterial({ color: BENCH.colors.bilah });
const matKaki = new THREE.MeshLambertMaterial({ color: BENCH.colors.kaki });

/** Part bangku semen: dudukan tebal membulat, dua kaki balok gemuk. */
function semenParts() {
  const seat = roundedBox(BENCH.length, 0.16, BENCH.seatDepth, EDGE.seat);
  const leg = roundedBox(0.34, BENCH.seatH, BENCH.seatDepth - 0.08, EDGE.leg);
  return [
    { geometry: seat, material: matSemen, matrix: localMatrix(0, BENCH.seatH + 0.08, 0), name: 'dudukan' },
    { geometry: leg, material: matSemen, matrix: localMatrix(-0.62, BENCH.seatH / 2, 0), name: 'kakiKiri' },
    { geometry: leg, material: matSemen, matrix: localMatrix(0.62, BENCH.seatH / 2, 0), name: 'kakiKanan' },
  ];
}

/** Part bangku besi: bilah tebal dudukan & sandaran, dua kaki rangka membulat. */
function besiParts() {
  const slat = roundedBox(BENCH.length, SLAT.thick, SLAT.width, EDGE.slat);
  const leg = roundedBox(0.09, BENCH.seatH, BENCH.seatDepth, EDGE.slat);
  const backLeg = roundedBox(0.09, BENCH.backH, 0.09, EDGE.slat);
  const parts = [];
  for (let i = 0; i < BENCH.slatCount; i += 1) {
    const z = -BENCH.seatDepth / 2 + 0.08 + i * (BENCH.seatDepth - 0.16) / (BENCH.slatCount - 1);
    parts.push({ geometry: slat, material: matBilah, matrix: localMatrix(0, BENCH.seatH, z), name: `bilah-${i}` });
  }
  for (let i = 0; i < 2; i += 1) {
    const y = BENCH.seatH + 0.16 + i * 0.2;
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
