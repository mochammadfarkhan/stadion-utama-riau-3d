/**
 * Wajah chibi: dua mata titik hitam + pipi merah muda tipis, tanpa mulut.
 * Opsional kacamata bulat & kumis kecil. Semua fitur satu pivot kepala digabung
 * menjadi SATU geometri berwarna per-vertex (dibuat sekali per varian, dibagi
 * antar Humanoid) agar hanya menambah 1 Mesh per orang.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIM } from './Humanoid.dim.js';

const EYE_COLOR = 0x151515;
const CHEEK_COLOR = 0xf5a3b0;   // merah muda lembut (meniru opacity rendah di atas kulit)
const GLASSES_COLOR = 0x2b2b2b;
const MUSTACHE_COLOR = 0x3a2a1a;
const R = DIM.headR;

/** Material bersama untuk semua wajah (warna dari atribut vertex). */
export const FACE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

const _color = new THREE.Color();
const _obj = new THREE.Object3D();
const _dir = new THREE.Vector3();

/** Beri atribut warna seragam pada geometri. */
function tint(geo, hex) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _color.setHex(hex);
  for (let i = 0; i < n; i += 1) arr.set([_color.r, _color.g, _color.b], i * 3);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return geo;
}

/** Tempelkan geometri (normal +Z) ke permukaan kepala pada arah (x, y, z). */
function onHead(geo, x, y, z, lift = 0.004) {
  _dir.set(x, y, z).normalize();
  _obj.position.copy(_dir).multiplyScalar(R + lift);
  _obj.position.y += DIM.headLift;
  _obj.lookAt(_obj.position.x + _dir.x, _obj.position.y + _dir.y, _obj.position.z + _dir.z);
  _obj.updateMatrix();
  return geo.applyMatrix4(_obj.matrix);
}

function eyes() {
  return [-1, 1].map((s) => onHead(tint(new THREE.SphereGeometry(0.032, 8, 6), EYE_COLOR), s * 0.34, 0.08, 1, -0.012));
}

function cheeks() {
  return [-1, 1].map((s) => onHead(tint(new THREE.CircleGeometry(0.055, 12), CHEEK_COLOR), s * 0.62, -0.18, 0.78));
}

function glasses() {
  const rims = [-1, 1].map((s) => onHead(tint(new THREE.TorusGeometry(0.065, 0.008, 6, 14), GLASSES_COLOR), s * 0.34, 0.08, 1, 0.02));
  const bridge = onHead(tint(new THREE.BoxGeometry(0.08, 0.012, 0.012), GLASSES_COLOR), 0, 0.08, 1, 0.02);
  return [...rims, bridge];
}

function mustache() {
  const g = new THREE.CapsuleGeometry(0.016, 0.09, 2, 6).rotateZ(Math.PI / 2);
  return [onHead(tint(g, MUSTACHE_COLOR), 0, -0.26, 1, 0.006)];
}

const variants = new Map();

/** Geometri wajah untuk kombinasi {glasses, mustache}; dibuat sekali lalu di-cache. */
export function faceGeometry({ glasses: hasGlasses = false, mustache: hasMustache = false } = {}) {
  const key = `${hasGlasses ? 'g' : '-'}${hasMustache ? 'm' : '-'}`;
  const hit = variants.get(key);
  if (hit) return hit;
  const pieces = [...eyes(), ...cheeks()];
  if (hasGlasses) pieces.push(...glasses());
  if (hasMustache) pieces.push(...mustache());
  const merged = mergeGeometries(pieces, false);
  variants.set(key, merged);
  return merged;
}

/** Mesh wajah (1 draw call) untuk ditempel di pivot kepala. */
export function createFace(opts = {}) {
  const mesh = new THREE.Mesh(faceGeometry(opts), FACE_MAT);
  mesh.castShadow = false;
  return mesh;
}
