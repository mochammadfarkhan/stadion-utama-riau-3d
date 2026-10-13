/**
 * Rambut & penutup kepala chibi: gumpalan sphere/capsule yang digabung menjadi
 * SATU geometri per gaya (dibuat sekali, dibagikan antar Humanoid). Warna lewat
 * matFor(color). Semua koordinat relatif pivot kepala (pusat kepala di
 * y = DIM.headLift, jari-jari DIM.headR, wajah menghadap +Z).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DIM } from './Humanoid.dim.js';
import { matFor } from './util.js';

const R = DIM.headR;
const CY = DIM.headLift;
const TWO_PI = Math.PI * 2;

/** Daftar gaya rambut biasa (bisa dipadukan dengan topi pet legacy `hat`). */
export const HAIR_STYLES = Object.freeze([
  'helmet', 'bob', 'twintails', 'bun', 'afro', 'buzz', 'mohawk', 'long',
]);
/** Penutup kepala (menggantikan rambut). */
export const HEADWEAR_STYLES = Object.freeze(['hijab', 'caping', 'hardhat', 'cap']);
export const ALL_HAIR_STYLES = Object.freeze([...HAIR_STYLES, ...HEADWEAR_STYLES]);
/** Gaya yang terlalu tinggi untuk dipakai di bawah topi; diganti 'helmet'. */
const TALL_STYLES = new Set(['afro', 'bun', 'mohawk', 'twintails']);
/** Gaya yang memerlukan material dua sisi (ada bagian cekung terbuka). */
const DOUBLE_SIDED = new Set(['hijab', 'caping']);

function sphere(r, x, y, z, segs = 10) {
  return new THREE.SphereGeometry(r, segs, segs - 2).translate(x, CY + y, z);
}

/** Tudung bola yang menutupi bagian atas kepala sampai sudut `frac` × PI. */
function cap(r, frac, y = 0, z = 0) {
  return new THREE.SphereGeometry(r, 12, 8, 0, TWO_PI, 0, Math.PI * frac).translate(0, CY + y, z);
}

function capsule(r, len, x, y, z, rotX = 0) {
  return new THREE.CapsuleGeometry(r, len, 2, 8).rotateX(rotX).translate(x, CY + y, z);
}

const BUILDERS = {
  helmet: () => [cap(R + 0.02, 0.58, 0, -0.015)],
  bob: () => [
    cap(R + 0.025, 0.62, 0, -0.01),
    capsule(0.07, 0.16, -(R - 0.02), -0.08, 0.03),
    capsule(0.07, 0.16, R - 0.02, -0.08, 0.03),
    new RoundedBoxGeometry(0.34, 0.08, 0.08, 2, 0.03).translate(0, CY + 0.16, R - 0.03),
  ],
  twintails: () => [
    cap(R + 0.02, 0.58, 0, -0.015),
    sphere(0.11, -(R + 0.05), 0.02, -0.1),
    sphere(0.11, R + 0.05, 0.02, -0.1),
  ],
  bun: () => [cap(R + 0.02, 0.56, 0, -0.015), sphere(0.11, 0, R + 0.05, -0.06)],
  afro: () => [sphere(R + 0.1, 0, 0.05, -0.04, 12)],
  buzz: () => [cap(R + 0.012, 0.5, 0, -0.01)],
  mohawk: () => [cap(R + 0.012, 0.5, 0, -0.01), capsule(0.06, 0.2, 0, R + 0.02, -0.02, Math.PI / 2)],
  long: () => [
    cap(R + 0.025, 0.62, 0, -0.015),
    capsule(0.14, 0.34, 0, -0.26, -(R - 0.08)),
    capsule(0.07, 0.2, -(R - 0.01), -0.12, 0.0),
    capsule(0.07, 0.2, R - 0.01, -0.12, 0.0),
  ],
  hijab: () => [
    cap(R + 0.03, 0.66, 0.0, -0.01),
    new THREE.CylinderGeometry(0.22, 0.44, 0.52, 14, 1, true).translate(0, CY - 0.12, -0.01),
  ],
  caping: () => [new THREE.ConeGeometry(0.46, 0.17, 14, 1, false).translate(0, CY + R - 0.01, 0)],
  hardhat: () => [
    cap(R + 0.035, 0.5, 0.0, 0),
    new THREE.CylinderGeometry(R + 0.09, R + 0.09, 0.02, 14).translate(0, CY + 0.02, 0),
  ],
  cap: () => [
    cap(R + 0.035, 0.52, 0.0, 0),
    new RoundedBoxGeometry(0.26, 0.03, 0.17, 2, 0.012).translate(0, CY + 0.03, R + 0.07),
  ],
};

const cache = new Map();

/** Samakan bentuk atribut (RoundedBox tanpa index) agar bisa digabung. */
function unindexed(geo) {
  return geo.index ? geo.toNonIndexed() : geo;
}

/** Geometri gabungan untuk satu gaya; dibuat sekali lalu di-cache. */
export function hairGeometry(style) {
  const key = BUILDERS[style] ? style : 'helmet';
  const hit = cache.get(key);
  if (hit) return hit;
  const pieces = BUILDERS[key]().map(unindexed);
  const merged = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  cache.set(key, merged);
  return merged;
}

/** Gaya rambut yang aman dipakai di bawah topi pet. */
export function styleUnderHat(style) {
  return TALL_STYLES.has(style) ? 'helmet' : style;
}

/** Mesh rambut/penutup kepala (1 draw call) untuk pivot kepala. */
export function createHair(style, color) {
  const key = BUILDERS[style] ? style : 'helmet';
  const mat = DOUBLE_SIDED.has(key) ? matFor(color, { side: THREE.DoubleSide }) : matFor(color);
  const mesh = new THREE.Mesh(hairGeometry(key), mat);
  mesh.castShadow = false;
  return mesh;
}

/** Topi pet lepas (legacy opts.hat) dipakai di atas rambut biasa. */
export function createHat(color) {
  return createHair('cap', color);
}
