/**
 * Tiang bendera putih keliling oval (InstancedMesh) + bendera merah-putih dan bendera
 * Riau (hijau-kuning-merah) sebagai plane bergaris (vertex color, instanced per jenis).
 * Beberapa tiang sedikit miring (PRNG deterministik).
 */
import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Group,
  Matrix4, MeshLambertMaterial, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { STADIUM } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { instancedFromMatrices } from '../util/instancing.js';
import { createRng } from '../util/random.js';
import { createEllipse } from '../stadium/ovalFrame.js';

const POLE_HEIGHT = 12;
const POLE_R_TOP = 0.07;
const POLE_R_BASE = 0.11;
const FOOTING = { w: 0.8, h: 0.35 };
const FLAG_W = 2.4;
const FLAG_H = 1.6;
const FLAG_DROP = 0.3;
const TILT_CHANCE = 0.2;
const TILT_MAX = 0.06;
const WIND_YAW = 0.6;
const DEFAULT_OFFSET = 30; // jarak elips tiang dari tepi luar stadion

export const FLAG_INDONESIA = Object.freeze([0xd62828, 0xffffff]);
export const FLAG_RIAU = Object.freeze([0x1f7a3a, 0xf2c200, 0xd62828]);

/** Plane bendera bergaris horizontal; x: 0..W (mulai dari tiang), y: −H..0 (puncak di 0). */
export function buildStripedFlagGeometry(colors, width = FLAG_W, height = FLAG_H) {
  const pos = [];
  const col = [];
  const idx = [];
  const stripeH = height / colors.length;
  colors.forEach((hex, i) => {
    const y0 = -i * stripeH;
    const y1 = y0 - stripeH;
    const base = i * 4;
    pos.push(0, y0, 0, width, y0, 0, width, y1, 0, 0, y1, 0);
    const c = [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
    for (let v = 0; v < 4; v++) col.push(...c);
    idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Hitung transformasi tiap tiang: posisi di elips + kemiringan acak. */
function planPoles(count, semiX, semiZ, rng) {
  const ellipse = createEllipse(semiX, semiZ);
  const poles = [];
  for (let i = 0; i < count; i++) {
    const f = ellipse.frameAt(i / count);
    const tilted = rng() < TILT_CHANCE;
    const euler = new Euler(tilted ? (rng() - 0.5) * 2 * TILT_MAX : 0, 0, tilted ? (rng() - 0.5) * 2 * TILT_MAX : 0);
    poles.push({ base: new Vector3(f.x, 0, f.z), quat: new Quaternion().setFromEuler(euler) });
  }
  return poles;
}

function poleMatrices(poles, height) {
  const s = new Vector3(1, height, 1);
  return poles.map((p) => new Matrix4().compose(p.base, p.quat, s));
}

function footingMatrices(poles) {
  const q = new Quaternion();
  const s = new Vector3(1, 1, 1);
  return poles.map((p) => new Matrix4().compose(p.base.clone().setY(FOOTING.h / 2), q, s));
}

function finialMatrices(poles, height) {
  const s = new Vector3(1, 1, 1);
  return poles.map((p) => new Matrix4().compose(topOf(p, height), p.quat, s));
}

function topOf(pole, height, drop = 0) {
  return new Vector3(0, height - drop, 0).applyQuaternion(pole.quat).add(pole.base);
}

/** Matriks bendera untuk tiang terpilih (setiap `every` tiang, bergantian jenis). */
function flagMatrices(poles, height, every, parity) {
  const wind = new Quaternion().setFromEuler(new Euler(0, WIND_YAW, 0));
  const s = new Vector3(1, 1, 1);
  const out = [];
  poles.forEach((p, i) => {
    if (i % every !== 0 || Math.floor(i / every) % 2 !== parity) return;
    out.push(new Matrix4().compose(topOf(p, height, FLAG_DROP), p.quat.clone().multiply(wind), s));
  });
  return out;
}

/**
 * @param {{count?:number, semiX?:number, semiZ?:number, height?:number, flagEvery?:number, seed?:number}} opts
 * @returns {Group}
 */
export function createFlagpoles({
  count = 40,
  semiX = STADIUM.outerSemiX + DEFAULT_OFFSET,
  semiZ = STADIUM.outerSemiZ + DEFAULT_OFFSET,
  height = POLE_HEIGHT,
  flagEvery = 3,
  seed = 7,
} = {}) {
  const group = new Group();
  group.name = 'flagpoles';
  const poles = planPoles(count, semiX, semiZ, createRng(seed));
  const poleGeom = new CylinderGeometry(POLE_R_TOP, POLE_R_BASE, 1, 8).translate(0, 0.5, 0);
  const poleMesh = instancedFromMatrices(poleGeom, Materials.white(), poleMatrices(poles, height), 'poles');
  poleMesh.castShadow = true;
  group.add(poleMesh);
  group.add(instancedFromMatrices(new BoxGeometry(FOOTING.w, FOOTING.h, FOOTING.w), Materials.concrete(), footingMatrices(poles), 'footings'));
  group.add(instancedFromMatrices(new SphereGeometry(0.15, 8, 6), Materials.gold(), finialMatrices(poles, height), 'finials'));
  const flagMat = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
  group.add(instancedFromMatrices(buildStripedFlagGeometry(FLAG_INDONESIA), flagMat, flagMatrices(poles, height, flagEvery, 0), 'flags-indonesia'));
  group.add(instancedFromMatrices(buildStripedFlagGeometry(FLAG_RIAU), flagMat, flagMatrices(poles, height, flagEvery, 1), 'flags-riau'));
  group.userData = { count, semiX, semiZ, height };
  return group;
}
