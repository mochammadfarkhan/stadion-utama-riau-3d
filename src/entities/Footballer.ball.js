/**
 * Bola sepak prosedural: icosahedron tersubdivisi dengan vertex color.
 * Segitiga yang berdekatan dengan 12 titik sudut icosahedron asli dicat hitam
 * sehingga membentuk 12 panel pentagon kasar di atas dasar putih.
 */
import * as THREE from 'three';
import { FOOTBALL } from '../config/constants.js';

const PENTAGON_ANGLE = 0.36; // rad; radius sudut panel hitam di sekitar tiap vertex icosahedron
const PHI = (1 + Math.sqrt(5)) / 2;

/** 12 vertex icosahedron ternormalisasi. */
function icosahedronVertices() {
  const raw = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  return raw.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
}

/** Geometri bola dengan warna per-vertex (dibagi antar instance). */
function createBallGeometry(radius) {
  const geo = new THREE.IcosahedronGeometry(radius, 2); // PolyhedronGeometry sudah non-indexed
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const verts = icosahedronVertices();
  const centroid = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    c.fromBufferAttribute(pos, f + 2);
    centroid.copy(a).add(b).add(c).normalize();
    const black = verts.some((v) => centroid.angleTo(v) < PENTAGON_ANGLE);
    const shade = black ? 0.08 : 0.95;
    for (let k = 0; k < 3; k++) colors.set([shade, shade, shade], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

let sharedGeo = null;
let sharedMat = null;

/**
 * Buat mesh bola. Posisi/rotasi diurus pemanggil (lihat rollBall).
 * @param {number} [radius]
 */
export function createBallMesh(radius = FOOTBALL.ballRadius) {
  sharedGeo ??= createBallGeometry(radius);
  sharedMat ??= new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(sharedGeo, sharedMat);
  mesh.castShadow = true;
  mesh.name = 'ball';
  return mesh;
}

const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Putar mesh bola sesuai kecepatan linear (menggulir): sumbu = up × v,
 * sudut = |v|·dt / r. Mutasi hanya pada quaternion mesh (visual).
 */
export function rollBall(mesh, vel, dt, radius = FOOTBALL.ballRadius) {
  const speed = Math.hypot(vel.x, vel.z);
  if (speed < 1e-4 || !(dt > 0)) return;
  _axis.set(vel.x / speed, 0, vel.z / speed);
  _axis.crossVectors(UP, _axis);
  _q.setFromAxisAngle(_axis, (speed * dt) / radius);
  mesh.quaternion.premultiply(_q);
}
