/**
 * Wajah chibi: dua mata titik hitam + pipi merah muda tipis, tanpa mulut.
 * Opsional kacamata bulat & kumis kecil. Semua fitur satu pivot kepala digabung
 * menjadi SATU geometri berwarna per-vertex (dibuat sekali per varian, dibagi
 * antar Humanoid) agar hanya menambah 1 Mesh per orang.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIM } from './Humanoid.dim.js';
import { currentScope } from '../engine/ResourceScope.js';
import { kitGeometry } from './Humanoid.kit.js';

const EYE_COLOR = 0x151515;
const CHEEK_COLOR = 0xf5a3b0;   // merah muda lembut (meniru opacity rendah di atas kulit)
const GLASSES_COLOR = 0x2b2b2b;
const MUSTACHE_COLOR = 0x3a2a1a;
const R = DIM.headR;

/** Material wajah bersama (warna dari atribut vertex), satu per ResourceScope aktif. */
export function faceMaterial() {
  return currentScope().get('humanoid:faceMaterial', () => new THREE.MeshLambertMaterial({ vertexColors: true }));
}

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

/** Posisi mata: titik kecil prosedural vs mata anime besar kit (u = ±0.36, v = −0.08 rad di chibi_kit.py). */
const EYES_PROC = { x: 0.34, y: 0.08, rim: 0.065 };
const EYES_KIT = { x: 0.38, y: -0.08, rim: 0.082 };

function glasses(e) {
  const rims = [-1, 1].map((s) => onHead(tint(new THREE.TorusGeometry(e.rim, 0.009, 6, 16), GLASSES_COLOR), s * e.x, e.y, 1, 0.02));
  const bridge = onHead(tint(new THREE.BoxGeometry(e.x * 0.5, 0.012, 0.012), GLASSES_COLOR), 0, e.y + 0.02, 1, 0.02);
  return [...rims, bridge];
}

function mustache(y = -0.26) {
  const g = new THREE.CapsuleGeometry(0.016, 0.09, 2, 6).rotateZ(Math.PI / 2);
  return [onHead(tint(g, MUSTACHE_COLOR), 0, y, 1, 0.006)];
}

/** Kepingan prosedural tanpa uv agar bisa digabung dengan wajah kit (position/normal/color saja). */
function stripUv(geo) {
  geo.deleteAttribute('uv');
  return geo;
}

/** Geometri wajah untuk kombinasi {glasses, mustache}; dibuat sekali per ResourceScope aktif. */
export function faceGeometry({ glasses: hasGlasses = false, mustache: hasMustache = false } = {}) {
  const kit = kitGeometry('face');
  if (kit && !hasGlasses && !hasMustache) return kit;
  const key = `${kit ? 'k' : 'p'}${hasGlasses ? 'g' : '-'}${hasMustache ? 'm' : '-'}`;
  return currentScope().get(`humanoid:face:${key}`, () => {
    if (kit) {
      const extra = [...(hasGlasses ? glasses(EYES_KIT) : []), ...(hasMustache ? mustache(-0.24) : [])].map(stripUv);
      return mergeGeometries([kit, ...extra], false);
    }
    const pieces = [...eyes(), ...cheeks()];
    if (hasGlasses) pieces.push(...glasses(EYES_PROC));
    if (hasMustache) pieces.push(...mustache());
    return mergeGeometries(pieces, false);
  });
}

/** Mesh wajah (1 draw call) untuk ditempel di pivot kepala. */
export function createFace(opts = {}) {
  const mesh = new THREE.Mesh(faceGeometry(opts), faceMaterial());
  mesh.castShadow = false;
  return mesh;
}
