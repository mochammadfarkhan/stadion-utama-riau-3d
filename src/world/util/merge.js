/**
 * Penggabungan geometri statis per material untuk menekan draw call.
 *
 * mergeByMaterial(group) menelusuri Group, mengelompokkan Mesh biasa (bukan
 * InstancedMesh / Line / Sprite / Points, bukan yang bertanda userData.dynamic)
 * berdasarkan material + flag bayangan + layer + tata atribut geometri, lalu
 * menggabungkan geometrinya (transform dunia sudah diterapkan). Hasilnya Group
 * baru berisi satu Mesh per kelompok + objek yang tak bisa digabung (dipindah
 * apa adanya dengan transform dunianya). Group asal tidak diubah.
 */
import { Group, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Apakah objek boleh digabung (Mesh statis sederhana). */
function isMergeable(obj) {
  if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return false;
  if (obj.userData?.dynamic || obj.userData?.update) return false;
  if (!obj.visible || Array.isArray(obj.material)) return false;
  return Boolean(obj.geometry?.attributes?.position);
}

/** Apakah objek harus dipertahankan apa adanya (bukan Mesh gabungan, bukan Group kosong). */
function isKeepAsIs(obj) {
  return obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints || obj.isLight || obj.isCSS2DObject;
}

/** Kunci kelompok: material + bayangan + layer + atribut geometri + indeks. */
function groupKey(mesh) {
  const attrs = Object.keys(mesh.geometry.attributes).sort().join(',');
  const indexed = mesh.geometry.index ? 'i' : 'n';
  return [mesh.material.uuid, Number(mesh.castShadow), Number(mesh.receiveShadow), mesh.layers.mask, mesh.renderOrder, attrs, indexed].join('|');
}

/**
 * Pindahkan objek (beserta anak-anaknya, transform lokal tetap) ke root baru
 * dengan transform dunianya agar posisi akhirnya tidak berubah.
 */
function reparentWithWorldTransform(obj, root) {
  root.attach(obj); // memindahkan objek asli (referensi & userData.update tetap), transform dunia dipertahankan
}

/** Kumpulkan mesh yang bisa digabung per kunci; objek lain dipindah apa adanya. */
function collect(group, root) {
  const buckets = new Map();
  group.updateMatrixWorld(true);
  const visit = (obj) => {
    if (obj !== group && isKeepAsIs(obj) && !isMergeable(obj)) {
      reparentWithWorldTransform(obj, root);
      return;
    }
    if (obj !== group && isMergeable(obj)) {
      const key = groupKey(obj);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(obj);
    }
    for (const child of [...obj.children]) visit(child); // salinan: attach() memutasi children
  };
  visit(group);
  return buckets;
}

/** Satu Mesh gabungan dari sekumpulan mesh dengan kunci sama; null bila gagal. */
function mergeBucket(meshes) {
  const geos = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return null;
  merged.computeBoundingSphere();
  const first = meshes[0];
  const mesh = new Mesh(merged, first.material);
  mesh.castShadow = first.castShadow;
  mesh.receiveShadow = first.receiveShadow;
  mesh.renderOrder = first.renderOrder;
  mesh.layers.mask = first.layers.mask;
  mesh.name = `${first.name || 'mesh'}+${meshes.length}`;
  return mesh;
}

/**
 * @param {Group} group group statis yang sudah diposisikan
 * @returns {Group} group baru (nama & userData disalin) dengan satu Mesh per material
 */
export function mergeByMaterial(group) {
  const root = new Group();
  root.name = group.name;
  root.userData = group.userData;
  root.layers.mask = group.layers.mask;
  const buckets = collect(group, root);
  for (const meshes of buckets.values()) {
    const merged = meshes.length > 1 ? mergeBucket(meshes) : null;
    if (merged) root.add(merged);
    else meshes.forEach((m) => reparentWithWorldTransform(m, root, false)); // anak sudah ditangani collect()
  }
  return root;
}
