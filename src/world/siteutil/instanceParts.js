import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Helper InstancedMesh dari "bagian" (part) yang sama untuk banyak posisi.
 * part = { geometry, material, matrix? (Matrix4 lokal), castShadow?, name? }
 * pos  = { x, z, y?, rotY?, scale? }
 */
const _m = new THREE.Matrix4();
const _identity = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();

/** Matrix4 penempatan dari objek posisi sederhana. */
export function placementMatrix(p, out = new THREE.Matrix4()) {
  const s = p.scale ?? 1;
  _pos.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  _euler.set(0, p.rotY ?? 0, 0);
  _quat.setFromEuler(_euler);
  _scl.set(s, s, s);
  return out.compose(_pos, _quat, _scl);
}

/** Bangun satu InstancedMesh untuk sebuah part di semua posisi. */
export function instancePart(part, positions) {
  const mesh = new THREE.InstancedMesh(part.geometry, part.material, Math.max(positions.length, 1));
  for (let i = 0; i < positions.length; i += 1) {
    placementMatrix(positions[i], _m);
    mesh.setMatrixAt(i, _m.multiply(part.matrix ?? _identity));
  }
  mesh.count = positions.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = part.castShadow ?? false;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  if (part.name) mesh.name = part.name;
  return mesh;
}

/**
 * Gabungkan part yang berbagi material & flag bayangan menjadi satu part
 * (matrix lokal dibakar ke geometri) agar satu InstancedMesh per material.
 */
function mergePartsByMaterial(parts) {
  const buckets = new Map();
  parts.forEach((p) => {
    const key = `${p.material.uuid}|${Number(p.castShadow ?? false)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  });
  return [...buckets.values()].map((list) => {
    if (list.length === 1) return list[0];
    const geos = list.map((p) => (p.matrix ? p.geometry.clone().applyMatrix4(p.matrix) : p.geometry));
    const merged = mergeGeometries(geos, false);
    if (!merged) return list; // atribut tak kompatibel → biarkan terpisah
    return { geometry: merged, material: list[0].material, castShadow: list[0].castShadow, name: list.map((p) => p.name).filter(Boolean).join('+') };
  }).flat();
}

/** Bagi posisi per sel grid (cellSize m) agar tiap sel punya bounding sphere sendiri → frustum culling per sel. */
function bucketByCell(positions, cellSize) {
  const cells = new Map();
  for (const p of positions) {
    const key = `${Math.floor((p.x ?? 0) / cellSize)},${Math.floor((p.z ?? 0) / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(p);
  }
  return [...cells.values()];
}

/**
 * Bangun Group berisi InstancedMesh per material (part digabung bila bisa).
 * Dengan `cellSize` > 0 posisi dibagi per sel grid: satu InstancedMesh per sel per material
 * (geometri/material dibagikan), sehingga sel di luar frustum kamera dan frustum bayangan dilewati.
 * Nama mesh sama untuk semua sel agar pencarian berawalan nama tetap bekerja.
 */
export function instanceParts(parts, positions, name = 'instanced', { cellSize = 0 } = {}) {
  const group = new THREE.Group();
  group.name = name;
  if (!positions || positions.length === 0) return group;
  const merged = mergePartsByMaterial(parts);
  const batches = cellSize > 0 ? bucketByCell(positions, cellSize) : [positions];
  for (const batch of batches) merged.forEach((part) => group.add(instancePart(part, batch)));
  return group;
}

/** Matrix4 lokal dari translasi + rotasi euler + skala (helper ringkas). */
export function localMatrix(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Set warna per-instance acak dari palet. */
export function colorizeInstances(mesh, palette, rnd) {
  const c = new THREE.Color();
  for (let i = 0; i < mesh.count; i += 1) {
    c.setHex(palette[Math.floor(rnd.next() * palette.length)]);
    mesh.setColorAt(i, c);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** Group Mesh biasa dari daftar part (untuk objek tunggal, bukan instanced). */
export function groupFromParts(parts, name = 'group') {
  const g = new THREE.Group();
  g.name = name;
  parts.forEach((p) => {
    const m = new THREE.Mesh(p.geometry, p.material);
    if (p.matrix) m.applyMatrix4(p.matrix);
    m.castShadow = p.castShadow ?? false;
    m.receiveShadow = true;
    m.name = p.name ?? '';
    g.add(m);
  });
  return g;
}

/** Terapkan posisi/rotasi/skala sederhana ke Object3D. */
export function placeObject(obj, p) {
  obj.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  obj.rotation.y = p.rotY ?? 0;
  obj.scale.setScalar(p.scale ?? 1);
  return obj;
}
