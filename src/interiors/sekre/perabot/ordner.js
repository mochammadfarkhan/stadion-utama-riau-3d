import * as THREE from 'three';
import { TMP_M, TMP_E, TMP_V } from './bentuk.js';
import { ordnerSlots } from '../data.js';
import { tint } from '../canvas.js';

/** S10: 12 map ordner (InstancedMesh, warna per instans) di rak kaca lemari; koordinat ruang. */
export function buildOrdner(m) {
  const slots = ordnerSlots();
  const mesh = new THREE.InstancedMesh(tint(new THREE.BoxGeometry(0.08, 0.32, 0.3), '#ffffff'), m.prop, slots.length);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const color = new THREE.Color();
  slots.forEach((s, i) => {
    q.setFromEuler(TMP_E.set(0, 0, s.miring));
    TMP_M.compose(TMP_V.set(s.x, s.y + 0.16, s.z), q, one);
    mesh.setMatrixAt(i, TMP_M);
    mesh.setColorAt(i, color.set(s.warna));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = 'S10';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
