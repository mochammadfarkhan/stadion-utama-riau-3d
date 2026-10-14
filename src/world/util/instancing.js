/** Helper InstancedMesh: penempatan batang antar dua titik & finalisasi bounding. */
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);
const _mid = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _mat = new Matrix4();

/** Matriks batang (geometri unit sepanjang sumbu Z, berpusat di origin) dari titik a ke b. */
export function segmentMatrix(a, b, thickX, thickY = thickX, target = new Matrix4()) {
  const len = a.distanceTo(b);
  _mid.addVectors(a, b).multiplyScalar(0.5);
  _mat.lookAt(b, a, UP); // sumbu +Z lokal mengarah a → b
  _quat.setFromRotationMatrix(_mat);
  _scale.set(thickX, thickY, Math.max(len, 1e-4));
  return target.compose(_mid, _quat, _scale);
}

/** Tandai matriks instance perlu update & hitung bounding sphere untuk culling. */
export function finalizeInstanced(mesh) {
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
  return mesh;
}

/** Bangun InstancedMesh dari daftar Matrix4. */
export function instancedFromMatrices(geometry, material, matrices, name = '') {
  const mesh = new InstancedMesh(geometry, material, Math.max(matrices.length, 1));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  mesh.name = name;
  return finalizeInstanced(mesh);
}
