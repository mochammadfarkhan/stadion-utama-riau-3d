/**
 * LOD humanoid. Humanoid penuh = ±15 Mesh (satu draw call dan satu entri shadow-pass per bagian);
 * pada jarak menengah seluruh bagian digabung menjadi SATU mesh berpose statis dengan warna
 * per-vertex (1 draw call, tanpa bayangan), dan pada jarak ekstrem disembunyikan sama sekali.
 *
 * Level: 0 = detail penuh (body), 1 = mesh gabungan, 2 = tersembunyi.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope } from '../engine/ResourceScope.js';

export const LOD_NEAR = 60;  // m: di dalam jarak ini detail penuh + bayangan
export const LOD_FAR = 320;  // m: di luar jarak ini disembunyikan

const NEAR2 = LOD_NEAR * LOD_NEAR;
const FAR2 = LOD_FAR * LOD_FAR;

/** Material bersama untuk semua mesh LOD (Lambert, warna dari atribut vertex), satu per ResourceScope aktif. */
const lodMaterial = () => currentScope().get('humanoid:lodMaterial', () => new THREE.MeshLambertMaterial({ vertexColors: true }));

/** Level LOD dari jarak kuadrat ke kamera. NaN dianggap terdekat agar humanoid tidak hilang karena data rusak. */
export function lodLevelFor(dist2) {
  if (!(dist2 > NEAR2)) return 0;
  return dist2 <= FAR2 ? 1 : 2;
}

/** Salinan geometri hanya posisi + normal, non-indexed, dengan warna per-vertex dan transform diterapkan. */
function bakePart(mesh) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position'));
  if (src.getAttribute('normal')) geo.setAttribute('normal', src.getAttribute('normal'));
  else geo.computeVertexNormals();
  geo.applyMatrix4(mesh.matrixWorld);
  const count = geo.attributes.position.count;
  const color = mesh.material.color ?? new THREE.Color(0xffffff);
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    data[i * 3] = color.r;
    data[i * 3 + 1] = color.g;
    data[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return geo;
}

/**
 * Gabungkan semua mesh terlihat di bawah `body` (pose saat dipanggil) menjadi satu Mesh.
 * `group` harus belum punya transform (matriks dunia = relatif ke group).
 * @returns {THREE.Mesh}
 */
export function buildStaticLodMesh(group, body) {
  group.updateMatrixWorld(true);
  const parts = [];
  body.traverse((o) => {
    if (o.isMesh && o.visible && o.geometry?.attributes?.position) parts.push(bakePart(o));
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts, false), lodMaterial());
  for (const g of parts) g.dispose();
  mesh.name = 'humanoidLod';
  mesh.castShadow = false;
  mesh.visible = false;
  return mesh;
}

/**
 * Pengelola LOD: kumpulkan humanoid dari sebuah root lalu atur level tiap frame.
 * `addFrom` idempoten.
 */
export function createHumanoidLod() {
  const entries = new Map(); // group -> { body, mesh, level }

  return {
    get size() { return entries.size; },

    /** @returns {number} jumlah humanoid terdaftar (total) setelah menelusuri root */
    addFrom(root) {
      root.traverse((o) => {
        const info = o.userData?.humanoidLod;
        if (info && !entries.has(o)) entries.set(o, { body: info.body, mesh: info.mesh, level: 0 });
      });
      return entries.size;
    },

    /** @param {THREE.Vector3} camPos */
    update(camPos) {
      for (const [group, e] of entries) {
        const m = group.matrixWorld.elements;
        const dx = m[12] - camPos.x;
        const dy = m[13] - camPos.y;
        const dz = m[14] - camPos.z;
        const level = lodLevelFor(dx * dx + dy * dy + dz * dz);
        if (level === e.level) continue;
        e.level = level;
        e.body.visible = level === 0;
        e.mesh.visible = level === 1;
      }
    },
  };
}
