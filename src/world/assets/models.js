import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Pemuat model GLB hasil Blender. Satu loader + cache per URL: model yang sama
 * dimuat sekali lalu di-clone (geometri & material dibagikan antar salinan).
 * Path relatif terhadap folder public/, sehingga tetap benar di GitHub Pages.
 */
const loader = new GLTFLoader();
const cache = new Map();

/** URL absolut terhadap base Vite ("/" saat dev, "/<repo>/" di Pages). */
export function modelUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}${path.replace(/^\//, '')}`;
}

/** Muat GLB sekali; kembalikan Promise<THREE.Group> sumber (jangan dimodifikasi). */
export function loadModel(path) {
  const url = modelUrl(path);
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).then((gltf) => prepare(gltf.scene)));
  }
  return cache.get(url);
}

/** Salinan siap pakai dari model (geometri/material dibagikan). */
export async function instantiateModel(path, { x = 0, y = 0, z = 0, rotY = 0, scale = 1 } = {}) {
  const source = await loadModel(path);
  const obj = source.clone(true);
  obj.position.set(x, y, z);
  obj.rotation.y = rotY;
  obj.scale.setScalar(scale);
  return obj;
}

/** Bayangan untuk semua mesh model. */
function prepare(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}

/**
 * Tempatkan daftar model ke group secara asinkron. Kegagalan satu model tidak
 * menghentikan yang lain; dikembalikan ringkasan agar pemanggil bisa melapor.
 * Item dengan `replaces` menyembunyikan objek prosedural bernama itu di `world`
 * HANYA bila model berhasil dimuat (versi prosedural tetap jadi cadangan).
 * @param {THREE.Object3D} group
 * @param {{path:string, x?:number, y?:number, z?:number, rotY?:number, scale?:number, replaces?:string}[]} items
 * @param {{world?: THREE.Object3D}} [opts]
 */
export async function placeModels(group, items, { world = null } = {}) {
  const results = await Promise.allSettled(items.map((it) => instantiateModel(it.path, it)));
  const failed = [];
  const replaced = [];
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      failed.push({ path: items[i].path, error: String(r.reason?.message ?? r.reason) });
      return;
    }
    group.add(r.value);
    const target = items[i].replaces && world?.getObjectByName(items[i].replaces);
    if (target) {
      target.visible = false;
      replaced.push(items[i].replaces);
    }
  });
  return { placed: results.length - failed.length, failed, replaced };
}

export const MODEL_GROUP_NAME = 'modelBlender';

/** Group kosong bernama untuk semua model Blender. */
export function createModelGroup() {
  const g = new THREE.Group();
  g.name = MODEL_GROUP_NAME;
  return g;
}
