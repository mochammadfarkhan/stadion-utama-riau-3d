/**
 * Kit bagian chibi kartun dari Blender (assets-src/blender/karakter/chibi_kit.py → public/models/karakter/chibi-kit.glb):
 * kepala bertelinga, wajah mata anime (warna per-vertex), rambut, hijab, dan torso berkerah. Setelah setHumanoidKit()
 * dipanggil (sekali saat muat, sebelum entitas dibuat), Humanoid memakai geometri ini menggantikan bentuk prosedural;
 * bila GLB gagal dimuat, kitGeometry() mengembalikan null dan Humanoid tetap memakai bentuk lama.
 *
 * Geometri disalin dan dinormalkan ke atribut position + normal (+ color float RGB untuk wajah) agar bisa digabung
 * dengan kepingan prosedural (kacamata/kumis) dan dibakar ke LOD / SkinnedMesh.
 */
import * as THREE from 'three';

export const HUMANOID_KIT_PATH = 'models/karakter/chibi-kit.glb';
/** Nama node yang dikenali; hair_<gaya> menggantikan gaya rambut prosedural dengan nama sama. */
export const KIT_PARTS = Object.freeze([
  'head', 'face', 'torso', 'hijab',
  'hair_helmet', 'hair_bob', 'hair_long', 'hair_bun', 'hair_twintails', 'hair_buzz', 'hair_afro',
  'hair_cap', 'hair_hardhat',
]);

/** @type {Map<string, THREE.BufferGeometry>} */
let parts = new Map();

/** Salinan geometri dalam ruang root: hanya position/normal/color(RGB float), index dipertahankan. */
function normalized(mesh) {
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) geo.setAttribute('normal', src.getAttribute('normal').clone());
  const col = src.getAttribute('color');
  if (col) {
    const rgb = new Float32Array(col.count * 3);
    for (let i = 0; i < col.count; i += 1) {
      rgb[i * 3] = col.getX(i);
      rgb[i * 3 + 1] = col.getY(i);
      rgb[i * 3 + 2] = col.getZ(i);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  }
  if (src.index) geo.setIndex(src.index.clone());
  geo.applyMatrix4(mesh.matrixWorld);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Pasang kit dari root GLB (sumber loadModel; tidak diubah). Mengembalikan daftar bagian yang terpasang.
 * @param {THREE.Object3D} root
 * @returns {string[]}
 */
export function setHumanoidKit(root) {
  const next = new Map();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const name = o.isMesh ? (KIT_PARTS.includes(o.name) ? o.name : o.parent?.name) : null;
    if (name && KIT_PARTS.includes(name) && !next.has(name)) next.set(name, normalized(o));
  });
  parts = next;
  return [...next.keys()];
}

/** Geometri kit untuk sebuah bagian, atau null bila kit belum/tidak dimuat. */
export function kitGeometry(name) {
  return parts.get(name) ?? null;
}

/** Lepas kit (dipakai tes; Humanoid kembali ke bentuk prosedural). */
export function clearHumanoidKit() {
  for (const g of parts.values()) g.dispose();
  parts = new Map();
}
