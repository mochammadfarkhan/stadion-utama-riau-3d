import * as THREE from 'three';

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

/** Bangun Group berisi InstancedMesh untuk setiap part. */
export function instanceParts(parts, positions, name = 'instanced') {
  const group = new THREE.Group();
  group.name = name;
  if (!positions || positions.length === 0) return group;
  parts.forEach((part) => group.add(instancePart(part, positions)));
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
